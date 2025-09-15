# Sales Orders Upload Script

This script uploads the Firebase sales orders JSON data to Supabase.

## Setup

1. **Install dependencies:**
   ```bash
   cd /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app
   npm install @supabase/supabase-js
   ```

2. **Configure the script:**
   Edit `scripts/upload-orders.js` and update these variables:
   - `supabaseUrl`: Your Supabase project URL
   - `supabaseKey`: Your Supabase anon key (or service key for better permissions)
   - `COMPANY_ID`: Your company ID from the companies table

## What the script does:

### Orders Mapping:
- `salesorder_number` → `legacy_order_number`
- `date` → `order_date`
- `order_status` → `order_status` (mapped to Supabase enum values)
- `total` → `total`
- Customer lookup/creation based on name and email
- Tax calculation for `sub_total`

### Line Items Mapping:
- `name` → `item_name`
- `quantity` → `quantity`
- `rate` → `unit_price`
- `item_total` → `total_price`
- SKU-based item lookup
- All quantity fields (packed, shipped, delivered, etc.)

### Features:
- **Duplicate prevention**: Checks if orders already exist
- **Customer management**: Creates customers if they don't exist
- **Item lookup**: Tries to match items by SKU and brand
- **Error handling**: Logs all errors and continues processing
- **Progress tracking**: Shows detailed progress information
- **Rate limiting**: Small delays to avoid overwhelming Supabase

## Before running:

1. **Test with a small sample first:**
   Modify the script to only process the first 10 orders for testing.

2. **Check your Supabase limits:**
   Make sure you have sufficient database space and API limits.

3. **Backup your database:**
   Create a backup before running the full import.

## Running the script:

```bash
# Test run (dry run - uncomment the function call first)
node scripts/upload-orders.js

# The script will show detailed progress and a summary at the end
```

## What to expect:

- **500 orders** from the JSON file
- **~1000+ line items** (estimated based on the sample)
- **New customers** will be created for any not already in your database
- **Existing orders** will be skipped (by `legacy_order_number`)
- **Missing items** will have `null` item_id but line items will still be created

## After upload:

Your brand trend chart should now show all brands including:
- rader
- my-flame-lifestyle  
- relaxound
- And any other brands from the Firebase data

The script preserves the original Firebase IDs and other metadata for future reference.