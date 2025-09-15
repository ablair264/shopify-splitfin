import { shopifyApiService } from './shopifyApiService';
import { aiInsightService } from '../../services/aiInsightService';
import { SHOPIFY_CONFIG } from '../config';

interface AnalyticsMetric {
  value: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

interface SalesAnalytics {
  totalSales: AnalyticsMetric;
  orderCount: AnalyticsMetric;
  averageOrderValue: AnalyticsMetric;
  conversionRate: AnalyticsMetric;
  returningCustomerRate: AnalyticsMetric;
}

interface ProductAnalytics {
  topProducts: Array<{
    id: string;
    title: string;
    sku: string;
    sales: number;
    revenue: number;
    quantity: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    sales: number;
    revenue: number;
    products: number;
  }>;
  inventoryAlerts: Array<{
    id: string;
    title: string;
    sku: string;
    currentStock: number;
    reorderPoint: number;
    daysUntilStockout: number;
  }>;
}

interface CustomerAnalytics {
  totalCustomers: AnalyticsMetric;
  newCustomers: AnalyticsMetric;
  repeatPurchaseRate: AnalyticsMetric;
  customerLifetimeValue: AnalyticsMetric;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
    lastOrderDate: string;
  }>;
}

interface MarketingAnalytics {
  trafficSources: Array<{
    source: string;
    sessions: number;
    conversionRate: number;
    revenue: number;
  }>;
  campaignPerformance: Array<{
    campaign: string;
    impressions: number;
    clicks: number;
    conversions: number;
    roi: number;
  }>;
  socialMediaMetrics: {
    engagement: number;
    reach: number;
    shares: number;
  };
}

