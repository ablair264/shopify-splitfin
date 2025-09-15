-- ============================================
-- COMPREHENSIVE ANALYTICS AGGREGATION SYSTEM
-- ============================================
-- This creates a complete set of aggregation tables for fast analytics
-- across all areas of the Splitfin application

-- 1. SALES PERFORMANCE AGGREGATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_performance_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_date date NOT NULL,
  period_label character varying NOT NULL,
  
  -- Core sales metrics
  total_revenue numeric NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_items_sold integer NOT NULL DEFAULT 0,
  average_order_value numeric NOT NULL DEFAULT 0,
  
  -- Growth metrics
  revenue_growth_percent numeric DEFAULT 0,
  order_growth_percent numeric DEFAULT 0,
  
  -- Breakdown by status
  pending_orders integer DEFAULT 0,
  confirmed_orders integer DEFAULT 0,
  shipped_orders integer DEFAULT 0,
  delivered_orders integer DEFAULT 0,
  cancelled_orders integer DEFAULT 0,
  
  -- Customer metrics
  unique_customers integer DEFAULT 0,
  new_customers integer DEFAULT 0,
  repeat_customers integer DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT sales_performance_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT sales_performance_unique_period UNIQUE (company_id, period_type, period_date),
  CONSTRAINT sales_performance_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE INDEX idx_sales_performance_lookup ON public.sales_performance_aggregated(company_id, period_type, period_date);

-- 2. INVENTORY METRICS AGGREGATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_metrics_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  brand_id uuid,
  warehouse_id uuid,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_date date NOT NULL,
  
  -- Stock levels
  total_stock_value numeric NOT NULL DEFAULT 0,
  total_items_in_stock integer NOT NULL DEFAULT 0,
  unique_skus integer NOT NULL DEFAULT 0,
  
  -- Movement metrics
  items_received integer DEFAULT 0,
  items_sold integer DEFAULT 0,
  items_returned integer DEFAULT 0,
  
  -- Inventory health
  items_below_reorder integer DEFAULT 0,
  items_out_of_stock integer DEFAULT 0,
  items_overstocked integer DEFAULT 0,
  
  -- Turnover metrics
  inventory_turnover_ratio numeric DEFAULT 0,
  days_inventory_outstanding numeric DEFAULT 0,
  stock_accuracy_percent numeric DEFAULT 100,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT inventory_metrics_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_metrics_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT inventory_metrics_brand_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id),
  CONSTRAINT inventory_metrics_warehouse_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id)
);

CREATE INDEX idx_inventory_metrics_lookup ON public.inventory_metrics_aggregated(company_id, period_type, period_date);
CREATE INDEX idx_inventory_metrics_brand ON public.inventory_metrics_aggregated(brand_id) WHERE brand_id IS NOT NULL;

-- Create partial unique indexes to handle the uniqueness constraints
CREATE UNIQUE INDEX idx_inventory_metrics_unique_all 
ON public.inventory_metrics_aggregated(company_id, brand_id, warehouse_id, period_type, period_date) 
WHERE brand_id IS NOT NULL AND warehouse_id IS NOT NULL;

CREATE UNIQUE INDEX idx_inventory_metrics_unique_brand_only 
ON public.inventory_metrics_aggregated(company_id, brand_id, period_type, period_date) 
WHERE brand_id IS NOT NULL AND warehouse_id IS NULL;

CREATE UNIQUE INDEX idx_inventory_metrics_unique_warehouse_only 
ON public.inventory_metrics_aggregated(company_id, warehouse_id, period_type, period_date) 
WHERE brand_id IS NULL AND warehouse_id IS NOT NULL;

CREATE UNIQUE INDEX idx_inventory_metrics_unique_company_only 
ON public.inventory_metrics_aggregated(company_id, period_type, period_date) 
WHERE brand_id IS NULL AND warehouse_id IS NULL;

-- 3. CUSTOMER ANALYTICS AGGREGATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_analytics_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid,
  customer_segment character varying,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_date date NOT NULL,
  
  -- Purchase behavior
  total_spent numeric NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  average_order_value numeric DEFAULT 0,
  
  -- Engagement metrics
  days_since_last_order integer,
  order_frequency_days numeric,
  lifetime_value numeric DEFAULT 0,
  
  -- Payment behavior
  on_time_payments integer DEFAULT 0,
  late_payments integer DEFAULT 0,
  payment_performance_score numeric DEFAULT 100,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT customer_analytics_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT customer_analytics_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT customer_analytics_customer_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id)
);

