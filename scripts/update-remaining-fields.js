const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// Helper to load Firebase data
function loadFirebaseData(collectionName) {
  try {
    const filePath = path.join(__dirname, '../firebase-export', `${collectionName}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading ${collectionName}:`, error.message);
    return [];
  }
}

// 1. Update brand_id in purchase_orders using vendor names
async function updatePurchaseOrderBrands() {
  console.log('🔧 Updating purchase order brand assignments...\n');
  
  // Vendor name to brand mapping
  const vendorBrandMapping = {
    'kf design gmbh': 'remember',
    'elvang denmark': 'elvang', 
    'rader gmbh': 'rader',
    'my flame lifestyle': 'my flame lifestyle',
    'relaxound gmbh': 'relaxound'
  };
  
  console.log('📋 Vendor-Brand Mappings:');
  Object.entries(vendorBrandMapping).forEach(([vendor, brand]) => {
    console.log(`   ${vendor} → ${brand}`);
  });
  
  // Get brands from Supabase
  const { data: brands } = await supabase
    .from('brands')
    .select('id, brand_name, brand_normalized')
    .eq('company_id', DM_BRANDS_ID);
    
  const brandByNormalized = new Map(brands?.map(b => [b.brand_normalized.toLowerCase(), b.id]) || []);
  
  // Load Firebase purchase order data
  const firebasePOs = loadFirebaseData('purchase_orders');
  console.log(`\\n📦 Found ${firebasePOs.length} purchase orders in Firebase`);
  
  // Get all purchase orders from Supabase
  const { data: supabasePOs } = await supabase
    .from('purchase_orders')
    .select('id, legacy_purchase_order_id')
    .eq('company_id', DM_BRANDS_ID);
    
  console.log(`📋 Found ${supabasePOs?.length || 0} purchase orders in Supabase`);
  
  const poMap = new Map(supabasePOs?.map(po => [po.legacy_purchase_order_id, po.id]) || []);
  
  let updatedCount = 0;
  let matchedVendors = 0;
  const batchSize = 50;
  
  for (let i = 0; i < firebasePOs.length; i += batchSize) {
    const batch = firebasePOs.slice(i, i + batchSize);
    const updates = [];
    
    for (const fbPO of batch) {
      const supabasePOId = poMap.get(fbPO.purchaseorder_number || fbPO.id);
      if (!supabasePOId) continue;
      
      // Get vendor name from Firebase
      const vendorName = (fbPO.vendor_name || '').toLowerCase().trim();
      
      // Find matching brand
      const mappedBrand = vendorBrandMapping[vendorName];
      let brandId = null;
      
      if (mappedBrand) {
        brandId = brandByNormalized.get(mappedBrand);
        if (brandId) matchedVendors++;
      }
      
      if (brandId) {
        updates.push({
          poId: supabasePOId,
          brandId: brandId
        });
      }
    }
    
    // Execute updates in parallel
    const updatePromises = updates.map(update =>
      supabase
        .from('purchase_orders')
        .update({ brand_id: update.brandId })
        .eq('id', update.poId)
    );
    
    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    updatedCount += successCount;
    
    console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: updated ${successCount} POs, matched vendors so far: ${matchedVendors}`);
  }
  
  console.log(`\\n📊 Purchase Order Brand Update Results:`);
  console.log(`   ✅ Updated: ${updatedCount} purchase orders`);
  console.log(`   🏷️  Vendor matches: ${matchedVendors}`);
}

// 2. Update sales_id in invoices and orders using salesperson mapping
async function updateSalesPersonIds() {
  console.log('\\n👤 Updating sales person assignments...');
  
  // Get users with zoho_sp_id
  const { data: users } = await supabase
    .from('users')
    .select('id, zoho_sp_id, email, first_name, last_name')
    .not('zoho_sp_id', 'is', null);
    
  console.log(`\\n📋 Found ${users?.length || 0} users with Zoho SP IDs:`);
  users?.forEach(u => console.log(`   ${u.first_name} ${u.last_name} (${u.email}) → ${u.zoho_sp_id}`));
  
  const salesPersonMap = new Map(users?.map(u => [u.zoho_sp_id, u.id]) || []);
  
  // Update Orders
  console.log('\\n🛒 Updating sales_id in orders...');
  
  // Load sales orders with complete dataset
  let firebaseOrders = [];
  try {
    const completeFile = path.join(__dirname, '../firebase-export/sales_orders_complete.json');
    if (fs.existsSync(completeFile)) {
      firebaseOrders = JSON.parse(fs.readFileSync(completeFile, 'utf8'));
    } else {
      firebaseOrders = loadFirebaseData('sales_orders');
    }
  } catch (error) {
    firebaseOrders = loadFirebaseData('sales_orders');
  }
  
  console.log(`   📊 Processing ${firebaseOrders.length} sales orders...`);
  
  // Get Supabase orders
  let allSupabaseOrders = [];
  let start = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, legacy_order_number')
      .eq('company_id', DM_BRANDS_ID)
      .range(start, start + limit - 1);
      
    if (error || !data || data.length === 0) break;
    allSupabaseOrders.push(...data);
    if (data.length < limit) break;
    start += limit;
  }
  
  const orderMap = new Map(allSupabaseOrders.map(o => [o.legacy_order_number, o.id]));
  
  let orderUpdates = 0;
  let orderMatches = 0;
  const orderBatchSize = 100;
  
  for (let i = 0; i < firebaseOrders.length; i += orderBatchSize) {
    const batch = firebaseOrders.slice(i, i + orderBatchSize);
    const updates = [];
    
    for (const fbOrder of batch) {
      const supabaseOrderId = orderMap.get(fbOrder.salesorder_number || fbOrder.id);
      if (!supabaseOrderId) continue;
      
      const salespersonId = fbOrder.salesperson_id;
      if (!salespersonId) continue;
      
      const userId = salesPersonMap.get(salespersonId);
      if (userId) {
        orderMatches++;
        updates.push({
          orderId: supabaseOrderId,
          salesId: userId
        });
      }
    }
    
    // Execute order updates
    const updatePromises = updates.map(update =>
      supabase
        .from('orders')
        .update({ sales_id: update.salesId })
        .eq('id', update.orderId)
    );
    
    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    orderUpdates += successCount;
    
    if (i % (orderBatchSize * 5) === 0) {
      console.log(`     📦 Orders batch ${Math.floor(i/orderBatchSize) + 1}: updated ${successCount}, matches so far: ${orderMatches}`);
    }
  }
  
  // Update Invoices
  console.log('\\n📄 Updating sales_id in invoices...');
  
  const firebaseInvoices = loadFirebaseData('invoices');
  console.log(`   📊 Processing ${firebaseInvoices.length} invoices...`);
  
  // Get Supabase invoices
  let allSupabaseInvoices = [];
  start = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, created_at') // Use created_at as proxy since we don't have legacy_invoice_id
      .eq('company_id', DM_BRANDS_ID)
      .range(start, start + limit - 1);
      
    if (error || !data || data.length === 0) break;
    allSupabaseInvoices.push(...data);
    if (data.length < limit) break;
    start += limit;
  }
  
  console.log(`   📋 Found ${allSupabaseInvoices.length} invoices in Supabase`);
  
  let invoiceUpdates = 0;
  let invoiceMatches = 0;
  
  // For invoices, we'll have to match by date/amount since we don't have legacy IDs stored
  // For now, let's update invoices that have salesperson_id in Firebase
  const invoiceUpdatesArray = [];
  
  for (const fbInvoice of firebaseInvoices) {
    const salespersonId = fbInvoice.salesperson_id;
    if (!salespersonId) continue;
    
    const userId = salesPersonMap.get(salespersonId);
    if (!userId) continue;
    
    invoiceMatches++;
    
    // We'll update by date and amount matching (approximate)
    const invoiceDate = fbInvoice.date || fbInvoice.invoice_date;
    const invoiceTotal = parseFloat(fbInvoice.total) || 0;
    
    if (invoiceDate && invoiceTotal > 0) {
      invoiceUpdatesArray.push({
        date: invoiceDate,
        total: invoiceTotal,
        salesId: userId
      });
    }
  }
  
  console.log(`   📊 Found ${invoiceMatches} invoices with salesperson data`);
  console.log(`   ⚠️  Note: Invoice updates limited due to lack of legacy IDs - would need date/amount matching`);
  
  console.log(`\\n📊 Sales Person Update Results:`);
  console.log(`   🛒 Orders updated: ${orderUpdates}`);
  console.log(`   📄 Invoice matches found: ${invoiceMatches} (updates pending manual verification)`);
}

// Main function
async function updateRemainingFields() {
  console.log('🚀 Updating remaining database fields...\\n');
  
  try {
    await updatePurchaseOrderBrands();
    await updateSalesPersonIds();
    
    console.log('\\n✅ Field updates completed successfully!');
    
    // Final verification
    console.log('\\n🔍 Final Verification:');
    
    const { count: posWithBrands } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .not('brand_id', 'is', null);
      
    const { count: ordersWithSales } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .not('sales_id', 'is', null);
    
    console.log(`   📋 Purchase orders with brands: ${posWithBrands || 0}`);
    console.log(`   🛒 Orders with sales persons: ${ordersWithSales || 0}`);
    
  } catch (error) {
    console.error('\\n❌ Update failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  updateRemainingFields();
}