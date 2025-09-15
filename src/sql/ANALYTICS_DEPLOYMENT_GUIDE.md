# Analytics Aggregation Deployment Guide

This guide walks through deploying the comprehensive analytics aggregation system for Splitfin.

## 🚀 Overview

The analytics aggregation system pre-calculates complex analytics queries, reducing load times from processing 25,000+ records to fetching pre-aggregated results. This dramatically improves performance for:

- Dashboard widgets
- Custom analytics pages
- Inventory trend charts
- Sales performance metrics
- Customer analytics
- Financial reporting

## 📋 Prerequisites

1. Supabase project with admin access
2. pg_cron extension enabled
3. Sufficient database compute for initial data processing

## 🔧 Deployment Steps

### Step 1: Deploy Core Brand Trends (Already Created)
```sql
-- Run in Supabase SQL Editor:
-- /src/sql/brand_trends_aggregation.sql
```

### Step 2: Deploy Comprehensive Analytics System
```sql
-- Run in Supabase SQL Editor:
-- /src/sql/analytics_aggregations.sql
```

### Step 3: Enable CRON Jobs
```sql
-- Hourly refresh of recent data (last 7 days)
SELECT cron.schedule(
  'refresh-analytics-hourly',
  '0 * * * *',
  'SELECT refresh_recent_analytics();'
);

-- Daily full refresh at 2 AM (last year)
SELECT cron.schedule(
  'refresh-analytics-daily',
  '0 2 * * *',
  'SELECT refresh_all_analytics(NULL, (CURRENT_DATE - INTERVAL ''1 year'')::date, CURRENT_DATE);'
);
```

### Step 4: Verify Installation
```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%_aggregated';

-- Check initial data population
SELECT 
  'sales_performance' as table_name,
  COUNT(*) as records,
  MIN(period_date) as earliest,
  MAX(period_date) as latest
FROM sales_performance_aggregated
UNION ALL
SELECT 
  'brand_trends',
  COUNT(*),
  MIN(period_date),
  MAX(period_date)
FROM brand_trends_aggregated
UNION ALL
SELECT 
  'product_performance',
  COUNT(*),
  MIN(period_date),
  MAX(period_date)
FROM product_performance_aggregated;

-- Check CRON jobs
SELECT jobname, schedule, active FROM cron.job;
```

## 📊 Available Data Sources

### 1. Sales Performance
```typescript
// Usage in React components:
import { useSalesMetrics } from '../hooks/useAggregatedData';

const { data, loading, error } = useSalesMetrics(
  companyId, 
  'month',  // day, week, month, year
  { start: startDate, end: endDate }
);
```

**Available Metrics:**
- Total Revenue
- Order Count  
- Average Order Value
- Items Sold
- Customer Metrics (new, repeat, unique)

### 2. Brand Trends
```typescript
import { useBrandTrends } from '../hooks/useAggregatedData';

const { data, loading, error } = useBrandTrends(companyId, 'month');
```

**Available Metrics:**
- Units sold by brand
- Order count by brand
- Time-series trending

### 3. Inventory Metrics
```typescript
import { useInventoryMetrics } from '../hooks/useAggregatedData';

const { data, loading, error } = useInventoryMetrics(companyId, brandId);
```

**Available Metrics:**
- Stock Value
- Items in Stock
- Turnover Ratios
- Reorder Alerts

### 4. Financial Performance
```typescript
import { useFinancialMetrics } from '../hooks/useAggregatedData';

const { data, loading, error } = useFinancialMetrics(companyId, 'month');
```

**Available Metrics:**
- Gross/Net Revenue
- Receivables
- Overdue Amounts
- Margin Analysis

### 5. Product Performance
```typescript
import { useAggregatedData } from '../hooks/useAggregatedData';

const { data, loading, error } = useAggregatedData({
  dataSource: 'productPerformance',
  metrics: ['quantitySold', 'revenue'],
  filters: { company_id: companyId }
});
```

## 🔄 Migration Strategy

### Option 1: Immediate Switch
Replace existing data fetching with aggregated hooks:

```typescript
// OLD - Direct query
const { data } = await supabase.from('order_line_items')...

// NEW - Aggregated data
const { data } = useSalesMetrics(companyId, 'day');
```

### Option 2: Feature Flag
Implement feature flag to gradually roll out:

```typescript
const useAggregatedAnalytics = process.env.REACT_APP_USE_AGGREGATED_ANALYTICS === 'true';

const Component = () => {
  return useAggregatedAnalytics ? 
    <BrandTrendChartOptimized companyId={companyId} /> :
    <BrandTrendChart companyId={companyId} />;
};
```

### Option 3: A/B Test
Compare performance between old and new approaches.

## 🔍 Monitoring & Maintenance

### Performance Monitoring
```sql
-- Check refresh performance
SELECT 
  jobname,
  start_time,
  end_time,
  (end_time - start_time) as duration,
  status
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- Check data freshness
SELECT 
  table_name,
  MAX(updated_at) as last_updated,
  NOW() - MAX(updated_at) as staleness
FROM (
  SELECT 'sales_performance' as table_name, updated_at FROM sales_performance_aggregated
  UNION ALL
  SELECT 'brand_trends', updated_at FROM brand_trends_aggregated
  UNION ALL
  SELECT 'inventory_metrics', updated_at FROM inventory_metrics_aggregated
) t
GROUP BY table_name;
```

### Data Quality Checks
```sql
-- Verify aggregations match raw data (spot check)
WITH raw_sales AS (
  SELECT 
    DATE_TRUNC('day', order_date)::date as period_date,
    SUM(total) as raw_revenue,
    COUNT(*) as raw_orders
  FROM orders 
  WHERE company_id = 'your-company-id'
    AND order_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY DATE_TRUNC('day', order_date)
),
agg_sales AS (
  SELECT 
    period_date,
    total_revenue as agg_revenue,
    total_orders as agg_orders
  FROM sales_performance_aggregated
  WHERE company_id = 'your-company-id'
    AND period_type = 'day'
    AND period_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  r.period_date,
  r.raw_revenue,
  a.agg_revenue,
  r.raw_orders,
  a.agg_orders,
  CASE 
    WHEN r.raw_revenue = a.agg_revenue THEN '✓ Match'
    ELSE '✗ Mismatch'
  END as revenue_check
FROM raw_sales r
FULL OUTER JOIN agg_sales a ON r.period_date = a.period_date
ORDER BY r.period_date;
```

### Manual Refresh Options
```sql
-- Refresh specific company (emergency)
SELECT refresh_all_analytics('company-uuid-here', '2024-01-01'::date, CURRENT_DATE);

-- Rebuild from scratch (if data issues)
TRUNCATE brand_trends_aggregated, sales_performance_aggregated, 
         product_performance_aggregated, inventory_metrics_aggregated,
         customer_analytics_aggregated, financial_metrics_aggregated;
         
SELECT refresh_all_analytics(NULL, (CURRENT_DATE - INTERVAL '3 years')::date, CURRENT_DATE);
```

## 🎯 Performance Benefits

Expected improvements after deployment:

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Brand Trends | 3-5 seconds | 200ms | **95% faster** |
| Sales Dashboard | 5-10 seconds | 300ms | **97% faster** |
| Analytics Widgets | 2-4 seconds | 150ms | **96% faster** |
| Customer Metrics | 4-8 seconds | 250ms | **97% faster** |

## 🚨 Troubleshooting

### Common Issues

1. **"relation does not exist" error**
   ```bash
   # Solution: Run the SQL setup scripts
   psql -f analytics_aggregations.sql
   ```

2. **CRON jobs not running**
   ```sql
   -- Check if pg_cron is enabled
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   
   -- Check job status
   SELECT * FROM cron.job WHERE active = true;
   ```

3. **Slow initial population**
   - Run during off-peak hours
   - Consider chunking by date ranges
   - Monitor database CPU/memory usage

4. **Data inconsistencies**
   - Run data quality checks above
   - Compare aggregated vs raw data samples
   - Check for timezone issues in date calculations

## 🔄 Rollback Plan

If issues arise, rollback steps:

1. **Disable CRON jobs**
   ```sql
   UPDATE cron.job SET active = false WHERE jobname LIKE 'refresh-analytics%';
   ```

2. **Switch components back**
   ```typescript
   // Use feature flag or direct component replacement
   const useOldAnalytics = true;
   ```

3. **Remove aggregation tables** (if needed)
   ```sql
   DROP TABLE IF EXISTS sales_performance_aggregated CASCADE;
   DROP TABLE IF EXISTS brand_trends_aggregated CASCADE;
   -- etc.
   ```

## 🎉 Success Metrics

Track these metrics post-deployment:
- Page load times for analytics dashboards
- Database query performance
- User engagement with analytics features
- Error rates in analytics components
- CRON job success rates

The aggregation system should provide dramatic performance improvements while maintaining data accuracy and enabling richer analytics capabilities across Splitfin.