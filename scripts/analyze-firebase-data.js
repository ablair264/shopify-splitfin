const fs = require('fs');
const path = require('path');

const exportDir = path.join(__dirname, '../firebase-export');
const collections = [
  'brands',
  'conversations', 
  'invoices',
  'items_data',
  'notifications',
  'purchase_orders',
  'sales_orders'
];

function analyzeCollection(collectionName) {
  console.log(`\n📊 Analyzing ${collectionName}...`);
  
  try {
    const filePath = path.join(exportDir, `${collectionName}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`   ⚠️  No data found`);
      return null;
    }
    
    // Get unique fields across all documents
    const allFields = new Map();
    
    data.forEach(doc => {
      Object.keys(doc).forEach(field => {
        if (!allFields.has(field)) {
          allFields.set(field, {
            count: 0,
            types: new Set(),
            samples: []
          });
        }
        
        const fieldInfo = allFields.get(field);
        fieldInfo.count++;
        
        const value = doc[field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        fieldInfo.types.add(type);
        
        // Collect up to 3 unique samples
        if (fieldInfo.samples.length < 3 && value !== null && value !== undefined) {
          fieldInfo.samples.push(value);
        }
      });
    });
    
    // Convert to summary
    const fieldsSummary = {};
    allFields.forEach((info, field) => {
      fieldsSummary[field] = {
        presence: `${Math.round((info.count / data.length) * 100)}%`,
        types: Array.from(info.types),
        sample: info.samples[0]
      };
    });
    
    const summary = {
      documentCount: data.length,
      fields: fieldsSummary,
      sampleDocument: data[0]
    };
    
    console.log(`   ✅ ${data.length} documents analyzed`);
    console.log(`   📋 ${allFields.size} unique fields found`);
    
    return summary;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return null;
  }
}

// Run analysis
console.log('🔍 Starting Firebase Data Analysis...');

const analysis = {};

collections.forEach(collection => {
  const result = analyzeCollection(collection);
  if (result) {
    analysis[collection] = result;
  }
});

// Save analysis
const analysisPath = path.join(exportDir, 'complete-analysis.json');
fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));

console.log(`\n✅ Analysis complete! Saved to: ${analysisPath}`);

// Print summary
console.log('\n📈 Collection Summary:');
console.log('====================');
Object.entries(analysis).forEach(([collection, data]) => {
  console.log(`${collection}: ${data.documentCount} documents, ${Object.keys(data.fields).length} fields`);
});