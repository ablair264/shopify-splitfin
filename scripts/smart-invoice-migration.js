const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

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

async function updateCustomersAndMigrateInvoices() {
  console.log('🚀 Smart Invoice Migration\n');
  
  // 1. First update all customers to DM Brands
  console.log('🔄 Step 1: Updating all customers to DM Brands...');
  const { error: updateError } = await supabase
    .from('customers')
    .update({ linked_company: DM_BRANDS_ID })
    .not('linked_company', 'eq', DM_BRANDS_ID);
    
  if (updateError) {
    console.error('   ❌ Error updating customers:', updateError);
  } else {
    console.log('   ✅ Updated all customers to DM Brands');
  }
  
  // 2. Get ALL orders with customer info
  console.log('\n📦 Step 2: Fetching all orders...');
  const allOrders = [];
  let start = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, legacy_order_number, customer_id, order_date, total')
      .eq('company_id', DM_BRANDS_ID)
      .range(start, start + limit - 1);
      
    if (error || !data || data.length === 0) break;
    allOrders.push(...data);
    if (data.length < limit) break;
    start += limit;
  }
  
  console.log(`   ✅ Fetched ${allOrders.length} orders`);
  
  // 3. Get customers
  console.log('\n👥 Step 3: Fetching customers...');
  const { data: customers } = await supabase
    .from('customers')
    .select('id, fb_customer_id, display_name')
    .eq('linked_company', DM_BRANDS_ID);
    
  console.log(`   ✅ Fetched ${customers?.length || 0} customers`);
  
  const customerMap = new Map(customers ? customers.map(c => [c.fb_customer_id, c.id]) : []);
  const customerNameMap = new Map(customers ? customers.map(c => [c.display_name?.toLowerCase(), c.id]) : []);
  
  // 4. Load and process invoices
  console.log('\n📄 Step 4: Processing invoices...');
  const invoiceData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../firebase-export/invoices.json'), 'utf8')
  );
  
  console.log(`   📊 Found ${invoiceData.length} invoices to process`);
  
  // Create a map of orders by customer and date for matching
  const ordersByCustomerDate = new Map();
  for (const order of allOrders) {
    const key = `${order.customer_id}_${order.order_date}`;
    if (!ordersByCustomerDate.has(key)) {
      ordersByCustomerDate.set(key, []);
    }
    ordersByCustomerDate.get(key).push(order);
  }
  
  const invoicesToInsert = [];
  let matchedCount = 0;
  let noCustomerCount = 0;
  let noOrderCount = 0;
  
  for (const invoice of invoiceData) {
    // Find customer
    let customerId = customerMap.get(invoice.customer_id);
    if (!customerId && invoice.customer_name) {
      customerId = customerNameMap.get(invoice.customer_name.toLowerCase());
    }
    
    if (!customerId) {
      noCustomerCount++;
      continue;
    }
    
    // Try to find matching order by customer and date
    const invoiceDate = invoice.date || invoice.invoice_date;
    if (!invoiceDate) {
      noOrderCount++;
      continue;
    }
    
    const dateKey = `${customerId}_${invoiceDate}`;
    const potentialOrders = ordersByCustomerDate.get(dateKey) || [];
    
    let matchedOrder = null;
    
    // Try exact date match first
    if (potentialOrders.length === 1) {
      matchedOrder = potentialOrders[0];
    } else if (potentialOrders.length > 1) {
      // If multiple orders on same date, try to match by amount
      const invoiceTotal = parseFloat(invoice.total) || 0;
      matchedOrder = potentialOrders.find(o => 
        Math.abs(parseFloat(o.total) - invoiceTotal) < 0.01
      ) || potentialOrders[0];
    }
    
    // If no exact date match, try nearby dates (within 7 days)
    if (!matchedOrder) {
      const invoiceDateObj = new Date(invoiceDate);
      for (let dayOffset = 1; dayOffset <= 7 && !matchedOrder; dayOffset++) {
        for (const direction of [-1, 1]) {
          const checkDate = new Date(invoiceDateObj);
          checkDate.setDate(checkDate.getDate() + (dayOffset * direction));
          const checkDateStr = checkDate.toISOString().split('T')[0];
          
          const nearbyOrders = ordersByCustomerDate.get(`${customerId}_${checkDateStr}`) || [];
          if (nearbyOrders.length > 0) {
            const invoiceTotal = parseFloat(invoice.total) || 0;
            matchedOrder = nearbyOrders.find(o => 
              Math.abs(parseFloat(o.total) - invoiceTotal) < 0.01
            ) || nearbyOrders[0];
            if (matchedOrder) break;
          }
        }
      }
    }
    
    if (!matchedOrder) {
      noOrderCount++;
      continue;
    }
    
    matchedCount++;
    
    invoicesToInsert.push({
      order_type: 'sales_order',
      order_id: matchedOrder.id,
      company_id: DM_BRANDS_ID,
      invoice_date: invoiceDate,
      invoice_status: mapInvoiceStatus(invoice.status),
      total: parseFloat(invoice.total) || 0,
      balance: parseFloat(invoice.balance) || 0,
      payment_terms: parseInt(invoice.payment_terms) || parseInt(invoice.due_days) || 30,
      date_due: invoice.due_date,
      customer_id: customerId,
      created_at: convertFirebaseTimestamp(invoice.created_time) || new Date().toISOString(),
      updated_at: convertFirebaseTimestamp(invoice.last_modified_time) || new Date().toISOString()
    });
  }
  
  console.log(`\n   📊 Matching Results:`);
  console.log(`      - Matched with orders: ${matchedCount}`);
  console.log(`      - No customer found: ${noCustomerCount}`);
  console.log(`      - No matching order: ${noOrderCount}`);
  console.log(`      - Ready to insert: ${invoicesToInsert.length}`);
  
  // 5. Insert invoices
  console.log('\n💾 Step 5: Inserting invoices...');
  const batchSize = 100;
  let totalInserted = 0;
  
  for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
    const batch = invoicesToInsert.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('invoices')
      .insert(batch)
      .select();
      
    if (error) {
      console.error(`   ❌ Error inserting batch:`, error.message);
      continue;
    }
    
    totalInserted += data.length;
    console.log(`   ✅ Inserted batch: ${data.length} invoices (total: ${totalInserted})`);
  }
  
  // 6. Final summary
  console.log('\n📊 Final Migration Summary:');
  console.log(`   ✅ Invoices inserted: ${totalInserted}`);
  console.log(`   ⚠️  Invoices skipped: ${invoiceData.length - totalInserted}`);
  
  const { count: finalInvoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', DM_BRANDS_ID);
    
  console.log(`   📄 Total invoices in database: ${finalInvoiceCount}`);
}

if (require.main === module) {
  updateCustomersAndMigrateInvoices();
}