export interface ShopifyAnalyticsDashboard {
  sales: SalesAnalytics;
  products: ProductAnalytics;
  customers: CustomerAnalytics;
  marketing: MarketingAnalytics;
  insights: Array<{
    type: 'opportunity' | 'warning' | 'success';
    title: string;
    description: string;
    action?: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

class ShopifyAnalyticsService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  // Get comprehensive analytics dashboard
  public async getAnalyticsDashboard(
    dateRange: { start: Date; end: Date } = this.getDefaultDateRange()
  ): Promise<ShopifyAnalyticsDashboard> {
    const cacheKey = `dashboard_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      // Fetch all analytics data in parallel
      const [sales, products, customers, marketing] = await Promise.all([
        this.getSalesAnalytics(dateRange),
        this.getProductAnalytics(dateRange),
        this.getCustomerAnalytics(dateRange),
        this.getMarketingAnalytics(dateRange),
      ]);

      // Generate AI insights
      const insights = await this.generateAIInsights({
        sales,
        products,
        customers,
        marketing,
      });

      const dashboard: ShopifyAnalyticsDashboard = {
        sales,
        products,
        customers,
        marketing,
        insights,
      };

      this.setCachedData(cacheKey, dashboard);
      return dashboard;
    } catch (error) {
      console.error('Error fetching analytics dashboard:', error);
      throw error;
    }
  }

  // Get sales analytics
  private async getSalesAnalytics(dateRange: { start: Date; end: Date }): Promise<SalesAnalytics> {
    try {
      // Get current period data
      const currentOrders = await this.getOrdersForPeriod(dateRange);
      
      // Get previous period data for comparison
      const previousPeriod = this.getPreviousPeriod(dateRange);
      const previousOrders = await this.getOrdersForPeriod(previousPeriod);

      // Calculate metrics
      const currentMetrics = this.calculateSalesMetrics(currentOrders);
      const previousMetrics = this.calculateSalesMetrics(previousOrders);

      return {
        totalSales: this.compareMetrics(currentMetrics.totalSales, previousMetrics.totalSales),
        orderCount: this.compareMetrics(currentMetrics.orderCount, previousMetrics.orderCount),
        averageOrderValue: this.compareMetrics(currentMetrics.averageOrderValue, previousMetrics.averageOrderValue),
        conversionRate: this.compareMetrics(currentMetrics.conversionRate, previousMetrics.conversionRate),
        returningCustomerRate: this.compareMetrics(currentMetrics.returningCustomerRate, previousMetrics.returningCustomerRate),
      };
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      throw error;
    }
  }

  // Get product analytics
  private async getProductAnalytics(dateRange: { start: Date; end: Date }): Promise<ProductAnalytics> {
    try {
      const orders = await this.getOrdersForPeriod(dateRange);
      
      // Aggregate product sales
      const productSales = new Map<string, any>();
      const categoryPerformance = new Map<string, any>();

      for (const order of orders) {
        for (const lineItem of order.line_items) {
          const productId = lineItem.product_id;
          const existing = productSales.get(productId) || {
            id: productId,
            title: lineItem.title,
            sku: lineItem.sku,
            sales: 0,
            revenue: 0,
            quantity: 0,
          };

          existing.sales += 1;
          existing.revenue += parseFloat(lineItem.price) * lineItem.quantity;
          existing.quantity += lineItem.quantity;
          
          productSales.set(productId, existing);
        }
      }

      // Get top products
      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Get inventory levels
      const inventoryAlerts = await this.getInventoryAlerts();

      return {
        topProducts,
        categoryPerformance: Array.from(categoryPerformance.values()),
        inventoryAlerts,
      };
    } catch (error) {
      console.error('Error fetching product analytics:', error);
      throw error;
    }
  }

  // Get customer analytics
  private async getCustomerAnalytics(dateRange: { start: Date; end: Date }): Promise<CustomerAnalytics> {
    try {
      // Get customers
      const currentCustomers = await this.getCustomersForPeriod(dateRange);
      const previousPeriod = this.getPreviousPeriod(dateRange);
      const previousCustomers = await this.getCustomersForPeriod(previousPeriod);

      // Calculate metrics
      const currentMetrics = this.calculateCustomerMetrics(currentCustomers);
      const previousMetrics = this.calculateCustomerMetrics(previousCustomers);

      // Get top customers
      const topCustomers = currentCustomers
        .sort((a, b) => parseFloat(b.total_spent) - parseFloat(a.total_spent))
        .slice(0, 10)
        .map(customer => ({
          id: customer.id,
          name: `${customer.first_name} ${customer.last_name}`,
          email: customer.email,
          totalSpent: parseFloat(customer.total_spent),
          orderCount: customer.orders_count,
          lastOrderDate: customer.last_order_name || '',
        }));

      return {
        totalCustomers: this.compareMetrics(currentMetrics.totalCustomers, previousMetrics.totalCustomers),
        newCustomers: this.compareMetrics(currentMetrics.newCustomers, previousMetrics.newCustomers),
        repeatPurchaseRate: this.compareMetrics(currentMetrics.repeatPurchaseRate, previousMetrics.repeatPurchaseRate),
        customerLifetimeValue: this.compareMetrics(currentMetrics.customerLifetimeValue, previousMetrics.customerLifetimeValue),
        topCustomers,
      };
    } catch (error) {
      console.error('Error fetching customer analytics:', error);
      throw error;
    }
  }

  // Get marketing analytics (placeholder - would need additional integrations)
  private async getMarketingAnalytics(dateRange: { start: Date; end: Date }): Promise<MarketingAnalytics> {
    // This would typically integrate with Google Analytics, Facebook Ads, etc.
    return {
      trafficSources: [
        {
          source: 'Direct',
          sessions: 5000,
          conversionRate: 3.5,
          revenue: 25000,
        },
        {
          source: 'Google',
          sessions: 3500,
          conversionRate: 2.8,
          revenue: 18000,
        },
        {
          source: 'Social Media',
          sessions: 2000,
          conversionRate: 2.1,
          revenue: 8000,
        },
      ],
      campaignPerformance: [],
      socialMediaMetrics: {
        engagement: 0,
        reach: 0,
        shares: 0,
      },
    };
  }

  // Generate AI insights
  private async generateAIInsights(data: Omit<ShopifyAnalyticsDashboard, 'insights'>): Promise<ShopifyAnalyticsDashboard['insights']> {
    const insights: ShopifyAnalyticsDashboard['insights'] = [];

    try {
      // Sales insights
      if (data.sales.totalSales.changePercent < -10) {
        insights.push({
          type: 'warning',
          title: 'Sales Decline Detected',
          description: `Sales have decreased by ${Math.abs(data.sales.totalSales.changePercent).toFixed(1)}% compared to the previous period.`,
          action: 'Review marketing campaigns and product offerings',
          priority: 'high',
        });
      } else if (data.sales.totalSales.changePercent > 20) {
        insights.push({
          type: 'success',
          title: 'Strong Sales Growth',
          description: `Sales have increased by ${data.sales.totalSales.changePercent.toFixed(1)}% compared to the previous period.`,
          action: 'Capitalize on momentum with targeted campaigns',
          priority: 'medium',
        });
      }

      // Inventory insights
      const criticalStock = data.products.inventoryAlerts.filter(alert => alert.daysUntilStockout < 7);
      if (criticalStock.length > 0) {
        insights.push({
          type: 'warning',
          title: 'Low Inventory Alert',
          description: `${criticalStock.length} products will be out of stock within 7 days.`,
          action: 'Reorder inventory immediately',
          priority: 'high',
        });
      }

      // Customer insights
      if (data.customers.repeatPurchaseRate.value < 20) {
        insights.push({
          type: 'opportunity',
          title: 'Improve Customer Retention',
          description: 'Your repeat purchase rate is below industry average.',
          action: 'Implement a loyalty program or email marketing campaign',
          priority: 'medium',
        });
      }

      // Product performance insights
      const topProduct = data.products.topProducts[0];
      if (topProduct && topProduct.revenue > data.sales.totalSales.value * 0.3) {
        insights.push({
          type: 'opportunity',
          title: 'Product Concentration Risk',
          description: `${topProduct.title} accounts for over 30% of total revenue.`,
          action: 'Diversify product offerings to reduce dependency',
          priority: 'medium',
        });
      }

      // Use AI to generate additional insights
      const aiInsights = await aiInsightService.generateAnalyticsInsights({
        salesTrend: data.sales.totalSales.trend,
        topProducts: data.products.topProducts.slice(0, 5),
        customerGrowth: data.customers.newCustomers.changePercent,
      });

      if (aiInsights && aiInsights.insights) {
        insights.push(...aiInsights.insights.map(insight => ({
          type: 'opportunity' as const,
          title: insight.title,
          description: insight.description,
          action: insight.recommendation,
          priority: 'medium' as const,
        })));
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
    }

    return insights;
  }

  // Helper methods
  private getDefaultDateRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - SHOPIFY_CONFIG.ANALYTICS.DEFAULT_DATE_RANGE);
    return { start, end };
  }

  private getPreviousPeriod(dateRange: { start: Date; end: Date }): { start: Date; end: Date } {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime()),
    };
  }

  private async getOrdersForPeriod(dateRange: { start: Date; end: Date }): Promise<any[]> {
    const orders: any[] = [];
    let hasNextPage = true;
    let pageInfo: string | undefined;

    while (hasNextPage) {
      const response = await shopifyApiService.getOrders({
        limit: 250,
        page_info: pageInfo,
        created_at_min: dateRange.start.toISOString(),
        created_at_max: dateRange.end.toISOString(),
        status: 'any',
      });

      orders.push(...response.orders);
      
      // Check for next page (would need to be implemented based on headers)
      hasNextPage = false;
    }

    return orders;
  }

  private async getCustomersForPeriod(dateRange: { start: Date; end: Date }): Promise<any[]> {
    const customers: any[] = [];
    let hasNextPage = true;
    let pageInfo: string | undefined;

    while (hasNextPage) {
      const response = await shopifyApiService.getCustomers({
        limit: 250,
        page_info: pageInfo,
        created_at_min: dateRange.start.toISOString(),
        created_at_max: dateRange.end.toISOString(),
      });

      customers.push(...response.customers);
      
      // Check for next page
      hasNextPage = false;
    }

    return customers;
  }

  private calculateSalesMetrics(orders: any[]): any {
    const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
    
    // Calculate returning customer rate
    const customerOrders = new Map<string, number>();
    orders.forEach(order => {
      if (order.customer?.id) {
        customerOrders.set(order.customer.id, (customerOrders.get(order.customer.id) || 0) + 1);
      }
    });
    const returningCustomers = Array.from(customerOrders.values()).filter(count => count > 1).length;
    const returningCustomerRate = customerOrders.size > 0 ? (returningCustomers / customerOrders.size) * 100 : 0;

    return {
      totalSales,
      orderCount,
      averageOrderValue,
      conversionRate: 0, // Would need session data
      returningCustomerRate,
    };
  }

  private calculateCustomerMetrics(customers: any[]): any {
    const totalCustomers = customers.length;
    const newCustomers = customers.filter(c => c.orders_count === 1).length;
    const totalSpent = customers.reduce((sum, c) => sum + parseFloat(c.total_spent), 0);
    const customerLifetimeValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0;
    const repeatPurchaseRate = totalCustomers > 0 ? ((totalCustomers - newCustomers) / totalCustomers) * 100 : 0;

    return {
      totalCustomers,
      newCustomers,
      repeatPurchaseRate,
      customerLifetimeValue,
    };
  }

  private compareMetrics(current: number, previous: number): AnalyticsMetric {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;
    
    return {
      value: current,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      period: 'current',
    };
  }

  private async getInventoryAlerts(): Promise<any[]> {
    // This would require inventory tracking data
    return [];
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < SHOPIFY_CONFIG.ANALYTICS.MAX_CACHE_AGE) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Export analytics data
  public async exportAnalytics(
    type: 'sales' | 'products' | 'customers' | 'full',
    format: 'csv' | 'excel' | 'pdf',
    dateRange?: { start: Date; end: Date }
  ): Promise<Blob> {
    const analytics = await this.getAnalyticsDashboard(dateRange);
    
    // Prepare data based on type
    let exportData: any;
    switch (type) {
      case 'sales':
        exportData = this.prepareSalesExport(analytics.sales);
        break;
      case 'products':
        exportData = this.prepareProductsExport(analytics.products);
        break;
      case 'customers':
        exportData = this.prepareCustomersExport(analytics.customers);
        break;
      default:
        exportData = this.prepareFullExport(analytics);
    }

    // Convert to requested format
    switch (format) {
      case 'csv':
        return this.exportToCSV(exportData);
      case 'excel':
        return this.exportToExcel(exportData);
      case 'pdf':
        return this.exportToPDF(exportData);
      default:
        throw new Error('Unsupported export format');
    }
  }

  private prepareSalesExport(sales: SalesAnalytics): any {
    return {
      summary: [
        { metric: 'Total Sales', value: sales.totalSales.value, change: sales.totalSales.changePercent },
        { metric: 'Order Count', value: sales.orderCount.value, change: sales.orderCount.changePercent },
        { metric: 'Average Order Value', value: sales.averageOrderValue.value, change: sales.averageOrderValue.changePercent },
        { metric: 'Conversion Rate', value: sales.conversionRate.value, change: sales.conversionRate.changePercent },
        { metric: 'Returning Customer Rate', value: sales.returningCustomerRate.value, change: sales.returningCustomerRate.changePercent },
      ],
    };
  }

  private prepareProductsExport(products: ProductAnalytics): any {
    return {
      topProducts: products.topProducts,
      categoryPerformance: products.categoryPerformance,
      inventoryAlerts: products.inventoryAlerts,
    };
  }

  private prepareCustomersExport(customers: CustomerAnalytics): any {
    return {
      summary: [
        { metric: 'Total Customers', value: customers.totalCustomers.value, change: customers.totalCustomers.changePercent },
        { metric: 'New Customers', value: customers.newCustomers.value, change: customers.newCustomers.changePercent },
        { metric: 'Repeat Purchase Rate', value: customers.repeatPurchaseRate.value, change: customers.repeatPurchaseRate.changePercent },
        { metric: 'Customer Lifetime Value', value: customers.customerLifetimeValue.value, change: customers.customerLifetimeValue.changePercent },
      ],
      topCustomers: customers.topCustomers,
    };
  }

  private prepareFullExport(analytics: ShopifyAnalyticsDashboard): any {
    return {
      sales: this.prepareSalesExport(analytics.sales),
      products: this.prepareProductsExport(analytics.products),
      customers: this.prepareCustomersExport(analytics.customers),
      marketing: analytics.marketing,
      insights: analytics.insights,
    };
  }

  private exportToCSV(data: any): Blob {
    // Implementation would convert data to CSV format
    const csv = JSON.stringify(data); // Placeholder
    return new Blob([csv], { type: 'text/csv' });
  }

  private exportToExcel(data: any): Blob {
    // Implementation would use XLSX library
    const excel = JSON.stringify(data); // Placeholder
    return new Blob([excel], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  private exportToPDF(data: any): Blob {
    // Implementation would generate PDF report
    const pdf = JSON.stringify(data); // Placeholder
    return new Blob([pdf], { type: 'application/pdf' });
  }
}

export const shopifyAnalyticsService = new ShopifyAnalyticsService();