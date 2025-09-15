import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { useLoader } from '../contexts/LoaderContext';
import { withLoader } from '../hoc/withLoader';
import MetricCard from './analytics/shared/MetricCard';
import { Package, DollarSign, BarChart3, Clock, RefreshCw, Pencil, Eye } from 'lucide-react';
import styles from './ViewOrders.module.css';

interface SalesOrder {
  id: string;
  legacy_order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_trading_name?: string;
  order_date: string;
  created_at: string;
  total: number;
  order_status: string;
  sales_id?: string;
  salesperson_name?: string;
  line_items?: LineItem[];
  line_items_count?: number;
  company_id: string;
  customers?: {
    display_name: string;
    trading_name: string;
  };
  [key: string]: any;
}

interface LocationState {
  customerId?: string;
  customerName?: string;
}

interface LineItem {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  brand_name?: string;
  quantity_shipped?: number;
}

interface OrderMetrics {
  totalOrders: number;
  totalValue: number;
  avgOrderValue: number;
  pendingOrders: number;
  shippedOrders: number;
  thisMonthOrders: number;
}

const PAGE_SIZE = 50;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const SEARCH_DEBOUNCE_MS = 500;

function ViewOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [orderMetrics, setOrderMetrics] = useState<OrderMetrics>({
    totalOrders: 0,
    totalValue: 0,
    avgOrderValue: 0,
    pendingOrders: 0,
    shippedOrders: 0,
    thisMonthOrders: 0
  });
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const location = useLocation();
  const locationState = location.state as LocationState;
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [customerFilterName, setCustomerFilterName] = useState<string>('');
  
  // Cache management
  const cacheRef = useRef<{
    data: SalesOrder[];
    timestamp: number;
    metrics: OrderMetrics;
    search: string;
    statusFilter: string;
    companyId: string;
  } | null>(null);
  
  // Track which orders have had their line items loaded
  const lineItemsLoadedRef = useRef<Set<string>>(new Set());
  
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();
  const [companyId, setCompanyId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [assignedCustomerIds, setAssignedCustomerIds] = useState<string[]>([]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  // Load user info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('company_id, role, id')
          .eq('auth_user_id', user.id)
          .single();

        if (userData?.company_id) {
          setCompanyId(userData.company_id);
          setUserRole(userData.role ? userData.role.toLowerCase() : '');
          setUserId(userData.id || '');
          
          // If user is sales role, get their assigned customers
          if (userData.role?.toLowerCase() === 'sales') {
            const { data: assignedCustomers } = await supabase
              .from('customers')
              .select('id')
              .eq('linked_sales_user', userData.id);
            
            const customerIds = assignedCustomers?.map(c => c.id) || [];
            setAssignedCustomerIds(customerIds);
            console.log(`Sales user assigned to ${customerIds.length} customers`);
          }
        }

        // Handle customer filter from navigation state
        if (locationState?.customerId) {
          setCustomerFilter(locationState.customerId);
          setCustomerFilterName(locationState.customerName || 'Selected Customer');
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };
    
    loadUserInfo();
  }, [locationState]);

  // Load metrics
  useEffect(() => {
    const loadMetrics = async () => {
      if (!companyId) return;

      try {
        // Build base query for company
        let baseQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId);
        
        // Apply sales user customer filtering if needed
        if (userRole === 'sales' && assignedCustomerIds.length > 0) {
          baseQuery = baseQuery.in('customer_id', assignedCustomerIds);
        } else if (userRole === 'sales' && assignedCustomerIds.length === 0) {
          // Sales user with no assigned customers should see no orders
          setOrderMetrics({
            totalOrders: 0,
            totalValue: 0,
            avgOrderValue: 0,
            pendingOrders: 0,
            shippedOrders: 0,
            thisMonthOrders: 0
          });
          return;
        }

        // Get total count
        let { count: totalCount } = await baseQuery;

        // Get pending orders
        let pendingQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('order_status', ['pending', 'confirmed', 'processing']);
          
        if (userRole === 'sales' && assignedCustomerIds.length > 0) {
          pendingQuery = pendingQuery.in('customer_id', assignedCustomerIds);
        }
        let { count: pendingCount } = await pendingQuery;

        // Get shipped orders
        let shippedQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('order_status', 'shipped');
          
        if (userRole === 'sales' && assignedCustomerIds.length > 0) {
          shippedQuery = shippedQuery.in('customer_id', assignedCustomerIds);
        }
        let { count: shippedCount } = await shippedQuery;

        // Get this month's orders
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        let thisMonthQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfMonth.toISOString());
          
        if (userRole === 'sales' && assignedCustomerIds.length > 0) {
          thisMonthQuery = thisMonthQuery.in('customer_id', assignedCustomerIds);
        }
        let { count: thisMonthCount } = await thisMonthQuery;

        // Calculate total value and average from loaded orders
        const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const avgOrderValue = orders.length > 0 ? totalValue / orders.length : 0;

        const metrics = {
          totalOrders: totalCount || 0,
          totalValue,
          avgOrderValue,
          pendingOrders: pendingCount || 0,
          shippedOrders: shippedCount || 0,
          thisMonthOrders: thisMonthCount || 0
        };

        setOrderMetrics(metrics);

        if (totalCount && totalCount > 0) {
          setTotalPages(Math.ceil(totalCount / PAGE_SIZE));
        }
      } catch (error) {
        console.error('Error loading metrics:', error);
      }
    };
    
    if (companyId && (userRole !== 'sales' || assignedCustomerIds.length >= 0)) {
      loadMetrics();
    }
  }, [companyId, orders, userRole, assignedCustomerIds]);

  // Load orders when search, filter, or page changes
  useEffect(() => {
    if (!companyId) {
      console.log('Waiting for company ID to load...');
      return;
    }
    
    // For sales users, wait until we have their assigned customers loaded
    if (userRole === 'sales' && assignedCustomerIds.length === 0) {
      console.log('Sales user - waiting for assigned customers to load...');
      return;
    }
    
    console.log('Fetching orders with:', { companyId, currentPage, customerFilter, userRole, assignedCustomerCount: assignedCustomerIds.length });
    
    // Check if we have a valid cache for page 1
    if (
      currentPage === 1 &&
      cacheRef.current && 
      Date.now() - cacheRef.current.timestamp < CACHE_DURATION &&
      cacheRef.current.search === debouncedSearch &&
      cacheRef.current.statusFilter === statusFilter &&
      cacheRef.current.companyId === companyId &&
      !customerFilter
    ) {
      console.log('Using cached data');
      setOrders(cacheRef.current.data);
      setOrderMetrics(cacheRef.current.metrics);
      setLoading(false);
      return;
    }
    
    // Reset for new search/filter
    if (currentPage === 1) {
      setOrders([]);
    }
    
    fetchOrders(currentPage === 1);
  }, [debouncedSearch, statusFilter, companyId, currentPage, customerFilter, userRole, assignedCustomerIds]);

  const fetchOrders = async (isInitialLoad = false) => {
    setLoading(true);
    
    try {
      setError(null);
      
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers (
            display_name,
            trading_name
          ),
          order_line_items (
            count
          )
        `)
        .eq('company_id', companyId);

      // Add customer filter
      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }
      
      // Add role-based filtering for sales users
      if (userRole === 'sales' && assignedCustomerIds.length > 0) {
        query = query.in('customer_id', assignedCustomerIds);
      } else if (userRole === 'sales' && assignedCustomerIds.length === 0) {
        // Sales user with no assigned customers should see no orders
        setOrders([]);
        setLoading(false);
        return;
      }

      // Add search constraints - using a simpler approach
      if (debouncedSearch) {
        setIsSearching(true);
        
        // First try to get all customers that match the search term
        const { data: matchingCustomers } = await supabase
          .from('customers')
          .select('id')
          .or(`display_name.ilike.%${debouncedSearch}%,trading_name.ilike.%${debouncedSearch}%`);
        
        const customerIds = matchingCustomers?.map(c => c.id) || [];
        
        // Now search orders by order number OR by customer IDs
        if (customerIds.length > 0) {
          query = query.or(`legacy_order_number.ilike.%${debouncedSearch}%,customer_id.in.(${customerIds.join(',')})`);
        } else {
          // If no customers match, just search by order number
          query = query.ilike('legacy_order_number', `%${debouncedSearch}%`);
        }
      }
      
      // Add status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          query = query.in('order_status', ['pending', 'confirmed', 'processing']);
        } else if (statusFilter === 'shipped') {
          query = query.eq('order_status', 'shipped');
        } else if (statusFilter === 'closed') {
          query = query.eq('order_status', 'delivered');
        }
      }
      
      // Add ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      console.log('Raw orders data from Supabase:', ordersData);
      console.log('First order customers data:', ordersData?.[0]?.customers);

      // If customer relationship didn't work, fetch customer data manually
      let enrichedOrdersData = ordersData;
      if (ordersData && ordersData.length > 0 && !ordersData[0].customers) {
        console.log('Customer relationship not working, fetching customer data manually...');
        
        // Get unique customer IDs
        const customerIdSet = new Set(ordersData.map(order => order.customer_id).filter(Boolean));
        const customerIds = Array.from(customerIdSet);
        
        if (customerIds.length > 0) {
          // Fetch customers in batch
          const { data: customersData, error: customersError } = await supabase
            .from('customers')
            .select('id, display_name, trading_name')
            .in('id', customerIds);
          
          if (!customersError && customersData) {
            // Create customer lookup map
            const customerMap = new Map(customersData.map(customer => [customer.id, customer]));
            
            // Enrich orders with customer data
            enrichedOrdersData = ordersData.map(order => ({
              ...order,
              customers: customerMap.get(order.customer_id) || null
            }));
            
            console.log('Enriched with manual customer data:', enrichedOrdersData[0]?.customers);
          }
        }
      }

      const newOrders: SalesOrder[] = (enrichedOrdersData || []).map(order => {
        console.log('Processing order:', order.id, 'customers:', order.customers);
        return {
          ...order,
          customer_name: order.customers?.display_name || 'Unknown Customer',
          customer_trading_name: order.customers?.trading_name,
          line_items: [],
          line_items_count: order.order_line_items?.[0]?.count || 0
        };
      });
      
      console.log(`Fetched ${newOrders.length} orders`);
      
      // Update state
      setOrders(newOrders);
      
      // Update pagination
      setHasMore(newOrders.length === PAGE_SIZE);
      
      // Update cache
      if (isInitialLoad) {
        cacheRef.current = {
          data: newOrders,
          timestamp: Date.now(),
          metrics: orderMetrics,
          search: debouncedSearch,
          statusFilter: statusFilter,
          companyId: companyId
        };
      }
      
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const clearCustomerFilter = () => {
    setCustomerFilter('');
    setCustomerFilterName('');
    window.history.replaceState({}, '', '/orders');
    
    setCurrentPage(1);
    setOrders([]);
    
    cacheRef.current = null;
    lineItemsLoadedRef.current.clear();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (newPage > totalPages && totalPages > 0)) return;
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Lazy load line items only when needed
  const loadLineItemsForOrder = useCallback(async (orderId: string) => {
    if (lineItemsLoadedRef.current.has(orderId)) {
      return;
    }
    
    try {
      const { data: lineItemsData, error } = await supabase
        .from('order_line_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) {
        console.error('Error loading line items:', error);
        return;
      }

      const lineItems: LineItem[] = lineItemsData || [];
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, line_items: lineItems, line_items_count: lineItems.length }
            : order
        )
      );
      
      lineItemsLoadedRef.current.add(orderId);
      
    } catch (err) {
      console.error(`Error loading line items for order ${orderId}:`, err);
    }
  }, []);

  const generateOrderChartData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.order_date || order.created_at);
        return orderDate.toDateString() === date.toDateString();
      });
      
      data.push({
        date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
        value: dayOrders.length,
        revenue: dayOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      });
    }
    return data;
  };

  const handleViewOrder = async (order: SalesOrder) => {
    await loadLineItemsForOrder(order.id);
    navigate(`/order/${order.id}`);
  };

  const handleEditOrder = (order: SalesOrder) => {
    navigate(`/order/${order.id}?edit=true`);
  };

  const handleCancelOrder = (order: SalesOrder) => {
    // TODO: Implement cancel order functionality
    console.log('Cancel order:', order.id);
  };

  const toggleOrderExpansion = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order && (!order.line_items || order.line_items.length === 0)) {
      await loadLineItemsForOrder(orderId);
    }
    
    setExpandedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getShippingStatus = (order: SalesOrder): 'shipped' | 'partial' | 'not_shipped' => {
    if (order.order_status === 'shipped') {
      return 'shipped';
    } else if (order.order_status === 'delivered') {
      return 'shipped';
    }
    return 'not_shipped';
  };

  const getItemsShipped = (order: SalesOrder): number => {
    if (!order.line_items || order.line_items.length === 0) return 0;
    return order.line_items.reduce((sum: number, item: LineItem) => sum + (item.quantity_shipped || 0), 0);
  };

  const getAwaitingShip = (order: SalesOrder): number => {
    if (!order.line_items || order.line_items.length === 0) {
      if (order.order_status === 'shipped' || order.order_status === 'delivered') return 0;
      return order.line_items_count || 0;
    }
    const totalItems = order.line_items.reduce((sum: number, item: LineItem) => sum + item.quantity, 0);
    const shippedItems = getItemsShipped(order);
    return totalItems - shippedItems;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString: string): string => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCustomerInitials = (name: string): string => {
    if (!name) return '??';
    const words = name.split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleRefresh = async () => {
    console.log('Refreshing orders list...');
    cacheRef.current = null;
    setOrders([]);
    setCurrentPage(1);
    setHasMore(true);
    lineItemsLoadedRef.current.clear();
    await fetchOrders(true);
  };

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Let the global ProgressLoader handle initial loading
  if (loading && orders.length === 0 && !error) {
    return null;
  }

  // Loading skeleton for smooth transitions
  const LoadingSkeleton = () => (
    <div className={styles.loadingSkeleton}>
      {[...Array(5)].map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ))}
    </div>
  );

  if (error && orders.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>⚠️</div>
        <h3>Error loading orders</h3>
        <p>{error}</p>
        <button onClick={handleRefresh} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.ordersContainer}>
      <div className={styles.ordersHeader}>
        <h1>Orders</h1>
        <div className={styles.headerActions}>
          {customerFilter && (
            <div className={styles.customerFilterIndicator}>
              <span>Showing orders for: <strong>{customerFilterName}</strong></span>
              <button 
                onClick={clearCustomerFilter}
                className={styles.clearFilterButton}
                title="Show all orders"
              >
                ✕
              </button>
            </div>
          )}
          <button onClick={handleRefresh} className={styles.refreshButton} title="Refresh orders">
            {<RefreshCw />}
          </button>
        </div>
      </div>
        
      {/* Metrics */}
      <div className={styles['metricsGrid-4']}>
        <MetricCard
          id="orders-this-month"
          title="Orders This Month"
          value={orderMetrics.thisMonthOrders}
          subtitle="Current month"
          icon={<Package />}
          color="#79d5e9"
          displayMode="compact"
          chartData={generateOrderChartData().map(d => ({ name: d.date, value: d.value }))}
        />
        
        <MetricCard
          id="total-value"
          title="Total Value"
          value={orderMetrics.totalValue}
          subtitle={`From ${orders.length} loaded orders`}
          icon={<DollarSign />}
          color="#4daeac"
          displayMode="compact"
          format="currency"
          chartData={generateOrderChartData().map(d => ({ name: d.date, value: d.revenue }))}
        />
        
        <MetricCard
          id="average-order"
          title="Average Order"
          value={orderMetrics.avgOrderValue}
          subtitle="Per transaction"
          icon={<BarChart3 />}
          color="#61bc8e"
          displayMode="compact"
          format="currency"
        />
        
        <MetricCard
          id="pending-orders"
          title="Pending Orders"
          value={orderMetrics.pendingOrders}
          subtitle="Awaiting fulfillment"
          icon={<Clock />}
          color="#fbbf24"
          displayMode="compact"
          onClick={() => setStatusFilter('pending')}
        />
      </div>

      {/* Search and Filter Controls */}
      <div className={styles.ordersControls}>
        <div className={styles.searchContainer}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by order #, customer, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {isSearching && <span className={styles.searchIndicator}>Searching...</span>}
        </div>
        
        <div className={styles.filterControls}>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusFilter}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Search info */}
      {debouncedSearch && (
        <div className={styles.searchInfo}>
          Showing results for "{debouncedSearch}" ({orders.length} found)
        </div>
      )}

      {/* Orders Table and Pagination */}
      <div className={styles.ordersWrapper}>
        <div className={styles.ordersTableContainer}>
          <div className={styles.ordersTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableRow}>
                <div className={styles.tableCell}>Order #</div>
                <div className={styles.tableCell}>Customer</div>
                <div className={styles.tableCell}>Date</div>
                <div className={styles.tableCell}>Total</div>
                <div className={styles.tableCell}></div>
              </div>
            </div>
            
            <div className={styles.tableBody}>
              {orders.length === 0 && !loading ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📦</div>
                  <h3>No orders found</h3>
                  <p>
                    {debouncedSearch || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filter criteria.'
                      : currentPage > 1 
                        ? 'No more orders to display.'
                        : 'No orders to display.'}
                  </p>
                </div>
              ) : orders.length > 0 ? (
                orders.map((order, index) => {
                  const isExpanded = expandedOrderIds.has(order.id);
                  const isCompleted = order.order_status?.toLowerCase() === 'delivered';
                  const shippingStatus = getShippingStatus(order);
                  
                  return (
                    <React.Fragment key={order.id}>
                      <div 
                        className={`${styles.tableRow} ${isExpanded ? styles.expanded : ''}`}
                        style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
                        onClick={() => toggleOrderExpansion(order.id)}
                      >
                        <div className={styles.tableCell} data-label="Order #">
                          <strong className={styles.orderNumber}>
                            {order.legacy_order_number || 'N/A'}
                          </strong>
                        </div>
                        
                        <div className={styles.tableCell} data-label="Customer">
                          <div className={styles.customerInfo}>
                            <div className={styles.customerAvatar}>
                              {getCustomerInitials(order.customer_name || 'Unknown')}
                            </div>
                            <div className={styles.customerDetails}>
                              <strong>{order.customer_name}</strong>
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.tableCell} data-label="Date">
                          <div className={styles.dateCell}>
                            <span className={styles.dateMain}>
                              {formatDate(order.order_date || order.created_at)}
                            </span>
                            <span className={styles.dateTime}>
                              {formatTime(order.order_date || order.created_at)}
                            </span>
                          </div>
                        </div>
                        
                        <div className={styles.tableCell} data-label="Total">
                          <strong className={styles.totalAmount}>
                            {formatCurrency(order.total || 0)}
                          </strong>
                        </div>
                        
                        <div className={styles.tableCell} data-label="">
                          <div className={styles.endRowSection}>
                            <button 
                              className={styles.expandButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOrderExpansion(order.id);
                              }}
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className={styles.expandedContent}>
                          <div className={styles.expandedRow}>
                            <div className={styles.statusIconContainer}>
                              {isCompleted ? (
                                <div className={`${styles.statusIcon} ${styles.completedIcon}`}>
                                  ✓
                                </div>
                              ) : (
                                <div className={`${styles.statusIcon} ${styles.pendingIcon}`}>
                                  ⏰
                                </div>
                              )}
                            </div>
                            
                            <div className={styles.expandedDetails}>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Status</span>
                                <span className={styles.detailValue}>{order.order_status}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Awaiting Ship</span>
                                <span className={styles.detailValue}>{getAwaitingShip(order)}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Items Shipped</span>
                                <span className={styles.detailValue}>{getItemsShipped(order)}</span>
                              </div>
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Total</span>
                                <span className={styles.detailValue}>{formatCurrency(order.total || 0)}</span>
                              </div>
                            </div>
                            
                            <div className={styles.statusBadges}>
                              <button 
                                className={`${styles.statusBadgeButton} ${styles[`shipping${shippingStatus.charAt(0).toUpperCase() + shippingStatus.slice(1).replace(/_/g, '')}`]}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {shippingStatus === 'shipped' ? 'Shipped' : 
                                 shippingStatus === 'partial' ? 'Partial Ship' : 
                                 'Not Shipped'}
                              </button>
                            </div>
                            
                            <div className={styles.expandedActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOrder(order);
                                }}
                                className={`${styles.expandedActionBtn} ${styles.editOrderBtn}`}
                                title="Edit Order"
                              >
                                <Pencil /> Edit Order
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewOrder(order);
                                }}
                                className={`${styles.expandedActionBtn} ${styles.viewOrderBtn}`}
                                title="View Order"
                              >
                                <Eye /> View Order
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelOrder(order);
                                }}
                                className={`${styles.expandedActionBtn} ${styles.cancelOrderBtn}`}
                                title="Cancel Order"
                              >
                                ✕ Cancel Order
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })
              ) : null}
            </div>
          </div>
          
          {loading && orders.length === 0 && (
            <LoadingSkeleton />
          )}
        </div>
        
        {/* Pagination Controls */}
        {(orders.length > 0 || (loading && currentPage === 1)) && (
          <div className={styles.paginationContainer}>
            <div className={styles.paginationInfo}>
              {loading ? (
                'Loading...'
              ) : (
                <>
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, ((currentPage - 1) * PAGE_SIZE) + orders.length)} 
                  {orderMetrics.totalOrders > 0 && ` of ${orderMetrics.totalOrders} orders`}
                </>
              )}
            </div>
            
            <div className={styles.paginationControls}>
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </button>
              
              <div className={styles.pageNumbers}>
                {currentPage > 2 && (
                  <>
                    <button
                      className={styles.pageNumber}
                      onClick={() => handlePageChange(1)}
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className={styles.pageDots}>...</span>}
                  </>
                )}
                
                {currentPage > 1 && (
                  <button
                    className={styles.pageNumber}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    {currentPage - 1}
                  </button>
                )}
                
                <button
                  className={`${styles.pageNumber} ${styles.active}`}
                  disabled
                >
                  {currentPage}
                </button>
                
                {hasMore && (
                  <button
                    className={styles.pageNumber}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    {currentPage + 1}
                  </button>
                )}
                
                {hasMore && totalPages > 0 && currentPage < totalPages - 1 && (
                  <>
                    {currentPage < totalPages - 2 && <span className={styles.pageDots}>...</span>}
                    <button
                      className={styles.pageNumber}
                      onClick={() => handlePageChange(totalPages)}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              <button
                className={styles.paginationButton}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMore || loading}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withLoader(ViewOrders);