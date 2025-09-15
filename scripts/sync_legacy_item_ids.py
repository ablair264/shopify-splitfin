#!/usr/bin/env python3
"""
Script to sync legacy_item_id for items missing this field by looking them up in Zoho Inventory via API
"""

import os
import sys
import time
import requests
import json
from supabase import create_client, Client
from typing import List, Dict, Optional
import logging
from datetime import datetime, timedelta

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SUPABASE_URL = "https://dcgagukbbzfqaymlxnzw.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ2FndWtiYnpmcWF5bWx4bnp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQwMTc0NywiZXhwIjoyMDcxOTc3NzQ3fQ.kDM90xZ_nBas9h6GhdjGtDqEK3b8nbW3hqfptmOPncU"
DEFAULT_COMPANY_ID = "87dcc6db-2e24-46fb-9a12-7886f690a326"
BATCH_SIZE = 50
DELAY_MS = 100

# Zoho API Configuration
ZOHO_CLIENT_ID = "1000.AV9M9OMELL7FB7UMDLDV4TXPPYM0CZ"
ZOHO_CLIENT_SECRET = "bcb3b1358539f7343a05023ab71ea5704706faaa2a"
ZOHO_REFRESH_TOKEN = "1000.ebc8fd1267ba4edca22abcfd25263212.c45dadbd00483ad07d0d395e824c8e39"
ZOHO_ORG_ID = "20083870449"

# Zoho API Base URLs
ZOHO_AUTH_URL = "https://accounts.zoho.eu/oauth/v2"
ZOHO_INVENTORY_URL = "https://www.zohoapis.eu/inventory/v1"

# Global variable to store access token
zoho_access_token = None
token_expiry = None

def get_zoho_access_token():
    """Get a fresh access token using refresh token"""
    global zoho_access_token, token_expiry
    
    # Check if we have a valid token
    if zoho_access_token and token_expiry and datetime.now() < token_expiry:
        return zoho_access_token
    
    logger.info("🔑 Refreshing Zoho access token...")
    
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
            # Set token expiry to 50 minutes from now (tokens last 60 minutes)
            token_expiry = datetime.now() + timedelta(minutes=50)
            logger.info("✅ Zoho access token refreshed successfully")
            return zoho_access_token
        else:
            logger.error(f"❌ Failed to refresh token: {response.status_code} - {response.text}")
            raise Exception("Failed to refresh Zoho access token")
    except Exception as e:
        logger.error(f"❌ Error refreshing Zoho access token: {e}")
        raise

def init_supabase() -> Client:
    """Initialize Supabase client"""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("✅ Supabase client initialized")
        return supabase
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase: {e}")
        sys.exit(1)

def get_items_without_legacy_id(supabase: Client) -> List[Dict]:
    """Get all items that don't have a legacy_item_id from Supabase"""
    try:
        logger.info("🔍 Querying Supabase for items without legacy_item_id...")
        response = supabase.table('items').select('id, sku, name, legacy_item_id, brand_id').is_('legacy_item_id', 'null').execute()
        items = response.data
        
        # Filter out items with empty/null SKUs as we need SKU to search Zoho
        valid_items = [item for item in items if item.get('sku') and item['sku'].strip()]
        invalid_items = len(items) - len(valid_items)
        
        logger.info(f"📊 Found {len(items)} items without legacy_item_id in Supabase")
        if invalid_items > 0:
            logger.info(f"⚠️  Filtered out {invalid_items} items with empty/null SKUs")
        logger.info(f"✅ {len(valid_items)} items ready for Zoho lookup")
        
        return valid_items
    except Exception as e:
        logger.error(f"❌ Error fetching items from Supabase: {e}")
        return []

