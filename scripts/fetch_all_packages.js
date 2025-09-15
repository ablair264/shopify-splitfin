const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });
require('dotenv').config({ path: '.env.zoho' });

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

// Get detailed package information
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
        timeout: 10000
      }
    );
    
    return response.data.package;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching package ${packageId}:`, error.message);
    return null;
  }
}

// Save data to JSON files
function saveToFile(data, filename) {
  const filePath = path.join(__dirname, 'scripts', 'data', filename);
  
  // Ensure data directory exists
  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`💾 Saved ${data.length} records to ${filename}`);
}

// Main function to fetch all packages
async function fetchAllPackagesFromZoho() {
  console.log('🚀 Fetching ALL packages from Zoho...\n');
  
  try {
    const startTime = Date.now();
    
    // 1. Fetch all packages (basic info)
    const packages = await fetchAllPackages();
    saveToFile(packages, 'packages_all_complete.json');
    
    // 2. Fetch detailed package information
    console.log('\n🔍 Fetching detailed package information...');
    const detailedPackages = [];
    
    for (let i = 0; i < packages.length; i++) {
      const packageItem = packages[i];
      console.log(`   📦 ${i + 1}/${packages.length}: Fetching details for ${packageItem.package_number}...`);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const detailed = await fetchPackageDetails(packageItem.package_id);
      
      if (detailed) {
        detailedPackages.push(detailed);
      }
      
      // Progress update every 10 packages
      if ((i + 1) % 10 === 0 || i === packages.length - 1) {
        console.log(`   📊 Progress: ${i + 1}/${packages.length} processed (${detailedPackages.length} successful)`);
      }
    }
    
    saveToFile(detailedPackages, 'packages_detailed_complete.json');
    
    // Summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 Package Fetch Complete!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`📦 Packages: ${packages.length} basic, ${detailedPackages.length} detailed`);
    console.log(`💾 All data saved to ./scripts/data/ directory`);
    
  } catch (error) {
    console.error('\n❌ Package fetch failed:', error);
    throw error;
  }
}

// Run the fetch
if (require.main === module) {
  fetchAllPackagesFromZoho();
}

module.exports = {
  fetchAllPackagesFromZoho,
  fetchAllPackages
};