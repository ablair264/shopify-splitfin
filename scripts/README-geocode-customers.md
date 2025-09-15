# 🗺️ Customer Geocoding Script

This script automatically fills in missing address and coordinate data for customers in Supabase using Google Maps Geocoding API.

## 🎯 What it does

1. **Reverse Geocoding** (Coordinates → Address)
   - Finds customers with coordinates but missing address data
   - Uses Google Maps to get the address from coordinates
   - Fills in missing address fields (street, city, postcode, etc.)

2. **Forward Geocoding** (Address → Coordinates)  
   - Finds customers with addresses but missing coordinates
   - Uses Google Maps to get coordinates from the address
   - Adds coordinates in PostGIS format for map display

## 📋 Prerequisites

- Node.js installed
- `.env.migration` file with Supabase credentials
- Google Maps API key (uses the working one from CustomerMap)

## 🚀 How to run

```bash
cd /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app
node scripts/geocode-customer-data.js
```

## 📊 Example output

```
🚀 Starting customer geocoding process...

📊 Found 1477 total customers

📍 Customers with coordinates but missing addresses: 45
🏠 Customers with addresses but missing coordinates: 312

🔄 Processing reverse geocoding (coordinates → address)...

[1/45] Processing Natural Bed Company...
   📍 Coordinates: 53.3772156, -1.4771854
   ✅ Found address: 123 Sheffield Road, Sheffield S1 2AB

[2/45] Processing Another Customer...
   📍 Coordinates: 51.5074, -0.1278
   ✅ Found address: 10 Downing Street, London SW1A 2AA

📊 Reverse geocoding complete: 43 updated, 2 errors

🔄 Processing forward geocoding (address → coordinates)...

[1/312] Processing In Haus...
   🏠 Address: 8 Allandale Road, Leicester LE2 2DA
   ✅ Found coordinates: 52.6235, -1.0952

📊 Forward geocoding complete: 310 updated, 2 errors

✅ Geocoding process complete!
```

## 🔧 How it works

### Reverse Geocoding
- Takes coordinates like `(53.3772156,-1.4771854)` 
- Calls Google Maps API to get address components
- Extracts street, city, county, postcode
- Only updates empty fields (won't overwrite existing data)

### Forward Geocoding
- Takes address parts (street, city, postcode)
- Calls Google Maps API to get lat/lng coordinates
- Stores as PostGIS format: `(lat,lng)`
- Enables map display in ViewOrder component

## ⚠️ Rate Limits

- Script waits 100ms between API calls
- Google Maps free tier: 40,000 requests/month
- With ~400 customers needing geocoding, uses ~1% of monthly quota

## 🛠️ Customization

Edit these fields in the script:

```javascript
// Change API key if needed
const GOOGLE_MAPS_API_KEY = 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';

// Adjust rate limit delay (milliseconds)
await delay(100); // Current: 10 requests/second
```

## 🐛 Troubleshooting

**"Invalid coordinates"**
- Check format is `(lat,lng)` not `(lng,lat)`
- Ensure coordinates are valid numbers

**"Could not find address"** 
- Coordinates might be in remote/unnamed location
- Try manual lookup in Google Maps

**"Could not find coordinates"**
- Address might be incomplete or misspelled
- Check postcode is valid UK format

**API errors**
- Check API key is valid
- Verify billing is enabled on Google Cloud
- Check daily quota hasn't been exceeded

## 💡 Tips

1. Run during off-peak hours to avoid rate limits
2. Back up customers table before running
3. Monitor console output for any errors
4. Check a few updated customers in the app to verify

## 🔍 Verify Results

After running, check customers in the app:
1. Go to Customers page
2. Click on updated customers
3. Verify addresses look correct
4. Check map shows correct location