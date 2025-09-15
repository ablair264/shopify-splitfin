const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.migration') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const exportDir = path.join(__dirname, '../firebase-export');
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID;

// Helper to load Firebase data
function loadFirebaseData(collectionName) {
  try {
    const filePath = path.join(exportDir, `${collectionName}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading ${collectionName}:`, error.message);
    return [];
  }
}

// Helper to extract coordinates from Firebase data
function extractCoordinates(fbCustomer) {
  let coordinates = null;
  
  // Check main coordinates field
  if (fbCustomer.coordinates && typeof fbCustomer.coordinates === 'object') {
    const coords = fbCustomer.coordinates;
    if (coords.latitude && coords.longitude) {
      coordinates = {
        lat: parseFloat(coords.latitude),
        lng: parseFloat(coords.longitude)
      };
    } else if (coords.lat && coords.lng) {
      coordinates = {
        lat: parseFloat(coords.lat),
        lng: parseFloat(coords.lng)
      };
    }
  }
  
  // Check enrichment coordinates
  if (!coordinates && fbCustomer.enrichment && fbCustomer.enrichment.coordinates) {
    const coords = fbCustomer.enrichment.coordinates;
    if (coords.latitude && coords.longitude) {
      coordinates = {
        lat: parseFloat(coords.latitude),
        lng: parseFloat(coords.longitude)
      };
    } else if (coords.lat && coords.lng) {
      coordinates = {
        lat: parseFloat(coords.lat),
        lng: parseFloat(coords.lng)
      };
    }
  }
  
  return coordinates;
}

// Helper to safely get nested values
function safeGet(obj, path, defaultValue = null) {
  return path.split('.').reduce((current, key) => {
    return (current && current[key] !== undefined) ? current[key] : defaultValue;
  }, obj);
}

// Helper to clean phone numbers
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  return phone.toString().replace(/[^\d+\-\s()]/g, '').trim() || null;
}

// Helper to clean email addresses
function cleanEmail(email) {
  if (!email) return null;
  const cleaned = email.toString().trim().toLowerCase();
  if (cleaned.includes('@') && cleaned.includes('.')) {
    return cleaned;
  }
  return null;
}

// Helper to extract primary contact info
function extractPrimaryContact(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return {};
  
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
  
  return {
    first_name: primaryContact.first_name || '',
    last_name: primaryContact.last_name || '',
    email: cleanEmail(primaryContact.email),
    phone: cleanPhoneNumber(primaryContact.phone || primaryContact.mobile)
  };
}

// Helper to extract address information
function extractAddress(addressObj, type = 'billing') {
  if (!addressObj || typeof addressObj !== 'object') return {};
  
  return {
    [`${type}_address_1`]: addressObj.address || addressObj.street || addressObj.address_1 || null,
    [`${type}_address_2`]: addressObj.address_2 || addressObj.street2 || null,
    [`${type}_city_town`]: addressObj.city || null,
    [`${type}_county`]: addressObj.state || addressObj.county || null,
    [`${type}_postcode`]: addressObj.zip || addressObj.postcode || null,
    [`${type}_country`]: addressObj.country || 'UK'
  };
}

// Helper to convert Firebase timestamp
function convertFirebaseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString();
  }
  return null;
}

// Helper to determine customer segment
function determineSegment(fbCustomer) {
  const segment = safeGet(fbCustomer, 'segment') || safeGet(fbCustomer, 'enrichment.segment');
  if (segment) return segment;
  
  const orderCount = safeGet(fbCustomer, 'order_count', 0) || safeGet(fbCustomer, 'metrics.order_count', 0);
  const totalSpent = safeGet(fbCustomer, 'total_spent', 0) || safeGet(fbCustomer, 'metrics.total_spent', 0);
  
  if (orderCount === 0) return 'New';
  if (orderCount >= 10 || totalSpent >= 1000) return 'VIP';
  if (orderCount >= 5 || totalSpent >= 500) return 'Regular';
  return 'Occasional';
}

// Helper to extract comprehensive customer data
function extractCustomerData(fbCustomer) {
  const coordinates = extractCoordinates(fbCustomer);
  const primaryContact = extractPrimaryContact(fbCustomer.contacts);
  const billingAddress = extractAddress(fbCustomer.billing_address, 'billing');
  const shippingAddress = extractAddress(fbCustomer.shipping_address, 'shipping');
  
  // Use billing address as fallback for shipping if shipping is empty
  const finalShippingAddress = Object.keys(shippingAddress).some(key => shippingAddress[key]) 
    ? shippingAddress 
    : billingAddress;
  
  return {
    // Coordinates (as PostGIS point format for Supabase - lng,lat)
    coordinates: coordinates ? `(${coordinates.lng},${coordinates.lat})` : null,
    
    // Contact information
    phone: primaryContact.phone || cleanPhoneNumber(fbCustomer.phone),
    email: cleanEmail(fbCustomer.Primary_Email || fbCustomer.email || fbCustomer.auth_email || primaryContact.email),
    
    // Names
    display_name: fbCustomer.customer_name || fbCustomer.display_name || 
                 (primaryContact.first_name && primaryContact.last_name 
                   ? `${primaryContact.first_name} ${primaryContact.last_name}`.trim() 
                   : null),
    trading_name: safeGet(fbCustomer, 'billing_address.company_name') || fbCustomer.customer_name,
    
    // Addresses
    ...billingAddress,
    ...finalShippingAddress,
    
    // Financial information (only fields that exist in schema)
    currency_code: fbCustomer.currency_code || 'GBP',
    payment_terms: parseInt(safeGet(fbCustomer, 'financial.payment_terms', 30)) || 
                   parseInt(fbCustomer.payment_terms) || 30,
    
    // Customer metrics
    segment: determineSegment(fbCustomer),
    
    // Order and financial metrics (fields that exist in schema)
    order_count: parseInt(safeGet(fbCustomer, 'order_count', 0)) || 
                 parseInt(safeGet(fbCustomer, 'metrics.order_count', 0)) || 0,
    total_spent: parseFloat(safeGet(fbCustomer, 'total_spent', 0)) || 
                 parseFloat(safeGet(fbCustomer, 'metrics.total_spent', 0)) || 0,
    average_order_value: parseFloat(safeGet(fbCustomer, 'average_order_value', 0)) || 
                         parseFloat(safeGet(fbCustomer, 'metrics.average_order_value', 0)) || 0,
    total_paid: parseFloat(safeGet(fbCustomer, 'total_paid', 0)) || 
                parseFloat(safeGet(fbCustomer, 'metrics.total_paid', 0)) || 0,
    invoice_count: parseInt(safeGet(fbCustomer, 'invoice_count', 0)) || 
                   parseInt(safeGet(fbCustomer, 'metrics.invoice_count', 0)) || 0,
    outstanding_receivable_amount: parseFloat(safeGet(fbCustomer, 'outstanding_receivable_amount', 0)) || 
                                   parseFloat(safeGet(fbCustomer, 'financial.outstanding_amount', 0)) || 0,
    unused_credits_receivable_amount: parseFloat(safeGet(fbCustomer, 'unused_credits_receivable_amount', 0)) || 
                                      parseFloat(safeGet(fbCustomer, 'financial.unused_credits', 0)) || 0,
    payment_performance: parseFloat(safeGet(fbCustomer, 'payment_performance', 100)) || 
                        parseFloat(safeGet(fbCustomer, 'metrics.payment_performance', 100)) || 100,
    
    // Important dates
    first_order_date: convertFirebaseTimestamp(fbCustomer.first_order_date || safeGet(fbCustomer, 'metrics.first_order_date')),
    last_order_date: convertFirebaseTimestamp(fbCustomer.last_order_date || safeGet(fbCustomer, 'metrics.last_order_date')),
    
    // IDs for linking
    zoho_customer_id: fbCustomer.zoho_customer_id || fbCustomer.customer_id || null,
    
    // Status
    is_active: fbCustomer.status === 'active' || fbCustomer.is_active !== false,
    
    // Update timestamp
    last_modified: new Date().toISOString()
  };
}

// Helper to clean and normalize identifiers
function normalizeIdentifiers(fbCustomer) {
  return {
    fb_customer_id: fbCustomer.firebase_uid || fbCustomer.id || null,
    zoho_customer_id: fbCustomer.zoho_customer_id || fbCustomer.customer_id || null,
    primary_email: (fbCustomer.Primary_Email || fbCustomer.email || fbCustomer.auth_email || '').toLowerCase().trim() || null,
    customer_name: fbCustomer.customer_name || fbCustomer.display_name || null
  };
}

// Main function to update customer data comprehensively
async function updateCustomerData() {
  console.log('🔄 Updating comprehensive customer data from Firebase...\n');
  
  const firebaseCustomers = loadFirebaseData('customers');
  if (firebaseCustomers.length === 0) {
    console.log('   ⚠️  No customer data found in firebase-export/customers.json');
    console.log('   💡 Make sure you have exported customer data first');
    return;
  }
  
  console.log(`   📊 Found ${firebaseCustomers.length} customers in Firebase export`);
  
  // Get existing customers from Supabase
  const { data: supabaseCustomers, error: fetchError } = await supabase
    .from('customers')
    .select(`
      id, fb_customer_id, zoho_customer_id, email, display_name, 
      coordinates, phone, billing_postcode, billing_city_town, 
      segment, total_spent, order_count
    `)
    .eq('linked_company', DEFAULT_COMPANY_ID);
    
  if (fetchError) {
    console.error('   ❌ Error fetching Supabase customers:', fetchError);
    return;
  }
  
  console.log(`   📊 Found ${supabaseCustomers.length} existing customers in Supabase`);
  
  // Create maps for efficient lookup
  const supabaseByFbId = new Map();
  const supabaseByZohoId = new Map();
  const supabaseByEmail = new Map();
  const supabaseByName = new Map();
  
  supabaseCustomers.forEach(customer => {
    if (customer.fb_customer_id) {
      supabaseByFbId.set(customer.fb_customer_id, customer);
    }
    if (customer.zoho_customer_id) {
      supabaseByZohoId.set(customer.zoho_customer_id, customer);
    }
    if (customer.email) {
      supabaseByEmail.set(customer.email.toLowerCase().trim(), customer);
    }
    if (customer.display_name) {
      supabaseByName.set(customer.display_name.toLowerCase().trim(), customer);
    }
  });
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let noDataCount = 0;
  let alreadyCompleteCount = 0;
  
  const updateStats = {
    coordinates: 0,
    addresses: 0,
    contact_info: 0,
    financial_data: 0,
    metrics: 0,
    segments: 0
  };
  
  const batchSize = 50;
  
  for (let i = 0; i < firebaseCustomers.length; i += batchSize) {
    const batch = firebaseCustomers.slice(i, i + batchSize);
    
    for (const fbCustomer of batch) {
      try {
        // Extract comprehensive customer data
        const customerData = extractCustomerData(fbCustomer);
        const identifiers = normalizeIdentifiers(fbCustomer);
        
        // Find matching Supabase customer
        let supabaseCustomer = null;
        
        // Try matching by fb_customer_id first
        if (identifiers.fb_customer_id) {
          supabaseCustomer = supabaseByFbId.get(identifiers.fb_customer_id);
        }
        
        // Try matching by zoho_customer_id
        if (!supabaseCustomer && identifiers.zoho_customer_id) {
          supabaseCustomer = supabaseByZohoId.get(identifiers.zoho_customer_id);
        }
        
        // Try matching by email
        if (!supabaseCustomer && identifiers.primary_email) {
          supabaseCustomer = supabaseByEmail.get(identifiers.primary_email);
        }
        
        // Try matching by name as last resort
        if (!supabaseCustomer && identifiers.customer_name) {
          supabaseCustomer = supabaseByName.get(identifiers.customer_name.toLowerCase().trim());
        }
        
        if (!supabaseCustomer) {
          skippedCount++;
          continue;
        }
        
        // Build update object with only new/missing data
        const updateData = {};
        let hasUpdates = false;
        
        // Check coordinates
        if (customerData.coordinates && !supabaseCustomer.coordinates) {
          updateData.coordinates = customerData.coordinates;
          updateStats.coordinates++;
          hasUpdates = true;
        }
        
        // Check addresses
        if (customerData.billing_postcode && !supabaseCustomer.billing_postcode) {
          updateData.billing_postcode = customerData.billing_postcode;
          updateStats.addresses++;
          hasUpdates = true;
        }
        if (customerData.billing_city_town && !supabaseCustomer.billing_city_town) {
          updateData.billing_city_town = customerData.billing_city_town;
          hasUpdates = true;
        }
        
        // Check contact info
        if (customerData.phone && !supabaseCustomer.phone) {
          updateData.phone = customerData.phone;
          updateStats.contact_info++;
          hasUpdates = true;
        }
        
        // Check segments and regions
        if (customerData.segment && (!supabaseCustomer.segment || supabaseCustomer.segment === 'New')) {
          updateData.segment = customerData.segment;
          updateStats.segments++;
          hasUpdates = true;
        }
        // Note: location_region column doesn't exist in current schema
        // if (customerData.location_region && !supabaseCustomer.location_region) {
        //   updateData.location_region = customerData.location_region;
        //   hasUpdates = true;
        // }
        
        // Update financial metrics if they're higher/more recent
        if (customerData.total_spent > (supabaseCustomer.total_spent || 0)) {
          updateData.total_spent = customerData.total_spent;
          updateStats.financial_data++;
          hasUpdates = true;
        }
        if (customerData.order_count > (supabaseCustomer.order_count || 0)) {
          updateData.order_count = customerData.order_count;
          updateStats.metrics++;
          hasUpdates = true;
        }
        
        // Add other fields that exist in the actual schema
        const fieldsToCheck = [
          'email', 'trading_name', 'billing_address_1', 'billing_address_2', 
          'billing_county', 'shipping_address_1', 'shipping_city_town', 'shipping_postcode',
          'currency_code', 'payment_terms', 'average_order_value', 'payment_performance', 
          'first_order_date', 'last_order_date', 'zoho_customer_id'
        ];
        
        fieldsToCheck.forEach(field => {
          if (customerData[field] && !supabaseCustomer[field]) {
            updateData[field] = customerData[field];
            hasUpdates = true;
          }
        });
        
        if (!hasUpdates) {
          alreadyCompleteCount++;
          continue;
        }
        
        // Add last modified timestamp
        updateData.last_modified = new Date().toISOString();
        
        // Update customer with new data
        const { error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', supabaseCustomer.id);
          
        if (updateError) {
          console.error(`   ❌ Error updating customer ${supabaseCustomer.display_name}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
          const updateTypes = [];
          if (updateData.coordinates) updateTypes.push('coordinates');
          if (updateData.billing_postcode) updateTypes.push('address');
          if (updateData.phone) updateTypes.push('contact');
          if (updateData.segment) updateTypes.push('segment');
          if (updateData.total_spent) updateTypes.push('financial');
          
          console.log(`   ✅ Updated ${supabaseCustomer.display_name}: ${updateTypes.join(', ')}`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing customer:`, error.message);
        errorCount++;
      }
    }
    
    // Progress update
    if (i > 0 || batch.length === firebaseCustomers.length) {
      const processed = Math.min(i + batchSize, firebaseCustomers.length);
      console.log(`   🔄 Processed ${processed}/${firebaseCustomers.length} customers...`);
    }
  }
  
  console.log('\n📊 Customer Data Update Summary:');
  console.log(`   ✅ Successfully updated: ${updatedCount} customers`);
  console.log(`   📍 Added coordinates: ${updateStats.coordinates} customers`);
  console.log(`   🏠 Added addresses: ${updateStats.addresses} customers`);
  console.log(`   📱 Added contact info: ${updateStats.contact_info} customers`);
  console.log(`   💰 Updated financial data: ${updateStats.financial_data} customers`);
  console.log(`   📊 Updated metrics: ${updateStats.metrics} customers`);
  console.log(`   🎯 Updated segments: ${updateStats.segments} customers`);
  console.log(`   ✨ Already complete: ${alreadyCompleteCount} customers`);
  console.log(`   ❓ No match found: ${skippedCount} customers`);
  console.log(`   ❌ Errors: ${errorCount} customers`);
  
  if (updatedCount > 0) {
    console.log('\n🎉 Customer data update completed successfully!');
    console.log('🗺️  Google Maps, customer details, and analytics should now be much richer!');
  }
  
  return {
    updated: updatedCount,
    alreadyComplete: alreadyCompleteCount,
    noMatch: skippedCount,
    errors: errorCount,
    stats: updateStats
  };
}

// Enhanced customer data migration (for new customers)
async function migrateNewCustomers() {
  console.log('👥 Checking for new customers to migrate...\n');
  
  const firebaseCustomers = loadFirebaseData('customers');
  if (firebaseCustomers.length === 0) {
    console.log('   ⚠️  No customer data found');
    return;
  }
  
  // Get existing customers to avoid duplicates
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('fb_customer_id, zoho_customer_id, email')
    .eq('linked_company', DEFAULT_COMPANY_ID);
  
  const existingIds = new Set([
    ...existingCustomers?.map(c => c.fb_customer_id).filter(Boolean) || [],
    ...existingCustomers?.map(c => c.zoho_customer_id).filter(Boolean) || [],
    ...existingCustomers?.map(c => c.email).filter(Boolean) || []
  ]);
  
  const newCustomers = firebaseCustomers.filter(fbCustomer => {
    const identifiers = normalizeIdentifiers(fbCustomer);
    return !existingIds.has(identifiers.fb_customer_id) &&
           !existingIds.has(identifiers.zoho_customer_id) &&
           !existingIds.has(identifiers.primary_email);
  });
  
  if (newCustomers.length === 0) {
    console.log('   ✅ No new customers found to migrate');
    return;
  }
  
  console.log(`   📥 Found ${newCustomers.length} new customers to migrate`);
  
  // TODO: Add full customer migration logic here if needed
  // For now, just update coordinates for existing customers
  
  return newCustomers.length;
}

// Main execution function
async function runCoordinateUpdate() {
  console.log('🚀 Starting customer coordinate update...\n');
  
  try {
    const results = await updateCustomerData();
    await migrateNewCustomers();
    
    console.log('\n✅ Process completed successfully!');
    
    if (results && results.updated > 0) {
      console.log('\n💡 Next steps:');
      console.log('   🗺️  Test Google Maps in ViewOrder component');
      console.log('   📱 Check that customer locations display correctly');
    }
    
  } catch (error) {
    console.error('\n❌ Process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runCoordinateUpdate();
}

module.exports = {
  updateCustomerData,
  migrateNewCustomers
};