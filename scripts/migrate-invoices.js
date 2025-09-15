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

async function migrateInvoices() {
  console.log('📄 Migrating invoices...');
  
  const firebaseInvoices = loadFirebaseData('invoices');
  console.log(`   📊 Found ${firebaseInvoices.length} invoices to migrate`);
  
  if (firebaseInvoices.length === 0) {
    console.log('   ⚠️  No invoices data found');
    return;
  }
  
  // Get customers and orders for mapping
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, fb_customer_id, display_name')
    .eq('linked_company', DEFAULT_COMPANY_ID);
    
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, legacy_order_number')
    .eq('company_id', DEFAULT_COMPANY_ID);
  
  if (customerError || orderError) {
    console.error('   ❌ Error fetching data:', customerError || orderError);
    return;
  }
  
  console.log(`   📊 Found ${customers?.length || 0} customers and ${orders?.length || 0} orders in database`);
  
  const customerMap = new Map(customers ? customers.map(c => [c.fb_customer_id, c.id]) : []);
  const customerNameMap = new Map(customers ? customers.map(c => [c.display_name?.toLowerCase(), c.id]) : []);
  const orderMap = new Map(orders ? orders.map(o => [o.legacy_order_number, o.id]) : []);
  
  const invoicesToInsert = [];
  let skippedCount = 0;
  let noCustomerCount = 0;
  
  // Process in batches
  const batchSize = 100;
  
  for (let i = 0; i < firebaseInvoices.length; i += batchSize) {
    const batch = firebaseInvoices.slice(i, i + batchSize);
    
    for (const invoice of batch) {
      // Try to find customer by ID first
      let customerId = customerMap.get(invoice.customer_id);
      
      // If not found by ID, try by name
      if (!customerId && invoice.customer_name) {
        customerId = customerNameMap.get(invoice.customer_name.toLowerCase());
      }
      
      if (!customerId) {
        noCustomerCount++;
        continue;
      }
      
      const orderId = orderMap.get(invoice.salesorder_number);
      
      // Skip invoices without matching orders due to constraint
      if (!orderId) {
        skippedCount++;
        continue;
      }
      
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
    
    console.log(`   🔄 Processed ${i + batch.length} invoices...`);
  }
  
  console.log(`   📊 Ready to insert ${invoicesToInsert.length} invoices (${noCustomerCount} skipped - no customer match)`);
  
  // Insert in batches
  let totalInserted = 0;
  for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
    const batch = invoicesToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('invoices')
      .insert(batch)
      .select();
      
    if (error) {
      console.error(`   ❌ Error inserting batch:`, error);
      continue;
    }
    
    totalInserted += data.length;
    console.log(`   ✅ Inserted batch: ${data.length} invoices (total: ${totalInserted})`);
  }
  
  console.log(`\n   🎉 Migration complete: ${totalInserted} invoices inserted`);
}

if (require.main === module) {
  migrateInvoices();
}