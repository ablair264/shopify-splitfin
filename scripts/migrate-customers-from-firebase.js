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

// Helper to safely get nested values
function safeGet(obj, path, defaultValue = null) {
  return path.split('.').reduce((current, key) => {
    return (current && current[key] !== undefined) ? current[key] : defaultValue;
  }, obj);
}

// Helper to clean and format phone numbers
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  return phone.toString().replace(/[^\d+\-\s()]/g, '').trim() || null;
}

// Helper to clean email addresses
function cleanEmail(email) {
  if (!email) return null;
  const cleaned = email.toString().trim().toLowerCase();
  // Basic email validation
  if (cleaned.includes('@') && cleaned.includes('.')) {
    return cleaned;
  }
  return null;
}

// Helper to extract primary contact info
function extractPrimaryContact(contacts) {
  if (!Array.isArray(contacts) || contacts.length === 0) return {};
  
  // Find primary contact or use first one
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
  
  return {
    first_name: primaryContact.first_name || '',
    last_name: primaryContact.last_name || '',
    email: cleanEmail(primaryContact.email),
    phone: cleanPhoneNumber(primaryContact.phone || primaryContact.mobile)
  };
}

// Helper to extract coordinates
function extractCoordinates(fbCustomer) {
  // Try multiple coordinate sources
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
  if (!coordinates && safeGet(fbCustomer, 'enrichment.coordinates')) {
    const coords = fbCustomer.enrichment.coordinates;
    if (coords.latitude && coords.longitude) {
      coordinates = {
        lat: parseFloat(coords.latitude),
        lng: parseFloat(coords.longitude)
      };
    }
  }
  
  return coordinates;
}

// Helper to extract address information
function extractAddress(addressObj, type = 'billing') {
  if (!addressObj || typeof addressObj !== 'object') return {};
  
  return {
    [`${type}_address_1`]: addressObj.address || addressObj.street || null,
    [`${type}_address_2`]: addressObj.address_2 || addressObj.street2 || null,
    [`${type}_city`]: addressObj.city || null,
    [`${type}_county`]: addressObj.state || addressObj.county || null,
    [`${type}_postcode`]: addressObj.zip || addressObj.postcode || null,
    [`${type}_country`]: addressObj.country || 'UK'
  };
}

// Helper to determine customer segment
function determineSegment(fbCustomer) {
  const segment = safeGet(fbCustomer, 'segment') || safeGet(fbCustomer, 'enrichment.segment');
  if (segment) return segment;
  
  // Determine based on order count and value
  const orderCount = safeGet(fbCustomer, 'order_count', 0) || safeGet(fbCustomer, 'metrics.order_count', 0);
  const totalSpent = safeGet(fbCustomer, 'total_spent', 0) || safeGet(fbCustomer, 'metrics.total_spent', 0);
  
  if (orderCount === 0) return 'New';
  if (orderCount >= 10 || totalSpent >= 1000) return 'VIP';
  if (orderCount >= 5 || totalSpent >= 500) return 'Regular';
  return 'Occasional';
}

