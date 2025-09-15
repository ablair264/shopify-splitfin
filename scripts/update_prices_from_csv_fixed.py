#!/usr/bin/env python3
"""
Script to update cost_price and retail_price in Supabase from a CSV file.
Specifically designed to handle your CSV format with Code, Cost, MSRP columns.

Usage:
    python update_prices_from_csv_fixed.py prices.csv
"""

import csv
import sys
import os
from supabase import create_client, Client
import logging
import re

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
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def clean_price(price_str: str) -> float:
    """Clean and convert price string to float."""
    if not price_str or price_str.strip() == '':
        return None
    
    try:
        # Remove currency symbols, spaces, and other non-numeric characters except decimal point
        clean_price = re.sub(r'[^\d.,]', '', str(price_str).strip())
        # Handle European decimal format (comma as decimal separator)
        if ',' in clean_price and '.' in clean_price:
            # If both comma and dot, assume comma is thousands separator
            clean_price = clean_price.replace(',', '')
        elif ',' in clean_price:
            # If only comma, assume it's decimal separator
            clean_price = clean_price.replace(',', '.')
        
        price = float(clean_price)
        if price < 0:
            raise ValueError("Price cannot be negative")
        return price
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid price format: '{price_str}' - {e}")
        return None

def read_csv_file(csv_file_path: str) -> list:
    """Read and validate CSV file with your specific format."""
    if not os.path.exists(csv_file_path):
        logger.error(f"CSV file not found: {csv_file_path}")
        sys.exit(1)
    
    records = []
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        
        # Find the header row (should contain "sku", "cost_price", "retail_price")
        header_row_index = None
        headers = None
        
        for i, row in enumerate(reader):
            if len(row) >= 3 and 'sku' in row and 'cost_price' in row:
                header_row_index = i
                headers = row
                break
        
        if header_row_index is None:
            logger.error("Could not find header row with 'sku', 'cost_price', and 'retail_price' columns")
            sys.exit(1)
        
        logger.info(f"Found headers at row {header_row_index + 1}: {headers}")
        
        # Find column indices
        sku_idx = None
        cost_price_idx = None
        retail_price_idx = None
        
        for i, header in enumerate(headers):
            header_lower = header.lower().strip()
            if header_lower == 'sku':
                sku_idx = i
            elif header_lower == 'cost_price':
                cost_price_idx = i
            elif header_lower == 'retail_price':
                retail_price_idx = i
        
        if sku_idx is None:
            logger.error("Could not find 'sku' column")
            sys.exit(1)
        if cost_price_idx is None:
            logger.error("Could not find 'cost_price' column")
            sys.exit(1)
        if retail_price_idx is None:
            logger.error("Could not find 'retail_price' column")
            sys.exit(1)
        
        logger.info(f"Column mapping - SKU: {sku_idx}, Cost Price: {cost_price_idx}, Retail Price: {retail_price_idx}")
        
        # Reset file pointer and skip to data rows
        file.seek(0)
        reader = csv.reader(file)
        for _ in range(header_row_index + 1):
            next(reader, None)
        
        # Process data rows
        for row_num, row in enumerate(reader, start=header_row_index + 2):
            if len(row) <= max(sku_idx, cost_price_idx, retail_price_idx):
                continue  # Skip rows that don't have enough columns
            
            sku = row[sku_idx].strip() if sku_idx < len(row) else ''
            cost_str = row[cost_price_idx].strip() if cost_price_idx < len(row) else ''
            retail_str = row[retail_price_idx].strip() if retail_price_idx < len(row) else ''
            
            if not sku:
                logger.warning(f"Row {row_num}: Missing SKU, skipping")
                continue
            
            cost_price = clean_price(cost_str) if cost_str else None
            retail_price = clean_price(retail_str) if retail_str else None
            
            if cost_price is None and retail_price is None:
                logger.warning(f"Row {row_num}: No valid prices found for SKU {sku}, skipping")
                continue
            
            record = {
                'item_code': sku,
                'cost_price': cost_price,
                'retail_price': retail_price,
                'row_number': row_num
            }
            records.append(record)
    
    logger.info(f"Successfully read {len(records)} records from CSV")
    return records

def update_prices_in_supabase(supabase: Client, records: list, table_name: str = 'items'):
    """Update prices in Supabase by matching SKU only."""
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
                
            # Update by SKU only
            result = supabase.table(table_name).update(update_data).eq('sku', record['item_code']).execute()
            
            if result.data:
                updated_count += 1
                logger.info(f"Updated SKU {record['item_code']}: {update_data}")
            else:
                logger.warning(f"No item found with SKU: {record['item_code']} (CSV row {record['row_number']})")
                error_count += 1
                    
        except Exception as e:
            logger.error(f"Error updating SKU {record['item_code']} (CSV row {record['row_number']}): {e}")
            error_count += 1
    
    logger.info(f"Update completed: {updated_count} successful, {error_count} errors")
    return updated_count, error_count

def main():
    if len(sys.argv) != 2:
        print("Usage: python update_prices_from_csv_fixed.py <csv_file_path>")
        print("\nThis script is designed for CSV files with:")
        print("- sku column (product SKU)")
        print("- cost_price column (cost price)")
        print("- retail_price column (retail price)")
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
    
    # Show sample of what we found
    logger.info("Sample records:")
    for i, record in enumerate(records[:3]):
        logger.info(f"  {record['item_code']}: cost={record['cost_price']}, retail={record['retail_price']}")
    
    if len(records) > 3:
        logger.info(f"  ... and {len(records) - 3} more records")
    
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