import { supabase } from './supabaseService';

export interface Analytics {
  // Core metrics
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  
  // Customer metrics
  activeCustomers: number;
  newCustomers: number;
  
  // Order metrics
  pendingOrders: number;
  confirmedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  orderConversion: number;
  
  // Invoice metrics
  outstandingInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalInvoiceAmount: number;
  
  // Financial metrics
  monthlyRevenue: number;
  monthlyExpenses: number;
  profitMargin: number;
  
  // Sales metrics
  teamPerformance: number;
  monthlyTargets: number;
  conversionRate: number;
  
  // System metrics
  activeUsers: number;
  systemHealth: number;
  storageUsage: number;
}

export interface TimeSeriesData {
  name: string;
  date: string;
  value: number;
  orders?: number;
  customers?: number;
  revenue?: number;
}

export interface Activity {
  id: string;
  action: string;
  description: string;
  customerName?: string;
  userName?: string;
  time: string;
  amount?: number;
  type: 'order' | 'invoice' | 'payment' | 'customer' | 'user' | 'system';
  status?: string;
}

export interface TopCustomer {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  lastOrder: string;
  status: string;
}

export interface SalesPersonPerformance {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  target: number;
  performance: number;
}

class AnalyticsDataService {
  private async getUserCompany(): Promise<string | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get user details to find company
    const { data: userData, error } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (error || !userData?.company_id) {
      throw new Error('User company not found');
    }

