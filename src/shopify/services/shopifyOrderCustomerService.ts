import { shopifyApiService } from './shopifyApiService';
import { aiInsightService } from '../../services/aiInsightService';
import { ShopifyOrder, ShopifyCustomer, ShopifyLineItem } from '../types';

interface OrderFilter {
  status?: 'open' | 'closed' | 'cancelled' | 'any';
  financialStatus?: 'paid' | 'pending' | 'refunded' | 'authorized' | 'any';
  fulfillmentStatus?: 'shipped' | 'partial' | 'unshipped' | 'any';
  dateRange?: { start: Date; end: Date };
  customerId?: string;
  tag?: string;
  searchTerm?: string;
}

interface CustomerFilter {
  dateRange?: { start: Date; end: Date };
  tag?: string;
  orderCount?: { min?: number; max?: number };
  totalSpent?: { min?: number; max?: number };
  searchTerm?: string;
  acceptsMarketing?: boolean;
}

interface OrderSummary {
  order: ShopifyOrder;
  summary: {
    itemCount: number;
    uniqueProducts: number;
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  timeline: Array<{
    date: string;
    event: string;
    status: string;
    note?: string;
  }>;
}

interface CustomerProfile {
  customer: ShopifyCustomer;
  stats: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate?: string;
    firstOrderDate?: string;
    daysAsCustomer: number;
    preferredProducts: Array<{
      productId: string;
      title: string;
      orderCount: number;
    }>;
  };
  segments: string[];
  lifetime: {
    value: number;
    prediction: number;
    churnRisk: 'low' | 'medium' | 'high';
  };
}

interface BatchUpdateResult {
  successful: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

class ShopifyOrderCustomerService {
  // Orders Management
  
