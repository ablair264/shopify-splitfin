-- Create user_dashboards table for storing customizable dashboard configurations
CREATE TABLE IF NOT EXISTS public.user_dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  dashboard_id character varying NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  layouts jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_settings jsonb DEFAULT '{
    "colorTheme": "primary",
    "displayMode": "full"
  }'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT user_dashboards_pkey PRIMARY KEY (id),
  CONSTRAINT user_dashboards_user_dashboard_unique UNIQUE (user_id, dashboard_id),
  CONSTRAINT user_dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_dashboards_user_id ON public.user_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_dashboard_id ON public.user_dashboards(dashboard_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_dashboards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own dashboards" ON public.user_dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards" ON public.user_dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards" ON public.user_dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards" ON public.user_dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- Create widget_templates table for storing pre-defined widget templates
CREATE TABLE IF NOT EXISTS public.widget_templates (
  id character varying NOT NULL,
  name character varying NOT NULL,
  description text,
  type character varying NOT NULL CHECK (type IN ('metric', 'chart', 'table', 'activity', 'map', 'custom')),
  display_format character varying NOT NULL,
  data_source character varying NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  icon character varying,
  category character varying DEFAULT 'general'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT widget_templates_pkey PRIMARY KEY (id)
);

-- Insert default widget templates
INSERT INTO public.widget_templates (id, name, description, type, display_format, data_source, config, icon, category) VALUES
  ('revenue-metric', 'Revenue Metric', 'Display total revenue with trend indicator', 'metric', 'MetricCard', 'orders', '{"metric": "totalRevenue", "showTrend": true, "dateRange": "30_days", "variant": "variant1"}', 'FaShoppingCart', 'finance'),
  ('orders-metric', 'Orders Metric', 'Show total order count', 'metric', 'MetricCard', 'orders', '{"metric": "totalOrders", "showTrend": true, "dateRange": "30_days", "variant": "variant2"}', 'FaShoppingCart', 'orders'),
  ('customers-metric', 'Customers Metric', 'Display active customer count', 'metric', 'MetricCard', 'customers', '{"metric": "totalCustomers", "showTrend": true, "dateRange": "30_days", "variant": "variant3"}', 'FaUsers', 'customers'),
  ('aov-metric-square', 'Average Order Value', 'Compact square display of AOV', 'metric', 'MetricCardSquare', 'orders', '{"metric": "averageOrderValue", "showTrend": true, "dateRange": "30_days", "variant": "variant1"}', 'FaShoppingCart', 'finance'),
  ('revenue-trend-chart', 'Revenue Trend Chart', 'Line chart showing revenue over time', 'chart', 'FullGraph', 'orders', '{"metric": "revenue", "chartType": "area", "dateRange": "90_days"}', 'FaChartLine', 'analytics'),
  ('orders-trend-chart', 'Orders Trend Chart', 'Bar chart of order volume', 'chart', 'FullGraph', 'orders', '{"metric": "orders", "chartType": "bar", "dateRange": "30_days"}', 'FaChartLine', 'analytics'),
  ('sales-team-table', 'Sales Team Performance', 'Table showing sales agent performance', 'table', 'DataTable', 'sales_team', '{"columns": [{"key": "name", "header": "Agent Name", "width": "50%"}, {"key": "orders", "header": "Orders", "width": "25%"}, {"key": "revenue", "header": "Revenue", "width": "25%"}]}', 'FaTable', 'sales'),
  ('recent-activities', 'Recent Activities', 'Live feed of recent system activities', 'activity', 'ActivityFeed', 'activities', '{"refreshInterval": 30}', 'FaBolt', 'activity')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  config = EXCLUDED.config;

-- Create dashboard_themes table for storing theme presets
CREATE TABLE IF NOT EXISTS public.dashboard_themes (
  id character varying NOT NULL,
  name character varying NOT NULL,
  colors jsonb NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT dashboard_themes_pkey PRIMARY KEY (id)
);

-- Insert default themes
INSERT INTO public.dashboard_themes (id, name, colors, is_default) VALUES
  ('primary', 'Primary Blue', '{"primary": "#79d5e9", "secondary": "#6bc7db", "accent": "#5ab3c5"}', true),
  ('secondary', 'Secondary Blue', '{"primary": "#799de9", "secondary": "#6b8edb", "accent": "#5a7fc5"}', false),
  ('tertiary', 'Teal', '{"primary": "#79e9c5", "secondary": "#6bdba8", "accent": "#5ac58b"}', false),
  ('orange', 'Orange', '{"primary": "#FF9F00", "secondary": "#e8900a", "accent": "#d18100"}', false),
  ('red', 'Red', '{"primary": "#C96868", "secondary": "#bb5555", "accent": "#ad4242"}', false),
  ('purple', 'Purple', '{"primary": "#A459D1", "secondary": "#9444bd", "accent": "#8430a9"}', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  colors = EXCLUDED.colors;