CREATE INDEX idx_customer_analytics_lookup ON public.customer_analytics_aggregated(company_id, period_type, period_date);
CREATE INDEX idx_customer_analytics_customer ON public.customer_analytics_aggregated(customer_id) WHERE customer_id IS NOT NULL;

-- Create partial unique indexes for customer analytics
CREATE UNIQUE INDEX idx_customer_analytics_unique_customer 
ON public.customer_analytics_aggregated(company_id, customer_id, period_type, period_date) 
WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX idx_customer_analytics_unique_company 
ON public.customer_analytics_aggregated(company_id, period_type, period_date) 
WHERE customer_id IS NULL;

-- 4. FINANCIAL METRICS AGGREGATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.financial_metrics_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_date date NOT NULL,
  
  -- Revenue metrics
  gross_revenue numeric NOT NULL DEFAULT 0,
  net_revenue numeric NOT NULL DEFAULT 0,
  discounts_given numeric DEFAULT 0,
  returns_value numeric DEFAULT 0,
  
  -- Receivables
  invoices_issued integer DEFAULT 0,
  invoices_paid integer DEFAULT 0,
  total_receivables numeric DEFAULT 0,
  overdue_receivables numeric DEFAULT 0,
  
  -- Cash flow
  cash_collected numeric DEFAULT 0,
  days_sales_outstanding numeric DEFAULT 0,
  
  -- Profitability (if cost data available)
  gross_margin numeric DEFAULT 0,
  gross_margin_percent numeric DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT financial_metrics_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT financial_metrics_unique UNIQUE (company_id, period_type, period_date),
  CONSTRAINT financial_metrics_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);

CREATE INDEX idx_financial_metrics_lookup ON public.financial_metrics_aggregated(company_id, period_type, period_date);

-- 5. PRODUCT PERFORMANCE AGGREGATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.product_performance_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  item_id uuid NOT NULL,
  brand_id uuid,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter', 'year')),
  period_date date NOT NULL,
  
  -- Sales metrics
  quantity_sold integer NOT NULL DEFAULT 0,
  revenue_generated numeric NOT NULL DEFAULT 0,
  times_ordered integer DEFAULT 0,
  
  -- Inventory metrics
  starting_stock integer DEFAULT 0,
  ending_stock integer DEFAULT 0,
  stock_movements integer DEFAULT 0,
  
  -- Performance indicators
  sell_through_rate numeric DEFAULT 0,
  contribution_margin numeric DEFAULT 0,
  return_rate numeric DEFAULT 0,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT product_performance_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT product_performance_unique UNIQUE (company_id, item_id, period_type, period_date),
  CONSTRAINT product_performance_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT product_performance_item_fkey FOREIGN KEY (item_id) REFERENCES public.items(id),
  CONSTRAINT product_performance_brand_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id)
);

CREATE INDEX idx_product_performance_lookup ON public.product_performance_aggregated(company_id, period_type, period_date);
CREATE INDEX idx_product_performance_item ON public.product_performance_aggregated(item_id);
CREATE INDEX idx_product_performance_brand ON public.product_performance_aggregated(brand_id) WHERE brand_id IS NOT NULL;

-- Create partial unique indexes for product performance
CREATE UNIQUE INDEX idx_product_performance_unique_with_brand 
ON public.product_performance_aggregated(company_id, item_id, brand_id, period_type, period_date) 
WHERE brand_id IS NOT NULL;

CREATE UNIQUE INDEX idx_product_performance_unique_without_brand 
ON public.product_performance_aggregated(company_id, item_id, period_type, period_date) 
WHERE brand_id IS NULL;

-- ============================================
-- MASTER REFRESH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION refresh_all_analytics(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Refresh all aggregation tables
  PERFORM refresh_sales_performance(p_company_id, p_from_date, p_to_date);
  PERFORM refresh_inventory_metrics(p_company_id, p_from_date, p_to_date);
  PERFORM refresh_customer_analytics(p_company_id, p_from_date, p_to_date);
  PERFORM refresh_financial_metrics(p_company_id, p_from_date, p_to_date);
  PERFORM refresh_product_performance(p_company_id, p_from_date, p_to_date);
  
  -- Also refresh brand trends (from previous implementation)
  PERFORM refresh_brand_trends(p_company_id, p_from_date, p_to_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INDIVIDUAL REFRESH FUNCTIONS
-- ============================================

-- Sales Performance Refresh
CREATE OR REPLACE FUNCTION refresh_sales_performance(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Clear existing data
  DELETE FROM sales_performance_aggregated 
  WHERE (p_company_id IS NULL OR company_id = p_company_id)
    AND period_date >= p_from_date 
    AND period_date <= p_to_date;

  -- Daily aggregation
  INSERT INTO sales_performance_aggregated (
    company_id, period_type, period_date, period_label,
    total_revenue, total_orders, total_items_sold, average_order_value,
    pending_orders, confirmed_orders, shipped_orders, delivered_orders, cancelled_orders,
    unique_customers, new_customers, repeat_customers
  )
  SELECT 
    o.company_id,
    'day' as period_type,
    o.order_date as period_date,
    TO_CHAR(o.order_date, 'DD Mon YYYY') as period_label,
    COALESCE(SUM(o.total), 0) as total_revenue,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(oli.quantity), 0) as total_items_sold,
    COALESCE(AVG(o.total), 0) as average_order_value,
    COUNT(DISTINCT CASE WHEN o.order_status = 'pending' THEN o.id END) as pending_orders,
    COUNT(DISTINCT CASE WHEN o.order_status = 'confirmed' THEN o.id END) as confirmed_orders,
    COUNT(DISTINCT CASE WHEN o.order_status = 'shipped' THEN o.id END) as shipped_orders,
    COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN o.id END) as delivered_orders,
    COUNT(DISTINCT CASE WHEN o.order_status = 'cancelled' THEN o.id END) as cancelled_orders,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    COUNT(DISTINCT CASE WHEN c.first_order_date = o.order_date THEN c.id END) as new_customers,
    COUNT(DISTINCT CASE WHEN c.order_count > 1 THEN c.id END) as repeat_customers
  FROM orders o
  LEFT JOIN order_line_items oli ON o.id = oli.order_id
  LEFT JOIN customers c ON o.customer_id = c.id
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
  GROUP BY o.company_id, o.order_date;

  -- Weekly aggregation
  INSERT INTO sales_performance_aggregated (
    company_id, period_type, period_date, period_label,
    total_revenue, total_orders, total_items_sold, average_order_value,
    unique_customers
  )
  SELECT 
    company_id,
    'week' as period_type,
    DATE_TRUNC('week', period_date)::date as period_date,
    'Week ' || TO_CHAR(DATE_TRUNC('week', period_date), 'DD Mon') as period_label,
    SUM(total_revenue) as total_revenue,
    SUM(total_orders) as total_orders,
    SUM(total_items_sold) as total_items_sold,
    AVG(average_order_value) as average_order_value,
    SUM(unique_customers) as unique_customers
  FROM sales_performance_aggregated
  WHERE period_type = 'day'
    AND period_date >= p_from_date 
    AND period_date <= p_to_date
    AND (p_company_id IS NULL OR company_id = p_company_id)
  GROUP BY company_id, DATE_TRUNC('week', period_date);

  -- Monthly aggregation
  INSERT INTO sales_performance_aggregated (
    company_id, period_type, period_date, period_label,
    total_revenue, total_orders, total_items_sold, average_order_value,
    unique_customers
  )
  SELECT 
    company_id,
    'month' as period_type,
    DATE_TRUNC('month', period_date)::date as period_date,
    TO_CHAR(DATE_TRUNC('month', period_date), 'Mon YYYY') as period_label,
    SUM(total_revenue) as total_revenue,
    SUM(total_orders) as total_orders,
    SUM(total_items_sold) as total_items_sold,
    AVG(average_order_value) as average_order_value,
    SUM(unique_customers) as unique_customers
  FROM sales_performance_aggregated
  WHERE period_type = 'day'
    AND period_date >= p_from_date 
    AND period_date <= p_to_date
    AND (p_company_id IS NULL OR company_id = p_company_id)
  GROUP BY company_id, DATE_TRUNC('month', period_date);

END;
$$ LANGUAGE plpgsql;

-- Inventory Metrics Refresh
CREATE OR REPLACE FUNCTION refresh_inventory_metrics(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Implementation for inventory metrics
  -- This would calculate stock levels, movements, and turnover ratios
  -- Details depend on your specific inventory tracking needs
END;
$$ LANGUAGE plpgsql;

-- Customer Analytics Refresh
CREATE OR REPLACE FUNCTION refresh_customer_analytics(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Implementation for customer analytics
  -- This would calculate customer lifetime value, purchase patterns, etc.
END;
$$ LANGUAGE plpgsql;

-- Financial Metrics Refresh
CREATE OR REPLACE FUNCTION refresh_financial_metrics(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Implementation for financial metrics
  -- This would calculate revenue, receivables, margins, etc.
END;
$$ LANGUAGE plpgsql;

-- Product Performance Refresh
CREATE OR REPLACE FUNCTION refresh_product_performance(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT (CURRENT_DATE - INTERVAL '7 days')::date,
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Clear existing data
  DELETE FROM product_performance_aggregated 
  WHERE (p_company_id IS NULL OR company_id = p_company_id)
    AND period_date >= p_from_date 
    AND period_date <= p_to_date;

  -- Daily product performance
  INSERT INTO product_performance_aggregated (
    company_id, item_id, brand_id, period_type, period_date,
    quantity_sold, revenue_generated, times_ordered
  )
  SELECT 
    o.company_id,
    oli.item_id,
    i.brand_id,
    'day' as period_type,
    o.order_date as period_date,
    COALESCE(SUM(oli.quantity), 0) as quantity_sold,
    COALESCE(SUM(oli.total_price), 0) as revenue_generated,
    COUNT(DISTINCT o.id) as times_ordered
  FROM orders o
  INNER JOIN order_line_items oli ON o.id = oli.order_id
  LEFT JOIN items i ON oli.item_id = i.id  -- Use LEFT JOIN to handle missing items
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
    AND i.id IS NOT NULL  -- Only include rows where item exists
  GROUP BY o.company_id, oli.item_id, i.brand_id, o.order_date;

END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CRON JOB FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION refresh_recent_analytics()
RETURNS void AS $$
BEGIN
  -- Refresh last 7 days of all analytics data
  PERFORM refresh_all_analytics(NULL, (CURRENT_DATE - INTERVAL '7 days')::date, CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYTICS API VIEWS (For easy querying)
-- ============================================

-- Sales trends view
CREATE OR REPLACE VIEW v_sales_trends AS
SELECT 
  company_id,
  period_type,
  period_date,
  period_label,
  total_revenue,
  total_orders,
  average_order_value,
  LAG(total_revenue) OVER (PARTITION BY company_id, period_type ORDER BY period_date) as prev_revenue,
  CASE 
    WHEN LAG(total_revenue) OVER (PARTITION BY company_id, period_type ORDER BY period_date) > 0 
    THEN ((total_revenue - LAG(total_revenue) OVER (PARTITION BY company_id, period_type ORDER BY period_date)) / LAG(total_revenue) OVER (PARTITION BY company_id, period_type ORDER BY period_date) * 100)
    ELSE 0 
  END as growth_percent
FROM sales_performance_aggregated;

-- Top products view
CREATE OR REPLACE VIEW v_top_products AS
SELECT 
  ppa.company_id,
  ppa.period_type,
  ppa.period_date,
  i.name as product_name,
  i.sku,
  b.brand_name,
  ppa.quantity_sold,
  ppa.revenue_generated,
  RANK() OVER (PARTITION BY ppa.company_id, ppa.period_type, ppa.period_date ORDER BY ppa.revenue_generated DESC) as revenue_rank
FROM product_performance_aggregated ppa
JOIN items i ON ppa.item_id = i.id
JOIN brands b ON ppa.brand_id = b.id;

-- ============================================
-- INITIAL DATA POPULATION
-- ============================================
-- Run full refresh for last 3 years
SELECT refresh_all_analytics(NULL, (CURRENT_DATE - INTERVAL '3 years')::date, CURRENT_DATE);

-- ============================================
-- CRON SCHEDULE (Run in Supabase Dashboard)
-- ============================================
-- Hourly refresh of recent data:
-- SELECT cron.schedule('refresh-analytics-hourly', '0 * * * *', 'SELECT refresh_recent_analytics();');

-- Daily full refresh at 2 AM:
-- SELECT cron.schedule('refresh-analytics-daily', '0 2 * * *', 'SELECT refresh_all_analytics(NULL, (CURRENT_DATE - INTERVAL ''1 year'')::date, CURRENT_DATE);');