  public async getOrders(filter: OrderFilter = {}): Promise<{
    orders: OrderSummary[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const params: any = {
        limit: 50,
        status: filter.status || 'any',
      };

      if (filter.financialStatus && filter.financialStatus !== 'any') {
        params.financial_status = filter.financialStatus;
      }

      if (filter.fulfillmentStatus && filter.fulfillmentStatus !== 'any') {
        params.fulfillment_status = filter.fulfillmentStatus;
      }

      if (filter.dateRange) {
        params.created_at_min = filter.dateRange.start.toISOString();
        params.created_at_max = filter.dateRange.end.toISOString();
      }

      if (filter.customerId) {
        params.customer_id = filter.customerId;
      }

      const response = await shopifyApiService.getOrders(params);
      
      // Get total count
      const countResponse = await shopifyApiService.getOrderCount(params);
      
      // Process orders with summaries
      const orderSummaries = await Promise.all(
        response.orders.map(order => this.createOrderSummary(order))
      );

      // Filter by search term if provided
      let filteredOrders = orderSummaries;
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filteredOrders = orderSummaries.filter(summary => 
          summary.order.name.toLowerCase().includes(searchLower) ||
          summary.order.email.toLowerCase().includes(searchLower) ||
          summary.order.customer?.first_name?.toLowerCase().includes(searchLower) ||
          summary.order.customer?.last_name?.toLowerCase().includes(searchLower) ||
          summary.order.line_items.some(item => 
            item.title.toLowerCase().includes(searchLower) ||
            item.sku?.toLowerCase().includes(searchLower)
          )
        );
      }

      return {
        orders: filteredOrders,
        totalCount: countResponse.count,
        hasMore: response.orders.length === 50,
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  private async createOrderSummary(order: ShopifyOrder): Promise<OrderSummary> {
    const itemCount = order.line_items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueProducts = new Set(order.line_items.map(item => item.product_id)).size;

    const timeline: OrderSummary['timeline'] = [
      {
        date: order.created_at,
        event: 'Order Created',
        status: 'completed',
      },
    ];

    if (order.financial_status === 'paid') {
      timeline.push({
        date: order.processed_at || order.created_at,
        event: 'Payment Processed',
        status: 'completed',
      });
    }

    if (order.fulfillment_status === 'fulfilled') {
      timeline.push({
        date: order.updated_at,
        event: 'Order Fulfilled',
        status: 'completed',
      });
    }

    if (order.cancelled_at) {
      timeline.push({
        date: order.cancelled_at,
        event: 'Order Cancelled',
        status: 'cancelled',
        note: order.cancel_reason,
      });
    }

    return {
      order,
      summary: {
        itemCount,
        uniqueProducts,
        subtotal: parseFloat(order.subtotal_price),
        tax: parseFloat(order.total_tax),
        shipping: order.shipping_lines?.reduce((sum, line) => sum + parseFloat(line.price || '0'), 0) || 0,
        discount: parseFloat(order.total_discounts),
        total: parseFloat(order.total_price),
      },
      timeline: timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }

  public async getOrderDetails(orderId: string): Promise<OrderSummary> {
    try {
      const response = await shopifyApiService.getOrder(orderId);
      return this.createOrderSummary(response.order);
    } catch (error) {
      console.error('Error fetching order details:', error);
      throw error;
    }
  }

  public async updateOrderStatus(
    orderId: string,
    updates: {
      note?: string;
      tags?: string[];
      shippingAddress?: Partial<ShopifyOrder['shipping_address']>;
      customAttributes?: Array<{ key: string; value: string }>;
    }
  ): Promise<ShopifyOrder> {
    try {
      const updateData: any = {};

      if (updates.note !== undefined) {
        updateData.note = updates.note;
      }

      if (updates.tags) {
        updateData.tags = updates.tags.join(', ');
      }

      if (updates.shippingAddress) {
        updateData.shipping_address = updates.shippingAddress;
      }

      if (updates.customAttributes) {
        updateData.note_attributes = updates.customAttributes;
      }

      const response = await shopifyApiService.makeRequest<{ order: ShopifyOrder }>(
        `orders/${orderId}.json`,
        {
          method: 'PUT',
          body: JSON.stringify({ order: updateData }),
        }
      );

      return response.order;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }

  public async fulfillOrder(
    orderId: string,
    fulfillment: {
      trackingNumber?: string;
      trackingCompany?: string;
      notifyCustomer?: boolean;
      lineItems?: Array<{ id: string; quantity: number }>;
    }
  ): Promise<any> {
    try {
      const fulfillmentData: any = {
        notify_customer: fulfillment.notifyCustomer !== false,
      };

      if (fulfillment.trackingNumber) {
        fulfillmentData.tracking_number = fulfillment.trackingNumber;
      }

      if (fulfillment.trackingCompany) {
        fulfillmentData.tracking_company = fulfillment.trackingCompany;
      }

      if (fulfillment.lineItems) {
        fulfillmentData.line_items = fulfillment.lineItems;
      }

      const response = await shopifyApiService.makeRequest(
        `orders/${orderId}/fulfillments.json`,
        {
          method: 'POST',
          body: JSON.stringify({ fulfillment: fulfillmentData }),
        }
      );

      return response;
    } catch (error) {
      console.error('Error fulfilling order:', error);
      throw error;
    }
  }

  // Customers Management

  public async getCustomers(filter: CustomerFilter = {}): Promise<{
    customers: CustomerProfile[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const params: any = {
        limit: 50,
      };

      if (filter.dateRange) {
        params.created_at_min = filter.dateRange.start.toISOString();
        params.created_at_max = filter.dateRange.end.toISOString();
      }

      const response = await shopifyApiService.getCustomers(params);
      const countResponse = await shopifyApiService.getCustomerCount(params);

      // Create customer profiles
      const customerProfiles = await Promise.all(
        response.customers.map(customer => this.createCustomerProfile(customer))
      );

      // Apply additional filters
      let filteredCustomers = customerProfiles;

      if (filter.orderCount) {
        filteredCustomers = filteredCustomers.filter(profile => {
          const count = profile.stats.totalOrders;
          return (!filter.orderCount!.min || count >= filter.orderCount!.min) &&
                 (!filter.orderCount!.max || count <= filter.orderCount!.max);
        });
      }

      if (filter.totalSpent) {
        filteredCustomers = filteredCustomers.filter(profile => {
          const spent = profile.stats.totalSpent;
          return (!filter.totalSpent!.min || spent >= filter.totalSpent!.min) &&
                 (!filter.totalSpent!.max || spent <= filter.totalSpent!.max);
        });
      }

      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filteredCustomers = filteredCustomers.filter(profile => 
          profile.customer.email.toLowerCase().includes(searchLower) ||
          profile.customer.first_name?.toLowerCase().includes(searchLower) ||
          profile.customer.last_name?.toLowerCase().includes(searchLower) ||
          profile.customer.phone?.toLowerCase().includes(searchLower)
        );
      }

      if (filter.acceptsMarketing !== undefined) {
        filteredCustomers = filteredCustomers.filter(profile => 
          profile.customer.accepts_marketing === filter.acceptsMarketing
        );
      }

      return {
        customers: filteredCustomers,
        totalCount: countResponse.count,
        hasMore: response.customers.length === 50,
      };
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  }

  private async createCustomerProfile(customer: ShopifyCustomer): Promise<CustomerProfile> {
    // Calculate stats
    const totalOrders = customer.orders_count;
    const totalSpent = parseFloat(customer.total_spent);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    
    const firstOrderDate = customer.created_at;
    const lastOrderDate = customer.last_order_name ? new Date().toISOString() : undefined;
    const daysAsCustomer = Math.floor(
      (new Date().getTime() - new Date(firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine segments
    const segments = this.determineCustomerSegments(customer, {
      totalOrders,
      totalSpent,
      averageOrderValue,
      daysAsCustomer,
    });

    // Calculate lifetime value and predictions
    const lifetime = this.calculateCustomerLifetime(customer, {
      totalOrders,
      totalSpent,
      averageOrderValue,
      daysAsCustomer,
    });

    return {
      customer,
      stats: {
        totalOrders,
        totalSpent,
        averageOrderValue,
        lastOrderDate,
        firstOrderDate,
        daysAsCustomer,
        preferredProducts: [], // Would need order history to populate
      },
      segments,
      lifetime,
    };
  }

  private determineCustomerSegments(
    customer: ShopifyCustomer,
    stats: any
  ): string[] {
    const segments: string[] = [];

    // Value segments
    if (stats.totalSpent > 1000) {
      segments.push('VIP');
    } else if (stats.totalSpent > 500) {
      segments.push('High Value');
    } else if (stats.totalSpent > 100) {
      segments.push('Medium Value');
    } else {
      segments.push('Low Value');
    }

    // Frequency segments
    if (stats.totalOrders > 10) {
      segments.push('Frequent Buyer');
    } else if (stats.totalOrders > 3) {
      segments.push('Regular Buyer');
    } else if (stats.totalOrders === 1) {
      segments.push('First Time Buyer');
    }

    // Recency segments
    const daysSinceLastOrder = customer.last_order_name ? 
      Math.floor((new Date().getTime() - new Date(customer.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : 
      999;

    if (daysSinceLastOrder < 30) {
      segments.push('Recently Active');
    } else if (daysSinceLastOrder < 90) {
      segments.push('Active');
    } else if (daysSinceLastOrder < 180) {
      segments.push('At Risk');
    } else {
      segments.push('Dormant');
    }

    // Marketing segments
    if (customer.accepts_marketing) {
      segments.push('Marketing Subscribed');
    }

    return segments;
  }

  private calculateCustomerLifetime(
    customer: ShopifyCustomer,
    stats: any
  ): CustomerProfile['lifetime'] {
    // Simple CLV calculation
    const monthsAsCustomer = Math.max(1, stats.daysAsCustomer / 30);
    const ordersPerMonth = stats.totalOrders / monthsAsCustomer;
    const projectedMonths = 24; // 2 year projection
    
    const value = stats.totalSpent;
    const prediction = stats.averageOrderValue * ordersPerMonth * projectedMonths;

    // Churn risk based on recency and frequency
    let churnRisk: 'low' | 'medium' | 'high' = 'medium';
    
    if (stats.totalOrders > 5 && stats.daysAsCustomer < 180) {
      churnRisk = 'low';
    } else if (stats.totalOrders === 1 || stats.daysAsCustomer > 365) {
      churnRisk = 'high';
    }

    return {
      value,
      prediction,
      churnRisk,
    };
  }

  public async getCustomerDetails(customerId: string): Promise<CustomerProfile> {
    try {
      const response = await shopifyApiService.getCustomer(customerId);
      return this.createCustomerProfile(response.customer);
    } catch (error) {
      console.error('Error fetching customer details:', error);
      throw error;
    }
  }

  public async updateCustomer(
    customerId: string,
    updates: Partial<ShopifyCustomer>
  ): Promise<ShopifyCustomer> {
    try {
      const response = await shopifyApiService.makeRequest<{ customer: ShopifyCustomer }>(
        `customers/${customerId}.json`,
        {
          method: 'PUT',
          body: JSON.stringify({ customer: updates }),
        }
      );

      return response.customer;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  public async getCustomerOrders(
    customerId: string,
    params?: any
  ): Promise<ShopifyOrder[]> {
    try {
      const response = await shopifyApiService.getOrders({
        ...params,
        customer_id: customerId,
      });

      return response.orders;
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      throw error;
    }
  }

  // Bulk operations

  public async bulkUpdateOrderTags(
    updates: Array<{ orderId: string; tags: string[] }>
  ): Promise<BatchUpdateResult> {
    const result: BatchUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        await this.updateOrderStatus(update.orderId, { tags: update.tags });
        result.successful++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          id: update.orderId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  public async bulkUpdateCustomerTags(
    updates: Array<{ customerId: string; tags: string[] }>
  ): Promise<BatchUpdateResult> {
    const result: BatchUpdateResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        await this.updateCustomer(update.customerId, { 
          tags: update.tags.join(', ') 
        });
        result.successful++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          id: update.customerId,
          error: error.message || 'Unknown error',
        });
      }
    }

    return result;
  }

  // AI-powered insights

  public async generateOrderInsights(orderId: string): Promise<{
    insights: Array<{
      type: string;
      message: string;
      action?: string;
    }>;
  }> {
    try {
      const orderSummary = await this.getOrderDetails(orderId);
      
      const insights = await aiInsightService.analyzeOrder({
        orderValue: orderSummary.summary.total,
        itemCount: orderSummary.summary.itemCount,
        customer: orderSummary.order.customer,
        shippingAddress: orderSummary.order.shipping_address,
        financialStatus: orderSummary.order.financial_status,
        fulfillmentStatus: orderSummary.order.fulfillment_status,
      });

      return { insights: insights || [] };
    } catch (error) {
      console.error('Error generating order insights:', error);
      return { insights: [] };
    }
  }

  public async generateCustomerInsights(customerId: string): Promise<{
    insights: Array<{
      type: string;
      message: string;
      action?: string;
    }>;
    recommendations: Array<{
      productId: string;
      reason: string;
      confidence: number;
    }>;
  }> {
    try {
      const profile = await this.getCustomerDetails(customerId);
      
      const analysis = await aiInsightService.analyzeCustomer({
        totalSpent: profile.stats.totalSpent,
        orderCount: profile.stats.totalOrders,
        averageOrderValue: profile.stats.averageOrderValue,
        segments: profile.segments,
        churnRisk: profile.lifetime.churnRisk,
        daysAsCustomer: profile.stats.daysAsCustomer,
      });

      return {
        insights: analysis?.insights || [],
        recommendations: analysis?.recommendations || [],
      };
    } catch (error) {
      console.error('Error generating customer insights:', error);
      return { insights: [], recommendations: [] };
    }
  }

  // Export functionality

  public async exportOrders(
    filter: OrderFilter,
    format: 'csv' | 'excel'
  ): Promise<Blob> {
    const { orders } = await this.getOrders(filter);
    
    const exportData = orders.map(summary => ({
      'Order Number': summary.order.name,
      'Date': new Date(summary.order.created_at).toLocaleDateString(),
      'Customer': `${summary.order.customer?.first_name || ''} ${summary.order.customer?.last_name || ''}`.trim(),
      'Email': summary.order.email,
      'Total': summary.summary.total,
      'Items': summary.summary.itemCount,
      'Status': summary.order.financial_status,
      'Fulfillment': summary.order.fulfillment_status || 'Unfulfilled',
      'Tags': summary.order.tags,
    }));

    if (format === 'csv') {
      const csv = this.convertToCSV(exportData);
      return new Blob([csv], { type: 'text/csv' });
    } else {
      // Would use XLSX library
      const excel = JSON.stringify(exportData); // Placeholder
      return new Blob([excel], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
  }

  public async exportCustomers(
    filter: CustomerFilter,
    format: 'csv' | 'excel'
  ): Promise<Blob> {
    const { customers } = await this.getCustomers(filter);
    
    const exportData = customers.map(profile => ({
      'Name': `${profile.customer.first_name || ''} ${profile.customer.last_name || ''}`.trim(),
      'Email': profile.customer.email,
      'Phone': profile.customer.phone || '',
      'Total Orders': profile.stats.totalOrders,
      'Total Spent': profile.stats.totalSpent,
      'Average Order': profile.stats.averageOrderValue.toFixed(2),
      'Customer Since': new Date(profile.customer.created_at).toLocaleDateString(),
      'Segments': profile.segments.join(', '),
      'Accepts Marketing': profile.customer.accepts_marketing ? 'Yes' : 'No',
      'Tags': profile.customer.tags,
    }));

    if (format === 'csv') {
      const csv = this.convertToCSV(exportData);
      return new Blob([csv], { type: 'text/csv' });
    } else {
      // Would use XLSX library
      const excel = JSON.stringify(exportData); // Placeholder
      return new Blob([excel], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]?.toString() || '';
          return value.includes(',') ? `"${value}"` : value;
        }).join(',')
      ),
    ].join('\n');
    
    return csv;
  }
}

export const shopifyOrderCustomerService = new ShopifyOrderCustomerService();