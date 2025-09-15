-- Shipping Management System Database Setup
-- Run this in your Supabase SQL editor

-- Add warehouse_status to orders table if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_packing_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_packing_by TEXT; -- user_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS packed_by TEXT; -- user_id
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_booked_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_booked_by TEXT; -- user_id

-- Create warehouse_notifications table
CREATE TABLE IF NOT EXISTS warehouse_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'sent_to_packing', 'packed', 'delivery_booked', 'delivered'
  message TEXT NOT NULL,
  sent_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create warehouse_activity_log table for audit trail
CREATE TABLE IF NOT EXISTS warehouse_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'sent_to_packing', 'packed', 'delivery_booked', 'delivered'
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint for warehouse_status values
ALTER TABLE orders ADD CONSTRAINT orders_warehouse_status_check 
CHECK (warehouse_status IN ('pending', 'sent_to_packing', 'packed', 'delivery_booked', 'delivered'));

-- Create function to handle warehouse status updates
CREATE OR REPLACE FUNCTION handle_warehouse_status_update()
RETURNS TRIGGER AS $$
DECLARE
  warehouse_users UUID[];
  warehouse_user UUID;
  notification_message TEXT;
  action_user_name TEXT;
BEGIN
  -- Only proceed if warehouse_status actually changed
  IF OLD.warehouse_status IS DISTINCT FROM NEW.warehouse_status THEN
    
    -- Get the name of the user making the change
    SELECT CONCAT(first_name, ' ', last_name) INTO action_user_name
    FROM users WHERE id = NEW.packed_by OR id = NEW.sent_to_packing_by OR id = NEW.delivery_booked_by
    LIMIT 1;
    
    -- Log the activity
    INSERT INTO warehouse_activity_log (company_id, order_id, user_id, action, previous_status, new_status)
    VALUES (NEW.company_id, NEW.id, COALESCE(NEW.packed_by, NEW.sent_to_packing_by, NEW.delivery_booked_by), NEW.warehouse_status, OLD.warehouse_status, NEW.warehouse_status);
    
    -- Create notifications based on status
    CASE NEW.warehouse_status
      WHEN 'sent_to_packing' THEN
        -- Notify warehouse users
        SELECT ARRAY_AGG(id) INTO warehouse_users
        FROM users 
        WHERE company_id = NEW.company_id 
        AND role = 'warehouse' 
        AND is_active = true;
        
        notification_message := 'Order ' || COALESCE(NEW.legacy_order_number, NEW.id::TEXT) || ' has been sent to packing';
        
        -- Create notifications for each warehouse user
        FOREACH warehouse_user IN ARRAY warehouse_users LOOP
          INSERT INTO warehouse_notifications (company_id, order_id, notification_type, message, sent_to_user_id, sent_by_user_id)
          VALUES (NEW.company_id, NEW.id, 'sent_to_packing', notification_message, warehouse_user, NEW.sent_to_packing_by);
        END LOOP;
        
      WHEN 'packed' THEN
        notification_message := 'Order ' || COALESCE(NEW.legacy_order_number, NEW.id::TEXT) || ' has been packed by ' || COALESCE(action_user_name, 'warehouse staff');
        
        -- Notify the person who sent it to packing
        IF NEW.sent_to_packing_by IS NOT NULL THEN
          INSERT INTO warehouse_notifications (company_id, order_id, notification_type, message, sent_to_user_id, sent_by_user_id)
          VALUES (NEW.company_id, NEW.id, 'packed', notification_message, NEW.sent_to_packing_by, NEW.packed_by);
        END IF;
        
      WHEN 'delivery_booked' THEN
        notification_message := 'Order ' || COALESCE(NEW.legacy_order_number, NEW.id::TEXT) || ' has been booked for delivery';
        
        -- Notify both the sender and packer
        IF NEW.sent_to_packing_by IS NOT NULL THEN
          INSERT INTO warehouse_notifications (company_id, order_id, notification_type, message, sent_to_user_id, sent_by_user_id)
          VALUES (NEW.company_id, NEW.id, 'delivery_booked', notification_message, NEW.sent_to_packing_by, NEW.delivery_booked_by);
        END IF;
        
      WHEN 'delivered' THEN
        notification_message := 'Order ' || COALESCE(NEW.legacy_order_number, NEW.id::TEXT) || ' has been delivered';
        
        -- Notify the sender
        IF NEW.sent_to_packing_by IS NOT NULL THEN
          INSERT INTO warehouse_notifications (company_id, order_id, notification_type, message, sent_to_user_id, sent_by_user_id)
          VALUES (NEW.company_id, NEW.id, 'delivered', notification_message, NEW.sent_to_packing_by, auth.uid());
        END IF;
    END CASE;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for warehouse status updates
DROP TRIGGER IF EXISTS warehouse_status_update_trigger ON orders;
CREATE TRIGGER warehouse_status_update_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_warehouse_status_update();

-- Add RLS policies
ALTER TABLE warehouse_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for warehouse_notifications
CREATE POLICY "Users can view notifications for their company" ON warehouse_notifications
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own notifications" ON warehouse_notifications
  FOR UPDATE USING (sent_to_user_id = auth.uid());

-- RLS policy for warehouse_activity_log
CREATE POLICY "Users can view activity log for their company" ON warehouse_activity_log
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_status ON orders(warehouse_status, company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_notifications_user ON warehouse_notifications(sent_to_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_warehouse_activity_log_order ON warehouse_activity_log(order_id, created_at DESC);

-- Update existing orders to have pending status
UPDATE orders SET warehouse_status = 'pending' WHERE warehouse_status IS NULL;