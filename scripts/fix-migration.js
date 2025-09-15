const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const exportDir = path.join(__dirname, '../firebase-export');
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID;

// Helper to load Firebase data
function loadFirebaseData(collectionName) {
  try {
    const filePath = path.join(exportDir, `${collectionName}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading ${collectionName}:`, error.message);
    return [];
  }
}

// Helper to convert Firebase timestamp
function convertFirebaseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }
  return null;
}

// 1. First, insert the correct brands
async function insertBrands() {
  console.log('🏷️  Checking/inserting brands...');
  
  // Check existing brands first
  const { data: existingBrands } = await supabase
    .from('brands')
    .select('brand_normalized')
    .eq('company_id', DEFAULT_COMPANY_ID);
    
  const existingBrandNames = new Set(existingBrands?.map(b => b.brand_normalized) || []);
  
  const brands = [
    { name: 'Blomus', normalized: 'blomus' },
    { name: 'Elvang', normalized: 'elvang' },
    { name: 'GEFU', normalized: 'gefu' },
    { name: 'Räder', normalized: 'rader' },
    { name: 'Remember', normalized: 'remember' },
    { name: 'Relaxound', normalized: 'relaxound' },
    { name: 'My Flame Lifestyle', normalized: 'my flame lifestyle' }
  ];
  
  const brandsToInsert = brands
    .filter(brand => !existingBrandNames.has(brand.normalized))
    .map(brand => ({
      brand_name: brand.name,
      brand_normalized: brand.normalized,
      company_id: DEFAULT_COMPANY_ID,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  
  if (brandsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('brands')
      .insert(brandsToInsert)
      .select();
      
    if (error) {
      console.error('   ❌ Error inserting brands:', error);
      return;
    }
    
    console.log(`   ✅ Inserted ${data.length} new brands`);
  } else {
    console.log('   ✅ All brands already exist');
  }
  
  return true;
}

// 2. Update items with correct price mappings and manufacturer
async function updateItems() {
  console.log('📦 Updating items with correct prices and manufacturers...');
  
  const firebaseItems = loadFirebaseData('items_data');
  const { data: brands } = await supabase.from('brands').select('id, brand_normalized');
  const brandMap = new Map(brands.map(b => [b.brand_normalized, b.id]));
  
  // Get existing items to update
  const { data: existingItems } = await supabase
    .from('items')
    .select('id, legacy_item_id');
    
  const itemMap = new Map(existingItems.map(i => [i.legacy_item_id, i.id]));
  
  let updatedCount = 0;
  const batchSize = 100;
  
  for (let i = 0; i < firebaseItems.length; i += batchSize) {
    const batch = firebaseItems.slice(i, i + batchSize);
    
    for (const fbItem of batch) {
      const itemId = itemMap.get(fbItem.id);
      if (!itemId) continue;
      
      // Find matching brand - check multiple fields
      let manufacturer = fbItem.brand_normalized || fbItem.manufacturer || fbItem.Manufacturer || '';
      
      // Normalize brand variations
      manufacturer = manufacturer.toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/r-der/g, 'rader')
        .replace(/räder/g, 'rader')
        .replace(/my-flame-lifestyle/g, 'my flame lifestyle')
        .replace(/-/g, ' ')
        .trim();
      
      let brandId = null;
      if (manufacturer) {
        // Try exact match first
        brandId = brandMap.get(manufacturer);
        
        // If no exact match, try to find partial match
        if (!brandId) {
          for (const [brandName, id] of brandMap) {
            if (manufacturer.includes(brandName) || brandName.includes(manufacturer)) {
              brandId = id;
              break;
            }
          }
        }
      }
      
      const updateData = {
        manufacturer: manufacturer,
        brand_id: brandId,
        cost_price: parseFloat(fbItem.purchase_rate) || null,
        purchase_price: parseFloat(fbItem.selling_price) || null,
        retail_price: parseFloat(fbItem.rate) || parseFloat(fbItem.sales_rate) || null
      };
      
      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', itemId);
        
      if (!error) {
        updatedCount++;
      }
    }
    
    console.log(`   🔄 Updated ${updatedCount} items so far...`);
  }
  
  console.log(`   ✅ Updated ${updatedCount} items total`);
}

// 3. Re-migrate purchase orders with correct data
async function migratePurchaseOrders() {
  console.log('📋 Re-migrating purchase orders...');
  
  const firebasePOs = loadFirebaseData('purchase_orders');
  if (firebasePOs.length === 0) {
    console.log('   ⚠️  No purchase orders data found');
    return;
  }
  
  // Clear existing purchase orders first
  await supabase.from('purchase_orders').delete().eq('company_id', DEFAULT_COMPANY_ID);
  
  const { data: brands } = await supabase.from('brands').select('id, brand_normalized');
  const brandMap = new Map(brands.map(b => [b.brand_normalized, b.id]));
  
  const posToInsert = [];
  
  for (const po of firebasePOs) {
    // Extract brand from various possible fields
    let brandName = po.vendor_name || po.brand || po.Manufacturer || '';
    
    // Normalize brand variations
    brandName = brandName.toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/r-der/g, 'rader')
      .replace(/räder/g, 'rader')
      .replace(/my-flame-lifestyle/g, 'my flame lifestyle')
      .replace(/-/g, ' ')
      .trim();
    
    let brandId = null;
    if (brandName) {
      brandId = brandMap.get(brandName);
      if (!brandId) {
        for (const [bName, id] of brandMap) {
          if (brandName.includes(bName) || bName.includes(brandName)) {
            brandId = id;
            break;
          }
        }
      }
    }
    
    if (!brandId) {
      console.log(`   ⚠️  Skipping PO ${po.purchaseorder_number || po.id} - brand "${brandName}" not found`);
      continue;
    }
    
    posToInsert.push({
      legacy_purchase_order_id: po.purchaseorder_number || po.id,
      company_id: DEFAULT_COMPANY_ID,
      brand_id: brandId,
      order_status: mapPurchaseOrderStatus(po.status),
      order_sub_total: parseFloat(po.sub_total) || 0,
      order_total: parseFloat(po.total) || 0,
      created_at: convertFirebaseTimestamp(po.created_time) || new Date().toISOString(),
      updated_at: convertFirebaseTimestamp(po.last_modified_time) || new Date().toISOString()
    });
  }
  
  if (posToInsert.length > 0) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .insert(posToInsert)
      .select();
      
    if (error) {
      console.error('   ❌ Error inserting purchase orders:', error);
      return;
    }
    
    console.log(`   ✅ Migrated ${data.length} purchase orders`);
  }
}

