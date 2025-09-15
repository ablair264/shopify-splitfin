const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.migration') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID;

// Google Maps API key (same one that works in CustomerMap component)
const GOOGLE_MAPS_API_KEY = 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';

// Delay function to respect API rate limits
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

// Check if coordinates are likely wrong (UK customers should be roughly 49-61°N, -8-2°E)
function areCoordinatesLikelyWrong(lat, lng) {
  // UK bounds (very rough)
  const UK_LAT_MIN = 49.0;
  const UK_LAT_MAX = 61.0;
  const UK_LNG_MIN = -8.0;
  const UK_LNG_MAX = 2.0;
  
  return lat < UK_LAT_MIN || lat > UK_LAT_MAX || lng < UK_LNG_MIN || lng > UK_LNG_MAX;
}

// Fix coordinates that are clearly wrong (swap lat/lng if needed)
function tryFixCoordinates(coordStr) {
  const coords = parseCoordinates(coordStr);
  if (!coords) return null;
  
  // If coordinates seem wrong, try swapping them
  if (areCoordinatesLikelyWrong(coords.lat, coords.lng)) {
    const swappedLat = coords.lng;
    const swappedLng = coords.lat;
    
    // Check if swapping makes them more reasonable
    if (!areCoordinatesLikelyWrong(swappedLat, swappedLng)) {
      console.log(`   🔄 Swapping coordinates: (${coords.lat}, ${coords.lng}) → (${swappedLat}, ${swappedLng})`);
      return {
        lat: swappedLat,
        lng: swappedLng,
        wasSwapped: true
      };
    }
  }
  
  return { ...coords, wasSwapped: false };
}

// Reverse geocode coordinates to get address
async function reverseGeocode(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&region=gb`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components;
      
      // Extract address components
      const address = {
        street_number: '',
        route: '',
        locality: '',
        postal_town: '',
        administrative_area_level_2: '', // County
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
        if (types.includes('postal_code')) address.postal_code = component.long_name;
        if (types.includes('country')) address.country = component.short_name;
      });
      
      // Build formatted address
      const address_1 = address.street_number ? `${address.street_number} ${address.route}`.trim() : address.route;
      const city = address.postal_town || address.locality || '';
      
      return {
        billing_address_1: address_1 || result.formatted_address.split(',')[0] || '',
        billing_city_town: city,
        billing_county: address.administrative_area_level_2,
        billing_postcode: address.postal_code,
        // Assume shipping same as billing if empty
        shipping_address_1: address_1 || result.formatted_address.split(',')[0] || '',
        shipping_city_town: city,
        shipping_county: address.administrative_area_level_2,
        shipping_postcode: address.postal_code,
        formatted_address: result.formatted_address
      };
    }
    
    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

// Forward geocode address to get coordinates
async function forwardGeocode(address) {
  const addressString = [
    address.address_1,
    address.address_2,
    address.city_town,
    address.postcode,
    'UK'
  ].filter(Boolean).join(', ');
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&key=${GOOGLE_MAPS_API_KEY}&region=gb`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    
    return null;
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return null;
  }
}

