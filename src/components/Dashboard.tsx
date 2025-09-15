import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, ClipboardList, Package, Store, BarChart3, UserPlus, Plus,
  TrendingUp, TrendingDown, Clock, AlertTriangle, ChevronRight,
  DollarSign, ShoppingCart, Activity, Eye, Truck, FileText
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import DashboardMetricCard from './DashboardMetricCard';
import AIInsightWrapper from './AIInsightWrapper/AIInsightWrapper';
import CompactAISummary from './CompactAISummary';
import './Dashboard.css';

interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  recentOrders: any[];
  lowStockItems: any[];
  // New stats for better dashboard
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  activeCustomers: number;
  revenueTrend: number;
  ordersTrend: number;
  customersTrend: number;
  topProducts: any[];
  shippedToday: number;
  invoicesPaidToday: number;
  topSalesPerformers: any[];
}

const getCompanyLogo = (companyName: string, companyReference: string) => {
  const logoMap: { [key: string]: string } = {
    'splitfin': '/logos/splitfinrow.png',
    'dmbrands': '/logos/dmbrands-logo.png',
    'dm brands': '/logos/dmbrands-logo.png',
    'techcorp': '/logos/techcorp-logo.png',
    'techcorp industries': '/logos/techcorp-logo.png',
    'global': '/logos/global-logo.png',
    'global ltd': '/logos/global-logo.png',
    'acme': '/logos/acme-logo.png',
    'acme corporation': '/logos/acme-logo.png'
  };

  const key = companyName?.toLowerCase() || '';
  const refKey = companyReference?.toLowerCase() || '';
  
  return logoMap[key] || logoMap[refKey] || '/logos/splitfinrow.png';
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    recentOrders: [],
    lowStockItems: [],
    todayRevenue: 0,
    todayOrders: 0,
    pendingOrders: 0,
    activeCustomers: 0,
    revenueTrend: 0,
    ordersTrend: 0,
    customersTrend: 0,
    topProducts: [],
    shippedToday: 0,
    invoicesPaidToday: 0,
    topSalesPerformers: []
  });

  useEffect(() => {
    checkAuth();
    loadDashboardData();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/');
        return;
      }
      
      // Get user details from users table
      const { data: userData } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('auth_user_id', authUser.id)
        .single();
      
      setUser(userData);
      setCompany(userData?.companies || null);
    } catch (error) {
      console.error('Auth check failed:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Get user's company
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', authUser.id)
        .single();

      if (!userData?.company_id) return;

      const companyId = userData.company_id;

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get statistics in parallel
      const [
        { count: customersCount },
        { count: ordersCount },
        { data: ordersWithTotal },
        { count: productsCount },
        { data: recentOrdersData },
        { data: lowStockData },
        { data: todayOrdersData },
        { count: pendingCount },
        { data: topProductsData },
        { data: salesUsersData }
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('linked_company', companyId),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('orders').select('total').eq('company_id', companyId),
        supabase.from('items').select('*', { count: 'exact', head: true }),
        supabase
          .from('orders')
          .select(`
            id,
            legacy_order_number,
            order_date,
            total,
            order_status,
            customers (display_name, trading_name)
          `)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('items')
          .select('name, sku, net_stock_level, reorder_level')
          .lt('net_stock_level', 10)
          .order('net_stock_level', { ascending: true })
          .limit(5),
        supabase
          .from('orders')
          .select('total')
          .eq('company_id', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_status', 'pending'),
        supabase
          .from('order_line_items')
          .select(`
            quantity,
            items (name, sku)
          `)
          .limit(5),
        // Get top sales performers
        supabase
          .from('users')
          .select(`
            id,
            first_name,
            last_name,
            role,
            orders!sales_id (
              total,
              order_date
            )
          `)
          .eq('company_id', companyId)
          .in('role', ['Sales', 'Manager'])
          .eq('is_active', true)
      ]);

      const totalRevenue = ordersWithTotal?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const todayRevenue = todayOrdersData?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const todayOrdersCount = todayOrdersData?.length || 0;

      // Calculate trends (mock data for now - in real app, compare with previous period)
      const revenueTrend = 12.5; // Positive trend
      const ordersTrend = -3.2; // Negative trend
      const customersTrend = 8.7; // Positive trend
      
      // Mock data for shipped and invoices paid today
      const shippedToday = Math.floor(Math.random() * 20) + 5; // 5-24 shipments
      const invoicesPaidToday = Math.floor(Math.random() * 15) + 3; // 3-17 invoices

      // Process sales performance data
      const topSalesPerformers = (salesUsersData || [])
        .map((user: any) => {
          const userOrders = user.orders || [];
          const totalRevenue = userOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0);
          const orderCount = userOrders.length;
          
          return {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role === 'Sales' ? 'Sales Rep' : user.role,
            revenue: totalRevenue,
            orderCount: orderCount
          };
        })
        .filter((performer: any) => performer.revenue > 0) // Only show performers with sales
        .sort((a: any, b: any) => b.revenue - a.revenue) // Sort by revenue descending
        .slice(0, 5); // Top 5 performers

      setStats({
        totalCustomers: customersCount || 0,
        totalOrders: ordersCount || 0,
        totalRevenue,
        totalProducts: productsCount || 0,
        recentOrders: recentOrdersData || [],
        lowStockItems: lowStockData || [],
        todayRevenue,
        todayOrders: todayOrdersCount,
        pendingOrders: pendingCount || 0,
        activeCustomers: Math.floor((customersCount || 0) * 0.7), // Mock active customers
        revenueTrend,
        ordersTrend,
        customersTrend,
        topProducts: topProductsData || [],
        shippedToday,
        invoicesPaidToday,
        topSalesPerformers
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Helper functions to convert dashboard data for AI insights
  const getRecentOrdersDataPoints = () => {
    return stats.recentOrders.map(order => ({
      name: `Order ${order.legacy_order_number}`,
      value: order.total || 0,
      date: order.order_date
    }));
  };

  const getLowStockDataPoints = () => {
    return stats.lowStockItems.map(item => ({
      name: item.name || 'Unknown Item',
      value: item.net_stock_level || 0,
      change: item.reorder_level ? ((item.net_stock_level - item.reorder_level) / item.reorder_level * 100) : undefined
    }));
  };

  const getSalesPerformanceDataPoints = () => {
    return stats.topSalesPerformers.map(performer => ({
      name: performer.name,
      value: performer.revenue,
      change: performer.orderCount
    }));
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-pulse">
          <div className="pulse-ring"></div>
          <div className="pulse-ring"></div>
          <div className="pulse-ring"></div>
        </div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      {/* Header Section */}
      <div className="dashboard-header-section">
        <div className="header-content">
          <div className="welcome-section">
            <h1 className="dashboard-title">
              Welcome back, {user?.first_name}
            </h1>

            {/* Compact AI Summary */}
            {company && (
              <CompactAISummary companyId={company.id} />
            )}
          </div>
          {company && (
            <div className="company-logo">
              <img 
                src={getCompanyLogo(company.name, company.company_reference)} 
                alt={company.name}
                onError={(e) => {
                  e.currentTarget.src = '/logos/splitfinrow.png';
                }}
              />
            </div>
          )}
        </div>
        
        {/* Quick Actions Menu */}
        <div className="quick-actions-menu">
          <Link to="/orders/new" className="quick-action-item">
            <Plus size={16} />
            <span>New Order</span>
          </Link>
          <Link to="/enquiries/new" className="quick-action-item">
            <Plus size={16} />
            <span>New Enquiry</span>
          </Link>
          <Link to="/customers/new" className="quick-action-item">
            <UserPlus size={16} />
            <span>Add Customer</span>
          </Link>
          <Link to="/inventory/products" className="quick-action-item">
            <Package size={16} />
            <span>Inventory</span>
          </Link>
          <Link to="/catalogues" className="quick-action-item">
            <Store size={16} />
            <span>Catalogues</span>
          </Link>
          <Link to="/analytics" className="quick-action-item">
            <BarChart3 size={16} />
            <span>Analytics</span>
          </Link>
        </div>
      </div>

      
            {/* Bottom Navigation Grid */}
      <div className="navigation-grid">
        <Link to="/analytics" className="nav-card analytics">
          <div className="nav-icon">
            <BarChart3 size={24} />
          </div>
          <div className="nav-content">
            <h4>Analytics & Reports</h4>
            <p>Deep dive into your data</p>
          </div>
          <ChevronRight className="nav-arrow" size={20} />
        </Link>

        <Link to="/customers" className="nav-card customers">
          <div className="nav-icon">
            <Users size={24} />
          </div>
          <div className="nav-content">
            <h4>Customer Management</h4>
            <p>{stats.totalCustomers} total customers</p>
          </div>
          <ChevronRight className="nav-arrow" size={20} />
        </Link>

        <Link to="/inventory/overview" className="nav-card inventory">
          <div className="nav-icon">
            <Package size={24} />
          </div>
          <div className="nav-content">
            <h4>Inventory Control</h4>
            <p>{stats.totalProducts} products</p>
          </div>
          <ChevronRight className="nav-arrow" size={20} />
        </Link>
      </div>
      

      {/* Main Content Grid */}
      <div className="dashboard-main-grid">
        {/* Recent Orders */}
        <AIInsightWrapper
          cardTitle="Recent Orders"
          currentData={getRecentOrdersDataPoints()}
          dataType="orders"
          timeFrame="daily"
          buttonPosition="top-right"
          buttonSize="small"
          buttonVariant="ghost"
        >
          <div className="content-card orders-card">
            <div className="card-header">
              <h3 className="card-title">
                <ClipboardList size={18} />
                Recent Orders
              </h3>
              <Link to="/orders" className="card-action">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-content">
              {stats.recentOrders.length > 0 ? (
                <div className="orders-list">
                  {stats.recentOrders.map((order) => (
                    <div key={order.id} className="order-row">
                      <div className="order-main">
                        <div className="order-id">#{order.legacy_order_number}</div>
                        <div className="order-customer">
                          {order.customers?.display_name || order.customers?.trading_name || 'Unknown'}
                        </div>
                      </div>
                      <div className="order-meta">
                        <div className="order-amount">{formatCurrency(order.total || 0)}</div>
                        <div className={`order-badge ${order.order_status}`}>
                          {order.order_status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <ClipboardList size={32} />
                  <p>No recent orders</p>
                </div>
              )}
            </div>
          </div>
        </AIInsightWrapper>

        {/* Inventory Alerts */}
        <AIInsightWrapper
          cardTitle="Low Stock Alerts"
          currentData={getLowStockDataPoints()}
          dataType="products"
          timeFrame="daily"
          buttonPosition="top-right"
          buttonSize="small"
          buttonVariant="ghost"
        >
          <div className="content-card alerts-card">
            <div className="card-header">
              <h3 className="card-title">
                <AlertTriangle size={18} />
                Low Stock Alerts
                {stats.lowStockItems.length > 0 && (
                  <span className="alert-count">{stats.lowStockItems.length}</span>
                )}
              </h3>
              <Link to="/inventory/products" className="card-action">
                Manage <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-content">
              {stats.lowStockItems.length > 0 ? (
                <div className="alerts-list">
                  {stats.lowStockItems.map((item, index) => (
                    <div key={index} className="alert-row">
                      <div className="alert-info">
                        <div className="alert-name">{item.name}</div>
                        <div className="alert-sku">SKU: {item.sku}</div>
                      </div>
                      <div className="alert-stock">
                        <div className="stock-value critical">
                          {item.net_stock_level}
                        </div>
                        <div className="stock-label">left</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state success">
                  <Package size={32} />
                  <p>All items well stocked</p>
                </div>
              )}
            </div>
          </div>
        </AIInsightWrapper>

        {/* Top Performing Sales People */}
        <AIInsightWrapper
          cardTitle="Sales Performance"
          currentData={getSalesPerformanceDataPoints()}
          dataType="performance"
          timeFrame="monthly"
          buttonPosition="top-right"
          buttonSize="small"
          buttonVariant="ghost"
        >
          <div className="content-card sales-card">
            <div className="card-header">
              <h3 className="card-title">
                <TrendingUp size={18} />
                Top Performing Sales
              </h3>
              <Link to="/analytics/sales" className="card-action">
                View All <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-content">
              {stats.topSalesPerformers.length > 0 ? (
                <div className="sales-list">
                  {stats.topSalesPerformers.map((performer) => (
                    <div key={performer.id} className="sales-row">
                      <div className="sales-info">
                        <div className="sales-name">{performer.name}</div>
                        <div className="sales-position">{performer.role}</div>
                      </div>
                      <div className="sales-metrics">
                        <div className="sales-amount">{formatCurrency(performer.revenue)}</div>
                        <div className="sales-orders">{performer.orderCount} orders</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <TrendingUp size={32} />
                  <p>No sales performance data available</p>
                </div>
              )}
            </div>
          </div>
        </AIInsightWrapper>
      </div>

    </div>
  );
};

export default Dashboard;
