const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function deleteIncorrectOrders() {
  console.log('🗑️ Deleting incorrect orders and related data...\n');
  
  try {
    // First, let's identify which orders need to be deleted
    // These might be orders created today that shouldn't exist
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('📋 Finding orders created today (likely incorrect)...');
    const { data: ordersToDelete, error: findError } = await supabase
      .from('orders')
      .select('id, legacy_order_number, customer_id, created_at')
      .eq('company_id', DM_BRANDS_ID)
      .gte('created_at', today.toISOString());

    if (findError) {
      console.error('❌ Error finding orders:', findError);
      return;
    }

    console.log(`Found ${ordersToDelete.length} orders created today\n`);

    if (ordersToDelete.length === 0) {
      console.log('✅ No orders to delete');
      return;
    }

    const orderIds = ordersToDelete.map(order => order.id);

    // Step 1: Delete related invoices first
    console.log('🧹 Step 1: Deleting related invoices...');
    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .in('order_id', orderIds);

    if (invoicesError) {
      console.error('❌ Error deleting invoices:', invoicesError);
      // Continue anyway - the invoices might not exist
    } else {
      console.log('✅ Related invoices deleted');
    }

    // Step 2: Delete order line items
    console.log('🧹 Step 2: Deleting order line items...');
    const { error: lineItemsError } = await supabase
      .from('order_line_items')
      .delete()
      .in('order_id', orderIds);

    if (lineItemsError) {
      console.error('❌ Error deleting line items:', lineItemsError);
    } else {
      console.log('✅ Order line items deleted');
    }

    // Step 3: Delete shipments
    console.log('🧹 Step 3: Deleting related shipments...');
    const { error: shipmentsError } = await supabase
      .from('shipments')
      .delete()
      .in('order_id', orderIds);

    if (shipmentsError) {
      console.error('❌ Error deleting shipments:', shipmentsError);
    } else {
      console.log('✅ Related shipments deleted');
    }

    // Step 4: Now delete the orders
    console.log('🧹 Step 4: Deleting the orders...');
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .in('id', orderIds);

    if (ordersError) {
      console.error('❌ Error deleting orders:', ordersError);
      return;
    }

    console.log(`✅ Successfully deleted ${ordersToDelete.length} orders and related data`);

    // Show what was deleted
    console.log('\n📊 Summary of deleted orders:');
    ordersToDelete.slice(0, 10).forEach((order, index) => {
      console.log(`${index + 1}. ${order.legacy_order_number || order.id.slice(0, 8)} (Created: ${new Date(order.created_at).toLocaleString()})`);
    });
    if (ordersToDelete.length > 10) {
      console.log(`... and ${ordersToDelete.length - 10} more`);
    }

  } catch (error) {
    console.error('❌ Process failed:', error);
    throw error;
  }
}

// Alternative function to delete specific order IDs
async function deleteSpecificOrders(orderIds) {
  console.log(`🗑️ Deleting ${orderIds.length} specific orders...\n`);
  
  try {
    // Step 1: Delete related data first
    console.log('🧹 Deleting related invoices...');
    await supabase.from('invoices').delete().in('order_id', orderIds);
    
    console.log('🧹 Deleting order line items...');
    await supabase.from('order_line_items').delete().in('order_id', orderIds);
    
    console.log('🧹 Deleting shipments...');
    await supabase.from('shipments').delete().in('order_id', orderIds);
    
    // Step 2: Delete the orders
    console.log('🧹 Deleting orders...');
    const { error } = await supabase.from('orders').delete().in('id', orderIds);
    
    if (error) {
      console.error('❌ Error deleting orders:', error);
      return;
    }
    
    console.log('✅ Successfully deleted specified orders');
    
  } catch (error) {
    console.error('❌ Process failed:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  // Check if specific order IDs were provided as arguments
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.log('Using provided order IDs...');
    deleteSpecificOrders(args);
  } else {
    deleteIncorrectOrders();
  }
}

module.exports = {
  deleteIncorrectOrders,
  deleteSpecificOrders
};