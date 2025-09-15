import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { 
  Search, 
  Calendar, 
  Package, 
  User, 
  DollarSign, 
  X, 
  Save, 
  Plus,
  AlertCircle,
  CheckCircle,
  Loader,
  ShoppingCart
} from 'lucide-react';
import styles from './FixOrder.module.css';

interface Order {
  id: string;
  legacy_order_number?: string;
  customer_id: string;
  order_date: string;
  created_at: string;
  total: number;
  sub_total?: number;
  order_status: string;
  notes?: string;
  company_id: string;
  sales_id?: string;
  customers?: {
    id: string;
    display_name: string;
    trading_name: string;
    email?: string;
    fb_customer_id?: string;
  };
  order_line_items?: OrderLineItem[];
}

interface OrderLineItem {
  id: string;
  item_id: string;
  item_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  items?: {
    legacy_item_id?: string;
    manufacturer?: string;
  };
  isNew?: boolean; // Flag for newly added items
}

interface SearchItem {
  id: string;
  name: string;
  sku: string;
  cost_price: number;
  legacy_item_id?: string;
  manufacturer?: string;
}

export default function FixOrder() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  
  // Form state for editing
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);
  const [editedLineItems, setEditedLineItems] = useState<OrderLineItem[]>([]);
  
  // Item search state
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [searchingItems, setSearchingItems] = useState(false);

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    setLoading(true);
    try {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) throw new Error('User company not found');

      // Fetch last 30 orders with customer and line items
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers!customer_id (
            id,
            display_name,
            trading_name,
            email,
            fb_customer_id
          ),
          order_line_items!order_id (
            *,
            items!item_id (
              legacy_item_id,
              manufacturer
            )
          )
        `)
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      showMessage('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSelect = async (order: Order) => {
    setSelectedOrder(order);
    setEditedOrder({ ...order });
    setEditedLineItems([...(order.order_line_items || [])]);
    setShowModal(true);
    // Reset search state
    setItemSearchTerm('');
    setSearchResults([]);
    setShowItemSearch(false);
  };

  const searchItems = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchingItems(true);
    try {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) throw new Error('User company not found');

      // Clean search term to avoid URL encoding issues
      const cleanSearchTerm = searchTerm.trim().replace(/[%{}]/g, '');
      
      // Search items by name or SKU through brands
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id, 
          name, 
          sku, 
          cost_price, 
          legacy_item_id, 
          manufacturer,
          brands!inner(company_id)
        `)
        .eq('brands.company_id', userData.company_id)
        .eq('status', 'active')
        .or(`name.ilike.%${cleanSearchTerm}%,sku.ilike.%${cleanSearchTerm}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(items || []);
    } catch (error) {
      console.error('Error searching items:', error);
      setSearchResults([]);
    } finally {
      setSearchingItems(false);
    }
  };

  const handleAddItem = (item: SearchItem) => {
    // Create new line item
    const newLineItem: OrderLineItem = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      quantity: 1,
      unit_price: item.cost_price,
      total_price: item.cost_price,
      items: {
        legacy_item_id: item.legacy_item_id,
        manufacturer: item.manufacturer
      },
      isNew: true
    };

    const updatedItems = [...editedLineItems, newLineItem];
    setEditedLineItems(updatedItems);
    recalculateOrderTotals(updatedItems);
    
    // Reset search
    setItemSearchTerm('');
    setSearchResults([]);
    setShowItemSearch(false);
  };

  const handleRemoveItem = (index: number) => {
    const updatedItems = editedLineItems.filter((_, i) => i !== index);
    setEditedLineItems(updatedItems);
    recalculateOrderTotals(updatedItems);
  };

  const handleOrderFieldChange = (field: keyof Order, value: any) => {
    if (!editedOrder) return;
    setEditedOrder({ ...editedOrder, [field]: value });
  };

  const handleLineItemChange = (index: number, field: keyof OrderLineItem, value: any) => {
    const updatedItems = [...editedLineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate total_price when quantity or unit_price changes
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = field === 'quantity' ? Number(value) : Number(updatedItems[index].quantity);
      const unitPrice = field === 'unit_price' ? Number(value) : Number(updatedItems[index].unit_price);
      updatedItems[index].total_price = quantity * unitPrice;
    }
    
    setEditedLineItems(updatedItems);
    
    // Recalculate order totals
    recalculateOrderTotals(updatedItems);
  };

  const recalculateOrderTotals = (items: OrderLineItem[]) => {
    if (!editedOrder) return;
    
    const subtotal = items.reduce((sum, item) => sum + Number(item.total_price), 0);
    const total = subtotal * 1.2; // Including 20% VAT
    
    setEditedOrder({
      ...editedOrder,
      sub_total: subtotal,
      total: total
    });
  };

  const handleSave = async (createNew: boolean = false) => {
    if (!editedOrder || !selectedOrder) return;
    
    setSaving(true);
    try {
      // Get current user context and verify permissions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's company and role to verify permissions
      const { data: userData } = await supabase
        .from('users')
        .select('id, company_id, role')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) throw new Error('User data not found');

      // Verify the order belongs to the user's company
      const { data: orderCheck } = await supabase
        .from('orders')
        .select('company_id, sales_id')
        .eq('id', editedOrder.id)
        .single();

      if (!orderCheck || orderCheck.company_id !== userData.company_id) {
        throw new Error('You do not have permission to modify this order');
      }

      // Update order in Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          order_status: editedOrder.order_status,
          notes: editedOrder.notes,
          sub_total: editedOrder.sub_total,
          total: editedOrder.total
        })
        .eq('id', editedOrder.id)
        .eq('company_id', userData.company_id); // Add company_id filter for RLS

      if (orderError) throw orderError;

      // Handle new line items - use the established pattern from OrderSummary
      const newItems = editedLineItems.filter(item => item.isNew);
      if (newItems.length > 0) {
        // Use the same structure as OrderSummary for consistency
        const lineItemsToInsert = newItems.map(item => ({
          order_id: editedOrder.id,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));

        // Insert with explicit error handling like OrderSummary
        const { error: insertError } = await supabase
          .from('order_line_items')
          .insert(lineItemsToInsert);

        if (insertError) {
          console.error('Line items insert error:', insertError);
          throw new Error(`Failed to add new items: ${insertError.message}`);
        }
      }

      // Handle existing line items - batch update with company verification
      const existingItems = editedLineItems.filter(item => !item.isNew);
      for (const item of existingItems) {
        const { error: itemError } = await supabase
          .from('order_line_items')
          .update({
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })
          .eq('id', item.id);

        if (itemError) throw itemError;
      }

      // Prepare data for Zoho
      await sendToZoho(editedOrder, editedLineItems, createNew);
      
      showMessage(
        createNew ? 'Order saved and created as new in Zoho!' : 'Order updated successfully!',
        'success'
      );
      
      // Refresh orders list
      fetchRecentOrders();
      
      // Close modal after success
      setTimeout(() => {
        setShowModal(false);
        resetForm();
      }, 2000);
      
    } catch (error) {
      console.error('Error saving order:', error);
      showMessage('Failed to save order', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendToZoho = async (order: Order, lineItems: OrderLineItem[], createNew: boolean) => {
    try {
      const customer = order.customers;
      if (!customer) throw new Error('Customer data missing');

      // Create webhook payload similar to OrderSummary
      const webhookPayload = {
        salesorder_number: createNew ? `SO-${Date.now()}` : order.legacy_order_number,
        date: new Date(order.order_date || order.created_at).toISOString().split('T')[0],
        is_update: !createNew,
        original_order_id: !createNew ? order.legacy_order_number : undefined,
        
        customer: {
          supabase_id: customer.id,
          customer_id: customer.fb_customer_id || customer.id,
          name: customer.display_name || customer.trading_name,
          email: customer.email || '',
          company: customer.trading_name || customer.display_name
        },
        
        line_items: lineItems.map((item) => ({
          item_id: item.items?.legacy_item_id || item.item_id,
          sku: item.sku || 'N/A',
          name: item.item_name,
          quantity: item.quantity,
          rate: item.unit_price,
          amount: item.total_price,
          brand: item.items?.manufacturer || 'Unknown'
        })),
        
        subtotal: order.sub_total || 0,
        vat_amount: (order.total || 0) - (order.sub_total || 0),
        total: order.total || 0,
        
        notes: order.notes || `Order ${createNew ? 'created' : 'updated'} via Fix Order tool`,
        created_by: 'Web App - Fix Order',
        created_at: new Date().toISOString()
      };

      console.log('Sending to Zoho webhook:', webhookPayload);

      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        console.warn(`Zoho webhook failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending to Zoho:', error);
      throw error;
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 5000);
  };

  const resetForm = () => {
    setSelectedOrder(null);
    setEditedOrder(null);
    setEditedLineItems([]);
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchTerm.toLowerCase();
    return (
      order.legacy_order_number?.toLowerCase().includes(searchLower) ||
      order.customers?.display_name?.toLowerCase().includes(searchLower) ||
      order.customers?.trading_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  return (
    <div className={styles.fixOrderContainer}>
      <div className={styles.header}>
        <h2>Fix Order</h2>
        <p>Select an order from the last 30 to edit and update</p>
      </div>

      {message && (
        <div className={`${styles.message} ${styles[messageType]}`}>
          {messageType === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message}</span>
        </div>
      )}

      <div className={styles.searchSection}>
        <div className={styles.searchBox}>
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by order number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <Loader className={styles.spinner} size={40} />
          <p>Loading orders...</p>
        </div>
      ) : (
        <div className={styles.ordersList}>
          {filteredOrders.map(order => (
            <div 
              key={order.id} 
              className={styles.orderCard}
              onClick={() => handleOrderSelect(order)}
            >
              <div className={styles.orderHeader}>
                <div>
                  <h4>{order.legacy_order_number || 'No Order Number'}</h4>
                  <p className={styles.customerName}>
                    {order.customers?.display_name || order.customers?.trading_name || 'Unknown Customer'}
                  </p>
                </div>
                <div className={styles.orderMeta}>
                  <span className={`${styles.status} ${styles[order.order_status?.toLowerCase() || 'pending']}`}>
                    {order.order_status || 'Pending'}
                  </span>
                </div>
              </div>
              <div className={styles.orderDetails}>
                <div className={styles.detail}>
                  <Calendar size={16} />
                  <span>{formatDate(order.order_date || order.created_at)}</span>
                </div>
                <div className={styles.detail}>
                  <Package size={16} />
                  <span>{order.order_line_items?.length || 0} items</span>
                </div>
                <div className={styles.detail}>
                  <DollarSign size={16} />
                  <span>{formatCurrency(order.total || 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showModal && editedOrder && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Edit Order {editedOrder.legacy_order_number}</h3>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalContent}>
              {/* Order Info */}
              <div className={styles.section}>
                <h4>Order Information</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Order Status</label>
                    <select
                      value={editedOrder.order_status}
                      onChange={(e) => handleOrderFieldChange('order_status', e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Order Date</label>
                    <input
                      type="date"
                      value={editedOrder.order_date?.split('T')[0] || editedOrder.created_at?.split('T')[0]}
                      disabled
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Notes</label>
                  <textarea
                    value={editedOrder.notes || ''}
                    onChange={(e) => handleOrderFieldChange('notes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h4>Line Items</h4>
                  <button
                    type="button"
                    className={styles.addItemButton}
                    onClick={() => setShowItemSearch(!showItemSearch)}
                  >
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>

                {/* Item Search */}
                {showItemSearch && (
                  <div className={styles.itemSearchSection}>
                    <div className={styles.itemSearchBox}>
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder="Search items by name or SKU..."
                        value={itemSearchTerm}
                        onChange={(e) => {
                          setItemSearchTerm(e.target.value);
                          searchItems(e.target.value);
                        }}
                        autoFocus
                      />
                      {searchingItems && <Loader className={styles.spinner} size={16} />}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className={styles.searchResults}>
                        {searchResults.map((item) => (
                          <div 
                            key={item.id} 
                            className={styles.searchResultItem}
                            onClick={() => handleAddItem(item)}
                          >
                            <div className={styles.itemInfo}>
                              <h5>{item.name}</h5>
                              <p>SKU: {item.sku} | Price: {formatCurrency(item.cost_price)}</p>
                            </div>
                            <Plus size={16} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.lineItems}>
                  {editedLineItems.map((item, index) => (
                    <div key={item.id} className={styles.lineItem}>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemInfoHeader}>
                          <h5>{item.item_name} {item.isNew && <span className={styles.newBadge}>NEW</span>}</h5>
                          <button
                            type="button"
                            className={styles.removeItemButton}
                            onClick={() => handleRemoveItem(index)}
                            title="Remove item"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <p>SKU: {item.sku || 'N/A'}</p>
                      </div>
                      <div className={styles.itemControls}>
                        <div className={styles.formGroup}>
                          <label>Quantity</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            min="1"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Unit Price</label>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Total</label>
                          <input
                            type="text"
                            value={formatCurrency(item.total_price)}
                            disabled
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={styles.section}>
                <div className={styles.totals}>
                  <div className={styles.totalRow}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(editedOrder.sub_total || 0)}</span>
                  </div>
                  <div className={styles.totalRow}>
                    <span>VAT (20%):</span>
                    <span>{formatCurrency((editedOrder.total || 0) - (editedOrder.sub_total || 0))}</span>
                  </div>
                  <div className={`${styles.totalRow} ${styles.final}`}>
                    <span>Total:</span>
                    <span>{formatCurrency(editedOrder.total || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveButton}
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving ? <Loader className={styles.spinner} size={16} /> : <Save size={16} />}
                Save
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {saving ? <Loader className={styles.spinner} size={16} /> : <Plus size={16} />}
                Save & Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}