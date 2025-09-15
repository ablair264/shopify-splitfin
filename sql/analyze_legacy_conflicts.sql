-- Analyze legacy_item_id conflicts to understand the duplicate issue
-- This will help identify why 169 items have legacy_item_id conflicts

-- 1. Find duplicate legacy_item_ids that already exist
SELECT 
    'Existing duplicate legacy_item_ids in Supabase:' as analysis,
    legacy_item_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(sku) as skus_with_same_legacy_id,
    ARRAY_AGG(id) as item_ids
FROM items 
WHERE legacy_item_id IS NOT NULL
GROUP BY legacy_item_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Show items without legacy_item_id (these need syncing)
SELECT 
    'Items still needing legacy_item_id sync:' as analysis,
    COUNT(*) as items_without_legacy_id,
    COUNT(DISTINCT sku) as unique_skus,
    COUNT(*) - COUNT(DISTINCT sku) as duplicate_skus
FROM items 
WHERE legacy_item_id IS NULL;

-- 3. Check for duplicate SKUs in items that need syncing
SELECT 
    'Duplicate SKUs in items needing sync:' as analysis,
    sku,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as item_ids,
    ARRAY_AGG(name) as item_names
FROM items 
WHERE legacy_item_id IS NULL 
AND sku IS NOT NULL 
AND sku != ''
GROUP BY sku 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. Overall summary
SELECT 
    'OVERALL SUMMARY:' as analysis,
    (SELECT COUNT(*) FROM items) as total_items,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NOT NULL) as items_with_legacy_id,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NULL) as items_without_legacy_id,
    (SELECT COUNT(DISTINCT sku) FROM items WHERE legacy_item_id IS NULL) as unique_skus_needing_sync;

-- 5. Sample of items that need syncing (first 10)
SELECT 
    'Sample items needing sync:' as analysis,
    sku,
    name,
    brand_id,
    created_date
FROM items 
WHERE legacy_item_id IS NULL 
AND sku IS NOT NULL 
AND sku != ''
ORDER BY created_date DESC
LIMIT 10;