-- Delete duplicate items with same SKU, keeping the most recently created record
-- This will handle foreign key constraints by deleting dependent records first

BEGIN;

-- First, let's see what duplicates we have
SELECT 
    sku,
    COUNT(*) as duplicate_count,
    MIN(created_date) as oldest_created,
    MAX(created_date) as newest_created
FROM items 
WHERE sku IS NOT NULL 
AND sku != ''
GROUP BY sku 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Create a temporary table with items to delete (older duplicates)
CREATE TEMP TABLE items_to_delete AS
SELECT 
    i1.id,
    i1.sku,
    i1.created_date,
    i1.name
FROM items i1
WHERE EXISTS (
    SELECT 1 
    FROM items i2 
    WHERE i2.sku = i1.sku 
    AND i2.id != i1.id
    AND i2.created_date > i1.created_date  -- Keep the newer one
)
AND i1.sku IS NOT NULL 
AND i1.sku != '';

-- Show what will be deleted
SELECT 
    'Items to be deleted:' as info,
    COUNT(*) as count
FROM items_to_delete;

SELECT 
    sku,
    name,
    created_date,
    'WILL BE DELETED' as status
FROM items_to_delete
ORDER BY sku, created_date;

-- Delete from dependent tables first
-- Delete from order_line_items
DELETE FROM order_line_items 
WHERE item_id IN (SELECT id FROM items_to_delete);

-- Delete from purchase_order_line_items
DELETE FROM purchase_order_line_items 
WHERE item_id IN (SELECT id FROM items_to_delete);

-- Delete from product_performance_aggregated
DELETE FROM product_performance_aggregated 
WHERE item_id IN (SELECT id FROM items_to_delete);

-- Finally, delete the duplicate items (keeping the newest)
DELETE FROM items 
WHERE id IN (SELECT id FROM items_to_delete);

-- Show summary of what was deleted
SELECT 
    'Duplicate items deleted' as operation,
    (SELECT COUNT(*) FROM items_to_delete) as items_deleted;

-- Verify no duplicates remain
SELECT 
    sku,
    COUNT(*) as count,
    'REMAINING DUPLICATES' as status
FROM items 
WHERE sku IS NOT NULL 
AND sku != ''
GROUP BY sku 
HAVING COUNT(*) > 1;

-- Clean up temp table
DROP TABLE items_to_delete;

COMMIT;

-- Final verification - show remaining item counts by SKU
SELECT 
    'Final check - SKUs with multiple records:' as info,
    COUNT(*) as duplicate_skus_remaining
FROM (
    SELECT sku 
    FROM items 
    WHERE sku IS NOT NULL AND sku != ''
    GROUP BY sku 
    HAVING COUNT(*) > 1
) duplicates;