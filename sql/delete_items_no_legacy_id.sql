-- Delete items with specific brand_id and NULL legacy_item_id
-- This will handle foreign key constraints by deleting dependent records first

BEGIN;

-- First, delete from dependent tables that reference items
-- Delete from order_line_items
DELETE FROM order_line_items 
WHERE item_id IN (
    SELECT id FROM items 
    WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b' 
    AND legacy_item_id IS NULL
);

-- Delete from purchase_order_line_items
DELETE FROM purchase_order_line_items 
WHERE item_id IN (
    SELECT id FROM items 
    WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b' 
    AND legacy_item_id IS NULL
);

-- Delete from product_performance_aggregated
DELETE FROM product_performance_aggregated 
WHERE item_id IN (
    SELECT id FROM items 
    WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b' 
    AND legacy_item_id IS NULL
);

-- Finally, delete the items themselves
DELETE FROM items 
WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b' 
AND legacy_item_id IS NULL;

COMMIT;

-- Check how many items were deleted
SELECT 
    'Items deleted' as operation,
    ROW_NUMBER() OVER() as count
FROM items 
WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b' 
AND legacy_item_id IS NULL;

-- Verify remaining items for this brand
SELECT 
    COUNT(*) as remaining_items,
    COUNT(CASE WHEN legacy_item_id IS NOT NULL THEN 1 END) as items_with_legacy_id,
    COUNT(CASE WHEN legacy_item_id IS NULL THEN 1 END) as items_without_legacy_id
FROM items 
WHERE brand_id = '38877a7c-88bd-4cdb-b19e-b62b8b7c378b';