/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  DashboardHeader,
  MetricCard,
  DataTable,
  FullGraph,
  useColors
} from './shared';
import { useDashboard } from '../../hooks/useDashboard';
import { supabase } from '../../services/supabaseService';
import { FaShoppingCart, FaBox, FaDollarSign, FaFileInvoice, FaUser } from 'react-icons/fa';
import './Analytics.css';

// Sample data for metric cards
const generateMetricData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    data.push({
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.floor(Math.random() * 10000) + 30000 + (i * 500),
    });
  }
  
  return data;
};

// Sample data for FullGraph
const generateFullGraphData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    data.push({
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.floor(Math.random() * 20000) + 25000,
      orders: Math.floor(Math.random() * 100) + 50,
      customers: Math.floor(Math.random() * 30) + 10,
    });
  }
  
  return data;
};

// Sample data for table
const salesTeamData = [
  { id: 1, name: 'Hannah Neale', orders: 0, revenue: 0 },
  { id: 2, name: 'Dave Roberts', orders: 0, revenue: 0 },
  { id: 3, name: 'Kate Ellis', orders: 0, revenue: 0 },
  { id: 4, name: 'Stephen Stroud', orders: 0, revenue: 0 },
  { id: 5, name: 'Nick Barr', orders: 0, revenue: 0 },
];

const tableColumns = [
  { 
    key: 'name', 
    header: 'Sales Agent',
    width: '70%',
    render: (row: any) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          borderRadius: '50%', 
          background: '#79d5e9', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#1a1f2a'
        }}>
          {row.name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div>
          <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{row.name}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{row.orders} orders</div>
        </div>
      </div>
    )
  },
  { 
    key: 'revenue', 
    header: 'Revenue',
    width: '30%',
    align: 'right' as const,
    render: (row: any) => `£${row.revenue.toLocaleString()}`
  }
];

interface AnalyticsOverviewProps {
  barChartColors?: any;
  onBarChartColorsChange?: (colors: any) => void;
}

export default function AnalyticsOverview({ 
  barChartColors = 'primary', 
  onBarChartColorsChange 
}: AnalyticsOverviewProps = {}) {
  const [dateRange, setDateRange] = useState('30_days');
  const [isEditMode, setIsEditMode] = useState(false);
  const [metricDisplayMode, setMetricDisplayMode] = useState<'full' | 'compact'>('full');
  const [chartDesign, setChartDesign] = useState<'default' | 'horizontal-bars' | 'pie-with-legend' | 'table'>('default');
  const [cardVariants, setCardVariants] = useState<Record<string, 'variant1' | 'variant2' | 'variant3'>>({
    'revenue-metric': 'variant1',
    'orders-metric': 'variant2',
    'customers-metric': 'variant3',
    'avg-order-metric': 'variant1'
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { getMetricCardColor } = useColors();

  // Use real dashboard data from Supabase
  const { data: dashboardData, loading, error, refresh } = useDashboard({
    dateRange,
    enableCaching: true
  });

  const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

  // Fetch recent activities
  useEffect(() => {
    fetchRecentActivities();
  }, [dateRange]);

  // Set up real-time updates
  useEffect(() => {
    // Initial fetch
    fetchRecentActivities();
    
    // Set up interval for real-time updates (every 30 seconds)
    const interval = setInterval(() => {
      fetchRecentActivities();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [activityFilter]); // Re-run when filter changes

  const getDomain = (customerName: string) => {
    if (customerName.toLowerCase().includes('amazon')) return 'amazon.com';
    if (customerName.toLowerCase().includes('ebay')) return 'ebay.com';
    if (customerName.toLowerCase().includes('homearama')) return 'homearama.co.uk';
    if (customerName.toLowerCase().includes('cambium')) return 'cambium.org';
    return null;
  };

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      
      // First, get the user's company ID from the dashboard data or use DM_BRANDS_ID
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let companyId = DM_BRANDS_ID;
      
      console.log('Auth user:', authUser?.id);
      
      if (authUser) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('company_id')
          .eq('auth_user_id', authUser.id)
          .single();
        
        if (userError) {
          console.log('User lookup error:', userError);
        }
        
        if (userData?.company_id) {
          companyId = userData.company_id;
          console.log('Using user company ID:', companyId);
        } else {
          console.log('Using default DM_BRANDS_ID:', companyId);
        }
      }
      
      console.log('Fetching activities for company:', companyId);
      
      // Fetch multiple activity types from Supabase
      const activities = [];
      
      // If no real data is available, create some sample activities for demo purposes
      if (activities.length === 0) {
        console.log('No real data found, creating sample activities...');
        const now = new Date();
        
        // Sample recent activities
        const sampleActivities = [
          {
            id: 'demo-order-1',
            action: 'New order placed',
            customerName: 'Amazon Marketplace',
            time: formatTimeAgo(new Date(now.getTime() - 2 * 60 * 1000)), // 2 minutes ago
            domain: 'amazon.com',
            amount: 2450,
            created_at: new Date(now.getTime() - 2 * 60 * 1000).toISOString()
          },
          {
            id: 'demo-invoice-1',
            action: 'Invoice paid',
            customerName: 'eBay Store',
            time: formatTimeAgo(new Date(now.getTime() - 15 * 60 * 1000)), // 15 minutes ago
            domain: 'ebay.com',
            amount: 1200,
            created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString()
          },
          {
            id: 'demo-delivered-1',
            action: 'Order delivered',
            customerName: 'Homearama',
            time: formatTimeAgo(new Date(now.getTime() - 45 * 60 * 1000)), // 45 minutes ago
            domain: 'homearama.co.uk',
            amount: 850,
            created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString()
          },
          {
            id: 'demo-login-1',
            action: 'User logged in',
            customerName: 'Hannah Neale',
            time: formatTimeAgo(new Date(now.getTime() - 1 * 60 * 60 * 1000)), // 1 hour ago
            domain: null,
            amount: 0,
            created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'demo-order-2',
            action: 'New order placed',
            customerName: 'Cambium Learning',
            time: formatTimeAgo(new Date(now.getTime() - 2 * 60 * 60 * 1000)), // 2 hours ago
            domain: 'cambium.org',
            amount: 3200,
            created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            id: 'demo-login-2',
            action: 'User logged in',
            customerName: 'Dave Roberts',
            time: formatTimeAgo(new Date(now.getTime() - 3 * 60 * 60 * 1000)), // 3 hours ago
            domain: null,
            amount: 0,
            created_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
          }
        ];
        
        activities.push(...sampleActivities);
      }
      
      // Try to fetch real data (with fallback to sample data)
      // First, check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session status:', session ? 'authenticated' : 'not authenticated');
      console.log('User ID:', session?.user?.id);
      
      // 1. Try to fetch Recent Orders with error handling
      try {
        console.log('Attempting to fetch orders...');
        const { data: recentOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total, created_at, customer_id, order_status, company_id')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (ordersError) {
          console.error('Orders fetch error details:', ordersError);
          console.log('Orders fetch error (using sample data):', ordersError.message);
        } else {
          console.log('Orders query successful. Found:', recentOrders?.length || 0, 'orders');
          if (recentOrders && recentOrders.length > 0) {
            console.log('Found real orders, replacing sample data:', recentOrders.length);
            // Clear sample data and use real data
            activities.length = 0;
            
            // Get unique customer IDs for lookup
            const orderCustomerIds = recentOrders.map(order => order.customer_id).filter(Boolean);
            let customerMap = new Map();
            
            // Try to fetch customer names
            if (orderCustomerIds.length > 0) {
              try {
                const { data: customers, error: customerError } = await supabase
                  .from('customers')
                  .select('id, display_name')
                  .in('id', orderCustomerIds);
                
                if (!customerError && customers) {
                  customers.forEach(customer => {
                    customerMap.set(customer.id, customer.display_name);
                  });
                  console.log('Loaded customer names for', customers.length, 'customers');
                } else {
                  console.log('Customer lookup error:', customerError?.message);
                }
              } catch (error) {
                console.log('Customer lookup failed:', error.message);
              }
            }
            
            recentOrders.forEach(order => {
              const isDelivered = order.order_status === 'delivered';
              const customerName = customerMap.get(order.customer_id) || 'Customer';
              const domain = getDomain(customerName);
              
              activities.push({
                id: `order-${order.id}`,
                action: isDelivered ? 'Order delivered' : 'New order placed',
                customerName,
                time: formatTimeAgo(new Date(order.created_at)),
                domain,
                amount: parseFloat(order.total || 0),
                created_at: order.created_at
              });
            });
          } else {
            console.log('Orders query returned empty result');
          }
        }
      } catch (error) {
        console.error('Orders query exception:', error);
        console.log('Orders query failed (using sample data):', error.message);
      }

      // 2. Try to fetch Recent Invoices with error handling
      try {
        console.log('Attempting to fetch invoices...');
        const { data: recentInvoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('id, total, created_at, customer_id, invoice_status, company_id')
          .eq('company_id', companyId)
          .eq('invoice_status', 'paid')
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (invoicesError) {
          console.error('Invoices fetch error details:', invoicesError);
          console.log('Invoices fetch error (using sample data):', invoicesError.message);
        } else {
          console.log('Invoices query successful. Found:', recentInvoices?.length || 0, 'invoices');
          if (recentInvoices && recentInvoices.length > 0) {
            console.log('Found real invoices:', recentInvoices.length);
            
            // Get unique customer IDs for lookup
            const invoiceCustomerIds = recentInvoices.map(invoice => invoice.customer_id).filter(Boolean);
            let invoiceCustomerMap = new Map();
            
            // Try to fetch customer names
            if (invoiceCustomerIds.length > 0) {
              try {
                const { data: customers, error: customerError } = await supabase
                  .from('customers')
                  .select('id, display_name')
                  .in('id', invoiceCustomerIds);
                
                if (!customerError && customers) {
                  customers.forEach(customer => {
                    invoiceCustomerMap.set(customer.id, customer.display_name);
                  });
                  console.log('Loaded customer names for', customers.length, 'invoice customers');
                } else {
                  console.log('Invoice customer lookup error:', customerError?.message);
                }
              } catch (error) {
                console.log('Invoice customer lookup failed:', error.message);
              }
            }
            
            // Add to existing activities (don't clear if orders worked)
            recentInvoices.forEach(invoice => {
              const customerName = invoiceCustomerMap.get(invoice.customer_id) || 'Customer';
              const domain = getDomain(customerName);
              
              activities.push({
                id: `invoice-${invoice.id}`,
                action: 'Invoice paid',
                customerName,
                time: formatTimeAgo(new Date(invoice.created_at)),
                domain,
                amount: parseFloat(invoice.total || 0),
                created_at: invoice.created_at
              });
            });
          }
        }
      } catch (error) {
        console.error('Invoices query exception:', error);
        console.log('Invoices query failed (using sample data):', error.message);
      }

      // 3. Try to fetch Recent User Logins with error handling
      try {
        console.log('Attempting to fetch user logins...');
        const { data: recentLogins, error: loginsError } = await supabase
          .from('users')
          .select('id, first_name, last_name, last_login, company_id')
          .eq('company_id', companyId)
          .not('last_login', 'is', null)
          .order('last_login', { ascending: false })
          .limit(2);
          
        if (loginsError) {
          console.error('User logins fetch error details:', loginsError);
          console.log('User logins fetch error (using sample data):', loginsError.message);
        } else {
          console.log('User logins query successful. Found:', recentLogins?.length || 0, 'users');
          if (recentLogins && recentLogins.length > 0) {
            console.log('Found real user logins:', recentLogins.length);
            recentLogins.forEach(user => {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User';
              activities.push({
                id: `login-${user.id}`,
                action: 'User logged in',
                customerName: fullName,
                time: formatTimeAgo(new Date(user.last_login)),
                domain: null,
                amount: 0,
                created_at: user.last_login
              });
            });
          }
        }
      } catch (error) {
        console.error('User logins query exception:', error);
        console.log('User logins query failed (using sample data):', error.message);
      }


      // Sort all activities by creation time (most recent first), then by ID for consistency
      activities.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        if (dateB !== dateA) {
          return dateB - dateA; // Most recent first
        }
        // If dates are equal, sort by ID for consistency
        return b.id.localeCompare(a.id);
      });

      console.log('Recent activities:', activities);
      setRecentActivities(activities);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setRecentActivities([]);
    } finally {
      setActivitiesLoading(false);
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

  const getCustomerLogo = (domain: string | null, customerName: string) => {
    if (domain) {
      return `https://logo.clearbit.com/${domain}`;
    }
    return null;
  };

  // Function to determine if text should be light or dark based on background color
  const getTextColor = (backgroundColor: string) => {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white text for dark backgrounds, dark text for light backgrounds
    return luminance > 0.5 ? '#1a1f2a' : '#ffffff';
  };

  const recentActivitiesColumns = [
    { 
      key: 'action', 
      header: 'Activity',
      width: '45%',
      render: (row: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#ffffff'
          }}>
            <FaShoppingCart />
          </div>
          <div>
            <div style={{ color: '#ffffff', fontWeight: '600', fontSize: '14px' }}>{row.action}</div>
            <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginTop: '2px' }}>{row.details}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'customer', 
      header: 'Customer',
      width: '35%',
      render: (row: any) => {
        const logoUrl = getCustomerLogo(row.domain, row.customerName);
        const customerName = row.customerName || 'Unknown';
        const initials = customerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={row.customerName}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  objectFit: 'contain',
                  background: '#ffffff',
                  padding: '4px'
                }}
                onError={(e) => {
                  // If logo fails to load, replace with initials
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.insertAdjacentHTML('afterend', `
                    <div style="
                      width: 32px;
                      height: 32px;
                      border-radius: 6px;
                      background: rgba(255, 255, 255, 0.1);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 14px;
                      font-weight: 600;
                      color: #ffffff;
                    ">${initials}</div>
                  `);
                }}
              />
            ) : (
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '500' }}>{customerName}</div>
              {row.salesPerson && (
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>via {row.salesPerson}</div>
              )}
            </div>
          </div>
        );
      }
    },
    { 
      key: 'time', 
      header: 'Time',
      width: '20%',
      align: 'right' as const,
      render: (row: any) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px', fontWeight: '600' }}>
            £{row.amount.toLocaleString()}
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', marginTop: '2px' }}>
            {row.time}
          </div>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="analytics-page">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          Loading analytics data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-error)' }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }


  return (
    <div className="analytics-page">
      <DashboardHeader
        title="Analytics Overview"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={refresh}
        isEditMode={isEditMode}
        onEditModeToggle={() => setIsEditMode(!isEditMode)}
        metricDisplayMode={metricDisplayMode}
        onMetricDisplayModeChange={setMetricDisplayMode}
        barChartColors={barChartColors}
        onBarChartColorsChange={onBarChartColorsChange}
      />

      <div className="analytics-content">
        {/* Main Content Grid - Metrics and Activities */}
        <div className="main-content-grid">
          {/* Metric Cards Section */}
          <div className="metrics-section">
            <div className={`metrics-grid-reduced ${metricDisplayMode}`}>
              <MetricCard
                id="revenue-metric"
                title="Total Revenue"
                subtitle="All channels combined"
                value={dashboardData.metrics.totalRevenue}
                format="currency"
                trend={{ value: 14, isPositive: true }}
                chartData={dashboardData.chartData}
                displayMode={metricDisplayMode}
                design={cardVariants['revenue-metric']}
                color={getMetricCardColor(0)}
                isEditMode={isEditMode}
                onVariantChange={(variant) => setCardVariants(prev => ({ ...prev, 'revenue-metric': variant }))}
              />
              <MetricCard
                id="orders-metric"
                title="Total Orders"
                subtitle="Processed orders"
                value={dashboardData.metrics.totalOrders}
                trend={{ value: 9, isPositive: true }}
                chartData={dashboardData.chartData.map(item => ({ name: item.name, value: item.orders }))}
                displayMode={metricDisplayMode}
                design={cardVariants['orders-metric']}
                color={getMetricCardColor(1)}
                isEditMode={isEditMode}
                onVariantChange={(variant) => setCardVariants(prev => ({ ...prev, 'orders-metric': variant }))}
              />
              <MetricCard
                id="customers-metric"
                title="Active Customers"
                subtitle="Unique buyers"
                value={dashboardData.metrics.totalCustomers}
                trend={{ value: 5, isPositive: true }}
                chartData={dashboardData.chartData.map(item => ({ name: item.name, value: item.customers }))}
                displayMode={metricDisplayMode}
                design={cardVariants['customers-metric']}
                color={getMetricCardColor(2)}
                isEditMode={isEditMode}
                onVariantChange={(variant) => setCardVariants(prev => ({ ...prev, 'customers-metric': variant }))}
              />
              <MetricCard
                id="avg-order-metric"
                title="Avg Order Value"
                subtitle="Per transaction"
                value={dashboardData.metrics.averageOrderValue}
                format="currency"
                trend={{ value: 3, isPositive: true }}
                chartData={dashboardData.chartData}
                displayMode={metricDisplayMode}
                design={cardVariants['avg-order-metric']}
                color={getMetricCardColor(3)}
                isEditMode={isEditMode}
                onVariantChange={(variant) => setCardVariants(prev => ({ ...prev, 'avg-order-metric': variant }))}
              />
            </div>
          </div>
          
          {/* Recent Activities Section */}
          <div className={`activities-section ${metricDisplayMode}`}>
            <div 
              className="recent-activities-card"
              style={{
                background: getMetricCardColor(0),
                color: getTextColor(getMetricCardColor(0)),
                '--card-bg-color': getMetricCardColor(0),
                '--card-text-color': getTextColor(getMetricCardColor(0)),
                '--card-text-secondary': getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 31, 42, 0.7)'
              } as React.CSSProperties}
            >
              <div 
                className="card-header"
                style={{
                  borderBottom: `1px solid ${getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(26, 31, 42, 0.15)'}`,
                  paddingBottom: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 className="card-title" style={{ color: getTextColor(getMetricCardColor(0)) }}>Recent Activities</h3>
                  <p className="card-subtitle" style={{ color: getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 31, 42, 0.8)' }}>
                    Latest system events • Updated {Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000)}s ago
                  </p>
                </div>
                <select 
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  style={{
                    background: getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: getTextColor(getMetricCardColor(0)),
                    border: `1px solid ${getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minWidth: '160px'
                  }}
                >
                  <option value="all">All Activities</option>
                  <option value="orders">New Orders</option>
                  <option value="delivered">Order Delivered</option>
                  <option value="invoice">Invoice Paid</option>
                  <option value="login">User Logged In</option>
                </select>
              </div>
              {activitiesLoading ? (
                <div className="loading-state" style={{ color: getTextColor(getMetricCardColor(0)) === '#ffffff' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(26, 31, 42, 0.8)' }}>Loading activities...</div>
              ) : (
                <div 
                  className="activities-simple"
                  style={{
                    '--activity-count': recentActivities.filter(activity => {
                      if (activityFilter === 'all') return true;
                      if (activityFilter === 'orders') return activity.action.toLowerCase().includes('new order');
                      if (activityFilter === 'delivered') return activity.action.toLowerCase().includes('delivered');
                      if (activityFilter === 'invoice') return activity.action.toLowerCase().includes('invoice');
                      if (activityFilter === 'login') return activity.action.toLowerCase().includes('logged in');
                      return true;
                    }).slice(0, 6).length
                  } as React.CSSProperties}
                >
                  {recentActivities.filter(activity => {
                    if (activityFilter === 'all') return true;
                    if (activityFilter === 'orders') return activity.action.toLowerCase().includes('new order');
                    if (activityFilter === 'delivered') return activity.action.toLowerCase().includes('delivered');
                    if (activityFilter === 'invoice') return activity.action.toLowerCase().includes('invoice');
                    if (activityFilter === 'login') return activity.action.toLowerCase().includes('logged in');
                    return true;
                  }).slice(0, 6).map((activity, index) => {
                    const textColor = getTextColor(getMetricCardColor(0));
                    const secondaryColor = textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(26, 31, 42, 0.6)';
                    
                    // Determine activity type and icon
                    const getActivityTypeInfo = () => {
                      if (activity.action.toLowerCase().includes('delivered')) {
                        return {
                          icon: <FaBox />,
                          bgColor: '#3b82f6',
                          title: 'Order Delivered',
                          showAmount: true
                        };
                      } else if (activity.action.toLowerCase().includes('order')) {
                        return {
                          icon: <FaShoppingCart />,
                          bgColor: '#22c55e',
                          title: 'New Order',
                          showAmount: true
                        };
                      } else if (activity.action.toLowerCase().includes('invoice')) {
                        return {
                          icon: <FaFileInvoice />,
                          bgColor: '#22c55e',
                          title: 'Invoice Paid',
                          showAmount: true
                        };
                      } else {
                        return {
                          icon: <FaUser />,
                          bgColor: '#64748b',
                          title: 'User Logged In',
                          showAmount: false
                        };
                      }
                    };
                    
                    const activityInfo = getActivityTypeInfo();
                    
                    return (
                      <div key={activity.id} className="activity-item">
                        {/* Content area with icon and card */}
                        <div className="activity-content">
                          {/* Icon box positioned above the card */}
                          <div 
                            className="activity-icon"
                            style={{
                              background: activityInfo.bgColor
                            }}
                          >
                            {activityInfo.icon}
                          </div>
                          
                          {/* Activity card - full width */}
                          <div className="activity-card">
                            <div className="activity-main">
                              <div className="activity-info">
                                <div className="activity-title">
                                  {activityInfo.title}
                                </div>
                                <div className="activity-company" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                  {activity.customerName}
                                </div>
                              </div>
                              <div className="activity-right">
                                {activityInfo.showAmount && (
                                  <div className="activity-amount">
                                    £{activity.amount.toLocaleString()}
                                  </div>
                                )}
                                {/* Time indicator in top right */}
                                <div 
                                  className="activity-time"
                                  style={{ color: secondaryColor }}
                                >
                                  {activity.time.replace(' ago', '').replace('hours', 'hr').replace('hour', 'hr').replace('minutes', 'min').replace('minute', 'min')}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Graph Component */}
        <div className="full-graph-section">
          <FullGraph
            id="revenue-trend"
            title="Revenue Trend"
            subtitle="Daily revenue over time"
            data={dashboardData.chartData}
            lines={[
              { dataKey: 'value', color: getMetricCardColor(0), name: 'Revenue', format: 'currency' }
            ]}
            type="area"
            height={300}
          />
        </div>

        {/* Sales Team Table */}
        <div className="table-section">
          <div className="sales-team-card">
            <div className="card-header">
              <h3 className="card-title">Sales Team Performance</h3>
              <p className="card-subtitle">Top 5 agents by revenue</p>
            </div>
            <DataTable
              columns={tableColumns}
              data={salesTeamData.slice(0, 5)}
              keyExtractor={(item: any) => item.id.toString()}
              className="sales-team-table"
            />
          </div>
        </div>
      </div>
    </div>
  );
}