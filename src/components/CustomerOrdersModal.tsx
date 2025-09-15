import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
// import { useAuth } from '../hooks/useAuth'; // TODO: Add when auth hook is available
import { Eye, X, Package, Truck, CreditCard } from 'lucide-react';
import styles from './CustomerOrdersModal.module.css';

interface Order {
  id: string;
  order_number?: string;
  invoice_number?: string;
  zoho_salesorder_id?: string;
  customer_id: string;
  invoice_date: string;
  total: number;
  status: string;
  line_items?: any[];
  payment_status?: string;
  shipping_status?: string;
  created_at?: string;
  expected_delivery_date?: string;
  balance?: number;
  company_id: string;
}

interface CustomerOrdersModalProps {
  customer: {
    id: string;
    customer_id: string;
    customer_name: string;
    company_name?: string;
  };
  onClose: () => void;
}

export default function CustomerOrdersModal({ customer, onClose }: CustomerOrdersModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // const { user } = useAuth(); // TODO: Add when auth hook is available
  // const user = { id: 'temp-user' }; // Temporary user for development

  useEffect(() => {
    fetchCustomerOrders();
  }, [customer.customer_id]);

  const fetchCustomerOrders = async () => {
    try {
      setLoading(true);
      
      // First, try to find orders by the Supabase customer ID
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customer.id)
        .order('invoice_date', { ascending: false });

      let { data: ordersData, error } = await ordersQuery;

      // If no orders found by Supabase ID, try by Zoho customer ID
      if (!ordersData || ordersData.length === 0) {
        ordersQuery = supabase
          .from('orders')
          .select(`
            *,
            customers!inner(fb_customer_id)
          `)
          .eq('customers.fb_customer_id', customer.customer_id)
          .order('invoice_date', { ascending: false });

        const result = await ordersQuery;
        ordersData = result.data;
        error = result.error;
      }

      // If still no orders, try the invoices table
      if (!ordersData || ordersData.length === 0) {
        const invoicesQuery = supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            customer_id,
            invoice_date,
            total,
            status,
            payment_status,
            company_id,
            balance,
            created_at
          `)
          .eq('customer_id', customer.id)
          .order('invoice_date', { ascending: false });

        const { data: invoicesData, error: invoiceError } = await invoicesQuery;
        
        if (invoicesData && invoicesData.length > 0) {
          // Transform invoice data to match order interface
          ordersData = invoicesData.map(invoice => ({
            ...invoice,
            order_number: invoice.invoice_number,
            line_items: [],
            shipping_status: 'pending'
          }));
        }
        
        error = invoiceError;
      }

      if (error) {
        console.error('Error fetching orders:', error);
        ordersData = [];
      }

      setOrders(ordersData || []);
      
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = (order: Order) => {
    // Navigate to order detail or invoice detail based on what's available
    if (order.zoho_salesorder_id) {
      navigate(`/order-detail/${order.id}`);
    } else {
      navigate(`/invoice-detail/${order.id}`);
    }
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || 'pending';
    
    switch (normalizedStatus) {
      case 'paid':
      case 'completed':
      case 'closed':
        return styles.statusPaid;
      case 'shipped':
      case 'dispatched':
        return styles.statusShipped;
      case 'cancelled':
      case 'canceled':
        return styles.statusCancelled;
      case 'draft':
        return styles.statusDraft;
      case 'pending':
      case 'open':
      default:
        return styles.statusPending;
    }
  };

  const calculateOrderStats = () => {
    const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalValue / orders.length : 0;
    const lastOrderDate = orders.length > 0 ? orders[0].invoice_date : null;

    return {
      totalOrders: orders.length,
      totalValue,
      avgOrderValue,
      lastOrderDate
    };
  };

  const stats = calculateOrderStats();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            Orders for <span className={styles.customerName}>{customer.customer_name || customer.company_name}</span>
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className="spinner" style={{ 
                width: '48px', 
                height: '48px', 
                border: '4px solid rgba(68, 131, 130, 0.1)',
                borderTopColor: '#50B9B7',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}></div>
              <p style={{ color: '#50B9B7', marginTop: '1rem' }}>Loading customer orders...</p>
            </div>
          ) : (
            <>
              <div className={styles.ordersSummary}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Total Orders</span>
                  <span className={styles.summaryValue}>{stats.totalOrders}</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Total Value</span>
                  <span className={styles.summaryValue}>
                    {formatCurrency(stats.totalValue)}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Avg Order Value</span>
                  <span className={styles.summaryValue}>
                    {formatCurrency(stats.avgOrderValue)}
                  </span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Last Order</span>
                  <span className={styles.summaryValue}>
                    {stats.lastOrderDate ? formatDate(stats.lastOrderDate) : 'N/A'}
                  </span>
                </div>
              </div>
              
              {orders.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📦</div>
                  <h3>No orders found</h3>
                  <p>This customer has not placed any orders yet.</p>
                </div>
              ) : (
                <div className={styles.ordersTableContainer}>
                  <table className={styles.ordersTable}>
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Shipping</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <span className={styles.orderNumber}>
                              {order.order_number || order.invoice_number || 'N/A'}
                            </span>
                          </td>
                          <td>{formatDate(order.invoice_date)}</td>
                          <td>
                            <span className={styles.itemsCount}>
                              <Package size={14} />
                              {order.line_items?.length || 0}
                            </span>
                          </td>
                          <td>
                            <span className={styles.orderTotal}>
                              {formatCurrency(order.total)}
                            </span>
                          </td>
                          <td>
                            <div className={styles.paymentStatus}>
                              <CreditCard size={14} />
                              <span className={`${styles.statusBadge} ${getStatusBadgeClass(order.payment_status || 'pending')}`}>
                                {order.payment_status || 'Pending'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.shippingStatus}>
                              <Truck size={14} />
                              <span className={`${styles.statusBadge} ${getStatusBadgeClass(order.shipping_status || 'pending')}`}>
                                {order.shipping_status || 'Pending'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${getStatusBadgeClass(order.status)}`}>
                              {order.status || 'Open'}
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleViewOrder(order)}
                              title="View Order Details"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}