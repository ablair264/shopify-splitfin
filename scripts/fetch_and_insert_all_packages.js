const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });
require('dotenv').config({ path: '.env.zoho' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// Zoho API Configuration
const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  orgId: process.env.ZOHO_ORG_ID,
  
  baseUrls: {
    auth: process.env.ZOHO_AUTH_URL,
    crm: process.env.ZOHO_CRM_URL,
    inventory: process.env.ZOHO_INVENTORY_URL
  }
};

// Token management
let cachedToken = null;
let cachedExpiry = 0;

async function getZohoAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry) {
    return cachedToken;
  }

  try {
    const response = await axios.post(
      `${ZOHO_CONFIG.baseUrls.auth}/token`,
      null,
      {
        params: {
          grant_type: 'refresh_token',
          client_id: ZOHO_CONFIG.clientId,
          client_secret: ZOHO_CONFIG.clientSecret,
          refresh_token: ZOHO_CONFIG.refreshToken
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

// Fetch ALL packages from Zoho (no date filtering)
async function fetchAllPackages() {
  const allPackages = [];
  let page = 1;
  const perPage = 200;
  
  console.log('📦 Fetching ALL Zoho packages (no date filter)...');

  while (true) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/packages`,
        {
          params: {
            page,
            per_page: perPage,
            sort_column: 'date',
            sort_order: 'D'
            // No date filtering - get everything
          },
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          }
        }
      );

      const packages = response.data.packages || [];
      
      if (packages.length === 0) {
        break;
      }
      
      allPackages.push(...packages);
      console.log(`   📦 Page ${page}: ${packages.length} packages (total: ${allPackages.length})`);
      
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error fetching packages page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      break;
    }
  }

  return allPackages;
}

// Fetch detailed package information
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
  
  console.log(`   🏷️ ${brands?.length || 0} brands mapped`);
  console.log(`   👥 ${customers?.length || 0} customers mapped`);
  
  return { brandMap, customerMap };
}

// Helper functions for status mapping
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

// Main function to fetch and insert all packages
async function fetchAndInsertAllPackages() {
  console.log('🚀 Fetching and inserting ALL packages from Zoho...\n');
  
  try {
    const startTime = Date.now();
    
    // Load mappings
    const { brandMap, customerMap } = await loadMappings();
    
    // Get default warehouse
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id')
      .eq('company_id', DM_BRANDS_ID)
      .limit(1);
      
    const defaultWarehouseId = warehouses?.[0]?.id;
    
    if (!defaultWarehouseId) {
      console.log('⚠️ No warehouse found for company, cannot process shipments');
      return;
    }
    
    // 1. Fetch all packages from Zoho
    const packages = await fetchAllPackages();
    console.log(`\n📦 Found ${packages.length} packages to process\n`);
    
    // 2. Process each package individually
    let insertedCount = 0;
    let skippedCount = 0;
    let errors = [];
    
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
          console.log(`   ⏭️ Already exists: ${zohoPackage.package_number}`);
          continue;
        }
        
        // Map customer
        const customerId = customerMap.get(zohoPackage.customer_id) || null;
        
        if (!customerId) {
          errors.push(`Package ${zohoPackage.package_number}: Customer not found`);
          continue;
        }
        
        // Try to find related order using salesorder_id mapped to legacy_order_id
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
            // Silent fail, try fallback
          }
        }
        
        // Fallback: try using salesorder_number
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
            // Silent fail
          }
        }
        
        // Skip packages without required order_id
        if (!orderId) {
          errors.push(`Package ${zohoPackage.package_number}: No matching order found`);
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
          
          // Delivery and courier details (ENHANCED)
          courier_service: zohoPackage.carrier || zohoPackage.delivery_method || 'Standard Delivery',
          carrier_id: zohoPackage.carrier_id || null,
          carrier_name: zohoPackage.carrier || null,
          delivery_method_id: zohoPackage.delivery_method_id || null,
          shipment_type: zohoPackage.shipment_type || null,
          is_tracking_enabled: zohoPackage.is_tracking_enabled || false,
          sales_channel: zohoPackage.sales_channel || null,
          
          // Financial information (ENHANCED)
          shipping_cost: zohoPackage.shipping_charge ? parseFloat(zohoPackage.shipping_charge) : null,
          exchange_rate: zohoPackage.exchange_rate ? parseFloat(zohoPackage.exchange_rate) : null,
          
          // Contact information (ENHANCED)
          contact_phone: zohoPackage.phone || null,
          contact_mobile: zohoPackage.mobile || null,
          contact_email: zohoPackage.email || null,
          contact_persons: zohoPackage.contact_persons ? JSON.stringify(zohoPackage.contact_persons) : null,
          
          // Package status
          package_status: zohoPackage.status || null, // Original Zoho status
          
          // Shipping address (ENHANCED)
          shipping_address_1: (zohoPackage.shipping_address?.address || zohoPackage.delivery_address?.address || null),
          shipping_city_town: (zohoPackage.shipping_address?.city || zohoPackage.delivery_address?.city || null),
          shipping_county: (zohoPackage.shipping_address?.state || zohoPackage.delivery_address?.state || null),
          shipping_postcode: (zohoPackage.shipping_address?.zip || zohoPackage.delivery_address?.zip || null)?.toString(),
          shipping_country: (zohoPackage.shipping_address?.country || zohoPackage.delivery_address?.country || null),
          shipping_fax: (zohoPackage.shipping_address?.fax || zohoPackage.delivery_address?.fax || null),
          
          // Billing address (ENHANCED)
          billing_address_1: zohoPackage.billing_address?.address || null,
          billing_city_town: zohoPackage.billing_address?.city || null,
          billing_county: zohoPackage.billing_address?.state || null,
          billing_postcode: zohoPackage.billing_address?.zip?.toString() || null,
          billing_country: zohoPackage.billing_address?.country || null,
          billing_fax: zohoPackage.billing_address?.fax || null,
          
          // Template information (ENHANCED)
          template_id: zohoPackage.template_id?.toString() || null,
          template_name: zohoPackage.template_name || null,
          template_type: zohoPackage.template_type || null,
          
          // Additional fields
          notes: zohoPackage.notes || null,
          is_emailed: zohoPackage.is_emailed || false,
          
          // Store structured data as JSON (ENHANCED)
          custom_data: zohoPackage.custom_fields ? JSON.stringify(zohoPackage.custom_fields) : null,
          line_items: zohoPackage.line_items ? JSON.stringify(zohoPackage.line_items) : null,
          package_items: zohoPackage.package_items ? JSON.stringify(zohoPackage.package_items) : null,
          
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
          console.log(`   ✅ Successfully inserted: ${zohoPackage.package_number}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        errors.push(`Package ${basicPackage.package_number || basicPackage.package_id}: ${error.message}`);
        console.error(`❌ Error processing package:`, error.message);
      }
    }
    
    // Summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n🎉 Package Processing Complete!`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`✅ Inserted: ${insertedCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\nFirst 10 errors:`);
      errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
    }
    
  } catch (error) {
    console.error('\n❌ Process failed:', error);
    throw error;
  }
}

// Run the process
if (require.main === module) {
  fetchAndInsertAllPackages();
}

module.exports = {
  fetchAndInsertAllPackages
};