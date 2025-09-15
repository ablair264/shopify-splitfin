import React, { useState, useEffect } from 'react';
import { shopifyService } from '../services';
import { shopifyClientAuthService } from '../services/shopifyClientAuthService';
import './ShopifyDashboard.css';

interface ShopifyDashboardProps {
  className?: string;
}

interface DashboardTab {
  id: string;
  name: string;
  icon: string;
  component: React.ComponentType<any>;
}

const ShopifyDashboard: React.FC<ShopifyDashboardProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isConnected, setIsConnected] = useState(false);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      // Check for OAuth callback first
      const installationResult = await shopifyClientAuthService.checkInstallationStatus();
      
      if (installationResult.success && installationResult.shop) {
        shopifyClientAuthService.storeShopDomain(installationResult.shop);
        await shopifyService.initialize(installationResult.shop);
        setIsConnected(true);
        setShopInfo({ shop: installationResult.shop });
        setLoading(false);
        return;
      }

      // Try to initialize from stored credentials
      const storedShop = await shopifyClientAuthService.initializeFromStorage();
      if (storedShop) {
        await shopifyService.initialize(storedShop);
        setIsConnected(true);
        setShopInfo({ shop: storedShop });
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking Shopify connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const tabs: DashboardTab[] = [
    {
      id: 'overview',
      name: 'Overview',
      icon: '📊',
      component: OverviewTab,
    },
    {
      id: 'products',
      name: 'Products',
      icon: '📦',
      component: ProductsTab,
    },
    {
      id: 'images',
      name: 'Images',
      icon: '🖼️',
      component: ImagesTab,
    },
    {
      id: 'analytics',
      name: 'Analytics',
      icon: '📈',
      component: AnalyticsTab,
    },
    {
      id: 'orders',
      name: 'Orders',
      icon: '🛒',
      component: OrdersTab,
    },
    {
      id: 'customers',
      name: 'Customers',
      icon: '👥',
      component: CustomersTab,
    },
    {
      id: 'marketing',
      name: 'Marketing',
      icon: '📢',
      component: MarketingTab,
    },
  ];

  if (loading) {
    return (
      <div className={`shopify-dashboard ${className || ''}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Shopify Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={`shopify-dashboard ${className || ''}`}>
        <ShopifyConnectionSetup onConnect={checkConnection} />
      </div>
    );
  }

  const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component || OverviewTab;

  return (
    <div className={`shopify-dashboard ${className || ''}`}>
      <div className="dashboard-header">
        <h1>Shopify Store Management</h1>
        {shopInfo && (
          <div className="shop-info">
            <span className="shop-name">{shopInfo.shop}</span>
            <span className="connection-status connected">Connected</span>
          </div>
        )}
      </div>

      <div className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-name">{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        <ActiveTabComponent />
      </div>
    </div>
  );
};

// Connection Setup Component
const ShopifyConnectionSetup: React.FC<{ onConnect: () => void }> = ({ onConnect }) => {
  const [shopDomain, setShopDomain] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError('Please enter your shop domain');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Trigger OAuth flow
      const authUrl = shopifyClientAuthService.generateAuthUrl(shopDomain);
      
      // Redirect to Shopify for authentication
      window.location.href = authUrl;
    } catch (error: any) {
      setError(error.message || 'Failed to connect to Shopify');
      setConnecting(false);
    }
  };

  return (
    <div className="connection-setup">
      <div className="setup-container">
        <h2>Connect Your Shopify Store</h2>
        <p>Enter your Shopify store domain to get started with advanced product management, analytics, and AI-powered tools.</p>
        
        <div className="connection-form">
          <div className="input-group">
            <label htmlFor="shop-domain">Shop Domain</label>
            <div className="domain-input">
              <input
                id="shop-domain"
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store"
                disabled={connecting}
              />
              <span className="domain-suffix">.myshopify.com</span>
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button
            className="connect-button"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect to Shopify'}
          </button>
        </div>

        <div className="features-preview">
          <h3>What you'll get:</h3>
          <ul>
            <li>📦 AI-Enhanced Product Upload & Management</li>
            <li>🖼️ Automatic Image Matching & Optimization</li>
            <li>📊 Advanced Analytics & Insights</li>
            <li>🛒 Streamlined Order & Customer Management</li>
            <li>📢 AI-Generated Marketing Materials</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Tab Components (simplified - would be expanded in real implementation)
const OverviewTab: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      const [dashboard, health] = await Promise.all([
        shopifyService.getStoreDashboard(),
        shopifyService.healthCheck(),
      ]);
      
      setMetrics({ dashboard, health });
    } catch (error) {
      console.error('Error loading overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="tab-loading">Loading overview...</div>;
  }

  return (
    <div className="overview-tab">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Sales</h3>
          <div className="metric-value">
            ${metrics?.dashboard?.sales?.totalSales?.value?.toLocaleString() || '0'}
          </div>
          <div className="metric-change positive">
            +{metrics?.dashboard?.sales?.totalSales?.changePercent?.toFixed(1) || '0'}%
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Orders</h3>
          <div className="metric-value">
            {metrics?.dashboard?.sales?.orderCount?.value?.toLocaleString() || '0'}
          </div>
          <div className="metric-change positive">
            +{metrics?.dashboard?.sales?.orderCount?.changePercent?.toFixed(1) || '0'}%
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Customers</h3>
          <div className="metric-value">
            {metrics?.dashboard?.customers?.totalCustomers?.value?.toLocaleString() || '0'}
          </div>
          <div className="metric-change positive">
            +{metrics?.dashboard?.customers?.newCustomers?.changePercent?.toFixed(1) || '0'}%
          </div>
        </div>
        
        <div className="metric-card">
          <h3>Avg Order Value</h3>
          <div className="metric-value">
            ${metrics?.dashboard?.sales?.averageOrderValue?.value?.toFixed(2) || '0'}
          </div>
          <div className="metric-change neutral">
            {metrics?.dashboard?.sales?.averageOrderValue?.changePercent?.toFixed(1) || '0'}%
          </div>
        </div>
      </div>

      <div className="insights-section">
        <h3>AI Insights</h3>
        <div className="insights-list">
          {metrics?.dashboard?.insights?.map((insight: any, index: number) => (
            <div key={index} className={`insight-item ${insight.type}`}>
              <div className="insight-header">
                <span className="insight-type">{insight.type}</span>
                <span className="insight-priority">{insight.priority}</span>
              </div>
              <h4>{insight.title}</h4>
              <p>{insight.description}</p>
              {insight.action && (
                <div className="insight-action">{insight.action}</div>
              )}
            </div>
          )) || <p>No insights available</p>}
        </div>
      </div>
    </div>
  );
};

const ProductsTab: React.FC = () => (
  <div className="products-tab">
    <h3>Product Management</h3>
    <p>Upload and manage your Shopify products with AI enhancement.</p>
    {/* Product upload and management components would go here */}
  </div>
);

const ImagesTab: React.FC = () => (
  <div className="images-tab">
    <h3>Image Management</h3>
    <p>Upload, organize, and optimize product images.</p>
    {/* Image management components would go here */}
  </div>
);

const AnalyticsTab: React.FC = () => (
  <div className="analytics-tab">
    <h3>Store Analytics</h3>
    <p>Detailed analytics and reporting for your Shopify store.</p>
    {/* Analytics dashboard would go here */}
  </div>
);

const OrdersTab: React.FC = () => (
  <div className="orders-tab">
    <h3>Orders Management</h3>
    <p>View and manage your Shopify orders.</p>
    {/* Orders management components would go here */}
  </div>
);

const CustomersTab: React.FC = () => (
  <div className="customers-tab">
    <h3>Customer Management</h3>
    <p>Manage your customer relationships and segments.</p>
    {/* Customer management components would go here */}
  </div>
);

const MarketingTab: React.FC = () => (
  <div className="marketing-tab">
    <h3>Marketing Materials</h3>
    <p>Generate AI-powered marketing content for your store.</p>
    {/* Marketing tools would go here */}
  </div>
);

export default ShopifyDashboard;