-- View all orders created today
SELECT * FROM orders 
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- View all customers created today
SELECT * FROM customers 
WHERE created_date >= CURRENT_DATE
ORDER BY created_date DESC;

-- View all items created/updated today
SELECT * FROM items 
WHERE created_date >= CURRENT_DATE 
   OR updated_at >= CURRENT_DATE
ORDER BY updated_at DESC;

-- View all order line items from today's orders
SELECT oli.*, o.legacy_order_number 
FROM order_line_items oli
JOIN orders o ON oli.order_id = o.id
WHERE o.created_at >= CURRENT_DATE
ORDER BY o.created_at DESC;

-- Count of records created today by table
SELECT 
  'orders' as table_name, 
  COUNT(*) as count 
FROM orders 
WHERE created_at >= CURRENT_DATE
UNION ALL
SELECT 
  'customers' as table_name, 
  COUNT(*) as count 
FROM customers 
WHERE created_date >= CURRENT_DATE
UNION ALL
SELECT 
  'items' as table_name, 
  COUNT(*) as count 
FROM items 
WHERE created_date >= CURRENT_DATE;

-- View all database activity today (if you have audit logs enabled)
-- This depends on your Supabase plan and settings