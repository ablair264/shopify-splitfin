/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState } from 'react';
import { FaTimes, FaPlus, FaChartLine, FaTable, FaUsers, FaShoppingCart, FaBolt, FaMoneyBillWave, FaBox, FaTruck, FaExclamationTriangle, FaChartBar, FaUserClock, FaInvoice, FaWarehouse } from 'react-icons/fa';
import { WidgetConfig } from './CustomizableDashboard';
import { expandedWidgetTemplates } from './expandedWidgetTemplates';
import './WidgetLibraryModal.css';

interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  type: 'metric' | 'chart' | 'table' | 'activity';
  displayFormat: string;
  dataSource: string;
  icon: React.ReactNode;
  config: any;
  preview?: string;
}

interface WidgetLibraryModalProps {
  onClose: () => void;
  onAddWidget: (widget: WidgetConfig) => void;
  existingWidgets: WidgetConfig[];
}

export const WidgetLibraryModal: React.FC<WidgetLibraryModalProps> = ({
  onClose,
  onAddWidget,
  existingWidgets
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Blank widget templates for custom creation
  const blankTemplates: WidgetTemplate[] = [
    {
      id: 'blank-metric-compact',
      name: 'Blank Metric Card (Compact)',
      description: 'Create a custom compact metric display',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: false,
        dateRange: '30_days',
        displayMode: 'compact'
      }
    },
    {
      id: 'blank-metric-medium',
      name: 'Blank Metric Card (Medium)',
      description: 'Create a custom metric display',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: false,
        dateRange: '30_days',
        displayMode: 'medium'
      }
    },
    {
      id: 'blank-metric-large',
      name: 'Blank Metric Card (Large)',
      description: 'Create a custom large metric display',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: false,
        dateRange: '30_days',
        displayMode: 'large'
      }
    },
    {
      id: 'blank-chart',
      name: 'Blank Chart',
      description: 'Create a custom chart visualization',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <FaChartLine />,
      config: {
        chartType: 'line',
        dateRange: '30_days'
      }
    },
    {
      id: 'blank-table',
      name: 'Blank Table',
      description: 'Create a custom data table',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'sales_team',
      icon: <FaTable />,
      config: {
        columns: [
          { key: 'name', header: 'Name', width: '50%' },
          { key: 'value', header: 'Value', width: '50%' }
        ]
      }
    }
  ];

  // Combine existing templates with expanded templates from schema
  const widgetTemplates: WidgetTemplate[] = [
    // Existing templates
    // Metric Widgets - Compact
    {
      id: 'revenue-metric-compact',
      name: 'Revenue Metric (Compact)',
      description: 'Compact horizontal revenue display',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'compact'
      }
    },
    {
      id: 'orders-metric-compact',
      name: 'Orders Metric (Compact)',
      description: 'Compact horizontal order count',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalOrders',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'compact'
      }
    },
    {
      id: 'customers-metric-compact',
      name: 'Customers Metric (Compact)',
      description: 'Compact horizontal customer count',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      icon: <FaUsers />,
      config: {
        metric: 'totalCustomers',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'compact'
      }
    },
    
    // Metric Widgets - Medium (Default)
    {
      id: 'revenue-metric',
      name: 'Revenue Metric',
      description: 'Display total revenue with trend indicator',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'medium'
      }
    },
    {
      id: 'orders-metric',
      name: 'Orders Metric',
      description: 'Show total order count',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalOrders',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'medium'
      }
    },
    {
      id: 'customers-metric',
      name: 'Customers Metric',
      description: 'Display active customer count',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      icon: <FaUsers />,
      config: {
        metric: 'totalCustomers',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'medium'
      }
    },
    
    // Metric Widgets - Large
    {
      id: 'revenue-metric-large',
      name: 'Revenue Metric (Large)',
      description: 'Large revenue display with full chart',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalRevenue',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'large'
      }
    },
    {
      id: 'orders-metric-large',
      name: 'Orders Metric (Large)',
      description: 'Large order display with full chart',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'totalOrders',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'large'
      }
    },
    {
      id: 'customers-metric-large',
      name: 'Customers Metric (Large)',
      description: 'Large customer display with full chart',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'customers',
      icon: <FaUsers />,
      config: {
        metric: 'totalCustomers',
        showTrend: true,
        dateRange: '30_days',
        displayMode: 'large'
      }
    },
    {
      id: 'aov-metric-square',
      name: 'Average Order Value (Square)',
      description: 'Compact square display of AOV',
      type: 'metric',
      displayFormat: 'MetricCardSquare',
      dataSource: 'orders',
      icon: <FaShoppingCart />,
      config: {
        metric: 'averageOrderValue',
        showTrend: true,
        dateRange: '30_days'
      }
    },
    
    // Chart Widgets
    {
      id: 'revenue-trend-chart',
      name: 'Revenue Trend Chart',
      description: 'Line chart showing revenue over time',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <FaChartLine />,
      config: {
        metric: 'revenue',
        chartType: 'area',
        dateRange: '90_days'
      }
    },
    {
      id: 'orders-trend-chart',
      name: 'Orders Trend Chart',
      description: 'Bar chart of order volume',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <FaChartLine />,
      config: {
        metric: 'orders',
        chartType: 'bar',
        dateRange: '30_days'
      }
    },
    
    // Table Widgets
    {
      id: 'sales-team-table',
      name: 'Sales Team Performance',
      description: 'Table showing sales agent performance',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'sales_team',
      icon: <FaTable />,
      config: {
        columns: [
          { key: 'name', header: 'Agent Name', width: '50%' },
          { key: 'orders', header: 'Orders', width: '25%' },
          { key: 'revenue', header: 'Revenue', width: '25%' }
        ]
      }
    },
    {
      id: 'top-products-table',
      name: 'Top Products',
      description: 'Best selling products table',
      type: 'table',
      displayFormat: 'TableCard',
      dataSource: 'inventory',
      icon: <FaTable />,
      config: {
        columns: [
          { key: 'name', header: 'Product', width: '60%' },
          { key: 'sales', header: 'Sales', width: '40%' }
        ]
      }
    },
    
    // Activity Widgets
    {
      id: 'recent-activities',
      name: 'Recent Activities',
      description: 'Live feed of recent system activities',
      type: 'activity',
      displayFormat: 'ActivityFeed',
      dataSource: 'activities',
      icon: <FaBolt />,
      config: {
        refreshInterval: 30
      }
    },
    // Add all the expanded templates from schema
    ...expandedWidgetTemplates
  ];

  const categories = [
    { id: 'all', name: 'All Widgets', icon: <FaPlus /> },
    { id: 'blank', name: 'Create Blank', icon: <FaPlus /> },
    { id: 'metric', name: 'Metrics', icon: <FaShoppingCart /> },
    { id: 'chart', name: 'Charts', icon: <FaChartLine /> },
    { id: 'table', name: 'Tables', icon: <FaTable /> },
    { id: 'activity', name: 'Activities', icon: <FaBolt /> },
    { id: 'financial', name: 'Financial', icon: <FaMoneyBillWave /> },
    { id: 'inventory', name: 'Inventory', icon: <FaBox /> },
    { id: 'shipping', name: 'Shipping', icon: <FaTruck /> },
    { id: 'customers', name: 'Customers', icon: <FaUsers /> }
  ];

  const filteredTemplates = selectedCategory === 'all' 
    ? widgetTemplates 
    : selectedCategory === 'blank'
    ? blankTemplates
    : selectedCategory === 'financial'
    ? widgetTemplates.filter(t => t.dataSource.includes('financial') || t.dataSource.includes('invoices'))
    : selectedCategory === 'inventory'
    ? widgetTemplates.filter(t => t.dataSource.includes('inventory') || t.dataSource.includes('product') || t.dataSource.includes('backorder'))
    : selectedCategory === 'shipping'
    ? widgetTemplates.filter(t => t.dataSource.includes('shipment'))
    : selectedCategory === 'customers'
    ? widgetTemplates.filter(t => t.dataSource.includes('customer') || t.dataSource.includes('enquiries'))
    : widgetTemplates.filter(template => template.type === selectedCategory);

  const isWidgetAlreadyAdded = (templateId: string) => {
    return existingWidgets.some(widget => widget.id.includes(templateId));
  };

  const handleAddWidget = (template: WidgetTemplate) => {
    const widgetId = `${template.id}-${Date.now()}`;
    const isBlankWidget = template.id.startsWith('blank-');
    
    const newWidget: WidgetConfig = {
      id: widgetId,
      type: template.type,
      displayFormat: template.displayFormat as any,
      dataSource: template.dataSource,
      title: isBlankWidget ? 'New Widget' : template.name,
      subtitle: isBlankWidget ? 'Configure this widget' : template.description,
      config: { ...template.config }
    };

    onAddWidget(newWidget);
  };

  return (
    <div className="widget-library-modal-overlay" onClick={onClose}>
      <div className="widget-library-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h2>Widget Library</h2>
            <p>Choose widgets to add to your dashboard</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-content">
          {/* Category Sidebar */}
          <div className="category-sidebar">
            <h3>Categories</h3>
            <div className="category-list">
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.icon}
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Widget Grid */}
          <div className="widget-grid">
            {filteredTemplates.map(template => (
              <div key={template.id} className="widget-card">
                <div className="widget-card-header">
                  <div className="widget-icon">
                    {template.icon}
                  </div>
                  <div className="widget-info">
                    <h4>{template.name}</h4>
                    <p>{template.description}</p>
                  </div>
                </div>
                
                <div className="widget-card-meta">
                  <span className="widget-type">{template.type}</span>
                  <span className="widget-format">{template.displayFormat}</span>
                </div>

                <div className="widget-card-actions">
                  <button
                    className="add-widget-btn"
                    onClick={() => handleAddWidget(template)}
                    disabled={isWidgetAlreadyAdded(template.id)}
                  >
                    <FaPlus />
                    {isWidgetAlreadyAdded(template.id) ? 'Added' : 'Add Widget'}
                  </button>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="empty-state">
                <p>No widgets found in this category</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};