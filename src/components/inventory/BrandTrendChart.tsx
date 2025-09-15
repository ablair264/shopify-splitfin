import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../../services/supabaseService';
import styles from './BrandTrendChart.module.css';

interface BrandTrendData {
  period: string;
  [brandName: string]: number | string;
}

interface BrandInfo {
  name: string;
  color: string;
}

interface BrandTrendChartProps {
  companyId: string;
}

type TimePeriod = 'Day' | 'Week' | 'Month' | 'Year';

// Color palette for different brands - matching mockup
const BRAND_COLORS = [
  '#10b981', // Green
  '#fbbf24', // Yellow/Gold
  '#06b6d4', // Cyan/Blue
  '#f87171', // Red/Pink
  '#a78bfa', // Purple
  '#fb7185', // Pink
  '#34d399', // Emerald
  '#60a5fa', // Light Blue
];

const BrandTrendChart: React.FC<BrandTrendChartProps> = ({ companyId }) => {
  const [data, setData] = useState<BrandTrendData[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('Month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTabletView, setIsTabletView] = useState(false);

  useEffect(() => {
    fetchBrandTrendData();
    
    // Check for tablet view
    const checkTabletView = () => {
      setIsTabletView(window.innerWidth <= 1024 && window.innerWidth > 768);
    };
    
    checkTabletView();
    window.addEventListener('resize', checkTabletView);
    
    return () => window.removeEventListener('resize', checkTabletView);
  }, [companyId, selectedPeriod]);

  const fetchBrandTrendData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching aggregated brand trend data for company:', companyId);

      // Calculate date range based on selected period
      const now = new Date();
      let startDate = new Date();
      let periodType = '';
      
      switch (selectedPeriod) {
        case 'Day':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30); // Last 30 days
          periodType = 'day';
          break;
        case 'Week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 84); // Last 12 weeks
          periodType = 'week';
          break;
        case 'Month':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 1); // Last 12 months
          periodType = 'month';
          break;
        case 'Year':
          startDate = new Date(now);
          startDate.setFullYear(now.getFullYear() - 3); // Last 3 years
          periodType = 'year';
          break;
      }

      console.log('Fetching data:', { periodType, startDate: startDate.toISOString(), endDate: now.toISOString() });

      // Fetch aggregated data
      const { data: trendData, error: trendError } = await supabase
        .from('brand_trends_aggregated')
        .select('*')
        .eq('company_id', companyId)
        .eq('period_type', periodType)
        .gte('period_date', startDate.toISOString().split('T')[0])
        .lte('period_date', now.toISOString().split('T')[0])
        .order('period_date', { ascending: true });

      if (trendError) {
        console.error('Error fetching trend data:', trendError);
        
        // If table doesn't exist, provide helpful message
        if (trendError.message.includes('relation') && trendError.message.includes('does not exist')) {
          setError('Brand trends data not available. Please run the aggregation setup script.');
          return;
        }
        
        throw trendError;
      }

      console.log('Trend data found:', trendData?.length);

      if (!trendData || trendData.length === 0) {
        console.log('No trend data found for the selected period');
        setData([]);
        setBrands([]);
        return;
      }

      // Process the aggregated data
      const processedData = processAggregatedData(trendData, selectedPeriod);
      setData(processedData.chartData);
      setBrands(processedData.brandInfo);

    } catch (err) {
      console.error('Error fetching brand trend data:', err);
      setError('Failed to load brand trend data');
    } finally {
      setLoading(false);
    }
  };

  const processAggregatedData = (trendData: any[], period: TimePeriod) => {
    // Group data by period and brand
    const periodData: { [period: string]: { [brand: string]: number } } = {};
    const brands = new Set<string>();
    const allPeriods = new Set<string>();

    // First pass - collect all data
    trendData.forEach(row => {
      const periodDate = row.period_date;
      const brandName = row.brand_name;
      const quantity = row.total_quantity || 0;

      brands.add(brandName);
      allPeriods.add(periodDate);

      if (!periodData[periodDate]) {
        periodData[periodDate] = {};
      }
      periodData[periodDate][brandName] = quantity;
    });

    // Generate complete date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'Day':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
      case 'Week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 84);
        break;
      case 'Month':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'Year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 3);
        break;
    }

    // Fill in missing periods
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // For week/month/year, normalize to period start
      let periodKey: string;
      switch (period) {
        case 'Day':
          periodKey = dateStr;
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'Week':
          const weekStart = new Date(currentDate);
          weekStart.setDate(currentDate.getDate() - currentDate.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'Month':
          periodKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'Year':
          periodKey = `${currentDate.getFullYear()}-01-01`;
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
      allPeriods.add(periodKey);
    }

    // Create chart data
    const sortedPeriods = Array.from(allPeriods).sort();
    const brandNames = Array.from(brands);
    
    const chartData: BrandTrendData[] = sortedPeriods.map(periodDate => {
      const dataPoint: BrandTrendData = { 
        period: formatPeriodLabel(periodDate, period) 
      };
      
      brandNames.forEach(brandName => {
        dataPoint[brandName] = periodData[periodDate]?.[brandName] || 0;
      });
      
      return dataPoint;
    });

    // Create brand info with colors
    const brandInfo: BrandInfo[] = brandNames.map((name, index) => ({
      name,
      color: BRAND_COLORS[index % BRAND_COLORS.length]
    }));

    return { chartData, brandInfo };
  };

  const formatPeriodLabel = (period: string, periodType: TimePeriod): string => {
    switch (periodType) {
      case 'Day':
        const date = new Date(period);
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric',
          month: 'short'
        });
      case 'Week':
        const weekDate = new Date(period);
        return weekDate.toLocaleDateString('en-GB', { 
          day: 'numeric',
          month: 'short'
        });
      case 'Month':
        const [year, month] = period.split('-');
        const monthDate = new Date(parseInt(year), parseInt(month) - 1);
        return monthDate.toLocaleDateString('en-GB', { 
          month: 'short',
          year: '2-digit'
        });
      case 'Year':
        return period;
      default:
        return period;
    }
  };

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
  
  // Calculate pie chart data from latest period
  const pieData = useMemo(() => {
    if (!data.length || !brands.length) return [];
    
    const latestData = data[data.length - 1];
    return brands.map(brand => ({
      name: brand.name,
      value: latestData[brand.name] as number || 0,
      color: brand.color
    })).filter(item => item.value > 0);
  }, [data, brands]);

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
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No trend data available</div>
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

        {isTabletView ? (
          // Tablet view - Compact pie chart with dots
          <div className={styles.tabletContainer}>
            <div className={styles.pieContainer}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ payload }) => {
                      if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className={styles.tooltip}>
                            <p className={styles.tooltipLabel}>{data.name}</p>
                            <p className={styles.tooltipItem} style={{ color: data.color }}>
                              {data.value} items
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.dotLegend}>
              {brands.map(brand => (
                <div key={brand.name} className={styles.dotItem}>
                  <div 
                    className={styles.dot} 
                    style={{ backgroundColor: brand.color }}
                  />
                  <span className={styles.dotLabel}>{brand.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Desktop view - Area chart with full legend
          <>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                  <XAxis 
                    dataKey="period" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    interval={Math.max(0, Math.floor(data.length / 8) - 1)}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                    domain={[0, 'dataMax']}
                  />
                  <Tooltip content={renderCustomTooltip} />
                  {brands.map((brand, index) => (
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
          </>
        )}
      </div>
    </div>
  );
};

export default BrandTrendChart;