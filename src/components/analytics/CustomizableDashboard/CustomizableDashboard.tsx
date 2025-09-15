/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { FaPlus, FaSave, FaCog, FaTimes, FaGripVertical } from 'react-icons/fa';
import { supabase } from '../../../services/supabaseService';
import { DashboardWidget } from './DashboardWidget';
import { WidgetConfigModal } from './WidgetConfigModal';
import { WidgetLibraryModal } from './WidgetLibraryModal';
import WidgetPalette, { WidgetTemplate } from './WidgetPalette';
import { DashboardHeader, ColorProvider } from '../shared';
import { useDashboard } from '../../../hooks/useDashboard';
import { AnalyticsPage, analyticsPageService } from '../../../services/analyticsPageService';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './CustomizableDashboard.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface WidgetConfig {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'activity' | 'map' | 'custom';
  displayFormat: 'MetricCard' | 'MetricCardSquare' | 'ColorfulMetricCard' | 'FullGraph' | 'DataTable' | 'TableCard' | 'ActivityFeed' | 'MapCard';
  dataSource: string;
  title: string;
  subtitle?: string;
  config: {
    metric?: string;
    dateRange?: string;
    filters?: Record<string, any>;
    chartType?: 'line' | 'bar' | 'area' | 'pie' | 'donut';
    showTrend?: boolean;
    refreshInterval?: number;
    color?: string;
    columns?: Array<{ key: string; header: string; width?: string; format?: string }>;
    variant?: 'variant1' | 'variant2' | 'variant3';
    displayMode?: 'compact' | 'medium' | 'large';
    size?: 'full' | 'square' | string;
    maxRows?: number;
    showLegend?: boolean;
    maxActivities?: number;
    showFilters?: boolean;
    backgroundColor?: string;
    textColor?: string;
    headerColor?: string;
    borderColor?: string;
  };
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  layouts: ReactGridLayout.Layouts;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomizableDashboardProps {
  dashboardId: string;
  onSave?: (layout: DashboardLayout) => void;
  barChartColors?: string;
  customPageData?: AnalyticsPage;
}

