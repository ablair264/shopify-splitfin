const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Import Supabase
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from environment variables - use service key for bypassing RLS
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized');

// Load the JSON file
const jsonPath = path.join(__dirname, '../firebase-export/sales_orders.json');
const salesOrdersData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`Loaded ${salesOrdersData.length} orders from JSON file`);

// Function to map Firebase order to Supabase order structure
function mapOrderToSupabase(firebaseOrder) {
  return {
    legacy_order_number: firebaseOrder.salesorder_number,
    order_date: firebaseOrder.date,
    order_status: mapOrderStatus(firebaseOrder.order_status),
    sub_total: parseFloat(firebaseOrder.total) - getTaxAmount(firebaseOrder),
    total: parseFloat(firebaseOrder.total),
    customer_id: null, // Will need to be mapped based on customer lookup
    sales_id: null, // Will need to be mapped based on salesperson
    created_at: firebaseOrder.created_time,
    updated_at: firebaseOrder.last_modified_time || firebaseOrder.created_time
  };
}

// Function to map Firebase line item to Supabase line item structure
function mapLineItemToSupabase(firebaseLineItem, orderId) {
  return {
    order_id: orderId,
    item_id: null, // Will need to be mapped based on SKU/product lookup
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
}

// Helper functions
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

// Function to find existing customer - skip creation due to RLS issues
async function findExistingCustomer(firebaseOrder, companyId) {
  // First try to find existing customer by fb_customer_id if available
  if (firebaseOrder.customer_id) {
    const { data: existingCustomers, error } = await supabase
      .from('customers')
      .select('id')
      .eq('fb_customer_id', firebaseOrder.customer_id)
      .eq('linked_company', companyId)
      .limit(1);

    if (error) {
      console.error('Error finding customer by fb_customer_id:', error);
    } else if (existingCustomers && existingCustomers.length > 0) {
      console.log(`Found existing customer by fb_customer_id: ${firebaseOrder.customer_name}`);
      return existingCustomers[0].id;
    }
  }

  // Try to find existing customer by name or email
  const { data: existingCustomers, error } = await supabase
    .from('customers')
    .select('id')
    .or(`display_name.ilike.%${firebaseOrder.customer_name}%,email.ilike.%${firebaseOrder.email}%`)
    .eq('linked_company', companyId)
    .limit(1);

  if (error) {
    console.error('Error finding customer:', error);
    return null;
  }

  if (existingCustomers && existingCustomers.length > 0) {
    console.log(`Found existing customer: ${firebaseOrder.customer_name}`);
    return existingCustomers[0].id;
  }

  // Skip customer creation due to RLS - just return null
  console.log(`No existing customer found for: ${firebaseOrder.customer_name} - will create order without customer_id`);
  return null;
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

// Function to process line items for an existing order
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
      ...mapLineItemToSupabase(firebaseLineItem, orderId),
      item_id: itemId // might be null if not found
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

// Function to get the company ID from environment or database
async function getCompanyId() {
  // Use the company ID from environment variable if available
  const envCompanyId = process.env.DEFAULT_COMPANY_ID;
  if (envCompanyId) {
    // Verify the company exists
    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', envCompanyId)
      .single();
    
    if (error || !company) {
      console.error('Company ID from environment not found in database:', envCompanyId);
    } else {
      console.log(`✅ Using company from environment: ${company.name} (${company.id})`);
      return company.id;
    }
  }

  // Fallback to first company in database
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1);
  
  if (error) {
    console.error('Error fetching company:', error);
    return null;
  }
  
  if (!companies || companies.length === 0) {
    console.error('No companies found in database');
    return null;
  }
  
  console.log(`✅ Using first company: ${companies[0].name} (${companies[0].id})`);
  return companies[0].id;
}

// Main upload function
async function uploadOrdersToSupabase() {
  console.log('Starting upload process...');
  
  // Get the company ID
  const COMPANY_ID = await getCompanyId();
  if (!COMPANY_ID) {
    console.error('❌ Could not determine company ID. Exiting.');
    return;
  }
  
  let processedOrders = 0;
  let processedLineItems = 0;
  let errors = [];

  for (const firebaseOrder of salesOrdersData) {
    try {
      console.log(`Processing order ${firebaseOrder.salesorder_number}...`);

      // Check if order already exists
      console.log(`Checking for existing order: ${firebaseOrder.salesorder_number}`);
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id')
        .eq('legacy_order_number', firebaseOrder.salesorder_number)
        .single();

      if (existingOrderError && existingOrderError.code !== 'PGRST116') {
        console.error('Error checking existing order:', existingOrderError);
      }

      if (existingOrder) {
        console.log(`Order ${firebaseOrder.salesorder_number} already exists, checking line items...`);
        
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
      } else {
        console.log(`Order ${firebaseOrder.salesorder_number} does not exist, will create...`);
      }

      // Find existing customer (skip creation due to RLS)
      const customerId = await findExistingCustomer(firebaseOrder, COMPANY_ID);
      
      // Continue processing even without customer_id - we'll create order anyway
      if (!customerId) {
        console.log(`No customer found for order ${firebaseOrder.salesorder_number} - creating order without customer_id`);
      }

      // Prepare order data
      const orderData = {
        ...mapOrderToSupabase(firebaseOrder),
        customer_id: customerId,
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
      if (firebaseOrder.line_items && Array.isArray(firebaseOrder.line_items)) {
        const lineItemsData = [];
        
        for (const firebaseLineItem of firebaseOrder.line_items) {
          // Try to find the item by SKU
          const itemId = await findItemBySku(
            firebaseLineItem.sku, 
            firebaseOrder.brand || 'unknown'
          );

          const lineItemData = {
            ...mapLineItemToSupabase(firebaseLineItem, createdOrder.id),
            item_id: itemId // might be null if not found
          };

          lineItemsData.push(lineItemData);
        }

        // Insert line items in batch
        const { error: lineItemsError } = await supabase
          .from('order_line_items')
          .insert(lineItemsData);

        if (lineItemsError) {
          errors.push(`Failed to create line items for order ${firebaseOrder.salesorder_number}: ${lineItemsError.message}`);
        } else {
          processedLineItems += lineItemsData.length;
          console.log(`Created ${lineItemsData.length} line items for order ${firebaseOrder.salesorder_number}`);
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      errors.push(`Error processing order ${firebaseOrder.salesorder_number}: ${error.message}`);
      console.error(`Error processing order ${firebaseOrder.salesorder_number}:`, error);
    }
  }

  // Print summary
  console.log('\n=== UPLOAD SUMMARY ===');
  console.log(`Total orders in JSON: ${salesOrdersData.length}`);
  console.log(`Orders processed: ${processedOrders}`);
  console.log(`Line items processed: ${processedLineItems}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nERRORS:');
    errors.forEach(error => console.log(`- ${error}`));
  }

  console.log('\nUpload completed!');
}

// Run the upload
uploadOrdersToSupabase().catch(console.error);

// Export functions for testing
module.exports = {
  mapOrderToSupabase,
  mapLineItemToSupabase,
  uploadOrdersToSupabase
};