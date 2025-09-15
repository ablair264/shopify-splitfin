# Firebase Data Export Instructions

## Setup

1. First, you need to get your Firebase Service Account credentials:
   - Go to Firebase Console (https://console.firebase.google.com)
   - Select your project (splitfin-609c9)
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the downloaded JSON file

2. Install the required dependencies:
   ```bash
   npm install firebase-admin
   ```

3. Update the script with your credentials:
   - Open `extract-firebase-data-simple.js`
   - Replace the `serviceAccount` object with your actual service account JSON
   - OR save your service account JSON as a file and update the path

## Running the Export

1. Navigate to the scripts directory:
   ```bash
   cd /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/scripts
   ```

2. Run the export script:
   ```bash
   node extract-firebase-data-simple.js
   ```

## Output

The script will create a `firebase-export` directory with:

- Individual JSON files for each collection:
  - `brands.json`
  - `conversations.json`
  - `invoices.json`
  - `items_data.json`
  - `notifications.json`
  - `purchase_orders.json`
  - `sales_orders.json` (includes order_line_items subcollection)

- `export-summary.json` - Complete export with metadata
- `schema-analysis.json` - Analysis of data structure and field types

## What the Script Does

1. Connects to your Firebase project using Admin SDK
2. Exports all specified collections
3. Handles subcollections (order_line_items under sales_orders)
4. Converts Firebase timestamps to ISO strings
5. Analyzes the schema of your data
6. Provides statistics on document counts

## Next Steps

Once you have the exported data, we can:
1. Analyze the data structure
2. Create matching Supabase tables
3. Write migration scripts to import the data into Supabase
4. Update your application to use the new data structure