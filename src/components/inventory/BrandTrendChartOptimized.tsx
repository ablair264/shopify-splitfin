import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useBrandTrends } from '../../hooks/useAggregatedData';
import styles from './BrandTrendChart.module.css';

interface BrandInfo {
  name: string;
  color: string;
}

interface BrandTrendChartProps {
  companyId: string;
}

type TimePeriod = 'Day' | 'Week' | 'Month' | 'Year';

// Color palette for different brands
const BRAND_COLORS = [
  '#10b981', '#fbbf24', '#06b6d4', '#f87171', '#a78bfa', 
  '#fb7185', '#34d399', '#60a5fa',
];

const BrandTrendChartOptimized: React.FC<BrandTrendChartProps> = ({ companyId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Month');

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (selectedPeriod) {
      case 'Day':
        start.setDate(now.getDate() - 30);
        return { start, end: now, periodType: 'day' as const };
      case 'Week':
        start.setDate(now.getDate() - 84);
        return { start, end: now, periodType: 'week' as const };
      case 'Month':
        start.setFullYear(now.getFullYear() - 1);
        return { start, end: now, periodType: 'month' as const };
      case 'Year':
        start.setFullYear(now.getFullYear() - 3);
        return { start, end: now, periodType: 'year' as const };
    }
  };

  const { start, end, periodType } = getDateRange();
  
  // Use the aggregated data hook
  const { data: trendData, loading, error } = useBrandTrends(
    companyId,
    periodType,
    { start, end }
  );

  // Process data for chart
  const processChartData = () => {
    if (!trendData || trendData.length === 0) return { chartData: [], brands: [] };

    // Group data by period
    const periodMap = new Map<string, any>();
    const brandSet = new Set<string>();

    trendData.forEach((row: any) => {
      const period = row.period_label || row.period;
      const brand = row.brand_name;
      const quantity = row.total_quantity || row.quantity || 0;

      brandSet.add(brand);

      if (!periodMap.has(period)) {
        periodMap.set(period, { period });
      }

      const periodData = periodMap.get(period);
      periodData[brand] = quantity;
    });

    // Convert to array and sort by period
    const chartData = Array.from(periodMap.values()).sort((a, b) => {
      // Simple string comparison for period labels
      return a.period.localeCompare(b.period);
    });

    // Create brand info with colors
    const brands: BrandInfo[] = Array.from(brandSet).map((name, index) => ({
      name,
      color: BRAND_COLORS[index % BRAND_COLORS.length]
    }));

    return { chartData, brands };
  };

  const { chartData, brands } = processChartData();

  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={styles.tooltipItem} style={{ color: entry.color }}>
              {entry.dataKey}: {entry.value} items
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading trend data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error.message.includes('Analytics data not available') 
            ? 'Brand trends data not available. Please run the analytics setup scripts.'
            : 'Failed to load brand trend data'
          }
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No trend data available for the selected period</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.accent} />
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>Brand Popularity Trends</h3>
          <div className={styles.periodSelector}>
            {(['Day', 'Week', 'Month', 'Year'] as TimePeriod[]).map(period => (
              <button
                key={period}
                className={`${styles.periodBtn} ${selectedPeriod === period ? styles.active : ''}`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
              <XAxis 
                dataKey="period" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                domain={[0, 'dataMax']}
              />
              <Tooltip content={renderCustomTooltip} />
              {brands.map((brand) => (
                <Area
                  key={brand.name}
                  type="monotone"
                  dataKey={brand.name}
                  stroke={brand.color}
                  fill={brand.color}
                  fillOpacity={0.4}
                  strokeWidth={3}
                  dot={{ fill: brand.color, r: 4 }}
                  activeDot={{ r: 6, fill: brand.color, stroke: '#ffffff', strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.legend}>
          {brands.map(brand => (
            <div key={brand.name} className={styles.legendItem}>
              <div 
                className={styles.legendColor} 
                style={{ backgroundColor: brand.color }}
              />
              <span className={styles.legendLabel}>{brand.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrandTrendChartOptimized;