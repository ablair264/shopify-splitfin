import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ShoppingCart, User, Eye, Grid3x3, List, Users, UserPlus, UserCheck, DollarSign, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import MetricCard from './analytics/shared/MetricCard';
import { ColorProvider } from './analytics/shared/ColorProvider';
import { useComponentLoader } from '../hoc/withLoader';
import styles from './CustomersManagement.module.css';

// Types based on Supabase schema
interface Customer {
  id: string;
  fb_customer_id?: string;
  display_name: string;
  trading_name: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  billing_address_1: string;
  billing_address_2?: string;
  billing_city_town: string;
  billing_county?: string;
  billing_postcode: string;
  shipping_address_1: string;
  shipping_address_2?: string;
  shipping_city_town: string;
  shipping_county?: string;
  shipping_postcode: string;
  coordinates?: any;
  created_by: string;
  linked_sales_user?: string;
  linked_company: string;
  items_available?: any;
  total_spent: number;
  total_paid: number;
  average_order_value: number;
  order_count: number;
  invoice_count: number;
  outstanding_receivable_amount: number;
  unused_credits_receivable_amount: number;
  payment_performance: number;
  customer_lifetime_days: number;
  first_order_date?: string;
  last_order_date?: string;
  segment?: string;
  payment_terms: number;
  currency_code: string;
  zoho_customer_id?: string;
  migration_source: string;
  is_active: boolean;
  created_date: string;
  last_modified: string;
  // Joined data from customer_users table
  customer_users?: CustomerUser[];
}

interface CustomerUser {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  linked_customer: string;
  primary_contact: boolean;
  contact_type: string;
  custom_contact_type?: string;
  is_active: boolean;
  master_user: boolean;
  location_type: string;
  custom_location?: any;
  notes?: string;
  marketing: boolean;
  is_online: boolean;
  last_login?: string;
  created_date: string;
  last_modified: string;
}

interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  totalSpent: number;
  averageOrderValue: number;
  outstandingReceivables: number;
}

type SortBy = 'name' | 'date' | 'value' | 'orders';
type ViewMode = 'list' | 'grid';

function CustomersManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataProcessing, setDataProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics>({
    totalCustomers: 0,
    newCustomers: 0,
    activeCustomers: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    outstandingReceivables: 0
  });

  const customersPerPage = 25;
  const navigate = useNavigate();
  const { showLoader, hideLoader, setProgress } = useComponentLoader();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setDataProcessing(true);
      showLoader('Fetching Customer Data...');
      setProgress(10);
      
      // Get current user's company context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      // Get user's company information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id, role, permissions')
        .eq('auth_user_id', user.id)
        .single();

      console.log('User data:', userData);

      if (userError) {
        console.error('Error fetching user data:', userError);
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      if (!userData?.company_id) {
        console.error('No company found for user');
        setCustomers([]);
        calculateMetrics([]);
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      setProgress(20);

      // Fetch ALL customers using pagination to overcome 1000 row limit
      let allCustomers: Customer[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('customers')
          .select('*')
          .eq('linked_company', userData.company_id)
          .eq('is_active', true)
          .order('display_name', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error(`Error fetching customers batch at offset ${offset}:`, batchError);
          throw batchError;
        }

        if (batchData && batchData.length > 0) {
          allCustomers = [...allCustomers, ...batchData];
          offset += batchSize;
          hasMore = batchData.length === batchSize; // If we got less than batchSize, we're done
          console.log(`Fetched batch: ${batchData.length} customers (total so far: ${allCustomers.length})`);
          
          // Update progress based on batches loaded
          const progressPercent = Math.min(20 + (Math.floor(allCustomers.length / 1000) * 30), 80);
          setProgress(progressPercent);
        } else {
          hasMore = false;
        }
      }

      const customersData = allCustomers;

      console.log('Fetched customers from Supabase:', customersData?.length || 0);
      if (customersData && customersData.length >= 1000) {
        console.warn('⚠️ Fetched exactly 1000 customers - there might be more that were limited!');
      }
      if (customersData && customersData.length > 0) {
        console.log('Sample customer data:', customersData[0]);
      }
      
      let enhancedCustomers = customersData || [];
      
      setProgress(90);
      
      // Process customers data
      setCustomers(enhancedCustomers);
      calculateMetrics(enhancedCustomers);
      
      setProgress(100);
      
      // Wait a moment to ensure all state updates and DOM updates are complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (err) {
      console.error('Error in fetchCustomers:', err);
    } finally {
      setDataProcessing(false);
      setLoading(false);
      hideLoader();
    }
  };

  const calculateMetrics = (customersData: Customer[]) => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    
    const totalCustomers = customersData.length;
    
    const newCustomers = customersData.filter(customer => {
      const createdDate = new Date(customer.created_date || customer.first_order_date || '');
      return createdDate >= threeMonthsAgo;
    }).length;
    
    const activeCustomers = customersData.filter(customer => {
      const lastOrderDate = new Date(customer.last_order_date || '');
      return lastOrderDate >= threeMonthsAgo;
    }).length;

    const totalSpent = customersData.reduce((sum, customer) => sum + (customer.total_spent || 0), 0);
    const averageOrderValue = customersData.reduce((sum, customer) => sum + (customer.average_order_value || 0), 0) / totalCustomers;
    const outstandingReceivables = customersData.reduce((sum, customer) => sum + (customer.outstanding_receivable_amount || 0), 0);

    setCustomerMetrics({
      totalCustomers,
      newCustomers,
      activeCustomers,
      totalSpent,
      averageOrderValue,
      outstandingReceivables
    });
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customers.filter(customer =>
      customer.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      customer.trading_name?.toLowerCase().includes(search.toLowerCase())
    );

    // Sort customers based on selected criteria
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.display_name || '').localeCompare(b.display_name || '');
        case 'date':
          const aDate = new Date(a.last_order_date || a.created_date || 0);
          const bDate = new Date(b.last_order_date || b.created_date || 0);
          return bDate.getTime() - aDate.getTime();
        case 'value':
          return (b.total_spent || 0) - (a.total_spent || 0);
        case 'orders':
          return (b.order_count || 0) - (a.order_count || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [customers, search, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / customersPerPage);
  const currentCustomers = filteredAndSortedCustomers.slice(
    (currentPage - 1) * customersPerPage,
    currentPage * customersPerPage
  );

  const handleNewOrder = (customer: Customer) => {
    navigate(`/select-brand/${customer.id}`, {
      state: { 
        selectedCustomer: {
          id: customer.id,
          display_name: customer.display_name || customer.trading_name,
          trading_name: customer.trading_name,
          email: customer.customer_users?.[0]?.email || customer.email,
          phone: customer.phone,
          billing_address_1: customer.billing_address_1,
          billing_address_2: customer.billing_address_2,
          billing_city_town: customer.billing_city_town,
          billing_county: customer.billing_county,
          billing_postcode: customer.billing_postcode,
          linked_company: customer.linked_company,
          is_active: customer.is_active
        }
      }
    });
  };

  const handleViewCustomer = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleViewOrders = (customer: Customer) => {
    navigate('/orders', {
      state: {
        customerId: customer.id,
        customerName: customer.display_name || customer.trading_name
      }
    });
  };

  const handleCreateCustomer = () => {
    navigate('/customers/new');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  const renderListView = () => (
    <div className={styles.customersTable}>
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <div className={styles.tableHeaderRow}>
            <div>Customer</div>
            <div>Contact</div>
            <div>Actions</div>
          </div>
        </div>
        
        <div className={styles.tableBody}>
          {currentCustomers.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>👥</div>
              <h3>No customers found</h3>
              <p>Try adjusting your search criteria or add a new customer.</p>
            </div>
          ) : (
            currentCustomers.map((customer) => (
              <div key={customer.id} className={styles.tableRow}>
                <div className={styles.tableCell} data-label="Customer">
                  <div className={styles.customerLogoName}>
                    {customer.logo_url ? (
                      <img 
                        src={customer.logo_url} 
                        alt={customer.display_name}
                        className={styles.customerLogo}
                      />
                    ) : (
                      <div className={styles.customerLogoPlaceholder}>
                        {customer.display_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className={styles.customerName}>{customer.display_name}</div>
                      {customer.trading_name && customer.trading_name !== customer.display_name && (
                        <div className={styles.companyName}>{customer.trading_name}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={styles.tableCell} data-label="Contact">
                  <div className={styles.customerEmail}>
                    {customer.customer_users?.[0]?.email || customer.email || 'No email'}
                  </div>
                  {customer.phone && (
                    <div className={styles.customerPhone}>{customer.phone}</div>
                  )}
                </div>
                
                <div className={styles.tableCell} data-label="Actions">
                  <div className={styles.actionButtons}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNewOrder(customer);
                      }}
                      className={`${styles.actionBtn} ${styles.newOrderBtn}`}
                      title="New Order"
                    >
                      <ShoppingCart size={12} />
                      New Order
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewCustomer(customer);
                      }}
                      className={`${styles.actionBtn} ${styles.viewCustomerBtn}`}
                      title="View Customer"
                    >
                      <User size={12} />
                      View
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOrders(customer);
                      }}
                      className={`${styles.actionBtn} ${styles.viewOrdersBtn}`}
                      title="View Orders"
                    >
                      <Eye size={12} />
                      Orders
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderGridView = () => (
    <div className={styles.customersGrid}>
      {currentCustomers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👥</div>
          <h3>No customers found</h3>
          <p>Try adjusting your search criteria or add a new customer.</p>
        </div>
      ) : (
        currentCustomers.map((customer) => (
          <div key={customer.id} className={styles.customerCard}>
            <div className={styles.customerCardHeader}>
              {customer.logo_url ? (
                <img 
                  src={customer.logo_url} 
                  alt={customer.display_name}
                  className={styles.customerCardLogo}
                />
              ) : (
                <div className={styles.customerCardLogoPlaceholder}>
                  {customer.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={styles.customerCardInfo}>
                <h3 className={styles.customerCardName}>{customer.display_name}</h3>
                {customer.trading_name && customer.trading_name !== customer.display_name && (
                  <p className={styles.customerCardTradingName}>{customer.trading_name}</p>
                )}
              </div>
            </div>

            <div className={styles.customerCardStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Spent</span>
                <span className={styles.statValue}>{formatCurrency(customer.total_spent || 0)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Orders</span>
                <span className={styles.statValue}>{customer.order_count || 0}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Last Order</span>
                <span className={styles.statValue}>{formatDate(customer.last_order_date)}</span>
              </div>
            </div>

            <div className={styles.customerCardActions}>
              <button
                onClick={() => handleNewOrder(customer)}
                className={`${styles.cardActionBtn} ${styles.newOrderBtn}`}
              >
                <ShoppingCart size={14} />
                New Order
              </button>
              <button
                onClick={() => handleViewCustomer(customer)}
                className={`${styles.cardActionBtn} ${styles.viewCustomerBtn}`}
              >
                <User size={14} />
                View
              </button>
              <button
                onClick={() => handleViewOrders(customer)}
                className={`${styles.cardActionBtn} ${styles.viewOrdersBtn}`}
              >
                <Eye size={14} />
                Orders
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <ColorProvider 
      barChartColors="multicolored"
      graphColors={{ primary: '#79d5e9', secondary: '#4daeac', tertiary: '#f77d11' }}
    >
      <div className={styles.customersContainer}>
      <div className={styles.pageHeader}>
        <h1>Customer Management</h1>
        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={20} />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <Grid3x3 size={20} />
            </button>
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCreateCustomer}>
            <Plus size={20} /> New Customer
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className={styles.metricsGrid}>
        <MetricCard
          id="total-customers"
          title="Total Customers"
          value={customerMetrics.totalCustomers}
          subtitle="Active customers"
          format="number"
          color="#79d5e9"
          displayMode="compact"
          icon={<Users />}
        />
        
        <MetricCard
          id="new-customers"
          title="New Customers"
          value={customerMetrics.newCustomers}
          subtitle="Last 3 months"
          format="number"
          color="#f77d11"
          displayMode="compact"
          icon={<UserPlus />}
          trend={{
            value: customerMetrics.totalCustomers > 0 ? 
             Math.round(customerMetrics.newCustomers / customerMetrics.totalCustomers * 100) : 0,
            isPositive: customerMetrics.newCustomers > 0
          }}
        />
        
        <MetricCard
          id="active-customers"
          title="Active Customers"
          value={customerMetrics.activeCustomers}
          subtitle="With recent orders"
          format="number"
          color="#61bc8e"
          displayMode="compact"
          icon={<UserCheck />}
          trend={{
            value: customerMetrics.totalCustomers > 0 ? 
              Math.round(customerMetrics.activeCustomers / customerMetrics.totalCustomers * 100) : 0,
            isPositive: customerMetrics.activeCustomers > 0
          }}
        />

        <MetricCard
          id="avg-order-value"
          title="Avg Order Value"
          value={customerMetrics.averageOrderValue}
          subtitle="Per customer"
          format="currency"
          color="#06d6a0"
          displayMode="compact"
          icon={<TrendingUp />}
        />
      </div>

      {/* Search and Filter Controls */}
      <div className={styles.customersControls}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search customers by name or trading name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filterControls}>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={styles.sortFilter}
          >
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Last Order</option>
            <option value="value">Sort by Total Value</option>
            <option value="orders">Sort by Order Count</option>
          </select>
        </div>
      </div>

      {/* Customers Display */}
      {viewMode === 'list' ? renderListView() : renderGridView()}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {(currentPage - 1) * customersPerPage + 1} to {Math.min(currentPage * customersPerPage, filteredAndSortedCustomers.length)} of {filteredAndSortedCustomers.length} customers
          </div>
          <div className={styles.paginationControls}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={styles.paginationBtn}
            >
              Previous
            </button>
            
            <span className={styles.pageInfo}>
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={styles.paginationBtn}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
    </ColorProvider>
  );
}

export default CustomersManagement;