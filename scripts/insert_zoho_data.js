const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });
require('dotenv').config({ path: '.env.zoho' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// Data file paths
const DATA_DIR = '/Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/scripts/data';

// Load JSON files
function loadDataFile(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ File not found: ${filename}`);
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📄 Loaded ${data.length} records from ${filename}`);
    return data;
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error.message);
    return [];
  }
}

// Get existing data mappings
async function loadMappings() {
  console.log('📋 Loading existing mappings...');
  
  // Load brands mapping
  const { data: brands } = await supabase
    .from('brands')
    .select('id, brand_name, brand_normalized')
    .eq('company_id', DM_BRANDS_ID);
  
  const brandMap = new Map();
  brands?.forEach(brand => {
    brandMap.set(brand.brand_name.toLowerCase(), brand.id);
    brandMap.set(brand.brand_normalized.toLowerCase(), brand.id);
  });
  
  // Load customers mapping
  const { data: customers } = await supabase
    .from('customers')
    .select('id, zoho_customer_id, display_name')
    .eq('linked_company', DM_BRANDS_ID);
  
  const customerMap = new Map();
  customers?.forEach(customer => {
    if (customer.zoho_customer_id) {
      customerMap.set(customer.zoho_customer_id, customer.id);
    }
  });
  
  // Load users/sales mapping
  const { data: users } = await supabase
    .from('users')
    .select('id, zoho_sp_id, first_name, last_name')
    .eq('company_id', DM_BRANDS_ID)
    .not('zoho_sp_id', 'is', null);
  
  const salesMap = new Map();
  users?.forEach(user => {
    if (user.zoho_sp_id) {
      salesMap.set(user.zoho_sp_id, user.id);
    }
  });
  
  console.log(`   🏷️ ${brands?.length || 0} brands mapped`);
  console.log(`   👥 ${customers?.length || 0} customers mapped`);
  console.log(`   👤 ${users?.length || 0} sales users mapped`);
  
  return { brandMap, customerMap, salesMap };
}

// Extract brand from item/line item data
function extractBrandId(item, brandMap) {
  const itemName = (item.name || '').toLowerCase();
  const itemDesc = (item.description || '').toLowerCase();
  
  const brandChecks = [
    'blomus', 'elvang', 'gefu', 'rader', 'räder', 'remember', 
    'relaxound', 'my flame', 'myflame'
  ];
  
  for (const brandCheck of brandChecks) {
    if (itemName.includes(brandCheck) || itemDesc.includes(brandCheck)) {
      return brandMap.get(brandCheck) || 
             brandMap.get(brandCheck.replace('ä', 'a')) || null;
    }
  }
  
  return null;
}

