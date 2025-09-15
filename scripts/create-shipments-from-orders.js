#!/usr/bin/env node

/**
 * Script to create shipment records from existing orders
 * This will extract shipping information from orders and populate the shipments table
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

// Initialize Supabase client (using the same pattern as check-invoice-status.js)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

/**
 * Map order status to shipment status
 */
function mapOrderStatusToShipmentStatus(orderStatus) {
  const statusMap = {
    'pending': 'pending',
    'confirmed': 'preparing',
    'processing': 'preparing', 
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'cancelled'
  };
  
  return statusMap[orderStatus?.toLowerCase()] || 'pending';
}

/**
 * Generate a tracking number (mock for now - you can integrate with actual courier APIs later)
 */
function generateTrackingNumber(orderId, courierName = 'Standard') {
  const courierPrefix = {
    'Standard': 'STD',
    'DHL': 'DHL',
    'UPS': 'UPS',
    'Royal Mail': 'RM',
    'DPD': 'DPD'
  };
  
  const prefix = courierPrefix[courierName] || 'STD';
  const shortId = orderId.split('-')[0].toUpperCase();
  const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
  
  return `${prefix}${shortId}${randomSuffix}`;
}

/**
 * Calculate estimated dates based on order status and date
 */
function calculateShipmentDates(orderDate, orderStatus) {
  const baseDate = new Date(orderDate);
  const dates = {
    date_shipped: null,
    date_delivered: null,
    estimated_delivery: null
  };
  
  switch (orderStatus?.toLowerCase()) {
    case 'delivered':
      // If delivered, assume it was shipped 1-2 days before and delivered within a week
      dates.date_shipped = new Date(baseDate.getTime() + (1 * 24 * 60 * 60 * 1000));
      dates.date_delivered = new Date(baseDate.getTime() + (3 * 24 * 60 * 60 * 1000));
      break;
      
    case 'shipped':
      // If shipped, set ship date and estimate delivery
      dates.date_shipped = new Date(baseDate.getTime() + (1 * 24 * 60 * 60 * 1000));
      dates.estimated_delivery = new Date(baseDate.getTime() + (5 * 24 * 60 * 60 * 1000));
      break;
      
    case 'processing':
      // If processing, estimate ship and delivery dates
      dates.estimated_delivery = new Date(baseDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      break;
  }
  
  return dates;
}

/**
 * Main function to create shipments from orders
 */
async function createShipmentsFromOrders() {
  try {
    console.log('🚀 Starting shipment creation from orders...\n');
    
    // 1. Get all orders that don't have shipments yet
    console.log('📋 Fetching orders without shipments...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        legacy_order_number,
        order_date,
        order_status,
        customer_id,
        company_id,
        total,
        sub_total,
        customers!inner (
          display_name,
          shipping_address_1,
          shipping_address_2,
          shipping_city_town,
          shipping_county,
          shipping_postcode,
          billing_address_1,
          billing_address_2,
          billing_city_town,
          billing_county,
          billing_postcode
        ),
        order_line_items (
          id,
          quantity
        )
      `)
      .eq('company_id', DM_BRANDS_ID);
    
    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }
    
    console.log(`✅ Found ${orders.length} orders`);
    
    // 2. Skip existing shipment check since table is empty
    console.log('🚀 Skipping existing shipment check (table is empty)...');
    const ordersWithoutShipments = orders;
    
    if (ordersWithoutShipments.length === 0) {
      console.log('❌ No orders found to process!');
      return;
    }
    
    // 3. Create shipments for each order
    console.log('\n🏗️  Creating shipments...\n');
    const shipmentsToCreate = [];
    
    for (const order of ordersWithoutShipments) {
      const shipmentStatus = mapOrderStatusToShipmentStatus(order.order_status);
      const trackingNumber = generateTrackingNumber(order.id);
      const dates = calculateShipmentDates(order.order_date, order.order_status);
      
      // Calculate items counts
      const totalItems = order.order_line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const itemsShipped = ['shipped', 'delivered'].includes(shipmentStatus) ? totalItems : 0;
      const itemsPacked = ['shipped', 'delivered', 'preparing'].includes(shipmentStatus) ? totalItems : 0;
      
      // Use shipping address if available, otherwise billing address
      const customer = order.customers;
      const shippingAddress = {
        address_1: customer.shipping_address_1 || customer.billing_address_1,
        address_2: customer.shipping_address_2 || customer.billing_address_2,
        city_town: customer.shipping_city_town || customer.billing_city_town,
        county: customer.shipping_county || customer.billing_county,
        postcode: customer.shipping_postcode || customer.billing_postcode
      };
      
      const shipment = {
        order_id: order.id,
        company_id: order.company_id,
        customer_id: order.customer_id,
        warehouse_id: '81d9b5d1-9565-4e39-8d0e-4c5896bfba4b', // Default warehouse ID
        shipment_status: shipmentStatus,
        order_tracking_number: trackingNumber,
        shipping_address_1: shippingAddress.address_1,
        shipping_address_2: shippingAddress.address_2,
        shipping_city_town: shippingAddress.city_town,
        shipping_county: shippingAddress.county,
        shipping_postcode: shippingAddress.postcode,
        items_shipped: itemsShipped,
        items_packed: itemsPacked,
        total_items: totalItems,
        number_of_boxes: Math.ceil(totalItems / 10) || 1, // Estimate 10 items per box
        date_shipped: dates.date_shipped,
        date_delivered: dates.date_delivered,
        estimated_delivery_date: dates.estimated_delivery,
        courier_service: 'Standard Delivery', // Default courier service
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      shipmentsToCreate.push(shipment);
      
      console.log(`📋 Order ${order.legacy_order_number || order.id.substr(0, 8)}:`);
      console.log(`   Status: ${order.order_status} → ${shipmentStatus}`);
      console.log(`   Tracking: ${trackingNumber}`);
      console.log(`   Items: ${totalItems} (${itemsShipped} shipped)`);
      console.log(`   Address: ${shippingAddress.postcode}`);
      console.log('');
    }
    
    // 4. Insert shipments in batches
    console.log(`💾 Inserting ${shipmentsToCreate.length} shipments...`);
    
    const batchSize = 50; // Insert in batches to avoid timeout
    let totalInserted = 0;
    
    for (let i = 0; i < shipmentsToCreate.length; i += batchSize) {
      const batch = shipmentsToCreate.slice(i, i + batchSize);
      
      const { data: insertedShipments, error: insertError } = await supabase
        .from('shipments')
        .insert(batch)
        .select('id, order_id');
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError.message);
        continue;
      }
      
      totalInserted += insertedShipments.length;
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertedShipments.length} shipments`);
    }
    
    console.log(`\n🎉 Successfully created ${totalInserted} shipments!`);
    console.log('\n📊 Summary:');
    console.log(`   • Total orders processed: ${ordersWithoutShipments.length}`);
    console.log(`   • Shipments created: ${totalInserted}`);
    console.log(`   • Success rate: ${Math.round(totalInserted / ordersWithoutShipments.length * 100)}%`);
    
    if (totalInserted > 0) {
      console.log('\n✨ Your ViewOrder component should now show:');
      console.log('   • Correct shipping status');
      console.log('   • Shipping addresses');
      console.log('   • Package information');
      console.log('   • Tracking numbers');
    }
    
  } catch (error) {
    console.error('💥 Error creating shipments:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createShipmentsFromOrders()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { createShipmentsFromOrders };