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

// Fetch detailed invoice from Zoho
async function fetchZohoInvoiceDetails(invoiceId) {
  try {
    const token = await getZohoAccessToken();
    
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        },
        timeout: 10000
      }
    );
    
    return response.data.invoice;
  } catch (error) {
    if (error.response?.status === 404) {
      return null; // Invoice not found
    }
    console.error(`Error fetching invoice ${invoiceId}:`, error.message);
    return null;
  }
}

// Get all Zoho invoice IDs first (lightweight call)
async function getAllZohoInvoiceIds() {
  const allInvoices = [];
  let page = 1;
  const perPage = 200;
  const maxPages = 100;

  console.log('📋 Fetching Zoho invoice list...');

  while (page <= maxPages) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/invoices`,
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

      const invoices = response.data.invoices || [];
      
      if (invoices.length === 0) {
        break;
      }
      
      // Store basic info for matching
      invoices.forEach(inv => {
        allInvoices.push({
          invoice_id: inv.invoice_id,
          invoice_number: inv.invoice_number,
          date: inv.date,
          total: parseFloat(inv.total || 0),
          customer_name: inv.customer_name,
          status: inv.status
        });
      });
      
      console.log(`   📄 Page ${page}: ${invoices.length} invoices (total: ${allInvoices.length})`);
      
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error on page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      break;
    }
  }

  return allInvoices;
}

// Main enhancement function
async function enhanceInvoicesDetailed() {
  console.log('🚀 Enhanced Zoho Invoice Processing...\n');
  
  try {
    // Get mappings
    console.log('📋 Setting up mappings...');
    
    const { data: brands } = await supabase
      .from('brands')
      .select('id, brand_name, brand_normalized')
      .eq('company_id', DM_BRANDS_ID);
      
    const { data: users } = await supabase
      .from('users')
      .select('id, zoho_sp_id, email, first_name, last_name')
      .not('zoho_sp_id', 'is', null);
    
    const brandByName = new Map();
    const brandByNormalized = new Map();
    brands?.forEach(brand => {
      brandByName.set(brand.brand_name.toLowerCase(), brand.id);
      brandByNormalized.set(brand.brand_normalized.toLowerCase(), brand.id);
      // Add variations
      if (brand.brand_normalized === 'my flame lifestyle') {
        brandByNormalized.set('my flame', brand.id);
        brandByNormalized.set('myflame', brand.id);
      }
    });
    
    const salesPersonMap = new Map(users?.map(u => [u.zoho_sp_id, u.id]) || []);
    
    console.log(`   🏷️ Loaded ${brands?.length || 0} brands`);
    console.log(`   👤 Loaded ${users?.length || 0} sales persons`);
    
    // Get Supabase invoices
    console.log('\n📄 Fetching invoices from Supabase...');
    
    let allSupabaseInvoices = [];
    let start = 0;
    const limit = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_date, total, customer_id, brand_id, sales_id, billing_address_1')
        .eq('company_id', DM_BRANDS_ID)
        .range(start, start + limit - 1);
        
      if (error || !data || data.length === 0) break;
      allSupabaseInvoices.push(...data);
      if (data.length < limit) break;
      start += limit;
    }
    
    console.log(`   📊 Found ${allSupabaseInvoices.length} invoices in Supabase`);
    
    // Get all Zoho invoice IDs
    const zohoInvoices = await getAllZohoInvoiceIds();
    console.log(`\\n🌐 Found ${zohoInvoices.length} invoices in Zoho`);
    
    // Create matching map by date and total
    const invoiceMatchMap = new Map();
    zohoInvoices.forEach(zInv => {
      const key = `${zInv.date}_${zInv.total.toFixed(2)}`;
      if (!invoiceMatchMap.has(key)) {
        invoiceMatchMap.set(key, []);
      }
      invoiceMatchMap.get(key).push(zInv);
    });
    
    console.log(`   🔍 Created ${invoiceMatchMap.size} date-amount combinations`);
    
    // Process enhancements
    console.log('\\n🔧 Processing detailed enhancements...');
    
    let processedCount = 0;
    let enhancedCount = 0;
    let brandMatches = 0;
    let salesMatches = 0;
    let addressUpdates = 0;
    
    const batchSize = 10; // Smaller batches for detailed API calls
    const totalBatches = Math.ceil(allSupabaseInvoices.length / batchSize);
    
    for (let i = 0; i < allSupabaseInvoices.length; i += batchSize) {
      const batch = allSupabaseInvoices.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`\\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} invoices)...`);
      
      const updates = [];
      
      for (const supabaseInv of batch) {
        processedCount++;
        
        // Find matching Zoho invoice
        const key = `${supabaseInv.invoice_date}_${parseFloat(supabaseInv.total).toFixed(2)}`;
        const matchingZohoInvs = invoiceMatchMap.get(key) || [];
        
        if (matchingZohoInvs.length === 0) {
          console.log(`   ⚠️ No Zoho match for ${supabaseInv.invoice_date} £${supabaseInv.total}`);
          continue;
        }
        
        // Use the first match and fetch detailed data
        const zohoInvBasic = matchingZohoInvs[0];
        
        console.log(`   🔍 Fetching details for invoice ${zohoInvBasic.invoice_number}...`);
        
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const zohoInvDetailed = await fetchZohoInvoiceDetails(zohoInvBasic.invoice_id);
        
        if (!zohoInvDetailed) {
          console.log(`   ❌ Could not fetch details for ${zohoInvBasic.invoice_number}`);
          continue;
        }
        
        console.log(`   ✅ Got detailed data for ${zohoInvDetailed.invoice_number}`);
        
        const updateData = {};
        let hasUpdates = false;
        
        // Extract brand from line items
        if (!supabaseInv.brand_id && zohoInvDetailed.line_items?.length > 0) {
          for (const item of zohoInvDetailed.line_items) {
            const itemName = (item.name || '').toLowerCase();
            const itemDesc = (item.description || '').toLowerCase();
            
            let brandId = null;
            
            // Check each brand
            const brandChecks = [
              'blomus', 'elvang', 'gefu', 'rader', 'räder', 'remember', 'relaxound', 'my flame', 'myflame'
            ];
            
            for (const brandCheck of brandChecks) {
              if (itemName.includes(brandCheck) || itemDesc.includes(brandCheck)) {
                // Try both original and normalized versions
                brandId = brandByNormalized.get(brandCheck) || 
                         brandByName.get(brandCheck) ||
                         brandByNormalized.get(brandCheck.replace('ä', 'a')) || 
                         brandByName.get(brandCheck.replace('ä', 'a'));
                if (brandId) {
                  console.log(`     🏷️ Brand detected: ${brandCheck} in "${item.name}"`);
                  break;
                }
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
        if (!supabaseInv.sales_id && zohoInvDetailed.salesperson_id) {
          const salesId = salesPersonMap.get(zohoInvDetailed.salesperson_id);
          if (salesId) {
            updateData.sales_id = salesId;
            salesMatches++;
            hasUpdates = true;
            console.log(`     👤 Salesperson mapped: ${zohoInvDetailed.salesperson_name}`);
          }
        }
        
        // Extract billing address
        if (!supabaseInv.billing_address_1 && zohoInvDetailed.billing_address) {
          const billing = zohoInvDetailed.billing_address;
          if (billing.address) {
            updateData.billing_address_1 = billing.address;
            updateData.billing_city_town = billing.city || null;
            updateData.billing_county = billing.state || null;
            updateData.billing_postcode = billing.zip || null;
            addressUpdates++;
            hasUpdates = true;
            console.log(`     📍 Address extracted: ${billing.address.substring(0, 30)}...`);
          }
        }
        
        if (hasUpdates) {
          updates.push({
            id: supabaseInv.id,
            updates: updateData
          });
          enhancedCount++;
        }
      }
      
      // Apply batch updates
      if (updates.length > 0) {
        console.log(`   💾 Applying ${updates.length} updates...`);
        
        const updatePromises = updates.map(({ id, updates }) =>
          supabase
            .from('invoices')
            .update(updates)
            .eq('id', id)
        );
        
        const results = await Promise.allSettled(updatePromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        
        console.log(`   ✅ Successfully updated ${successCount}/${updates.length} invoices`);
      }
      
      console.log(`   📊 Progress: ${processedCount}/${allSupabaseInvoices.length} processed, ${enhancedCount} enhanced`);
      console.log(`   🏷️ Brand matches: ${brandMatches}, 👤 Sales matches: ${salesMatches}, 📍 Address updates: ${addressUpdates}`);
      
      // Longer delay between batches
      if (i + batchSize < allSupabaseInvoices.length) {
        console.log('   ⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\\n🎉 Enhancement Complete!');
    console.log(`   📊 Total processed: ${processedCount}`);
    console.log(`   ✅ Total enhanced: ${enhancedCount}`);
    console.log(`   🏷️ Brand matches: ${brandMatches}`);
    console.log(`   👤 Sales matches: ${salesMatches}`);
    console.log(`   📍 Address updates: ${addressUpdates}`);
    
  } catch (error) {
    console.error('\\n❌ Enhancement failed:', error);
    throw error;
  }
}

// Run the enhancement
if (require.main === module) {
  enhanceInvoicesDetailed();
}