-- Delete variant SKUs that don't exist in Zoho but whose base SKU does
-- This will clean up items like GS00F, GS00I when only GS00 exists in Zoho

BEGIN;

-- First, let's identify items that might be variants of existing legacy_item_id items
WITH base_sku_analysis AS (
    SELECT 
        id,
        sku,
        name,
        legacy_item_id,
        -- Extract potential base SKU (remove last character if it's a letter)
        CASE 
            WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 
                LEFT(sku, LENGTH(sku) - 1)
            ELSE sku 
        END as potential_base_sku,
        CASE 
            WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 'variant'
            ELSE 'base'
        END as sku_type
    FROM items 
    WHERE brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
),
variants_with_existing_base AS (
    SELECT 
        v.id,
        v.sku,
        v.name,
        v.potential_base_sku,
        b.sku as base_sku_exists,
        b.legacy_item_id as base_legacy_item_id
    FROM base_sku_analysis v
    LEFT JOIN base_sku_analysis b ON (
        b.sku = v.potential_base_sku 
        AND b.legacy_item_id IS NOT NULL
    )
    WHERE v.sku_type = 'variant'
    AND v.legacy_item_id IS NULL
    AND b.legacy_item_id IS NOT NULL  -- Base SKU has legacy_item_id
)
SELECT 
    'Variant items that should be deleted (base SKU exists in Zoho):' as analysis,
    sku as variant_sku,
    potential_base_sku as base_sku,
    base_sku_exists,
    base_legacy_item_id,
    name
FROM variants_with_existing_base
ORDER BY potential_base_sku, sku;

-- Show count
SELECT 
    'Total variant items to delete:' as summary,
    COUNT(*) as count_to_delete
FROM (
    WITH base_sku_analysis AS (
        SELECT 
            id, sku, name, legacy_item_id,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 
                    LEFT(sku, LENGTH(sku) - 1)
                ELSE sku 
            END as potential_base_sku,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 'variant'
                ELSE 'base'
            END as sku_type
        FROM items 
        WHERE brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
    )
    SELECT v.id
    FROM base_sku_analysis v
    LEFT JOIN base_sku_analysis b ON (
        b.sku = v.potential_base_sku 
        AND b.legacy_item_id IS NOT NULL
    )
    WHERE v.sku_type = 'variant'
    AND v.legacy_item_id IS NULL
    AND b.legacy_item_id IS NOT NULL
) variants_to_delete;

-- Uncomment to actually delete these variants
/*
-- Delete from dependent tables first
DELETE FROM order_line_items 
WHERE item_id IN (
    WITH base_sku_analysis AS (
        SELECT 
            id, sku, legacy_item_id,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 
                    LEFT(sku, LENGTH(sku) - 1)
                ELSE sku 
            END as potential_base_sku,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 'variant'
                ELSE 'base'
            END as sku_type
        FROM items 
        WHERE brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
    )
    SELECT v.id
    FROM base_sku_analysis v
    LEFT JOIN base_sku_analysis b ON (
        b.sku = v.potential_base_sku 
        AND b.legacy_item_id IS NOT NULL
    )
    WHERE v.sku_type = 'variant'
    AND v.legacy_item_id IS NULL
    AND b.legacy_item_id IS NOT NULL
);

-- Delete variant items where base already has legacy_item_id
DELETE FROM items
WHERE id IN (
    WITH base_sku_analysis AS (
        SELECT 
            id, sku, legacy_item_id,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 
                    LEFT(sku, LENGTH(sku) - 1)
                ELSE sku 
            END as potential_base_sku,
            CASE 
                WHEN sku ~ '^[A-Z0-9]+[A-Z]$' AND LENGTH(sku) > 1 THEN 'variant'
                ELSE 'base'
            END as sku_type
        FROM items 
        WHERE brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
    )
    SELECT v.id
    FROM base_sku_analysis v
    LEFT JOIN base_sku_analysis b ON (
        b.sku = v.potential_base_sku 
        AND b.legacy_item_id IS NOT NULL
    )
    WHERE v.sku_type = 'variant'
    AND v.legacy_item_id IS NULL
    AND b.legacy_item_id IS NOT NULL
);
*/

COMMIT;

-- Final verification
SELECT 
    'After cleanup - items still needing legacy_item_id:' as final_check,
    COUNT(*) as items_still_needing_sync
FROM items 
WHERE legacy_item_id IS NULL 
AND brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613';