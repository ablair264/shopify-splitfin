import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { shippingService } from '../services/shippingService';
import { withLoader } from '../hoc/withLoader';
import { 
  FileText, 
  File, 
  Settings, 
  User, 
  Mail, 
  ShoppingCart,
  CheckCircle,
  Package,
  Warehouse,
  ClipboardList,
  Calendar,
  Home,
  Clock,
  HelpCircle,
  ChevronDown,
  MapPin,
  Truck,
  Route,
  Eye,
  Send,
  X,
  Save,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  Copy
} from 'lucide-react';
import styles from './ViewOrder.module.css';

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';
console.log('Google Maps API Key loaded:', GOOGLE_MAPS_API_KEY ? 'Yes' : 'No', GOOGLE_MAPS_API_KEY?.substr(0, 10) + '...');


// Types
interface OrderLineItem {
  id: string;
  item_id: string;
  item_name: string;
  sku?: string; // Optional since it might not exist in database
  quantity: number;
  unit_price: number | string; // Could be string from database
  total_price: number | string; // Could be string from database
  brand_name?: string;
  quantity_shipped?: number;
  quantity_packed?: number;
  quantity_delivered?: number;
  quantity_invoiced?: number;
  quantity_cancelled?: number;
  quantity_returned?: number;
}

interface Order {
  id: string;
  legacy_order_number?: string;
  customer_id: string;
  customer_name?: string;
  customer_trading_name?: string;
  order_date: string;
  created_at: string;
  total: number;
  sub_total?: number;
  order_status: string;
  warehouse_status?: string;
  notes?: string;
  company_id: string;
  sales_id?: string;
  shipment_id?: string;
  invoice_id?: string;
  line_items: OrderLineItem[];
  customers?: {
    display_name: string;
    trading_name: string;
    email?: string;
    phone?: string;
    billing_address_1?: string;
    billing_address_2?: string;
    billing_city_town?: string;
    billing_county?: string;
    billing_postcode?: string;
    shipping_address_1?: string;
    shipping_address_2?: string;
    shipping_city_town?: string;
    shipping_county?: string;
    shipping_postcode?: string;
  };
  shipments?: Array<{
    id: string;
    shipment_status: string;
    order_tracking_number?: string;
    date_shipped?: string;
    date_delivered?: string;
    courier_id?: string;
    items_shipped: number;
    items_packed: number;
    number_of_boxes?: number;
  }>;
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
  shipping_address_1?: string;
  shipping_address_2?: string;
  shipping_city_town?: string;
  shipping_county?: string;
  shipping_postcode?: string;
  fb_customer_id?: string;
}

interface Invoice {
  id: string;
  invoice_status: string;
  invoice_date: string;
  total: number;
  balance: number;
  payment_terms: number;
  date_due?: string;
}

type TabFilter = 'all' | 'shipped' | 'partial' | 'awaiting';

const orderStatusSteps = [
  { key: 'pending', label: 'Order Received', icon: ClipboardList },
  { key: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
  { key: 'processing', label: 'Processing', icon: Warehouse },
  { key: 'shipped', label: 'Order Shipped', icon: ShoppingCart },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle }
];

function ViewOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [courierInfo, setCourierInfo] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [sendingToZoho, setSendingToZoho] = useState(false);
  const [zohoSendStatus, setZohoSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [zohoSendMessage, setZohoSendMessage] = useState('');
  
  // Edit Order Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editOrderData, setEditOrderData] = useState<any>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  
  // Cancel Order Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState(false);
  
  // Item search states
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);

  // Shipping management state
  const [sendingToPacking, setSendingToPacking] = useState(false);
  const [shippingStatus, setShippingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [shippingMessage, setShippingMessage] = useState('');


  const fetchOrderDetails = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) {
        throw new Error('User company not found');
      }

      console.log('Attempting to fetch order with ID:', orderId, 'for company:', userData.company_id);

      // Fetch order with related data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers!customer_id (*),
          order_line_items!order_id (*),
          shipments!order_id (*)
        `)
        .eq('id', orderId)
        .eq('company_id', userData.company_id)
        .single();

      if (orderError) {
        throw new Error(`Failed to fetch order: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      console.log('Raw order data from Supabase:', orderData);
      console.log('Order line items:', orderData.order_line_items);
      console.log('Order total:', orderData.total);
      console.log('Order sub_total:', orderData.sub_total);
      console.log('Order status:', orderData.order_status);
      console.log('Shipments:', orderData.shipments);
      
      // Let's also try fetching line items directly
      console.log('Trying to fetch line items directly...');
      const { data: directLineItems, error: lineItemsError } = await supabase
        .from('order_line_items')
        .select('*')
        .eq('order_id', orderId);
      
      console.log('Direct line items query result:', directLineItems, 'Error:', lineItemsError);

      // Also try to fetch shipments directly since the relationship might not be working
      console.log('Trying to fetch shipments directly...');
      const { data: directShipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId);
      
      console.log('Direct shipments query result:', directShipments, 'Error:', shipmentsError);

      // Fetch invoices separately to avoid ambiguous relationship
      let invoicesData = [];
      try {
        const { data: invoices, error: invoicesError } = await supabase
          .from('invoices')
          .select('*')
          .eq('order_id', orderId);
        
        if (!invoicesError && invoices) {
          invoicesData = invoices;
          console.log('Found invoices:', invoicesData);
        }
      } catch (err) {
        console.log('Error fetching invoices:', err);
      }

      // Use direct line items if relationship query failed
      const lineItemsToUse = directLineItems && directLineItems.length > 0 
        ? directLineItems 
        : orderData.order_line_items || [];

      // Use direct shipments if relationship query failed
      const shipmentsToUse = directShipments && directShipments.length > 0
        ? directShipments
        : orderData.shipments || [];

      const orderWithData: Order = {
        ...orderData,
        customer_name: orderData.customers?.display_name,
        customer_trading_name: orderData.customers?.trading_name,
        line_items: lineItemsToUse,
        shipments: shipmentsToUse
      };

      console.log('Processed order data:', orderWithData);
      setOrder(orderWithData);

      // Set customer data
      if (orderData.customers) {
        console.log('Customer data:', orderData.customers);
        console.log('Customer coordinates:', orderData.customers.coordinates);
        console.log('Billing address 1:', orderData.customers.billing_address_1);
        console.log('Shipping address 1:', orderData.customers.shipping_address_1);
        console.log('Are addresses different?', orderData.customers.shipping_address_1 !== orderData.customers.billing_address_1);
        setCustomer(orderData.customers);
        
        // Set map center from customer coordinates
        if (orderData.customers.coordinates) {
          try {
            let coordinates = null;
            
            // Handle PostGIS point format: "(lat,lng)" or JSON format
            if (typeof orderData.customers.coordinates === 'string') {
              const coordStr = orderData.customers.coordinates;
              
              // Check if it's PostGIS point format (lng,lat)
              if (coordStr.startsWith('(') && coordStr.endsWith(')')) {
                const coordParts = coordStr.slice(1, -1).split(',');
                if (coordParts.length === 2) {
                  // Coordinates are in (longitude, latitude) format from PostGIS
                  coordinates = {
                    lat: parseFloat(coordParts[1]), // Second value is latitude
                    lng: parseFloat(coordParts[0])  // First value is longitude
                  };
                }
              } else {
                // Try parsing as JSON
                coordinates = JSON.parse(coordStr);
              }
            } else {
              coordinates = orderData.customers.coordinates;
            }
              
            console.log('Parsed coordinates:', coordinates);
            console.log('Coordinates type:', typeof coordinates);
            console.log('Has lat/lng?', coordinates?.lat, coordinates?.lng);
            
            if (coordinates && typeof coordinates === 'object' && coordinates.lat && coordinates.lng) {
              console.log('✅ Setting map center from customer coordinates:', coordinates);
              setMapCenter({ lat: coordinates.lat, lng: coordinates.lng });
              console.log('✅ Map center set to:', { lat: coordinates.lat, lng: coordinates.lng });
            } else if (coordinates && typeof coordinates === 'object' && coordinates.latitude && coordinates.longitude) {
              console.log('Setting map center from customer coordinates (latitude/longitude):', coordinates);
              setMapCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
            } else {
              console.log('Invalid coordinates format, falling back to geocoding');
              // Fallback to geocoding if coordinates are invalid
              const postcode = orderData.customers.shipping_postcode || orderData.customers.billing_postcode;
              if (postcode) {
                geocodePostcode(postcode);
              } else {
                console.log('No postcode available, using default UK location');
                setMapCenter({ lat: 51.5074, lng: -0.1278 }); // London default
              }
            }
          } catch (error) {
            console.error('Error parsing customer coordinates:', error);
            // Fallback to geocoding
            const postcode = orderData.customers.shipping_postcode || orderData.customers.billing_postcode;
            if (postcode) {
              geocodePostcode(postcode);
            } else {
              console.log('No postcode available, using default UK location');
              setMapCenter({ lat: 51.5074, lng: -0.1278 }); // London default
            }
          }
        } else {
          console.log('No coordinates found for customer, attempting geocoding');
          // Fallback to geocoding if no coordinates
          const postcode = orderData.customers.shipping_postcode || orderData.customers.billing_postcode;
          if (postcode) {
            geocodePostcode(postcode);
          } else {
            console.log('No postcode available either, using default UK location');
            setMapCenter({ lat: 51.5074, lng: -0.1278 }); // London default
          }
        }
      } else {
        console.log('No customer data found, using default UK location');
        setMapCenter({ lat: 51.5074, lng: -0.1278 }); // London default
      }

      // Set invoices data
      if (invoicesData && Array.isArray(invoicesData)) {
        setInvoices(invoicesData);
      }

      // Fetch courier information if shipment has courier_id
      console.log('Order shipments:', orderData.shipments);
      if (orderData.shipments && orderData.shipments.length > 0 && orderData.shipments[0].courier_id) {
        console.log('Fetching courier for ID:', orderData.shipments[0].courier_id);
        try {
          const { data: courier, error: courierError } = await supabase
            .from('couriers')
            .select('id, courier_name, courier_logo_url')
            .eq('id', orderData.shipments[0].courier_id)
            .single();
          
          console.log('Courier data:', courier, 'Error:', courierError);
          if (!courierError && courier) {
            setCourierInfo(courier);
          }
        } catch (courierErr) {
          console.error('Error fetching courier info:', courierErr);
        }
      } else {
        console.log('No shipments or courier_id found');
      }

    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const geocodePostcode = async (postcode: string) => {
    if (!postcode) {
      console.log('No postcode provided to geocodePostcode');
      return;
    }
    
    try {
      console.log('Making geocoding request for:', postcode);
      console.log('Using API key:', GOOGLE_MAPS_API_KEY ? 'Key exists' : 'No key');
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(postcode)},UK&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Geocoding API response:', data);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        console.log('Setting map center to:', location);
        setMapCenter({ lat: location.lat, lng: location.lng });
      } else {
        console.warn('Geocoding failed. Status:', data.status);
        console.warn('Error message:', data.error_message);
        console.warn('No results for postcode:', postcode);
        
        // Fallback to a default UK location (London)
        console.log('Using fallback location (London)');
        setMapCenter({ lat: 51.5074, lng: -0.1278 });
      }
    } catch (err) {
      console.error('Error geocoding postcode:', err);
      // Fallback to a default UK location (London)
      console.log('Using fallback location due to error');
      setMapCenter({ lat: 51.5074, lng: -0.1278 });
    }
  };

  const getCourierLogo = (carrier: string): string => {
    const carrierLower = carrier?.toLowerCase() || '';
    if (carrierLower.includes('ups')) return '/logos/ups.png';
    if (carrierLower.includes('royal mail')) return '/logos/royalmail.png';
    if (carrierLower.includes('dpd')) return '/logos/dpd.png';
    if (carrierLower.includes('dhl')) return '/logos/dhl.png';
    if (carrierLower.includes('fedex')) return '/logos/fedex.png';
    if (carrierLower.includes('tnt')) return '/logos/tnt.png';
    return '/logos/courier.png';
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { bg: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' };
      case 'confirmed':
        return { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
      case 'processing':
        return { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'shipped':
        return { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' };
      case 'delivered':
        return { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
      case 'cancelled':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' };
    }
  };

  const getOrderProgress = () => {
    const currentStatusIndex = orderStatusSteps.findIndex(step => step.key === order?.order_status?.toLowerCase());
    return currentStatusIndex >= 0 ? currentStatusIndex : 0;
  };

  const getFilteredLineItems = () => {
    if (!order?.line_items) return [];
    
    switch (activeTab) {
      case 'shipped':
        return order.line_items.filter(item => (item.quantity_shipped || 0) >= item.quantity);
      case 'partial':
        return order.line_items.filter(item => {
          const shipped = item.quantity_shipped || 0;
          return shipped > 0 && shipped < item.quantity;
        });
      case 'awaiting':
        return order.line_items.filter(item => (item.quantity_shipped || 0) === 0);
      default:
        return order.line_items;
    }
  };

  const getTotalsByTab = () => {
    if (!order?.line_items) return { all: 0, shipped: 0, partial: 0, awaiting: 0 };
    
    return {
      all: order.line_items.length,
      shipped: order.line_items.filter(item => (item.quantity_shipped || 0) >= item.quantity).length,
      partial: order.line_items.filter(item => {
        const shipped = item.quantity_shipped || 0;
        return shipped > 0 && shipped < item.quantity;
      }).length,
      awaiting: order.line_items.filter(item => (item.quantity_shipped || 0) === 0).length
    };
  };

  const handlePrintOrder = () => {
    window.print();
  };

  const handleCreateInvoice = () => {
    // TODO: Implement invoice creation
    console.log('Create invoice for order:', orderId);
  };

  const handleEditOrder = () => {
    if (order && customer) {
      setEditOrderData({
        notes: order.notes || '',
        order_status: order.order_status,
        order_date: order.order_date ? order.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
        shipping_status: order.shipments?.[0]?.shipment_status || 'pending',
        billing_address: {
          address_1: customer.billing_address_1 || '',
          address_2: customer.billing_address_2 || '',
          city_town: customer.billing_city_town || '',
          county: customer.billing_county || '',
          postcode: customer.billing_postcode || ''
        },
        shipping_address: {
          address_1: customer.shipping_address_1 || customer.billing_address_1 || '',
          address_2: customer.shipping_address_2 || customer.billing_address_2 || '',
          city_town: customer.shipping_city_town || customer.billing_city_town || '',
          county: customer.shipping_county || customer.billing_county || '',
          postcode: customer.shipping_postcode || customer.billing_postcode || ''
        },
        make_default_addresses: false,
        line_items: order.line_items.map(item => ({
          id: item.id,
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price.toString()),
          total_price: parseFloat(item.total_price.toString())
        })),
        new_items: [] // For adding new items
      });
      setShowEditModal(true);
    }
  };

  const handleBackToOrders = () => {
    navigate('/orders');
  };

  const searchItems = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setAvailableItems([]);
      return;
    }

    try {
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          sku,
          description,
          retail_price,
          cost_price,
          brands(brand_name)
        `)
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .eq('status', 'active')
        .limit(20);

      if (error) throw error;
      
      setAvailableItems(items || []);
    } catch (error) {
      console.error('Error searching items:', error);
      setAvailableItems([]);
    }
  };

  const addItemToOrder = (item: any) => {
    const newItem = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      item_id: item.id,
      item_name: item.name,
      quantity: 1,
      unit_price: parseFloat(item.cost_price || item.retail_price || 0),
      total_price: parseFloat(item.cost_price || item.retail_price || 0),
      is_new: true
    };

    setEditOrderData({
      ...editOrderData,
      line_items: [...editOrderData.line_items, newItem]
    });

    setItemSearchTerm('');
    setAvailableItems([]);
    setShowItemSearch(false);
  };

  const removeItemFromOrder = (itemIndex: number) => {
    const newItems = editOrderData.line_items.filter((_: any, index: number) => index !== itemIndex);
    setEditOrderData({
      ...editOrderData,
      line_items: newItems
    });
  };

  const handleSaveOrderEdit = async () => {
    if (!editOrderData || !order || !customer) return;
    
    setSavingOrder(true);
    
    try {
      // Update order in Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          notes: editOrderData.notes,
          order_status: editOrderData.order_status,
          order_date: editOrderData.order_date
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Update customer addresses if they changed and user wants to make them default
      if (editOrderData.make_default_addresses) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({
            billing_address_1: editOrderData.billing_address.address_1,
            billing_address_2: editOrderData.billing_address.address_2,
            billing_city_town: editOrderData.billing_address.city_town,
            billing_county: editOrderData.billing_address.county,
            billing_postcode: editOrderData.billing_address.postcode,
            shipping_address_1: editOrderData.shipping_address.address_1,
            shipping_address_2: editOrderData.shipping_address.address_2,
            shipping_city_town: editOrderData.shipping_address.city_town,
            shipping_county: editOrderData.shipping_address.county,
            shipping_postcode: editOrderData.shipping_address.postcode
          })
          .eq('id', customer.id);

        if (customerError) throw customerError;
      }

      // Update shipment status if it exists
      if (order.shipments && order.shipments.length > 0) {
        const { error: shipmentError } = await supabase
          .from('shipments')
          .update({
            shipment_status: editOrderData.shipping_status
          })
          .eq('id', order.shipments[0].id);

        if (shipmentError) console.warn('Failed to update shipment status:', shipmentError);
      }

      // Handle line item updates and additions
      for (const item of editOrderData.line_items) {
        if (item.is_new) {
          // Add new line item
          const { error: newItemError } = await supabase
            .from('order_line_items')
            .insert({
              order_id: order.id,
              item_id: item.item_id,
              item_name: item.item_name,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price
            });

          if (newItemError) throw newItemError;
        } else if (!item.id.toString().startsWith('new-')) {
          // Update existing line item
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
      }

      // Remove deleted items (items that were in original order but not in current line_items)
      const originalItemIds = order.line_items.map(item => item.id);
      const currentItemIds = editOrderData.line_items
        .filter((item: any) => !item.is_new)
        .map((item: any) => item.id);
      
      const deletedItemIds = originalItemIds.filter(id => !currentItemIds.includes(id));
      
      for (const deletedId of deletedItemIds) {
        const { error: deleteError } = await supabase
          .from('order_line_items')
          .delete()
          .eq('id', deletedId);

        if (deleteError) throw deleteError;
      }

      // Send update to Make.com webhook
      await sendOrderUpdateToWebhook('update', {
        ...editOrderData,
        addresses_updated: editOrderData.make_default_addresses,
        items_added: editOrderData.line_items.filter((item: any) => item.is_new).length,
        items_removed: deletedItemIds.length
      });

      // Refresh order data
      await fetchOrderDetails();
      
      setShowEditModal(false);
      setZohoSendStatus('success');
      setZohoSendMessage('Order updated successfully!');

      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error updating order:', error);
      setZohoSendStatus('error');
      setZohoSendMessage(error instanceof Error ? error.message : 'Failed to update order');

      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    setCancellingOrder(true);
    
    try {
      // Update order status to cancelled in Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          order_status: 'cancelled',
          notes: order.notes ? `${order.notes}\n\nCANCELLED: ${cancelReason}` : `CANCELLED: ${cancelReason}`
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Send cancellation to Make.com webhook
      await sendOrderUpdateToWebhook('cancel', { 
        reason: cancelReason,
        cancelled_at: new Date().toISOString()
      });

      // Refresh order data
      await fetchOrderDetails();
      
      setShowCancelModal(false);
      setCancelReason('');
      setZohoSendStatus('success');
      setZohoSendMessage('Order cancelled successfully!');

      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error cancelling order:', error);
      setZohoSendStatus('error');
      setZohoSendMessage(error instanceof Error ? error.message : 'Failed to cancel order');

      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);
    } finally {
      setCancellingOrder(false);
    }
  };

  const sendOrderUpdateToWebhook = async (updateType: 'update' | 'cancel', updateData: any) => {
    try {
      const webhookData = {
        action: 'update_order',
        update_type: updateType,
        supabase_order_id: order?.id,
        order_number: order?.legacy_order_number || order?.id,
        customer_data: customer,
        order_data: order,
        update_data: updateData,
        timestamp: new Date().toISOString(),
        source: 'view_order_page'
      };

      console.log('Sending order update to webhook:', webhookData);

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
        const textResult = await response.text();
        console.log('Order update webhook returned plain text:', textResult);
        result = { success: true, message: textResult };
      }
      
      console.log('Order update webhook response:', result);
      
    } catch (error) {
      console.error('Error sending order update to webhook:', error);
      // Don't throw - we don't want webhook failures to break the UI update
    }
  };

  const handleSendToZoho = async () => {
    if (!order || !customer) {
      setZohoSendMessage('Missing order or customer data');
      setZohoSendStatus('error');
      return;
    }

    setSendingToZoho(true);
    setZohoSendStatus('sending');
    setZohoSendMessage('Preparing order for Zoho...');

    try {
      // Get items data with legacy_item_id
      const itemsWithDetails = await Promise.all(
        order.line_items.map(async (item) => {
          // Fetch item details including legacy_item_id and manufacturer
          const { data: itemData } = await supabase
            .from('items')
            .select('legacy_item_id, manufacturer')
            .eq('id', item.item_id)
            .single();

          return {
            ...item,
            legacy_item_id: itemData?.legacy_item_id,
            brand_name: itemData?.manufacturer || 'Unknown'
          };
        })
      );

      // Create webhook payload similar to OrderSummary
      const webhookPayload = {
        salesorder_number: order.legacy_order_number || `SO-${order.id}`,
        date: new Date(order.order_date || order.created_at).toISOString().split('T')[0],
        
        customer: {
          supabase_id: customer.id,
          customer_id: customer.fb_customer_id || customer.id,
          name: customer.display_name || customer.trading_name,
          email: customer.email,
          company: customer.trading_name || customer.display_name
        },
        
        // Line items with legacy_item_id
        line_items: itemsWithDetails.map((item) => ({
          item_id: item.legacy_item_id || item.item_id,
          sku: item.sku || 'N/A',
          name: item.item_name,
          quantity: item.quantity,
          rate: parseFloat(item.unit_price?.toString() || '0'),
          amount: parseFloat(item.total_price?.toString() || '0'),
          brand: item.brand_name || 'Unknown'
        })),
        
        // Totals
        subtotal: order.sub_total || 0,
        vat_amount: Math.max(0, (order.total || 0) - (order.sub_total || 0)),
        total: order.total || 0,
        
        // Additional info
        notes: order.notes || `Order resent to Zoho via web app`,
        created_by: 'Web Order - Resend',
        created_at: new Date().toISOString(),
        original_order_date: order.order_date || order.created_at
      };

      setZohoSendMessage('Sending to Zoho webhook...');

      // Send to Make.com webhook
      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      setZohoSendStatus('success');
      setZohoSendMessage('Order successfully sent to Zoho!');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);

    } catch (error) {
      console.error('Error sending to Zoho:', error);
      setZohoSendStatus('error');
      setZohoSendMessage(error instanceof Error ? error.message : 'Failed to send to Zoho');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setZohoSendStatus('idle');
        setZohoSendMessage('');
      }, 5000);
    } finally {
      setSendingToZoho(false);
    }
  };

  // Handle sending order to packing
  const handleSendToPacking = async () => {
    if (!order) return;

    setSendingToPacking(true);
    setShippingStatus('sending');
    setShippingMessage('Sending order to packing...');

    try {
      const result = await shippingService.sendOrderToPacking(order.id);
      
      if (result.success) {
        setShippingStatus('success');
        setShippingMessage(result.message);
        
        // Refresh order data to get updated warehouse status
        await fetchOrderDetails();
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setShippingStatus('idle');
          setShippingMessage('');
        }, 5000);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error sending order to packing:', error);
      setShippingStatus('error');
      setShippingMessage(error instanceof Error ? error.message : 'Failed to send order to packing');
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setShippingStatus('idle');
        setShippingMessage('');
      }, 5000);
    } finally {
      setSendingToPacking(false);
    }
  };

  // Don't show local loading - the global ProgressLoader handles this
  if (loading) {
    return null;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <HelpCircle size={48} color="#ef4444" />
          <h2>Error Loading Order</h2>
          <p>{error}</p>
          <div className={styles.errorActions}>
            <button onClick={fetchOrderDetails} className={styles.retryButton}>
              Retry
            </button>
            <button onClick={handleBackToOrders} className={styles.backButton}>
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <Package size={48} color="#9ca3af" />
          <h2>Order Not Found</h2>
          <p>The requested order could not be found.</p>
          <button onClick={handleBackToOrders} className={styles.backButton}>
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusBadgeClass(order.order_status);
  const progress = getOrderProgress();
  const tabTotals = getTotalsByTab();
  const filteredItems = getFilteredLineItems();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button onClick={handleBackToOrders} className={styles.backButton}>
            <ChevronDown size={16} /> Back to Orders
          </button>
          <div className={styles.orderTitle}>
            <h1>Order {order.legacy_order_number || 'N/A'}</h1>
            <span 
              className={styles.statusBadge}
              style={{ 
                background: statusStyle.bg,
                color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`
              }}
            >
              {order.order_status}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button onClick={handlePrintOrder} className={styles.actionButton}>
            <File size={16} /> Print
          </button>
          <button onClick={handleCreateInvoice} className={styles.actionButton}>
            <FileText size={16} /> Invoice
          </button>
          <button 
            onClick={handleSendToZoho} 
            className={styles.actionButton}
            disabled={sendingToZoho}
          >
            <Send size={16} /> 
            {sendingToZoho ? 'Sending...' : 'Send to Zoho'}
          </button>
          <button 
            onClick={handleSendToPacking} 
            className={styles.actionButton}
            disabled={sendingToPacking}
          >
            <Package size={16} /> 
            {sendingToPacking ? 'Sending...' : 'Send to Packing'}
          </button>
          <button onClick={handleEditOrder} className={styles.primaryButton}>
            <Settings size={16} /> Edit Order
          </button>
        </div>
      </div>

      {/* Zoho Send Status Message */}
      {zohoSendMessage && (
        <div className={`${styles.notification} ${styles[zohoSendStatus]}`}>
          {zohoSendStatus === 'sending' && <div className={styles.spinner} />}
          {zohoSendStatus === 'success' && <CheckCircle size={20} />}
          {zohoSendStatus === 'error' && <HelpCircle size={20} />}
          <span>{zohoSendMessage}</span>
        </div>
      )}

      {/* Shipping Status Message */}
      {shippingMessage && (
        <div className={`${styles.notification} ${styles[shippingStatus]}`}>
          {shippingStatus === 'sending' && <div className={styles.spinner} />}
          {shippingStatus === 'success' && <CheckCircle size={20} />}
          {shippingStatus === 'error' && <HelpCircle size={20} />}
          <span>{shippingMessage}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Order Overview */}
          <div className={styles.card}>
            <h3>Order Information</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <Calendar className={styles.infoIcon} size={20} />
                <div>
                  <label>Order Date</label>
                  <span>{formatDate(order.order_date || order.created_at)}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <User className={styles.infoIcon} size={20} />
                <div>
                  <label>Customer</label>
                  <span>{order.customer_name || 'Unknown Customer'}</span>
                </div>
              </div>
              <div className={styles.infoItem}>
                <ShoppingCart className={styles.infoIcon} size={20} />
                <div>
                  <label>Shipping Status</label>
                  <span>{order.shipments?.[0]?.shipment_status || order.order_status || 'Pending'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          {customer && (
            <div className={styles.card}>
              <h3>Customer Details</h3>
              
              {/* Google Maps - Dynamic Coordinates */}
              {mapCenter && (
                <div className={styles.mapContainer} style={{ marginBottom: '1rem' }}>
                  <iframe
                    title="Customer Location Map"
                    width="100%"
                    height="300"
                    frameBorder="0"
                    style={{ border: 0, borderRadius: '8px' }}
                    src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${mapCenter.lat},${mapCenter.lng}&zoom=15`}
                    allowFullScreen
                  />
                </div>
              )}
              
              <div className={styles.customerInfo}>
                <div className={styles.customerHeader}>
                  <h4>{customer.display_name}</h4>
                  {customer.trading_name && (
                    <p className={styles.tradingName}>{customer.trading_name}</p>
                  )}
                </div>
                
                <div className={styles.contactInfo}>
                  {customer.email && (
                    <div className={styles.contactItem}>
                      <Mail size={16} />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className={styles.contactItem}>
                      <User size={16} />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                </div>

                <div className={styles.addressSection}>
                  <h5>Billing Address</h5>
                  <div className={styles.address}>
                    <Home size={16} />
                    <div>
                      {customer.billing_address_1}<br />
                      {customer.billing_address_2 && <>{customer.billing_address_2}<br /></>}
                      {customer.billing_city_town} {customer.billing_postcode}<br />
                      {customer.billing_county}
                    </div>
                  </div>
                </div>

                <div className={styles.addressSection}>
                  <h5>Shipping Address</h5>
                  <div className={styles.address}>
                    <MapPin size={16} />
                    <div>
                      {customer.shipping_address_1 ? (
                        <>
                          {customer.shipping_address_1}<br />
                          {customer.shipping_address_2 && <>{customer.shipping_address_2}<br /></>}
                          {customer.shipping_city_town} {customer.shipping_postcode}<br />
                          {customer.shipping_county}
                        </>
                      ) : (
                        <>
                          <em>Same as billing address:</em><br />
                          {customer.billing_address_1}<br />
                          {customer.billing_address_2 && <>{customer.billing_address_2}<br /></>}
                          {customer.billing_city_town} {customer.billing_postcode}<br />
                          {customer.billing_county}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shipment Details */}
          {order.shipments && order.shipments.length > 0 && (
            <div className={styles.card}>
              <h3>Shipment Information</h3>
              <div className={styles.shipmentInfo}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <Truck className={styles.infoIcon} size={20} />
                    <div>
                      <label>Status</label>
                      <span>{order.shipments[0].shipment_status}</span>
                    </div>
                  </div>
                  {order.shipments[0].order_tracking_number && (
                    <div className={styles.infoItem}>
                      <Route className={styles.infoIcon} size={20} />
                      <div>
                        <label>Tracking Number</label>
                        <span>{order.shipments[0].order_tracking_number}</span>
                      </div>
                    </div>
                  )}
                  {order.shipments[0].date_shipped && (
                    <div className={styles.infoItem}>
                      <Clock className={styles.infoIcon} size={20} />
                      <div>
                        <label>Date Shipped</label>
                        <span>{formatDateTime(order.shipments[0].date_shipped)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Package Information */}
          {customer && (
            <div className={styles.card}>
              <h3>Package Information</h3>
              {!order.shipments || order.shipments.length === 0 ? (
                <div style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>
                  No shipment data available for this order.
                </div>
              ) : (
              <div className={styles.packageInfo}>
                <div className={styles.packageHeader}>
                  <div className={styles.packageDetails}>
                    <div className={styles.trackingInfo}>
                      <span className={styles.label}>Courier</span>
                      <span className={styles.value}>{courierInfo?.courier_name || 'Unknown'}</span>
                    </div>
                    <div className={styles.trackingInfo}>
                      <span className={styles.label}>Tracking</span>
                      <span className={styles.value}>{order.shipments[0].order_tracking_number || 'N/A'}</span>
                    </div>
                    <div className={styles.trackingInfo}>
                      <span className={styles.label}>Boxes</span>
                      <span className={styles.value}>{order.shipments[0]?.number_of_boxes || 1}</span>
                    </div>
                  </div>
                  {courierInfo?.courier_name && (
                    <div className={styles.courierLogo}>
                      <img 
                        src={courierInfo.courier_logo_url || getCourierLogo(courierInfo.courier_name)} 
                        alt={courierInfo.courier_name}
                        style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getCourierLogo('default');
                        }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Always show shipping details and map section */}
                <div>
                  <h4>Shipping Details</h4>
                  {customer.shipping_address_1 ? (
                    <div className={styles.address}>
                      <MapPin size={16} />
                      <div>
                        <strong>{customer.display_name}</strong><br />
                        {customer.shipping_address_1}<br />
                        {customer.shipping_address_2 && <>{customer.shipping_address_2}<br /></>}
                        {customer.shipping_city_town} {customer.shipping_postcode}<br />
                        {customer.shipping_county}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>
                      No shipping address available. Using billing address for map.
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          )}

          {/* Invoices */}
          {invoices.length > 0 && (
            <div className={styles.card}>
              <h3>Invoices ({invoices.length})</h3>
              <div className={styles.invoicesList}>
                {invoices.map((invoice) => {
                  const invoiceStatusStyle = getStatusBadgeClass(invoice.invoice_status);
                  return (
                    <div key={invoice.id} className={styles.invoiceItem}>
                      <div className={styles.invoiceInfo}>
                        <div className={styles.invoiceHeader}>
                          <span className={styles.invoiceDate}>
                            {formatDate(invoice.invoice_date)}
                          </span>
                          <span 
                            className={styles.statusBadge}
                            style={{
                              background: invoiceStatusStyle.bg,
                              color: invoiceStatusStyle.color,
                              border: `1px solid ${invoiceStatusStyle.border}`
                            }}
                          >
                            {invoice.invoice_status}
                          </span>
                        </div>
                        <div className={styles.invoiceDetails}>
                          <span>Total: {formatCurrency(invoice.total)}</span>
                          <span>Balance: {formatCurrency(invoice.balance)}</span>
                        </div>
                      </div>
                      <button className={styles.viewButton}>
                        <Eye size={16} /> View
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Line Items */}
        <div className={styles.rightColumn}>
          {/* Order Progress - Above Order Items */}
          <div className={styles.progressContainer}>
            <div className={styles.progressStepsNew}>
              {orderStatusSteps.map((step, index) => {
                const isCompleted = index < progress;
                const isCurrent = index === progress;
                
                return (
                  <div key={step.key} className={styles.progressStepNew}>
                    <div className={`${styles.stepCircle} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}>
                      {isCompleted ? (
                        <span className={styles.stepNumber}>✓</span>
                      ) : (
                        <span className={styles.stepNumber}>{index + 1}</span>
                      )}
                    </div>
                    <div className={styles.stepLabelNew}>{step.label}</div>
                  </div>
                );
              })}
            </div>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${(progress / (orderStatusSteps.length - 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.lineItemsHeader}>
              <h3>Order Items</h3>
              <div className={styles.totalSummary}>
                <span>Total: {formatCurrency(order.total || 0)}</span>
              </div>
            </div>

            {/* Tab Filters */}
            <div className={styles.tabFilters}>
              <button 
                className={`${styles.tabButton} ${activeTab === 'all' ? styles.active : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Items ({tabTotals.all})
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'shipped' ? styles.active : ''}`}
                onClick={() => setActiveTab('shipped')}
              >
                Shipped ({tabTotals.shipped})
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'partial' ? styles.active : ''}`}
                onClick={() => setActiveTab('partial')}
              >
                Partial ({tabTotals.partial})
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'awaiting' ? styles.active : ''}`}
                onClick={() => setActiveTab('awaiting')}
              >
                Awaiting ({tabTotals.awaiting})
              </button>
            </div>

            {/* Line Items Table */}
            <div className={styles.lineItemsTable}>
              <div className={styles.tableHeader}>
                <div>Item</div>
                <div>SKU</div>
                <div>Qty</div>
                <div>Unit Price</div>
                <div>Total</div>
                <div>Shipped</div>
                <div>Status</div>
              </div>
              
              <div className={styles.tableBody}>
                {filteredItems.map((item) => {
                  const shipped = item.quantity_shipped || 0;
                  const isFullyShipped = shipped >= item.quantity;
                  const isPartiallyShipped = shipped > 0 && shipped < item.quantity;
                  
                  return (
                    <div key={item.id} className={styles.tableRow}>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>{item.item_name}</div>
                        {item.brand_name && (
                          <div className={styles.brandName}>{item.brand_name}</div>
                        )}
                      </div>
                      <div className={styles.sku}>
                        <code>{item.sku || item.item_id?.substr(0, 8) || 'N/A'}</code>
                      </div>
                      <div className={styles.quantity}>{item.quantity}</div>
                      <div className={styles.unitPrice}>{formatCurrency(parseFloat(item.unit_price?.toString() || '0'))}</div>
                      <div className={styles.totalPrice}>{formatCurrency(parseFloat(item.total_price?.toString() || '0'))}</div>
                      <div className={styles.shipped}>
                        {shipped} / {item.quantity}
                      </div>
                      <div className={styles.itemStatus}>
                        {isFullyShipped ? (
                          <span className={styles.statusShipped}>
                            <CheckCircle size={16} /> Shipped
                          </span>
                        ) : isPartiallyShipped ? (
                          <span className={styles.statusPartial}>
                            <Clock size={16} /> Partial
                          </span>
                        ) : (
                          <span className={styles.statusPending}>
                            <Package size={16} /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className={styles.emptyState}>
                  <Package size={48} />
                  <p>No items match the current filter</p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className={styles.orderSummary}>
              <div className={styles.summaryRow}>
                <span>Subtotal:</span>
                <span>{formatCurrency(order.sub_total || 0)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Tax:</span>
                <span>{formatCurrency(Math.max(0, (order.total || 0) - (order.sub_total || 0)))}</span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Total:</span>
                <span>{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Notes */}
      {order.notes && (
        <div className={styles.card}>
          <h3>Order Notes</h3>
          <div className={styles.notes}>
            <p>{order.notes}</p>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {showEditModal && editOrderData && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Edit Order</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowEditModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {/* Order Status and Date */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="orderStatus">Order Status</label>
                  <select
                    id="orderStatus"
                    value={editOrderData.order_status}
                    onChange={(e) => setEditOrderData({
                      ...editOrderData,
                      order_status: e.target.value
                    })}
                    className={styles.formSelect}
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
                  <label htmlFor="shippingStatus">Shipping Status</label>
                  <select
                    id="shippingStatus"
                    value={editOrderData.shipping_status}
                    onChange={(e) => setEditOrderData({
                      ...editOrderData,
                      shipping_status: e.target.value
                    })}
                    className={styles.formSelect}
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="orderDate">Order Date</label>
                  <input
                    type="date"
                    id="orderDate"
                    value={editOrderData.order_date}
                    onChange={(e) => setEditOrderData({
                      ...editOrderData,
                      order_date: e.target.value
                    })}
                    className={styles.formInput}
                  />
                </div>
              </div>

              {/* Addresses Section */}
              <div className={styles.addressSection}>
                <h3>Addresses</h3>
                
                <div className={styles.addressRow}>
                  {/* Billing Address */}
                  <div className={styles.addressColumn}>
                    <h4>Billing Address</h4>
                    <div className={styles.formGroup}>
                      <input
                        type="text"
                        placeholder="Address Line 1"
                        value={editOrderData.billing_address.address_1}
                        onChange={(e) => setEditOrderData({
                          ...editOrderData,
                          billing_address: {
                            ...editOrderData.billing_address,
                            address_1: e.target.value
                          }
                        })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <input
                        type="text"
                        placeholder="Address Line 2 (optional)"
                        value={editOrderData.billing_address.address_2}
                        onChange={(e) => setEditOrderData({
                          ...editOrderData,
                          billing_address: {
                            ...editOrderData.billing_address,
                            address_2: e.target.value
                          }
                        })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="City/Town"
                          value={editOrderData.billing_address.city_town}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            billing_address: {
                              ...editOrderData.billing_address,
                              city_town: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="County"
                          value={editOrderData.billing_address.county}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            billing_address: {
                              ...editOrderData.billing_address,
                              county: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={editOrderData.billing_address.postcode}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            billing_address: {
                              ...editOrderData.billing_address,
                              postcode: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className={styles.addressColumn}>
                    <div className={styles.addressHeader}>
                      <h4>Shipping Address</h4>
                      <button
                        type="button"
                        onClick={() => setEditOrderData({
                          ...editOrderData,
                          shipping_address: { ...editOrderData.billing_address }
                        })}
                        className={styles.copyAddressBtn}
                      >
                        <Copy size={14} /> Copy Billing
                      </button>
                    </div>
                    <div className={styles.formGroup}>
                      <input
                        type="text"
                        placeholder="Address Line 1"
                        value={editOrderData.shipping_address.address_1}
                        onChange={(e) => setEditOrderData({
                          ...editOrderData,
                          shipping_address: {
                            ...editOrderData.shipping_address,
                            address_1: e.target.value
                          }
                        })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <input
                        type="text"
                        placeholder="Address Line 2 (optional)"
                        value={editOrderData.shipping_address.address_2}
                        onChange={(e) => setEditOrderData({
                          ...editOrderData,
                          shipping_address: {
                            ...editOrderData.shipping_address,
                            address_2: e.target.value
                          }
                        })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="City/Town"
                          value={editOrderData.shipping_address.city_town}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            shipping_address: {
                              ...editOrderData.shipping_address,
                              city_town: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="County"
                          value={editOrderData.shipping_address.county}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            shipping_address: {
                              ...editOrderData.shipping_address,
                              county: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <input
                          type="text"
                          placeholder="Postcode"
                          value={editOrderData.shipping_address.postcode}
                          onChange={(e) => setEditOrderData({
                            ...editOrderData,
                            shipping_address: {
                              ...editOrderData.shipping_address,
                              postcode: e.target.value
                            }
                          })}
                          className={styles.formInput}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Make Default Checkbox */}
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={editOrderData.make_default_addresses}
                      onChange={(e) => setEditOrderData({
                        ...editOrderData,
                        make_default_addresses: e.target.checked
                      })}
                      className={styles.formCheckbox}
                    />
                    <span>Update customer's default addresses with these changes</span>
                  </label>
                </div>
              </div>

              {/* Line Items Section */}
              <div className={styles.itemsSection}>
                <div className={styles.itemsHeader}>
                  <h3>Line Items</h3>
                  <button
                    type="button"
                    onClick={() => setShowItemSearch(true)}
                    className={styles.addItemBtn}
                  >
                    <Plus size={16} /> Add Item
                  </button>
                </div>

                {/* Item Search */}
                {showItemSearch && (
                  <div className={styles.itemSearch}>
                    <div className={styles.searchInput}>
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder="Search items by name, SKU, or description..."
                        value={itemSearchTerm}
                        onChange={(e) => {
                          setItemSearchTerm(e.target.value);
                          searchItems(e.target.value);
                        }}
                        className={styles.formInput}
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          setShowItemSearch(false);
                          setItemSearchTerm('');
                          setAvailableItems([]);
                        }}
                        className={styles.closeSearchBtn}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {availableItems.length > 0 && (
                      <div className={styles.searchResults}>
                        {availableItems.map((item) => (
                          <div
                            key={item.id}
                            className={styles.searchResultItem}
                            onClick={() => addItemToOrder(item)}
                          >
                            <div className={styles.itemName}>{item.name}</div>
                            <div className={styles.itemDetails}>
                              <span className={styles.sku}>{item.sku}</span>
                              <span className={styles.brand}>{item.brands?.brand_name}</span>
                              <span className={styles.price}>{formatCurrency(item.cost_price || item.retail_price || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.lineItemsEdit}>
                  {editOrderData.line_items.map((item: any, index: number) => (
                    <div key={item.id} className={styles.lineItemRow}>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>
                          {item.item_name}
                          {item.is_new && <span className={styles.newBadge}>NEW</span>}
                        </div>
                      </div>
                      <div className={styles.quantityEdit}>
                        <label>Qty:</label>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...editOrderData.line_items];
                            const qty = parseInt(e.target.value) || 0;
                            newItems[index].quantity = qty;
                            newItems[index].total_price = qty * newItems[index].unit_price;
                            setEditOrderData({
                              ...editOrderData,
                              line_items: newItems
                            });
                          }}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.priceEdit}>
                        <label>Unit Price:</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => {
                            const newItems = [...editOrderData.line_items];
                            const price = parseFloat(e.target.value) || 0;
                            newItems[index].unit_price = price;
                            newItems[index].total_price = newItems[index].quantity * price;
                            setEditOrderData({
                              ...editOrderData,
                              line_items: newItems
                            });
                          }}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.totalPrice}>
                        Total: {formatCurrency(item.total_price)}
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          type="button"
                          onClick={() => removeItemFromOrder(index)}
                          className={styles.removeItemBtn}
                          title="Remove item"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {editOrderData.line_items.length === 0 && (
                    <div className={styles.emptyItems}>
                      <p>No items in this order. Add items using the button above.</p>
                    </div>
                  )}
                </div>

                {/* Order Total */}
                <div className={styles.orderTotal}>
                  <strong>
                    Order Total: {formatCurrency(
                      editOrderData.line_items.reduce((sum: number, item: any) => sum + item.total_price, 0)
                    )}
                  </strong>
                </div>
              </div>

              {/* Order Notes */}
              <div className={styles.formGroup}>
                <label htmlFor="orderNotes">Order Notes</label>
                <textarea
                  id="orderNotes"
                  value={editOrderData.notes}
                  onChange={(e) => setEditOrderData({
                    ...editOrderData,
                    notes: e.target.value
                  })}
                  className={styles.formTextarea}
                  rows={4}
                  placeholder="Add any notes about this order..."
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowCancelModal(true)}
              >
                <AlertTriangle size={16} /> Cancel Order
              </button>
              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowEditModal(false)}
                  disabled={savingOrder}
                >
                  Close
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleSaveOrderEdit}
                  disabled={savingOrder}
                >
                  <Save size={16} />
                  {savingOrder ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Cancel Order</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowCancelModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.warningMessage}>
                <AlertTriangle size={20} />
                <p>Are you sure you want to cancel this order? This action cannot be undone.</p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="cancelReason">Reason for cancellation (optional)</label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Please provide a reason for cancelling this order..."
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancellingOrder}
                >
                  Keep Order
                </button>
                <button
                  className={styles.dangerButton}
                  onClick={handleCancelOrder}
                  disabled={cancellingOrder}
                >
                  <AlertTriangle size={16} />
                  {cancellingOrder ? 'Cancelling...' : 'Cancel Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withLoader(ViewOrder, { customMessage: 'Loading order details...' });