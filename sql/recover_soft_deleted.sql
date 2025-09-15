-- Check for soft-deleted customers
SELECT * FROM customers 
WHERE is_active = false 
  AND created_date >= CURRENT_DATE - INTERVAL '1 day';

-- Check for soft-deleted items
SELECT * FROM items 
WHERE status = 'inactive' 
  AND created_date >= CURRENT_DATE - INTERVAL '1 day';

-- Check all customers including inactive
SELECT * FROM customers 
ORDER BY created_date DESC 
LIMIT 50;

-- Check all recent orders
SELECT * FROM orders 
ORDER BY created_at DESC 
LIMIT 50;