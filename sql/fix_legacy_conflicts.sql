-- Fix legacy_item_id conflicts by removing duplicate legacy_item_ids
-- Keep the first occurrence and clear the legacy_item_id for duplicates

BEGIN;

-- Show what will be affected
SELECT 
    'Items with duplicate legacy_item_ids that will be cleared:' as info,
    legacy_item_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(sku ORDER BY created_date) as skus_ordered_by_date,
    ARRAY_AGG(id ORDER BY created_date) as ids_ordered_by_date
FROM items 
WHERE legacy_item_id IS NOT NULL
GROUP BY legacy_item_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Create temp table with legacy_item_ids to clear (keep oldest, clear newer ones)
CREATE TEMP TABLE legacy_conflicts AS
WITH ranked_items AS (
    SELECT 
        id,
        legacy_item_id,
        sku,
        created_date,
        ROW_NUMBER() OVER (PARTITION BY legacy_item_id ORDER BY created_date ASC) as rn
    FROM items 
    WHERE legacy_item_id IS NOT NULL
)
SELECT 
    id,
    legacy_item_id,
    sku,
    created_date,
    'WILL CLEAR LEGACY_ID' as action
FROM ranked_items 
WHERE rn > 1;  -- Keep first (rn = 1), clear the rest

-- Show what will be cleared
SELECT 
    'Items that will have legacy_item_id cleared:' as operation,
    COUNT(*) as items_to_clear
FROM legacy_conflicts;

SELECT 
    legacy_item_id,
    sku,
    created_date,
    action
FROM legacy_conflicts
ORDER BY legacy_item_id, created_date;

-- Clear legacy_item_id for duplicate entries (keep the oldest)
UPDATE items 
SET legacy_item_id = NULL 
WHERE id IN (SELECT id FROM legacy_conflicts);

-- Show results
SELECT 
    'Results after clearing duplicates:' as operation,
    (SELECT COUNT(*) FROM legacy_conflicts) as items_cleared,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NOT NULL) as items_with_legacy_id_remaining,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NULL) as items_without_legacy_id_now;

-- Verify no duplicate legacy_item_ids remain
SELECT 
    'Remaining duplicate legacy_item_ids (should be 0):' as verification,
    COUNT(*) as duplicate_legacy_ids_remaining
FROM (
    SELECT legacy_item_id
    FROM items 
    WHERE legacy_item_id IS NOT NULL
    GROUP BY legacy_item_id 
    HAVING COUNT(*) > 1
) duplicates;

DROP TABLE legacy_conflicts;

COMMIT;

-- Final verification
SELECT 
    'FINAL STATUS:' as summary,
    (SELECT COUNT(*) FROM items) as total_items,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NOT NULL) as have_legacy_id,
    (SELECT COUNT(*) FROM items WHERE legacy_item_id IS NULL) as need_legacy_id,
    (SELECT COUNT(DISTINCT legacy_item_id) FROM items WHERE legacy_item_id IS NOT NULL) as unique_legacy_ids;