// Insert items (products)
async function insertItems(items, brandMap) {
  if (!items || items.length === 0) {
    console.log('⏭️ No items to insert');
    return;
  }
  
  console.log(`\n📦 Processing ${items.length} items...`);
  
  let insertedCount = 0;
  let skippedCount = 0;
  let errors = [];
  
  const batchSize = 50;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const itemsToInsert = [];
    
    for (const zohoItem of batch) {
      // Check if item already exists
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('sku', zohoItem.sku)
        .single();
        
      if (existing) {
        skippedCount++;
        continue;
      }
      
      // Extract brand
      const brandId = extractBrandId(zohoItem, brandMap);
      
      const itemData = {
        name: zohoItem.name || 'Unknown Item',
        description: zohoItem.description || null,
        sku: zohoItem.sku || `ZOHO-${zohoItem.item_id}`,
        ean: zohoItem.ean || null,
        category: zohoItem.category_name || null,
        brand_id: brandId,
        purchase_price: zohoItem.purchase_rate ? parseFloat(zohoItem.purchase_rate) : null,
        retail_price: zohoItem.rate ? parseFloat(zohoItem.rate) : null,
        gross_stock_level: zohoItem.stock_on_hand ? parseInt(zohoItem.stock_on_hand) : 0,
        // net_stock_level will use database default - removed explicit assignment
        reorder_level: zohoItem.reorder_level ? parseInt(zohoItem.reorder_level) : 0,
        status: zohoItem.status === 'active' ? 'active' : 'inactive',
        created_date: zohoItem.created_time ? new Date(zohoItem.created_time).toISOString() : new Date().toISOString()
      };
      
      itemsToInsert.push(itemData);
    }
    
    if (itemsToInsert.length > 0) {
      const { error } = await supabase
        .from('items')
        .insert(itemsToInsert);
        
      if (error) {
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        console.error(`❌ Error inserting items batch:`, error.message);
      } else {
        insertedCount += itemsToInsert.length;
        console.log(`   ✅ Inserted ${itemsToInsert.length} items (batch ${Math.floor(i/batchSize) + 1})`);
      }
    }
  }
  
  console.log(`\n📦 Items Summary:`);
  console.log(`   ✅ Inserted: ${insertedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`   Error details:`, errors);
  }
}

// Get or create a placeholder order for invoices
async function getPlaceholderOrderId(companyId, customerId) {
  try {
    // Try to find an existing placeholder order for this customer
    const { data: existingOrder, error: findError } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .eq('order_status', 'delivered')
      .eq('total', 0) // Additional filter for placeholder orders
      .single();

    if (existingOrder && !findError) {
      return existingOrder.id;
    }

    // Create a new placeholder order
    const { data: newOrder, error: createError } = await supabase
      .from('orders')
      .insert([{
        company_id: companyId,
        customer_id: customerId,
        order_status: 'delivered', // Use existing valid status
        order_date: new Date().toISOString().split('T')[0],
        total: 0,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (createError) {
      console.warn('Could not create placeholder order:', createError.message);
      return null;
    }

    return newOrder.id;
  } catch (error) {
    console.warn('Error getting placeholder order:', error.message);
    return null;
  }
}

// Insert invoices
async function insertInvoices(invoices, customerMap, salesMap, brandMap) {
  if (!invoices || invoices.length === 0) {
    console.log('⏭️ No invoices to insert');
    return;
  }
  
  console.log(`\n📄 Processing ${invoices.length} invoices...`);
  
  let insertedCount = 0;
  let skippedCount = 0;
  let errors = [];
  
  for (const zohoInvoice of invoices) {
    try {
      // Check if invoice already exists by invoice number
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('company_id', DM_BRANDS_ID)
        .eq('total', parseFloat(zohoInvoice.total || 0))
        .eq('invoice_date', zohoInvoice.date)
        .single();
        
      if (existing) {
        skippedCount++;
        continue;
      }
      
      // Map customer
      const customerId = customerMap.get(zohoInvoice.customer_id) || null;
      
      if (!customerId) {
        errors.push(`Invoice ${zohoInvoice.invoice_number}: Customer not found`);
        continue;
      }
      
      // Map sales person
      const salesId = salesMap.get(zohoInvoice.salesperson_id) || null;
      
      // Get or create placeholder order for this customer
      const orderId = await getPlaceholderOrderId(DM_BRANDS_ID, customerId);
      
      if (!orderId) {
        errors.push(`Invoice ${zohoInvoice.invoice_number}: Could not create order_id`);
        continue;
      }
      
      // Extract brand from line items
      let brandId = null;
      if (zohoInvoice.line_items && zohoInvoice.line_items.length > 0) {
        for (const item of zohoInvoice.line_items) {
          brandId = extractBrandId(item, brandMap);
          if (brandId) break;
        }
      }
      
      const invoiceData = {
        company_id: DM_BRANDS_ID,
        order_id: orderId, // Add the required order_id
        customer_id: customerId,
        sales_id: salesId,
        brand_id: brandId,
        order_type: 'sales_order', // Keep as sales_order to match existing data
        invoice_date: zohoInvoice.date || new Date().toISOString().split('T')[0],
        total: parseFloat(zohoInvoice.total || 0),
        balance: parseFloat(zohoInvoice.balance || zohoInvoice.total || 0),
        invoice_status: mapInvoiceStatus(zohoInvoice.status),
        payment_terms: zohoInvoice.payment_terms || 30,
        date_due: zohoInvoice.due_date || null,
        billing_address_1: zohoInvoice.billing_address?.address || null,
        billing_city_town: zohoInvoice.billing_address?.city || null,
        billing_county: zohoInvoice.billing_address?.state || null,
        billing_postcode: zohoInvoice.billing_address?.zip || null,
        created_at: zohoInvoice.created_time ? new Date(zohoInvoice.created_time).toISOString() : new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('invoices')
        .insert([invoiceData]);
        
      if (error) {
        errors.push(`Invoice ${zohoInvoice.invoice_number}: ${error.message}`);
      } else {
        insertedCount++;
        if (insertedCount % 10 === 0) {
          console.log(`   📄 Processed ${insertedCount}/${invoices.length} invoices...`);
        }
      }
      
    } catch (error) {
      errors.push(`Invoice ${zohoInvoice.invoice_number}: ${error.message}`);
    }
  }
  
  console.log(`\n📄 Invoices Summary:`);
  console.log(`   ✅ Inserted: ${insertedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`   First 5 errors:`, errors.slice(0, 5));
  }
}

// Fetch detailed package from Zoho
async function fetchPackageDetails(packageId) {
  try {
    const token = await getZohoAccessToken();
    
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/packages/${packageId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        },
        timeout: 15000
      }
    );
    
    return response.data.package;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching package details ${packageId}:`, error.message);
    return null;
  }
}

// Get Zoho access token (add this if not already present)
async function getZohoAccessToken() {
  // Reuse the token logic from update_orders_with_zoho_ids.js
  const now = Date.now();
  if (cachedToken && now < cachedExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      `${process.env.ZOHO_AUTH_URL}/token`,
      null,
      {
        params: {
          grant_type: 'refresh_token',
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          refresh_token: process.env.ZOHO_REFRESH_TOKEN
        }
      }
    );
    
    const data = response.data;
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }

    cachedToken = data.access_token;
    cachedExpiry = now + (data.expires_in * 1000) - 60000;
    
    return cachedToken;
  } catch (error) {
    console.error('Failed to refresh Zoho token:', error.message);
    throw error;
  }
}

// Token management variables
let cachedToken = null;
let cachedExpiry = 0;

// Insert packages as shipments
async function insertPackages(packages, customerMap) {
  if (!packages || packages.length === 0) {
    console.log('⏭️ No packages to insert');
    return;
  }
  
  console.log(`\n📦 Processing ${packages.length} packages as shipments...`);
  
  let insertedCount = 0;
  let skippedCount = 0;
  let errors = [];
  
  // Get default warehouse
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('id')
    .eq('company_id', DM_BRANDS_ID)
    .limit(1);
    
  const defaultWarehouseId = warehouses?.[0]?.id;
  
  if (!defaultWarehouseId) {
    console.log('⚠️ No warehouse found for company, skipping shipments');
    return;
  }
  
  for (let i = 0; i < packages.length; i++) {
    const basicPackage = packages[i];
    
    try {
      console.log(`📦 Processing ${i + 1}/${packages.length}: ${basicPackage.package_number || basicPackage.package_id}...`);
      
      // Fetch detailed package information from Zoho
      const zohoPackage = await fetchPackageDetails(basicPackage.package_id);
      
      if (!zohoPackage) {
        errors.push(`Package ${basicPackage.package_number}: Could not fetch detailed data`);
        continue;
      }
      
      // Check if shipment already exists by external package ID
      const { data: existing } = await supabase
        .from('shipments')
        .select('id')
        .eq('external_package_id', zohoPackage.package_id)
        .single();
        
      if (existing) {
        skippedCount++;
        continue;
      }
      
      // Map customer
      const customerId = customerMap.get(zohoPackage.customer_id) || null;
      
      if (!customerId) {
        errors.push(`Package ${zohoPackage.package_number}: Customer not found`);
        continue;
      }
      
      // Try to find related order using salesorder_id mapped to legacy_order_id (text field)
      let orderId = null;
      if (zohoPackage.salesorder_id) {
        try {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('company_id', DM_BRANDS_ID)
            .eq('legacy_order_id', zohoPackage.salesorder_id.toString())
            .single();
            
          if (!orderError && orderData) {
            orderId = orderData.id;
          }
        } catch (error) {
          console.warn(`Error finding order for package ${zohoPackage.package_number}:`, error.message);
        }
      }
      
      // Fallback: try using salesorder_number if salesorder_id didn't work
      if (!orderId && zohoPackage.salesorder_number) {
        try {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('id')
            .eq('company_id', DM_BRANDS_ID)
            .eq('legacy_order_number', zohoPackage.salesorder_number)
            .single();
            
          if (!orderError && orderData) {
            orderId = orderData.id;
          }
        } catch (error) {
          console.warn(`Error finding order by number for package ${zohoPackage.package_number}:`, error.message);
        }
      }
      
      // Skip packages without required order_id
      if (!orderId) {
        errors.push(`Package ${zohoPackage.package_number}: No order_id available - skipping`);
        continue;
      }
      
      const shipmentData = {
        company_id: DM_BRANDS_ID,
        warehouse_id: defaultWarehouseId,
        customer_id: customerId,
        order_id: orderId,
        
        // Core shipment info
        shipment_status: mapPackageStatus(zohoPackage.status),
        order_tracking_number: zohoPackage.tracking_number || null,
        reference_number: zohoPackage.reference_number || null,
        
        // External IDs for tracking
        external_package_id: zohoPackage.package_id,
        external_shipment_id: zohoPackage.shipment_id || null,
        external_package_number: zohoPackage.package_number || null,
        
        // Dates
        date_shipped: zohoPackage.shipped_date || zohoPackage.date ? new Date(zohoPackage.shipped_date || zohoPackage.date).toISOString() : null,
        date_delivered: zohoPackage.delivered_date ? new Date(zohoPackage.delivered_date).toISOString() : null,
        zoho_created_time: zohoPackage.created_time ? new Date(zohoPackage.created_time).toISOString() : null,
        zoho_modified_time: zohoPackage.last_modified_time ? new Date(zohoPackage.last_modified_time).toISOString() : null,
        
        // Package details
        number_of_boxes: zohoPackage.package_items?.length || zohoPackage.line_items?.length || 1,
        total_items: zohoPackage.package_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 
                    zohoPackage.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 
                    zohoPackage.total_quantity || 0,
        total_quantity: zohoPackage.total_quantity || null,
        
        // Delivery method and courier
        courier_service: zohoPackage.carrier || zohoPackage.delivery_method || 'Standard Delivery',
        
        // Shipping costs
        shipping_cost: zohoPackage.shipping_charge ? parseFloat(zohoPackage.shipping_charge) : null,
        exchange_rate: zohoPackage.exchange_rate ? parseFloat(zohoPackage.exchange_rate) : null,
        
        // Contact information
        contact_phone: zohoPackage.phone || null,
        contact_mobile: zohoPackage.mobile || null,
        contact_email: zohoPackage.email || null,
        
        // Shipping address (from shipping_address or delivery_address)
        shipping_address_1: (zohoPackage.shipping_address?.address || zohoPackage.delivery_address?.address || null),
        shipping_city_town: (zohoPackage.shipping_address?.city || zohoPackage.delivery_address?.city || null),
        shipping_county: (zohoPackage.shipping_address?.state || zohoPackage.delivery_address?.state || null),
        shipping_postcode: (zohoPackage.shipping_address?.zip || zohoPackage.delivery_address?.zip || null)?.toString(),
        shipping_country: (zohoPackage.shipping_address?.country || zohoPackage.delivery_address?.country || null),
        
        // Billing address if different from shipping
        billing_address_1: zohoPackage.billing_address?.address || null,
        billing_city_town: zohoPackage.billing_address?.city || null,
        billing_county: zohoPackage.billing_address?.state || null,
        billing_postcode: zohoPackage.billing_address?.zip?.toString() || null,
        billing_country: zohoPackage.billing_address?.country || null,
        
        // Additional fields
        notes: zohoPackage.notes || null,
        is_emailed: zohoPackage.is_emailed || false,
        package_status: zohoPackage.status || null, // Original Zoho status
        template_id: zohoPackage.template_id?.toString() || null,
        template_name: zohoPackage.template_name || null,
        
        // Store structured data as JSON
        custom_data: zohoPackage.custom_fields ? JSON.stringify(zohoPackage.custom_fields) : null,
        line_items: zohoPackage.line_items ? JSON.stringify(zohoPackage.line_items) : null,
        
        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('shipments')
        .insert([shipmentData]);
        
      if (error) {
        errors.push(`Package ${zohoPackage.package_number}: ${error.message}`);
        console.error(`❌ Error inserting ${zohoPackage.package_number}:`, error.message);
      } else {
        insertedCount++;
        if (insertedCount % 5 === 0) {
          console.log(`   ✅ Successfully inserted ${insertedCount}/${packages.length} packages...`);
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors.push(`Package ${basicPackage.package_number || basicPackage.package_id}: ${error.message}`);
      console.error(`❌ Error processing package:`, error.message);
    }
  }
  
  console.log(`\n📦 Packages Summary:`);
  console.log(`   ✅ Inserted: ${insertedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log(`   First 5 errors:`, errors.slice(0, 5));
  }
}