// Main migration function
async function migrateCustomersFromFirebase() {
  console.log('👥 Migrating customers from Firebase...\n');
  
  const firebaseCustomers = loadFirebaseData('customers');
  if (firebaseCustomers.length === 0) {
    console.log('   ⚠️  No customer data found in Firebase export');
    return;
  }
  
  console.log(`   📊 Found ${firebaseCustomers.length} customers in Firebase`);
  
  // Get existing customers to avoid duplicates
  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('fb_customer_id, zoho_customer_id, primary_email')
    .eq('company_id', DEFAULT_COMPANY_ID);
  
  const existingIds = new Set([
    ...existingCustomers?.map(c => c.fb_customer_id).filter(Boolean) || [],
    ...existingCustomers?.map(c => c.zoho_customer_id).filter(Boolean) || [],
    ...existingCustomers?.map(c => c.primary_email).filter(Boolean) || []
  ]);
  
  const customersToInsert = [];
  const customersToUpdate = [];
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const fbCustomer of firebaseCustomers) {
    try {
      // Extract primary identifiers
      const fbId = fbCustomer.firebase_uid || fbCustomer.id;
      const zohoId = fbCustomer.zoho_customer_id || fbCustomer.customer_id;
      const primaryEmail = cleanEmail(fbCustomer.Primary_Email || fbCustomer.email || fbCustomer.auth_email);
      
      // Skip if no identifiers
      if (!fbId && !zohoId && !primaryEmail) {
        skippedCount++;
        continue;
      }
      
      // Check if customer already exists
      const customerExists = existingIds.has(fbId) || existingIds.has(zohoId) || existingIds.has(primaryEmail);
      
      // Extract contact information
      const primaryContact = extractPrimaryContact(fbCustomer.contacts);
      
      // Determine customer name
      let customerName = fbCustomer.customer_name || fbCustomer.display_name;
      if (!customerName && primaryContact.first_name && primaryContact.last_name) {
        customerName = `${primaryContact.first_name} ${primaryContact.last_name}`.trim();
      }
      if (!customerName) {
        customerName = safeGet(fbCustomer, 'billing_address.company_name') || 'Unknown Customer';
      }
      
      // Extract coordinates
      const coordinates = extractCoordinates(fbCustomer);
      
      // Extract addresses
      const billingAddress = extractAddress(fbCustomer.billing_address, 'billing');
      const shippingAddress = extractAddress(fbCustomer.shipping_address, 'shipping');
      
      // Use billing address as fallback for shipping if shipping is empty
      const finalShippingAddress = Object.keys(shippingAddress).some(key => shippingAddress[key]) 
        ? shippingAddress 
        : billingAddress;
      
      // Build customer object
      const customerData = {
        company_id: DEFAULT_COMPANY_ID,
        fb_customer_id: fbId || null,
        zoho_customer_id: zohoId || null,
        customer_name: customerName,
        display_name: customerName,
        trading_name: safeGet(fbCustomer, 'billing_address.company_name') || customerName,
        customer_type: fbCustomer.customer_type === 'business' ? 'business' : 'individual',
        customer_sub_type: fbCustomer.customer_sub_type || 'standard',
        
        // Contact information
        primary_email: primaryEmail,
        first_name: primaryContact.first_name || '',
        last_name: primaryContact.last_name || '',
        phone: primaryContact.phone || cleanPhoneNumber(fbCustomer.phone),
        mobile: cleanPhoneNumber(fbCustomer.mobile),
        
        // Addresses
        ...billingAddress,
        ...finalShippingAddress,
        formatted_address: fbCustomer.formatted_address || null,
        
        // Coordinates
        coordinates: coordinates ? JSON.stringify(coordinates) : null,
        
        // Financial information
        currency_code: fbCustomer.currency_code || 'GBP',
        credit_limit: parseFloat(safeGet(fbCustomer, 'financial.credit_limit', 0)),
        payment_terms: parseInt(safeGet(fbCustomer, 'financial.payment_terms', 30)),
        payment_terms_label: safeGet(fbCustomer, 'financial.payment_terms_label', 'Net 30'),
        tax_treatment: safeGet(fbCustomer, 'financial.tax_treatment', 'uk'),
        vat_number: safeGet(fbCustomer, 'financial.vat_number') || null,
        
        // Metrics and enrichment
        segment: determineSegment(fbCustomer),
        location_region: fbCustomer.location_region || safeGet(fbCustomer, 'enrichment.location_region'),
        sales_channel: fbCustomer.sales_channel || 'direct_sales',
        
        // Order metrics
        order_count: parseInt(safeGet(fbCustomer, 'order_count', 0)) || parseInt(safeGet(fbCustomer, 'metrics.order_count', 0)),
        total_spent: parseFloat(safeGet(fbCustomer, 'total_spent', 0)) || parseFloat(safeGet(fbCustomer, 'metrics.total_spent', 0)),
        average_order_value: parseFloat(safeGet(fbCustomer, 'average_order_value', 0)) || parseFloat(safeGet(fbCustomer, 'metrics.average_order_value', 0)),
        
        // Dates
        first_order_date: convertFirebaseTimestamp(fbCustomer.first_order_date || safeGet(fbCustomer, 'metrics.first_order_date')),
        last_order_date: convertFirebaseTimestamp(fbCustomer.last_order_date || safeGet(fbCustomer, 'metrics.last_order_date')),
        
        // Status and metadata
        is_active: fbCustomer.status === 'active',
        notes: fbCustomer.notes || null,
        website: fbCustomer.website || null,
        
        // Timestamps
        created_at: convertFirebaseTimestamp(fbCustomer.created_date || fbCustomer.created_time) || new Date().toISOString(),
        updated_at: convertFirebaseTimestamp(fbCustomer.last_modified || fbCustomer.last_modified_time) || new Date().toISOString()
      };
      
      if (customerExists) {
        customersToUpdate.push(customerData);
      } else {
        customersToInsert.push(customerData);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing customer ${fbCustomer.id || 'unknown'}:`, error.message);
      errorCount++;
    }
  }
  
  // Insert new customers
  if (customersToInsert.length > 0) {
    console.log(`   📥 Inserting ${customersToInsert.length} new customers...`);
    
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < customersToInsert.length; i += batchSize) {
      const batch = customersToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('customers')
        .insert(batch)
        .select('id');
        
      if (error) {
        console.error(`   ❌ Error inserting customer batch:`, error);
      } else {
        insertedCount += data.length;
      }
    }
    
    console.log(`   ✅ Successfully inserted ${insertedCount} customers`);
  }
  
  // Update existing customers (if needed)
  if (customersToUpdate.length > 0) {
    console.log(`   🔄 Found ${customersToUpdate.length} existing customers to potentially update`);
    // Note: Update logic would go here if needed
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Processed: ${firebaseCustomers.length} customers`);
  console.log(`   📥 Inserted: ${customersToInsert.length} new customers`);
  console.log(`   🔄 Existing: ${customersToUpdate.length} customers`);
  console.log(`   ⏭️  Skipped: ${skippedCount} customers (no identifiers)`);
  console.log(`   ❌ Errors: ${errorCount} customers`);
  
  return true;
}

// Enhanced brand insertion with better mapping
async function insertBrands() {
  console.log('🏷️  Checking/inserting brands...');
  
  // Check existing brands first
  const { data: existingBrands } = await supabase
    .from('brands')
    .select('brand_normalized')
    .eq('company_id', DEFAULT_COMPANY_ID);
    
  const existingBrandNames = new Set(existingBrands?.map(b => b.brand_normalized) || []);
  
  const brands = [
    { name: 'Blomus', normalized: 'blomus' },
    { name: 'Elvang', normalized: 'elvang' },
    { name: 'GEFU', normalized: 'gefu' },
    { name: 'Räder', normalized: 'rader' },
    { name: 'Remember', normalized: 'remember' },
    { name: 'Relaxound', normalized: 'relaxound' },
    { name: 'My Flame Lifestyle', normalized: 'my flame lifestyle' }
  ];
  
  const brandsToInsert = brands
    .filter(brand => !existingBrandNames.has(brand.normalized))
    .map(brand => ({
      brand_name: brand.name,
      brand_normalized: brand.normalized,
      company_id: DEFAULT_COMPANY_ID,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  
  if (brandsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('brands')
      .insert(brandsToInsert)
      .select();
      
    if (error) {
      console.error('   ❌ Error inserting brands:', error);
      return;
    }
    
    console.log(`   ✅ Inserted ${data.length} new brands`);
  } else {
    console.log('   ✅ All brands already exist');
  }
  
  return true;
}

// Update items with correct price mappings and manufacturer
async function updateItems() {
  console.log('📦 Updating items with correct prices and manufacturers...');
  
  const firebaseItems = loadFirebaseData('items_data');
  const { data: brands } = await supabase.from('brands').select('id, brand_normalized');
  const brandMap = new Map(brands.map(b => [b.brand_normalized, b.id]));
  
  // Get existing items to update
  const { data: existingItems } = await supabase
    .from('items')
    .select('id, legacy_item_id');
    
  const itemMap = new Map(existingItems.map(i => [i.legacy_item_id, i.id]));
  
  let updatedCount = 0;
  const batchSize = 100;
  
  for (let i = 0; i < firebaseItems.length; i += batchSize) {
    const batch = firebaseItems.slice(i, i + batchSize);
    
    for (const fbItem of batch) {
      const itemId = itemMap.get(fbItem.id);
      if (!itemId) continue;
      
      // Find matching brand - check multiple fields
      let manufacturer = fbItem.brand_normalized || fbItem.manufacturer || fbItem.Manufacturer || '';
      
      // Normalize brand variations
      manufacturer = manufacturer.toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/r-der/g, 'rader')
        .replace(/räder/g, 'rader')
        .replace(/my-flame-lifestyle/g, 'my flame lifestyle')
        .replace(/-/g, ' ')
        .trim();
      
      let brandId = null;
      if (manufacturer) {
        // Try exact match first
        brandId = brandMap.get(manufacturer);
        
        // If no exact match, try to find partial match
        if (!brandId) {
          for (const [brandName, id] of brandMap) {
            if (manufacturer.includes(brandName) || brandName.includes(manufacturer)) {
              brandId = id;
              break;
            }
          }
        }
      }
      
      const updateData = {
        manufacturer: manufacturer,
        brand_id: brandId,
        cost_price: parseFloat(fbItem.purchase_rate) || null,
        purchase_price: parseFloat(fbItem.selling_price) || null,
        retail_price: parseFloat(fbItem.rate) || parseFloat(fbItem.sales_rate) || null
      };
      
      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', itemId);
        
      if (!error) {
        updatedCount++;
      }
    }
    
    console.log(`   🔄 Updated ${updatedCount} items so far...`);
  }
  
  console.log(`   ✅ Updated ${updatedCount} items total`);
}

// Main function
async function runMigration() {
  console.log('🚀 Starting enhanced Firebase to Supabase migration...\n');
  
  try {
    await insertBrands();
    await migrateCustomersFromFirebase();
    await updateItems();
    
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = {
  migrateCustomersFromFirebase,
  insertBrands,
  updateItems
};