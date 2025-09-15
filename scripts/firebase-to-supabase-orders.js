const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-service-account.json'), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Supabase configuration - use service key for bypassing RLS
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized');

// Company ID from environment
const COMPANY_ID = process.env.DEFAULT_COMPANY_ID;

if (!COMPANY_ID) {
  console.error('Missing DEFAULT_COMPANY_ID in .env.local file');
  process.exit(1);
}

console.log(`✅ Using company ID: ${COMPANY_ID}`);

// Helper functions
function convertFirebaseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }
  return null;
}

function mapOrderStatus(firebaseStatus) {
  const statusMap = {
    'open': 'pending',
    'confirmed': 'confirmed',
    'closed': 'delivered',
    'cancelled': 'cancelled',
    'fulfilled': 'delivered'
  };
  return statusMap[firebaseStatus] || 'pending';
}

function getTaxAmount(order) {
  if (!order.taxes || !Array.isArray(order.taxes)) return 0;
  return order.taxes.reduce((sum, tax) => sum + parseFloat(tax.tax_amount || 0), 0);
}

// Function to find existing customer by fb_customer_id
async function findCustomerByFirebaseId(firebaseCustomerId) {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id')
    .eq('fb_customer_id', firebaseCustomerId)
    .eq('linked_company', COMPANY_ID)
    .limit(1);

  if (error) {
    console.error('Error finding customer:', error);
    return null;
  }

  return customers && customers.length > 0 ? customers[0].id : null;
}

// Function to find item by SKU
async function findItemBySku(sku, brandName) {
  // First try to find by exact SKU
  const { data: items, error } = await supabase
    .from('items')
    .select(`
      id,
      brands!inner(
        brand_name
      )
    `)
    .eq('sku', sku)
    .ilike('brands.brand_name', `%${brandName}%`)
    .limit(1);

  if (error) {
    console.error('Error finding item:', error);
    return null;
  }

  if (items && items.length > 0) {
    return items[0].id;
  }

  // If not found, try without brand filter
  const { data: itemsNoBrand, error: error2 } = await supabase
    .from('items')
    .select('id')
    .eq('sku', sku)
    .limit(1);

  if (!error2 && itemsNoBrand && itemsNoBrand.length > 0) {
    return itemsNoBrand[0].id;
  }

  return null;
}