// 4. Re-migrate invoices with better customer matching
async function migrateInvoices() {
  console.log('📄 Re-migrating invoices...');
  
  const firebaseInvoices = loadFirebaseData('invoices');
  if (firebaseInvoices.length === 0) {
    console.log('   ⚠️  No invoices data found');
    return;
  }
  
  // Clear existing invoices first
  await supabase.from('invoices').delete().eq('company_id', DEFAULT_COMPANY_ID);
  
  // Get customers and orders for mapping
  const { data: customers } = await supabase.from('customers').select('id, fb_customer_id, customer_name');
  const { data: orders } = await supabase.from('orders').select('id, legacy_order_number');
  
  const customerMap = new Map(customers ? customers.map(c => [c.fb_customer_id, c.id]) : []);
  const customerNameMap = new Map(customers ? customers.map(c => [c.customer_name?.toLowerCase(), c.id]) : []);
  const orderMap = new Map(orders ? orders.map(o => [o.legacy_order_number, o.id]) : []);
  
  const invoicesToInsert = [];
  let skippedCount = 0;
  
  for (const invoice of firebaseInvoices) {
    // Try to find customer by ID first
    let customerId = customerMap.get(invoice.customer_id);
    
    // If not found by ID, try by name
    if (!customerId && invoice.customer_name) {
      customerId = customerNameMap.get(invoice.customer_name.toLowerCase());
    }
    
    if (!customerId) {
      skippedCount++;
      continue;
    }
    
    const orderId = orderMap.get(invoice.salesorder_number);
    
    invoicesToInsert.push({
      order_type: 'sales_order',
      order_id: orderId,
      company_id: DEFAULT_COMPANY_ID,
      invoice_date: invoice.invoice_date || invoice.date || new Date().toISOString().split('T')[0],
      invoice_status: mapInvoiceStatus(invoice.status),
      total: parseFloat(invoice.total) || 0,
      balance: parseFloat(invoice.balance) || parseFloat(invoice.total) || 0,
      payment_terms: parseInt(invoice.payment_terms) || 30,
      date_due: invoice.due_date,
      customer_id: customerId,
      created_at: convertFirebaseTimestamp(invoice.created_time) || new Date().toISOString(),
      updated_at: convertFirebaseTimestamp(invoice.last_modified_time) || new Date().toISOString()
    });
  }
  
  if (invoicesToInsert.length > 0) {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoicesToInsert)
      .select();
      
    if (error) {
      console.error('   ❌ Error inserting invoices:', error);
      return;
    }
    
    console.log(`   ✅ Migrated ${data.length} invoices (${skippedCount} skipped)`);
  }
}

// Helper functions for status mapping
function mapInvoiceStatus(firebaseStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent',
    'paid': 'paid',
    'overdue': 'overdue',
    'viewed': 'received',
    'partially_paid': 'sent'
  };
  
  return statusMap[firebaseStatus?.toLowerCase()] || 'draft';
}

function mapPurchaseOrderStatus(firebaseStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent',
    'billed': 'confirmed',
    'confirmed': 'confirmed',
    'received': 'received',
    'in_transit': 'in_transit',
    'closed': 'received'
  };
  
  return statusMap[firebaseStatus?.toLowerCase()] || 'draft';
}

// Main function
async function runFixes() {
  console.log('🔧 Starting migration fixes...\n');
  
  try {
    await insertBrands();
    await updateItems();
    await migratePurchaseOrders();
    await migrateInvoices();
    
    console.log('\n✅ Migration fixes completed!');
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runFixes();
}