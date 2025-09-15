import OpenAI from 'openai';
import { chatbotService } from './chatbotService';

// Initialize OpenAI client
let openai: OpenAI | null = null;

const initializeOpenAI = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key not found. Using fallback responses.');
    return null;
  }
  
  if (!openai) {
    openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Note: In production, consider using a backend proxy
    });
  }
  return openai;
};

export interface BusinessContext {
  customerCount: number;
  orderCount: number;
  productCount: number;
  recentOrders: any[];
  topProducts: any[];
  companyId: string;
}

export const openaiService = {
  async generateResponse(
    userMessage: string, 
    businessContext: BusinessContext,
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
  ): Promise<string> {
    const client = initializeOpenAI();
    if (!client) {
      return this.getFallbackResponse(userMessage, businessContext);
    }

    try {
      const systemPrompt = this.createSystemPrompt(businessContext);
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory.slice(-6), // Keep last 6 messages for context
        { role: 'user' as const, content: userMessage }
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 300,
        temperature: 0.7,
        functions: this.getFunctionDefinitions(),
        function_call: 'auto'
      });

      const response = completion.choices[0];
      
      if (response.message.function_call) {
        return await this.handleFunctionCall(response.message.function_call, businessContext);
      }
      
      return response.message.content || this.getFallbackResponse(userMessage, businessContext);
      
    } catch (error) {
      console.error('OpenAI API error:', error);
      return this.getFallbackResponse(userMessage, businessContext);
    }
  },

  createSystemPrompt(context: BusinessContext): string {
    return `You are Splitfin Assistant, a helpful AI chatbot for the Splitfin business management platform. 

BUSINESS CONTEXT:
- Current customers: ${context?.customerCount || 0}
- Total orders: ${context?.orderCount || 0}  
- Products in inventory: ${context?.productCount || 0}
- Company ID: ${context?.companyId || 'unknown'}

NAVIGATION & WORKFLOW KNOWLEDGE:
- To create a NEW ORDER: Go to Orders section and click "New Order" or use the "+" button in the orders view
- To create a NEW ENQUIRY: Go to Dashboard and click "New Enquiry" 
- To create a NEW CUSTOMER: Go to Customers section and click "Create Customer"
- To add a NEW PRODUCT: Go to All Products section and click "Add Product"
- To view ANALYTICS: Click Analytics section in the sidebar for detailed insights
- To manage INVENTORY: Use All Products section or Inventory Management tools
- To view ORDERS: Go to Orders section to see all orders, or ViewOrders component

CAPABILITIES:
You help users with:
1. Business analytics and statistics
2. Product and inventory management
3. Customer relationship management
4. Order and enquiry handling
5. Navigation and feature explanations

GUIDELINES:
- Be helpful, concise, and professional
- Use the business data provided when relevant
- When users ask about orders, recent orders, or "show me orders", ALWAYS call the get_recent_orders function
- When users ask about a specific order number (like #SO-123456 or "order 123"), call the get_order_by_number function
- When users ask about products or top products, call the get_top_products function
- When users ask about stats, overview, or business performance, call the get_business_stats function
- For navigation questions, provide accurate step-by-step directions using the NAVIGATION & WORKFLOW KNOWLEDGE above
- Keep responses under 200 words
- Use bullet points for lists
- Include relevant metrics when discussing business performance

TONE: Friendly, professional, and knowledgeable about business operations.

IMPORTANT: Always use function calls to access real data when users ask about orders, products, or business statistics. When users mention a specific order number, always call get_order_by_number to look it up.`;
  },

  getFunctionDefinitions() {
    return [
      {
        name: 'get_business_stats',
        description: 'Get current business statistics and overview',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_recent_orders',
        description: 'Get recent orders for the business',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of orders to retrieve',
              default: 5
            }
          },
          required: []
        }
      },
      {
        name: 'get_top_products',
        description: 'Get top products by stock quantity',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of products to retrieve',
              default: 5
            }
          },
          required: []
        }
      },
      {
        name: 'search_knowledge_base',
        description: 'Search the knowledge base for specific information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for the knowledge base'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_order_by_number',
        description: 'Get specific order details by order number or ID',
        parameters: {
          type: 'object',
          properties: {
            orderNumber: {
              type: 'string',
              description: 'The order number or ID to look up'
            }
          },
          required: ['orderNumber']
        }
      },
      {
        name: 'get_enquiries',
        description: 'Get enquiries/leads with optional status filter',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by status: new, contacted, quoted, negotiating, won, lost, cancelled',
              enum: ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost', 'cancelled']
            },
            limit: {
              type: 'number',
              description: 'Number of enquiries to retrieve',
              default: 10
            }
          },
          required: []
        }
      },
      {
        name: 'get_invoices',
        description: 'Get invoices with optional status filter',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by status: draft, sent, overdue, paid',
              enum: ['draft', 'sent', 'overdue', 'paid']
            },
            limit: {
              type: 'number',
              description: 'Number of invoices to retrieve',
              default: 10
            }
          },
          required: []
        }
      },
      {
        name: 'get_overdue_invoices',
        description: 'Get all overdue invoices that need attention',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_shipments',
        description: 'Get shipment information with optional status filter',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by shipment status',
              enum: ['pending', 'packed', 'shipped', 'in_transit', 'delivered', 'failed', 'returned']
            },
            limit: {
              type: 'number',
              description: 'Number of shipments to retrieve',
              default: 10
            }
          },
          required: []
        }
      },
      {
        name: 'get_low_stock_items',
        description: 'Get products that are low on stock and need reordering',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of items to retrieve',
              default: 10
            }
          },
          required: []
        }
      },
      {
        name: 'get_sales_performance',
        description: 'Get sales performance metrics and trends',
        parameters: {
          type: 'object',
          properties: {
            periodType: {
              type: 'string',
              description: 'Period type for aggregation',
              enum: ['day', 'week', 'month', 'quarter', 'year'],
              default: 'month'
            }
          },
          required: []
        }
      },
      {
        name: 'get_top_customers',
        description: 'Get top customers by spend',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of customers to retrieve',
              default: 5
            }
          },
          required: []
        }
      },
      {
        name: 'get_backorders',
        description: 'Get pending backorders that need attention',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'search_customers',
        description: 'Search for customers by name, email, or other details',
        parameters: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to find customers'
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'search_products',
        description: 'Search for products by name, SKU, or description',
        parameters: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to find products'
            }
          },
          required: ['searchTerm']
        }
      }
    ];
  },

  async handleFunctionCall(functionCall: any, context: BusinessContext): Promise<string> {
    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args || '{}');

    try {
      switch (name) {
        case 'get_business_stats':
          return `📊 **Business Overview:**
• **${context?.customerCount || 0}** customers
• **${context?.orderCount || 0}** total orders
• **${context?.productCount || 0}** products in inventory

Your business is ${this.getBusinessHealthComment(context)}! ${this.getBusinessTip(context)}`;

        case 'get_recent_orders':
          if (!context?.recentOrders || context.recentOrders.length === 0) {
            return "You don't have any recent orders yet. To create your first order, go to Dashboard > New Enquiry or visit the Orders section.";
          }
          
          const ordersList = context.recentOrders.slice(0, parsedArgs.limit || 5)
            .map(order => `• **${order.customers?.display_name || 'Unknown'}**: $${order.total_amount} (${order.status})`)
            .join('\n');
          
          return `📋 **Recent Orders:**\n${ordersList}\n\nTo view more details, visit the Orders section in your dashboard.`;

        case 'get_top_products':
          if (!context?.topProducts || context.topProducts.length === 0) {
            return "You don't have any products in your inventory yet. Add products via All Products > Add Product to get started.";
          }
          
          const productsList = context.topProducts.slice(0, parsedArgs.limit || 5)
            .map(product => `• **${product.product_name}**: ${product.stock_quantity} units @ $${product.unit_price}`)
            .join('\n');
          
          return `📦 **Top Products by Stock:**\n${productsList}\n\nManage your inventory in the All Products section.`;

        case 'search_knowledge_base':
          const knowledge = await chatbotService.searchKnowledge(parsedArgs.query, context?.companyId);
          if (knowledge.length > 0) {
            return knowledge[0].answer;
          }
          return `I couldn't find specific information about "${parsedArgs.query}". Try asking about customers, products, orders, or analytics!`;

        case 'get_order_by_number':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to look up specific orders.";
            }
            
            console.log('OpenAI: Looking up order:', parsedArgs.orderNumber);
            const order = await chatbotService.getOrderByNumber(parsedArgs.orderNumber, context.companyId);
            
            if (!order) {
              return `I couldn't find order "${parsedArgs.orderNumber}". 

This could be because:
• The order number doesn't exist in your system
• The order belongs to a different company
• There might be a typo in the order number

Please verify the order number and try again. You can also view all orders in the Orders section of your dashboard.`;
            }
            
            const orderNumber = order.legacy_order_number || order.id;
            
            return `📋 **Order ${orderNumber} Details:**
• **Customer**: ${order.customers?.display_name || 'Unknown'}
• **Company**: ${order.customers?.company || 'N/A'}
• **Status**: ${order.status || 'Unknown'}
• **Total**: $${order.total_amount || '0.00'}
• **Date**: ${new Date(order.created_at).toLocaleDateString()}
• **Items**: ${order.items?.length || 0} products

${order.status === 'completed' ? '✅ This order has been completed.' : order.status === 'pending' ? '⏳ This order is pending.' : '📝 Order is in progress.'}

To view full details, go to Orders section in your dashboard.`;
          } catch (error) {
            console.error('Error fetching order:', error);
            return `I couldn't find order ${parsedArgs.orderNumber}. The order number might not exist or you may not have access to it.`;
          }

        case 'get_enquiries':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view enquiries.";
            }
            
            const enquiries = await chatbotService.getEnquiries(context.companyId, parsedArgs.status, parsedArgs.limit);
            
            if (!enquiries || enquiries.length === 0) {
              return parsedArgs.status 
                ? `You don't have any ${parsedArgs.status} enquiries at the moment.`
                : "You don't have any enquiries yet. Create one from the Dashboard to get started.";
            }
            
            const enquiriesList = enquiries.map(enq => 
              `• **${enq.enquiry_name || 'Unnamed'}** (${enq.status}): ${enq.assigned_to ? `Assigned to ${enq.assigned_to.first_name} ${enq.assigned_to.last_name}` : 'Unassigned'}`
            ).join('\n');
            
            return `📝 **${parsedArgs.status ? parsedArgs.status.charAt(0).toUpperCase() + parsedArgs.status.slice(1) : 'Recent'} Enquiries:**\n${enquiriesList}\n\nManage enquiries from the Enquiries section in your dashboard.`;
          } catch (error) {
            console.error('Error fetching enquiries:', error);
            return "I had trouble fetching your enquiries. Please try again later.";
          }

        case 'get_invoices':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view invoices.";
            }
            
            const invoices = await chatbotService.getInvoices(context.companyId, parsedArgs.status, parsedArgs.limit);
            
            if (!invoices || invoices.length === 0) {
              return parsedArgs.status 
                ? `You don't have any ${parsedArgs.status} invoices.`
                : "You don't have any invoices yet.";
            }
            
            const invoicesList = invoices.map(inv => 
              `• **${inv.invoice_number}** - ${inv.customers?.display_name || 'Unknown'}: $${inv.total_amount} (${inv.invoice_status})`
            ).join('\n');
            
            return `💳 **${parsedArgs.status ? parsedArgs.status.charAt(0).toUpperCase() + parsedArgs.status.slice(1) : 'Recent'} Invoices:**\n${invoicesList}\n\nView and manage invoices in the Invoices section.`;
          } catch (error) {
            console.error('Error fetching invoices:', error);
            return "I had trouble fetching your invoices. Please try again later.";
          }

        case 'get_overdue_invoices':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view overdue invoices.";
            }
            
            const overdueInvoices = await chatbotService.getOverdueInvoices(context.companyId);
            
            if (!overdueInvoices || overdueInvoices.length === 0) {
              return "✅ Great news! You don't have any overdue invoices.";
            }
            
            const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
            const invoicesList = overdueInvoices.slice(0, 5).map(inv => 
              `• **${inv.invoice_number}** - ${inv.customers?.display_name}: $${inv.total_amount} (Due: ${new Date(inv.date_due).toLocaleDateString()})`
            ).join('\n');
            
            return `⚠️ **Overdue Invoices Requiring Attention:**\n${invoicesList}${overdueInvoices.length > 5 ? `\n\n...and ${overdueInvoices.length - 5} more` : ''}\n\n**Total Overdue**: $${totalOverdue.toFixed(2)}\n\nConsider following up with these customers.`;
          } catch (error) {
            console.error('Error fetching overdue invoices:', error);
            return "I had trouble fetching overdue invoices. Please try again later.";
          }

        case 'get_shipments':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view shipments.";
            }
            
            const shipments = await chatbotService.getShipments(context.companyId, parsedArgs.status, parsedArgs.limit);
            
            if (!shipments || shipments.length === 0) {
              return parsedArgs.status 
                ? `You don't have any ${parsedArgs.status} shipments.`
                : "You don't have any shipments recorded yet.";
            }
            
            const shipmentsList = shipments.map(ship => 
              `• **${ship.tracking_number || 'No tracking'}** - ${ship.customers?.display_name}: ${ship.shipment_status} (${ship.couriers?.courier_name || 'No courier'})`
            ).join('\n');
            
            return `📦 **${parsedArgs.status ? parsedArgs.status.charAt(0).toUpperCase() + parsedArgs.status.slice(1) : 'Recent'} Shipments:**\n${shipmentsList}\n\nTrack and manage shipments in the Shipments section.`;
          } catch (error) {
            console.error('Error fetching shipments:', error);
            return "I had trouble fetching your shipments. Please try again later.";
          }

        case 'get_low_stock_items':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view inventory.";
            }
            
            const lowStockItems = await chatbotService.getLowStockItems(context.companyId, parsedArgs.limit);
            
            if (!lowStockItems || lowStockItems.length === 0) {
              return "✅ All your inventory items are well stocked!";
            }
            
            const itemsList = lowStockItems.map(item => 
              `• **${item.name}** (${item.brands?.brand_name}): ${item.net_stock_level} units (Reorder at: ${item.reorder_level})`
            ).join('\n');
            
            return `⚠️ **Low Stock Items Needing Reorder:**\n${itemsList}\n\nConsider creating purchase orders for these items.`;
          } catch (error) {
            console.error('Error fetching low stock items:', error);
            return "I had trouble fetching low stock items. Please try again later.";
          }

        case 'get_sales_performance':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view sales data.";
            }
            
            const salesData = await chatbotService.getSalesPerformance(context.companyId, parsedArgs.periodType);
            
            if (!salesData || salesData.length === 0) {
              return "No sales data available for the selected period.";
            }
            
            const latestPeriod = salesData[0];
            const previousPeriod = salesData[1];
            
            let growthRate = 0;
            if (previousPeriod && previousPeriod.total_sales > 0) {
              growthRate = (latestPeriod.total_sales - previousPeriod.total_sales) / previousPeriod.total_sales * 100;
            }
            
            return `📈 **Sales Performance (${parsedArgs.periodType || 'monthly'}):**\n• **Latest Period**: $${latestPeriod.total_sales.toFixed(2)} (${latestPeriod.orders_count} orders)\n• **Average Order Value**: $${latestPeriod.average_order_value.toFixed(2)}\n• **Growth**: ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}% vs previous period\n\nView detailed analytics in the Analytics section.`;
          } catch (error) {
            console.error('Error fetching sales performance:', error);
            return "I had trouble fetching sales performance data. Please try again later.";
          }

        case 'get_top_customers':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view customer data.";
            }
            
            const topCustomers = await chatbotService.getTopCustomers(context.companyId, parsedArgs.limit);
            
            if (!topCustomers || topCustomers.length === 0) {
              return "No customer analytics data available yet.";
            }
            
            const customersList = topCustomers.map((cust, idx) => 
              `${idx + 1}. **${cust.customers?.display_name || 'Unknown'}**: $${cust.total_spent.toFixed(2)} (${cust.order_count} orders)`
            ).join('\n');
            
            return `🏆 **Top Customers by Revenue:**\n${customersList}\n\nNurture these valuable relationships!`;
          } catch (error) {
            console.error('Error fetching top customers:', error);
            return "I had trouble fetching top customers data. Please try again later.";
          }

        case 'get_backorders':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to view backorders.";
            }
            
            const backorders = await chatbotService.getBackorders(context.companyId);
            
            if (!backorders || backorders.length === 0) {
              return "✅ You don't have any pending backorders.";
            }
            
            const backordersList = backorders.map(bo => 
              `• **${bo.brands?.brand_name}** - PO #${bo.purchase_orders?.legacy_purchase_order_id}: Expected ${new Date(bo.expected_arrival_date).toLocaleDateString()}`
            ).join('\n');
            
            return `📋 **Pending Backorders:**\n${backordersList}\n\nTrack these in the Purchase Orders section.`;
          } catch (error) {
            console.error('Error fetching backorders:', error);
            return "I had trouble fetching backorders. Please try again later.";
          }

        case 'search_customers':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to search customers.";
            }
            
            const customers = await chatbotService.searchCustomers(context.companyId, parsedArgs.searchTerm);
            
            if (!customers || customers.length === 0) {
              return `No customers found matching "${parsedArgs.searchTerm}". Try a different search term.`;
            }
            
            const customersList = customers.map(cust => 
              `• **${cust.display_name}** - ${cust.trading_name || cust.company || 'N/A'} (${cust.email})`
            ).join('\n');
            
            return `🔍 **Customer Search Results for "${parsedArgs.searchTerm}":**\n${customersList}\n\nClick on a customer in the Customers section to view full details.`;
          } catch (error) {
            console.error('Error searching customers:', error);
            return "I had trouble searching for customers. Please try again later.";
          }

        case 'search_products':
          try {
            if (!context?.companyId) {
              return "I need to verify your company access to search products.";
            }
            
            const products = await chatbotService.searchProducts(context.companyId, parsedArgs.searchTerm);
            
            if (!products || products.length === 0) {
              return `No products found matching "${parsedArgs.searchTerm}". Try a different search term.`;
            }
            
            const productsList = products.map(prod => 
              `• **${prod.name}** (${prod.sku}) - ${prod.brands?.brand_name}: ${prod.net_stock_level} units @ $${prod.unit_price}`
            ).join('\n');
            
            return `🔍 **Product Search Results for "${parsedArgs.searchTerm}":**\n${productsList}\n\nManage products in the All Products section.`;
          } catch (error) {
            console.error('Error searching products:', error);
            return "I had trouble searching for products. Please try again later.";
          }

        default:
          return this.getFallbackResponse('function call', context);
      }
    } catch (error) {
      console.error('Function call error:', error);
      return "I had trouble accessing that information. Please try again or ask about something else.";
    }
  },

  getBusinessHealthComment(context: BusinessContext): string {
    const totalActivity = (context?.customerCount || 0) + (context?.orderCount || 0) + (context?.productCount || 0);
    if (totalActivity > 100) return "performing excellently";
    if (totalActivity > 50) return "doing well";
    if (totalActivity > 10) return "off to a good start";
    return "just getting started";
  },

  getBusinessTip(context: BusinessContext): string {
    const customerCount = context?.customerCount || 0;
    const productCount = context?.productCount || 0;
    const orderCount = context?.orderCount || 0;
    
    if (customerCount < 5) {
      return "Consider adding more customers to grow your business.";
    }
    if (productCount < 10) {
      return "Expanding your product catalog could increase sales.";
    }
    if (orderCount < customerCount) {
      return "Focus on converting customers into orders.";
    }
    return "Keep up the great work!";
  },

  getFallbackResponse(userMessage: string, context: BusinessContext): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('stats') || lowerMessage.includes('overview') || lowerMessage.includes('summary')) {
      return `📊 **Business Overview:**
• **${context?.customerCount || 0}** customers
• **${context?.orderCount || 0}** total orders  
• **${context?.productCount || 0}** products

${this.getBusinessTip(context)}`;
    }
    
    if (lowerMessage.includes('order')) {
      return "For orders: Create new enquiries from the Dashboard, view existing orders in the Orders section, or track order status and details.";
    }
    
    if (lowerMessage.includes('customer')) {
      return "For customers: Add new customers via Create Customer, view customer details and history, or track enquiries and communications.";
    }
    
    if (lowerMessage.includes('product') || lowerMessage.includes('inventory')) {
      return "For products: Use All Products to view inventory, upload products via inventory management, or use image management for product photos.";
    }
    
    return "I can help you with business statistics, products, customers, orders, and navigation. What would you like to know?";
  },

  async isOpenAIAvailable(): Promise<boolean> {
    const client = initializeOpenAI();
    return client !== null;
  }
};