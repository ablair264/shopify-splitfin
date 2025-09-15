#!/usr/bin/env python3
"""
Script to update cost_price and retail_price in Supabase from a CSV file.

CSV should have columns:
- item_id (or sku/product_id - whichever identifier you use)
- cost_price 
- retail_price

Usage:
    python update_prices_from_csv.py prices.csv
"""

import csv
import sys
import os
from supabase import create_client, Client
from decimal import Decimal
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://dcgagukbbzfqaymlxnzw.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ2FndWtiYnpmcWF5bWx4bnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MDE3NDcsImV4cCI6MjA3MTk3Nzc0N30.i0EiHKdEWeJVw6RY3AUp-6aqv-ywunCOFe4_7cV2KmM')

def create_supabase_client() -> Client:
    """Create and return Supabase client."""
    if SUPABASE_URL == 'your-supabase-url-here' or SUPABASE_KEY == 'your-supabase-anon-key-here':
        logger.error("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def validate_price(price_str: str) -> float:
    """Validate and convert price string to float."""
    try:
        # Remove currency symbols and whitespace
        clean_price = price_str.strip().replace('£', '').replace('$', '').replace(',', '')
        price = float(clean_price)
        if price < 0:
            raise ValueError("Price cannot be negative")
        return price
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid price format: {price_str} - {e}")
        return None

def read_csv_file(csv_file_path: str) -> list:
    """Read and validate CSV file."""
    if not os.path.exists(csv_file_path):
        logger.error(f"CSV file not found: {csv_file_path}")
        sys.exit(1)
    
    records = []
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        # Try to detect delimiter
        sample = file.read(1024)
        file.seek(0)
        sniffer = csv.Sniffer()
        delimiter = sniffer.sniff(sample).delimiter
        
        reader = csv.DictReader(file, delimiter=delimiter)
        
        # Check if required columns exist
        required_columns = {'item_id', 'cost_price', 'retail_price'}
        available_columns = set(reader.fieldnames)
        
        # Handle different possible column names
        column_mapping = {}
        for required in required_columns:
            if required in available_columns:
                column_mapping[required] = required
            elif required == 'item_id':
                # Try alternative names for item_id
                alternatives = ['sku', 'product_id', 'id', 'item_sku']
                for alt in alternatives:
                    if alt in available_columns:
                        column_mapping['item_id'] = alt
                        break
        
        if 'item_id' not in column_mapping:
            logger.error(f"Required identifier column not found. Available columns: {list(available_columns)}")
            logger.error("Please ensure your CSV has one of: item_id, sku, product_id, id, item_sku")
            sys.exit(1)
        
        if 'cost_price' not in available_columns or 'retail_price' not in available_columns:
            logger.error(f"Required columns 'cost_price' and 'retail_price' not found in CSV")
            logger.error(f"Available columns: {list(available_columns)}")
            sys.exit(1)
        
        logger.info(f"Using column mapping: {column_mapping}")
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 because row 1 is header
            item_id = row.get(column_mapping['item_id'], '').strip()
            cost_price_str = row.get('cost_price', '').strip()
            retail_price_str = row.get('retail_price', '').strip()
            
            if not item_id:
                logger.warning(f"Row {row_num}: Missing item_id, skipping")
                continue
            
            cost_price = validate_price(cost_price_str) if cost_price_str else None
            retail_price = validate_price(retail_price_str) if retail_price_str else None
            
            if cost_price is None and retail_price is None:
                logger.warning(f"Row {row_num}: No valid prices found for item_id {item_id}, skipping")
                continue
            
            record = {
                'item_id': item_id,
                'cost_price': cost_price,
                'retail_price': retail_price,
                'row_number': row_num
            }
            records.append(record)
    
    logger.info(f"Successfully read {len(records)} records from CSV")
    return records

def update_prices_in_supabase(supabase: Client, records: list, table_name: str = 'items'):
    """Update prices in Supabase."""
    updated_count = 0
    error_count = 0
    
    for record in records:
        try:
            # Build update data - only include fields that have values
            update_data = {}
            if record['cost_price'] is not None:
                update_data['cost_price'] = record['cost_price']
            if record['retail_price'] is not None:
                update_data['retail_price'] = record['retail_price']
            
            if not update_data:
                continue
                
            # Try to update by item_id first
            result = supabase.table(table_name).update(update_data).eq('item_id', record['item_id']).execute()
            
            if result.data:
                updated_count += 1
                logger.info(f"Updated item_id {record['item_id']}: {update_data}")
            else:
                # If no match by item_id, try by sku
                result = supabase.table(table_name).update(update_data).eq('sku', record['item_id']).execute()
                if result.data:
                    updated_count += 1
                    logger.info(f"Updated sku {record['item_id']}: {update_data}")
                else:
                    logger.warning(f"No item found with item_id or sku: {record['item_id']} (CSV row {record['row_number']})")
                    error_count += 1
                    
        except Exception as e:
            logger.error(f"Error updating item_id {record['item_id']} (CSV row {record['row_number']}): {e}")
            error_count += 1
    
    logger.info(f"Update completed: {updated_count} successful, {error_count} errors")
    return updated_count, error_count

def main():
    if len(sys.argv) != 2:
        print("Usage: python update_prices_from_csv.py <csv_file_path>")
        print("\nCSV should have columns:")
        print("- item_id (or sku/product_id/id)")
        print("- cost_price")
        print("- retail_price")
        print("\nEnvironment variables required:")
        print("- SUPABASE_URL")
        print("- SUPABASE_ANON_KEY")
        sys.exit(1)
    
    csv_file_path = sys.argv[1]
    
    logger.info("Starting price update process...")
    
    # Create Supabase client
    supabase = create_supabase_client()
    
    # Read CSV file
    records = read_csv_file(csv_file_path)
    
    if not records:
        logger.error("No valid records found in CSV file")
        sys.exit(1)
    
    # Confirm before proceeding
    response = input(f"\nReady to update {len(records)} records in Supabase. Continue? (y/N): ")
    if response.lower() != 'y':
        logger.info("Update cancelled by user")
        sys.exit(0)
    
    # Update prices in Supabase
    updated_count, error_count = update_prices_in_supabase(supabase, records)
    
    logger.info(f"Process completed: {updated_count} items updated, {error_count} errors")
    
    if error_count > 0:
        logger.warning("Some items could not be updated. Check the logs above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()