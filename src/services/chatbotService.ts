import { supabase } from './supabaseService';

export interface ChatbotKnowledge {
  id?: number;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  company_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatConversation {
  id?: number;
  user_id: string;
  message: string;
  response: string;
  session_id: string;
  company_id: string;
  created_at?: string;
}

export const chatbotService = {
  // Knowledge base operations
  async getKnowledgeBase(companyId?: string): Promise<ChatbotKnowledge[]> {
    let query = supabase
      .from('chatbot_knowledge')
      .select('*')
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async searchKnowledge(query: string, companyId?: string): Promise<ChatbotKnowledge[]> {
    const keywords = query.toLowerCase().split(' ');
    
    let dbQuery = supabase
      .from('chatbot_knowledge')
      .select('*');

    if (companyId) {
      dbQuery = dbQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    // Filter results based on keywords
    const results = (data || []).filter(item => {
      const searchText = `${item.question} ${item.answer} ${item.keywords.join(' ')}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword));
    });

    return results.slice(0, 5); // Return top 5 matches
  },

  async addKnowledge(knowledge: Omit<ChatbotKnowledge, 'id' | 'created_at' | 'updated_at'>): Promise<ChatbotKnowledge> {
    const { data, error } = await supabase
      .from('chatbot_knowledge')
      .insert([knowledge])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Conversation logging
  async logConversation(conversation: Omit<ChatConversation, 'id' | 'created_at'>): Promise<ChatConversation> {
    const { data, error } = await supabase
      .from('chatbot_conversations')
      .insert([conversation])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Business data queries
  async getCustomerCount(companyId: string): Promise<number> {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('linked_company', companyId)
      .eq('is_active', true);

    if (error) throw error;
    return count || 0;
  },

  async getOrderCount(companyId: string): Promise<number> {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) throw error;
    return count || 0;
  },

  // Time-filtered data queries
  async getOrderCountThisWeek(companyId: string): Promise<number> {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', startOfWeek.toISOString());

    if (error) throw error;
    return count || 0;
  },

  async getOrderCountThisMonth(companyId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', startOfMonth.toISOString());

    if (error) throw error;
    return count || 0;
  },

  async getRecentOrdersThisWeek(companyId: string, limit: number = 5) {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers!inner(display_name, trading_name)
      `)
      .eq('company_id', companyId)
      .gte('created_at', startOfWeek.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data?.map(order => ({
      ...order,
      total_amount: order.total,
      status: order.order_status
    })) || [];
  },

  async getRecentOrdersThisMonth(companyId: string, limit: number = 5) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers!inner(display_name, trading_name)
      `)
      .eq('company_id', companyId)
      .gte('created_at', startOfMonth.toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data?.map(order => ({
      ...order,
      total_amount: order.total,
      status: order.order_status
    })) || [];
  },

  async getProductCount(companyId: string): Promise<number> {
    try {
      // Try the join approach first
      const { count, error } = await supabase
        .from('items')
        .select('*, brands!inner(*)', { count: 'exact', head: true })
        .eq('brands.company_id', companyId)
        .eq('status', 'active');

      if (error) {
        console.warn('Chatbot: Join query failed, trying alternative approach:', error);
        
        // Fallback: Get all brand IDs for the company first, then count items
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('id')
          .eq('company_id', companyId)
          .eq('is_active', true);
          
        if (brandError) throw brandError;
        
        const brandIds = brandData?.map(b => b.id) || [];
        if (brandIds.length === 0) return 0;
        
        const { count: itemCount, error: itemError } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .in('brand_id', brandIds)
          .eq('status', 'active');
          
        if (itemError) throw itemError;
        return itemCount || 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('Chatbot: Error in getProductCount:', error);
      throw error;
    }
  },

  async getRecentOrders(companyId: string, limit: number = 5) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers!inner(display_name, trading_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data?.map(order => ({
      ...order,
      total_amount: order.total,
      status: order.order_status
    })) || [];
  },

  async getTopProducts(companyId: string, limit: number = 5) {
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          name,
          net_stock_level,
          retail_price,
          brands!inner(brand_name, company_id)
        `)
        .eq('brands.company_id', companyId)
        .eq('status', 'active')
        .order('net_stock_level', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Chatbot: Join query for top products failed, trying alternative:', error);
        
        // Fallback: Get brands first, then items
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('id, brand_name')
          .eq('company_id', companyId)
          .eq('is_active', true);
          
        if (brandError) throw brandError;
        
        const brandIds = brandData?.map(b => b.id) || [];
        if (brandIds.length === 0) return [];
        
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('name, net_stock_level, retail_price, brand_id')
          .in('brand_id', brandIds)
          .eq('status', 'active')
          .order('net_stock_level', { ascending: false })
          .limit(limit);
          
        if (itemsError) throw itemsError;
        
        return itemsData?.map(item => ({
          product_name: item.name,
          stock_quantity: item.net_stock_level,
          unit_price: item.retail_price
        })) || [];
      }
      
      return data?.map(item => ({
        product_name: item.name,
        stock_quantity: item.net_stock_level,
        unit_price: item.retail_price
      })) || [];
    } catch (error) {
      console.error('Chatbot: Error in getTopProducts:', error);
      throw error;
    }
  },

  async getOrderByNumber(orderNumber: string, companyId: string) {
    try {
      // Clean up the order number - remove common prefixes and # symbols
      const cleanOrderNumber = orderNumber.replace(/^#/, '').replace(/^SO-/i, '').trim();
      
      console.log('Chatbot: Searching for order:', cleanOrderNumber, 'in company:', companyId);
      
      // First try exact match with cleaned number
      let { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers!inner(display_name, trading_name, email, phone),
          order_line_items(*)
        `)
        .eq('company_id', companyId)
        .or(`legacy_order_number.eq.${cleanOrderNumber},legacy_order_number.eq.SO-${cleanOrderNumber},id.eq.${cleanOrderNumber}`)
        .single();

      if (error && error.code === 'PGRST116') {
        // No results found, try with original order number
        console.log('Chatbot: No exact match found, trying with original:', orderNumber);
        
        const result = await supabase
          .from('orders')
          .select(`
            *,
            customers!inner(display_name, trading_name, email, phone),
            order_line_items(*)
          `)
          .eq('company_id', companyId)
          .or(`legacy_order_number.ilike.%${cleanOrderNumber}%`)
          .limit(1);
          
        data = result.data?.[0] || null;
        error = result.error;
      }

      if (error) {
        console.error('Chatbot: Error fetching order:', error);
        
        // Try without the join in case RLS is blocking
        const fallbackResult = await supabase
          .from('orders')
          .select('*')
          .eq('company_id', companyId)
          .or(`legacy_order_number.eq.${cleanOrderNumber},legacy_order_number.eq.SO-${cleanOrderNumber},id.eq.${cleanOrderNumber}`)
          .single();
          
        if (fallbackResult.error) {
          console.error('Chatbot: Fallback query also failed:', fallbackResult.error);
          throw fallbackResult.error;
        }
        
        // Get customer data separately
        if (fallbackResult.data?.customer_id) {
          const { data: customerData } = await supabase
            .from('customers')
            .select('display_name, trading_name, email, phone')
            .eq('id', fallbackResult.data.customer_id)
            .single();
            
          fallbackResult.data.customers = customerData;
        }
        
        // Get line items separately
        const { data: lineItems } = await supabase
          .from('order_line_items')
          .select('*')
          .eq('order_id', fallbackResult.data.id);
          
        fallbackResult.data.order_line_items = lineItems || [];
        
        data = fallbackResult.data;
      }

      if (!data) {
        console.log('Chatbot: No order found with number:', orderNumber);
        return null;
      }

      console.log('Chatbot: Order found:', data.legacy_order_number || data.id);
      
      return {
        ...data,
        total_amount: data?.total,
        status: data?.order_status,
        items: data?.order_line_items,
        customers: {
          ...data?.customers,
          company: data?.customers?.trading_name
        }
      };
    } catch (error) {
      console.error('Chatbot: Critical error in getOrderByNumber:', error);
      throw error;
    }
  },

  // Enquiry queries
  async getEnquiries(companyId: string, status?: string, limit: number = 10) {
    let query = supabase
      .from('enquiries')
      .select(`
        *,
        assigned_to:users!enquiries_assigned_to_fkey(first_name, last_name)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Invoice queries
  async getInvoices(companyId: string, status?: string, limit: number = 10) {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        customers!inner(display_name, company),
        orders!inner(order_date, order_status)
      `)
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('invoice_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getOverdueInvoices(companyId: string) {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customers!inner(display_name, company)
      `)
      .eq('company_id', companyId)
      .eq('invoice_status', 'overdue')
      .order('date_due', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Shipment queries
  async getShipments(companyId: string, status?: string, limit: number = 10) {
    let query = supabase
      .from('shipments')
      .select(`
        *,
        customers!inner(display_name, company),
        orders!inner(legacy_order_number, order_date),
        couriers(courier_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('shipment_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Brand performance
  async getBrandPerformance(companyId: string, brandId?: string) {
    let query = supabase
      .from('brand_trends_aggregated')
      .select(`
        *,
        brands!inner(brand_name)
      `)
      .eq('company_id', companyId)
      .eq('period_type', 'month')
      .order('period_date', { ascending: false })
      .limit(12);

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Inventory metrics
  async getInventoryMetrics(companyId: string) {
    const { data, error } = await supabase
      .from('inventory_metrics_aggregated')
      .select('*')
      .eq('company_id', companyId)
      .eq('period_type', 'month')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  },

  // Low stock items
  async getLowStockItems(companyId: string, limit: number = 10) {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        brands!inner(brand_name, company_id)
      `)
      .eq('brands.company_id', companyId)
      .eq('status', 'active')
      .lte('net_stock_level', 10) // Items with 10 or fewer in stock
      .order('net_stock_level', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Sales performance
  async getSalesPerformance(companyId: string, periodType: string = 'month') {
    const { data, error } = await supabase
      .from('sales_performance_aggregated')
      .select('*')
      .eq('company_id', companyId)
      .eq('period_type', periodType)
      .order('period_date', { ascending: false })
      .limit(12);

    if (error) throw error;
    return data || [];
  },

  // Customer analytics
  async getTopCustomers(companyId: string, limit: number = 5) {
    const { data, error } = await supabase
      .from('customer_analytics_aggregated')
      .select(`
        *,
        customers!inner(display_name, company)
      `)
      .eq('company_id', companyId)
      .eq('period_type', 'year')
      .order('total_spent', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Purchase orders
  async getPurchaseOrders(companyId: string, status?: string, limit: number = 10) {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        brands!inner(brand_name)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('order_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Backorders
  async getBackorders(companyId: string) {
    const { data, error } = await supabase
      .from('backorders')
      .select(`
        *,
        brands!inner(brand_name),
        purchase_orders!inner(legacy_purchase_order_id)
      `)
      .eq('company_id', companyId)
      .neq('backorder_status', 'fulfilled')
      .order('expected_arrival_date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Search customers
  async searchCustomers(companyId: string, searchTerm: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('linked_company', companyId)
      .eq('is_active', true)
      .or(`display_name.ilike.%${searchTerm}%,trading_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  },

  // Search products
  async searchProducts(companyId: string, searchTerm: string) {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        brands!inner(brand_name)
      `)
      .eq('brands.company_id', companyId)
      .eq('status', 'active')
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) throw error;
    return data || [];
  }
};