-- Add missing columns to existing shipments table
-- Run this in your Supabase SQL editor

-- Add company_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='company_id') THEN
        ALTER TABLE shipments ADD COLUMN company_id UUID;
        RAISE NOTICE 'Added company_id column';
    ELSE
        RAISE NOTICE 'company_id column already exists';
    END IF;
END $$;

-- Add customer_id if it doesn't exist  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='customer_id') THEN
        ALTER TABLE shipments ADD COLUMN customer_id UUID;
        RAISE NOTICE 'Added customer_id column';
    ELSE
        RAISE NOTICE 'customer_id column already exists';
    END IF;
END $$;

-- Add order_tracking_number if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='order_tracking_number') THEN
        ALTER TABLE shipments ADD COLUMN order_tracking_number TEXT;
        RAISE NOTICE 'Added order_tracking_number column';
    ELSE
        RAISE NOTICE 'order_tracking_number column already exists';
    END IF;
END $$;

-- Add shipping address columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='shipping_address_1') THEN
        ALTER TABLE shipments ADD COLUMN shipping_address_1 TEXT;
        RAISE NOTICE 'Added shipping_address_1 column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='shipping_address_2') THEN
        ALTER TABLE shipments ADD COLUMN shipping_address_2 TEXT;
        RAISE NOTICE 'Added shipping_address_2 column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='shipping_city_town') THEN
        ALTER TABLE shipments ADD COLUMN shipping_city_town TEXT;
        RAISE NOTICE 'Added shipping_city_town column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='shipping_county') THEN
        ALTER TABLE shipments ADD COLUMN shipping_county TEXT;
        RAISE NOTICE 'Added shipping_county column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='shipping_postcode') THEN
        ALTER TABLE shipments ADD COLUMN shipping_postcode TEXT;
        RAISE NOTICE 'Added shipping_postcode column';
    END IF;
END $$;

-- Add item tracking columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='total_items') THEN
        ALTER TABLE shipments ADD COLUMN total_items INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_items column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='number_of_boxes') THEN
        ALTER TABLE shipments ADD COLUMN number_of_boxes INTEGER DEFAULT 1;
        RAISE NOTICE 'Added number_of_boxes column';
    END IF;
END $$;

-- Add date columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='estimated_delivery_date') THEN
        ALTER TABLE shipments ADD COLUMN estimated_delivery_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added estimated_delivery_date column';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipments' AND column_name='courier_service') THEN
        ALTER TABLE shipments ADD COLUMN courier_service TEXT DEFAULT 'Standard Delivery';
        RAISE NOTICE 'Added courier_service column';
    END IF;
END $$;

-- Add indexes for performance if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipments_order_id') THEN
        CREATE INDEX idx_shipments_order_id ON shipments(order_id);
        RAISE NOTICE 'Added index on order_id';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shipments_company_id') THEN
        CREATE INDEX idx_shipments_company_id ON shipments(company_id);
        RAISE NOTICE 'Added index on company_id';
    END IF;
END $$;

-- Show current table structure
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count FROM information_schema.columns WHERE table_name = 'shipments';
    RAISE NOTICE 'Shipments table now has % columns', col_count;
    RAISE NOTICE 'Ready to run: npm run create-shipments';
END $$;