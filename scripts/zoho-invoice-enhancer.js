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
    console.log('🔑 Refreshing Zoho access token...');
    
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
    cachedExpiry = now + (data.expires_in * 1000) - 60000; // 1 minute buffer
    
    console.log('   ✅ Token refreshed successfully');
    return cachedToken;
  } catch (error) {
    console.error('   ❌ Failed to refresh Zoho token:', error.message);
    throw error;
  }
}

// Fetch paginated data from Zoho
async function fetchZohoPaginatedData(url, params = {}) {
  const allData = [];
  let page = 1;
  const perPage = 200;
  const maxPages = 50; // Safety limit

  while (page <= maxPages) {
    try {
      const token = await getZohoAccessToken();
      
      const requestParams = {
        ...params,
        page,
        per_page: perPage
      };
      
      const response = await axios.get(url, {
        params: requestParams,
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        },
        timeout: 30000
      });

      const items = response.data.invoices || response.data.items || response.data.contacts || [];
      
      if (items.length === 0) {
        console.log(`   📄 No more data on page ${page}`);
        break;
      }
      
      allData.push(...items);
      console.log(`   📄 Fetched page ${page}: ${items.length} items (total: ${allData.length})`);
      
      // Check if we have more pages
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error(`   ⚠️ Error on page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('   ⏳ Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      break;
    }
  }

  return allData;
}

// Fetch invoice details from Zoho
async function fetchZohoInvoiceDetails(invoiceId) {
  try {
    const token = await getZohoAccessToken();
    
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        }
      }
    );
    
    return response.data.invoice;
  } catch (error) {
    console.error(`Failed to fetch invoice ${invoiceId}:`, error.message);
    return null;
  }
}

// Get brand mapping
async function getBrandMapping() {
  const { data: brands } = await supabase
    .from('brands')
    .select('id, brand_name, brand_normalized')
    .eq('company_id', DM_BRANDS_ID);
    
  const brandByName = new Map();
  const brandByNormalized = new Map();
  
  brands?.forEach(brand => {
    brandByName.set(brand.brand_name.toLowerCase(), brand.id);
    brandByNormalized.set(brand.brand_normalized.toLowerCase(), brand.id);
  });
  
  return { brandByName, brandByNormalized };
}

// Get salesperson mapping
async function getSalespersonMapping() {
  const { data: users } = await supabase
    .from('users')
    .select('id, zoho_sp_id, email, first_name, last_name')
    .not('zoho_sp_id', 'is', null);
    
  const salesPersonMap = new Map(users?.map(u => [u.zoho_sp_id, u.id]) || []);
  
  console.log('👤 Available sales persons:');
  users?.forEach(u => console.log(`   ${u.first_name} ${u.last_name} → ${u.zoho_sp_id}`));
  
  return salesPersonMap;
}

// Main function to enhance invoices
async function enhanceInvoicesFromZoho() {
  console.log('🚀 Enhancing invoices with Zoho data...\n');
  
  try {
    // Get mappings
    console.log('📋 Setting up mappings...');
    const { brandByName, brandByNormalized } = await getBrandMapping();
    const salesPersonMap = await getSalespersonMapping();
    
    // Get Supabase invoices that need enhancement
    console.log('\n📄 Fetching invoices from Supabase...');
    
    let allInvoices = [];
    let start = 0;
    const limit = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_date, total, customer_id, brand_id, sales_id, billing_address_line_1')
        .eq('company_id', DM_BRANDS_ID)
        .range(start, start + limit - 1);
        
      if (error || !data || data.length === 0) break;
      allInvoices.push(...data);
      if (data.length < limit) break;
      start += limit;
    }
    
    console.log(`   📊 Found ${allInvoices.length} invoices to potentially enhance`);
    
    // Filter invoices that need enhancement
    const invoicesToEnhance = allInvoices.filter(inv => 
      !inv.brand_id || !inv.sales_id || !inv.billing_address_line_1
    );
    
    console.log(`   🔧 ${invoicesToEnhance.length} invoices need enhancement`);
    
    if (invoicesToEnhance.length === 0) {
      console.log('   ✅ All invoices already enhanced!');
      return;
    }
    
    // Fetch Zoho invoices
    console.log('\\n🌐 Fetching invoices from Zoho...');
    const zohoInvoices = await fetchZohoPaginatedData(
      `${ZOHO_CONFIG.baseUrls.inventory}/invoices`,
      {
        sort_column: 'last_modified_time',
        sort_order: 'D'
      }
    );
    
    console.log(`   📊 Found ${zohoInvoices.length} invoices in Zoho`);
    
    // Create matching logic by date and amount
    const zohoInvoiceMap = new Map();
    
    zohoInvoices.forEach(zInv => {
      const date = zInv.date;
      const total = parseFloat(zInv.total || 0);
      const key = `${date}_${total.toFixed(2)}`;
      
      if (!zohoInvoiceMap.has(key)) {
        zohoInvoiceMap.set(key, []);
      }
      zohoInvoiceMap.get(key).push(zInv);
    });
    
    console.log(`   🔍 Created ${zohoInvoiceMap.size} unique date-amount combinations`);
    
    // Process enhancements
    console.log('\\n🔧 Processing enhancements...');
    
    let enhanced = 0;
    let brandMatches = 0;
    let salesMatches = 0;
    let addressUpdates = 0;
    const batchSize = 20;
    
    for (let i = 0; i < invoicesToEnhance.length; i += batchSize) {
      const batch = invoicesToEnhance.slice(i, i + batchSize);
      const updates = [];
      
      for (const supabaseInv of batch) {
        const key = `${supabaseInv.invoice_date}_${parseFloat(supabaseInv.total).toFixed(2)}`;
        const matchingZohoInvs = zohoInvoiceMap.get(key) || [];
        
        if (matchingZohoInvs.length === 0) continue;
        
        // Use the first match (could be improved with more matching criteria)
        const zohoInv = matchingZohoInvs[0];
        
        const updateData = {};
        let hasUpdates = false;
        
        // Extract brand from line items
        if (!supabaseInv.brand_id && zohoInv.line_items?.length > 0) {
          for (const item of zohoInv.line_items) {
            const itemName = (item.name || '').toLowerCase();
            const itemDesc = (item.description || '').toLowerCase();
            
            // Try to match brand from item name or description
            let brandId = null;
            
            // Check common brand indicators
            const brandChecks = [
              'blomus', 'elvang', 'gefu', 'rader', 'remember', 'relaxound', 'my flame'
            ];
            
            for (const brandCheck of brandChecks) {
              if (itemName.includes(brandCheck) || itemDesc.includes(brandCheck)) {
                brandId = brandByNormalized.get(brandCheck) || brandByName.get(brandCheck);
                if (brandId) break;
              }
            }
            
            if (brandId) {
              updateData.brand_id = brandId;
              brandMatches++;
              hasUpdates = true;
              break;
            }
          }
        }
        
        // Extract salesperson
        if (!supabaseInv.sales_id && zohoInv.salesperson_id) {
          const salesId = salesPersonMap.get(zohoInv.salesperson_id);
          if (salesId) {
            updateData.sales_id = salesId;
            salesMatches++;
            hasUpdates = true;
          }
        }
        
        // Extract billing address
        if (!supabaseInv.billing_address_line_1 && zohoInv.billing_address) {
          const billing = zohoInv.billing_address;
          if (billing.address) {
            updateData.billing_address_line_1 = billing.address;
            updateData.billing_city = billing.city || null;
            updateData.billing_state = billing.state || null;
            updateData.billing_zip = billing.zip || null;
            updateData.billing_country = billing.country || null;
            addressUpdates++;
            hasUpdates = true;
          }
        }
        
        if (hasUpdates) {
          updates.push({
            id: supabaseInv.id,
            updates: updateData
          });
        }
      }
      
      // Apply updates
      const updatePromises = updates.map(({ id, updates }) =>
        supabase
          .from('invoices')
          .update(updates)
          .eq('id', id)
      );
      
      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      enhanced += successCount;
      
      console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: enhanced ${successCount} invoices`);
      console.log(`      🏷️ Brand matches so far: ${brandMatches}`);
      console.log(`      👤 Sales matches so far: ${salesMatches}`);
      console.log(`      📍 Address updates so far: ${addressUpdates}`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\\n📊 Enhancement Results:');
    console.log(`   ✅ Total invoices enhanced: ${enhanced}`);
    console.log(`   🏷️ Brand assignments: ${brandMatches}`);
    console.log(`   👤 Salesperson assignments: ${salesMatches}`);
    console.log(`   📍 Billing address updates: ${addressUpdates}`);
    
    // Final verification
    console.log('\\n🔍 Final Verification:');
    
    const { count: withBrands } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .not('brand_id', 'is', null);
      
    const { count: withSales } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .not('sales_id', 'is', null);
      
    const { count: withAddresses } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', DM_BRANDS_ID)
      .not('billing_address_line_1', 'is', null);
    
    console.log(`   🏷️ Invoices with brands: ${withBrands || 0}`);
    console.log(`   👤 Invoices with sales persons: ${withSales || 0}`);
    console.log(`   📍 Invoices with billing addresses: ${withAddresses || 0}`);
    
  } catch (error) {
    console.error('\\n❌ Enhancement failed:', error);
    
    if (error.message.includes('refresh_token')) {
      console.log('\\n⚠️  Please update your Zoho refresh token in .env.zoho');
      console.log('   You can get a new refresh token from the Zoho Developer Console');
    }
    
    throw error;
  }
}

// Test Zoho connection
async function testZohoConnection() {
  console.log('🔍 Testing Zoho connection...');
  
  try {
    const token = await getZohoAccessToken();
    console.log('   ✅ Token obtained successfully');
    
    // Test with a simple inventory organization call first
    try {
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/organizations/${ZOHO_CONFIG.orgId}`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          }
        }
      );
      
      console.log('   ✅ Inventory connection successful');
      console.log(`   📊 Organization: ${response.data.organization?.name || 'Connected'}`);
      return true;
      
    } catch (invError) {
      console.log('   ⚠️ Inventory API test failed, trying basic info call...');
      console.log('   Error:', invError.response?.status, invError.response?.data?.message || invError.message);
      
      // Try a simpler call
      const simpleResponse = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/items`,
        {
          params: { per_page: 1 },
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          }
        }
      );
      
      console.log('   ✅ Basic inventory API connection successful');
      return true;
    }
    
  } catch (error) {
    console.error('   ❌ Connection failed:', error.response?.status, error.response?.data?.message || error.message);
    
    // Log more details for debugging
    if (error.response?.data) {
      console.error('   📋 Full error response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// Main execution
async function main() {
  console.log('🌐 Zoho Invoice Enhancement Tool\\n');
  
  // Check environment variables
  const requiredVars = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID'];
  const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v] === 'your_zoho_' + v.toLowerCase());
  
  if (missingVars.length > 0) {
    console.error('❌ Missing Zoho environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.log('\\nPlease update the .env.zoho file with your Zoho credentials');
    return;
  }
  
  // Test connection first
  const connectionOk = await testZohoConnection();
  if (!connectionOk) {
    console.log('\\n❌ Cannot proceed without valid Zoho connection');
    return;
  }
  
  // Run enhancement
  await enhanceInvoicesFromZoho();
  
  console.log('\\n🎉 Invoice enhancement completed!');
}

if (require.main === module) {
  main();
}

module.exports = {
  enhanceInvoicesFromZoho,
  testZohoConnection
};