def search_zoho_item_by_sku(sku: str) -> Optional[str]:
    """Search for a specific item in Zoho Inventory by SKU and return the item_id"""
    try:
        logger.info(f"🔍 Searching Zoho for SKU: {sku}")
        
        # Get fresh access token
        access_token = get_zoho_access_token()
        
        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Search for item by SKU in Zoho
        url = f"{ZOHO_INVENTORY_URL}/items"
        params = {
            'organization_id': ZOHO_ORG_ID,
            'sku': sku
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('items') and len(data['items']) > 0:
                item = data['items'][0]  # Take the first match
                item_id = item.get('item_id')
                item_name = item.get('name', 'Unknown')
                logger.info(f"✅ Found Zoho item: SKU {sku} -> ID {item_id} ({item_name[:50]}...)")
                return item_id
            else:
                logger.info(f"ℹ️  No Zoho item found for SKU: {sku}")
                return None
        elif response.status_code == 401:
            logger.warning("⚠️  Zoho API authentication failed - refreshing token and retrying")
            # Force token refresh and retry once
            global zoho_access_token, token_expiry
            zoho_access_token = None
            token_expiry = None
            
            access_token = get_zoho_access_token()
            headers['Authorization'] = f'Zoho-oauthtoken {access_token}'
            
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('items') and len(data['items']) > 0:
                    item = data['items'][0]
                    item_id = item.get('item_id')
                    logger.info(f"✅ Found Zoho item (after retry): SKU {sku} -> ID {item_id}")
                    return item_id
            logger.warning(f"⚠️  Still no Zoho item found for SKU {sku} after retry")
            return None
        else:
            logger.error(f"❌ Zoho API error for SKU {sku}: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error searching Zoho for SKU {sku}: {e}")
        return None

def check_legacy_id_exists(supabase: Client, legacy_item_id: str) -> Optional[Dict]:
    """Check if a legacy_item_id already exists in the database"""
    try:
        response = supabase.table('items').select('id, sku, name').eq('legacy_item_id', legacy_item_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"❌ Error checking legacy_item_id {legacy_item_id}: {e}")
        return None

def update_item_legacy_id(supabase: Client, item_id: str, item_sku: str, legacy_item_id: str) -> bool:
    """Update an item's legacy_item_id in Supabase"""
    try:
        # First check if this legacy_item_id already exists
        existing_item = check_legacy_id_exists(supabase, legacy_item_id)
        if existing_item:
            logger.warning(f"⚠️  Legacy ID {legacy_item_id} already exists for item {existing_item['id']} (SKU: {existing_item['sku']})")
            logger.warning(f"    Skipping update for item {item_id} (SKU: {item_sku})")
            return False
        
        response = supabase.table('items').update({
            'legacy_item_id': legacy_item_id
        }).eq('id', item_id).execute()
        
        if response.data:
            logger.info(f"✅ Updated item {item_id} with legacy_item_id: {legacy_item_id}")
            return True
        else:
            logger.error(f"❌ Failed to update item {item_id}")
            return False
            
    except Exception as e:
        if '23505' in str(e):  # Duplicate key error
            logger.error(f"❌ Duplicate legacy_item_id {legacy_item_id} for item {item_id} (SKU: {item_sku})")
        else:
            logger.error(f"❌ Error updating item {item_id}: {e}")
        return False

def main():
    """Main function to sync legacy_item_ids"""
    logger.info("🚀 Starting legacy_item_id sync process")
    
    # Initialize Supabase
    supabase = init_supabase()
    
    # Test Zoho connection
    try:
        logger.info("🔌 Testing Zoho API connection...")
        get_zoho_access_token()
        logger.info("✅ Zoho API connection successful")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Zoho API: {e}")
        sys.exit(1)
    
    # Step 1: Query Supabase for items without legacy_item_id
    logger.info("\n🔄 STEP 1: Getting items from Supabase that need legacy_item_id...")
    items_needing_sync = get_items_without_legacy_id(supabase)
    
    if not items_needing_sync:
        logger.info("✅ No items need legacy_item_id updates - all items already have legacy_item_id!")
        return
    
    # Step 2: Show summary of what we found in Supabase
    logger.info(f"\n📊 SUPABASE ANALYSIS:")
    logger.info(f"   Items without legacy_item_id: {len(items_needing_sync)}")
    
    # Group by brand for analysis
    brand_counts = {}
    for item in items_needing_sync:
        brand_id = item.get('brand_id', 'Unknown')
        brand_counts[brand_id] = brand_counts.get(brand_id, 0) + 1
    
    logger.info(f"   Affected brands: {len(brand_counts)}")
    for brand_id, count in brand_counts.items():
        logger.info(f"     Brand {brand_id}: {count} items")
    
    # Check for duplicate SKUs in items that need syncing
    logger.info("\n🔍 Checking for duplicate SKUs in items that need syncing...")
    sku_counts = {}
    for item in items_needing_sync:
        sku = item['sku']
        if sku in sku_counts:
            sku_counts[sku].append(item['id'])
        else:
            sku_counts[sku] = [item['id']]
    
    duplicates = {sku: ids for sku, ids in sku_counts.items() if len(ids) > 1}
    if duplicates:
        logger.warning(f"⚠️  Found {len(duplicates)} duplicate SKUs that need syncing:")
        for sku, ids in duplicates.items():
            logger.warning(f"    SKU '{sku}': {len(ids)} items - {ids}")
        logger.warning("    Note: Only the first Zoho match will be used for each SKU")
    else:
        logger.info("✅ No duplicate SKUs found - each SKU is unique")
    
    # Step 3: Process only the items from Supabase that need syncing
    logger.info(f"\n🔄 STEP 2: Searching Zoho for {len(items_needing_sync)} specific items...")
    logger.info("=" * 60)
    
    total_items = len(items_needing_sync)
    updated_count = 0
    not_found_count = 0
    error_count = 0
    duplicate_legacy_count = 0
    
    # Process in batches
    for batch_start in range(0, total_items, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, total_items)
        batch = items_needing_sync[batch_start:batch_end]
        
        logger.info(f"\n📦 Processing batch {batch_start//BATCH_SIZE + 1} (items {batch_start + 1}-{batch_end} of {total_items})")
        logger.info("-" * 40)
        
        for item in batch:
            item_name = item['name'][:40] + "..." if len(item['name']) > 40 else item['name']
            logger.info(f"🔍 Item: {item['sku']} | {item_name}")
            
            # Search Zoho for this specific SKU
            legacy_item_id = search_zoho_item_by_sku(item['sku'])
            
            if legacy_item_id:
                # Check if this legacy_item_id already exists in Supabase
                existing = check_legacy_id_exists(supabase, legacy_item_id)
                if existing and existing['id'] != item['id']:
                    logger.warning(f"   ⚠️  Conflict: Legacy ID {legacy_item_id} already exists for SKU {existing['sku']}")
                    duplicate_legacy_count += 1
                else:
                    # Update the item with the found legacy_item_id
                    if update_item_legacy_id(supabase, item['id'], item['sku'], legacy_item_id):
                        logger.info(f"   ✅ Updated: {item['sku']} -> {legacy_item_id}")
                        updated_count += 1
                    else:
                        logger.error(f"   ❌ Failed to update: {item['sku']}")
                        error_count += 1
            else:
                logger.info(f"   ℹ️  Not found: {item['sku']} (no matching SKU in Zoho)")
                not_found_count += 1
            
            # Rate limiting between API calls
            if DELAY_MS > 0:
                time.sleep(DELAY_MS / 1000.0)
        
        # Batch progress summary
        progress_pct = (batch_end / total_items) * 100
        logger.info(f"\n📊 Batch {batch_start//BATCH_SIZE + 1} complete ({progress_pct:.1f}% total progress)")
        logger.info(f"   ✅ Updated: {updated_count} | ℹ️  Not found: {not_found_count} | ❌ Errors: {error_count} | ⚠️  Conflicts: {duplicate_legacy_count}")
        
        # Pause between batches to be respectful to Zoho API
        if batch_end < total_items:
            logger.info(f"⏸️  Pausing 2 seconds before next batch...")
            time.sleep(2)
    
    # Final Summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 FINAL SYNC SUMMARY")
    logger.info("=" * 60)
    logger.info(f"🔍 Total items checked in Supabase: {total_items}")
    logger.info(f"✅ Successfully synced legacy_item_id: {updated_count}")
    logger.info(f"ℹ️  Not found in Zoho: {not_found_count}")
    logger.info(f"⚠️  Legacy ID conflicts: {duplicate_legacy_count}")
    logger.info(f"❌ Update errors: {error_count}")
    logger.info("-" * 60)
    
    success_rate = (updated_count / total_items) * 100 if total_items > 0 else 0
    logger.info(f"📈 Success rate: {success_rate:.1f}%")
    
    if updated_count > 0:
        logger.info(f"🎉 {updated_count} items now have legacy_item_id from Zoho!")
    
    remaining_items = not_found_count + duplicate_legacy_count + error_count
    if remaining_items > 0:
        logger.info(f"⏳ {remaining_items} items still need attention")
        
    logger.info("=" * 60)
    
    # Suggest next steps
    if not_found_count > 0:
        logger.info("\n💡 NEXT STEPS:")
        logger.info(f"   • {not_found_count} items have SKUs not found in Zoho")
        logger.info("   • Consider checking if these SKUs exist with different formatting")
        logger.info("   • Or if these are new items that need to be created in Zoho first")
        
    if duplicate_legacy_count > 0:
        logger.info(f"\n⚠️  CONFLICTS TO RESOLVE:")
        logger.info(f"   • {duplicate_legacy_count} items have legacy_item_id conflicts")
        logger.info("   • Review the duplicate SKUs in your Supabase data")
        logger.info("   • Consider running the duplicate cleanup SQL script first")

if __name__ == "__main__":
    main()