// Fix existing wrong coordinates in the database
async function fixWrongCoordinates() {
  console.log('🔧 Checking for wrong coordinates to fix...\n');
  
  // Get all customers with coordinates
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('linked_company', DEFAULT_COMPANY_ID)
    .not('coordinates', 'is', null)
    .order('display_name');
    
  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }
  
  console.log(`🔍 Checking ${customers.length} customers with coordinates...\n`);
  
  let fixedCount = 0;
  
  for (const customer of customers) {
    const fixedCoords = tryFixCoordinates(customer.coordinates);
    
    if (fixedCoords && fixedCoords.wasSwapped) {
      console.log(`🔧 Fixing ${customer.display_name}:`);
      console.log(`   Old: ${customer.coordinates}`);
      console.log(`   New: (${fixedCoords.lng},${fixedCoords.lat})`);
      
      // Update with corrected coordinates in PostGIS format
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          coordinates: `(${fixedCoords.lng},${fixedCoords.lat})`,
          last_modified: new Date().toISOString()
        })
        .eq('id', customer.id);
        
      if (updateError) {
        console.error(`   ❌ Update error:`, updateError);
      } else {
        console.log(`   ✅ Fixed!`);
        fixedCount++;
      }
      
      await delay(100);
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} customers with wrong coordinates\n`);
  return fixedCount;
}

// Main function to process customers
async function processCustomers() {
  console.log('🚀 Starting customer geocoding process...\n');
  
  // First, fix any obviously wrong coordinates
  await fixWrongCoordinates();
  
  // Get all customers for the company
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('linked_company', DEFAULT_COMPANY_ID)
    .order('display_name');
    
  if (error) {
    console.error('Error fetching customers:', error);
    return;
  }
  
  console.log(`📊 Found ${customers.length} total customers\n`);
  
  // Separate customers by what needs geocoding
  const needsReverseGeocode = customers.filter(c => 
    c.coordinates && 
    (!c.billing_address_1 || !c.billing_postcode || !c.billing_city_town)
  );
  
  const needsForwardGeocode = customers.filter(c => 
    !c.coordinates && 
    c.billing_address_1 && 
    (c.billing_postcode || c.billing_city_town)
  );
  
  console.log(`📍 Customers with coordinates but missing addresses: ${needsReverseGeocode.length}`);
  console.log(`🏠 Customers with addresses but missing coordinates: ${needsForwardGeocode.length}\n`);
  
  // Process reverse geocoding (coordinates -> address)
  if (needsReverseGeocode.length > 0) {
    console.log('🔄 Processing reverse geocoding (coordinates → address)...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < needsReverseGeocode.length; i++) {
      const customer = needsReverseGeocode[i];
      const coords = parseCoordinates(customer.coordinates);
      
      if (!coords) {
        console.log(`❌ Invalid coordinates for ${customer.display_name}`);
        errorCount++;
        continue;
      }
      
      console.log(`[${i + 1}/${needsReverseGeocode.length}] Processing ${customer.display_name}...`);
      console.log(`   📍 Coordinates: ${coords.lat}, ${coords.lng}`);
      
      const addressData = await reverseGeocode(coords.lat, coords.lng);
      
      if (addressData) {
        console.log(`   ✅ Found address: ${addressData.billing_address_1}, ${addressData.billing_city_town} ${addressData.billing_postcode}`);
        
        // Update customer with address data
        const updateData = {};
        
        // Only update empty fields
        if (!customer.billing_address_1) updateData.billing_address_1 = addressData.billing_address_1;
        if (!customer.billing_city_town) updateData.billing_city_town = addressData.billing_city_town;
        if (!customer.billing_county) updateData.billing_county = addressData.billing_county;
        if (!customer.billing_postcode) updateData.billing_postcode = addressData.billing_postcode;
        
        // Update shipping if empty
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
      } else {
        console.log(`   ⚠️  Could not find address`);
        errorCount++;
      }
      
      // Rate limit: 50 requests per second max, so wait 100ms between requests
      await delay(100);
    }
    
    console.log(`\n📊 Reverse geocoding complete: ${successCount} updated, ${errorCount} errors\n`);
  }
  
  // Process forward geocoding (address -> coordinates)
  if (needsForwardGeocode.length > 0) {
    console.log('🔄 Processing forward geocoding (address → coordinates)...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < needsForwardGeocode.length; i++) {
      const customer = needsForwardGeocode[i];
      
      console.log(`[${i + 1}/${needsForwardGeocode.length}] Processing ${customer.display_name}...`);
      console.log(`   🏠 Address: ${customer.billing_address_1}, ${customer.billing_city_town} ${customer.billing_postcode}`);
      
      const coords = await forwardGeocode({
        address_1: customer.billing_address_1,
        address_2: customer.billing_address_2,
        city_town: customer.billing_city_town,
        postcode: customer.billing_postcode
      });
      
      if (coords) {
        console.log(`   ✅ Found coordinates: ${coords.lat}, ${coords.lng}`);
        
        // Update customer with coordinates in PostGIS format (lng,lat)
        const updateData = {
          coordinates: `(${coords.lng},${coords.lat})`,
          last_modified: new Date().toISOString()
        };
        
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
      } else {
        console.log(`   ⚠️  Could not find coordinates`);
        errorCount++;
      }
      
      // Rate limit
      await delay(100);
    }
    
    console.log(`\n📊 Forward geocoding complete: ${successCount} updated, ${errorCount} errors\n`);
  }
  
  // Summary
  console.log('✅ Geocoding process complete!');
  console.log('\n📊 Final Summary:');
  console.log(`   🔄 Reverse geocoded: ${needsReverseGeocode.length} customers`);
  console.log(`   🔄 Forward geocoded: ${needsForwardGeocode.length} customers`);
  
  // Show some examples of what was updated
  if (needsReverseGeocode.length > 0) {
    console.log('\n📍 Example customers that got addresses from coordinates:');
    needsReverseGeocode.slice(0, 3).forEach(c => {
      console.log(`   - ${c.display_name} (${c.coordinates})`);
    });
  }
  
  if (needsForwardGeocode.length > 0) {
    console.log('\n🏠 Example customers that got coordinates from addresses:');
    needsForwardGeocode.slice(0, 3).forEach(c => {
      console.log(`   - ${c.display_name} (${c.billing_address_1}, ${c.billing_postcode})`);
    });
  }
}

// Run the script
if (require.main === module) {
  processCustomers()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processCustomers, reverseGeocode, forwardGeocode };