/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState } from 'react';
import { FaTimes, FaSave } from 'react-icons/fa';
import { WidgetConfig } from './CustomizableDashboard';
import './WidgetConfigModal.css';

interface WidgetConfigModalProps {
  widget: WidgetConfig;
  onClose: () => void;
  onSave: (widget: WidgetConfig) => void;
}

export const WidgetConfigModal: React.FC<WidgetConfigModalProps> = ({ widget, onClose, onSave }) => {
  const [config, setConfig] = useState<WidgetConfig>({ ...widget });

  const availableMetrics = {
    orders: [
      { value: 'totalRevenue', label: 'Total Revenue' },
      { value: 'totalOrders', label: 'Total Orders' },
      { value: 'averageOrderValue', label: 'Average Order Value' },
      { value: 'orderConversion', label: 'Order Conversion Rate' }
    ],
    customers: [
      { value: 'totalCustomers', label: 'Total Customers' },
      { value: 'newCustomers', label: 'New Customers' },
      { value: 'activeCustomers', label: 'Active Customers' },
      { value: 'customerChurn', label: 'Customer Churn Rate' }
    ],
    inventory: [
      { value: 'totalItems', label: 'Total Items' },
      { value: 'lowStock', label: 'Low Stock Items' },
      { value: 'outOfStock', label: 'Out of Stock' },
      { value: 'inventoryValue', label: 'Inventory Value' }
    ],
    sales_team: [
      { value: 'topPerformers', label: 'Top Performers' },
      { value: 'salesByAgent', label: 'Sales by Agent' },
      { value: 'commissions', label: 'Commissions' },
      { value: 'targets', label: 'Sales Targets' }
    ]
  };

  const displayFormats = {
    metric: [
      { value: 'MetricCard', label: 'Metric Card' },
      { value: 'MetricCardSquare', label: 'Square Metric Card' },
      { value: 'ColorfulMetricCard', label: 'Colorful Metric Card' }
    ],
    chart: [
      { value: 'FullGraph', label: 'Full Graph' }
    ],
    table: [
      { value: 'DataTable', label: 'Data Table' }
    ],
    activity: [
      { value: 'ActivityFeed', label: 'Activity Feed' }
    ]
  };

  const chartTypes = [
    { value: 'line', label: 'Line Chart' },
    { value: 'bar', label: 'Bar Chart' },
    { value: 'area', label: 'Area Chart' },
    { value: 'pie', label: 'Pie Chart' },
    { value: 'donut', label: 'Donut Chart' }
  ];

  const dateRanges = [
    { value: '7_days', label: 'Last 7 Days' },
    { value: '30_days', label: 'Last 30 Days' },
    { value: '90_days', label: 'Last 90 Days' },
    { value: '12_months', label: 'Last 12 Months' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const colorPresets = [
    '#79d5e9', '#6bc7db', '#5ab3c5', '#4a9faf',
    '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
    '#f59e0b', '#ef4444', '#06b6d4', '#10b981'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const updateConfig = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateConfigField = (field: string, value: any) => {
    setConfig(prev => {
      const updatedConfig = {
        ...prev,
        config: {
          ...prev.config,
          [field]: value
        }
      };

      // Auto-update title and subtitle based on selections
      if (field === 'metric' || field === 'chartType' || field === 'pieDataType') {
        const autoTitleSubtitle = getAutoTitleSubtitle(
          prev.dataSource,
          field === 'metric' ? value : prev.config.metric,
          field === 'chartType' ? value : prev.config.chartType,
          field === 'pieDataType' ? value : prev.config.pieDataType
        );
        
        if (autoTitleSubtitle) {
          updatedConfig.title = autoTitleSubtitle.title;
          updatedConfig.subtitle = autoTitleSubtitle.subtitle;
        }
      }

      return updatedConfig;
    });
  };

  const getAutoTitleSubtitle = (dataSource: string, metric?: string, chartType?: string, pieDataType?: string) => {
    // For pie/donut charts, use specific titles based on pieDataType
    if ((chartType === 'pie' || chartType === 'donut') && pieDataType && pieDataType !== 'automatic') {
      const pieDataTitles: Record<string, { title: string; subtitle: string }> = {
        orderStatus: { title: 'Orders by Status', subtitle: 'Current order status breakdown' },
        ordersByDay: { title: 'Orders by Day', subtitle: 'Daily order distribution' },
        topCustomers: { title: 'Top Customers', subtitle: 'Revenue by customer' },
        customersByRegion: { title: 'Customers by Region', subtitle: 'Geographic distribution' },
        salesByPerson: { title: 'Sales Team Performance', subtitle: 'Revenue by team member' },
        performanceByTarget: { title: 'Target Achievement', subtitle: 'Performance vs targets' }
      };
      return pieDataTitles[pieDataType] || null;
    }

    // For other charts and metrics
    const metricTitles: Record<string, { title: string; subtitle: string }> = {
      // Orders metrics
      totalRevenue: { title: 'Total Revenue', subtitle: 'Total sales revenue' },
      totalOrders: { title: 'Total Orders', subtitle: 'Number of orders placed' },
      averageOrderValue: { title: 'Average Order Value', subtitle: 'Mean value per order' },
      orderConversion: { title: 'Order Conversion Rate', subtitle: 'Order completion percentage' },
      
      // Customer metrics
      totalCustomers: { title: 'Total Customers', subtitle: 'All registered customers' },
      newCustomers: { title: 'New Customers', subtitle: 'Recently joined customers' },
      activeCustomers: { title: 'Active Customers', subtitle: 'Customers with recent orders' },
      customerChurn: { title: 'Customer Churn Rate', subtitle: 'Customer attrition percentage' },
      
      // Inventory metrics
      totalItems: { title: 'Total Items', subtitle: 'Items in inventory' },
      lowStock: { title: 'Low Stock Items', subtitle: 'Items below reorder level' },
      outOfStock: { title: 'Out of Stock', subtitle: 'Unavailable items' },
      inventoryValue: { title: 'Inventory Value', subtitle: 'Total stock value' },
      
      // Sales team metrics
      topPerformers: { title: 'Top Performers', subtitle: 'Highest revenue generators' },
      salesByAgent: { title: 'Sales by Agent', subtitle: 'Individual performance' },
      commissions: { title: 'Commissions', subtitle: 'Commission calculations' },
      targets: { title: 'Sales Targets', subtitle: 'Target vs achievement' }
    };

    if (metric && metricTitles[metric]) {
      return metricTitles[metric];
    }

    // Default titles based on data source
    const defaultTitles: Record<string, { title: string; subtitle: string }> = {
      orders: { title: 'Orders Overview', subtitle: 'Order analytics' },
      customers: { title: 'Customer Analytics', subtitle: 'Customer insights' },
      inventory: { title: 'Inventory Status', subtitle: 'Stock levels' },
      sales_team: { title: 'Sales Performance', subtitle: 'Team analytics' },
      activities: { title: 'Recent Activity', subtitle: 'Latest system events' }
    };

    return defaultTitles[dataSource] || null;
  };

  return (
    <div className="widget-config-modal-overlay" onClick={onClose}>
      <div className="widget-config-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Widget</h2>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Basic Information */}
          <div className="config-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="title">Widget Title</label>
              <input
                id="title"
                type="text"
                value={config.title}
                onChange={e => updateConfig({ title: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="subtitle">Subtitle (Optional)</label>
              <input
                id="subtitle"
                type="text"
                value={config.subtitle || ''}
                onChange={e => updateConfig({ subtitle: e.target.value })}
              />
            </div>
          </div>

          {/* Data Configuration */}
          <div className="config-section">
            <h3>Data Configuration</h3>

            <div className="form-group">
              <label htmlFor="dataSource">Data Source</label>
              <select
                id="dataSource"
                value={config.dataSource}
                onChange={e => {
                  const newDataSource = e.target.value;
                  const autoTitleSubtitle = getAutoTitleSubtitle(
                    newDataSource,
                    config.config.metric,
                    config.config.chartType,
                    config.config.pieDataType
                  );
                  
                  updateConfig({ 
                    dataSource: newDataSource,
                    ...(autoTitleSubtitle || {})
                  });
                }}
              >
                <option value="orders">Orders</option>
                <option value="customers">Customers</option>
                <option value="inventory">Inventory</option>
                <option value="sales_team">Sales Team</option>
                <option value="activities">Activities</option>
              </select>
            </div>

            {availableMetrics[config.dataSource] && (
              <div className="form-group">
                <label htmlFor="metric">Metric</label>
                <select
                  id="metric"
                  value={config.config.metric || ''}
                  onChange={e => updateConfigField('metric', e.target.value)}
                >
                  <option value="">Select a metric</option>
                  {availableMetrics[config.dataSource].map(metric => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

          </div>

          {/* Display Configuration */}
          <div className="config-section">
            <h3>Display Configuration</h3>

            <div className="form-group">
              <label htmlFor="displayFormat">Display Format</label>
              <select
                id="displayFormat"
                value={config.displayFormat}
                onChange={e => updateConfig({ displayFormat: e.target.value as any })}
              >
                {displayFormats[config.type]?.map(format => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>


            {/* Size selector for all widgets */}
            <div className="form-group">
              <label htmlFor="size">Widget Size</label>
              <select
                id="size"
                value={config.config.size || 'auto'}
                onChange={e => updateConfigField('size', e.target.value)}
              >
                <option value="auto">Auto (Based on type)</option>
                <option value="full">Full Width (100%)</option>
                <option value="square">Half Width (50%)</option>
              </select>
              <small className="field-helper">
                Charts, tables, and activity feeds default to full width.
                Metric cards default to 1/3 width.
              </small>
            </div>

            {config.displayFormat === 'FullGraph' && (
              <>
                <div className="form-group">
                  <label htmlFor="chartType">Chart Type</label>
                  <select
                    id="chartType"
                    value={config.config.chartType || 'area'}
                    onChange={e => updateConfigField('chartType', e.target.value)}
                  >
                    {chartTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Show data selection for pie/donut charts */}
                {(config.config.chartType === 'pie' || config.config.chartType === 'donut') && (
                  <div className="form-group">
                    <label htmlFor="pieDataType">Pie Chart Data</label>
                    <select
                      id="pieDataType"
                      value={config.config.pieDataType || 'automatic'}
                      onChange={e => updateConfigField('pieDataType', e.target.value)}
                    >
                      <option value="automatic">Automatic (Based on Data Source)</option>
                      {config.dataSource === 'orders' && (
                        <>
                          <option value="orderStatus">Order Status Breakdown</option>
                          <option value="ordersByDay">Orders by Day</option>
                        </>
                      )}
                      {config.dataSource === 'customers' && (
                        <>
                          <option value="topCustomers">Top Customers by Revenue</option>
                          <option value="customersByRegion">Customers by Region</option>
                        </>
                      )}
                      {config.dataSource === 'sales_team' && (
                        <>
                          <option value="salesByPerson">Sales by Team Member</option>
                          <option value="performanceByTarget">Performance vs Target</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Only show variant selector for non-compact MetricCards */}
            {((config.displayFormat === 'MetricCard' && config.config.displayMode !== 'compact') || 
              config.displayFormat === 'MetricCardSquare') && (
              <div className="form-group">
                <label>Card Variant</label>
                <div className="variant-buttons">
                  <button
                    type="button"
                    className={`variant-btn ${config.config.variant === 'variant1' ? 'active' : ''}`}
                    onClick={() => updateConfigField('variant', 'variant1')}
                  >
                    <div className="variant-preview variant1">
                      <div className="variant-preview-title">REVENUE</div>
                      <div className="variant-preview-value">£2.4K</div>
                      <div className="variant-preview-chart">
                        <div className="variant-preview-bar" style={{ height: '40%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '60%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '50%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '80%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '65%' }}></div>
                      </div>
                    </div>
                    <span>Glassmorphism</span>
                  </button>
                  <button
                    type="button"
                    className={`variant-btn ${config.config.variant === 'variant2' ? 'active' : ''}`}
                    onClick={() => updateConfigField('variant', 'variant2')}
                  >
                    <div className="variant-preview variant2">
                      <div className="variant-preview-title">REVENUE</div>
                      <div className="variant-preview-value">£2.4K</div>
                      <div className="variant-preview-chart">
                        <div className="variant-preview-bar" style={{ height: '40%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '60%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '50%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '80%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '65%' }}></div>
                      </div>
                    </div>
                    <span>Side Accent</span>
                  </button>
                  <button
                    type="button"
                    className={`variant-btn ${config.config.variant === 'variant3' ? 'active' : ''}`}
                    onClick={() => updateConfigField('variant', 'variant3')}
                  >
                    <div className="variant-preview variant3">
                      <div className="variant-preview-title">REVENUE</div>
                      <div className="variant-preview-value">£2.4K</div>
                      <div className="variant-preview-chart">
                        <div className="variant-preview-bar" style={{ height: '40%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '60%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '50%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '80%' }}></div>
                        <div className="variant-preview-bar" style={{ height: '65%' }}></div>
                      </div>
                    </div>
                    <span>Top Accent</span>
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="color">Color Theme</label>
              <div className="color-picker">
                {colorPresets.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-preset ${config.config.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateConfigField('color', color)}
                  />
                ))}
                <input
                  type="color"
                  value={config.config.color || '#79d5e9'}
                  onChange={e => updateConfigField('color', e.target.value)}
                  className="color-input"
                />
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={config.config.showTrend || false}
                  onChange={e => updateConfigField('showTrend', e.target.checked)}
                />
                Show Trend Indicator
              </label>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="config-section">
            <h3>Advanced Options</h3>

            <div className="form-group">
              <label htmlFor="refreshInterval">Auto Refresh (seconds)</label>
              <input
                id="refreshInterval"
                type="number"
                min="0"
                step="10"
                value={config.config.refreshInterval || ''}
                onChange={e => updateConfigField('refreshInterval', parseInt(e.target.value) || 0)}
                placeholder="0 = No auto refresh"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              <FaSave /> Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};