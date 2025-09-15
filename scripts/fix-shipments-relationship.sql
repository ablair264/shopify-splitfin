-- Fix the ambiguous relationship between orders and shipments
-- This removes the circular reference by dropping the shipment_id from orders table
-- Since we can get shipments through shipments.order_id, we don't need orders.shipment_id

-- First, drop the foreign key constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_shipment_id_fkey;

-- Then, drop the shipment_id column from orders table
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS shipment_id;

-- Now Supabase will only see one relationship path:
-- shipments.order_id -> orders.id
-- This allows us to use shipments(*) in our queries without ambiguity