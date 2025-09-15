const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function checkData() {
  console.log('=== CHECKING MIGRATION DATA ===\n');
  
  // 1. Check customers
  const { data: customerSample } = await supabase
    .from('customers')
    .select('linked_company')
    .limit(5);
    
  console.log('Sample customer companies:');
  customerSample?.forEach(c => console.log('  -', c.linked_company));
  
  // 2. Count customers by company
  const { count: dmCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('linked_company', DM_BRANDS_ID);
    
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nCustomers: ${dmCustomers} for DM Brands / ${totalCustomers} total`);
  
  // 3. Check orders - get ALL with pagination
  console.log('\nFetching ALL orders for DM Brands...');
  const allOrders = [];
  let start = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, legacy_order_number')
      .eq('company_id', DM_BRANDS_ID)
      .range(start, start + limit - 1);
      
    if (error) {
      console.error('Error fetching orders:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allOrders.push(...data);
    console.log(`  Fetched ${allOrders.length} orders so far...`);
    
    if (data.length < limit) break;
    start += limit;
  }
  
  console.log(`Total orders retrieved: ${allOrders.length}`);
  
  // 4. Check sample invoice data
  const fs = require('fs');
  const path = require('path');
  const invoiceData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../firebase-export/invoices.json'), 'utf8')
  );
  
  console.log('\nSample invoice data:');
  console.log('Total invoices:', invoiceData.length);
  console.log('First 5 invoice salesorder_numbers:');
  invoiceData.slice(0, 5).forEach(inv => {
    console.log(`  - ${inv.salesorder_number} (customer: ${inv.customer_id})`);
  });
  
  // 5. Check if order numbers match
  const orderNumberSet = new Set(allOrders.map(o => o.legacy_order_number));
  let matchCount = 0;
  
  for (const invoice of invoiceData.slice(0, 100)) {
    if (orderNumberSet.has(invoice.salesorder_number)) {
      matchCount++;
    }
  }
  
  console.log(`\nOrder match rate (first 100 invoices): ${matchCount}/100`);
}

checkData();