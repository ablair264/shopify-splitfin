const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function checkOrdersData() {
  console.log('🔍 Checking orders data...\n');
  
  try {
    // Get recent orders to check data quality
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        legacy_order_number,
        total,
        sub_total,
        order_status,
        order_date,
        created_at,
        customers!customer_id (display_name, trading_name)
      `)
      .eq('company_id', DM_BRANDS_ID)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching orders:', error);
      return;
    }

    console.log(`📊 Found ${orders.length} recent orders:\n`);

    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.legacy_order_number || order.id.slice(0, 8)}`);
      console.log(`   Customer: ${order.customers?.display_name || order.customers?.trading_name || 'Unknown'}`);
      console.log(`   Total: £${order.total || 0}`);
      console.log(`   Sub Total: £${order.sub_total || 0}`);
      console.log(`   Status: ${order.order_status || 'no status'}`);
      console.log(`   Date: ${order.order_date || order.created_at}`);
      console.log('');
    });

    // Check for orders with missing data
    const { data: missingTotals, error: totalError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .or('total.is.null,total.eq.0');

    if (!totalError) {
      console.log(`⚠️  Orders with missing/zero totals: ${missingTotals.count || 0}`);
    }

    const { data: missingStatus, error: statusError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .or('order_status.is.null,order_status.eq.delivered');

    if (!statusError) {
      console.log(`⚠️  Orders with missing/delivered status: ${missingStatus.count || 0}`);
    }

    // Check line items
    const { data: lineItems, error: lineError } = await supabase
      .from('order_line_items')
      .select('*')
      .in('order_id', orders.map(o => o.id))
      .limit(5);

    if (!lineError) {
      console.log(`\n📦 Sample line items: ${lineItems.length}`);
      lineItems.forEach(item => {
        console.log(`   - ${item.item_name}: Qty ${item.quantity} × £${item.unit_price} = £${item.total_price}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrdersData();