# Brand Trends CRON Job Setup

## Overview
This document explains how to set up the CRON job for automatically refreshing brand trend data in Supabase.

## Prerequisites
1. The `brand_trends_aggregation.sql` script must be executed first
2. You need admin access to your Supabase project

## Setup Steps

### 1. Enable pg_cron Extension
In Supabase Dashboard:
1. Go to Database → Extensions
2. Search for "pg_cron"
3. Enable it if not already enabled

### 2. Create the CRON Job
Run this SQL in the SQL Editor:

```sql
-- Schedule hourly refresh of recent data (last 7 days)
SELECT cron.schedule(
  'refresh-brand-trends-hourly',
  '0 * * * *',  -- Every hour at minute 0
  'SELECT refresh_recent_brand_trends();'
);

-- Optional: Schedule daily full refresh (last 3 years) at 2 AM
SELECT cron.schedule(
  'refresh-brand-trends-daily',
  '0 2 * * *',  -- Every day at 2 AM
  'SELECT refresh_brand_trends(NULL, CURRENT_DATE - INTERVAL ''3 years'', CURRENT_DATE);'
);
```

### 3. Verify CRON Jobs
```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- Check job run history
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### 4. Manual Refresh Options
```sql
-- Refresh specific company's data
SELECT refresh_brand_trends('company-uuid-here');

-- Refresh all data for a specific date range
SELECT refresh_brand_trends(NULL, '2024-01-01'::date, '2024-12-31'::date);

-- Refresh only recent data (last 7 days)
SELECT refresh_recent_brand_trends();
```

### 5. Monitor Performance
```sql
-- Check aggregation table size
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT company_id) as companies,
  COUNT(DISTINCT brand_id) as brands,
  MIN(period_date) as earliest_date,
  MAX(period_date) as latest_date
FROM brand_trends_aggregated;

-- Check refresh performance
SELECT 
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job;
```

### 6. Manage CRON Jobs
```sql
-- Disable a job temporarily
SELECT cron.alter_job(job_id, active => false);

-- Re-enable a job
SELECT cron.alter_job(job_id, active => true);

-- Delete a job
SELECT cron.unschedule('refresh-brand-trends-hourly');
```

## Performance Considerations
- The hourly job only refreshes the last 7 days of data
- The daily job can do a full refresh if needed
- With 25,000+ order line items, the initial population might take a few minutes
- Subsequent refreshes will be much faster

## Troubleshooting
1. If jobs aren't running, check that pg_cron is enabled
2. Verify the functions exist: `\df refresh_*brand_trends*`
3. Check for errors in `cron.job_run_details`
4. Ensure the database has sufficient resources for aggregation