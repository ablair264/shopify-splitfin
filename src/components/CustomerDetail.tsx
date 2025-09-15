import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, ClipboardList, Mail, Phone, AlertTriangle, 
  CheckCircle, Bot, CreditCard, TrendingUp, Building, UserCheck, Send
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { ColorProvider } from './analytics/shared/ColorProvider';
import MetricCard from './analytics/shared/MetricCard';
import styles from './CustomerDetail.module.css';

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

interface RecentOrder {
  id: string;
  legacy_order_number?: string;
  order_date: string;
  total: number;
  order_status: string;
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [customerUsers, setCustomerUsers] = useState<CustomerUser[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'contacts' | 'orders'>('overview');
  const [sendingToZoho, setSendingToZoho] = useState(false);
  const [zohoSyncMessage, setZohoSyncMessage] = useState('');
  const [zohoSyncStatus, setZohoSyncStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
      fetchRecentOrders();
    }
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      // Fetch customer data
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) {
        console.error('Error fetching customer:', customerError);
        return;
      }

      setCustomerData(customer);

      // Fetch customer users separately  
      const { data: users, error: usersError } = await supabase
        .from('customer_users')
        .select('*')
        .eq('linked_customer', customerId)
        .order('primary_contact', { ascending: false });

      if (usersError) {
        console.error('Error fetching customer users:', usersError);
        // Don't fail the entire request for user fetch errors
      }

      if (!usersError && users) {
        setCustomerUsers(users);
      }

    } catch (error) {
      console.error('Error in fetchCustomerData:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, legacy_order_number, order_date, total, order_status')
        .eq('customer_id', customerId)
        .order('order_date', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      setRecentOrders(orders || []);
    } catch (error) {
      console.error('Error in fetchRecentOrders:', error);
    }
  };

  // Zoho integration via Make.com webhook

  const handleSyncToZoho = async () => {
    if (!customerData) return;
    
    setSendingToZoho(true);
    setZohoSyncStatus('sending');
    
    const isExistingCustomer = !!customerData.fb_customer_id;
    setZohoSyncMessage(isExistingCustomer ? 'Updating customer in Zoho...' : 'Syncing customer to Zoho...');
    
    try {
      const customerEmail = customerData.email || customerUsers[0]?.email;
      
      if (!customerEmail) {
        throw new Error('Customer email is required for Zoho integration');
      }

      // Prepare customer data for webhook
      const webhookData = {
        action: 'sync_customer',
        customer_type: isExistingCustomer ? 'existing' : 'new',
        supabase_customer_id: customerData.id,
        zoho_customer_id: customerData.fb_customer_id || null,
        customer_data: {
          display_name: customerData.display_name,
          trading_name: customerData.trading_name,
          email: customerEmail,
          phone: customerData.phone,
          billing_address_1: customerData.billing_address_1,
          billing_address_2: customerData.billing_address_2,
          billing_city_town: customerData.billing_city_town,
          billing_county: customerData.billing_county,
          billing_postcode: customerData.billing_postcode,
          shipping_address_1: customerData.shipping_address_1,
          shipping_address_2: customerData.shipping_address_2,
          shipping_city_town: customerData.shipping_city_town,
          shipping_county: customerData.shipping_county,
          shipping_postcode: customerData.shipping_postcode,
          payment_terms: customerData.payment_terms,
          currency_code: customerData.currency_code,
        },
        timestamp: new Date().toISOString(),
        source: 'customer_detail_page'
      };

      console.log('Sending customer to Make.com webhook:', webhookData);

      // Send to Make.com webhook
      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      // Handle different response types from Make.com
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Handle plain text responses (like "Accepted")
        const textResult = await response.text();
        console.log('Webhook returned plain text:', textResult);
        result = { success: true, message: textResult };
      }
      
      console.log('Webhook response:', result);

      // If Make.com returns a Zoho customer ID, update Supabase
      if (result.zoho_customer_id && result.zoho_customer_id !== customerData.fb_customer_id) {
        console.log('Updating Supabase with Zoho customer ID:', result.zoho_customer_id);
        
        const { error: updateError } = await supabase
          .from('customers')
          .update({ fb_customer_id: result.zoho_customer_id })
          .eq('id', customerData.id);
          
        if (updateError) {
          console.error('Failed to update fb_customer_id:', updateError);
          throw new Error('Failed to update customer with Zoho ID');
        } else {
          console.log('Successfully updated fb_customer_id in Supabase');
          // Refresh customer data to show new fb_customer_id
          fetchCustomerData();
        }
      }
      
      setZohoSyncStatus('success');
      setZohoSyncMessage(isExistingCustomer ? 'Customer successfully updated in Zoho!' : 'Customer successfully synced to Zoho!');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setZohoSyncStatus('idle');
        setZohoSyncMessage('');
      }, 5000);
      
    } catch (error) {
      console.error('Error syncing to Zoho:', error);
      setZohoSyncStatus('error');
      setZohoSyncMessage(error instanceof Error ? error.message : 'Failed to sync to Zoho');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setZohoSyncStatus('idle');
        setZohoSyncMessage('');
      }, 5000);
    } finally {
      setSendingToZoho(false);
    }
  };

  // Helper function to safely format currency
  const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '£0';
    }
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  };

  // Helper function to safely get number value
  const getNumberValue = (value: number | undefined | null): number => {
    return value || 0;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className={styles.customerDetailLoading}>
        <div>Loading customer details...</div>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className={styles.customerDetailError}>
        <h2>Customer not found</h2>
        <button onClick={() => navigate('/customers')} className={`${styles.btn} ${styles.btnPrimary}`}>
          Back to Customers
        </button>
      </div>
    );
  }

  // Note: credit_limit is not in the current schema, so we'll skip credit-related calculations
  const outstandingAmount = getNumberValue(customerData.outstanding_receivable_amount);
  const paymentPerformance = getNumberValue(customerData.payment_performance);
  
  const getHealthColor = (performance: number) => {
    if (performance >= 90) return 'green';
    if (performance >= 70) return 'yellow';
    return 'red';
  };


  return (
    <ColorProvider 
      barChartColors="multicolored"
      graphColors={{ primary: '#79d5e9', secondary: '#4daeac', tertiary: '#f77d11' }}
    >
      <div className={styles.customerDetailContainer}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <button className={styles.backButton} onClick={() => navigate('/customers')}>
            <ArrowLeft size={16} /> Back to Customers
          </button>
          
          <div className={styles.headerInfo}>
            <div className={styles.customerNameSection}>
              <h1>{customerData.display_name || customerData.trading_name}</h1>
              <span className={`${styles.customerStatusBadge} ${customerData.is_active ? styles.active : styles.inactive}`}>
                {customerData.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleSyncToZoho}
              disabled={sendingToZoho}
              title={customerData.fb_customer_id ? "Update customer in Zoho Inventory" : "Sync customer to Zoho Inventory"}
            >
              <Send size={16} />
              {sendingToZoho ? 'Syncing...' : (customerData.fb_customer_id ? 'Update in Zoho' : 'Push to Zoho')}
            </button>
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => navigate('/orders/new', {
                state: { 
                  fromCustomerDetail: true,
                  customer: {
                    id: customerData.id,
                    display_name: customerData.display_name || customerData.trading_name,
                    trading_name: customerData.trading_name,
                    email: customerData.email || customerUsers[0]?.email,
                    phone: customerData.phone,
                    billing_address_1: customerData.billing_address_1,
                    billing_address_2: customerData.billing_address_2,
                    billing_city_town: customerData.billing_city_town,
                    billing_county: customerData.billing_county,
                    billing_postcode: customerData.billing_postcode,
                    linked_company: customerData.linked_company,
                    is_active: customerData.is_active,
                    logo_url: customerData.logo_url,
                    primary_contact_name: customerUsers.find(u => u.primary_contact)?.name,
                    primary_contact_email: customerUsers.find(u => u.primary_contact)?.email || customerData.email
                  }
                }
              })}
            >
              Create Order
            </button>
          </div>
        </div>

        {/* Zoho Sync Status Message */}
        {zohoSyncMessage && (
          <div className={`${styles.notification} ${styles[zohoSyncStatus]}`}>
            {zohoSyncStatus === 'sending' && <div className={styles.spinner} />}
            {zohoSyncStatus === 'success' && <CheckCircle size={20} />}
            {zohoSyncStatus === 'error' && <AlertTriangle size={20} />}
            <span>{zohoSyncMessage}</span>
          </div>
        )}

        {/* Financial Health Summary */}
        <div className={styles.financialHealthSummary}>
          <MetricCard
            id="payment-performance"
            title="Payment Performance"
            value={paymentPerformance}
            subtitle="Historical reliability"
            format="percentage"
            color="#79d5e9"
            displayMode="compact"
            icon={<TrendingUp />}
          />

          <MetricCard
            id="total-spent"
            title="Total Spent"
            value={customerData.total_spent}
            subtitle="Customer lifetime value"
            format="currency"
            color="#8b5cf6"
            displayMode="compact"
            icon={<CreditCard />}
          />

          <MetricCard
            id="outstanding-amount"
            title="Outstanding"
            value={outstandingAmount}
            subtitle="Total receivables"
            format="currency"
            color="#f72585"
            displayMode="compact"
            icon={<AlertTriangle />}
          />

          <MetricCard
            id="payment-terms"
            title="Payment Terms"
            value={customerData.payment_terms}
            subtitle="Days"
            format="number"
            color="#8b5cf6"
            displayMode="compact"
            icon={<CheckCircle />}
          />
        </div>

        {/* Tabs */}
        <div className={styles.customerDetailTabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'financial' ? styles.active : ''}`}
            onClick={() => setActiveTab('financial')}
          >
            Financial Details
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'contacts' ? styles.active : ''}`}
            onClick={() => setActiveTab('contacts')}
          >
            Contacts
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Recent Orders
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.customerTabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewTab}>
              <div className={styles.infoGrid}>
                <div className={`${styles.customerInfoSection} ${styles.infoSection}`}>
                  <h3><Building size={20} /> Company Information</h3>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Trading Name</span>
                    <span className={styles.value}>{customerData.trading_name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Display Name</span>
                    <span className={styles.value}>{customerData.display_name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Email</span>
                    <span className={styles.value}>{customerData.email || customerUsers[0]?.email || 'N/A'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Phone</span>
                    <span className={styles.value}>{customerData.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className={`${styles.customerInfoSection} ${styles.infoSection}`}>
                  <h3>Business Metrics</h3>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Total Spent</span>
                    <span className={styles.value}>{formatCurrency(customerData.total_spent)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Order Count</span>
                    <span className={styles.value}>{customerData.order_count || 0}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Avg Order Value</span>
                    <span className={styles.value}>{formatCurrency(customerData.average_order_value)}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.label}>Customer Since</span>
                    <span className={styles.value}>{formatDate(customerData.created_date)}</span>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className={styles.addressesSection}>
                <h3>Addresses</h3>
                
                {/* Billing Address */}
                <div className={styles.addressWithMap}>
                  <div className={styles.addressText}>
                    <h4>Billing Address</h4>
                    <p>{customerData.billing_address_1}</p>
                    {customerData.billing_address_2 && <p>{customerData.billing_address_2}</p>}
                    <p>{customerData.billing_city_town}{customerData.billing_county ? `, ${customerData.billing_county}` : ''}</p>
                    <p>{customerData.billing_postcode}</p>
                  </div>
                  <div className={styles.addressMap}>
                    <iframe
                      width="100%"
                      height="200"
                      style={{ border: 0, borderRadius: '8px' }}
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc&q=${encodeURIComponent(`${customerData.billing_address_1}, ${customerData.billing_city_town}, ${customerData.billing_postcode}`)}`}
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>

                {/* Shipping Address - Only show if shipping address exists */}
                {customerData.shipping_address_1 && customerData.shipping_city_town && customerData.shipping_postcode && (
                  <div className={styles.addressWithMap}>
                    <div className={styles.addressText}>
                      <h4>Shipping Address</h4>
                      <p>{customerData.shipping_address_1}</p>
                      {customerData.shipping_address_2 && <p>{customerData.shipping_address_2}</p>}
                      <p>{customerData.shipping_city_town}{customerData.shipping_county ? `, ${customerData.shipping_county}` : ''}</p>
                      <p>{customerData.shipping_postcode}</p>
                    </div>
                    <div className={styles.addressMap}>
                      <iframe
                        width="100%"
                        height="200"
                        style={{ border: 0, borderRadius: '8px' }}
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc&q=${encodeURIComponent(`${customerData.shipping_address_1}, ${customerData.shipping_city_town}, ${customerData.shipping_postcode}`)}`}
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className={styles.financialTab}>
              <div className={styles.financialGrid}>
                <div className={styles.financialCard}>
                  <h3>Payment Information</h3>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Payment Terms</span>
                    <span className={styles.value}>{customerData.payment_terms} days</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Payment Performance</span>
                    <span className={styles.value}>{paymentPerformance}%</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Currency</span>
                    <span className={styles.value}>{customerData.currency_code}</span>
                  </div>
                </div>

                <div className={styles.financialCard}>
                  <h3>Financial Summary</h3>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Total Spent</span>
                    <span className={styles.value}>{formatCurrency(customerData.total_spent)}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Total Paid</span>
                    <span className={styles.value}>{formatCurrency(customerData.total_paid)}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Outstanding Amount</span>
                    <span className={styles.value}>{formatCurrency(outstandingAmount)}</span>
                  </div>
                </div>

                <div className={styles.financialCard}>
                  <h3>Order & Invoice Summary</h3>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Total Orders</span>
                    <span className={styles.value}>{customerData.order_count || 0}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Total Invoices</span>
                    <span className={styles.value}>{customerData.invoice_count || 0}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Average Order Value</span>
                    <span className={styles.value}>{formatCurrency(customerData.average_order_value)}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Unused Credits</span>
                    <span className={styles.value}>{formatCurrency(customerData.unused_credits_receivable_amount)}</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Customer Lifetime</span>
                    <span className={styles.value}>{customerData.customer_lifetime_days || 0} days</span>
                  </div>
                  <div className={styles.financialItem}>
                    <span className={styles.label}>Last Order Date</span>
                    <span className={styles.value}>{formatDate(customerData.last_order_date)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className={styles.contactsTab}>
              <div className={styles.contactsGrid}>
                {customerUsers.length > 0 ? (
                  customerUsers.map((contact) => (
                    <div key={contact.id} className={styles.contactCard}>
                      <div className={styles.contactHeader}>
                        <h4>{contact.name}</h4>
                        {contact.primary_contact && (
                          <span className={styles.primaryBadge}>Primary</span>
                        )}
                      </div>
                      <div className={styles.contactInfo}>
                        <p><Mail size={14} /> {contact.email}</p>
                        {contact.phone && (
                          <p><Phone size={14} /> {contact.phone}</p>
                        )}
                        <p><UserCheck size={14} /> {contact.contact_type}</p>
                        {contact.location_type && (
                          <p><MapPin size={14} /> {contact.location_type}</p>
                        )}
                      </div>
                      <div className={styles.contactActions}>
                        <button 
                          className={`${styles.btn} ${styles.btnSmall}`}
                          onClick={() => window.location.href = `mailto:${contact.email}`}
                        >
                          <Mail size={14} /> Email
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No contacts available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className={styles.ordersTab}>
              <div className={styles.ordersList}>
                {recentOrders.length > 0 ? (
                  recentOrders.map(order => (
                    <div key={order.id} className={styles.orderItem}>
                      <div className={styles.orderInfo}>
                        <h4>Order #{order.legacy_order_number || order.id.slice(0, 8)}</h4>
                        <p>{formatDate(order.order_date)}</p>
                      </div>
                      <div className={styles.orderStatus}>
                        <span className={`${styles.status} ${styles[order.order_status]}`}>
                          {order.order_status}
                        </span>
                      </div>
                      <div className={styles.orderAmount}>
                        {formatCurrency(order.total)}
                      </div>
                      <div className={styles.orderActions}>
                        <button 
                          className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No recent orders</p>
                )}
              </div>
              
              <button 
                className={`${styles.btn} ${styles.btnSecondary} ${styles.fullWidth}`}
                onClick={() => navigate('/orders', { 
                  state: { 
                    customerId: customerData.id,
                    customerName: customerData.display_name || customerData.trading_name
                  } 
                })}
              >
                <ClipboardList size={16} /> View All Orders
              </button>
            </div>
          )}
        </div>
      </div>
    </ColorProvider>
  );
}