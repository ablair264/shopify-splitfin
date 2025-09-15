import React, { useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseService';
import { shippingService, OrderWithShipping } from '../services/shippingService';
import { withLoader } from '../hoc/withLoader';
import { 
  Package, 
  CheckCircle, 
  Truck, 
  MapPin, 
  User, 
  Calendar, 
  DollarSign,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './Warehouse.module.css';

interface OrderCardProps {
  order: OrderWithShipping;
  onStatusUpdate: (orderId: string, newStatus: string) => void;
  isUpdating: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusUpdate, isUpdating }) => {
  const navigate = useNavigate();
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'sent_to_packing':
        return 'packed';
      case 'packed':
        return 'delivery_booked';
      case 'delivery_booked':
        return 'delivered';
      default:
        return null;
    }
  };

  const getActionText = (currentStatus: string) => {
    switch (currentStatus) {
      case 'sent_to_packing':
        return 'Mark as Packed';
      case 'packed':
        return 'Book Delivery';
      case 'delivery_booked':
        return 'Mark as Delivered';
      default:
        return null;
    }
  };

  const handleStatusUpdate = async () => {
    const nextStatus = getNextStatus(order.warehouse_status);
    if (!nextStatus) return;

    await onStatusUpdate(order.id, nextStatus);
  };

  const handleViewOrder = () => {
    navigate(`/orders/${order.id}`);
  };

  return (
    <div className={styles.orderCard}>
      <div className={styles.orderHeader}>
        <div className={styles.orderNumber}>
          {order.legacy_order_number || `#${order.id.slice(0, 8)}`}
        </div>
        <button 
          onClick={handleViewOrder}
          className={styles.viewButton}
          title="View Order Details"
        >
          <Eye size={16} />
        </button>
      </div>

      <div className={styles.customerInfo}>
        <User size={14} />
        <span>{order.customers?.display_name || order.customers?.trading_name || 'Unknown Customer'}</span>
      </div>

      <div className={styles.orderMeta}>
        <div className={styles.metaItem}>
          <Calendar size={14} />
          <span>{formatDate(order.order_date || order.created_at)}</span>
        </div>
        <div className={styles.metaItem}>
          <DollarSign size={14} />
          <span>{formatCurrency(order.total || 0)}</span>
        </div>
      </div>

      {order.warehouse_status !== 'delivered' && (
        <div className={styles.orderActions}>
          <button
            onClick={handleStatusUpdate}
            disabled={isUpdating}
            className={styles.actionButton}
          >
            {isUpdating ? (
              <>
                <RefreshCw size={14} className={styles.spinning} />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                {getActionText(order.warehouse_status)}
              </>
            )}
          </button>
        </div>
      )}

      {order.warehouse_status === 'delivered' && (
        <div className={styles.deliveredBadge}>
          <CheckCircle size={14} />
          Delivered
        </div>
      )}
    </div>
  );
};

const Warehouse: React.FC = () => {
  const [userData, setUserData] = useState<{ company_id: string } | null>(null);
  const [orders, setOrders] = useState<{
    pending: OrderWithShipping[];
    sentToPacking: OrderWithShipping[];
    packed: OrderWithShipping[];
    deliveryBooked: OrderWithShipping[];
    delivered: OrderWithShipping[];
  }>({
    pending: [],
    sentToPacking: [],
    packed: [],
    deliveryBooked: [],
    delivered: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .single();

        if (userData?.company_id) {
          setUserData(userData);
        } else {
          setError('No company ID found for user');
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        setError('Failed to load user data');
      } finally {
        if (!userData) {
          setLoading(false);
        }
      }
    };
    loadUserData();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!userData?.company_id) return;

    try {
      setError(null);
      const ordersData = await shippingService.getOrdersByWarehouseStatus(userData.company_id);
      setOrders(ordersData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching warehouse orders:', err);
      setError('Failed to fetch warehouse orders');
    } finally {
      setLoading(false);
    }
  }, [userData?.company_id]);

  useEffect(() => {
    if (userData?.company_id) {
      fetchOrders();
    }
  }, [fetchOrders, userData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrders(prev => new Set(Array.from(prev).concat(orderId)));

    try {
      let result;
      switch (newStatus) {
        case 'packed':
          result = await shippingService.markOrderAsPacked(orderId);
          break;
        case 'delivery_booked':
          result = await shippingService.bookDelivery(orderId);
          break;
        case 'delivered':
          result = await shippingService.markAsDelivered(orderId);
          break;
        default:
          throw new Error('Invalid status update');
      }

      if (result.success) {
        await fetchOrders(); // Refresh to get updated data
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Error updating order status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update order status');
      
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const getColumnStats = () => {
    const totalOrders = orders.sentToPacking.length + orders.packed.length + orders.deliveryBooked.length + orders.delivered.length;
    const allOrders = orders.sentToPacking
      .concat(orders.packed)
      .concat(orders.deliveryBooked)
      .concat(orders.delivered);
    const totalValue = allOrders.reduce((sum, order) => sum + (order.total || 0), 0);

    return { totalOrders, totalValue };
  };

  const { totalOrders, totalValue } = getColumnStats();

  if (loading) {
    return null; // Let the global loader handle this
  }

  return (
    <div className={styles.warehouseContainer}>
      <div className={styles.warehouseHeader}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <Package className={styles.titleIcon} size={28} />
            <div>
              <h1>Warehouse Management</h1>
              <p>Track orders through packing and delivery workflow</p>
            </div>
          </div>
          
          <div className={styles.headerStats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{totalOrders}</div>
              <div className={styles.statLabel}>Active Orders</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>
                {new Intl.NumberFormat('en-GB', {
                  style: 'currency',
                  currency: 'GBP',
                  maximumFractionDigits: 0
                }).format(totalValue)}
              </div>
              <div className={styles.statLabel}>Total Value</div>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.lastRefresh}>
            <Clock size={14} />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <button onClick={fetchOrders} className={styles.refreshButton} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.kanbanBoard}>
        {/* Sent to Packing Column */}
        <div className={styles.kanbanColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle}>
              <Package size={20} />
              <span>Sent to Packing</span>
            </div>
            <div className={styles.columnCount}>{orders.sentToPacking.length}</div>
          </div>
          <div className={styles.columnContent}>
            {orders.sentToPacking.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={updatingOrders.has(order.id)}
              />
            ))}
            {orders.sentToPacking.length === 0 && (
              <div className={styles.emptyState}>
                <Package size={32} />
                <p>No orders sent to packing</p>
              </div>
            )}
          </div>
        </div>

        {/* Packed Column */}
        <div className={styles.kanbanColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle}>
              <CheckCircle size={20} />
              <span>Packed</span>
            </div>
            <div className={styles.columnCount}>{orders.packed.length}</div>
          </div>
          <div className={styles.columnContent}>
            {orders.packed.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={updatingOrders.has(order.id)}
              />
            ))}
            {orders.packed.length === 0 && (
              <div className={styles.emptyState}>
                <CheckCircle size={32} />
                <p>No packed orders</p>
              </div>
            )}
          </div>
        </div>

        {/* Delivery Booked Column */}
        <div className={styles.kanbanColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle}>
              <Truck size={20} />
              <span>Delivery Booked</span>
            </div>
            <div className={styles.columnCount}>{orders.deliveryBooked.length}</div>
          </div>
          <div className={styles.columnContent}>
            {orders.deliveryBooked.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={updatingOrders.has(order.id)}
              />
            ))}
            {orders.deliveryBooked.length === 0 && (
              <div className={styles.emptyState}>
                <Truck size={32} />
                <p>No delivery bookings</p>
              </div>
            )}
          </div>
        </div>

        {/* Delivered Column */}
        <div className={styles.kanbanColumn}>
          <div className={styles.columnHeader}>
            <div className={styles.columnTitle}>
              <MapPin size={20} />
              <span>Delivered</span>
            </div>
            <div className={styles.columnCount}>{orders.delivered.length}</div>
          </div>
          <div className={styles.columnContent}>
            {orders.delivered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={updatingOrders.has(order.id)}
              />
            ))}
            {orders.delivered.length === 0 && (
              <div className={styles.emptyState}>
                <MapPin size={32} />
                <p>No delivered orders</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withLoader(Warehouse);