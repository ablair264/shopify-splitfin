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

// Fetch all sales orders from Zoho
async function fetchAllSalesOrders() {
  const allSalesOrders = [];
  let page = 1;
  const perPage = 200;
  
  console.log('📋 Fetching all sales orders from Zoho...');

  while (true) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/salesorders`,
        {
          params: {
            page,
            per_page: perPage,
            sort_column: 'date',
            sort_order: 'D'
          },
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          }
        }
      );

      const salesOrders = response.data.salesorders || [];
      
      if (salesOrders.length === 0) {
        break;
      }
      
      allSalesOrders.push(...salesOrders);
      console.log(`   📋 Page ${page}: ${salesOrders.length} sales orders (total: ${allSalesOrders.length})`);
      
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error fetching sales orders page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      break;
    }
  }

  return allSalesOrders;
}

// Function to update orders with Zoho salesorder_id
async function updateOrdersWithZohoIds() {
  console.log('🔄 Updating orders table with Zoho salesorder_id...');
  
  try {
    // Fetch all sales orders directly from Zoho
    const salesOrders = await fetchAllSalesOrders();
    console.log(`📄 Found ${salesOrders.length} sales orders to process`);
    
    let updatedCount = 0;
    let notFoundCount = 0;
    let errors = [];
    
    for (const zohoOrder of salesOrders) {
      try {
        const salesOrderNumber = zohoOrder.salesorder_number;
        const salesOrderId = zohoOrder.salesorder_id;
        
        if (!salesOrderNumber || !salesOrderId) {
          console.log(`⚠️ Missing data for order: ${salesOrderNumber || 'unknown'}`);
          continue;
        }
        
        // Find the corresponding order in Supabase by legacy_order_number
        const { data: existingOrder, error: findError } = await supabase
          .from('orders')
          .select('id, legacy_order_number, legacy_order_id')
          .eq('company_id', DM_BRANDS_ID)
          .eq('legacy_order_number', salesOrderNumber)
          .single();
          
        if (findError || !existingOrder) {
          console.log(`❌ Order not found in Supabase: ${salesOrderNumber}`);
          notFoundCount++;
          continue;
        }
        
        // Check if already updated
        if (existingOrder.legacy_order_id === salesOrderId) {
          console.log(`⏭️ Order ${salesOrderNumber} already has correct Zoho ID`);
          continue;
        }
        
        // Update the order with Zoho salesorder_id as string to handle large numbers
        const { error: updateError } = await supabase
          .from('orders')
          .update({ legacy_order_id: salesOrderId.toString() })
          .eq('id', existingOrder.id);
          
        if (updateError) {
          errors.push(`Order ${salesOrderNumber}: ${updateError.message}`);
          console.log(`❌ Failed to update ${salesOrderNumber}: ${updateError.message}`);
        } else {
          updatedCount++;
          console.log(`✅ Updated ${salesOrderNumber} with Zoho ID: ${salesOrderId}`);
        }
        
      } catch (error) {
        errors.push(`Order ${zohoOrder.salesorder_number}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ❌ Not found: ${notFoundCount}`);
    console.log(`   🚫 Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n   First 5 errors:`);
      errors.slice(0, 5).forEach(error => console.log(`     - ${error}`));
    }
    
  } catch (error) {
    console.error('❌ Failed to update orders:', error);
  }
}

// Run the update
if (require.main === module) {
  updateOrdersWithZohoIds();
}

module.exports = { updateOrdersWithZohoIds, fetchAllSalesOrders };