#!/usr/bin/env python3
"""
Enhanced script that handles SKU variants intelligently
Tries base SKU if variant SKU not found in Zoho
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
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SUPABASE_URL = "https://dcgagukbbzfqaymlxnzw.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ2FndWtiYnpmcWF5bWx4bnp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQwMTc0NywiZXhwIjoyMDcxOTc3NzQ3fQ.kDM90xZ_nBas9h6GhdjGtDqEK3b8nbW3hqfptmOPncU"
BATCH_SIZE = 25  # Smaller batches for safer processing
DELAY_MS = 200   # Longer delay to be gentler on Zoho API

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

def get_base_sku(sku: str) -> str:
    """Extract base SKU from variant SKU (e.g., FA00F -> FA00)"""
    if re.match(r'^[A-Z0-9]+[A-Z]$', sku) and len(sku) > 1:
        return sku[:-1]
    return sku

def search_zoho_item_smart(sku: str) -> Optional[str]:
    """Smart search that tries exact SKU first, then base SKU if it's a variant"""
    
    # Try exact SKU first
    result = search_zoho_by_sku(sku)
    if result:
        logger.info(f"✅ Found exact match: {sku} -> {result}")
        return result
    
    # If no exact match and this looks like a variant, try base SKU
    base_sku = get_base_sku(sku)
    if base_sku != sku:
        logger.info(f"🔄 Trying base SKU: {sku} -> {base_sku}")
        result = search_zoho_by_sku(base_sku)
        if result:
            logger.info(f"✅ Found base SKU match: {sku} ({base_sku}) -> {result}")
            return result
    
    logger.info(f"ℹ️  No match found for {sku} (tried exact and base)")
    return None

