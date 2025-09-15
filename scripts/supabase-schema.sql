-- Supabase Schema for Firebase Migration
-- Following existing schema patterns and conventions

-- =====================================================
-- BRANDS TABLE
-- =====================================================
CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  brand_name character varying NOT NULL,
  brand_normalized character varying NOT NULL,
  logo_url text,
  company_id uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT brands_pkey PRIMARY KEY (id),
  CONSTRAINT brands_unique_company_name UNIQUE (company_id, brand_normalized),
  CONSTRAINT brands_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- =====================================================
-- WAREHOUSES TABLE
-- =====================================================
CREATE TABLE public.warehouses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  warehouse_name character varying NOT NULL,
  address_1 character varying NOT NULL,
  address_2 character varying,
  city_town character varying NOT NULL,
  county character varying,
  postcode character varying NOT NULL,
  warehouse_contact_phone character varying,
  warehouse_contact_email character varying,
  warehouse_users uuid[] DEFAULT '{}',
  warehouse_primary_user uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouses_pkey PRIMARY KEY (id),
  CONSTRAINT warehouses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT warehouses_primary_user_fkey FOREIGN KEY (warehouse_primary_user) REFERENCES public.users(id)
);

-- =====================================================
-- COURIERS TABLE
-- =====================================================
CREATE TABLE public.couriers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  courier_name character varying NOT NULL,
  courier_logo_url text,
  address_1 character varying,
  address_2 character varying,
  city_town character varying,
  county character varying,
  postcode character varying,
  courier_contact_phone character varying,
  courier_contact_email character varying,
  courier_payment_terms integer DEFAULT 30,
  courier_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT couriers_pkey PRIMARY KEY (id),
  CONSTRAINT couriers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

-- =====================================================
-- ITEMS TABLE
-- =====================================================
CREATE TABLE public.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  legacy_item_id character varying UNIQUE,
  name character varying NOT NULL,
  description text,
  category character varying,
  colour character varying,
  image_url text,
  brand_id uuid,
  manufacturer character varying,
  sku character varying NOT NULL,
  ean character varying,
  catalogue_page_number integer,
  packing_unit integer DEFAULT 1,
  purchase_price numeric(10,2),
  cost_price numeric(10,2),
  retail_price numeric(10,2),
  discount boolean DEFAULT false,
  discount_percentage numeric(5,2),
  discount_amount numeric(10,2),
  gross_stock_level integer DEFAULT 0,
  committed_stock integer DEFAULT 0,
  net_stock_level integer GENERATED ALWAYS AS (gross_stock_level - committed_stock) STORED,
  reorder_level integer DEFAULT 0,
  warehouse_id uuid,
  weight numeric(10,3),
  height numeric(10,2),
  width numeric(10,2),
  length numeric(10,2),
  diameter numeric(10,2),
  status character varying DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_date timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT items_pkey PRIMARY KEY (id),
  CONSTRAINT items_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT items_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id)
);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  legacy_order_number character varying UNIQUE,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  order_status character varying NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  returns boolean DEFAULT false,
  items_returned jsonb,
  return_reason text,
  sub_total numeric(10,2) NOT NULL DEFAULT 0,
  discount_applied boolean DEFAULT false,
  discount_percentage numeric(5,2),
  total numeric(10,2) NOT NULL DEFAULT 0,
  total_invoiced numeric(10,2) DEFAULT 0,
  number_of_invoices integer DEFAULT 0,
  customer_id uuid NOT NULL,
  sales_id uuid,
  shipment_id uuid,
  invoice_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT orders_sales_id_fkey FOREIGN KEY (sales_id) REFERENCES public.users(id)
);

-- =====================================================
-- ORDER_LINE_ITEMS TABLE
-- =====================================================
CREATE TABLE public.order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  item_id uuid NOT NULL,
  item_name character varying NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  quantity_packed integer DEFAULT 0,
  quantity_shipped integer DEFAULT 0,
  quantity_delivered integer DEFAULT 0,
  quantity_invoiced integer DEFAULT 0,
  quantity_cancelled integer DEFAULT 0,
  quantity_returned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_line_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_line_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);

-- =====================================================
-- INVOICES TABLE
-- =====================================================
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_type character varying NOT NULL CHECK (order_type IN ('sales_order', 'purchase_order')),
  order_id uuid,
  purchase_order_id uuid,
  company_id uuid NOT NULL,
  brand_id uuid,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_payment_url text,
  billing_address_1 character varying,
  billing_address_2 character varying,
  billing_city_town character varying,
  billing_county character varying,
  billing_postcode character varying,
  invoice_status character varying NOT NULL DEFAULT 'draft' CHECK (invoice_status IN ('draft', 'sent', 'received', 'overdue', 'paid')),
  client_viewed boolean DEFAULT false,
  total numeric(10,2) NOT NULL,
  balance numeric(10,2) NOT NULL,
  payment_reference character varying,
  reminder_sent boolean DEFAULT false,
  number_of_reminders integer DEFAULT 0,
  date_last_reminder timestamp with time zone,
  payment_terms integer DEFAULT 30,
  adjusted boolean DEFAULT false,
  adjusted_amount numeric(10,2),
  write_off boolean DEFAULT false,
  write_off_amount numeric(10,2),
  date_due date,
  days_due integer,
  customer_id uuid,
  sales_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT invoices_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT invoices_sales_id_fkey FOREIGN KEY (sales_id) REFERENCES public.users(id),
  CONSTRAINT invoice_order_type_check CHECK (
    (order_type = 'sales_order' AND order_id IS NOT NULL AND purchase_order_id IS NULL) OR
    (order_type = 'purchase_order' AND purchase_order_id IS NOT NULL AND order_id IS NULL)
  )
);

-- =====================================================
-- SHIPMENTS TABLE
-- =====================================================
CREATE TABLE public.shipments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL,
  shipment_status character varying NOT NULL DEFAULT 'pending' CHECK (shipment_status IN ('pending', 'packed', 'shipped', 'in_transit', 'delivered', 'failed', 'returned')),
  courier_id uuid,
  customer_id uuid NOT NULL,
  order_id uuid NOT NULL,
  date_shipped timestamp with time zone,
  order_tracking_number character varying,
  order_tracking_url text,
  number_of_boxes integer DEFAULT 1,
  date_delivered timestamp with time zone,
  non_delivered boolean DEFAULT false,
  non_delivered_reason text,
  re_delivery_booked boolean DEFAULT false,
  re_delivery_date date,
  delivery_cancelled boolean DEFAULT false,
  cancelled_reason text,
  items_packed integer DEFAULT 0,
  items_shipped integer DEFAULT 0,
  items_delivered integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shipments_pkey PRIMARY KEY (id),
  CONSTRAINT shipments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id),
  CONSTRAINT shipments_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.couriers(id),
  CONSTRAINT shipments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

-- =====================================================
-- PURCHASE_ORDERS TABLE
-- =====================================================
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  legacy_purchase_order_id character varying UNIQUE,
  company_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  quantity_of_items integer DEFAULT 0,
  order_status character varying NOT NULL DEFAULT 'draft' CHECK (order_status IN ('draft', 'sent', 'confirmed', 'in_transit', 'received')),
  vat_treatment character varying,
  order_sub_total numeric(10,2) NOT NULL DEFAULT 0,
  discount boolean DEFAULT false,
  discount_percentage numeric(5,2),
  discount_amount numeric(10,2),
  order_total numeric(10,2) NOT NULL DEFAULT 0,
  delivery_address_1 character varying,
  delivery_address_2 character varying,
  delivery_city_town character varying,
  delivery_county character varying,
  delivery_postcode character varying,
  is_shipped character varying DEFAULT 'no' CHECK (is_shipped IN ('no', 'partly', 'in_full')),
  estimated_arrival date,
  shipped_with uuid,
  items_backordered boolean DEFAULT false,
  backorder_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT purchase_orders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT purchase_orders_shipped_with_fkey FOREIGN KEY (shipped_with) REFERENCES public.couriers(id)
);

-- =====================================================
-- PURCHASE_ORDER_LINE_ITEMS TABLE
-- =====================================================
CREATE TABLE public.purchase_order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL,
  item_id uuid NOT NULL,
  item_name character varying NOT NULL,
  quantity_ordered integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  quantity_received integer DEFAULT 0,
  quantity_outstanding integer GENERATED ALWAYS AS (quantity_ordered - quantity_received) STORED,
  quantity_backordered integer DEFAULT 0,
  backorder_id uuid,
  received_date timestamp with time zone,
  batch_number character varying,
  expiry_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_order_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_line_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_line_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id)
);

-- =====================================================
-- BACKORDERS TABLE
-- =====================================================
CREATE TABLE public.backorders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  purchase_order_id uuid NOT NULL,
  backorder_status character varying NOT NULL DEFAULT 'pending' CHECK (backorder_status IN ('pending', 'partially_fulfilled', 'fulfilled', 'cancelled')),
  original_order_date date NOT NULL,
  expected_arrival_date date,
  actual_arrival_date date,
  items_on_backorder integer NOT NULL DEFAULT 0,
  backorder_value numeric(10,2) NOT NULL DEFAULT 0,
  items_received integer DEFAULT 0,
  items_outstanding integer GENERATED ALWAYS AS (items_on_backorder - items_received) STORED,
  backorder_details jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT backorders_pkey PRIMARY KEY (id),
  CONSTRAINT backorders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT backorders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT backorders_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id)
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  notification_type character varying NOT NULL CHECK (notification_type IN ('order_update', 'backorder', 'shipment', 'invoice', 'payment', 'inventory', 'system')),
  title character varying NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  priority character varying DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  related_entity_type character varying,
  related_entity_id uuid,
  action_url text,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  subject character varying NOT NULL,
  status character varying DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority character varying DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to uuid,
  messages jsonb DEFAULT '[]'::jsonb,
  tags text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id),
  CONSTRAINT conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id)
);

-- =====================================================
-- Add Foreign Key Constraints that reference tables created above
-- =====================================================
ALTER TABLE public.orders ADD CONSTRAINT orders_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);
ALTER TABLE public.purchase_orders ADD CONSTRAINT purchase_orders_backorder_id_fkey FOREIGN KEY (backorder_id) REFERENCES public.backorders(id);
ALTER TABLE public.purchase_order_line_items ADD CONSTRAINT purchase_order_line_items_backorder_id_fkey FOREIGN KEY (backorder_id) REFERENCES public.backorders(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_items_brand_id ON public.items(brand_id);
CREATE INDEX idx_items_warehouse_id ON public.items(warehouse_id);
CREATE INDEX idx_items_sku ON public.items(sku);
CREATE INDEX idx_items_legacy_id ON public.items(legacy_item_id);

CREATE INDEX idx_orders_company_id ON public.orders(company_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_sales_id ON public.orders(sales_id);
CREATE INDEX idx_orders_legacy_number ON public.orders(legacy_order_number);
CREATE INDEX idx_orders_order_date ON public.orders(order_date);

CREATE INDEX idx_order_line_items_order_id ON public.order_line_items(order_id);
CREATE INDEX idx_order_line_items_item_id ON public.order_line_items(item_id);

CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX idx_invoices_status ON public.invoices(invoice_status);

CREATE INDEX idx_shipments_order_id ON public.shipments(order_id);
CREATE INDEX idx_shipments_customer_id ON public.shipments(customer_id);
CREATE INDEX idx_shipments_status ON public.shipments(shipment_status);

CREATE INDEX idx_purchase_orders_company_id ON public.purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_brand_id ON public.purchase_orders(brand_id);
CREATE INDEX idx_purchase_orders_legacy_id ON public.purchase_orders(legacy_purchase_order_id);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

CREATE INDEX idx_conversations_customer_id ON public.conversations(customer_id);
CREATE INDEX idx_conversations_assigned_to ON public.conversations(assigned_to);
CREATE INDEX idx_conversations_status ON public.conversations(status);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backorders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (you'll need to adjust based on your auth setup)
-- Users can only see data from their company
CREATE POLICY "Users can view their company brands" ON public.brands
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can view their company items" ON public.items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.brands b 
      WHERE b.id = items.brand_id 
      AND b.company_id IN (
        SELECT company_id FROM public.users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Add similar policies for other tables as needed

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate days_due for invoices
CREATE OR REPLACE FUNCTION calculate_days_due()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_due IS NOT NULL THEN
        NEW.days_due = CURRENT_DATE - NEW.date_due;
    ELSE
        NEW.days_due = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_couriers_updated_at BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_order_line_items_updated_at BEFORE UPDATE ON public.order_line_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER calculate_invoice_days_due BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE calculate_days_due();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_purchase_order_line_items_updated_at BEFORE UPDATE ON public.purchase_order_line_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_backorders_updated_at BEFORE UPDATE ON public.backorders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();