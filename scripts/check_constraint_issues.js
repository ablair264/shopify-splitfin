const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function checkConstraintIssues() {
  console.log('🔍 Checking constraint issues...\n');
  
  try {
    // Check what order types exist in invoices
    console.log('📊 Current invoice order types:');
    const { data: invoiceOrderTypes, error: invoiceError } = await supabase
      .from('invoices')
      .select('order_type')
      .not('order_type', 'is', null);

    if (!invoiceError && invoiceOrderTypes) {
      const uniqueOrderTypes = [...new Set(invoiceOrderTypes.map(i => i.order_type))];
      uniqueOrderTypes.forEach(type => {
        console.log(`- ${type}`);
      });
    }

    // Check orders with null legacy_order_id (these might be the problematic ones)
    console.log('\n📊 Orders without legacy_order_id:');
    const { data: ordersWithoutLegacy, error: ordersError } = await supabase
      .from('orders')
      .select('id, legacy_order_number, customer_id, created_at, order_status')
      .eq('company_id', DM_BRANDS_ID)
      .is('legacy_order_id', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!ordersError && ordersWithoutLegacy) {
      console.log(`Found ${ordersWithoutLegacy.length} orders without legacy_order_id:`);
      ordersWithoutLegacy.forEach((order, index) => {
        console.log(`${index + 1}. ${order.legacy_order_number || order.id.slice(0, 8)} - Status: ${order.order_status} - Created: ${new Date(order.created_at).toLocaleDateString()}`);
      });
    }

    // Check invoices that reference orders without legacy_order_id
    console.log('\n📊 Invoices referencing orders without legacy_order_id:');
    const { data: problematicInvoices, error: problemError } = await supabase
      .from('invoices')
      .select(`
        id, 
        invoice_number, 
        order_type,
        orders!inner(id, legacy_order_id)
      `)
      .is('orders.legacy_order_id', null)
      .limit(10);

    if (!problemError && problematicInvoices) {
      console.log(`Found ${problematicInvoices.length} problematic invoices:`);
      problematicInvoices.forEach((invoice, index) => {
        console.log(`${index + 1}. Invoice ${invoice.invoice_number} - Order Type: ${invoice.order_type}`);
      });
    }

    // Get count of orders created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .gte('created_at', today.toISOString());

    if (!todayError) {
      console.log(`\n📊 Orders created today: ${todayOrders.count || 0}`);
    }

  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  }
}

checkConstraintIssues();