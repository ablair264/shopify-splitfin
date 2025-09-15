import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';
import { Truck, Edit2, Trash2, Plus, MapPin, TrendingUp, Clock } from 'lucide-react';
import styles from './Couriers.module.css';

interface Courier {
  id: string;
  name: string;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  service_types: string[];
  coverage_areas: string[];
  base_rate?: number;
  per_kg_rate?: number;
  express_rate?: number;
  tracking_enabled: boolean;
  api_integration_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CourierStats {
  total_shipments: number;
  delivered_shipments: number;
  pending_shipments: number;
  average_delivery_time: number;
  success_rate: number;
}

const Couriers: React.FC = () => {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [stats, setStats] = useState<Record<string, CourierStats>>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    service_types: [''],
    coverage_areas: [''],
    base_rate: '',
    per_kg_rate: '',
    express_rate: '',
    tracking_enabled: false,
    api_integration_enabled: false,
    is_active: true
  });

  useEffect(() => {
    loadCouriers();
  }, []);

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

  const loadCouriers = async () => {
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;

      setCouriers(data || []);
      
      // Load stats for each courier
      if (data) {
        const courierStats: Record<string, CourierStats> = {};
        for (const courier of data) {
          const stats = await loadCourierStats(courier.id);
          courierStats[courier.id] = stats;
        }
        setStats(courierStats);
      }
    } catch (error) {
      console.error('Error loading couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCourierStats = async (courierId: string): Promise<CourierStats> => {
    try {
      const companyId = await getCompanyId();
      if (!companyId) return getDefaultStats();

      // Get shipment statistics for this courier
      const { data: shipments, error } = await supabase
        .from('shipments')
        .select('shipping_status, shipped_date, delivered_date')
        .eq('courier_id', courierId)
        .eq('company_id', companyId);

      if (error) throw error;

      const total = shipments?.length || 0;
      const delivered = shipments?.filter(s => s.shipping_status === 'delivered').length || 0;
      const pending = shipments?.filter(s => ['processing', 'shipped', 'in_transit'].includes(s.shipping_status)).length || 0;

      // Calculate average delivery time
      const deliveredShipments = shipments?.filter(s => s.shipped_date && s.delivered_date) || [];
      const averageDeliveryTime = deliveredShipments.length > 0
        ? deliveredShipments.reduce((acc, shipment) => {
            const shipped = new Date(shipment.shipped_date);
            const delivered = new Date(shipment.delivered_date);
            return acc + (delivered.getTime() - shipped.getTime()) / (1000 * 60 * 60 * 24);
          }, 0) / deliveredShipments.length
        : 0;

      return {
        total_shipments: total,
        delivered_shipments: delivered,
        pending_shipments: pending,
        average_delivery_time: Math.round(averageDeliveryTime * 10) / 10,
        success_rate: total > 0 ? Math.round((delivered / total) * 100) : 0
      };
    } catch (error) {
      console.error('Error loading courier stats:', error);
      return getDefaultStats();
    }
  };

  const getDefaultStats = (): CourierStats => ({
    total_shipments: 0,
    delivered_shipments: 0,
    pending_shipments: 0,
    average_delivery_time: 0,
    success_rate: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      const courierData = {
        ...formData,
        company_id: companyId,
        service_types: formData.service_types.filter(type => type.trim()),
        coverage_areas: formData.coverage_areas.filter(area => area.trim()),
        base_rate: formData.base_rate ? parseFloat(formData.base_rate) : null,
        per_kg_rate: formData.per_kg_rate ? parseFloat(formData.per_kg_rate) : null,
        express_rate: formData.express_rate ? parseFloat(formData.express_rate) : null,
        updated_at: new Date().toISOString()
      };

      if (editingCourier) {
        const { error } = await supabase
          .from('couriers')
          .update(courierData)
          .eq('id', editingCourier.id);

        if (error) throw error;
      } else {
        const courierDataWithCreated = {
          ...courierData,
          created_at: new Date().toISOString()
        };
        const { error } = await supabase
          .from('couriers')
          .insert(courierDataWithCreated);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingCourier(null);
      resetForm();
      loadCouriers();
    } catch (error) {
      console.error('Error saving courier:', error);
    }
  };

  const handleEdit = (courier: Courier) => {
    setEditingCourier(courier);
    setFormData({
      name: courier.name,
      logo_url: courier.logo_url || '',
      contact_email: courier.contact_email || '',
      contact_phone: courier.contact_phone || '',
      website: courier.website || '',
      service_types: courier.service_types.length > 0 ? courier.service_types : [''],
      coverage_areas: courier.coverage_areas.length > 0 ? courier.coverage_areas : [''],
      base_rate: courier.base_rate?.toString() || '',
      per_kg_rate: courier.per_kg_rate?.toString() || '',
      express_rate: courier.express_rate?.toString() || '',
      tracking_enabled: courier.tracking_enabled,
      api_integration_enabled: courier.api_integration_enabled,
      is_active: courier.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this courier?')) return;

    try {
      const { error } = await supabase
        .from('couriers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadCouriers();
    } catch (error) {
      console.error('Error deleting courier:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      logo_url: '',
      contact_email: '',
      contact_phone: '',
      website: '',
      service_types: [''],
      coverage_areas: [''],
      base_rate: '',
      per_kg_rate: '',
      express_rate: '',
      tracking_enabled: false,
      api_integration_enabled: false,
      is_active: true
    });
  };

  const addServiceType = () => {
    setFormData(prev => ({
      ...prev,
      service_types: [...prev.service_types, '']
    }));
  };

  const addCoverageArea = () => {
    setFormData(prev => ({
      ...prev,
      coverage_areas: [...prev.coverage_areas, '']
    }));
  };

  const updateServiceType = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      service_types: prev.service_types.map((type, i) => i === index ? value : type)
    }));
  };

  const updateCoverageArea = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      coverage_areas: prev.coverage_areas.map((area, i) => i === index ? value : area)
    }));
  };

  const removeServiceType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      service_types: prev.service_types.filter((_, i) => i !== index)
    }));
  };

  const removeCoverageArea = (index: number) => {
    setFormData(prev => ({
      ...prev,
      coverage_areas: prev.coverage_areas.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return <div className={styles.loading}>Loading couriers...</div>;
  }

  return (
    <div className={styles.couriers}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Courier Management</h1>
          <p>Manage your shipping partners and their rates</p>
        </div>
        <button
          className={styles.addButton}
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus />
          Add New Courier
        </button>
      </div>

      <div className={styles.couriersGrid}>
        {couriers.map((courier) => {
          const courierStats = stats[courier.id] || getDefaultStats();
          
          return (
            <div key={courier.id} className={`${styles.courierCard} ${!courier.is_active ? styles.inactive : ''}`}>
              <div className={styles.courierHeader}>
                <div className={styles.courierInfo}>
                  {courier.logo_url ? (
                    <img src={courier.logo_url} alt={courier.name} className={styles.logo} />
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      <Truck />
                    </div>
                  )}
                  <div>
                    <h3>{courier.name}</h3>
                    <span className={`${styles.status} ${courier.is_active ? styles.active : styles.inactive}`}>
                      {courier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button onClick={() => handleEdit(courier)} className={styles.editBtn}>
                    <Edit2 />
                  </button>
                  <button onClick={() => handleDelete(courier.id)} className={styles.deleteBtn}>
                    <Trash2 />
                  </button>
                </div>
              </div>

              <div className={styles.courierDetails}>
                <div className={styles.contact}>
                  {courier.contact_email && <p>📧 {courier.contact_email}</p>}
                  {courier.contact_phone && <p>📞 {courier.contact_phone}</p>}
                  {courier.website && <p>🌐 {courier.website}</p>}
                </div>

                <div className={styles.services}>
                  <h4>Services</h4>
                  <div className={styles.tags}>
                    {courier.service_types.map((service, index) => (
                      <span key={index} className={styles.tag}>{service}</span>
                    ))}
                  </div>
                </div>

                <div className={styles.coverage}>
                  <h4><MapPin /> Coverage Areas</h4>
                  <div className={styles.tags}>
                    {courier.coverage_areas.map((area, index) => (
                      <span key={index} className={styles.tag}>{area}</span>
                    ))}
                  </div>
                </div>

                <div className={styles.rates}>
                  <h4>Rates</h4>
                  <div className={styles.rateGrid}>
                    {courier.base_rate && <span>Base: £{courier.base_rate}</span>}
                    {courier.per_kg_rate && <span>Per kg: £{courier.per_kg_rate}</span>}
                    {courier.express_rate && <span>Express: £{courier.express_rate}</span>}
                  </div>
                </div>

                <div className={styles.stats}>
                  <h4><TrendingUp /> Performance</h4>
                  <div className={styles.statGrid}>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{courierStats.total_shipments}</span>
                      <span className={styles.statLabel}>Total Shipments</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{courierStats.success_rate}%</span>
                      <span className={styles.statLabel}>Success Rate</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{courierStats.average_delivery_time}d</span>
                      <span className={styles.statLabel}>Avg Delivery</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statValue}>{courierStats.pending_shipments}</span>
                      <span className={styles.statLabel}>Pending</span>
                    </div>
                  </div>
                </div>

                <div className={styles.features}>
                  <div className={styles.feature}>
                    <span className={courier.tracking_enabled ? styles.enabled : styles.disabled}>
                      {courier.tracking_enabled ? '✓' : '✗'} Tracking
                    </span>
                  </div>
                  <div className={styles.feature}>
                    <span className={courier.api_integration_enabled ? styles.enabled : styles.disabled}>
                      {courier.api_integration_enabled ? '✓' : '✗'} API Integration
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {couriers.length === 0 && (
          <div className={styles.emptyState}>
            <Truck size={48} />
            <h3>No Couriers Added</h3>
            <p>Add your first courier to start managing shipments</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCourier ? 'Edit Courier' : 'Add New Courier'}</h2>
              <button onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Courier Name*</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Logo URL</label>
                  <input
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.formSection}>
                <h3>Service Types</h3>
                {formData.service_types.map((service, index) => (
                  <div key={index} className={styles.arrayInput}>
                    <input
                      type="text"
                      value={service}
                      onChange={(e) => updateServiceType(index, e.target.value)}
                      placeholder="e.g., Next Day, Standard, Express"
                    />
                    {formData.service_types.length > 1 && (
                      <button type="button" onClick={() => removeServiceType(index)}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addServiceType} className={styles.addArrayBtn}>
                  + Add Service Type
                </button>
              </div>

              <div className={styles.formSection}>
                <h3>Coverage Areas</h3>
                {formData.coverage_areas.map((area, index) => (
                  <div key={index} className={styles.arrayInput}>
                    <input
                      type="text"
                      value={area}
                      onChange={(e) => updateCoverageArea(index, e.target.value)}
                      placeholder="e.g., UK, Europe, Worldwide"
                    />
                    {formData.coverage_areas.length > 1 && (
                      <button type="button" onClick={() => removeCoverageArea(index)}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addCoverageArea} className={styles.addArrayBtn}>
                  + Add Coverage Area
                </button>
              </div>

              <div className={styles.formSection}>
                <h3>Rates</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Base Rate (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_rate: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Per KG Rate (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.per_kg_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, per_kg_rate: e.target.value }))}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Express Rate (£)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.express_rate}
                      onChange={(e) => setFormData(prev => ({ ...prev, express_rate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3>Settings</h3>
                <div className={styles.checkboxGroup}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.tracking_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, tracking_enabled: e.target.checked }))}
                    />
                    Tracking Enabled
                  </label>

                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.api_integration_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_integration_enabled: e.target.checked }))}
                    />
                    API Integration Enabled
                  </label>

                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn}>
                  {editingCourier ? 'Update Courier' : 'Add Courier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Couriers;