const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
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

async function fetchAllZohoInvoices() {
  const invoices = [];
  let page = 1;
  const perPage = 200;
  let hasMorePages = true;

  console.log('🔍 Fetching all invoices from Zoho...\n');

  try {
    while (hasMorePages) {
      const token = await getZohoAccessToken();
      
      console.log(`📄 Fetching page ${page}...`);
      
      const response = await axios.get(
        `${ZOHO_CONFIG.baseUrls.inventory}/invoices`,
        {
          headers: {
            'Authorization': `Zoho-oauthtoken ${token}`,
            'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
          },
          params: {
            page: page,
            per_page: perPage
          },
          timeout: 30000
        }
      );
      
      const data = response.data;
      if (data.invoices && data.invoices.length > 0) {
        invoices.push(...data.invoices);
        console.log(`   ✅ Fetched ${data.invoices.length} invoices (Total: ${invoices.length})`);
        
        // Check if we have more pages
        if (data.invoices.length < perPage) {
          hasMorePages = false;
        } else {
          page++;
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        hasMorePages = false;
      }
    }

    console.log(`\n🎉 Total invoices fetched: ${invoices.length}\n`);
    return invoices;

  } catch (error) {
    console.error('Error fetching invoices:', error.message);
    throw error;
  }
}

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
        timeout: 15000
      }
    );
    
    return response.data.invoice;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching invoice details ${invoiceId}:`, error.message);
    return null;
  }
}

function mapZohoInvoiceStatus(zohoStatus) {
  const statusMap = {
    'draft': 'draft',
    'sent': 'sent', 
    'viewed': 'viewed',
    'partially_paid': 'partially_paid',
    'paid': 'paid',
    'overdue': 'overdue',
    'void': 'cancelled',
    'writeoff': 'written_off'
  };
  
  return statusMap[zohoStatus?.toLowerCase()] || 'draft';
}

async function importInvoices() {
  console.log('🧹 Starting invoice import from Zoho...\n');
  
  try {
    // Step 1: Clear existing invoices
    console.log('🗑️  Clearing existing invoices...');
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('company_id', DM_BRANDS_ID);

    if (deleteError) {
      console.error('❌ Error clearing invoices:', deleteError);
      return;
    }
    console.log('✅ Existing invoices cleared\n');

    // Step 2: Fetch all invoices from Zoho
    const zohoInvoices = await fetchAllZohoInvoices();
    
    if (zohoInvoices.length === 0) {
      console.log('⚠️  No invoices found in Zoho');
      return;
    }

    // Step 3: Process each invoice
    let importedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log('📋 Processing invoices...\n');

    for (const [index, zohoInvoice] of zohoInvoices.entries()) {
      try {
        console.log(`🔍 Processing invoice ${index + 1}/${zohoInvoices.length}: ${zohoInvoice.invoice_number || zohoInvoice.invoice_id}`);

        // Get detailed invoice information
        const detailedInvoice = await fetchInvoiceDetails(zohoInvoice.invoice_id);
        if (!detailedInvoice) {
          console.log('   ⚠️  Could not fetch detailed invoice data');
          skippedCount++;
          continue;
        }

        // Find matching customer by fb_customer_id
        let customerId = null;
        if (detailedInvoice.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('fb_customer_id', detailedInvoice.customer_id)
            .eq('linked_company', DM_BRANDS_ID)
            .single();
          customerId = customer?.id || null;
        }

        // Find matching order by legacy_order_id
        let orderId = null;
        if (detailedInvoice.salesorder_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('legacy_order_id', detailedInvoice.salesorder_id)
            .eq('company_id', DM_BRANDS_ID)
            .single();
          orderId = order?.id || null;
        }

        // Find salesperson by zoho_sp_id
        let salespersonId = null;
        if (detailedInvoice.salesperson_id) {
          const { data: salesperson } = await supabase
            .from('sales')
            .select('user_id')
            .eq('zoho_sp_id', detailedInvoice.salesperson_id)
            .single();
          salespersonId = salesperson?.user_id || null;
        }

        // Prepare invoice data
        const invoiceData = {
          company_id: DM_BRANDS_ID,
          customer_id: customerId,
          order_id: orderId,
          salesperson_id: salespersonId,
          invoice_number: detailedInvoice.invoice_number || null,
          legacy_invoice_id: detailedInvoice.invoice_id,
          invoice_date: detailedInvoice.date ? new Date(detailedInvoice.date).toISOString() : null,
          due_date: detailedInvoice.due_date ? new Date(detailedInvoice.due_date).toISOString() : null,
          invoice_status: mapZohoInvoiceStatus(detailedInvoice.status),
          sub_total: parseFloat(detailedInvoice.sub_total || 0),
          tax_total: parseFloat(detailedInvoice.tax_total || 0),
          total: parseFloat(detailedInvoice.total || 0),
          balance: parseFloat(detailedInvoice.balance || 0),
          payment_made: parseFloat(detailedInvoice.payment_made || 0),
          currency_code: detailedInvoice.currency_code || 'GBP',
          
          // Reminder information
          reminder_count: parseInt(detailedInvoice.reminder_count || 0),
          last_reminder_date: detailedInvoice.last_reminder_sent_date ? 
            new Date(detailedInvoice.last_reminder_sent_date).toISOString() : null,
          
          // Payment terms and notes
          payment_terms: detailedInvoice.payment_terms || null,
          notes: detailedInvoice.notes || null,
          terms: detailedInvoice.terms || null,
          
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Insert the invoice
        const { error: insertError } = await supabase
          .from('invoices')
          .insert(invoiceData);

        if (insertError) {
          console.error(`   ❌ Insert failed: ${insertError.message}`);
          errorCount++;
        } else {
          const customerInfo = customerId ? ` (Customer: ${customerId.slice(0, 8)})` : ' (No customer match)';
          const orderInfo = orderId ? ` (Order: ${orderId.slice(0, 8)})` : ' (No order match)';
          console.log(`   ✅ Imported: ${detailedInvoice.invoice_number} - £${detailedInvoice.total}${customerInfo}${orderInfo}`);
          importedCount++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`   ❌ Error processing invoice:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`✅ Imported: ${importedCount} invoices`);
    console.log(`⚠️  Skipped: ${skippedCount} invoices`);
    console.log(`❌ Errors: ${errorCount} invoices`);

  } catch (error) {
    console.error('❌ Import process failed:', error);
    throw error;
  }
}

// Run the import
if (require.main === module) {
  importInvoices();
}

module.exports = {
  importInvoices
};