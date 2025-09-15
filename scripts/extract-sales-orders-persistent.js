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

async function exportAllSalesOrdersPersistent() {
  console.log('📁 Exporting ALL sales_orders with persistent saving...');
  
  const exportDir = path.join(__dirname, '../firebase-export');
  const progressFile = path.join(exportDir, 'export_progress.json');
  const tempFile = path.join(exportDir, 'sales_orders_temp.json');
  
  const batchSize = 50; // Smaller batches for faster processing
  let lastDoc = null;
  let totalProcessed = 0;
  let allDocuments = [];
  
  // Load existing progress if available
  if (fs.existsSync(progressFile)) {
    const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log(`📂 Resuming from ${progress.totalProcessed} processed documents`);
    totalProcessed = progress.totalProcessed;
    
    if (fs.existsSync(tempFile)) {
      allDocuments = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
      console.log(`📂 Loaded ${allDocuments.length} existing documents`);
    }
  }
  
  try {
    // If resuming, we need to skip to the right position
    let skipCount = totalProcessed;
    
    while (true) {
      console.log(`   Processing batch starting from document ${totalProcessed}...`);
      
      // Build query
      let query = db.collection('sales_orders').limit(batchSize).orderBy('created_time');
      
      // Skip documents we've already processed
      if (skipCount > 0) {
        const skipQuery = db.collection('sales_orders').limit(skipCount).orderBy('created_time');
        const skipSnapshot = await skipQuery.get();
        if (!skipSnapshot.empty) {
          lastDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1];
          query = query.startAfter(lastDoc);
        }
        skipCount = 0; // Only skip on first iteration
      } else if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.log('   ✅ No more documents to process');
        break;
      }
      
      console.log(`   📄 Processing ${snapshot.size} documents in this batch`);
      
      // Process documents in this batch
      for (const doc of snapshot.docs) {
        const data = {
          id: doc.id,
          ...convertTimestamps(doc.data())
        };
        
        // Get order_line_items subcollection (but limit processing time)
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
          console.log(`   ⚠️  Error getting line items for order ${doc.id}`);
        }
        
        allDocuments.push(data);
      }
      
      // Update counters
      totalProcessed += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      
      console.log(`   ✅ Batch complete. Total processed: ${totalProcessed}`);
      
      // Save progress every 5 batches (250 documents)
      if (totalProcessed % (batchSize * 5) === 0) {
        console.log('   💾 Saving progress...');
        
        // Save temporary data
        fs.writeFileSync(tempFile, JSON.stringify(allDocuments, null, 2));
        
        // Save progress
        fs.writeFileSync(progressFile, JSON.stringify({
          totalProcessed,
          lastProcessed: new Date().toISOString()
        }));
        
        console.log(`   💾 Progress saved. ${allDocuments.length} documents in temp file.`);
      }
      
      // Small delay to prevent overwhelming Firebase
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Final save
    const finalFile = path.join(exportDir, 'sales_orders_complete.json');
    fs.writeFileSync(finalFile, JSON.stringify(allDocuments, null, 2));
    
    console.log(`\n✅ Export completed! Total sales orders: ${allDocuments.length}`);
    console.log(`📄 Final file saved to: ${finalFile}`);
    
    // Generate summary
    const summary = {
      totalOrders: allDocuments.length,
      ordersWithLineItems: allDocuments.filter(d => d.order_line_items && d.order_line_items.length > 0).length,
      totalLineItems: allDocuments.reduce((sum, d) => sum + (d.order_line_items?.length || 0), 0),
      exportCompletedAt: new Date().toISOString()
    };
    
    const summaryPath = path.join(exportDir, 'sales_orders_complete_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`📊 Summary: ${summary.totalOrders} orders, ${summary.totalLineItems} line items`);
    
    // Cleanup temp files
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    if (fs.existsSync(progressFile)) fs.unlinkSync(progressFile);
    
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

exportAllSalesOrdersPersistent()
  .then(() => {
    console.log('✅ Sales orders export process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });