-- Create aggregation table for brand trends
CREATE TABLE IF NOT EXISTS public.brand_trends_aggregated (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  brand_name character varying NOT NULL,
  period_type character varying NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'year')),
  period_date date NOT NULL,
  period_label character varying NOT NULL,
  total_quantity integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT brand_trends_aggregated_pkey PRIMARY KEY (id),
  CONSTRAINT brand_trends_aggregated_unique_period UNIQUE (company_id, brand_id, period_type, period_date),
  CONSTRAINT brand_trends_aggregated_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT brand_trends_aggregated_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_trends_company_period ON public.brand_trends_aggregated(company_id, period_type, period_date);
CREATE INDEX IF NOT EXISTS idx_brand_trends_brand ON public.brand_trends_aggregated(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_trends_updated ON public.brand_trends_aggregated(updated_at);

-- Create function to refresh brand trends data
CREATE OR REPLACE FUNCTION refresh_brand_trends(
  p_company_id uuid DEFAULT NULL,
  p_from_date date DEFAULT CURRENT_DATE - INTERVAL '1 year',
  p_to_date date DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
  -- Clear existing data for the date range (or all if full refresh)
  IF p_company_id IS NOT NULL THEN
    DELETE FROM brand_trends_aggregated 
    WHERE company_id = p_company_id 
    AND period_date >= p_from_date 
    AND period_date <= p_to_date;
  ELSE
    DELETE FROM brand_trends_aggregated 
    WHERE period_date >= p_from_date 
    AND period_date <= p_to_date;
  END IF;

  -- Insert daily aggregations
  INSERT INTO brand_trends_aggregated (
    company_id, brand_id, brand_name, period_type, period_date, period_label, total_quantity, order_count
  )
  SELECT 
    o.company_id,
    b.id as brand_id,
    b.brand_name,
    'day' as period_type,
    o.order_date as period_date,
    TO_CHAR(o.order_date, 'DD Mon') as period_label,
    COALESCE(SUM(oli.quantity), 0) as total_quantity,
    COUNT(DISTINCT o.id) as order_count
  FROM orders o
  INNER JOIN order_line_items oli ON o.id = oli.order_id
  INNER JOIN items i ON oli.item_id = i.id
  INNER JOIN brands b ON i.brand_id = b.id
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
  GROUP BY o.company_id, b.id, b.brand_name, o.order_date;

  -- Insert weekly aggregations
  INSERT INTO brand_trends_aggregated (
    company_id, brand_id, brand_name, period_type, period_date, period_label, total_quantity, order_count
  )
  SELECT 
    o.company_id,
    b.id as brand_id,
    b.brand_name,
    'week' as period_type,
    DATE_TRUNC('week', o.order_date)::date as period_date,
    TO_CHAR(DATE_TRUNC('week', o.order_date), 'DD Mon') as period_label,
    COALESCE(SUM(oli.quantity), 0) as total_quantity,
    COUNT(DISTINCT o.id) as order_count
  FROM orders o
  INNER JOIN order_line_items oli ON o.id = oli.order_id
  INNER JOIN items i ON oli.item_id = i.id
  INNER JOIN brands b ON i.brand_id = b.id
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
  GROUP BY o.company_id, b.id, b.brand_name, DATE_TRUNC('week', o.order_date);

  -- Insert monthly aggregations
  INSERT INTO brand_trends_aggregated (
    company_id, brand_id, brand_name, period_type, period_date, period_label, total_quantity, order_count
  )
  SELECT 
    o.company_id,
    b.id as brand_id,
    b.brand_name,
    'month' as period_type,
    DATE_TRUNC('month', o.order_date)::date as period_date,
    TO_CHAR(DATE_TRUNC('month', o.order_date), 'Mon YY') as period_label,
    COALESCE(SUM(oli.quantity), 0) as total_quantity,
    COUNT(DISTINCT o.id) as order_count
  FROM orders o
  INNER JOIN order_line_items oli ON o.id = oli.order_id
  INNER JOIN items i ON oli.item_id = i.id
  INNER JOIN brands b ON i.brand_id = b.id
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
  GROUP BY o.company_id, b.id, b.brand_name, DATE_TRUNC('month', o.order_date);

  -- Insert yearly aggregations
  INSERT INTO brand_trends_aggregated (
    company_id, brand_id, brand_name, period_type, period_date, period_label, total_quantity, order_count
  )
  SELECT 
    o.company_id,
    b.id as brand_id,
    b.brand_name,
    'year' as period_type,
    DATE_TRUNC('year', o.order_date)::date as period_date,
    TO_CHAR(DATE_TRUNC('year', o.order_date), 'YYYY') as period_label,
    COALESCE(SUM(oli.quantity), 0) as total_quantity,
    COUNT(DISTINCT o.id) as order_count
  FROM orders o
  INNER JOIN order_line_items oli ON o.id = oli.order_id
  INNER JOIN items i ON oli.item_id = i.id
  INNER JOIN brands b ON i.brand_id = b.id
  WHERE o.order_date >= p_from_date 
    AND o.order_date <= p_to_date
    AND o.order_status NOT IN ('cancelled', 'returned')
    AND (p_company_id IS NULL OR o.company_id = p_company_id)
  GROUP BY o.company_id, b.id, b.brand_name, DATE_TRUNC('year', o.order_date);

END;
$$ LANGUAGE plpgsql;

-- Create function to refresh recent data (for CRON job)
CREATE OR REPLACE FUNCTION refresh_recent_brand_trends()
RETURNS void AS $$
BEGIN
  -- Refresh last 7 days of data for all companies
  PERFORM refresh_brand_trends(NULL, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Initial population of data (last 3 years)
SELECT refresh_brand_trends(NULL, (CURRENT_DATE - INTERVAL '3 years')::date, CURRENT_DATE);

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule CRON job to refresh data every hour
-- This needs to be run by a superuser or via Supabase dashboard
-- SELECT cron.schedule('refresh-brand-trends', '0 * * * *', 'SELECT refresh_recent_brand_trends();');

-- To unschedule: SELECT cron.unschedule('refresh-brand-trends');