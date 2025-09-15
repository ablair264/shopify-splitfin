const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });
require('dotenv').config({ path: '.env.zoho' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// Date filter - September 1st, 2025 to present
const DATE_START = '2025-09-01';
const DATE_END = new Date().toISOString().split('T')[0]; // Today's date (2025-09-14)

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


// Fetch items created since Sept 1st from Zoho
async function fetchAllItems() {
  const allItems = [];
  let page = 1;
  const perPage = 200;
  
  console.log(`📦 Fetching Zoho items created from ${DATE_START} to ${DATE_END}...`);

  while (true) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/items`,
        {
          params: {
            page,
            per_page: perPage,
            sort_column: 'created_time',
            sort_order: 'D',
            created_date_start: DATE_START,
            created_date_end: DATE_END
          },
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          }
        }
      );

      const items = response.data.items || [];
      
      if (items.length === 0) {
        break;
      }
      
      // Filter by created_time as additional safety check
      const filteredItems = items.filter(item => {
        if (!item.created_time) return true; // Keep if no created_time
        const createdDate = new Date(item.created_time).toISOString().split('T')[0];
        return createdDate >= DATE_START && createdDate <= DATE_END;
      });
      
      allItems.push(...filteredItems);
      console.log(`   📦 Page ${page}: ${items.length} items fetched, ${filteredItems.length} match date filter (total: ${allItems.length})`);
      
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error fetching items page ${page}:`, error.message);
      if (error.response?.status === 429) {
        console.log('Rate limited, waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      break;
    }
  }

  return allItems;
}

// Fetch all invoices from Zoho since Sept 1st
async function fetchAllInvoices() {
  const allInvoices = [];
  let page = 1;
  const perPage = 200;
  
  console.log('📄 Fetching Zoho invoices from ${DATE_START} to ${DATE_END}...');

  while (true) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/invoices`,
        {
          params: {
            page,
            per_page: perPage,
            sort_column: 'date',
            sort_order: 'D',
            date_start: DATE_START,
            date_end: DATE_END
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
      
      allInvoices.push(...invoices);
      console.log(`   📄 Page ${page}: ${invoices.length} invoices (total: ${allInvoices.length})`);
      
      const hasMore = response.data.page_context?.has_more_page;
      if (!hasMore) {
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error fetching invoices page ${page}:`, error.message);
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

// Fetch detailed invoice with line items
async function fetchInvoiceDetails(invoiceId) {
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
      return null;
    }
    console.error(`Error fetching invoice ${invoiceId}:`, error.message);
    return null;
  }
}

// Fetch all packages from Zoho since Sept 1st
async function fetchAllPackages() {
  const allPackages = [];
  let page = 1;
  const perPage = 200;
  
  console.log('📦 Fetching Zoho packages from ${DATE_START} to ${DATE_END}...');

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
            sort_order: 'D',
            date_start: DATE_START,
            date_end: DATE_END
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

// Save data to JSON files
function saveToFile(data, filename) {
  const filePath = path.join(__dirname, 'data', filename);
  
  // Ensure data directory exists
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`💾 Saved ${data.length} records to ${filename}`);
}

// Main function to fetch all data
async function fetchAllDataSinceSeptember1st() {
  console.log(`🚀 Fetching all Zoho data from ${DATE_START} to ${DATE_END}...\n`);
  
  try {
    const startTime = Date.now();
    
    // 1. Fetch items created since Sept 1st
    const items = await fetchAllItems();
    saveToFile(items, 'items_created_sept1.json');
    
    // 2. Fetch all invoices (basic info first)
    const invoices = await fetchAllInvoices();
    saveToFile(invoices, 'invoices_basic.json');
    
    // 3. Fetch detailed invoices with line items
    console.log('\n🔍 Fetching detailed invoices with line items...');
    const detailedInvoices = [];
    
    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      console.log(`   📄 ${i + 1}/${invoices.length}: Fetching details for ${invoice.invoice_number}...`);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const detailed = await fetchInvoiceDetails(invoice.invoice_id);
      
      if (detailed) {
        detailedInvoices.push(detailed);
      }
      
      // Progress update every 10 invoices
      if ((i + 1) % 10 === 0 || i === invoices.length - 1) {
        console.log(`   📊 Progress: ${i + 1}/${invoices.length} processed (${detailedInvoices.length} successful)`);
      }
    }
    
    saveToFile(detailedInvoices, 'invoices_detailed.json');
    
    // 4. Fetch all packages
    const packages = await fetchAllPackages();
    saveToFile(packages, 'packages_all.json');
    
    // Summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 Data Fetch Complete!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`📦 Items (created): ${items.length}`);
    console.log(`📄 Invoices: ${invoices.length} basic, ${detailedInvoices.length} detailed`);
    console.log(`📦 Packages: ${packages.length}`);
    console.log(`💾 All data saved to ./data/ directory`);
    
    // Create summary file
    const summary = {
      fetchDate: new Date().toISOString(),
      dateRange: { start: DATE_START, end: DATE_END },
      duration: duration,
      counts: {
        items: items.length,
        invoices: { basic: invoices.length, detailed: detailedInvoices.length },
        packages: packages.length
      }
    };
    
    saveToFile([summary], 'fetch_summary.json');
    
  } catch (error) {
    console.error('\n❌ Data fetch failed:', error);
    throw error;
  }
}

// Run the fetch
if (require.main === module) {
  fetchAllDataSinceSeptember1st();
}

module.exports = {
  fetchAllDataSinceSeptember1st,
  fetchAllItems,
  fetchAllInvoices,
  fetchAllPackages
};