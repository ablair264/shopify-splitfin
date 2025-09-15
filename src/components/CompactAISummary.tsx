import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabaseService';
import { openaiService } from '../services/openaiService';
import { RefreshCw, Brain, AlertCircle, CheckCircle, X, ExternalLink } from 'lucide-react';
import './CompactAISummary.css';

interface CompactAISummaryProps {
  companyId: string;
}

interface SummaryData {
  content: string;
  timestamp: Date;
  refreshCount: number;
}

const CompactAISummary: React.FC<CompactAISummaryProps> = ({ companyId }) => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailedSummary, setDetailedSummary] = useState<string | null>(null);
  const [detailedLoading, setDetailedLoading] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxRefreshes = 5;
  const refreshInterval = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Load today's business context for AI
  const loadTodaysBusinessContext = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's specific data
      const [
        todayOrders,
        todayRevenue,
        todayCustomers,
        recentOrdersToday,
        lowStockItems,
        pendingOrders
      ] = await Promise.all([
        // Today's orders count
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
        
        // Today's revenue
        supabase
          .from('orders')
          .select('total')
          .eq('company_id', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
        
        // New customers today
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('linked_company', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
        
        // Recent orders from today
        supabase
          .from('orders')
          .select(`
            id,
            legacy_order_number,
            total,
            order_status,
            created_at,
            customers (display_name, trading_name)
          `)
          .eq('company_id', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString())
          .order('created_at', { ascending: false })
          .limit(5),
        
        // Low stock items (no company_id filter as items table doesn't have it)
        supabase
          .from('items')
          .select('name, sku, net_stock_level, reorder_level')
          .lt('net_stock_level', 10)
          .order('net_stock_level', { ascending: true })
          .limit(5),
        
        // Pending orders
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_status', 'pending')
      ]);

      const todayRevenueTotal = todayRevenue.data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const todayOrdersCount = todayOrders.count || 0;
      const todayCustomersCount = todayCustomers.count || 0;
      const pendingOrdersCount = pendingOrders.count || 0;

      // Get total customers and orders (not just today's)
      const [totalCustomers, totalOrders, totalProducts] = await Promise.all([
        // Total customers
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('linked_company', companyId),
        
        // Total orders
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId),
          
        // Total products (items table doesn't have company_id, so we get all items)
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
      ]);

      return {
        customerCount: totalCustomers.count || 0,
        orderCount: totalOrders.count || 0,
        productCount: totalProducts.count || 0,
        recentOrders: recentOrdersToday.data || [],
        topProducts: lowStockItems.data || [],
        companyId,
        // Additional today-specific data
        todayOrders: todayOrdersCount,
        todayRevenue: todayRevenueTotal,
        todayCustomers: todayCustomersCount,
        recentOrdersToday: recentOrdersToday.data || [],
        lowStockItems: lowStockItems.data || [],
        pendingOrders: pendingOrdersCount
      };
    } catch (error) {
      console.error('Error loading today\'s business context:', error);
      throw error;
    }
  };

  // Generate AI summary
  const generateSummary = async () => {
    if (refreshCount >= maxRefreshes) {
      console.log('Maximum refresh count reached, stopping auto-refresh');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const todaysContext = await loadTodaysBusinessContext();
      
      // Get today's date range for enquiries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get enquiries data for compact summary
      const todayEnquiries = await supabase
        .from('enquiries')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      const todayEnquiriesCount = todayEnquiries.count || 0;

      // Get today's shipments and paid invoices (more realistic than deliveries)
      const [todayShipments, todayPaidInvoices] = await Promise.all([
        supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('shipment_status', ['shipped', 'in_transit'])
          .gte('date_shipped', today.toISOString())
          .lt('date_shipped', tomorrow.toISOString()),
        supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('invoice_status', 'paid')
          .gte('updated_at', today.toISOString())
          .lt('updated_at', tomorrow.toISOString())
      ]);

      const todayShipmentsCount = todayShipments.count || 0;
      const todayPaidInvoicesCount = todayPaidInvoices.count || 0;

      // Create a conversational summary prompt
      const summaryPrompt = `Write a brief, conversational business summary as if you're giving a colleague a quick daily update. Use natural language, no formatting, no asterisks, no bullet points.

Business Overview:
- ${todaysContext.customerCount} customers total
- ${todaysContext.orderCount} total orders 
- ${todaysContext.productCount} products in inventory

Today's performance:
- Orders: ${todaysContext.todayOrders} totaling £${todaysContext.todayRevenue.toFixed(2)}
- Shipments sent: ${todayShipmentsCount}
- Invoices paid: ${todayPaidInvoicesCount}
- New enquiries: ${todayEnquiriesCount}
- Pending orders: ${todaysContext.pendingOrders}

Write 2-3 sentences that sound like a human colleague telling you about the day. Focus on what's most important and mention any quick action that could help. Keep it conversational and natural - no special formatting.`;

      const aiResponse = await openaiService.generateResponse(
        summaryPrompt,
        todaysContext,
        []
      );

      const newSummary: SummaryData = {
        content: aiResponse,
        timestamp: new Date(),
        refreshCount: refreshCount + 1
      };

      setSummary(newSummary);
      setRefreshCount(prev => prev + 1);
      
      console.log(`Compact AI summary generated (refresh ${refreshCount + 1}/${maxRefreshes})`);
    } catch (error) {
      console.error('Error generating summary:', error);
      setError('Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  // Generate detailed summary for modal
  const generateDetailedSummary = async () => {
    setDetailedLoading(true);
    try {
      const todaysContext = await loadTodaysBusinessContext();
      
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Get this week's data for comparison
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const [weekOrders, weekRevenue, weekCustomers] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', weekStart.toISOString()),
        supabase
          .from('orders')
          .select('total')
          .eq('company_id', companyId)
          .gte('created_at', weekStart.toISOString()),
        supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('linked_company', companyId)
          .gte('created_at', weekStart.toISOString())
      ]);

      const weekRevenueTotal = weekRevenue.data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const weekOrdersCount = weekOrders.count || 0;
      const weekCustomersCount = weekCustomers.count || 0;

      // Get enquiries data for better context
      const [todayEnquiries, weekEnquiries] = await Promise.all([
        supabase
          .from('enquiries')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString()),
        supabase
          .from('enquiries')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', weekStart.toISOString())
      ]);

      const todayEnquiriesCount = todayEnquiries.count || 0;
      const weekEnquiriesCount = weekEnquiries.count || 0;

      const detailedPrompt = `Generate a comprehensive business intelligence report for TODAY and THIS WEEK. Use this data:

TODAY'S PERFORMANCE:
- Orders: ${todaysContext.todayOrders} (Revenue: £${todaysContext.todayRevenue.toFixed(2)})
- Enquiries: ${todayEnquiriesCount}
- New customers: ${todaysContext.todayCustomers}
- Pending orders: ${todaysContext.pendingOrders}
- Low stock items: ${todaysContext.lowStockItems.length}

THIS WEEK'S PERFORMANCE:
- Orders: ${weekOrdersCount} (Revenue: £${weekRevenueTotal.toFixed(2)})
- Enquiries: ${weekEnquiriesCount}
- New customers: ${weekCustomersCount}

RECENT ORDERS TODAY:
${todaysContext.recentOrdersToday.length > 0 ? 
  todaysContext.recentOrdersToday.map(order => {
    const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const customerName = customer?.display_name || customer?.trading_name || 'Unknown Customer';
    const orderTotal = order.total ? `£${order.total}` : '£0.00';
    const orderRef = order.legacy_order_number || `#${order.id.slice(0, 8)}`;
    return `- ${customerName}: ${orderTotal} (${orderRef})`;
  }).join('\n') :
  'No orders placed today yet'
}

LOW STOCK ALERTS:
${todaysContext.lowStockItems.length > 0 ? 
  todaysContext.lowStockItems.map(item => `- ${item.name}: ${item.net_stock_level} units left`).join('\n') :
  'All inventory levels are healthy'
}

BUSINESS CONTEXT:
- Enquiries are initial customer inquiries that may convert to orders
- Orders are confirmed purchases with revenue
- Focus on both enquiry-to-order conversion and direct order generation

Provide detailed analysis including:
1. Performance trends and comparisons (orders vs enquiries)
2. Key insights and patterns in customer behavior
3. Actionable recommendations for today and this week
4. Risk assessments (low stock, pending orders)
5. Opportunities for growth (enquiry conversion, new customers)
6. Operational efficiency metrics
7. Customer behavior insights
8. Inventory optimization suggestions
9. Sales pipeline health (enquiries → orders conversion)

Format as a professional business report with clear sections and actionable insights. If there are no recent orders, focus on enquiry activity, customer engagement, and growth opportunities.`;

      const aiResponse = await openaiService.generateResponse(
        detailedPrompt,
        todaysContext,
        []
      );

      setDetailedSummary(aiResponse);
    } catch (error) {
      console.error('Error generating detailed summary:', error);
    } finally {
      setDetailedLoading(false);
    }
  };

  // Modal handlers
  const handleOpenModal = () => {
    setIsModalOpen(true);
    if (!detailedSummary) {
      generateDetailedSummary();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Manual refresh
  const handleManualRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshCount < maxRefreshes) {
      generateSummary();
    }
  };

  // Initialize and set up auto-refresh
  useEffect(() => {
    generateSummary();

    // Set up auto-refresh interval
    intervalRef.current = setInterval(() => {
      if (refreshCount < maxRefreshes && isVisible) {
        generateSummary();
      }
    }, refreshInterval);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [companyId, isVisible]);

  // Stop auto-refresh when max refreshes reached
  useEffect(() => {
    if (refreshCount >= maxRefreshes && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [refreshCount]);

  // Pause auto-refresh when component is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const canRefresh = refreshCount < maxRefreshes;

  return (
    <>
      <div className="compact-ai-summary" onClick={handleOpenModal}>
        <div className="ai-icon">
          <Brain size={14} />
        </div>
        <div className="ai-content">
          {loading && !summary && (
            <div className="ai-loading">
              <RefreshCw size={12} className="spinning" />
              <span>Generating insights...</span>
            </div>
          )}

          {error && (
            <div className="ai-error">
              <AlertCircle size={12} />
              <span>AI unavailable</span>
            </div>
          )}

          {summary && !loading && !error && (
            <div className="ai-text">
              {summary.content}
            </div>
          )}

          {!summary && !loading && !error && (
            <div className="ai-empty">
              <CheckCircle size={12} />
              <span>No insights available</span>
            </div>
          )}
        </div>
        <div className="ai-controls">
          <button 
            className={`ai-refresh ${!canRefresh ? 'disabled' : ''}`}
            onClick={handleManualRefresh}
            disabled={!canRefresh || loading}
            title={canRefresh ? 'Refresh insights' : 'Max refreshes reached'}
          >
            <RefreshCw size={10} className={loading ? 'spinning' : ''} />
          </button>
          <button 
            className="ai-expand"
            onClick={handleOpenModal}
            title="View detailed insights"
          >
            <ExternalLink size={10} />
          </button>
        </div>
      </div>

      {/* Modal - Rendered via Portal */}
      {isModalOpen && createPortal(
        <div className="summary-modal-overlay" onClick={handleCloseModal}>
          <div className="summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detailed AI Insights</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              {detailedLoading ? (
                <div className="modal-loading">
                  <RefreshCw size={24} className="spinning" />
                  <p>Generating detailed insights...</p>
                </div>
              ) : detailedSummary ? (
                <div className="detailed-summary">
                  {detailedSummary.split('\n').map((line, index) => {
                    if (line.trim() === '') return <br key={index} />;
                    
                    // Handle bullet points
                    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                      return (
                        <div key={index} className="detailed-bullet">
                          {line.trim()}
                        </div>
                      );
                    }
                    
                    // Handle headers (lines with **text**)
                    if (line.includes('**') && line.trim().length < 100) {
                      const cleanLine = line.replace(/\*\*/g, '');
                      return (
                        <div key={index} className="detailed-header">
                          {cleanLine}
                        </div>
                      );
                    }
                    
                    // Regular text
                    return (
                      <div key={index} className="detailed-paragraph">
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="modal-error">
                  <AlertCircle size={24} />
                  <p>Failed to load detailed insights</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default CompactAISummary;
