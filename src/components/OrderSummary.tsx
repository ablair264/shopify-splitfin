// src/components/OrderSummary.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { ProgressBar } from './ProgressBar';
import styles from './OrderSummary.module.css';
import { withLoader } from '../hoc/withLoader';

interface OrderItem {
  product: {
    id: string;
    item_id?: string;
    name: string;
    sku: string;
    price: number;
    brand: string;
  };
  qty: number;
  total: number;
}

interface Customer {
  id: string;
  display_name: string;
  trading_name: string;
  email?: string;
  phone?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city_town?: string;
  billing_county?: string;
  billing_postcode?: string;
  linked_sales_user?: string;
  linked_company: string;
  is_active: boolean;
  fb_customer_id?: string;
  [key: string]: any;
}

function OrderSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  
  const orderData = location.state as {
    items: OrderItem[];
    orderTotal: number;
    brand: string;
    customer: Customer;
  };

  useEffect(() => {
    if (!orderData) {
      navigate('/');
      return;
    }
    loadUserInfo();
    checkCustomerStatus();
  }, []);

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userData?.company_id) {
        setCompanyId(userData.company_id);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const checkCustomerStatus = async () => {
    try {
      setCheckingCustomer(true);
      
      // Get latest customer data from Supabase
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', orderData.customer.id)
        .eq('is_active', true)
        .single();
      
      if (error) {
        console.error('Error fetching customer:', error);
        setError('Unable to verify customer information. Please try again.');
      } else if (customer) {
        setCustomerData(customer);
      }
      
      setCheckingCustomer(false);
    } catch (error) {
      console.error('Error checking customer:', error);
      setCheckingCustomer(false);
      setError('Unable to verify customer information. Please try again.');
    }
  };

  // Zoho integration via Make.com webhooks
  const syncCustomerToZoho = async (customerData: any, isExisting: boolean) => {
    try {
      const webhookData = {
        action: 'sync_customer',
        customer_type: isExisting ? 'existing' : 'new',
        supabase_customer_id: customerData.id,
        zoho_customer_id: customerData.fb_customer_id || null,
        customer_data: {
          display_name: customerData.display_name,
          trading_name: customerData.trading_name,
          email: customerData.email,
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
        source: 'order_summary_page'
      };

      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        throw new Error(`Customer webhook failed with status: ${response.status}`);
      }

      // Handle different response types from Make.com
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Handle plain text responses (like "Accepted")
        const textResult = await response.text();
        console.log('Customer webhook returned plain text:', textResult);
        result = { success: true, message: textResult };
      }
      
      return result.zoho_customer_id || null;
    } catch (error) {
      console.error('Error syncing customer to Zoho:', error);
      throw error;
    }
  };

  const sendOrderToZoho = async (orderData: any, zohoCustomerId: string) => {
    try {
      const webhookData = {
        action: 'create_order',
        supabase_order_id: orderData.id,
        zoho_customer_id: zohoCustomerId,
        order_data: {
          order_number: orderData.legacy_order_number,
          order_date: orderData.order_date,
          customer_email: orderData.customer?.email || '',
          sub_total: orderData.sub_total,
          total: orderData.total,
          items: orderData.items.map((item: any) => ({
            item_id: item.product.legacy_item_id || item.product.id,
            sku: item.product.sku,
            name: item.product.name,
            quantity: item.qty,
            unit_price: item.product.cost_price || item.product.price,
            total_price: item.total,
          })),
          notes: orderData.notes || '',
        },
        timestamp: new Date().toISOString(),
        source: 'order_summary_page'
      };

      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        throw new Error(`Order webhook failed with status: ${response.status}`);
      }

      // Handle different response types from Make.com
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Handle plain text responses (like "Accepted")
        const textResult = await response.text();
        console.log('Order webhook returned plain text:', textResult);
        result = { success: true, message: textResult };
      }
      
      return result.zoho_order_id || null;
    } catch (error) {
      console.error('Error sending order to Zoho:', error);
      throw error;
    }
  };

  const handleSubmitOrder = async () => {
    // Prevent double submission
    if (submitting) {
      return;
    }
    
    try {
      setLoading(true);
      setSubmitting(true);
      setError('');

      if (!customerData) {
        setError('Customer information is required to submit the order.');
        setLoading(false);
        return;
      }

      // Generate order number
      const orderNumber = `SO-${Date.now()}`;
      const orderDate = new Date().toISOString();
      
      if (!companyId) {
        setError('Unable to determine company information. Please try again.');
        setLoading(false);
        return;
      }

      // Get current user and their user record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      // Get the user record from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) {
        setError('Unable to find user record. Please contact support.');
        setLoading(false);
        return;
      }

      // Create order in Supabase
      const { data: newOrderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          legacy_order_number: orderNumber,
          customer_id: customerData.id,
          company_id: companyId,
          order_date: orderDate,
          order_status: 'pending',
          sub_total: subtotal,
          total: total,
          sales_id: userData.id,
          notes: `Order placed via web app - Brand: ${orderData?.brand || 'N/A'}`,
          created_at: orderDate
        })
        .select()
        .single();

      if (orderError) {
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // Create order line items
      const lineItems = orderData.items.map((item: any) => ({
        order_id: newOrderData.id,
        item_id: item.product.id,
        item_name: item.product.name,
        quantity: item.qty,
        unit_price: item.product.cost_price || item.product.price,
        total_price: item.total
      }));

      const { error: lineItemsError } = await supabase
        .from('order_line_items')
        .insert(lineItems);

      if (lineItemsError) {
        console.error('Error creating line items:', lineItemsError);
        // Don't fail the entire order for line item errors
      }

      // Handle Zoho integration via Make.com webhooks
      try {
        console.log('Starting Zoho integration via webhooks...');
        
        if (!customerData.email) {
          throw new Error('Customer email is required for Zoho integration');
        }

        // Determine if customer is existing (has fb_customer_id)
        const isExistingCustomer = !!customerData.fb_customer_id;
        
        // Sync customer to Zoho first
        console.log(isExistingCustomer ? 'Updating existing customer in Zoho...' : 'Creating new customer in Zoho...');
        
        const zohoCustomerId = await syncCustomerToZoho(customerData, isExistingCustomer);
        
        // Update Supabase with Zoho customer ID if we got a new one
        if (zohoCustomerId && zohoCustomerId !== customerData.fb_customer_id) {
          await supabase
            .from('customers')
            .update({ fb_customer_id: zohoCustomerId })
            .eq('id', customerData.id);
            
          console.log('Updated customer with Zoho ID:', zohoCustomerId);
        }

        // Send order to Zoho
        console.log('Sending order to Zoho...');
        
        const orderDataForZoho = {
          ...newOrderData,
          items: orderData.items,
          customer: customerData
        };

        const zohoOrderId = await sendOrderToZoho(orderDataForZoho, zohoCustomerId || customerData.fb_customer_id);
        
        // Update Supabase order with Zoho order ID
        if (zohoOrderId) {
          await supabase
            .from('orders')
            .update({ 
              zoho_order_id: zohoOrderId,
              order_status: 'sent_to_zoho'
            })
            .eq('id', newOrderData.id);
            
          console.log('Order sent to Zoho successfully');
        } else {
          console.log('Order sent to Zoho but no order ID returned');
        }

      } catch (zohoError) {
        console.error('Zoho integration failed:', zohoError);
        
        // Update order status to indicate Zoho sync failed
        await supabase
          .from('orders')
          .update({ order_status: 'zoho_sync_failed' })
          .eq('id', newOrderData.id);
          
        // Don't fail the entire order process
        console.log('Order saved locally. Zoho sync failed - will retry later.');
      }

      // Create notifications for staff
      await createOrderNotifications(orderNumber, customerData, subtotal, orderData.items.length, companyId);

      // Clear order data and navigate to confirmation
      localStorage.removeItem(`ORDER_SELECTED_${orderData.customer.id}`);
      
      navigate('/order-confirmation', {
        state: {
          orderId: newOrderData.id,
          orderNumber: orderNumber,
          customer: customerData,
          items: orderData.items,
          total: subtotal
        }
      });

    } catch (error) {
      console.error('Error submitting order:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const createOrderNotifications = async (orderNumber: string, customerData: Customer, orderTotal: number, itemCount: number, companyId: string) => {
    try {
      // Find users with appropriate roles (e.g., sales managers, order processors)
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, role')
        .in('role', ['admin', 'sales_manager', 'order_processor'])
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching users for notifications:', error);
        return;
      }

      // Create notifications for relevant users
      const notifications = users?.map(user => ({
        company_id: companyId,
        user_id: user.id,
        notification_type: 'order_update',
        title: 'New Order Submitted',
        message: `${customerData.display_name || customerData.trading_name} has submitted order #${orderNumber} for £${(orderTotal * 1.2).toFixed(2)}.`,
        related_entity_type: 'order',
        related_entity_id: orderNumber,
        read: false
      })) || [];

      if (notifications.length > 0) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notificationError) {
          console.error('Error creating notifications:', notificationError);
        } else {
          console.log('Order notifications created successfully');
        }
      }
    } catch (error) {
      console.error('Error creating order notifications:', error);
      // Don't throw - we don't want to fail the order if notifications fail
    }
  };

  if (!orderData) {
    return null;
  }

  const subtotal = orderData.orderTotal;
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  return (
    <div className={styles.orderSummaryPage}>
      {/* Progress Bar */}
      <div className={styles.progressBarContainer}>
        <ProgressBar currentStep={3} theme="dark" />
      </div>
      
      <div className={styles.orderSummaryContainer}>
        <div className={styles.summaryHeader}>
          <h1>Order Summary</h1>
          <p>Please review your order before submitting</p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {checkingCustomer && (
          <div className={styles.infoMessage}>
            <div className={styles.spinner}></div>
            Verifying customer information...
          </div>
        )}

        <div className={styles.summaryContent}>
          {/* Customer Information */}
          <div className={styles.summarySection}>
            <h2>Customer Information</h2>
            <div className={styles.customerDetails}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Name:</span>
                <span className={styles.value}>
                  {customerData?.display_name || orderData.customer.display_name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Email:</span>
                <span className={styles.value}>
                  {customerData?.email || orderData.customer.email}
                </span>
              </div>
              {(customerData?.trading_name || orderData.customer.trading_name) && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>Trading Name:</span>
                  <span className={styles.value}>
                    {customerData?.trading_name || orderData.customer.trading_name}
                  </span>
                </div>
              )}
              {customerData?.phone && (
                <div className={styles.detailRow}>
                  <span className={styles.label}>Phone:</span>
                  <span className={styles.value}>{customerData.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className={styles.summarySection}>
            <h2>Order Items - {orderData.brand}</h2>
            <div className={styles.orderItemsList}>
              {orderData.items.map((item, index) => (
                <div key={index} className={styles.orderItemRow}>
                  <div className={styles.itemDetails}>
                    <span className={styles.itemName}>{item.product.name}</span>
                    <span className={styles.itemSku}>SKU: {item.product.sku}</span>
                  </div>
                  <div className={styles.itemQuantity}>
                    Qty: {item.qty}
                  </div>
                  <div className={styles.itemPrice}>
                    £{item.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Totals */}
          <div className={styles.summarySection}>
            <div className={styles.totalsContainer}>
              <div className={styles.totalRow}>
                <span>Subtotal</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>VAT (20%)</span>
                <span>£{vat.toFixed(2)}</span>
              </div>
              <div className={`${styles.totalRow} ${styles.final}`}>
                <span>Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.summaryActions}>
            <button 
              className={styles.btnSecondary}
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Back to Products
            </button>
            <button 
              className={styles.btnPrimary}
              onClick={handleSubmitOrder}
              disabled={loading || checkingCustomer || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withLoader(OrderSummary);