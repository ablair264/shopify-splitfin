import { supabase } from './supabaseService';
import { WidgetConfig } from '../components/analytics/CustomizableDashboard/CustomizableDashboard';

export interface AnalyticsPage {
  id: string;
  name: string;
  icon: string;
  template: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  widgets?: WidgetConfig[];
  layouts?: any;
}

export interface CreatePageRequest {
  name: string;
  icon: string;
  template: string;
}

// Template widget configurations
const templateWidgets: Record<string, WidgetConfig[]> = {
  customers: [
    {
      id: 'customers-total',
      title: 'Total Customers',
      subtitle: 'All registered customers',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      config: {
        metric: 'totalCustomers',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'customers-new',
      title: 'New Customers',
      subtitle: 'Recently joined customers',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      config: {
        metric: 'newCustomers',
        displayMode: 'medium',
        showTrend: true,
        color: '#4daeac',
        variant: 'variant2'
      }
    },
    {
      id: 'customers-active',
      title: 'Active Customers',
      subtitle: 'Customers with recent orders',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      config: {
        metric: 'activeCustomers',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'customers-growth-chart',
      title: 'Customer Growth',
      subtitle: 'Customer acquisition over time',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'customers',
      config: {
        chartType: 'line',
        size: 'full',
        color: '#79d5e9',
        showLegend: true
      }
    },
    {
      id: 'customers-table',
      title: 'Top Customers',
      subtitle: 'Customers by revenue',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'customers',
      config: {
        size: 'full',
        maxRows: 10,
        columns: [
          { key: 'name', header: 'Customer', width: '40%', format: 'text' },
          { key: 'orders', header: 'Orders', width: '20%', format: 'number' },
          { key: 'revenue', header: 'Revenue', width: '25%', format: 'currency' },
          { key: 'status', header: 'Status', width: '15%', format: 'text' }
        ]
      }
    }
  ],
  orders: [
    {
      id: 'orders-total',
      title: 'Total Orders',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'totalOrders',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'orders-pending',
      title: 'Pending Orders',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'pendingOrders',
        displayMode: 'medium',
        showTrend: false,
        color: '#fbbf24',
        variant: 'variant2'
      }
    },
    {
      id: 'orders-conversion',
      title: 'Order Conversion',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'orderConversion',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'orders-chart',
      title: 'Orders Over Time',
      subtitle: '',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      config: {
        chartType: 'bar',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'orders-table',
      title: 'Recent Orders',
      subtitle: '',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'orders',
      config: {
        size: 'full',
        maxRows: 10
      }
    }
  ],
  invoices: [
    {
      id: 'invoices-revenue',
      title: 'Total Revenue',
      subtitle: 'Revenue from all invoices',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'totalRevenue',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'invoices-outstanding',
      title: 'Outstanding Invoices',
      subtitle: 'Unpaid invoices',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'outstandingInvoices',
        displayMode: 'medium',
        showTrend: false,
        color: '#dc2626',
        variant: 'variant2'
      }
    },
    {
      id: 'invoices-paid',
      title: 'Paid Invoices',
      subtitle: 'Successfully collected payments',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'paidInvoices',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'invoices-chart',
      title: 'Revenue Trend',
      subtitle: 'Monthly revenue progression',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      config: {
        chartType: 'area',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'invoices-table',
      title: 'Recent Invoices',
      subtitle: 'Latest invoice activity',
      type: 'activity',
      displayFormat: 'ActivityFeed',
      dataSource: 'activities',
      config: {
        size: 'full',
        maxActivities: 8,
        showFilters: true
      }
    }
  ],
  'sales-team': [
    {
      id: 'sales-performance',
      title: 'Team Performance',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'sales_team',
      config: {
        metric: 'teamPerformance',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'sales-targets',
      title: 'Monthly Targets',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'sales_team',
      config: {
        metric: 'monthlyTargets',
        displayMode: 'medium',
        showTrend: false,
        color: '#fbbf24',
        variant: 'variant2'
      }
    },
    {
      id: 'sales-conversion',
      title: 'Conversion Rate',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'sales_team',
      config: {
        metric: 'conversionRate',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'sales-chart',
      title: 'Sales Performance',
      subtitle: '',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'sales_team',
      config: {
        chartType: 'bar',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'sales-table',
      title: 'Sales Team Leaderboard',
      subtitle: '',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'sales_team',
      config: {
        size: 'full',
        maxRows: 10,
        columns: [
          { key: 'name', header: 'Name', width: '40%', format: 'text' },
          { key: 'orders', header: 'Orders', width: '30%', format: 'number' },
          { key: 'revenue', header: 'Revenue', width: '30%', format: 'currency' }
        ]
      }
    }
  ],
  admin: [
    {
      id: 'admin-health',
      title: 'System Health',
      subtitle: 'Overall system performance',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'systemHealth',
        displayMode: 'medium',
        showTrend: false,
        color: '#61bc8e',
        variant: 'variant1'
      }
    },
    {
      id: 'admin-users',
      title: 'Active Users',
      subtitle: 'Currently active system users',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      config: {
        metric: 'activeUsers',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant2'
      }
    },
    {
      id: 'admin-storage',
      title: 'Storage Usage',
      subtitle: 'System storage utilization',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'storageUsage',
        displayMode: 'medium',
        showTrend: false,
        color: '#fbbf24',
        variant: 'variant3'
      }
    },
    {
      id: 'admin-chart',
      title: 'System Activity',
      subtitle: 'Daily system usage metrics',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      config: {
        chartType: 'line',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'admin-activities',
      title: 'Recent Admin Actions',
      subtitle: 'Latest system activities',
      type: 'activity',
      displayFormat: 'ActivityFeed',
      dataSource: 'activities',
      config: {
        size: 'full',
        maxActivities: 10,
        showFilters: true
      }
    }
  ],
  finance: [
    {
      id: 'finance-revenue',
      title: 'Total Revenue',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'totalRevenue',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'finance-expenses',
      title: 'Monthly Expenses',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'monthlyExpenses',
        displayMode: 'medium',
        showTrend: true,
        color: '#dc2626',
        variant: 'variant2'
      }
    },
    {
      id: 'finance-profit',
      title: 'Profit Margin',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'profitMargin',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'finance-chart',
      title: 'Financial Trend',
      subtitle: '',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      config: {
        chartType: 'area',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'finance-table',
      title: 'Budget vs Actual',
      subtitle: '',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'orders',
      config: {
        size: 'full',
        maxRows: 10
      }
    }
  ],
  overview: [
    {
      id: 'overview-revenue',
      title: 'Total Revenue',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'totalRevenue',
        displayMode: 'medium',
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1'
      }
    },
    {
      id: 'overview-orders',
      title: 'Total Orders',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      config: {
        metric: 'totalOrders',
        displayMode: 'medium',
        showTrend: true,
        color: '#4daeac',
        variant: 'variant2'
      }
    },
    {
      id: 'overview-customers',
      title: 'Active Customers',
      subtitle: '',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      config: {
        metric: 'activeCustomers',
        displayMode: 'medium',
        showTrend: true,
        color: '#61bc8e',
        variant: 'variant3'
      }
    },
    {
      id: 'overview-chart',
      title: 'Business Overview',
      subtitle: '',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      config: {
        chartType: 'area',
        size: 'full',
        color: '#79d5e9'
      }
    },
    {
      id: 'overview-activity',
      title: 'Recent Activity',
      subtitle: '',
      type: 'activity',
      displayFormat: 'ActivityFeed',
      dataSource: 'activities',
      config: {
        size: 'full',
        maxActivities: 6,
        showFilters: true
      }
    }
  ]
};

// Generate default layouts for widgets
function generateDefaultLayouts(widgets: WidgetConfig[]) {
  const lg: any[] = [];
  const md: any[] = [];
  const sm: any[] = [];
  
  let currentY = 0;
  let currentX = 0;
  
  widgets.forEach((widget, index) => {
    const isFullWidth = widget.config.size === 'full' || 
      ['FullGraph', 'DataTable', 'ActivityFeed'].includes(widget.displayFormat);
    
    const widgetWidth = isFullWidth ? 9 : 3;
    const widgetHeight = ['FullGraph'].includes(widget.displayFormat) ? 5 : 
                        ['DataTable', 'ActivityFeed'].includes(widget.displayFormat) ? 4 : 3;
    
    // Large screens (lg)
    if (isFullWidth || currentX + widgetWidth > 12) {
      currentY += widgetHeight;
      currentX = 0;
    }
    
    lg.push({
      i: widget.id,
      x: currentX,
      y: currentY,
      w: widgetWidth,
      h: widgetHeight
    });
    
    if (isFullWidth) {
      currentX = 0;
      currentY += widgetHeight;
    } else {
      currentX += widgetWidth;
    }
    
    // Medium screens (md) - adjust width
    md.push({
      i: widget.id,
      x: currentX > 0 ? Math.min(currentX, 4) : 0,
      y: currentY,
      w: widgetWidth === 9 ? 8 : (widgetWidth === 3 ? 4 : widgetWidth),
      h: widgetHeight
    });
    
    // Small screens (sm) - all full width
    sm.push({
      i: widget.id,
      x: 0,
      y: index * widgetHeight,
      w: 6,
      h: widgetHeight
    });
  });
  
  return { lg, md, sm };
}

class AnalyticsPageService {
  private tableName = 'analytics_pages';
  
  async createPage(pageData: CreatePageRequest): Promise<AnalyticsPage> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get template widgets
    const widgets = templateWidgets[pageData.template] || templateWidgets.overview;
    
    // Generate unique IDs for widgets
    const widgetsWithUniqueIds = widgets.map(widget => ({
      ...widget,
      id: `${pageData.template}-${widget.id.split('-').pop()}-${Date.now()}`
    }));

    // Generate default layouts
    const layouts = generateDefaultLayouts(widgetsWithUniqueIds);

    const newPage: Omit<AnalyticsPage, 'id' | 'created_at' | 'updated_at'> = {
      name: pageData.name,
      icon: pageData.icon,
      template: pageData.template,
      user_id: user.id,
      widgets: widgetsWithUniqueIds,
      layouts
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([newPage])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create analytics page: ${error.message}`);
    }

    return data as AnalyticsPage;
  }

  async getUserPages(): Promise<AnalyticsPage[]> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch analytics pages: ${error.message}`);
    }

    return data as AnalyticsPage[];
  }

  async getPage(pageId: string): Promise<AnalyticsPage | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', pageId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Page not found
      }
      throw new Error(`Failed to fetch analytics page: ${error.message}`);
    }

    return data as AnalyticsPage;
  }

  async updatePage(pageId: string, updates: Partial<AnalyticsPage>): Promise<AnalyticsPage> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', pageId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update analytics page: ${error.message}`);
    }

    return data as AnalyticsPage;
  }

  async deletePage(pageId: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', pageId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to delete analytics page: ${error.message}`);
    }
  }
}

export const analyticsPageService = new AnalyticsPageService();