const CustomizableDashboard: React.FC<CustomizableDashboardProps> = ({ dashboardId, onSave, barChartColors = 'primary', customPageData }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [layouts, setLayouts] = useState<ReactGridLayout.Layouts>({});
  const [currentBarChartColors, setCurrentBarChartColors] = useState(barChartColors);
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showWidgetPalette, setShowWidgetPalette] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [widgetVariants, setWidgetVariants] = useState<Record<string, 'variant1' | 'variant2' | 'variant3'>>({});
  const [dateRange, setDateRange] = useState('30_days');
  
  // Use the dashboard hook to get actual data
  const { data: dashboardData, loading: dashboardLoading, refresh: refreshData } = useDashboard({
    dateRange,
    enableCaching: true
  });

  // Color themes mapping
  const colorThemes = {
    primary: '#79d5e9',
    secondary: '#799de9',
    tertiary: '#79e9c5',
    fourth: '#FF9F00',
    fifth: '#C96868',
    sixth: '#A459D1',
    seventh: '#FFB84C',
    eighth: '#16B3AC',
    ninth: '#F266AB',
    tenth: '#A25772',
    eleventh: '#F9ED69',
    multicolored: 'multi'
  };

  // Load saved dashboard layout
  useEffect(() => {
    const loadDashboardLayout = async () => {
      // If customPageData is provided, use it directly
      if (customPageData) {
        setWidgets(customPageData.widgets || []);
        setLayouts(customPageData.layouts || {});
        return;
      }

      try {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        // Load user's dashboard configuration
        const { data: dashboardData, error } = await supabase
          .from('user_dashboards')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('dashboard_id', dashboardId)
          .single();

        if (error || !dashboardData) {
          // Load default layout if no custom layout exists
          loadDefaultLayout();
          return;
        }

        setWidgets(dashboardData.widgets || []);
        setLayouts(dashboardData.layouts || {});
      } catch (error) {
        console.error('Error loading dashboard:', error);
        loadDefaultLayout();
      }
    };

    loadDashboardLayout();
  }, [dashboardId, customPageData]);

  const loadDefaultLayout = () => {
    // Default widgets for the dashboard
    const defaultWidgets: WidgetConfig[] = [
      {
        id: 'revenue-widget',
        type: 'metric',
        displayFormat: 'MetricCard',
        dataSource: 'orders',
        title: 'Total Revenue',
        subtitle: 'All channels combined',
        config: {
          metric: 'totalRevenue',
          showTrend: true,
          color: '#79d5e9',
          variant: 'variant1'
        }
      },
      {
        id: 'orders-widget',
        type: 'metric',
        displayFormat: 'MetricCard',
        dataSource: 'orders',
        title: 'Total Orders',
        subtitle: 'Processed orders',
        config: {
          metric: 'totalOrders',
          showTrend: true,
          color: '#6bc7db',
          variant: 'variant2'
        }
      },
      {
        id: 'customers-widget',
        type: 'metric',
        displayFormat: 'MetricCard',
        dataSource: 'customers',
        title: 'Active Customers',
        subtitle: 'Unique buyers',
        config: {
          metric: 'totalCustomers',
          showTrend: true,
          color: '#5ab3c5',
          variant: 'variant3'
        }
      },
      {
        id: 'revenue-chart',
        type: 'chart',
        displayFormat: 'FullGraph',
        dataSource: 'orders',
        title: 'Revenue Trend',
        subtitle: 'Daily revenue over time',
        config: {
          chartType: 'area',
          metric: 'revenue',
          dateRange: '30_days'
        }
      }
    ];

    const defaultLayouts = {
      lg: [
        { i: 'revenue-widget', x: 0, y: 0, w: 3, h: 3 },
        { i: 'orders-widget', x: 3, y: 0, w: 3, h: 3 },
        { i: 'customers-widget', x: 6, y: 0, w: 3, h: 3 },
        { i: 'revenue-chart', x: 0, y: 3, w: 9, h: 5 }
      ],
      md: [
        { i: 'revenue-widget', x: 0, y: 0, w: 4, h: 3 },
        { i: 'orders-widget', x: 4, y: 0, w: 4, h: 3 },
        { i: 'customers-widget', x: 0, y: 3, w: 4, h: 3 },
        { i: 'revenue-chart', x: 0, y: 6, w: 8, h: 5 }
      ],
      sm: [
        { i: 'revenue-widget', x: 0, y: 0, w: 6, h: 3 },
        { i: 'orders-widget', x: 0, y: 3, w: 6, h: 3 },
        { i: 'customers-widget', x: 0, y: 6, w: 6, h: 3 },
        { i: 'revenue-chart', x: 0, y: 9, w: 6, h: 5 }
      ]
    };

    setWidgets(defaultWidgets);
    setLayouts(defaultLayouts);
  };

  const saveDashboardLayout = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const dashboardData = {
        user_id: authUser.id,
        dashboard_id: dashboardId,
        widgets,
        layouts,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_dashboards')
        .upsert(dashboardData, {
          onConflict: 'user_id,dashboard_id'
        });

      if (error) throw error;

      setIsDirty(false);
      if (onSave) {
        onSave({
          id: dashboardId,
          name: 'Custom Dashboard',
          widgets,
          layouts,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error saving dashboard:', error);
    }
  };

  const handleLayoutChange = (layout: ReactGridLayout.Layout[], layouts: ReactGridLayout.Layouts) => {
    setLayouts(layouts);
    setIsDirty(true);
  };

  // Convert WidgetTemplate to WidgetConfig
  const convertTemplateToWidget = (template: WidgetTemplate): WidgetConfig => {
    const widgetId = `${template.id}-${Date.now()}`;
    
    return {
      id: widgetId,
      type: template.type,
      displayFormat: template.displayFormat as any,
      dataSource: template.dataSource,
      title: template.name,
      subtitle: template.description,
      config: { ...template.config }
    };
  };

  // Handle drag and drop from palette
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const templateData = e.dataTransfer.getData('application/json');
    
    if (templateData) {
      try {
        const template: WidgetTemplate = JSON.parse(templateData);
        const widget = convertTemplateToWidget(template);
        addWidget(widget);
      } catch (error) {
        console.error('Error parsing dropped widget:', error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we're leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const addWidget = (widget: WidgetConfig) => {
    // Find a suitable position for the new widget
    const getWidgetDefaultHeight = (format: string, widget?: WidgetConfig) => {
      // Check if it's a compact MetricCard
      if (format === 'MetricCard' && widget?.config?.displayMode === 'compact') {
        return 2; // Compact cards need 2 grid units for better visibility
      }
      
      switch (format) {
        case 'FullGraph': return 6;
        case 'DataTable': 
        case 'TableCard': return 5;
        case 'ActivityFeed': return 6;
        case 'MapCard': return 6;
        default: return 4; // Other MetricCard variants (medium, large)
      }
    };

    // Smart placement algorithm
    const findBestPosition = () => {
      const currentLayout = layouts.lg || [];
      // Determine widget width based on size config and display format
      let widgetWidth = 4; // Default width for better proportions
      
      // Check if widget has explicit size configuration
      if (widget.config.size === 'square' || widget.config.size === '50%') {
        widgetWidth = 6; // 50% width - 6 units out of 12
      } else if (widget.config.size === 'full' || widget.config.size === '100%') {
        widgetWidth = 12; // Full width - 12 units out of 12
      } else {
        // Auto-determine based on widget type
        if (widget.displayFormat === 'FullGraph' || 
            widget.displayFormat === 'DataTable' || 
            widget.displayFormat === 'TableCard' || 
            widget.displayFormat === 'ActivityFeed' ||
            widget.displayFormat === 'MapCard') {
          widgetWidth = widget.config.size === 'square' ? 6 : 12; // Default to full width for these types
        } else if (widget.displayFormat === 'MetricCard' && widget.config.displayMode === 'compact') {
          widgetWidth = 4; // Compact cards are smaller
        } else {
          widgetWidth = 4; // Default for metric cards
        }
      }
      
      const widgetHeight = getWidgetDefaultHeight(widget.displayFormat, widget);
      
      // Try to place horizontally first
      for (let y = 0; y < 20; y += widgetHeight) {
        for (let x = 0; x <= 12 - widgetWidth; x += widgetWidth) {
          // Check if position is free
          const isPositionFree = !currentLayout.some(item => 
            x < item.x + item.w && 
            x + widgetWidth > item.x && 
            y < item.y + item.h && 
            y + widgetHeight > item.y
          );
          
          if (isPositionFree) {
            return { x, y };
          }
        }
      }
      
      // Fallback to bottom placement
      const maxY = currentLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      return { x: 0, y: maxY };
    };

    const { x, y } = findBestPosition();
    
    // Calculate width based on size config and display format - using the same logic as above
    let widgetWidth = 4; // Default width
    
    if (widget.config.size === 'square' || widget.config.size === '50%') {
      widgetWidth = 6; // 50% width
    } else if (widget.config.size === 'full' || widget.config.size === '100%') {
      widgetWidth = 12; // Full width
    } else {
      // Auto-determine based on widget type
      if (widget.displayFormat === 'FullGraph' || 
          widget.displayFormat === 'DataTable' || 
          widget.displayFormat === 'TableCard' || 
          widget.displayFormat === 'ActivityFeed' ||
          widget.displayFormat === 'MapCard') {
        widgetWidth = widget.config.size === 'square' ? 6 : 12;
      } else if (widget.displayFormat === 'MetricCard' && widget.config.displayMode === 'compact') {
        widgetWidth = 4;
      } else {
        widgetWidth = 4;
      }
    }
    
    const newLayoutItem = {
      i: widget.id,
      x,
      y,
      w: widgetWidth,
      h: getWidgetDefaultHeight(widget.displayFormat, widget)
    };

    const newLayouts = {
      lg: [...(layouts.lg || []), newLayoutItem],
      md: [...(layouts.md || []), { 
        ...newLayoutItem, 
        w: widgetWidth === 12 ? 8 : (widgetWidth === 6 ? 4 : 4) 
      }],
      sm: [...(layouts.sm || []), { ...newLayoutItem, w: 6 }],
      xs: [...(layouts.xs || []), { ...newLayoutItem, w: 4 }],
      xxs: [...(layouts.xxs || []), { ...newLayoutItem, w: 2 }]
    };

    setWidgets([...widgets, widget]);
    setLayouts(newLayouts);
    setIsDirty(true);
    setShowWidgetLibrary(false);
  };

  const updateWidget = (updatedWidget: WidgetConfig) => {
    // Find the original widget to compare if size changed
    const originalWidget = widgets.find(w => w.id === updatedWidget.id);
    
    // Update the widget
    setWidgets(widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w));
    
    // If size configuration changed, update the layout
    if (originalWidget && originalWidget.config.size !== updatedWidget.config.size) {
      const currentLayouts = { ...layouts };
      
      // Calculate new width based on size and display format
      let newWidth = 4; // Default width
      
      if (updatedWidget.config.size === 'square' || updatedWidget.config.size === '50%') {
        newWidth = 6; // 50% width
      } else if (updatedWidget.config.size === 'full' || updatedWidget.config.size === '100%') {
        newWidth = 12; // Full width
      } else {
        // Auto-determine based on widget type
        if (updatedWidget.displayFormat === 'FullGraph' || 
            updatedWidget.displayFormat === 'DataTable' || 
            updatedWidget.displayFormat === 'TableCard' || 
            updatedWidget.displayFormat === 'ActivityFeed' ||
            updatedWidget.displayFormat === 'MapCard') {
          newWidth = updatedWidget.config.size === 'square' ? 6 : 12;
        } else if (updatedWidget.displayFormat === 'MetricCard' && updatedWidget.config.displayMode === 'compact') {
          newWidth = 4;
        } else {
          newWidth = 4;
        }
      }
      
      // Update layout for all breakpoints
      if (currentLayouts.lg) {
        const layoutIndex = currentLayouts.lg.findIndex(item => item.i === updatedWidget.id);
        if (layoutIndex !== -1) {
          currentLayouts.lg[layoutIndex] = {
            ...currentLayouts.lg[layoutIndex],
            w: newWidth
          };
        }
      }
      
      if (currentLayouts.md) {
        const layoutIndex = currentLayouts.md.findIndex(item => item.i === updatedWidget.id);
        if (layoutIndex !== -1) {
          currentLayouts.md[layoutIndex] = {
            ...currentLayouts.md[layoutIndex],
            w: newWidth === 12 ? 8 : (newWidth === 6 ? 4 : 4)
          };
        }
      }
      
      if (currentLayouts.sm) {
        const layoutIndex = currentLayouts.sm.findIndex(item => item.i === updatedWidget.id);
        if (layoutIndex !== -1) {
          currentLayouts.sm[layoutIndex] = {
            ...currentLayouts.sm[layoutIndex],
            w: 6 // Always full width on small screens
          };
        }
      }
      
      setLayouts(currentLayouts);
    }
    
    setIsDirty(true);
    setEditingWidget(null);
    setShowWidgetConfig(false);
  };

  const removeWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    
    const newLayouts = {
      lg: (layouts.lg || []).filter(item => item.i !== widgetId),
      md: (layouts.md || []).filter(item => item.i !== widgetId),
      sm: (layouts.sm || []).filter(item => item.i !== widgetId)
    };
    
    setLayouts(newLayouts);
    setIsDirty(true);
  };

  const handleEditWidget = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    setShowWidgetConfig(true);
  };

  const handleVariantChange = (widgetId: string, variant: 'variant1' | 'variant2' | 'variant3') => {
    setWidgetVariants(prev => ({ ...prev, [widgetId]: variant }));
    setIsDirty(true);
  };

  
  const handleDateRangeChange = (newDateRange: string) => {
    setDateRange(newDateRange);
  };

  return (
    <div className="customizable-dashboard">
      {/* Dashboard Header */}
      <DashboardHeader
        title={customPageData?.name || "Analytics Dashboard"}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onRefresh={refreshData}
        isEditMode={isEditMode}
        onEditModeToggle={() => {
          setIsEditMode(!isEditMode);
          if (!isEditMode) {
            setShowWidgetPalette(true);
          } else {
            setShowWidgetPalette(false);
          }
        }}
        onTitleChange={customPageData ? async (newTitle: string) => {
          try {
            await analyticsPageService.updatePage(customPageData.id, { name: newTitle });
            // Update local state if needed - the parent component should handle this
            console.log('Page title updated to:', newTitle);
          } catch (error) {
            console.error('Failed to update page title:', error);
          }
        } : undefined}
      />
      
      {/* Action Bar */}
      {isEditMode && (
        <div className="dashboard-actions">
          <div className="actions-left">
            {isDirty && <span className="unsaved-indicator">Unsaved changes</span>}
          </div>
          <div className="actions-right">
            <button 
              className="action-btn add-widget-btn"
              onClick={() => setShowWidgetPalette(!showWidgetPalette)}
            >
              <FaPlus /> Add Widget
            </button>
            <button 
              className="action-btn save-btn"
              onClick={saveDashboardLayout}
              disabled={!isDirty}
            >
              <FaSave /> Save Layout
            </button>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <div 
        className={`dashboard-grid-container ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <ResponsiveGridLayout
          className="dashboard-grid"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 8, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={64}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".widget-drag-handle"
          compactType="vertical"
          preventCollision={false}
        >
        {widgets.map(widget => (
          <div key={widget.id} className="dashboard-widget-wrapper">
            {isEditMode && (
              <div className="widget-edit-overlay">
                <div className="widget-drag-handle">
                  <FaGripVertical />
                </div>
                <button 
                  className="widget-config-btn"
                  onClick={() => handleEditWidget(widget)}
                >
                  <FaCog />
                </button>
                <button 
                  className="widget-remove-btn"
                  onClick={() => removeWidget(widget.id)}
                >
                  <FaTimes />
                </button>
              </div>
            )}
            <DashboardWidget 
              widget={widget}
              variant={widgetVariants[widget.id] || widget.config.variant || 'variant1'}
              onVariantChange={(variant) => handleVariantChange(widget.id, variant)}
              isEditMode={isEditMode}
              dashboardData={dashboardData}
              loading={dashboardLoading}
              dateRange={dateRange}
            />
          </div>
        ))}
        </ResponsiveGridLayout>
      </div>

      {/* Widget Library Modal */}
      {showWidgetLibrary && (
        <WidgetLibraryModal
          onClose={() => setShowWidgetLibrary(false)}
          onAddWidget={addWidget}
          existingWidgets={widgets}
        />
      )}

      {/* Widget Configuration Modal */}
      {showWidgetConfig && editingWidget && (
        <WidgetConfigModal
          widget={editingWidget}
          onClose={() => {
            setShowWidgetConfig(false);
            setEditingWidget(null);
          }}
          onSave={updateWidget}
        />
      )}

      {/* Widget Palette */}
      <WidgetPalette
        isVisible={showWidgetPalette}
        onDragStart={() => {}} // Template data already in drag event
        onClose={() => setShowWidgetPalette(false)}
      />
    </div>
  );
};

export default CustomizableDashboard;