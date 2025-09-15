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

async function exportSalesOrders() {
  console.log('📁 Exporting sales_orders collection...');
  
  try {
    const snapshot = await db.collection('sales_orders').get(); // Get ALL sales orders
    const documents = [];
    let processedCount = 0;
    
    console.log(`   Found ${snapshot.size} sales orders to process`);
    
    for (const doc of snapshot.docs) {
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`   Processing order ${processedCount}/${snapshot.size}...`);
      }
      
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
      
      documents.push(data);
    }
    
    // Save to file
    const exportDir = path.join(__dirname, '../firebase-export');
    const filePath = path.join(exportDir, 'sales_orders.json');
    
    fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
    console.log(`✅ Exported ${documents.length} sales orders to ${filePath}`);
    
    // Also save a summary
    const summary = {
      totalOrders: documents.length,
      ordersWithLineItems: documents.filter(d => d.order_line_items && d.order_line_items.length > 0).length,
      totalLineItems: documents.reduce((sum, d) => sum + (d.order_line_items?.length || 0), 0),
      sampleOrder: documents[0]
    };
    
    const summaryPath = path.join(exportDir, 'sales_orders_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
  } catch (error) {
    console.error('❌ Error exporting sales_orders:', error);
  }
}

exportSalesOrders()
  .then(() => {
    console.log('✅ Sales orders export completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  });