// Function to fetch all sales orders from Firebase
async function fetchAllSalesOrdersFromFirebase() {
  console.log('🔥 Fetching all sales orders from Firebase...');
  
  try {
    const salesOrdersRef = db.collection('sales_orders');
    const snapshot = await salesOrdersRef.get();
    
    console.log(`Found ${snapshot.size} sales orders in Firebase`);
    
    const orders = [];
    let processed = 0;
    
    for (const doc of snapshot.docs) {
      const orderData = {
        id: doc.id,
        ...doc.data()
      };
      
      // Fetch line items subcollection
      const lineItemsRef = doc.ref.collection('order_line_items');
      const lineItemsSnapshot = await lineItemsRef.get();
      
      const lineItems = [];
      for (const lineItemDoc of lineItemsSnapshot.docs) {
        lineItems.push({
          id: lineItemDoc.id,
          ...lineItemDoc.data()
        });
      }
      
      if (lineItems.length > 0) {
        orderData.line_items = lineItems;
      }
      
      orders.push(orderData);
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${snapshot.size} orders...`);
      }
    }
    
    console.log(`✅ Fetched ${orders.length} orders with line items from Firebase`);
    return orders;
    
  } catch (error) {
    console.error('Error fetching from Firebase:', error);
    throw error;
  }
}

// Function to process and upload orders to Supabase
async function processAndUploadOrders(firebaseOrders) {
  console.log(`📤 Processing and uploading ${firebaseOrders.length} orders to Supabase...`);
  
  let processedOrders = 0;
  let processedLineItems = 0;
  let errors = [];
  
  for (const firebaseOrder of firebaseOrders) {
    try {
      console.log(`Processing order ${firebaseOrder.salesorder_number}...`);
      
      // Check if order already exists
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id')
        .eq('legacy_order_number', firebaseOrder.salesorder_number)
        .single();

      if (existingOrderError && existingOrderError.code !== 'PGRST116') {
        console.error('Error checking existing order:', existingOrderError);
      }

      if (existingOrder) {
        // Check if line items exist for this order
        const { data: existingLineItems } = await supabase
          .from('order_line_items')
          .select('id')
          .eq('order_id', existingOrder.id);
        
        if (existingLineItems && existingLineItems.length > 0) {
          console.log(`Order ${firebaseOrder.salesorder_number} already has ${existingLineItems.length} line items, skipping...`);
          continue;
        } else {
          console.log(`Order ${firebaseOrder.salesorder_number} exists but missing line items, will add them...`);
          // Process line items for existing order
          await processLineItemsForOrder(firebaseOrder, existingOrder.id);
          processedLineItems += firebaseOrder.line_items?.length || 0;
          continue;
        }
      }

      // Find existing customer
      const customerId = await findCustomerByFirebaseId(firebaseOrder.customer_id);
      
      // Prepare order data
      const orderData = {
        legacy_order_number: firebaseOrder.salesorder_number,
        order_date: firebaseOrder.date,
        order_status: mapOrderStatus(firebaseOrder.order_status),
        sub_total: parseFloat(firebaseOrder.total) - getTaxAmount(firebaseOrder),
        total: parseFloat(firebaseOrder.total),
        customer_id: customerId, // might be null
        sales_id: null, // TODO: map salesperson
        created_at: convertFirebaseTimestamp(firebaseOrder.created_time),
        updated_at: convertFirebaseTimestamp(firebaseOrder.last_modified_time) || convertFirebaseTimestamp(firebaseOrder.created_time),
        company_id: COMPANY_ID
      };

      // Insert order
      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select('id')
        .single();

      if (orderError) {
        errors.push(`Failed to create order ${firebaseOrder.salesorder_number}: ${orderError.message}`);
        continue;
      }

      processedOrders++;
      console.log(`Created order: ${firebaseOrder.salesorder_number} (${createdOrder.id})`);

      // Process line items
      await processLineItemsForOrder(firebaseOrder, createdOrder.id);
      processedLineItems += firebaseOrder.line_items?.length || 0;

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error) {
      errors.push(`Error processing order ${firebaseOrder.salesorder_number}: ${error.message}`);
      console.error(`Error processing order ${firebaseOrder.salesorder_number}:`, error);
    }
  }

  // Print summary
  console.log('\\n=== UPLOAD SUMMARY ===');
  console.log(`Total orders from Firebase: ${firebaseOrders.length}`);
  console.log(`Orders processed: ${processedOrders}`);
  console.log(`Line items processed: ${processedLineItems}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\\nERRORS:');
    errors.forEach(error => console.log(`- ${error}`));
  }

  console.log('\\nUpload completed!');
}

// Function to process line items for an order
async function processLineItemsForOrder(firebaseOrder, orderId) {
  if (!firebaseOrder.line_items || !Array.isArray(firebaseOrder.line_items)) {
    console.log(`No line items found for order ${firebaseOrder.salesorder_number}`);
    return;
  }

  const lineItemsData = [];
  
  for (const firebaseLineItem of firebaseOrder.line_items) {
    // Try to find the item by SKU
    const itemId = await findItemBySku(
      firebaseLineItem.sku, 
      firebaseOrder.brand || 'unknown'
    );

    const lineItemData = {
      order_id: orderId,
      item_id: itemId, // might be null if not found
      item_name: firebaseLineItem.name,
      quantity: parseInt(firebaseLineItem.quantity),
      unit_price: parseFloat(firebaseLineItem.rate),
      total_price: parseFloat(firebaseLineItem.item_total),
      quantity_packed: parseInt(firebaseLineItem.quantity_packed || 0),
      quantity_shipped: parseInt(firebaseLineItem.quantity_shipped || 0),
      quantity_delivered: parseInt(firebaseLineItem.quantity_delivered || 0),
      quantity_invoiced: parseInt(firebaseLineItem.quantity_invoiced || 0),
      quantity_cancelled: parseInt(firebaseLineItem.quantity_cancelled || 0),
      quantity_returned: parseInt(firebaseLineItem.quantity_returned || 0)
    };

    lineItemsData.push(lineItemData);
  }

  // Insert line items in batch
  if (lineItemsData.length > 0) {
    const { error: lineItemsError } = await supabase
      .from('order_line_items')
      .insert(lineItemsData);

    if (lineItemsError) {
      console.error(`Failed to create line items for order ${firebaseOrder.salesorder_number}: ${lineItemsError.message}`);
    } else {
      console.log(`Created ${lineItemsData.length} line items for order ${firebaseOrder.salesorder_number}`);
    }
  }
}

// Main function
async function uploadAllOrdersFromFirebase() {
  console.log('🚀 Starting Firebase to Supabase orders migration...');
  
  try {
    // Fetch all orders from Firebase
    const firebaseOrders = await fetchAllSalesOrdersFromFirebase();
    
    // Process and upload to Supabase
    await processAndUploadOrders(firebaseOrders);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the upload
uploadAllOrdersFromFirebase().catch(console.error);