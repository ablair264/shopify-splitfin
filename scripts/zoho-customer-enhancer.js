const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.zoho') });

// Use the hardcoded Supabase values from supabaseService.ts
const supabaseUrl = 'https://dcgagukbbzfqaymlxnzw.supabase.co';
// For scripts, we need the service role key - you'll need to provide this
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
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

// Fetch individual contact details from Zoho
async function fetchZohoContact(contactId) {
  try {
    const token = await getZohoAccessToken();
    
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/contacts/${contactId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        },
        timeout: 30000
      }
    );
    
    return response.data.contact;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`   ⚠️ Contact ${contactId} not found in Zoho`);
      return null;
    }
    console.error(`   ❌ Failed to fetch contact ${contactId}:`, error.message);
    return null;
  }
}

// Fetch all contacts from Zoho with pagination
async function fetchAllZohoContacts() {
  const allContacts = [];
  let page = 1;
  const perPage = 200;
  const maxPages = 100; // Safety limit

  console.log('🌐 Fetching all contacts from Zoho...');

  while (page <= maxPages) {
    try {
      const token = await getZohoAccessToken();
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/contacts`,
        {
          params: {
            page,
            per_page: perPage
          },
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          },
          timeout: 30000
        }
      );

      const contacts = response.data.contacts || [];
      
      if (contacts.length === 0) {
        console.log(`   📄 No more contacts on page ${page}`);
        break;
      }
      
      allContacts.push(...contacts);
      console.log(`   📄 Fetched page ${page}: ${contacts.length} contacts (total: ${allContacts.length})`);
      
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

  return allContacts;
}

// Main function to enhance customers
async function enhanceCustomersFromZoho() {
  console.log('🚀 Enhancing customers with Zoho contact data...\n');
  
  try {
    // Get ALL Supabase customers first
    console.log('📄 Fetching ALL customers from Supabase...');
    
    let allCustomers = [];
    let start = 0;
    const limit = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id, fb_customer_id, display_name, trading_name, email, billing_address_1, shipping_address_1')
        .eq('linked_company', DM_BRANDS_ID)
        .range(start, start + limit - 1);
        
      if (error) {
        console.error('   ❌ Supabase error:', error);
        break;
      }
      
      if (!data || data.length === 0) break;
      allCustomers.push(...data);
      if (data.length < limit) break;
      start += limit;
    }
    
    console.log(`   📊 Found ${allCustomers.length} customers total`);
    
    // Filter customers that need enhancement and have a fb_customer_id (Zoho contact ID)
    const customersToEnhance = allCustomers.filter(customer => 
      customer.fb_customer_id && ( // Must have Zoho contact ID
        !customer.email || 
        !customer.billing_address_1 || customer.billing_address_1 === '' || 
        !customer.shipping_address_1 || customer.shipping_address_1 === ''
      )
    );
    
    console.log(`   🔧 ${customersToEnhance.length} customers need enhancement:`);
    console.log(`      📧 Missing email: ${allCustomers.filter(c => !c.email).length}`);
    console.log(`      🏠 Missing billing address: ${allCustomers.filter(c => !c.billing_address_1 || c.billing_address_1 === '').length}`);
    console.log(`      📦 Missing shipping address: ${allCustomers.filter(c => !c.shipping_address_1 || c.shipping_address_1 === '').length}`);
    
    if (customersToEnhance.length === 0) {
      console.log('   ✅ All customers already enhanced!');
      return;
    }
    
    // No need to fetch all contacts - we already have the Zoho contact IDs!
    console.log('\n🔧 Using existing fb_customer_id values as Zoho contact IDs...');
    console.log(`   📊 Found ${customersToEnhance.length} customers with Zoho contact IDs to enhance`);
    
    // Process enhancements using matched contacts
    console.log('\n🔧 Processing customer enhancements...');
    
    let enhanced = 0;
    let emailUpdates = 0;
    let billingUpdates = 0;
    let shippingUpdates = 0;
    const updateBatchSize = 20;
    
    for (let i = 0; i < customersToEnhance.length; i += updateBatchSize) {
      const batch = customersToEnhance.slice(i, i + updateBatchSize);
      const updates = [];
      
      for (const supabaseCustomer of batch) {
        console.log(`   🔍 Processing: ${supabaseCustomer.display_name} (Zoho ID: ${supabaseCustomer.fb_customer_id})`);
        
        const updateData = {};
        let hasUpdates = false;
        
        // Fetch full contact details from Zoho using fb_customer_id
        console.log(`   🔍 Fetching full details for Zoho contact ${supabaseCustomer.fb_customer_id}...`);
        const fullZohoContact = await fetchZohoContact(supabaseCustomer.fb_customer_id);
        
        if (!fullZohoContact) {
          console.log(`   ⚠️ Could not fetch full details for contact ${supabaseCustomer.fb_customer_id}`);
          continue;
        }
        
        // Extract email
        if (!supabaseCustomer.email && fullZohoContact.email) {
          updateData.email = fullZohoContact.email;
          emailUpdates++;
          hasUpdates = true;
        }
        
        // Extract billing address
        if ((!supabaseCustomer.billing_address_1 || supabaseCustomer.billing_address_1 === '') && fullZohoContact.billing_address) {
          const billing = fullZohoContact.billing_address;
          if (billing.address) {
            updateData.billing_address_1 = billing.address;
            updateData.billing_address_2 = billing.street2 || null;
            updateData.billing_city_town = billing.city || null;
            updateData.billing_county = billing.state || null;
            updateData.billing_postcode = billing.zip || null;
            billingUpdates++;
            hasUpdates = true;
          }
        }
        
        // Extract shipping address
        if ((!supabaseCustomer.shipping_address_1 || supabaseCustomer.shipping_address_1 === '') && fullZohoContact.shipping_address) {
          const shipping = fullZohoContact.shipping_address;
          if (shipping.address) {
            updateData.shipping_address_1 = shipping.address;
            updateData.shipping_address_2 = shipping.street2 || null;
            updateData.shipping_city_town = shipping.city || null;
            updateData.shipping_county = shipping.state || null;
            updateData.shipping_postcode = shipping.zip || null;
            shippingUpdates++;
            hasUpdates = true;
          }
        }
        
        // Also try to extract additional useful data
        if (fullZohoContact.contact_name && !updateData.display_name) {
          // Only update display_name if it's significantly different or empty
          if (!supabaseCustomer.display_name || supabaseCustomer.display_name.length < 3) {
            updateData.display_name = fullZohoContact.contact_name;
            hasUpdates = true;
          }
        }
        
        if (fullZohoContact.company_name && !updateData.trading_name) {
          // Only update trading_name if it's significantly different or empty  
          if (!supabaseCustomer.trading_name || supabaseCustomer.trading_name.length < 3) {
            updateData.trading_name = fullZohoContact.company_name;
            hasUpdates = true;
          }
        }
        
        if (hasUpdates) {
          updates.push({
            id: supabaseCustomer.id,
            updates: updateData,
            zoho_id: supabaseCustomer.fb_customer_id
          });
        }
      }
      
      // Apply updates
      const updatePromises = updates.map(({ id, updates }) =>
        supabase
          .from('customers')
          .update(updates)
          .eq('id', id)
      );
      
      const results = await Promise.allSettled(updatePromises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      enhanced += successCount;
      
      // Log some examples of what we're updating
      if (updates.length > 0) {
        console.log(`   ✅ Batch ${Math.floor(i/updateBatchSize) + 1}: enhanced ${successCount} customers`);
        console.log(`      📧 Email updates so far: ${emailUpdates}`);
        console.log(`      🏠 Billing address updates so far: ${billingUpdates}`);
        console.log(`      📦 Shipping address updates so far: ${shippingUpdates}`);
        
        // Show example of update
        if (updates.length > 0) {
          const example = updates[0];
          console.log(`      📝 Example update for Zoho ID ${example.zoho_id}:`);
          Object.keys(example.updates).forEach(key => {
            const value = example.updates[key];
            if (typeof value === 'string' && value.length > 50) {
              console.log(`         ${key}: ${value.substring(0, 50)}...`);
            } else {
              console.log(`         ${key}: ${value}`);
            }
          });
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 Customer Enhancement Results:');
    console.log(`   ✅ Total customers enhanced: ${enhanced}`);
    console.log(`   📧 Email addresses added: ${emailUpdates}`);
    console.log(`   🏠 Billing addresses added: ${billingUpdates}`);
    console.log(`   📦 Shipping addresses added: ${shippingUpdates}`);
    
    // Final verification
    console.log('\n🔍 Final Verification:');
    
    const { count: withEmails } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('linked_company', DM_BRANDS_ID)
      .not('email', 'is', null);
      
    const { count: withBilling } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('linked_company', DM_BRANDS_ID)
      .not('billing_address_1', 'is', null);
      
    const { count: withShipping } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('linked_company', DM_BRANDS_ID)
      .not('shipping_address_1', 'is', null);
    
    console.log(`   📧 Customers with emails: ${withEmails || 0}`);
    console.log(`   🏠 Customers with billing addresses: ${withBilling || 0}`);
    console.log(`   📦 Customers with shipping addresses: ${withShipping || 0}`);
    
  } catch (error) {
    console.error('\n❌ Enhancement failed:', error);
    
    if (error.message.includes('refresh_token')) {
      console.log('\n⚠️  Please update your Zoho refresh token in .env.zoho');
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
    
    // Test with a simple contacts API call
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/contacts`,
      {
        params: { per_page: 1 },
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        }
      }
    );
    
    console.log('   ✅ Contacts API connection successful');
    console.log(`   📊 Found ${response.data.page_context?.total || 'some'} contacts in Zoho`);
    return true;
    
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
  console.log('🌐 Zoho Customer Enhancement Tool\n');
  
  // Check environment variables
  const requiredVars = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID'];
  const missingVars = requiredVars.filter(v => !process.env[v] || process.env[v] === 'your_zoho_' + v.toLowerCase());
  
  if (missingVars.length > 0) {
    console.error('❌ Missing Zoho environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.log('\nPlease update the .env.zoho file with your Zoho credentials');
    return;
  }
  
  // Test connection first
  const connectionOk = await testZohoConnection();
  if (!connectionOk) {
    console.log('\n❌ Cannot proceed without valid Zoho connection');
    return;
  }
  
  // Run enhancement
  await enhanceCustomersFromZoho();
  
  console.log('\n🎉 Customer enhancement completed!');
}

if (require.main === module) {
  main();
}

module.exports = {
  enhanceCustomersFromZoho,
  testZohoConnection
};