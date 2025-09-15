import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  outstandingInvoices: number;
  marketplaceOrders: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  orders: any[];
  customers: any[];
  chartData: Array<{ name: string; value: number; orders: number; customers: number }>;
}

interface UseDashboardOptions {
  userId?: string;
  dateRange?: string;
  enableCaching?: boolean;
}

export function useDashboard(options: UseDashboardOptions = {}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the new analytics data service
      const { analyticsDataService } = await import('../services/analyticsDataService');
      
      const analytics = await analyticsDataService.getAnalytics(options.dateRange || '30_days');
      const chartData = await analyticsDataService.getTimeSeriesData(options.dateRange || '30_days', 'revenue');

      const dashboardData: DashboardData = {
        metrics: {
          totalRevenue: analytics.totalRevenue,
          totalOrders: analytics.totalOrders,
          totalCustomers: analytics.totalCustomers,
          averageOrderValue: analytics.averageOrderValue,
          outstandingInvoices: analytics.outstandingInvoices,
          marketplaceOrders: Math.floor(analytics.totalOrders * 0.3), // 30% marketplace estimate
        },
        orders: [], // Individual orders not needed for dashboard overview
        customers: [], // Individual customers not needed for dashboard overview  
        chartData: chartData.map(item => ({
          name: item.name,
          value: item.value,
          orders: item.orders || 0,
          customers: item.customers || 0
        }))
      };

      setData(dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [options.userId, options.dateRange]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    isStale: false,
    isCached: false,
    lastUpdated: new Date()
  };
}