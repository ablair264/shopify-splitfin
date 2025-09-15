const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (you'll need to provide your service account key)
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

// Check if service account file exists
if (!fs.existsSync(serviceAccountPath)) {
  console.log('❌ Firebase service account file not found!');
  console.log('📝 Please create: scripts/firebase-service-account.json');
  console.log('🔑 Download this from Firebase Console > Project Settings > Service Accounts');
  console.log('');
  console.log('Or set the GOOGLE_APPLICATION_CREDENTIALS environment variable:');
  console.log('export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/firebase-service-account.json"');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`
  });
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const exportDir = path.join(__dirname, '../firebase-export');

// Ensure export directory exists
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
  console.log('📁 Created export directory');
}

// Function to export a collection
async function exportCollection(collectionName, outputFileName) {
  console.log(`\n🔄 Exporting ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const documents = [];
    
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    const outputPath = path.join(exportDir, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Exported ${documents.length} documents to ${outputFileName}`);
    return documents.length;
  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error.message);
    return 0;
  }
}

// Main export function
async function exportCustomerData() {
  console.log('🚀 Starting Firebase customer data export...\n');
  
  // Common collection names for customer data
  const possibleCollections = [
    { name: 'customers', file: 'customers.json' },
    { name: 'customer_data', file: 'customers.json' },
    { name: 'users', file: 'customers.json' },
    { name: 'contacts', file: 'customers.json' },
    { name: 'clients', file: 'customers.json' }
  ];
  
  let exportedCount = 0;
  let successfulExports = [];
  
  for (const collection of possibleCollections) {
    try {
      console.log(`🔍 Checking collection: ${collection.name}`);
      
      // Check if collection exists by trying to get one document
      const testSnapshot = await db.collection(collection.name).limit(1).get();
      
      if (!testSnapshot.empty) {
        const count = await exportCollection(collection.name, collection.file);
        if (count > 0) {
          exportedCount += count;
          successfulExports.push(`${collection.name} (${count} documents)`);
        }
      } else {
        console.log(`   ⚠️  Collection ${collection.name} is empty or doesn't exist`);
      }
    } catch (error) {
      console.log(`   ⚠️  Collection ${collection.name} not accessible: ${error.message}`);
    }
  }
  
  // Also try to list all collections to see what's available
  console.log('\n📋 Available collections in your Firebase:');
  try {
    const collections = await db.listCollections();
    const collectionNames = collections.map(col => col.id);
    console.log('   📁 Found collections:', collectionNames.join(', '));
    
    // Check if any of these look like customer collections
    const customerLikeCollections = collectionNames.filter(name => 
      name.toLowerCase().includes('customer') || 
      name.toLowerCase().includes('user') || 
      name.toLowerCase().includes('contact') ||
      name.toLowerCase().includes('client')
    );
    
    if (customerLikeCollections.length > 0) {
      console.log('   🎯 Customer-related collections found:', customerLikeCollections.join(', '));
    }
  } catch (error) {
    console.log('   ⚠️  Could not list collections:', error.message);
  }
  
  console.log('\n📊 Export Summary:');
  console.log(`   ✅ Successfully exported: ${exportedCount} total documents`);
  console.log(`   📁 Files created: ${successfulExports.join(', ')}`);
  
  if (exportedCount === 0) {
    console.log('\n❌ No customer data was exported!');
    console.log('💡 This might be because:');
    console.log('   1. Your customer collection has a different name');
    console.log('   2. You need different Firebase permissions');
    console.log('   3. The data is in a subcollection');
    console.log('\n🔧 Next steps:');
    console.log('   1. Check the "Available collections" list above');
    console.log('   2. Let me know the correct collection name');
    console.log('   3. Or provide a sample document ID to help locate the data');
  } else {
    console.log('\n🎉 Export completed successfully!');
    console.log('🚀 You can now run: node scripts/migrate-customers-from-firebase.js');
  }
}

// Run the export
if (require.main === module) {
  exportCustomerData()
    .then(() => {
      console.log('\n✅ Export process finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Export failed:', error);
      process.exit(1);
    });
}

module.exports = { exportCustomerData, exportCollection };