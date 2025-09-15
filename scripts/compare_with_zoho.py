#!/usr/bin/env python3
"""
Script to compare Analysis.csv data against Zoho Inventory
Compares:
1. cost_price (CSV) vs selling rate (Zoho)
2. name (CSV) vs name (Zoho)
"""

import pandas as pd
import requests
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
import sys

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Zoho API Configuration
ZOHO_CLIENT_ID = "1000.AV9M9OMELL7FB7UMDLDV4TXPPYM0CZ"
ZOHO_CLIENT_SECRET = "bcb3b1358539f7343a05023ab71ea5704706faaa2a"
ZOHO_REFRESH_TOKEN = "1000.ebc8fd1267ba4edca22abcfd25263212.c45dadbd00483ad07d0d395e824c8e39"
ZOHO_ORG_ID = "20083870449"

# Zoho API URLs
ZOHO_AUTH_URL = "https://accounts.zoho.eu/oauth/v2"
ZOHO_INVENTORY_URL = "https://www.zohoapis.eu/inventory/v1"

# Global variables
zoho_access_token = None
token_expiry = None

# Rate limiting settings
REQUEST_DELAY = 0.3  # 300ms between requests
BATCH_SIZE = 10      # Process in small batches

def get_zoho_access_token():
    """Get a fresh Zoho access token"""
    global zoho_access_token, token_expiry
    
    if zoho_access_token and token_expiry and datetime.now() < token_expiry:
        return zoho_access_token
    
    logger.info("🔑 Getting Zoho access token...")
    
    try:
        response = requests.post(
            f"{ZOHO_AUTH_URL}/token",
            data={
                'refresh_token': ZOHO_REFRESH_TOKEN,
                'client_id': ZOHO_CLIENT_ID,
                'client_secret': ZOHO_CLIENT_SECRET,
                'grant_type': 'refresh_token'
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            zoho_access_token = data['access_token']
            token_expiry = datetime.now() + timedelta(minutes=50)
            logger.info("✅ Zoho access token obtained")
            return zoho_access_token
        else:
            logger.error(f"❌ Failed to get token: {response.status_code} - {response.text}")
            raise Exception("Failed to get Zoho access token")
    except Exception as e:
        logger.error(f"❌ Error getting access token: {e}")
        raise

def get_zoho_item_by_sku(sku):
    """Get item details from Zoho by SKU"""
    try:
        access_token = get_zoho_access_token()
        
        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Search for item by SKU
        url = f"{ZOHO_INVENTORY_URL}/items"
        params = {
            'organization_id': ZOHO_ORG_ID,
            'sku': sku
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('items') and len(data['items']) > 0:
                item = data['items'][0]
                return {
                    'found': True,
                    'item_id': item.get('item_id'),
                    'name': item.get('name', ''),
                    'sku': item.get('sku', ''),
                    'purchase_rate': float(item.get('purchase_rate', 0)),
                    'rate': float(item.get('rate', 0)),  # selling rate
                    'status': item.get('status', ''),
                    'description': item.get('description', ''),
                    'category_name': item.get('category_name', ''),
                    'stock_on_hand': item.get('stock_on_hand', 0)
                }
            else:
                return {'found': False, 'error': 'No item found with this SKU'}
        elif response.status_code == 401:
            # Token expired, refresh and retry
            logger.warning("⚠️  Token expired, refreshing...")
            global zoho_access_token, token_expiry
            zoho_access_token = None
            token_expiry = None
            return get_zoho_item_by_sku(sku)  # Recursive retry
        else:
            return {'found': False, 'error': f'API error: {response.status_code}'}
            
    except Exception as e:
        logger.error(f"❌ Error fetching item {sku}: {e}")
        return {'found': False, 'error': str(e)}

def compare_prices(csv_price, zoho_price, tolerance=0.01):
    """Compare prices with tolerance"""
    if csv_price is None or zoho_price is None:
        return 'missing_data'
    
    csv_price = float(csv_price)
    zoho_price = float(zoho_price)
    
    if abs(csv_price - zoho_price) <= tolerance:
        return 'match'
    elif csv_price > zoho_price:
        return 'csv_higher'
    else:
        return 'zoho_higher'

def compare_names(csv_name, zoho_name):
    """Compare product names"""
    if not csv_name or not zoho_name:
        return 'missing_data'
    
    csv_clean = csv_name.strip().lower()
    zoho_clean = zoho_name.strip().lower()
    
    if csv_clean == zoho_clean:
        return 'exact_match'
    elif csv_clean in zoho_clean or zoho_clean in csv_clean:
        return 'partial_match'
    else:
        return 'different'

def analyze_csv_vs_zoho(csv_file_path):
    """Main function to compare CSV against Zoho"""
    logger.info(f"📂 Loading CSV file: {csv_file_path}")
    
    try:
        # Load CSV
        df = pd.read_csv(csv_file_path)
        logger.info(f"✅ Loaded {len(df)} rows from CSV")
        
        # Test Zoho connection
        logger.info("🔌 Testing Zoho connection...")
        get_zoho_access_token()
        logger.info("✅ Zoho connection successful")
        
        # Initialize results
        results = []
        processed = 0
        found_count = 0
        price_matches = 0
        name_matches = 0
        
        logger.info(f"🔄 Starting comparison of {len(df)} items...")
        logger.info("=" * 80)
        
        # Process each row
        for index, row in df.iterrows():
            sku = str(row['sku']).strip()
            csv_name = str(row['name']).strip()
            csv_cost_price = row['cost_price']
            
            processed += 1
            logger.info(f"📍 ({processed}/{len(df)}) Processing SKU: {sku} | {csv_name[:40]}...")
            
            # Get item from Zoho
            zoho_item = get_zoho_item_by_sku(sku)
            
            if zoho_item['found']:
                found_count += 1
                
                # Compare prices (CSV cost_price vs Zoho selling rate)
                price_comparison = compare_prices(csv_cost_price, zoho_item['rate'])
                if price_comparison == 'match':
                    price_matches += 1
                
                # Compare names
                name_comparison = compare_names(csv_name, zoho_item['name'])
                if name_comparison in ['exact_match', 'partial_match']:
                    name_matches += 1
                
                result = {
                    'sku': sku,
                    'csv_name': csv_name,
                    'csv_cost_price': csv_cost_price,
                    'zoho_found': True,
                    'zoho_name': zoho_item['name'],
                    'zoho_purchase_rate': zoho_item['purchase_rate'],
                    'zoho_selling_rate': zoho_item['rate'],
                    'zoho_stock': zoho_item['stock_on_hand'],
                    'zoho_status': zoho_item['status'],
                    'price_comparison': price_comparison,
                    'name_comparison': name_comparison,
                    'price_difference': float(csv_cost_price) - zoho_item['rate'] if csv_cost_price else None
                }
                
                # Log significant differences
                if price_comparison != 'match':
                    diff = abs(float(csv_cost_price) - zoho_item['rate']) if csv_cost_price else 0
                    logger.info(f"   💰 Price diff: CSV cost={csv_cost_price} vs Zoho selling={zoho_item['rate']} (Δ{diff:.2f})")
                
                if name_comparison == 'different':
                    logger.info(f"   📝 Name diff: '{csv_name}' vs '{zoho_item['name']}'")
                
            else:
                result = {
                    'sku': sku,
                    'csv_name': csv_name,
                    'csv_cost_price': csv_cost_price,
                    'zoho_found': False,
                    'zoho_error': zoho_item.get('error', 'Unknown error'),
                    'price_comparison': 'not_found',
                    'name_comparison': 'not_found'
                }
                logger.info(f"   ❌ Not found in Zoho: {zoho_item.get('error', 'No item found')}")
            
            results.append(result)
            
            # Progress update every 25 items
            if processed % 25 == 0:
                success_rate = (found_count / processed) * 100
                logger.info(f"\n📊 Progress: {processed}/{len(df)} | Found: {found_count} ({success_rate:.1f}%)")
            
            # Rate limiting
            time.sleep(REQUEST_DELAY)
        
        # Create results DataFrame
        results_df = pd.DataFrame(results)
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = csv_file_path.replace('.csv', f'_zoho_comparison_{timestamp}.csv')
        results_df.to_csv(output_file, index=False)
        
        # Generate summary report
        logger.info("\n" + "=" * 80)
        logger.info("📊 COMPARISON SUMMARY REPORT")
        logger.info("=" * 80)
        
        logger.info(f"📂 Input file: {csv_file_path}")
        logger.info(f"💾 Output file: {output_file}")
        logger.info(f"📦 Total items processed: {len(df)}")
        logger.info(f"✅ Found in Zoho: {found_count} ({found_count/len(df)*100:.1f}%)")
        logger.info(f"❌ Not found in Zoho: {len(df)-found_count} ({(len(df)-found_count)/len(df)*100:.1f}%)")
        
        if found_count > 0:
            logger.info(f"💰 Price matches: {price_matches}/{found_count} ({price_matches/found_count*100:.1f}%)")
            logger.info(f"📝 Name matches: {name_matches}/{found_count} ({name_matches/found_count*100:.1f}%)")
            
            # Price analysis
            price_diffs = results_df[results_df['zoho_found'] == True]['price_difference'].dropna()
            if len(price_diffs) > 0:
                avg_diff = price_diffs.mean()
                max_diff = price_diffs.abs().max()
                logger.info(f"💰 Average price difference: {avg_diff:.2f}")
                logger.info(f"💰 Maximum price difference: {max_diff:.2f}")
            
            # Show biggest discrepancies
            logger.info("\n🔍 BIGGEST PRICE DISCREPANCIES:")
            price_issues = results_df[
                (results_df['zoho_found'] == True) & 
                (results_df['price_comparison'] != 'match')
            ].copy()
            
            if len(price_issues) > 0:
                price_issues['abs_diff'] = abs(price_issues['price_difference'])
                top_diffs = price_issues.nlargest(5, 'abs_diff')
                
                for _, row in top_diffs.iterrows():
                    logger.info(f"   SKU {row['sku']}: CSV cost={row['csv_cost_price']} vs Zoho selling={row['zoho_selling_rate']} (Δ{row['price_difference']:.2f})")
            
            # Show name mismatches
            name_issues = results_df[
                (results_df['zoho_found'] == True) & 
                (results_df['name_comparison'] == 'different')
            ]
            
            if len(name_issues) > 0:
                logger.info(f"\n📝 NAME MISMATCHES ({len(name_issues)} items):")
                for _, row in name_issues.head(5).iterrows():
                    logger.info(f"   SKU {row['sku']}: '{row['csv_name']}' vs '{row['zoho_name']}'")
        
        logger.info("=" * 80)
        logger.info("✅ Comparison complete!")
        
        return results_df
        
    except Exception as e:
        logger.error(f"❌ Error during analysis: {e}")
        return None

if __name__ == "__main__":
    csv_file = "/Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/Analysis.csv"
    
    # Check file exists
    if not Path(csv_file).exists():
        logger.error(f"❌ File not found: {csv_file}")
        sys.exit(1)
    
    # Run comparison
    results = analyze_csv_vs_zoho(csv_file)
    
    if results is not None:
        logger.info("🎉 Analysis complete! Check the output CSV for detailed results.")
    else:
        logger.error("❌ Analysis failed!")
        sys.exit(1)