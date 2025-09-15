import { useState, useEffect, useCallback } from 'react';
import { shopifyService } from '../services';
import { ShopifyAnalyticsDashboard } from '../services/shopifyAnalyticsService';

interface UseShopifyAnalyticsResult {
  dashboard?: ShopifyAnalyticsDashboard;
  isLoading: boolean;
  error?: string;
  refresh: () => Promise<void>;
  setDateRange: (dateRange: { start: Date; end: Date }) => void;
  dateRange: { start: Date; end: Date };
}

const getDefaultDateRange = (): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start, end };
};

export const useShopifyAnalytics = (): UseShopifyAnalyticsResult => {
  const [dashboard, setDashboard] = useState<ShopifyAnalyticsDashboard>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  const loadDashboard = useCallback(async (range?: { start: Date; end: Date }) => {
    try {
      setIsLoading(true);
      setError(undefined);
      
      const data = await shopifyService.getStoreDashboard(range || dateRange);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Analytics loading error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const refresh = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  const updateDateRange = useCallback((newDateRange: { start: Date; end: Date }) => {
    setDateRange(newDateRange);
    loadDashboard(newDateRange);
  }, [loadDashboard]);

  return {
    dashboard,
    isLoading,
    error,
    refresh,
    setDateRange: updateDateRange,
    dateRange,
  };
};