// Helper functions for status mapping
function mapInvoiceStatus(zohoStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent',
    'viewed': 'sent',
    'overdue': 'overdue',
    'paid': 'paid',
    'partially_paid': 'received',
    'void': 'draft'
  };
  
  return statusMap[zohoStatus?.toLowerCase()] || 'draft';
}

function mapPackageStatus(zohoStatus) {
  const statusMap = {
    'draft': 'pending',
    'packed': 'packed',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'cancelled': 'failed'
  };
  
  return statusMap[zohoStatus?.toLowerCase()] || 'pending';
}

// Main insertion function
async function insertAllZohoData() {
  console.log('🚀 Inserting Zoho data into Supabase...\n');
  
  try {
    const startTime = Date.now();
    
    // Load mappings
    const { brandMap, customerMap, salesMap } = await loadMappings();
    
    // Load data files
    const items = loadDataFile('items_created_sept1.json');
    const invoicesBasic = loadDataFile('invoices_basic.json');
    const invoicesDetailed = loadDataFile('invoices_detailed.json');
    
    // Try to load complete packages first, fallback to dated packages
    let packages = loadDataFile('packages_detailed_complete.json');
    if (packages.length === 0) {
      packages = loadDataFile('packages_all_complete.json');
    }
    if (packages.length === 0) {
      packages = loadDataFile('packages_all.json'); // Fallback to old file
    }
    
    // Use detailed invoices if available, fallback to basic
    const invoices = invoicesDetailed.length > 0 ? invoicesDetailed : invoicesBasic;
    
    // Insert data - Skip items and invoices, only process packages
    console.log('⏭️ Skipping items insertion (already completed)');
    console.log('⏭️ Skipping invoices insertion (already completed)');
    await insertPackages(packages, customerMap);
    
    // Summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 Data Insertion Complete!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`📦 Items processed: ${items.length}`);
    console.log(`📄 Invoices processed: ${invoices.length}`);
    console.log(`📦 Packages processed: ${packages.length}`);
    
  } catch (error) {
    console.error('\n❌ Data insertion failed:', error);
    throw error;
  }
}

// Run the insertion
if (require.main === module) {
  insertAllZohoData();
}

module.exports = {
  insertAllZohoData,
  insertItems,
  insertInvoices,
  insertPackages,
  loadMappings
};