const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.migration') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID;

// Google Maps API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';

// Delay function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Parse PostGIS point format
function parseCoordinates(coordStr) {
  if (!coordStr) return null;
  
  try {
    // Handle PostGIS point format: "(lng,lat)"
    if (coordStr.startsWith('(') && coordStr.endsWith(')')) {
      const parts = coordStr.slice(1, -1).split(',');
      if (parts.length === 2) {
        return {
          lat: parseFloat(parts[1]), // Second value is latitude
          lng: parseFloat(parts[0])  // First value is longitude
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing coordinates:', coordStr, error);
    return null;
  }
}

// Enhanced reverse geocode to get better address data
async function reverseGeocode(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&region=gb&language=en`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Try to find the most specific result
      const streetResult = data.results.find(r => r.types.includes('street_address')) || 
                          data.results.find(r => r.types.includes('route')) ||
                          data.results[0];
      
      const components = streetResult.address_components;
      
      // Extract address components more thoroughly
      const address = {
        street_number: '',
        route: '',
        locality: '',
        postal_town: '',
        administrative_area_level_2: '',
        administrative_area_level_1: '',
        postal_code: '',
        country: ''
      };
      
      components.forEach(component => {
        const types = component.types;
        if (types.includes('street_number')) address.street_number = component.long_name;
        if (types.includes('route')) address.route = component.long_name;
        if (types.includes('locality')) address.locality = component.long_name;
        if (types.includes('postal_town')) address.postal_town = component.long_name;
        if (types.includes('administrative_area_level_2')) address.administrative_area_level_2 = component.long_name;
        if (types.includes('administrative_area_level_1')) address.administrative_area_level_1 = component.long_name;
        if (types.includes('postal_code')) address.postal_code = component.long_name;
        if (types.includes('country')) address.country = component.short_name;
      });
      
      // Build formatted address with fallbacks
      let address_1 = '';
      if (address.street_number && address.route) {
        address_1 = `${address.street_number} ${address.route}`;
      } else if (address.route) {
        address_1 = address.route;
      } else {
        // Extract first part of formatted address as fallback
        const parts = streetResult.formatted_address.split(',');
        address_1 = parts[0] || '';
      }
      
      const city = address.postal_town || address.locality || address.administrative_area_level_1 || '';
      const county = address.administrative_area_level_2 || address.administrative_area_level_1 || '';
      
      return {
        billing_address_1: address_1.trim(),
        billing_city_town: city.trim(),
        billing_county: county.trim(),
        billing_postcode: address.postal_code.trim(),
        shipping_address_1: address_1.trim(),
        shipping_city_town: city.trim(),
        shipping_county: county.trim(),
        shipping_postcode: address.postal_code.trim(),
        formatted_address: streetResult.formatted_address
      };
    }
    
    console.log('   ⚠️  Google Maps API returned:', data.status);
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Main function
async function processRemainingCustomers() {
  console.log('🚀 Processing remaining customers with coordinates but no addresses...\n');
  
  // Get customers with coordinates but no address
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('linked_company', DEFAULT_COMPANY_ID)
    .not('coordinates', 'is', null)
    .or('billing_address_1.is.null,billing_address_1.eq.')
    .order('display_name');
    
  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }
  
  console.log(`📊 Found ${customers.length} customers with coordinates but no address\n`);
  
  let successCount = 0;
  let partialCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const coords = parseCoordinates(customer.coordinates);
    
    if (!coords) {
      console.log(`[${i + 1}/${customers.length}] ❌ ${customer.display_name} - Invalid coordinates`);
      errorCount++;
      continue;
    }
    
    console.log(`[${i + 1}/${customers.length}] Processing ${customer.display_name}...`);
    console.log(`   📍 Coordinates: ${coords.lat}, ${coords.lng}`);
    
    const addressData = await reverseGeocode(coords.lat, coords.lng);
    
    if (addressData && addressData.billing_address_1) {
      console.log(`   ✅ Found address: ${addressData.billing_address_1}, ${addressData.billing_city_town} ${addressData.billing_postcode}`);
      
      // Only update empty fields
      const updateData = {};
      if (!customer.billing_address_1) updateData.billing_address_1 = addressData.billing_address_1;
      if (!customer.billing_city_town) updateData.billing_city_town = addressData.billing_city_town;
      if (!customer.billing_county) updateData.billing_county = addressData.billing_county;
      if (!customer.billing_postcode) updateData.billing_postcode = addressData.billing_postcode;
      
      if (!customer.shipping_address_1) updateData.shipping_address_1 = addressData.shipping_address_1;
      if (!customer.shipping_city_town) updateData.shipping_city_town = addressData.shipping_city_town;
      if (!customer.shipping_county) updateData.shipping_county = addressData.shipping_county;
      if (!customer.shipping_postcode) updateData.shipping_postcode = addressData.shipping_postcode;
      
      updateData.last_modified = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', customer.id);
        
      if (updateError) {
        console.error(`   ❌ Update error:`, updateError);
        errorCount++;
      } else {
        successCount++;
      }
    } else if (addressData) {
      console.log(`   ⚠️  Partial address found:`, JSON.stringify(addressData));
      partialCount++;
    } else {
      console.log(`   ❌ Could not find address`);
      errorCount++;
    }
    
    // Rate limit
    await delay(200); // Slower rate to ensure better results
  }
  
  console.log(`\n📊 Processing complete:`);
  console.log(`   ✅ Successfully updated: ${successCount}`);
  console.log(`   ⚠️  Partial addresses: ${partialCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  // List any remaining customers without addresses
  const { data: remaining } = await supabase
    .from('customers')
    .select('display_name, coordinates')
    .eq('linked_company', DEFAULT_COMPANY_ID)
    .not('coordinates', 'is', null)
    .or('billing_address_1.is.null,billing_address_1.eq.')
    .order('display_name');
    
  if (remaining && remaining.length > 0) {
    console.log(`\n⚠️  Still ${remaining.length} customers without addresses:`);
    remaining.forEach(c => {
      console.log(`   - ${c.display_name}: ${c.coordinates}`);
    });
  }
}

// Run the script
if (require.main === module) {
  processRemainingCustomers()
    .then(() => {
      console.log('\n✅ Script completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processRemainingCustomers };