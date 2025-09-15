import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseService';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer } from 'recharts';
import styles from './InventoryMetricCards.module.css';

interface InventoryMetrics {
  totalSurplus: number;
  totalItems: number;
  newItemsThisWeek: number;
  lowStockItems: number;
  totalValue: number;
  topSellingBrands: number;
}

interface InventoryMetricCardsProps {
  companyId: string;
}

const InventoryMetricCards: React.FC<InventoryMetricCardsProps> = ({ companyId }) => {
  const [metrics, setMetrics] = useState<InventoryMetrics>({
    totalSurplus: 0,
    totalItems: 0,
    newItemsThisWeek: 0,
    lowStockItems: 0,
    totalValue: 0,
    topSellingBrands: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInventoryMetrics();
  }, [companyId]);

  const fetchInventoryMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all active items for the company (through brands)
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (brandsError) {
        throw brandsError;
      }

      if (!brands || brands.length === 0) {
        setMetrics({
          totalSurplus: 0,
          totalItems: 0,
          newItemsThisWeek: 0,
          lowStockItems: 0,
          totalValue: 0,
          topSellingBrands: 0
        });
        return;
      }

      const brandIds = brands.map(brand => brand.id);

      // Get all items for these brands using pagination to handle large datasets
      let allItems: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: batchItems, error: itemsError } = await supabase
          .from('items')
          .select('gross_stock_level, reorder_level, created_date')
          .in('brand_id', brandIds)
          .eq('status', 'active')
          .range(offset, offset + batchSize - 1);

        if (itemsError) {
          throw itemsError;
        }

        if (batchItems && batchItems.length > 0) {
          allItems = [...allItems, ...batchItems];
          offset += batchSize;
          hasMore = batchItems.length === batchSize; // If we got less than batchSize, we're done
          console.log(`Fetched batch: ${batchItems.length} items (total so far: ${allItems.length})`);
        } else {
          hasMore = false;
        }
      }

      const items = allItems;

      if (!items || items.length === 0) {
        setMetrics({
          totalSurplus: 0,
          totalItems: 0,
          newItemsThisWeek: 0,
          lowStockItems: 0,
          totalValue: 0,
          topSellingBrands: 0
        });
        return;
      }

      // Calculate metrics
      const totalItems = items.length;
      
      // Calculate surplus items (items above reorder level)
      const totalSurplus = items.reduce((sum, item) => {
        const stockLevel = item.gross_stock_level || 0;
        const reorderLevel = item.reorder_level || 0;
        const surplus = Math.max(0, stockLevel - reorderLevel);
        return sum + surplus;
      }, 0);

      // Calculate new items this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const newItemsThisWeek = items.filter(item => {
        if (!item.created_date) return false;
        const createdDate = new Date(item.created_date);
        return createdDate >= oneWeekAgo;
      }).length;

      // Calculate additional metrics
      const lowStockItems = items.filter(item => {
        const stockLevel = item.gross_stock_level || 0;
        const reorderLevel = item.reorder_level || 0;
        return stockLevel <= reorderLevel && reorderLevel > 0;
      }).length;

      // Calculate total inventory value (mock calculation - would need price data)
      const totalValue = items.reduce((sum, item) => {
        const stockLevel = item.gross_stock_level || 0;
        // Using a mock price of £10 per item for now
        return sum + (stockLevel * 10);
      }, 0);

      // Count brands represented (simplified)
      const topSellingBrands = brandIds.length;

      setMetrics({
        totalSurplus,
        totalItems,
        newItemsThisWeek,
        lowStockItems,
        totalValue,
        topSellingBrands
      });

    } catch (err) {
      console.error('Error fetching inventory metrics:', err);
      setError('Failed to load inventory metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-GB').format(num);
  };

  // Generate chart data based on metrics
  const generateSurplusChartData = () => {
    const baseValue = metrics.totalSurplus;
    return Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      value: Math.max(0, baseValue + Math.random() * 200 - 100)
    }));
  };

  const generateItemsChartData = () => {
    const baseValue = metrics.totalItems;
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      value: Math.max(0, baseValue + Math.sin(i * 0.2) * 50 + Math.random() * 20 - 10)
    }));
  };

  const generateNewItemsChartData = () => {
    return Array.from({ length: 7 }, (_, i) => ({
      day: `Day ${i + 1}`,
      value: Math.floor(Math.random() * (metrics.newItemsThisWeek + 5))
    }));
  };

  const generateLowStockChartData = () => {
    return Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      value: Math.max(0, metrics.lowStockItems + Math.random() * 10 - 5)
    }));
  };

  const generateValueChartData = () => {
    const baseValue = metrics.totalValue;
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      value: Math.max(0, baseValue + Math.sin(i * 0.3) * (baseValue * 0.1) + Math.random() * (baseValue * 0.05) - (baseValue * 0.025))
    }));
  };

  const generateBrandsChartData = () => {
    const baseValue = metrics.topSellingBrands;
    return Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      value: Math.max(0, baseValue + Math.random() * 3 - 1.5)
    }));
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Total Surplus Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentRed}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>Total Surplus</h3>
            <p className={styles.subtitle}>All Suppliers</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={generateSurplusChartData()}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valueRed}`}>
            {formatNumber(metrics.totalSurplus)}
          </div>
        </div>
      </div>

      {/* Total Items Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentCyan}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>Total Items</h3>
            <p className={styles.subtitle}>All Suppliers</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={generateItemsChartData()}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="#06b6d4"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valueCyan}`}>
            {formatNumber(metrics.totalItems)}
          </div>
        </div>
      </div>

      {/* New Items Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentGreen}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>New Items</h3>
            <p className={styles.subtitle}>This Week</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={generateNewItemsChartData()}>
                <Bar
                  dataKey="value"
                  fill="#10b981"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valueGreen}`}>
            {formatNumber(metrics.newItemsThisWeek)}
          </div>
        </div>
      </div>

      {/* Low Stock Items Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentOrange}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>Low Stock Alert</h3>
            <p className={styles.subtitle}>Items Below Reorder</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={generateLowStockChartData()}>
                <Bar
                  dataKey="value"
                  fill="#f59e0b"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valueOrange}`}>
            {formatNumber(metrics.lowStockItems)}
          </div>
        </div>
      </div>

      {/* Total Value Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentPurple}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>Total Value</h3>
            <p className={styles.subtitle}>Stock Worth</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={generateValueChartData()}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valuePurple}`}>
            £{formatNumber(metrics.totalValue)}
          </div>
        </div>
      </div>

      {/* Top Selling Brands Card */}
      <div className={styles.card}>
        <div className={`${styles.accent} ${styles.accentBlue}`} />
        <div className={styles.content}>
          <div className={styles.header}>
            <h3 className={styles.title}>Active Brands</h3>
            <p className={styles.subtitle}>In Catalog</p>
          </div>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={generateBrandsChartData()}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className={`${styles.value} ${styles.valueBlue}`}>
            {formatNumber(metrics.topSellingBrands)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryMetricCards;