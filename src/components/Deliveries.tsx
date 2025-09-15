import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { Truck, Search, Filter, Eye, CheckCircle, Clock, MapPin, Calendar } from 'lucide-react';
import styles from './Deliveries.module.css';

interface Delivery {
  id: string;
  order_id: string;
  customer_id: string;
  courier_id: string;
  tracking_number?: string;
  shipping_status: 'processing' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  shipped_date?: string;
  estimated_delivery_date?: string;
  delivered_date?: string;
  delivery_address: {
    line1: string;
    line2?: string;
    city: string;
    postal_code: string;
    country: string;
  };
  shipping_notes?: string;
  created_at: string;
  updated_at: string;
  
  // Related data
  customers?: {
    display_name: string;
    trading_name?: string;
  };
  orders?: {
    legacy_order_number?: string;
    total: number;
  };
  couriers?: {
    name: string;
    logo_url?: string;
  };
}

type FilterStatus = 'all' | 'processing' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
type SortField = 'created_at' | 'shipped_date' | 'delivered_date' | 'customer_name';
type SortDirection = 'asc' | 'desc';

const Deliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadDeliveries();
  }, []);

  useEffect(() => {
    filterAndSortDeliveries();
  }, [deliveries, searchTerm, statusFilter, sortField, sortDirection]);

  const getCompanyId = async (): Promise<string | null> => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', authUser.id)
        .single();

      return userData?.company_id || null;
    } catch (error) {
      console.error('Error getting company ID:', error);
      return null;
    }
  };

  const loadDeliveries = async () => {
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          customers!inner(display_name, trading_name),
          orders!inner(legacy_order_number, total),
          couriers(name, logo_url)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDeliveries(data || []);
    } catch (error) {
      console.error('Error loading deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortDeliveries = () => {
    let filtered = [...deliveries];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(delivery => {
        const customerName = delivery.customers?.display_name || delivery.customers?.trading_name || '';
        const orderNumber = delivery.orders?.legacy_order_number || '';
        const trackingNumber = delivery.tracking_number || '';
        
        return (
          customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trackingNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(delivery => delivery.shipping_status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'customer_name':
          aValue = a.customers?.display_name || a.customers?.trading_name || '';
          bValue = b.customers?.display_name || b.customers?.trading_name || '';
          break;
        case 'shipped_date':
          aValue = a.shipped_date || '';
          bValue = b.shipped_date || '';
          break;
        case 'delivered_date':
          aValue = a.delivered_date || '';
          bValue = b.delivered_date || '';
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredDeliveries(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return '#fbbf24';
      case 'shipped':
      case 'in_transit':
        return '#3b82f6';
      case 'out_for_delivery':
        return '#f59e0b';
      case 'delivered':
        return '#10b981';
      case 'failed':
      case 'returned':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'in_transit':
        return 'In Transit';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'failed':
        return 'Failed';
      case 'returned':
        return 'Returned';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setShowModal(true);
  };

  const getDeliveryStats = () => {
    const stats = {
      total: deliveries.length,
      delivered: 0,
      in_transit: 0,
      processing: 0,
      failed: 0
    };

    deliveries.forEach(delivery => {
      switch (delivery.shipping_status) {
        case 'delivered':
          stats.delivered++;
          break;
        case 'shipped':
        case 'in_transit':
        case 'out_for_delivery':
          stats.in_transit++;
          break;
        case 'processing':
          stats.processing++;
          break;
        case 'failed':
        case 'returned':
          stats.failed++;
          break;
      }
    });

    return stats;
  };

  const stats = getDeliveryStats();

  if (loading) {
    return <div className={styles.loading}>Loading deliveries...</div>;
  }

  return (
    <div className={styles.deliveries}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Delivery Management</h1>
          <p>Track and manage all your shipments</p>
        </div>
        
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#10b981' }}>{stats.delivered}</span>
            <span className={styles.statLabel}>Delivered</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#3b82f6' }}>{stats.in_transit}</span>
            <span className={styles.statLabel}>In Transit</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#fbbf24' }}>{stats.processing}</span>
            <span className={styles.statLabel}>Processing</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#ef4444' }}>{stats.failed}</span>
            <span className={styles.statLabel}>Issues</span>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by customer, order number, or tracking number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className={styles.statusFilter}
          >
            <option value="all">All Statuses</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="returned">Returned</option>
          </select>

          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-');
              setSortField(field as SortField);
              setSortDirection(direction as SortDirection);
            }}
            className={styles.sortFilter}
          >
            <option value="created_at-desc">Newest First</option>
            <option value="created_at-asc">Oldest First</option>
            <option value="customer_name-asc">Customer A-Z</option>
            <option value="customer_name-desc">Customer Z-A</option>
            <option value="shipped_date-desc">Recently Shipped</option>
            <option value="delivered_date-desc">Recently Delivered</option>
          </select>
        </div>
      </div>

      <div className={styles.deliveriesTable}>
        <div className={styles.tableHeader}>
          <div className={styles.headerCell}>Customer</div>
          <div className={styles.headerCell}>Order</div>
          <div className={styles.headerCell}>Courier</div>
          <div className={styles.headerCell}>Status</div>
          <div className={styles.headerCell}>Shipped</div>
          <div className={styles.headerCell}>Delivered</div>
          <div className={styles.headerCell}>Actions</div>
        </div>

        <div className={styles.tableBody}>
          {filteredDeliveries.map((delivery) => {
            const customerName = delivery.customers?.display_name || delivery.customers?.trading_name || 'Unknown Customer';
            
            return (
              <div key={delivery.id} className={styles.tableRow}>
                <div className={styles.cell}>
                  <div className={styles.customerInfo}>
                    <span className={styles.customerName}>{customerName}</span>
                    <span className={styles.trackingNumber}>
                      {delivery.tracking_number ? `#${delivery.tracking_number}` : 'No tracking'}
                    </span>
                  </div>
                </div>

                <div className={styles.cell}>
                  <div className={styles.orderInfo}>
                    <span className={styles.orderNumber}>
                      {delivery.orders?.legacy_order_number || `#${delivery.order_id.slice(0, 8)}`}
                    </span>
                    <span className={styles.orderTotal}>
                      £{delivery.orders?.total?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>

                <div className={styles.cell}>
                  <div className={styles.courierInfo}>
                    {delivery.couriers?.logo_url ? (
                      <img 
                        src={delivery.couriers.logo_url} 
                        alt={delivery.couriers.name}
                        className={styles.courierLogo}
                      />
                    ) : (
                      <div className={styles.courierPlaceholder}>
                        <Truck />
                      </div>
                    )}
                    <span className={styles.courierName}>
                      {delivery.couriers?.name || 'Unknown Courier'}
                    </span>
                  </div>
                </div>

                <div className={styles.cell}>
                  <span 
                    className={styles.statusBadge}
                    style={{ backgroundColor: getStatusColor(delivery.shipping_status) }}
                  >
                    {getStatusLabel(delivery.shipping_status)}
                  </span>
                </div>

                <div className={styles.cell}>
                  <div className={styles.dateInfo}>
                    {delivery.shipping_status === 'delivered' ? (
                      <CheckCircle className={styles.deliveredIcon} />
                    ) : (
                      <Clock className={styles.pendingIcon} />
                    )}
                    <span>{formatDate(delivery.shipped_date)}</span>
                  </div>
                </div>

                <div className={styles.cell}>
                  <div className={styles.dateInfo}>
                    {delivery.delivered_date ? (
                      <>
                        <CheckCircle className={styles.deliveredIcon} />
                        <span>{formatDate(delivery.delivered_date)}</span>
                      </>
                    ) : delivery.estimated_delivery_date ? (
                      <>
                        <Calendar className={styles.estimatedIcon} />
                        <span>Est: {formatDate(delivery.estimated_delivery_date)}</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>

                <div className={styles.cell}>
                  <button
                    onClick={() => handleViewDetails(delivery)}
                    className={styles.actionBtn}
                  >
                    <Eye />
                    View
                  </button>
                </div>
              </div>
            );
          })}

          {filteredDeliveries.length === 0 && (
            <div className={styles.emptyState}>
              <Truck size={48} />
              <h3>No Deliveries Found</h3>
              <p>No deliveries match your current filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Details Modal */}
      {showModal && selectedDelivery && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Delivery Details</h2>
              <button onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.deliveryHeader}>
                <div className={styles.deliveryInfo}>
                  <h3>{selectedDelivery.customers?.display_name || selectedDelivery.customers?.trading_name}</h3>
                  <p>Order: {selectedDelivery.orders?.legacy_order_number || `#${selectedDelivery.order_id.slice(0, 8)}`}</p>
                  {selectedDelivery.tracking_number && (
                    <p>Tracking: <strong>{selectedDelivery.tracking_number}</strong></p>
                  )}
                </div>
                <div className={styles.courierSection}>
                  {selectedDelivery.couriers?.logo_url ? (
                    <img 
                      src={selectedDelivery.couriers.logo_url} 
                      alt={selectedDelivery.couriers.name}
                      className={styles.courierLogoLarge}
                    />
                  ) : (
                    <div className={styles.courierPlaceholderLarge}>
                      <Truck />
                    </div>
                  )}
                  <span>{selectedDelivery.couriers?.name || 'Unknown Courier'}</span>
                </div>
              </div>

              <div className={styles.statusSection}>
                <div className={styles.currentStatus}>
                  <span 
                    className={styles.statusBadgeLarge}
                    style={{ backgroundColor: getStatusColor(selectedDelivery.shipping_status) }}
                  >
                    {getStatusLabel(selectedDelivery.shipping_status)}
                  </span>
                </div>
              </div>

              <div className={styles.timeline}>
                <h4>Delivery Timeline</h4>
                <div className={styles.timelineItems}>
                  <div className={styles.timelineItem}>
                    <div className={styles.timelineMarker}>📦</div>
                    <div className={styles.timelineContent}>
                      <strong>Order Created</strong>
                      <span>{formatDate(selectedDelivery.created_at)}</span>
                    </div>
                  </div>
                  
                  {selectedDelivery.shipped_date && (
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineMarker}>🚚</div>
                      <div className={styles.timelineContent}>
                        <strong>Shipped</strong>
                        <span>{formatDate(selectedDelivery.shipped_date)}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedDelivery.delivered_date && (
                    <div className={styles.timelineItem}>
                      <div className={styles.timelineMarker}>✅</div>
                      <div className={styles.timelineContent}>
                        <strong>Delivered</strong>
                        <span>{formatDate(selectedDelivery.delivered_date)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.addressSection}>
                <h4><MapPin /> Delivery Address</h4>
                <div className={styles.address}>
                  <p>{selectedDelivery.delivery_address.line1}</p>
                  {selectedDelivery.delivery_address.line2 && <p>{selectedDelivery.delivery_address.line2}</p>}
                  <p>{selectedDelivery.delivery_address.city}</p>
                  <p>{selectedDelivery.delivery_address.postal_code}</p>
                  <p>{selectedDelivery.delivery_address.country}</p>
                </div>
              </div>

              {selectedDelivery.shipping_notes && (
                <div className={styles.notesSection}>
                  <h4>Notes</h4>
                  <p>{selectedDelivery.shipping_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deliveries;