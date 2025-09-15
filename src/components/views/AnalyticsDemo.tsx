import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import { 
  AnalyticsGrid, 
  GridItem, 
  FlexibleChart, 
  SideBySideTables, 
  TrendsChart 
} from '../analytics/shared';
import type { ChartDataItem, TableConfig, TrendDataPoint, TrendLine } from '../analytics/shared';
import styles from './AnalyticsDemo.module.css';

const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

const AnalyticsDemo: React.FC = () => {
  const [salesTeamData, setSalesTeamData] = useState<ChartDataItem[]>([]);
  const [topCustomersData, setTopCustomersData] = useState<any[]>([]);
  const [recentActivitiesData, setRecentActivitiesData] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      // Fetch Sales Team Performance - Use separate queries to avoid foreign key issues
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total, sales_id')
        .eq('company_id', DM_BRANDS_ID)
        .not('sales_id', 'is', null)
        .not('total', 'is', null);

      if (ordersError) {
        console.error('Orders data error:', ordersError);
      }

      // Get all unique sales IDs
      const salesIds = Array.from(new Set(ordersData?.map(order => order.sales_id).filter(Boolean)));
      
      // Fetch user data separately
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', salesIds);

      if (usersError) {
        console.error('Users data error:', usersError);
      }

      // Create user lookup map
      const userMap = new Map();
      usersData?.forEach(user => {
        userMap.set(user.id, `${user.first_name} ${user.last_name}`);
      });

      // Process sales team data
      const salesMap = new Map();
      ordersData?.forEach(order => {
        if (order.sales_id && userMap.has(order.sales_id)) {
          const userId = order.sales_id;
          const name = userMap.get(userId);
          const revenue = parseFloat(order.total as string) || 0;

          if (salesMap.has(userId)) {
            salesMap.get(userId).value += revenue;
          } else {
            salesMap.set(userId, {
              name,
              value: revenue,
              id: userId
            });
          }
        }
      });

      const salesTeamArray = Array.from(salesMap.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      setSalesTeamData(salesTeamArray);

      // Fetch Top Customers - separate queries
      const { data: customerOrdersData, error: customerOrdersError } = await supabase
        .from('orders')
        .select('total, customer_id')
        .eq('company_id', DM_BRANDS_ID)
        .not('customer_id', 'is', null)
        .not('total', 'is', null);

      if (customerOrdersError) {
        console.error('Customer orders data error:', customerOrdersError);
      }

      // Get unique customer IDs
      const customerIds = Array.from(new Set(customerOrdersData?.map(order => order.customer_id).filter(Boolean)));
      
      // Fetch customer data separately
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, display_name')
        .in('id', customerIds);

      if (customersError) {
        console.error('Customers data error:', customersError);
      }

      // Create customer lookup map
      const customerMap = new Map();
      customersData?.forEach(customer => {
        customerMap.set(customer.id, customer.display_name);
      });

      // Process customers data
      const customersMap = new Map();
      let orderCountMap = new Map();
      
      customerOrdersData?.forEach(order => {
        if (order.customer_id && customerMap.has(order.customer_id)) {
          const customerId = order.customer_id;
          const customerName = customerMap.get(customerId);
          const total = parseFloat(order.total as string) || 0;

          if (customersMap.has(customerId)) {
            customersMap.get(customerId).total += total;
            orderCountMap.set(customerId, (orderCountMap.get(customerId) || 0) + 1);
          } else {
            customersMap.set(customerId, {
              id: customerId,
              customer: customerName,
              total,
            });
            orderCountMap.set(customerId, 1);
          }
        }
      });

      const topCustomers = Array.from(customersMap.values())
        .map(customer => ({
          ...customer,
          orders: orderCountMap.get(customer.id) || 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      
      setTopCustomersData(topCustomers);

      // Fetch Recent Activities (Recent Orders) - simple query
      const { data: recentOrders, error: recentError } = await supabase
        .from('orders')
        .select('id, legacy_order_number, total, created_at, customer_id, sales_id')
        .eq('company_id', DM_BRANDS_ID)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('Recent orders error:', recentError);
      }

      const recentActivities = recentOrders?.map(order => ({
        id: order.id,
        action: 'New order placed',
        user: userMap.get(order.sales_id) || customerMap.get(order.customer_id) || 'System',
        time: formatTimeAgo(new Date(order.created_at)),
        details: `Order #${order.legacy_order_number || order.id.slice(0, 8)} - £${parseFloat(order.total as string).toLocaleString()}`
      })) || [];

      setRecentActivitiesData(recentActivities);

      // Fetch Trends Data (Monthly Revenue)
      const { data: trendsData } = await supabase
        .from('orders')
        .select('total, created_at')
        .eq('company_id', DM_BRANDS_ID)
        .not('total', 'is', null)
        .order('created_at', { ascending: true });

      // Process trends data by month
      const monthlyData = new Map();
      trendsData?.forEach(order => {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const revenue = parseFloat(order.total as string) || 0;

        if (monthlyData.has(monthKey)) {
          const existing = monthlyData.get(monthKey);
          existing.revenue += revenue;
          existing.orders += 1;
        } else {
          monthlyData.set(monthKey, {
            date: monthKey,
            revenue,
            orders: 1
          });
        }
      });

      const trendsArray = Array.from(monthlyData.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-12); // Last 12 months

      setTrendsData(trendsArray);
      setLoading(false);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) === 1 ? '' : 's'} ago`;
  };

  // Table configurations
  const topCustomersTable: TableConfig = {
    title: 'Top Customers',
    subtitle: 'By total purchase value',
    data: topCustomersData,
    loading,
    showIndex: true,
    maxRows: 5,
    columns: [
      { key: 'customer', header: 'CUSTOMER', width: '50%' },
      { key: 'orders', header: 'ORDERS', width: '25%' },
      { 
        key: 'total', 
        header: 'TOTAL', 
        width: '25%',
        render: (item) => `£${Math.round(item.total).toLocaleString()}`
      }
    ]
  };

  const recentActivitiesTable: TableConfig = {
    title: 'Recent Activities',
    subtitle: 'Latest system events',
    data: recentActivitiesData,
    loading,
    columns: [
      { 
        key: 'action', 
        header: 'ACTION', 
        width: '40%',
        render: (item) => (
          <div>
            <div style={{ color: '#ffffff', fontWeight: '500' }}>{item.action}</div>
            <div style={{ color: '#a0a0a0', fontSize: '12px' }}>{item.details}</div>
          </div>
        )
      },
      { key: 'user', header: 'USER', width: '35%' },
      { key: 'time', header: 'TIME', width: '25%' }
    ]
  };

  // Trend lines configuration
  const trendLines: TrendLine[] = [
    {
      dataKey: 'revenue',
      name: 'Revenue',
      color: '#79d5e9',
      type: 'area'
    },
    {
      dataKey: 'orders',
      name: 'Orders',
      color: '#61bc8e',
      type: 'line'
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics Dashboard</h1>
        <p className={styles.subtitle}>Real-time business insights using Supabase data</p>
      </div>

      <AnalyticsGrid columns={2} gap="large" className={styles.grid}>
        {/* Sales Team Performance Chart */}
        <GridItem>
          <FlexibleChart
            title="Sales Team Performance"
            subtitle="Top 5 agents by revenue"
            data={salesTeamData}
            defaultType="horizontal-bar"
            showTypeSwitcher={true}
            loading={loading}
            formatValue={(value) => `£${Math.round(value).toLocaleString()}`}
            showRanking={true}
            colors={['#79d5e9', '#4daeac', '#61bc8e', '#fbbf24', '#dc2626']}
          />
        </GridItem>

        {/* Side by Side Tables */}
        <GridItem>
          <SideBySideTables
            leftTable={topCustomersTable}
            rightTable={recentActivitiesTable}
          />
        </GridItem>

        {/* Revenue & Order Trends */}
        <GridItem colSpan="full">
          <TrendsChart
            title="Revenue & Order Trends"
            subtitle="Track your business performance over time"
            data={trendsData}
            lines={trendLines}
            height={400}
            showBrush={true}
            showGrid={true}
            showLegend={true}
            loading={loading}
            formatValue={(value) => {
              if (value >= 1000) {
                return `£${(value / 1000).toFixed(1)}K`;
              }
              return `£${value.toLocaleString()}`;
            }}
          />
        </GridItem>
      </AnalyticsGrid>
    </div>
  );
};

export default AnalyticsDemo;