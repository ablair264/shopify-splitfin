const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load service account from file
const serviceAccount = require('/Users/alastairblair/Development/Splitfin-Prod-Current-New/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Helper function to convert Firestore timestamp to ISO string
function convertTimestamps(obj) {
  if (!obj) return obj;
  
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object') {
      if (obj[key]._seconds !== undefined && obj[key]._nanoseconds !== undefined) {
        obj[key] = new Date(obj[key]._seconds * 1000).toISOString();
      } else if (obj[key].toDate && typeof obj[key].toDate === 'function') {
        obj[key] = obj[key].toDate().toISOString();
      } else if (Array.isArray(obj[key])) {
        obj[key] = obj[key].map(item => convertTimestamps(item));
      } else {
        obj[key] = convertTimestamps(obj[key]);
      }
    }
  }
  
  return obj;
}

async function exportAllSalesOrdersInBatches() {
  console.log('📁 Exporting ALL sales_orders in batches...');
  
  const exportDir = path.join(__dirname, '../firebase-export');
  const batchSize = 100;
  let lastDoc = null;
  let totalProcessed = 0;
  let allDocuments = [];
  
  try {
    while (true) {
      console.log(`   Processing batch starting from document ${totalProcessed}...`);
      
      // Build query
      let query = db.collection('sales_orders').limit(batchSize).orderBy('created_time');
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.log('   No more documents to process');
        break;
      }
      
      console.log(`   Processing ${snapshot.size} documents in this batch`);
      
      // Process documents in this batch
      for (const doc of snapshot.docs) {
        const data = {
          id: doc.id,
          ...convertTimestamps(doc.data())
        };
        
        // Get order_line_items subcollection
        try {
          const lineItemsSnapshot = await doc.ref.collection('order_line_items').get();
          if (lineItemsSnapshot.size > 0) {
            data.order_line_items = [];
            for (const lineItemDoc of lineItemsSnapshot.docs) {
              data.order_line_items.push({
                id: lineItemDoc.id,
                ...convertTimestamps(lineItemDoc.data())
              });
            }
          }
        } catch (lineError) {
          console.log(`   ⚠️  Error getting line items for order ${doc.id}:`, lineError.message);
        }
        
        allDocuments.push(data);
      }
      
      // Update counters
      totalProcessed += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      console.log(`   Batch complete. Total processed so far: ${totalProcessed}`);
      
      // Small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save all documents to file
    const filePath = path.join(exportDir, 'sales_orders_complete.json');
    fs.writeFileSync(filePath, JSON.stringify(allDocuments, null, 2));
    
    console.log(`✅ Export completed! Total sales orders: ${allDocuments.length}`);
    console.log(`📄 Saved to: ${filePath}`);
    
    // Generate summary
    const summary = {
      totalOrders: allDocuments.length,
      ordersWithLineItems: allDocuments.filter(d => d.order_line_items && d.order_line_items.length > 0).length,
      totalLineItems: allDocuments.reduce((sum, d) => sum + (d.order_line_items?.length || 0), 0),
      dateRange: {
        earliest: allDocuments.reduce((earliest, d) => {
          const date = d.created_time || d.date;
          return (!earliest || date < earliest) ? date : earliest;
        }, null),
        latest: allDocuments.reduce((latest, d) => {
          const date = d.created_time || d.date;
          return (!latest || date > latest) ? date : latest;
        }, null)
      },
      sampleOrder: allDocuments[0]
    };
    
    const summaryPath = path.join(exportDir, 'sales_orders_complete_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`📊 Summary saved to: ${summaryPath}`);
    console.log(`📈 Stats: ${summary.totalOrders} orders, ${summary.totalLineItems} line items`);
    console.log(`📅 Date range: ${summary.dateRange.earliest} to ${summary.dateRange.latest}`);
    
  } catch (error) {
    console.error('❌ Error during export:', error);
    
    // Save whatever we have so far
    if (allDocuments.length > 0) {
      const partialPath = path.join(exportDir, 'sales_orders_partial.json');
      fs.writeFileSync(partialPath, JSON.stringify(allDocuments, null, 2));
      console.log(`💾 Saved partial data (${allDocuments.length} orders) to: ${partialPath}`);
    }
  }
}

exportAllSalesOrdersInBatches()
  .then(() => {
    console.log('✅ All sales orders export completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });