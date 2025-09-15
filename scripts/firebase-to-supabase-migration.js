const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env.migration file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const exportDir = path.join(__dirname, '../firebase-export');

// Default company ID - you'll need to set this to your actual company ID
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID || 'YOUR_COMPANY_ID';

// Helper function to load Firebase data
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

// Helper function to convert Firebase timestamp
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

// Helper function to extract brand from Firebase data
function extractBrandFromPath(brandPath) {
  if (!brandPath) return null;
  
  // Handle different brand path formats from Firebase
  if (typeof brandPath === 'string') {
    return brandPath.toLowerCase();
  }
  
  if (brandPath.path && Array.isArray(brandPath.path)) {
    return brandPath.path[brandPath.path.length - 1];
  }
  
  return null;
}

// 1. Migrate Brands
async function migrateBrands() {
  console.log('🏷️  Migrating brands...');
  
  const firebaseBrands = loadFirebaseData('brands');
  if (firebaseBrands.length === 0) {
    console.log('   ⚠️  No brands data found');
    return;
  }
  
  const brandsToInsert = firebaseBrands.map(brand => ({
    brand_name: brand.brand_name || brand.name || 'Unknown Brand',
    brand_normalized: brand.brand_normalized || brand.name?.toLowerCase() || 'unknown',
    logo_url: null, // Firebase storage references need separate handling
    company_id: DEFAULT_COMPANY_ID,
    is_active: true,
    created_at: convertFirebaseTimestamp(brand.last_updated) || new Date().toISOString(),
    updated_at: convertFirebaseTimestamp(brand.last_updated) || new Date().toISOString()
  }));
  
  const { data, error } = await supabase
    .from('brands')
    .insert(brandsToInsert)
    .select();
    
  if (error) {
    console.error('   ❌ Error inserting brands:', error);
    return;
  }
  
  console.log(`   ✅ Migrated ${data.length} brands`);
  return data;
}

// 2. Migrate Items (Products)
async function migrateItems() {
  console.log('📦 Migrating items...');
  
  const firebaseItems = loadFirebaseData('items_data');
  if (firebaseItems.length === 0) {
    console.log('   ⚠️  No items data found');
    return;
  }
  
  // Get brands to map brand names to IDs
  const { data: brands } = await supabase.from('brands').select('id, brand_normalized');
  const brandMap = new Map(brands.map(b => [b.brand_normalized, b.id]));
  
  const itemsToInsert = [];
  
  console.log(`   🔄 Processing all ${firebaseItems.length} items...`);
  
  for (const item of firebaseItems) { // Process ALL items
    const brandId = brandMap.get(extractBrandFromPath(item.brand) || 'unknown');
    
    itemsToInsert.push({
      legacy_item_id: item.id,
      name: item.name || item.item_name || 'Unknown Item',
      description: item.description,
      category: item.category,
      sku: item.sku || item.item_sku || `ITEM-${item.id}`,
      ean: item.ean || item.barcode,
      brand_id: brandId,
      purchase_price: parseFloat(item.purchase_price) || null,
      cost_price: parseFloat(item.cost_price) || null,
      retail_price: parseFloat(item.rate) || parseFloat(item.sales_rate) || null,
      gross_stock_level: parseInt(item.stock_on_hand) || 0,
      committed_stock: parseInt(item.committed_stock) || 0,
      reorder_level: parseInt(item.reorder_level) || 0,
      status: item.status === 'inactive' ? 'inactive' : 'active',
      created_date: convertFirebaseTimestamp(item.created_time) || new Date().toISOString()
    });
  }
  
  const { data, error } = await supabase
    .from('items')
    .insert(itemsToInsert)
    .select();
    
  if (error) {
    console.error('   ❌ Error inserting items:', error);
    return;
  }
  
  console.log(`   ✅ Migrated ${data.length} items`);
  return data;
}


// 3. Migrate Sales Orders and Line Items
async function migrateSalesOrders() {
  console.log('🛒 Migrating sales orders...');
  
  // Try to load the complete dataset first, fallback to regular file
  let firebaseOrders = [];
  try {
    const completeFile = path.join(exportDir, 'sales_orders_complete.json');
    if (fs.existsSync(completeFile)) {
      firebaseOrders = JSON.parse(fs.readFileSync(completeFile, 'utf8'));
      console.log(`   📊 Loaded complete dataset: ${firebaseOrders.length} orders`);
    } else {
      firebaseOrders = loadFirebaseData('sales_orders');
    }
  } catch (error) {
    console.log('   ⚠️  Error loading complete dataset, using regular file');
    firebaseOrders = loadFirebaseData('sales_orders');
  }
  
  if (firebaseOrders.length === 0) {
    console.log('   ⚠️  No sales orders data found');
    return;
  }
  
  // Get customers and items for mapping
  const { data: customers } = await supabase.from('customers').select('id, fb_customer_id');
  const { data: items } = await supabase.from('items').select('id, legacy_item_id');
  
  const customerMap = new Map(customers.map(c => [c.fb_customer_id, c.id]));
  const itemMap = new Map(items.map(i => [i.legacy_item_id, i.id]));
  
  console.log(`   🔄 Processing all ${firebaseOrders.length} orders...`);
  
  let processedOrders = 0;
  let totalOrdersInserted = [];
  let totalLineItemsInserted = [];
  const batchSize = 50; // Process in smaller batches to avoid overwhelming Supabase
  
  for (let i = 0; i < firebaseOrders.length; i += batchSize) {
    const batch = firebaseOrders.slice(i, i + batchSize);
    console.log(`   📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(firebaseOrders.length/batchSize)} (${batch.length} orders)`);
    
    const batchOrdersToInsert = [];
    const batchLineItemsToInsert = [];
    
    for (const order of batch) {
      const customerId = customerMap.get(order.customer_id);
      if (!customerId) {
        continue; // Skip orders without customers
      }
      
      const orderData = {
        legacy_order_number: order.salesorder_number || order.id,
        company_id: DEFAULT_COMPANY_ID,
        order_date: order.date || order.created_time?.split('T')[0] || new Date().toISOString().split('T')[0],
        order_status: mapOrderStatus(order.status || order.order_status),
        sub_total: parseFloat(order.sub_total) || parseFloat(order.total) || 0,
        total: parseFloat(order.total) || 0,
        customer_id: customerId,
        created_at: convertFirebaseTimestamp(order.created_time) || new Date().toISOString(),
        updated_at: convertFirebaseTimestamp(order.last_modified_time) || new Date().toISOString()
      };
      
      batchOrdersToInsert.push(orderData);
      
      // Process line items for this order
      if (order.order_line_items && Array.isArray(order.order_line_items)) {
        for (const lineItem of order.order_line_items) {
          const itemId = itemMap.get(lineItem.item_id);
          if (!itemId) {
            continue; // Skip line items without matching items
          }
          
          batchLineItemsToInsert.push({
            order_legacy_number: order.salesorder_number || order.id,
            item_id: itemId,
            item_name: lineItem.name || lineItem.item_name || 'Unknown Item',
            quantity: parseInt(lineItem.quantity) || 1,
            unit_price: parseFloat(lineItem.rate) || parseFloat(lineItem.unit_price) || 0,
            total_price: parseFloat(lineItem.item_total) || 0,
            quantity_invoiced: parseInt(lineItem.quantity_invoiced) || 0,
            quantity_shipped: parseInt(lineItem.quantity_shipped) || 0
          });
        }
      }
    }
    
    // Insert this batch of orders
    if (batchOrdersToInsert.length > 0) {
      const { data: batchInsertedOrders, error: batchOrderError } = await supabase
        .from('orders')
        .insert(batchOrdersToInsert)
        .select();
        
      if (batchOrderError) {
        console.error(`   ❌ Error inserting batch of orders:`, batchOrderError);
        continue; // Skip this batch and continue with next
      }
      
      totalOrdersInserted.push(...batchInsertedOrders);
      console.log(`   ✅ Batch inserted: ${batchInsertedOrders.length} orders`);
      
      // Update line items with actual order IDs for this batch
      const batchOrderIdMap = new Map(batchInsertedOrders.map(o => [o.legacy_order_number, o.id]));
      
      const batchUpdatedLineItems = batchLineItemsToInsert.map(item => ({
        ...item,
        order_id: batchOrderIdMap.get(item.order_legacy_number)
      })).filter(item => item.order_id);
      
      // Clean up temp field
      batchUpdatedLineItems.forEach(item => delete item.order_legacy_number);
      
      // Insert line items for this batch
      if (batchUpdatedLineItems.length > 0) {
        const { data: batchInsertedLineItems, error: batchLineItemError } = await supabase
          .from('order_line_items')
          .insert(batchUpdatedLineItems)
          .select();
          
        if (batchLineItemError) {
          console.error(`   ❌ Error inserting batch of line items:`, batchLineItemError);
        } else {
          totalLineItemsInserted.push(...batchInsertedLineItems);
          console.log(`   ✅ Batch inserted: ${batchInsertedLineItems.length} line items`);
        }
      }
    }
    
    processedOrders += batch.length;
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`   🎉 Migration complete: ${totalOrdersInserted.length} orders, ${totalLineItemsInserted.length} line items`);
  return { orders: totalOrdersInserted, lineItems: totalLineItemsInserted };
}

// 4. Migrate Invoices
async function migrateInvoices() {
  console.log('📄 Migrating invoices...');
  
  const firebaseInvoices = loadFirebaseData('invoices');
  if (firebaseInvoices.length === 0) {
    console.log('   ⚠️  No invoices data found');
    return;
  }
  
  // Get orders and customers for mapping
  const { data: orders } = await supabase.from('orders').select('id, legacy_order_number');
  const { data: customers } = await supabase.from('customers').select('id, fb_customer_id');
  
  const orderMap = new Map(orders.map(o => [o.legacy_order_number, o.id]));
  const customerMap = new Map(customers.map(c => [c.fb_customer_id, c.id]));
  
  const invoicesToInsert = [];
  
  console.log(`   🔄 Processing all ${firebaseInvoices.length} invoices...`);
  
  for (const invoice of firebaseInvoices) { // Process ALL invoices
    const customerId = customerMap.get(invoice.customer_id);
    const orderId = orderMap.get(invoice.salesorder_number);
    
    if (!customerId) {
      console.log(`   ⚠️  Skipping invoice ${invoice.id} - customer not found`);
      continue;
    }
    
    invoicesToInsert.push({
      order_type: 'sales_order',
      order_id: orderId,
      company_id: DEFAULT_COMPANY_ID,
      invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
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
  
  const { data, error } = await supabase
    .from('invoices')
    .insert(invoicesToInsert)
    .select();
    
  if (error) {
    console.error('   ❌ Error inserting invoices:', error);
    return;
  }
  
  console.log(`   ✅ Migrated ${data.length} invoices`);
  return data;
}

// 5. Migrate Purchase Orders
async function migratePurchaseOrders() {
  console.log('📋 Migrating purchase orders...');
  
  const firebasePOs = loadFirebaseData('purchase_orders');
  if (firebasePOs.length === 0) {
    console.log('   ⚠️  No purchase orders data found');
    return;
  }
  
  // Get brands for mapping
  const { data: brands } = await supabase.from('brands').select('id, brand_normalized');
  const brandMap = new Map(brands.map(b => [b.brand_normalized, b.id]));
  
  const posToInsert = [];
  
  console.log(`   🔄 Processing all ${firebasePOs.length} purchase orders...`);
  
  for (const po of firebasePOs) { // Process ALL purchase orders
    const brandId = brandMap.get(extractBrandFromPath(po.brand) || 'unknown');
    
    if (!brandId) {
      console.log(`   ⚠️  Skipping PO ${po.id} - brand not found`);
      continue;
    }
    
    posToInsert.push({
      legacy_purchase_order_id: po.id,
      company_id: DEFAULT_COMPANY_ID,
      brand_id: brandId,
      order_status: mapPurchaseOrderStatus(po.status),
      order_sub_total: parseFloat(po.sub_total) || 0,
      order_total: parseFloat(po.total) || 0,
      created_at: convertFirebaseTimestamp(po.created_time) || new Date().toISOString(),
      updated_at: convertFirebaseTimestamp(po.last_modified_time) || new Date().toISOString()
    });
  }
  
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert(posToInsert)
    .select();
    
  if (error) {
    console.error('   ❌ Error inserting purchase orders:', error);
    return;
  }
  
  console.log(`   ✅ Migrated ${data.length} purchase orders`);
  return data;
}

// 6. Migrate Notifications
async function migrateNotifications() {
  console.log('🔔 Migrating notifications...');
  
  const firebaseNotifications = loadFirebaseData('notifications');
  if (firebaseNotifications.length === 0) {
    console.log('   ⚠️  No notifications data found');
    return;
  }
  
  // Get users for mapping
  const { data: users } = await supabase.from('users').select('id, email');
  const userMap = new Map(users.map(u => [u.email, u.id]));
  
  const notificationsToInsert = [];
  
  for (const notification of firebaseNotifications) {
    const userId = userMap.get(notification.user_email) || users[0]?.id; // Fallback to first user
    
    if (!userId) {
      console.log(`   ⚠️  Skipping notification - no valid user found`);
      continue;
    }
    
    notificationsToInsert.push({
      company_id: DEFAULT_COMPANY_ID,
      user_id: userId,
      notification_type: notification.type || 'system',
      title: notification.title || 'Notification',
      message: notification.message || notification.body || 'No message',
      read: notification.read || false,
      priority: notification.priority || 'medium',
      created_at: convertFirebaseTimestamp(notification.created_at) || new Date().toISOString()
    });
  }
  
  const { data, error } = await supabase
    .from('notifications')
    .insert(notificationsToInsert)
    .select();
    
  if (error) {
    console.error('   ❌ Error inserting notifications:', error);
    return;
  }
  
  console.log(`   ✅ Migrated ${data.length} notifications`);
  return data;
}

// Helper functions for status mapping
function mapOrderStatus(firebaseStatus) {
  const statusMap = {
    'pending': 'pending',
    'confirmed': 'confirmed',
    'open': 'processing',
    'fulfilled': 'delivered',
    'closed': 'delivered',
    'cancelled': 'cancelled'
  };
  
  return statusMap[firebaseStatus?.toLowerCase()] || 'pending';
}

function mapInvoiceStatus(firebaseStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent',
    'paid': 'paid',
    'overdue': 'overdue',
    'viewed': 'received'
  };
  
  return statusMap[firebaseStatus?.toLowerCase()] || 'draft';
}

function mapPurchaseOrderStatus(firebaseStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent',
    'confirmed': 'confirmed',
    'received': 'received',
    'in_transit': 'in_transit'
  };
  
  return statusMap[firebaseStatus?.toLowerCase()] || 'draft';
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting Firebase to Supabase migration...\n');
  
  try {
    // Run migrations in order (respecting foreign key dependencies)
    await migrateBrands();
    await migrateItems();
    await migrateSalesOrders();
    await migrateInvoices();
    await migratePurchaseOrders();
    await migrateNotifications();
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  migrateBrands,
  migrateItems,
  migrateSalesOrders,
  migrateInvoices,
  migratePurchaseOrders,
  migrateNotifications
};