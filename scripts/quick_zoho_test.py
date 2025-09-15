#!/usr/bin/env python3
"""
Quick test of first 10 items to verify the cost_price vs selling_rate comparison
"""

import pandas as pd
import sys
import os

# Add the parent directory to path so we can import the comparison functions
sys.path.append('/Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/scripts')

from compare_with_zoho import get_zoho_access_token, get_zoho_item_by_sku, compare_prices
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def quick_test():
    """Test first 10 items"""
    csv_file = "/Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/Analysis.csv"
    
    # Load CSV
    df = pd.read_csv(csv_file)
    logger.info(f"Testing first 10 items from {len(df)} total items")
    
    # Test Zoho connection
    try:
        get_zoho_access_token()
        logger.info("✅ Zoho connected")
    except Exception as e:
        logger.error(f"❌ Zoho connection failed: {e}")
        return
    
    print("\n" + "="*80)
    print("COST PRICE vs SELLING PRICE COMPARISON")
    print("="*80)
    
    for i, row in df.head(10).iterrows():
        sku = str(row['sku'])
        csv_cost = float(row['cost_price']) if row['cost_price'] else 0
        csv_name = row['name']
        
        print(f"\n📍 SKU: {sku} | {csv_name}")
        print(f"   CSV Cost Price: £{csv_cost}")
        
        # Get from Zoho
        zoho_item = get_zoho_item_by_sku(sku)
        
        if zoho_item['found']:
            zoho_selling = zoho_item['rate']
            zoho_purchase = zoho_item['purchase_rate']
            
            print(f"   Zoho Selling Price: £{zoho_selling}")
            print(f"   Zoho Purchase Price: £{zoho_purchase}")
            
            # Calculate margins
            if csv_cost and zoho_selling:
                margin = zoho_selling - csv_cost
                margin_pct = (margin / csv_cost) * 100 if csv_cost > 0 else 0
                
                if margin > 0:
                    print(f"   ✅ PROFIT: £{margin:.2f} ({margin_pct:.1f}% markup)")
                elif margin < -0.01:
                    print(f"   ❌ LOSS: £{margin:.2f} ({margin_pct:.1f}% loss)")
                else:
                    print(f"   ➖ BREAK EVEN")
            
            # Price comparison
            comparison = compare_prices(csv_cost, zoho_selling)
            if comparison == 'csv_higher':
                print(f"   ⚠️  WARNING: Your cost (£{csv_cost}) > selling price (£{zoho_selling})")
            elif comparison == 'zoho_higher':
                print(f"   📈 GOOD: Selling (£{zoho_selling}) > cost (£{csv_cost})")
        else:
            print(f"   ❌ Not found in Zoho")
            
        print("-" * 60)

if __name__ == "__main__":
    quick_test()