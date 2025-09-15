import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Link, Package2, Boxes, Warehouse, Truck, ClipboardList, BarChart3 } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import { withLoader } from '../../hoc/withLoader';
import BrandInventoryShare from './BrandInventoryShare';
import InventoryMetricCards from './InventoryMetricCards';
import BrandTrendChart from './BrandTrendChart';
import InventoryTableCard from './InventoryTableCard';
import styles from './InventoryOverview.module.css';

interface UserData {
  company_id: string;
}

function InventoryOverview() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user data:', error);
        return;
      }

      if (userData?.company_id) {
        setCompanyId(userData.company_id);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSingleItem = () => {
    navigate('/inventory/create-item');
  };

  const handleUploadFromFile = () => {
    navigate('/inventory/upload-items');
  };

  const handleExternalConnect = () => {
    navigate('/inventory/external-connect');
  };


  if (loading || !companyId) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Modern Header with Actions */}
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1 className={styles.pageTitle}>Inventory Overview</h1>
            <p className={styles.pageDescription}>
              Complete inventory management with real-time insights
            </p>
          </div>
          
          {/* Compact Action Cards */}
          <div className={styles.actionCards}>
            <button 
              className={`${styles.actionCard} ${styles.createAction}`}
              onClick={handleCreateSingleItem}
            >
              <div className={styles.actionIcon}>
                <Plus size={20} />
              </div>
              <div className={styles.actionContent}>
                <h4>Create Item</h4>
                <span>Add single product</span>
              </div>
            </button>
            
            <button 
              className={`${styles.actionCard} ${styles.uploadAction}`}
              onClick={handleUploadFromFile}
            >
              <div className={styles.actionIcon}>
                <Upload size={20} />
              </div>
              <div className={styles.actionContent}>
                <h4>Bulk Upload</h4>
                <span>CSV/Excel file</span>
              </div>
            </button>
            
            <button 
              className={`${styles.actionCard} ${styles.connectAction}`}
              onClick={handleExternalConnect}
            >
              <div className={styles.actionIcon}>
                <Link size={20} />
              </div>
              <div className={styles.actionContent}>
                <h4>Connect API</h4>
                <span>External systems</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Compact Metrics Grid */}
      <div className={styles.metricsGrid}>
        <InventoryMetricCards companyId={companyId} />
      </div>

      {/* Analytics Row - Brand Share + Trend Chart Side by Side */}
      <div className={styles.analyticsRow}>
        <div className={styles.brandShareCard}>
          <BrandInventoryShare companyId={companyId} />
        </div>
        <div className={styles.trendCard}>
          <BrandTrendChart companyId={companyId} />
        </div>
      </div>

      {/* Inventory Table - Full Width but Compact */}
      <div className={styles.tableCard}>
        <InventoryTableCard companyId={companyId} />
      </div>

      {/* Compact Tools Grid */}
      <div className={styles.toolsCard}>
        <div className={styles.toolsHeader}>
          <h3 className={styles.sectionTitle}>Management Tools</h3>
        </div>
        <div className={styles.compactToolsGrid}>
          <button 
            className={`${styles.toolItem} ${styles.productManager}`}
            onClick={() => navigate('/inventory/products')}
          >
            <Package2 size={18} />
            <span>Products</span>
          </button>
          
          <button 
            className={`${styles.toolItem} ${styles.warehousing}`}
            onClick={() => navigate('/inventory/warehousing')}
          >
            <Warehouse size={18} />
            <span>Warehousing</span>
          </button>
          
          <button 
            className={`${styles.toolItem} ${styles.couriers}`}
            onClick={() => navigate('/inventory/couriers')}
          >
            <Truck size={18} />
            <span>Couriers</span>
          </button>
          
          <button 
            className={`${styles.toolItem} ${styles.stocklists}`}
            onClick={() => navigate('/inventory/stocklists')}
          >
            <ClipboardList size={18} />
            <span>Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default withLoader(InventoryOverview);