    return userData.company_id;
  }

  private getDateRange(range: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '7_days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '90_days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '12_months':
      case '1_year':
      case 'last_year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'this_year':
        startDate.setFullYear(startDate.getFullYear(), 0, 1); // January 1st of this year
        break;
      case 'last_month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'last_quarter':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      default: // 30_days
        startDate.setDate(startDate.getDate() - 30);
    }

    console.log(`Date range ${range}: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    return { startDate, endDate };
  }

  async getAnalytics(dateRange: string = '30_days'): Promise<Analytics> {
    const companyId = await this.getUserCompany();
    const { startDate } = this.getDateRange(dateRange);

    // Debug: Check what data actually exists in the database
    const { data: allOrders, count: totalOrderCount } = await supabase
      .from('orders')
      .select('created_at', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: oldestOrders } = await supabase
      .from('orders')
      .select('created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(5);

    console.log('Database data check:', {
      totalOrders: totalOrderCount,
      newestOrder: allOrders?.[0]?.created_at,
      oldestOrder: oldestOrders?.[0]?.created_at,
      companyId,
      requestedStartDate: startDate.toISOString(),
      daysSinceOldest: oldestOrders?.[0] ? Math.floor((new Date().getTime() - new Date(oldestOrders[0].created_at).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A'
    });

    // Fetch all required data in parallel
    const [
      ordersResult,
      customersResult,
      invoicesResult,
      usersResult,
      previousPeriodOrdersResult
    ] = await Promise.all([
      // Current period orders
      supabase
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', startDate.toISOString()),
      
      // Current period customers
      supabase
        .from('customers')
        .select('*')
        .eq('linked_company', companyId)
        .gte('created_date', startDate.toISOString()),
      
      // Current period invoices
      supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', startDate.toISOString()),
      
      // Active users
      supabase
        .from('users')
        .select('id, last_login')
        .eq('company_id', companyId)
        .eq('is_active', true),
      
      // Previous period orders for comparison
      supabase
        .from('orders')
        .select('*')
        .eq('company_id', companyId)
        .lt('created_at', startDate.toISOString())
        .gte('created_at', new Date(startDate.getTime() - (startDate.getTime() - new Date().getTime())).toISOString())
    ]);

    // Process data
    const orders = ordersResult.data || [];
    const customers = customersResult.data || [];
    const invoices = invoicesResult.data || [];
    const users = usersResult.data || [];
    const previousOrders = previousPeriodOrdersResult.data || [];

    console.log(`Analytics for ${dateRange}:`, {
      ordersCount: orders.length,
      customersCount: customers.length,
      invoicesCount: invoices.length,
      dateRange: `${startDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
      sampleOrderDates: orders.slice(0, 3).map(o => o.created_at)
    });

    // Calculate core metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
    const totalCustomers = customers.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate customer metrics
    const uniqueCustomerIds = new Set(orders.map(order => order.customer_id)).size;
    const activeCustomers = uniqueCustomerIds;
    const newCustomers = customers.length;

    // Calculate order status metrics
    const pendingOrders = orders.filter(order => order.order_status === 'pending').length;
    const confirmedOrders = orders.filter(order => order.order_status === 'confirmed').length;
    const shippedOrders = orders.filter(order => order.order_status === 'shipped').length;
    const deliveredOrders = orders.filter(order => order.order_status === 'delivered').length;

    // Calculate conversion rate
    const previousTotalOrders = previousOrders.length;
    const orderConversion = previousTotalOrders > 0 
      ? ((totalOrders - previousTotalOrders) / previousTotalOrders) * 100 
      : 0;

    // Calculate invoice metrics
    const outstandingInvoices = invoices.filter(inv => ['sent', 'overdue'].includes(inv.invoice_status)).length;
    const paidInvoices = invoices.filter(inv => inv.invoice_status === 'paid').length;
    const overdueInvoices = invoices.filter(inv => inv.invoice_status === 'overdue').length;
    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

    // Calculate financial metrics
    const monthlyRevenue = totalRevenue;
    const estimatedExpenses = totalRevenue * 0.7; // Estimate 70% cost
    const monthlyExpenses = estimatedExpenses;
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - estimatedExpenses) / totalRevenue) * 100 : 0;

    // Calculate sales metrics (simplified)
    const teamPerformance = totalRevenue / 1000; // Simplified performance metric
    const monthlyTargets = teamPerformance * 1.2; // 20% above current performance
    const conversionRate = activeCustomers > 0 ? (totalOrders / activeCustomers) * 100 : 0;

    // Calculate system metrics
    const activeUsers = users.filter(user => {
      if (!user.last_login) return false;
      const lastLogin = new Date(user.last_login);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastLogin > thirtyDaysAgo;
    }).length;

    const systemHealth = Math.random() * 20 + 80; // Mock system health 80-100%
    const storageUsage = Math.random() * 30 + 10; // Mock storage usage 10-40%

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      activeCustomers,
      newCustomers,
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      orderConversion,
      outstandingInvoices,
      paidInvoices,
      overdueInvoices,
      totalInvoiceAmount,
      monthlyRevenue,
      monthlyExpenses,
      profitMargin,
      teamPerformance,
      monthlyTargets,
      conversionRate,
      activeUsers,
      systemHealth,
      storageUsage
    };
  }

  async getTimeSeriesData(dateRange: string = '30_days', metric: string = 'revenue'): Promise<TimeSeriesData[]> {
    const companyId = await this.getUserCompany();
    const { startDate, endDate } = this.getDateRange(dateRange);

    // Fetch orders for the time series
    const { data: orders } = await supabase
      .from('orders')
      .select('created_at, total, customer_id')
      .eq('company_id', companyId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at');

    if (!orders) return [];

    // Group data by date
    const dateMap = new Map<string, { revenue: number; orders: number; customers: Set<string> }>();
    
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { revenue: 0, orders: 0, customers: new Set() });
      }
      const dayData = dateMap.get(date)!;
      dayData.revenue += parseFloat(order.total) || 0;
      dayData.orders += 1;
      if (order.customer_id) {
        dayData.customers.add(order.customer_id);
      }
    });

    // Convert to time series format
    const timeSeriesData: TimeSeriesData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = dateMap.get(dateStr) || { revenue: 0, orders: 0, customers: new Set() };
      
      timeSeriesData.push({
        name: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date: dateStr,
        value: dayData.revenue,
        revenue: dayData.revenue,
        orders: dayData.orders,
        customers: dayData.customers.size
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return timeSeriesData;
  }

  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    const companyId = await this.getUserCompany();
    const activities: Activity[] = [];

    // Fetch recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id, 
        created_at, 
        total, 
        order_status,
        customers!inner (display_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentOrders) {
      recentOrders.forEach(order => {
        activities.push({
          id: `order-${order.id}`,
          action: 'New Order',
          description: `Order ${order.order_status}`,
          customerName: (order.customers as any)?.display_name || 'Unknown Customer',
          time: order.created_at,
          amount: parseFloat(order.total),
          type: 'order',
          status: order.order_status
        });
      });
    }

    // Fetch recent invoices
    const { data: recentInvoices } = await supabase
      .from('invoices')
      .select(`
        id,
        created_at,
        total,
        invoice_status,
        customers!inner (display_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentInvoices) {
      recentInvoices.forEach(invoice => {
        activities.push({
          id: `invoice-${invoice.id}`,
          action: 'Invoice',
          description: `Invoice ${invoice.invoice_status}`,
          customerName: (invoice.customers as any)?.display_name || 'Unknown Customer',
          time: invoice.created_at,
          amount: parseFloat(invoice.total),
          type: 'invoice',
          status: invoice.invoice_status
        });
      });
    }

    // Fetch recent customer registrations
    const { data: recentCustomers } = await supabase
      .from('customers')
      .select('id, created_date, display_name')
      .eq('linked_company', companyId)
      .order('created_date', { ascending: false })
      .limit(3);

    if (recentCustomers) {
      recentCustomers.forEach(customer => {
        activities.push({
          id: `customer-${customer.id}`,
          action: 'New Customer',
          description: 'Customer registered',
          customerName: customer.display_name,
          time: customer.created_date,
          type: 'customer'
        });
      });
    }

    // Sort activities by time and limit
    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }

  async getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
    const companyId = await this.getUserCompany();

    const { data: customers } = await supabase
      .from('customers')
      .select(`
        id,
        display_name,
        total_spent,
        order_count,
        last_order_date,
        is_active
      `)
      .eq('linked_company', companyId)
      .order('total_spent', { ascending: false })
      .limit(limit);

    if (!customers) return [];

    return customers.map(customer => ({
      id: customer.id,
      name: customer.display_name,
      orders: customer.order_count || 0,
      revenue: customer.total_spent || 0,
      lastOrder: customer.last_order_date || '',
      status: customer.is_active ? 'Active' : 'Inactive'
    }));
  }

  async getSalesPerformance(): Promise<SalesPersonPerformance[]> {
    const companyId = await this.getUserCompany();

    const { data: salesData } = await supabase
      .from('orders')
      .select(`
        sales_id,
        total,
        users!inner (first_name, last_name)
      `)
      .eq('company_id', companyId)
      .not('sales_id', 'is', null);

    if (!salesData) return [];

    // Group by sales person
    const salesMap = new Map<string, { name: string; orders: number; revenue: number }>();
    
    salesData.forEach(order => {
      if (!order.sales_id || !order.users) return;
      
      const key = order.sales_id;
      const user = order.users as any;
      
      if (!salesMap.has(key)) {
        salesMap.set(key, {
          name: `${user.first_name} ${user.last_name}`,
          orders: 0,
          revenue: 0
        });
      }
      
      const salesperson = salesMap.get(key)!;
      salesperson.orders += 1;
      salesperson.revenue += parseFloat(order.total) || 0;
    });

    // Convert to array with targets and performance
    return Array.from(salesMap.entries()).map(([id, data]) => {
      const target = data.revenue * 1.2; // 20% above current as target
      const performance = target > 0 ? (data.revenue / target) * 100 : 0;
      
      return {
        id,
        name: data.name,
        orders: data.orders,
        revenue: data.revenue,
        target,
        performance
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }
}

export const analyticsDataService = new AnalyticsDataService();