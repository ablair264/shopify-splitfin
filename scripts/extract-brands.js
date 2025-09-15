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

async function exportBrands() {
  console.log('📁 Exporting brands collection...');
  
  try {
    const snapshot = await db.collection('brands').get();
    console.log(`   Found ${snapshot.size} brands`);
    
    if (snapshot.empty) {
      console.log('   ℹ️  Brands collection is empty');
      // Create empty array file
      const exportDir = path.join(__dirname, '../firebase-export');
      fs.writeFileSync(path.join(exportDir, 'brands.json'), '[]');
      return;
    }
    
    const documents = [];
    snapshot.docs.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    const exportDir = path.join(__dirname, '../firebase-export');
    fs.writeFileSync(path.join(exportDir, 'brands.json'), JSON.stringify(documents, null, 2));
    console.log(`✅ Exported ${documents.length} brands`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

exportBrands();