import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { ANALYTICS_DATA_SOURCES, buildAggregatedQuery } from '../config/analyticsDataSources';

interface UseAggregatedDataOptions {
  dataSource: string;
  metrics: string[];
  filters?: Record<string, any>;
  groupBy?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  periodType?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  dateRange?: { start: Date; end: Date };
  realTime?: boolean;
}

interface UseAggregatedDataResult<T = any> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAggregatedData<T = any>({
  dataSource,
  metrics,
  filters = {},
  groupBy,
  orderBy,
  periodType,
  dateRange,
  realTime = false
}: UseAggregatedDataOptions): UseAggregatedDataResult<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const source = ANALYTICS_DATA_SOURCES[dataSource];
      if (!source) {
        throw new Error(`Unknown data source: ${dataSource}`);
      }

      // Build query
      const queryConfig = buildAggregatedQuery(dataSource, metrics, filters, groupBy, orderBy);
      
      // Start with base query
      let query = supabase
        .from(queryConfig.table)
        .select(queryConfig.select);

      // Apply filters
      Object.entries(queryConfig.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Handle special filter operators
          if (typeof value === 'object' && value !== null) {
            Object.entries(value).forEach(([operator, operatorValue]) => {
              switch (operator) {
                case 'lte':
                  query = query.lte(key, operatorValue);
                  break;
                case 'gte':
                  query = query.gte(key, operatorValue);
                  break;
                case 'lt':
                  query = query.lt(key, operatorValue);
                  break;
                case 'gt':
                  query = query.gt(key, operatorValue);
                  break;
                case 'in':
                  query = query.in(key, operatorValue as readonly any[]);
                  break;
                default:
                  query = query.eq(key, operatorValue);
              }
            });
          } else {
            query = query.eq(key, value);
          }
        }
      });

      // Apply period type filter if specified
      if (periodType && source.filters?.includes('period_type')) {
        query = query.eq('period_type', periodType);
      }

      // Apply date range filter if specified
      if (dateRange && source.filters?.includes('period_date')) {
        query = query
          .gte('period_date', dateRange.start.toISOString().split('T')[0])
          .lte('period_date', dateRange.end.toISOString().split('T')[0]);
      }

      // Apply ordering
      if (orderBy) {
        query = query.order(orderBy.field, { ascending: orderBy.direction === 'asc' });
      }

      const { data: result, error: queryError } = await query;

      if (queryError) {
        // Check if it's a missing table error
        if (queryError.message.includes('relation') && queryError.message.includes('does not exist')) {
          throw new Error(
            `Analytics data not available. Please ensure the analytics aggregation tables have been created by running the SQL setup scripts.`
          );
        }
        throw queryError;
      }

      setData(result as T[] | null);
    } catch (err) {
      console.error('Error fetching aggregated data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscription if requested
  useEffect(() => {
    if (realTime && dataSource) {
      const source = ANALYTICS_DATA_SOURCES[dataSource];
      if (source) {
        const channel = supabase
          .channel(`${source.table}_changes`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: source.table,
              filter: filters.company_id ? `company_id=eq.${filters.company_id}` : undefined
            },
            () => {
              fetchData();
            }
          )
          .subscribe();

        return () => {
          channel.unsubscribe();
        };
      }
    }
  }, [dataSource, realTime, filters.company_id]);

  useEffect(() => {
    fetchData();
  }, [dataSource, JSON.stringify(metrics), JSON.stringify(filters), periodType, JSON.stringify(dateRange)]);

  return { data, loading, error, refetch: fetchData };
}

// Specialized hooks for common use cases

export function useSalesMetrics(
  companyId: string,
  periodType: 'day' | 'week' | 'month' | 'year' = 'day',
  dateRange?: { start: Date; end: Date }
) {
  return useAggregatedData({
    dataSource: 'salesRevenue',
    metrics: ['totalRevenue', 'orderCount', 'avgOrderValue'],
    filters: { company_id: companyId },
    periodType,
    dateRange,
    orderBy: { field: 'period_date', direction: 'asc' }
  });
}

export function useBrandTrends(
  companyId: string,
  periodType: 'day' | 'week' | 'month' | 'year' = 'month',
  dateRange?: { start: Date; end: Date }
) {
  return useAggregatedData({
    dataSource: 'brandTrends',
    metrics: ['quantity', 'orderCount'],
    filters: { company_id: companyId },
    groupBy: ['brand', 'period'],
    periodType,
    dateRange,
    orderBy: { field: 'period_date', direction: 'asc' }
  });
}

export function useTopProducts(
  companyId: string,
  limit: number = 10,
  periodType: 'day' | 'week' | 'month' | 'year' = 'month'
) {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (periodType) {
    case 'day':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case 'week':
      startDate.setDate(endDate.getDate() - 84);
      break;
    case 'month':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case 'year':
      startDate.setFullYear(endDate.getFullYear() - 3);
      break;
  }

  return useAggregatedData({
    dataSource: 'topProducts',
    metrics: ['revenue', 'quantity'],
    filters: { 
      company_id: companyId, 
      revenue_rank: { lte: limit }
    },
    periodType,
    dateRange: { start: startDate, end: endDate },
    orderBy: { field: 'revenue_generated', direction: 'desc' }
  });
}

export function useInventoryMetrics(
  companyId: string,
  brandId?: string,
  warehouseId?: string
) {
  return useAggregatedData({
    dataSource: 'inventoryHealth',
    metrics: ['stockValue', 'itemsInStock', 'turnoverRatio', 'belowReorder'],
    filters: { 
      company_id: companyId,
      ...(brandId && { brand_id: brandId }),
      ...(warehouseId && { warehouse_id: warehouseId })
    },
    periodType: 'day',
    orderBy: { field: 'period_date', direction: 'desc' }
  });
}

export function useFinancialMetrics(
  companyId: string,
  periodType: 'month' | 'quarter' | 'year' = 'month',
  dateRange?: { start: Date; end: Date }
) {
  return useAggregatedData({
    dataSource: 'financialPerformance',
    metrics: ['grossRevenue', 'netRevenue', 'receivables', 'overdueAmount', 'grossMargin'],
    filters: { company_id: companyId },
    periodType,
    dateRange,
    orderBy: { field: 'period_date', direction: 'asc' }
  });
}