-- Clean up SKU variants that are likely duplicates
-- Keep base SKUs, remove variants with suffixes like F, I, etc.

BEGIN;

-- Identify potential variant SKUs (base SKU + single letter suffix)
WITH sku_analysis AS (
    SELECT 
        sku,
        name,
        id,
        brand_id,
        created_date,
        -- Check if this looks like a variant (ends with single letter)
        CASE 
            WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 
                LEFT(sku, LENGTH(sku) - 1)  -- Base SKU without suffix
            ELSE sku 
        END as base_sku,
        CASE 
            WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 'variant'
            ELSE 'base'
        END as sku_type
    FROM items 
    WHERE legacy_item_id IS NULL
    AND brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'  -- The brand from your sample
),
variant_groups AS (
    SELECT 
        base_sku,
        COUNT(*) as variant_count,
        ARRAY_AGG(sku ORDER BY sku_type, sku) as all_skus,
        ARRAY_AGG(id ORDER BY sku_type, sku) as all_ids,
        ARRAY_AGG(name ORDER BY sku_type, sku) as all_names
    FROM sku_analysis
    GROUP BY base_sku
    HAVING COUNT(*) > 1  -- Only groups with variants
)
SELECT 
    'SKU groups with variants:' as analysis,
    base_sku,
    variant_count,
    all_skus,
    all_names[1] as sample_name
FROM variant_groups
ORDER BY variant_count DESC, base_sku;

-- Show what would be deleted (variants, keeping base)
WITH sku_analysis AS (
    SELECT 
        sku,
        name,
        id,
        brand_id,
        created_date,
        CASE 
            WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 
                LEFT(sku, LENGTH(sku) - 1)
            ELSE sku 
        END as base_sku,
        CASE 
            WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 'variant'
            ELSE 'base'
        END as sku_type
    FROM items 
    WHERE legacy_item_id IS NULL
    AND brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
),
items_to_delete AS (
    SELECT DISTINCT sa1.id, sa1.sku, sa1.name
    FROM sku_analysis sa1
    WHERE sa1.sku_type = 'variant'
    AND EXISTS (
        SELECT 1 FROM sku_analysis sa2 
        WHERE sa2.base_sku = sa1.base_sku 
        AND sa2.sku_type = 'base'
    )
)
SELECT 
    'Variant items that would be deleted:' as operation,
    COUNT(*) as items_to_delete
FROM items_to_delete;

-- Uncomment below to actually delete the variants
/*
-- Delete from dependent tables first
DELETE FROM order_line_items 
WHERE item_id IN (
    WITH sku_analysis AS (
        SELECT 
            sku, id,
            CASE 
                WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 
                    LEFT(sku, LENGTH(sku) - 1)
                ELSE sku 
            END as base_sku,
            CASE 
                WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 'variant'
                ELSE 'base'
            END as sku_type
        FROM items 
        WHERE legacy_item_id IS NULL
        AND brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
    )
    SELECT DISTINCT sa1.id
    FROM sku_analysis sa1
    WHERE sa1.sku_type = 'variant'
    AND EXISTS (
        SELECT 1 FROM sku_analysis sa2 
        WHERE sa2.base_sku = sa1.base_sku 
        AND sa2.sku_type = 'base'
    )
);

-- Delete the variant items
DELETE FROM items
WHERE id IN (
    WITH sku_analysis AS (
        SELECT 
            sku, id,
            CASE 
                WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 
                    LEFT(sku, LENGTH(sku) - 1)
                ELSE sku 
            END as base_sku,
            CASE 
                WHEN sku ~ '[A-Z0-9]+[A-Z]$' AND LENGTH(RIGHT(sku, 1)) = 1 THEN 'variant'
                ELSE 'base'
            END as sku_type
        FROM items 
        WHERE legacy_item_id IS NULL
        AND brand_id = 'aff50b3b-0423-4bb1-b5b4-d59d6e048613'
    )
    SELECT DISTINCT sa1.id
    FROM sku_analysis sa1
    WHERE sa1.sku_type = 'variant'
    AND EXISTS (
        SELECT 1 FROM sku_analysis sa2 
        WHERE sa2.base_sku = sa1.base_sku 
        AND sa2.sku_type = 'base'
    )
);
*/

COMMIT;