def search_zoho_by_sku(sku: str) -> Optional[str]:
    """Search Zoho for specific SKU"""
    try:
        access_token = get_zoho_access_token()
        
        headers = {
            'Authorization': f'Zoho-oauthtoken {access_token}',
            'Content-Type': 'application/json'
        }
        
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
                return item.get('item_id')
            return None
        elif response.status_code == 401:
            # Token refresh and retry
            global zoho_access_token, token_expiry
            zoho_access_token = None
            token_expiry = None
            access_token = get_zoho_access_token()
            headers['Authorization'] = f'Zoho-oauthtoken {access_token}'
            
            response = requests.get(url, headers=headers, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('items') and len(data['items']) > 0:
                    return data['items'][0].get('item_id')
            return None
        else:
            logger.warning(f"⚠️  Zoho API error for {sku}: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error searching Zoho for {sku}: {e}")
        return None

def get_items_without_legacy_id(supabase: Client) -> List[Dict]:
    """Get items without legacy_item_id, grouped by base SKU to avoid conflicts"""
    try:
        logger.info("🔍 Getting items from Supabase that need legacy_item_id...")
        response = supabase.table('items').select('id, sku, name, legacy_item_id, brand_id, created_date').is_('legacy_item_id', 'null').execute()
        items = response.data
        
        # Filter out items with empty SKUs
        valid_items = [item for item in items if item.get('sku') and item['sku'].strip()]
        
        # Group by base SKU and keep only one representative per base SKU
        base_sku_groups = {}
        for item in valid_items:
            base_sku = get_base_sku(item['sku'])
            if base_sku not in base_sku_groups:
                base_sku_groups[base_sku] = []
            base_sku_groups[base_sku].append(item)
        
        # Select one item per base SKU group (prefer exact base SKU, then earliest created)
        selected_items = []
        for base_sku, group in base_sku_groups.items():
            if len(group) == 1:
                selected_items.append(group[0])
            else:
                # Prefer item with exact base SKU match
                exact_match = next((item for item in group if item['sku'] == base_sku), None)
                if exact_match:
                    selected_items.append(exact_match)
                    logger.info(f"📌 Selected base SKU {base_sku} (from {len(group)} variants)")
                else:
                    # No exact base match, take the earliest created
                    earliest = min(group, key=lambda x: x['created_date'])
                    selected_items.append(earliest)
                    logger.info(f"📌 Selected earliest variant {earliest['sku']} for base {base_sku} (from {len(group)} variants)")
        
        logger.info(f"📊 Found {len(items)} items without legacy_item_id")
        logger.info(f"✅ Selected {len(selected_items)} representative items (avoiding SKU conflicts)")
        logger.info(f"🔄 Deduplication saved {len(valid_items) - len(selected_items)} potential conflicts")
        
        return selected_items
        
    except Exception as e:
        logger.error(f"❌ Error fetching items from Supabase: {e}")
        return []

def check_legacy_id_exists(supabase: Client, legacy_item_id: str) -> Optional[Dict]:
    """Check if a legacy_item_id already exists"""
    try:
        response = supabase.table('items').select('id, sku, name').eq('legacy_item_id', legacy_item_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"❌ Error checking legacy_item_id {legacy_item_id}: {e}")
        return None

def update_item_legacy_id(supabase: Client, item_id: str, item_sku: str, legacy_item_id: str) -> bool:
    """Update item's legacy_item_id in Supabase"""
    try:
        existing_item = check_legacy_id_exists(supabase, legacy_item_id)
        if existing_item:
            logger.warning(f"⚠️  Legacy ID {legacy_item_id} already exists for {existing_item['sku']}")
            return False
        
        response = supabase.table('items').update({
            'legacy_item_id': legacy_item_id
        }).eq('id', item_id).execute()
        
        if response.data:
            return True
        else:
            logger.error(f"❌ Failed to update item {item_id}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error updating item {item_id}: {e}")
        return False

def main():
    """Main function"""
    logger.info("🚀 Starting SMART legacy_item_id sync with variant handling")
    
    supabase = init_supabase()
    
    # Test Zoho connection
    try:
        get_zoho_access_token()
        logger.info("✅ Zoho API connection successful")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Zoho API: {e}")
        sys.exit(1)
    
    # Get items (deduplicated by base SKU)
    items = get_items_without_legacy_id(supabase)
    
    if not items:
        logger.info("✅ No items need legacy_item_id updates")
        return
    
    # Process items
    total_items = len(items)
    updated_count = 0
    not_found_count = 0
    error_count = 0
    conflict_count = 0
    
    logger.info(f"\n🔄 Processing {total_items} deduplicated items...")
    logger.info("=" * 60)
    
    for i, item in enumerate(items, 1):
        progress = f"({i}/{total_items})"
        logger.info(f"\n📍 {progress} Processing: {item['sku']} | {item['name'][:50]}...")
        
        # Smart search (tries exact SKU, then base SKU for variants)
        legacy_item_id = search_zoho_item_smart(item['sku'])
        
        if legacy_item_id:
            if update_item_legacy_id(supabase, item['id'], item['sku'], legacy_item_id):
                logger.info(f"   ✅ SUCCESS: {item['sku']} -> {legacy_item_id}")
                updated_count += 1
            else:
                logger.warning(f"   ⚠️  CONFLICT: {item['sku']} -> {legacy_item_id}")
                conflict_count += 1
        else:
            logger.info(f"   ℹ️  NOT FOUND: {item['sku']}")
            not_found_count += 1
        
        # Progress summary every 10 items
        if i % 10 == 0:
            success_rate = (updated_count / i) * 100
            logger.info(f"\n📊 Progress: {i}/{total_items} ({success_rate:.1f}% success rate)")
        
        # Rate limiting
        time.sleep(DELAY_MS / 1000.0)
    
    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("📊 SMART SYNC SUMMARY")
    logger.info("=" * 60)
    logger.info(f"✅ Successfully synced: {updated_count}")
    logger.info(f"ℹ️  Not found in Zoho: {not_found_count}")
    logger.info(f"⚠️  Conflicts avoided: {conflict_count}")
    logger.info(f"❌ Errors: {error_count}")
    
    success_rate = (updated_count / total_items) * 100 if total_items > 0 else 0
    logger.info(f"📈 Success rate: {success_rate:.1f}%")
    logger.info("=" * 60)

if __name__ == "__main__":
    main()