const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
// Load service account from file
const serviceAccount = require('/Users/alastairblair/Development/Splitfin-Prod-Current-New/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Collections to export
const collectionsToExport = [
  'brands',
  'conversations',
  'invoices',
  'items_data',
  'notifications',
  'purchase_orders',
  'sales_orders' // This has subcollection
];

// Helper function to convert Firestore timestamp to ISO string
function convertTimestamps(obj) {
  if (!obj) return obj;
  
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object') {
      if (obj[key]._seconds !== undefined && obj[key]._nanoseconds !== undefined) {
        // Convert Firestore timestamp
        obj[key] = new Date(obj[key]._seconds * 1000).toISOString();
      } else if (obj[key].toDate && typeof obj[key].toDate === 'function') {
        // Convert Firestore timestamp (client SDK format)
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

// Export a single collection
async function exportCollection(collectionName) {
  console.log(`📁 Exporting collection: ${collectionName}`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const documents = [];
    
    for (const doc of snapshot.docs) {
      const data = {
        id: doc.id,
        ...convertTimestamps(doc.data())
      };
      
      // Special handling for sales_orders to include order_line_items subcollection
      if (collectionName === 'sales_orders') {
        const lineItemsSnapshot = await doc.ref.collection('order_line_items').get();
        const lineItems = [];
        
        for (const lineItemDoc of lineItemsSnapshot.docs) {
          lineItems.push({
            id: lineItemDoc.id,
            ...convertTimestamps(lineItemDoc.data())
          });
        }
        
        if (lineItems.length > 0) {
          data.order_line_items = lineItems;
        }
      }
      
      documents.push(data);
    }
    
    console.log(`   ✅ Found ${documents.length} documents`);
    return { collectionName, documents };
    
  } catch (error) {
    console.error(`   ❌ Error exporting ${collectionName}:`, error.message);
    return { collectionName, error: error.message, documents: [] };
  }
}

// Main export function
async function exportAllData() {
  console.log('🚀 Starting Firebase data export...\n');
  
  const exportDir = path.join(__dirname, '../firebase-export');
  
  // Create export directory if it doesn't exist
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  
  const results = {
    exportDate: new Date().toISOString(),
    collections: {}
  };
  
  // Export each collection
  for (const collectionName of collectionsToExport) {
    const exportResult = await exportCollection(collectionName);
    results.collections[collectionName] = exportResult;
    
    // Also save individual collection files
    const collectionFile = path.join(exportDir, `${collectionName}.json`);
    fs.writeFileSync(
      collectionFile, 
      JSON.stringify(exportResult.documents, null, 2)
    );
  }
  
  // Save summary file
  const summaryFile = path.join(exportDir, 'export-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  
  // Generate statistics
  console.log('\n📊 Export Summary:');
  console.log('==================');
  
  let totalDocuments = 0;
  for (const [collectionName, data] of Object.entries(results.collections)) {
    const count = data.documents?.length || 0;
    totalDocuments += count;
    console.log(`${collectionName}: ${count} documents`);
  }
  
  console.log(`\nTotal documents exported: ${totalDocuments}`);
  console.log(`\n✅ Export completed! Files saved to: ${exportDir}`);
  
  // Also create a schema analysis file
  analyzeSchema(results.collections, exportDir);
}

// Analyze the schema of the collections
function analyzeSchema(collections, exportDir) {
  console.log('\n🔍 Analyzing data schema...');
  
  const schema = {};
  
  for (const [collectionName, data] of Object.entries(collections)) {
    if (!data.documents || data.documents.length === 0) continue;
    
    schema[collectionName] = {
      documentCount: data.documents.length,
      fields: {},
      sampleDocument: data.documents[0]
    };
    
    // Analyze field types and frequencies
    for (const doc of data.documents) {
      for (const [field, value] of Object.entries(doc)) {
        if (!schema[collectionName].fields[field]) {
          schema[collectionName].fields[field] = {
            types: new Set(),
            count: 0,
            nullable: false
          };
        }
        
        schema[collectionName].fields[field].count++;
        
        if (value === null || value === undefined) {
          schema[collectionName].fields[field].nullable = true;
          schema[collectionName].fields[field].types.add('null');
        } else if (Array.isArray(value)) {
          schema[collectionName].fields[field].types.add('array');
        } else {
          schema[collectionName].fields[field].types.add(typeof value);
        }
      }
    }
    
    // Convert Sets to Arrays for JSON serialization
    for (const field of Object.keys(schema[collectionName].fields)) {
      schema[collectionName].fields[field].types = 
        Array.from(schema[collectionName].fields[field].types);
      
      // Calculate field presence percentage
      schema[collectionName].fields[field].presence = 
        `${Math.round((schema[collectionName].fields[field].count / data.documents.length) * 100)}%`;
    }
  }
  
  const schemaFile = path.join(exportDir, 'schema-analysis.json');
  fs.writeFileSync(schemaFile, JSON.stringify(schema, null, 2));
  
  console.log(`✅ Schema analysis saved to: ${schemaFile}`);
}

// Run the export
exportAllData()
  .then(() => {
    console.log('\n🎉 Export process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  });