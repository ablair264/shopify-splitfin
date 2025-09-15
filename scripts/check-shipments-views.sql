-- Check for any views or foreign keys that might create ambiguous relationships
-- between orders and shipments tables

-- 1. Check all foreign key relationships involving orders and shipments
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND (
        (tc.table_name = 'orders' AND ccu.table_name = 'shipments')
        OR (tc.table_name = 'shipments' AND ccu.table_name = 'orders')
    );

-- 2. Check for any views that might be creating relationships
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition ILIKE '%orders%' 
    AND definition ILIKE '%shipments%';