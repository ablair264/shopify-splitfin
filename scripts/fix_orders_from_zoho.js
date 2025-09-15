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

async function fetchZohoSalesOrder(salesOrderId) {
  try {
    const token = await getZohoAccessToken();
    
    const response = await axios.get(
      `${ZOHO_CONFIG.baseUrls.inventory}/salesorders/${salesOrderId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'X-com-zoho-inventory-organizationid': ZOHO_CONFIG.orgId
        },
        timeout: 15000
      }
    );
    
    return response.data.salesorder;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching sales order ${salesOrderId}:`, error.message);
    return null;
  }
}

function mapZohoStatus(zohoStatus) {
  const statusMap = {
    'draft': 'draft',
    'open': 'confirmed',
    'confirmed': 'confirmed',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'closed': 'completed',
    'void': 'cancelled',
    'overdue': 'overdue'
  };
  
  return statusMap[zohoStatus?.toLowerCase()] || 'pending';
}

async function fixOrdersData() {
  console.log('🔧 Fixing orders data from Zoho...\n');
  
  try {
    // Get ALL orders with legacy_order_id (process everything)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, legacy_order_id, legacy_order_number, total, order_status')
      .eq('company_id', DM_BRANDS_ID)
      .not('legacy_order_id', 'is', null)
      .order('created_at', { ascending: false }); // Process newest first

    if (error) {
      console.error('❌ Error fetching orders:', error);
      return;
    }

    console.log(`📊 Found ${orders.length} orders to fix\n`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      if (!order.legacy_order_id) {
        console.log(`⏭️ Skipping order ${order.id.slice(0, 8)} - no legacy ID`);
        continue;
      }

      try {
        console.log(`🔍 Fetching Zoho data for order ${order.legacy_order_number || order.id.slice(0, 8)} (Zoho ID: ${order.legacy_order_id})`);
        
        const zohoOrder = await fetchZohoSalesOrder(order.legacy_order_id);
        
        if (!zohoOrder) {
          console.log(`   ⚠️ Order not found in Zoho`);
          continue;
        }

        // Calculate totals
        const subTotal = parseFloat(zohoOrder.sub_total || 0);
        const total = parseFloat(zohoOrder.total || 0);
        const status = mapZohoStatus(zohoOrder.status);
        const orderDate = zohoOrder.date || zohoOrder.created_time;

        // Find salesperson by zoho_sp_id
        let salespersonId = null;
        if (zohoOrder.salesperson_id) {
          const { data: salesperson } = await supabase
            .from('sales')
            .select('user_id')
            .eq('zoho_sp_id', zohoOrder.salesperson_id)
            .single();
          salespersonId = salesperson?.user_id || null;
        }

        // Update the order
        const updateData = {
          total: total,
          sub_total: subTotal,
          order_status: status,
          order_date: orderDate ? new Date(orderDate).toISOString() : null,
          updated_at: new Date().toISOString()
        };

        // Add salesperson if found
        if (salespersonId) {
          updateData.salesperson_id = salespersonId;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id);

        if (updateError) {
          console.error(`   ❌ Update failed:`, updateError.message);
          errorCount++;
        } else {
          const salespersonInfo = salespersonId ? `, salesperson: ${salespersonId.slice(0, 8)}` : '';
          console.log(`   ✅ Updated: £${total} total, status: ${status}${salespersonInfo}`);
          
          // Now process line items if the order update was successful
          if (zohoOrder.line_items && zohoOrder.line_items.length > 0) {
            console.log(`   📦 Processing ${zohoOrder.line_items.length} line items...`);
            
            // First, delete existing line items for this order to avoid duplicates
            await supabase
              .from('order_line_items')
              .delete()
              .eq('order_id', order.id);

            // Insert new line items
            for (const lineItem of zohoOrder.line_items) {
              try {
                // Try to find the item by legacy_item_id first, then by name/SKU
                let itemRecord = null;
                
                if (lineItem.item_id) {
                  const { data: itemByLegacyId } = await supabase
                    .from('items')
                    .select('id')
                    .eq('legacy_item_id', lineItem.item_id)
                    .single();
                  itemRecord = itemByLegacyId;
                }
                
                if (!itemRecord && lineItem.sku) {
                  const { data: itemBySku } = await supabase
                    .from('items')
                    .select('id')
                    .eq('sku', lineItem.sku)
                    .single();
                  itemRecord = itemBySku;
                }

                if (!itemRecord && lineItem.name) {
                  const { data: itemByName } = await supabase
                    .from('items')
                    .select('id')
                    .ilike('name', `%${lineItem.name}%`)
                    .limit(1)
                    .single();
                  itemRecord = itemByName;
                }

                // Insert line item (with or without matching item_id)
                const lineItemData = {
                  order_id: order.id,
                  item_id: itemRecord?.id || null,
                  item_name: lineItem.name || lineItem.description || 'Unknown Item',
                  item_sku: lineItem.sku || null,
                  legacy_item_id: lineItem.item_id || null,
                  quantity: parseInt(lineItem.quantity) || 1,
                  unit_price: parseFloat(lineItem.rate) || 0,
                  total_price: parseFloat(lineItem.item_total) || 0,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };

                const { error: lineItemError } = await supabase
                  .from('order_line_items')
                  .insert(lineItemData);

                if (lineItemError) {
                  console.error(`     ❌ Line item error: ${lineItemError.message}`);
                } else {
                  const matchStatus = itemRecord?.id ? '✅' : '⚠️';
                  console.log(`     ${matchStatus} Added line item: ${lineItem.name || 'Unknown'} (${lineItem.quantity}x £${lineItem.rate}) ${!itemRecord?.id ? '[No item match]' : ''}`);
                }
              } catch (lineItemErr) {
                console.error(`     ❌ Line item processing error: ${lineItemErr.message}`);
              }
            }
          }
          
          updatedCount++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300)); // Increased delay for line items

      } catch (error) {
        console.error(`   ❌ Error processing order:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n🎉 Fix complete!`);
    console.log(`✅ Updated: ${updatedCount} orders`);
    console.log(`❌ Errors: ${errorCount} orders`);

  } catch (error) {
    console.error('❌ Process failed:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixOrdersData();
}

module.exports = {
  fixOrdersData
};