import React, { useState, useEffect } from 'react';
import { WidgetConfig } from './CustomizableDashboard';
import { BarChart3, LineChart, Table, Zap, GripVertical, PieChart, Map, TrendingUp, Target, Users, Package, DollarSign, Activity, Layers, Grid3x3 } from 'lucide-react';
import './WidgetPalette.css';

export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  type: 'metric' | 'chart' | 'table' | 'activity' | 'map';
  displayFormat: string;
  dataSource: string;
  icon: React.ReactNode;
  config: any;
  preview?: React.ReactNode;
  category?: string;
}

interface WidgetPaletteProps {
  isVisible: boolean;
  onDragStart: (template: WidgetTemplate) => void;
  onClose: () => void;
}

const WidgetPalette: React.FC<WidgetPaletteProps> = ({
  isVisible,
  onDragStart,
  onClose
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Expanded widget templates with more options
  const widgetTemplates: WidgetTemplate[] = [
    // Metric Cards
    {
      id: 'metric-card-compact',
      name: 'Compact Metric',
      description: 'Horizontal compact metric display',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <BarChart3 size={16} />,
      category: 'metrics',
      config: { 
        metric: 'totalRevenue', 
        displayMode: 'compact', 
        showTrend: true, 
        color: '#79d5e9',
        size: 'auto'
      },
      preview: (
        <div className="metric-preview compact">
          <div className="preview-icon">📊</div>
          <div className="preview-content">
            <div className="preview-value">£0.00</div>
            <div className="preview-title">METRIC</div>
          </div>
        </div>
      )
    },
    {
      id: 'metric-card-medium',
      name: 'Standard Metric',
      description: 'Medium metric card with chart',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <BarChart3 size={16} />,
      category: 'metrics',
      config: { 
        metric: 'totalRevenue', 
        displayMode: 'medium', 
        showTrend: true,
        color: '#79d5e9',
        size: 'auto'
      },
      preview: (
        <div className="metric-preview medium">
          <div className="preview-header">
            <span className="preview-title">METRIC</span>
            <span className="trend">+12%</span>
          </div>
          <div className="preview-value">£0.00</div>
          <div className="preview-chart">
            <div className="preview-bars">
              <div className="bar" style={{height: '40%'}}></div>
              <div className="bar" style={{height: '60%'}}></div>
              <div className="bar" style={{height: '80%'}}></div>
              <div className="bar" style={{height: '50%'}}></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'metric-card-large',
      name: 'Large Metric',
      description: 'Large metric card with detailed chart',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <BarChart3 size={16} />,
      category: 'metrics',
      config: { 
        metric: 'totalRevenue', 
        displayMode: 'large', 
        showTrend: true,
        color: '#79d5e9',
        variant: 'variant1',
        size: 'auto'
      },
      preview: (
        <div className="metric-preview large">
          <div className="preview-header">
            <span className="preview-title">LARGE METRIC</span>
            <span className="trend">+25%</span>
          </div>
          <div className="preview-value">£0.00</div>
          <div className="preview-subtitle">vs last period</div>
          <div className="preview-chart large">
            <div className="preview-bars">
              <div className="bar" style={{height: '30%'}}></div>
              <div className="bar" style={{height: '50%'}}></div>
              <div className="bar" style={{height: '70%'}}></div>
              <div className="bar" style={{height: '60%'}}></div>
              <div className="bar" style={{height: '90%'}}></div>
              <div className="bar" style={{height: '40%'}}></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'kpi-grid',
      name: 'KPI Grid',
      description: 'Multiple mini metrics in grid layout',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <Grid3x3 size={16} />,
      category: 'metrics',
      config: { 
        metric: 'kpiGrid', 
        displayMode: 'grid',
        showTrend: true,
        color: '#79d5e9',
        size: 'square'
      },
      preview: (
        <div className="kpi-grid-preview">
          <div className="kpi-item">
            <span className="kpi-value">125</span>
            <span className="kpi-label">Orders</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-value">£45K</span>
            <span className="kpi-label">Revenue</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-value">89%</span>
            <span className="kpi-label">Target</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-value">+12%</span>
            <span className="kpi-label">Growth</span>
          </div>
        </div>
      )
    },

    // Chart Cards
    {
      id: 'line-chart',
      name: 'Line Chart',
      description: 'Time series line chart',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <LineChart size={16} />,
      category: 'charts',
      config: { 
        chartType: 'line', 
        size: 'full',
        metric: 'revenue',
        showLegend: true
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Line Chart</span>
          </div>
          <div className="preview-chart-area">
            <svg viewBox="0 0 100 40" className="preview-svg">
              <polyline
                fill="none"
                stroke="#79d5e9"
                strokeWidth="2"
                points="10,30 25,20 40,25 55,15 70,18 85,10"
              />
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'area-chart',
      name: 'Area Chart',
      description: 'Filled area time series chart',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <Activity size={16} />,
      category: 'charts',
      config: { 
        chartType: 'area', 
        size: 'full',
        metric: 'revenue',
        color: '#79d5e9'
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Area Chart</span>
          </div>
          <div className="preview-chart-area">
            <svg viewBox="0 0 100 40" className="preview-svg">
              <path
                d="M 10,30 L 25,20 L 40,25 L 55,15 L 70,18 L 85,10 L 85,40 L 10,40 Z"
                fill="#79d5e9"
                opacity="0.3"
              />
              <polyline
                fill="none"
                stroke="#79d5e9"
                strokeWidth="2"
                points="10,30 25,20 40,25 55,15 70,18 85,10"
              />
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'bar-chart',
      name: 'Bar Chart',
      description: 'Vertical bar chart',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <BarChart3 size={16} />,
      category: 'charts',
      config: { 
        chartType: 'bar', 
        size: 'full',
        metric: 'orders'
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Bar Chart</span>
          </div>
          <div className="preview-chart-area bars">
            <div className="preview-bars">
              <div className="bar" style={{height: '60%'}}></div>
              <div className="bar" style={{height: '80%'}}></div>
              <div className="bar" style={{height: '45%'}}></div>
              <div className="bar" style={{height: '90%'}}></div>
              <div className="bar" style={{height: '70%'}}></div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'pie-chart',
      name: 'Pie Chart',
      description: 'Pie chart for distribution',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <PieChart size={16} />,
      category: 'charts',
      config: { 
        chartType: 'pie', 
        size: 'square',
        metric: 'revenue'
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Pie Chart</span>
          </div>
          <div className="preview-chart-area">
            <svg viewBox="0 0 100 40" className="preview-svg">
              <circle cx="50" cy="20" r="15" fill="none" stroke="#79d5e9" strokeWidth="8" strokeDasharray="47 47" transform="rotate(-90 50 20)"/>
              <circle cx="50" cy="20" r="15" fill="none" stroke="#799de9" strokeWidth="8" strokeDasharray="31 63" strokeDashoffset="-47" transform="rotate(-90 50 20)"/>
              <circle cx="50" cy="20" r="15" fill="none" stroke="#79e9c5" strokeWidth="8" strokeDasharray="16 78" strokeDashoffset="-78" transform="rotate(-90 50 20)"/>
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'donut-chart',
      name: 'Donut Chart',
      description: 'Donut chart with center value',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <PieChart size={16} />,
      category: 'charts',
      config: { 
        chartType: 'donut', 
        size: 'square',
        metric: 'revenue'
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Donut Chart</span>
          </div>
          <div className="preview-chart-area">
            <svg viewBox="0 0 100 40" className="preview-svg">
              <circle cx="50" cy="20" r="15" fill="none" stroke="#79d5e9" strokeWidth="5" strokeDasharray="47 47" transform="rotate(-90 50 20)"/>
              <circle cx="50" cy="20" r="15" fill="none" stroke="#799de9" strokeWidth="5" strokeDasharray="31 63" strokeDashoffset="-47" transform="rotate(-90 50 20)"/>
              <circle cx="50" cy="20" r="15" fill="none" stroke="#79e9c5" strokeWidth="5" strokeDasharray="16 78" strokeDashoffset="-78" transform="rotate(-90 50 20)"/>
              <text x="50" y="23" textAnchor="middle" fontSize="8" fill="#fff">100%</text>
            </svg>
          </div>
        </div>
      )
    },
    {
      id: 'comparison-chart',
      name: 'Comparison Chart',
      description: 'Period over period comparison',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <TrendingUp size={16} />,
      category: 'charts',
      config: { 
        chartType: 'comparison',
        size: 'full',
        metric: 'revenue',
        compareWith: 'lastPeriod'
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Comparison</span>
          </div>
          <div className="preview-chart-area">
            <svg viewBox="0 0 100 40" className="preview-svg">
              <polyline fill="none" stroke="#79d5e9" strokeWidth="2" points="10,30 25,20 40,25 55,15 70,18 85,10"/>
              <polyline fill="none" stroke="#799de9" strokeWidth="2" strokeDasharray="3,3" points="10,35 25,28 40,30 55,22 70,25 85,18"/>
            </svg>
          </div>
        </div>
      )
    },

    // Table & Data Cards
    {
      id: 'data-table',
      name: 'Data Table',
      description: 'Customizable data table',
      type: 'table',
      displayFormat: 'DataTable',
      dataSource: 'sales_team',
      icon: <Table size={16} />,
      category: 'tables',
      config: { 
        columns: [],
        filters: [],
        size: 'full'
      },
      preview: (
        <div className="table-preview">
          <div className="preview-header">
            <span className="preview-title">Data Table</span>
          </div>
          <div className="preview-table">
            <div className="table-header">
              <div className="th">Name</div>
              <div className="th">Value</div>
              <div className="th">Status</div>
            </div>
            <div className="table-row">
              <div className="td">Item 1</div>
              <div className="td">£100</div>
              <div className="td">Active</div>
            </div>
            <div className="table-row">
              <div className="td">Item 2</div>
              <div className="td">£200</div>
              <div className="td">Pending</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'top-customers',
      name: 'Top Customers',
      description: 'Table showing top customers',
      type: 'table',
      displayFormat: 'TableCard',
      dataSource: 'customers',
      icon: <Users size={16} />,
      category: 'tables',
      config: { 
        metric: 'topCustomers',
        maxRows: 10,
        size: 'square'
      },
      preview: (
        <div className="table-preview">
          <div className="preview-header">
            <span className="preview-title">Top Customers</span>
          </div>
          <div className="preview-table compact">
            <div className="table-row">
              <div className="td">Customer A</div>
              <div className="td">£5.2K</div>
            </div>
            <div className="table-row">
              <div className="td">Customer B</div>
              <div className="td">£3.8K</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'inventory-status',
      name: 'Inventory Status',
      description: 'Stock levels table',
      type: 'table',
      displayFormat: 'TableCard',
      dataSource: 'inventory',
      icon: <Package size={16} />,
      category: 'tables',
      config: { 
        metric: 'stockLevels',
        showWarnings: true,
        size: 'square'
      },
      preview: (
        <div className="table-preview">
          <div className="preview-header">
            <span className="preview-title">Stock Levels</span>
          </div>
          <div className="preview-table compact">
            <div className="table-row">
              <div className="td">Product A</div>
              <div className="td warning">Low</div>
            </div>
            <div className="table-row">
              <div className="td">Product B</div>
              <div className="td success">OK</div>
            </div>
          </div>
        </div>
      )
    },

    // Activity & Special Cards
    {
      id: 'activity-feed',
      name: 'Activity Feed',
      description: 'Recent system activities',
      type: 'activity',
      displayFormat: 'ActivityFeed',
      dataSource: 'activities',
      icon: <Zap size={16} />,
      category: 'special',
      config: { 
        refreshInterval: 30,
        filters: [],
        size: 'full',
        maxActivities: 8
      },
      preview: (
        <div className="activity-preview">
          <div className="preview-header">
            <span className="preview-title">Activities</span>
          </div>
          <div className="preview-activities">
            <div className="activity-item">
              <div className="activity-icon">📦</div>
              <div className="activity-content">
                <div className="activity-text">New Order</div>
                <div className="activity-meta">2 mins ago</div>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">👤</div>
              <div className="activity-content">
                <div className="activity-text">Customer Added</div>
                <div className="activity-meta">5 mins ago</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'map-deliveries',
      name: 'Delivery Map',
      description: 'Live delivery tracking map',
      type: 'map',
      displayFormat: 'MapCard',
      dataSource: 'deliveries',
      icon: <Map size={16} />,
      category: 'special',
      config: { 
        size: 'full',
        showDeliveries: true,
        refreshInterval: 300,
        mapType: 'roadmap'
      },
      preview: (
        <div className="map-preview">
          <div className="preview-header">
            <span className="preview-title">Delivery Map</span>
          </div>
          <div className="preview-map-area">
            <div className="map-placeholder">
              <Map size={24} />
              <span>Live Tracking</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'progress-tracker',
      name: 'Progress Tracker',
      description: 'Goal progress visualization',
      type: 'metric',
      displayFormat: 'MetricCard',
      dataSource: 'orders',
      icon: <Target size={16} />,
      category: 'special',
      config: { 
        metric: 'goalProgress',
        displayMode: 'progress',
        showTarget: true,
        color: '#79d5e9',
        size: 'square'
      },
      preview: (
        <div className="progress-preview">
          <div className="preview-header">
            <span className="preview-title">Monthly Target</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{width: '75%'}}></div>
          </div>
          <div className="progress-text">75% Complete</div>
        </div>
      )
    },
    {
      id: 'revenue-breakdown',
      name: 'Revenue Breakdown',
      description: 'Detailed revenue analysis',
      type: 'chart',
      displayFormat: 'FullGraph',
      dataSource: 'orders',
      icon: <DollarSign size={16} />,
      category: 'special',
      config: { 
        chartType: 'breakdown',
        metric: 'revenueBreakdown',
        size: 'full',
        showDetails: true
      },
      preview: (
        <div className="chart-preview">
          <div className="preview-header">
            <span className="preview-title">Revenue Analysis</span>
          </div>
          <div className="preview-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Online</span>
              <div className="breakdown-bar" style={{width: '60%'}}></div>
              <span className="breakdown-value">60%</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Retail</span>
              <div className="breakdown-bar" style={{width: '40%'}}></div>
              <span className="breakdown-value">40%</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  const categories = [
    { id: 'all', name: 'All Widgets', icon: '📋' },
    { id: 'metrics', name: 'Metrics', icon: '📊' },
    { id: 'charts', name: 'Charts', icon: '📈' },
    { id: 'tables', name: 'Tables', icon: '📑' },
    { id: 'special', name: 'Special', icon: '⭐' }
  ];

  const filteredTemplates = activeCategory === 'all' 
    ? widgetTemplates 
    : widgetTemplates.filter(t => t.category === activeCategory);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, template: WidgetTemplate) => {
    // Only pass serializable data, not React components
    const templateData = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type,
      displayFormat: template.displayFormat,
      dataSource: template.dataSource,
      config: template.config
    };
    e.dataTransfer.setData('application/json', JSON.stringify(templateData));
    setDraggedItemId(template.id);
    onDragStart(template);
    
    // Auto-close palette when dragging starts
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  // Handle escape key to close palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`widget-palette ${isVisible ? 'visible' : ''}`}>
      <div className="palette-header">
        <h3>Widget Library</h3>
        <span className="palette-subtitle">Drag widgets to dashboard</span>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="palette-content">
        <div className="category-tabs">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              <span className="category-emoji">{category.icon}</span>
              <span className="category-name">{category.name}</span>
            </button>
          ))}
        </div>

        <div className="widgets-grid">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={`widget-card ${draggedItemId === template.id ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, template)}
              onDragEnd={handleDragEnd}
            >
              <div className="widget-preview">
                {template.preview}
              </div>
              <div className="widget-info">
                <div className="widget-name">{template.name}</div>
                <div className="widget-description">{template.description}</div>
              </div>
              <div className="drag-handle">
                <GripVertical size={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WidgetPalette;
