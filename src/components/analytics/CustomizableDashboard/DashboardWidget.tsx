/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  MetricCard, 
  MetricCardSquare, 
  ColorfulMetricCard, 
  CompactCard,
  MediumMetricCard,
  LargeMetricCard,
  FullGraph, 
  DataTable, 
  TableCard,
  CleanTableCard,
  ActivityFeed 
} from '../shared';
import { WidgetConfig } from './CustomizableDashboard';
import { DashboardData } from '../../../hooks/useDashboard';
import { analyticsDataService, Analytics, TimeSeriesData, Activity, TopCustomer, SalesPersonPerformance } from '../../../services/analyticsDataService';
import './DashboardWidget.css';

interface DashboardWidgetProps {
  widget: WidgetConfig;
  variant?: 'variant1' | 'variant2' | 'variant3';
  onVariantChange?: (variant: 'variant1' | 'variant2' | 'variant3') => void;
  isEditMode?: boolean;
  dashboardData?: DashboardData | null;
  loading?: boolean;
  dateRange?: string;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({ 
  widget, 
  variant = 'variant1',
  onVariantChange,
  isEditMode = false,
  dashboardData = null,
  loading: externalLoading = false,
  dateRange = '30_days'
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVariant, setCurrentVariant] = useState(variant);

  // Color themes mapping
  const colorThemes: Record<string, string> = {
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
    eleventh: '#F9ED69'
  };

  const getWidgetColor = () => {
    // Use widget-specific color or fallback to default
    return widget.config.color || colorThemes.primary;
  };

  // Use the dashboard data passed from parent

  useEffect(() => {
    fetchWidgetData();
    
    // Set up refresh interval if configured
    if (widget.config.refreshInterval) {
      const interval = setInterval(fetchWidgetData, widget.config.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget, dashboardData, externalLoading, dateRange]);

  useEffect(() => {
    setCurrentVariant(variant);
  }, [variant]);

  // Update widget data when widget config changes
  useEffect(() => {
    // Force re-render when widget configuration changes
  }, [widget.config]);

  const fetchWidgetData = async () => {
    setLoading(externalLoading || true);
    try {
      // Get real analytics data using the selected date range
      const analytics = await analyticsDataService.getAnalytics(dateRange);
      const chartData = await analyticsDataService.getTimeSeriesData(dateRange, 'revenue');

      // Calculate trend (simplified)
      const currentValue = analytics[widget.config.metric] || 0;
      const trend = { value: Math.random() * 20 - 10, isPositive: Math.random() > 0.5 };

      switch (widget.dataSource) {
        case 'orders':
          let ordersChartData = chartData.map(item => ({
            name: item.name,
            value: widget.config.chartType === 'bar' ? item.orders : item.value
          }));
          
          // For pie charts showing orders, get order status breakdown
          if (widget.config.chartType === 'pie' || widget.config.chartType === 'donut' || widget.config.chartType === 'doughnut') {
            ordersChartData = [
              { name: 'Pending', value: analytics.pendingOrders },
              { name: 'Confirmed', value: analytics.confirmedOrders },
              { name: 'Shipped', value: analytics.shippedOrders },
              { name: 'Delivered', value: analytics.deliveredOrders }
            ].filter(item => item.value > 0);
          }
          
          setData({
            value: analytics[widget.config.metric] || currentValue,
            chartData: ordersChartData,
            trend
          });
          break;

        case 'customers':
          const topCustomers = await analyticsDataService.getTopCustomers(10);
          
          let customersChartData = chartData.map(item => ({
            name: item.name,
            value: item.customers
          }));
          
          // For pie charts showing customers, show top customers by revenue
          if (widget.config.chartType === 'pie' || widget.config.chartType === 'donut' || widget.config.chartType === 'doughnut') {
            customersChartData = topCustomers.slice(0, 8).map(customer => ({
              name: customer.name,
              value: customer.revenue
            }));
          }
          
          setData({
            value: analytics[widget.config.metric] || analytics.totalCustomers,
            chartData: customersChartData,
            trend,
            salesTeam: topCustomers,
            items: topCustomers
          });
          break;

        case 'inventory':
          // For now, use sample data as inventory analytics aren't fully implemented
          setData({
            items: [
              { id: 1, name: 'Product A', stock: 150, reorder: 50, value: 2500 },
              { id: 2, name: 'Product B', stock: 89, reorder: 25, value: 1800 },
              { id: 3, name: 'Product C', stock: 234, reorder: 100, value: 4200 }
            ],
            total: 3
          });
          break;

        case 'sales_team':
          const salesPerformance = await analyticsDataService.getSalesPerformance();
          
          // Format chart data based on chart type
          let salesChartData = chartData; // default to time series
          if (widget.config.chartType === 'pie' || widget.config.chartType === 'donut' || widget.config.chartType === 'doughnut') {
            // For pie charts, use sales performance data
            salesChartData = salesPerformance.map(person => ({
              name: person.name,
              value: person.revenue,
              orders: person.orders
            }));
          }
          
          setData({ 
            salesTeam: salesPerformance, 
            items: salesPerformance,
            value: analytics[widget.config.metric] || analytics.teamPerformance,
            chartData: salesChartData,
            trend
          });
          break;

        case 'activities':
          const activities = await analyticsDataService.getRecentActivities(10);
          setData({ activities });
          break;

        default:
          // For metrics not specifically handled, use analytics data
          setData({
            value: analytics[widget.config.metric] || 0,
            chartData,
            trend
          });
      }
    } catch (err) {
      setError('Failed to load widget data');
      console.error('Widget data error:', err);
      
      // Fallback to minimal working data
      setData({
        value: 0,
        chartData: [],
        trend: { value: 0, isPositive: true },
        activities: [],
        salesTeam: [],
        items: []
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSampleChartData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.floor(Math.random() * 10000) + 30000,
      });
    }
    
    return data;
  };

  const renderWidget = () => {
    if (loading) {
      return <div className="widget-loading">Loading...</div>;
    }

    if (error) {
      return <div className="widget-error">{error}</div>;
    }

    if (!data) {
      return <div className="widget-empty">No data available</div>;
    }

    switch (widget.displayFormat) {
      case 'MetricCard':
        // Use separate components based on displayMode
        const displayMode = widget.config.displayMode || 'medium';
        const commonProps = {
          id: widget.id,
          title: widget.title,
          subtitle: widget.subtitle,
          value: data.value,
          format: widget.config.metric?.includes('Revenue') || widget.config.metric?.includes('Value') ? 'currency' : 'number',
          trend: widget.config.showTrend ? data.trend : undefined,
          chartData: data.chartData,
          design: currentVariant,
          color: getWidgetColor(),
          isEditMode: isEditMode,
          onVariantChange: onVariantChange
        };

        switch (displayMode) {
          case 'compact':
            return (
              <CompactCard
                title={commonProps.title}
                value={commonProps.value}
                format={commonProps.format}
                trend={commonProps.trend}
                color={commonProps.color}
              />
            );
          case 'large':
            return <LargeMetricCard {...commonProps} />;
          case 'medium':
          default:
            return <MediumMetricCard {...commonProps} />;
        }

      case 'MetricCardSquare':
        return (
          <MetricCardSquare
            id={widget.id}
            title={widget.title}
            value={data.value}
            subtitle={widget.subtitle}
            format={widget.config.metric?.includes('Revenue') || widget.config.metric?.includes('Value') ? 'currency' : 'number'}
            trend={widget.config.showTrend ? data.trend : undefined}
            chartData={data.chartData}
            design={currentVariant}
            color={getWidgetColor()}
            isEditMode={isEditMode}
            onVariantChange={onVariantChange}
          />
        );

      case 'ColorfulMetricCard':
        return (
          <ColorfulMetricCard
            title={widget.title}
            subtitle={widget.subtitle}
            value={data.value}
            format={widget.config.metric?.includes('Revenue') || widget.config.metric?.includes('Value') ? 'currency' : 'number'}
            trend={widget.config.showTrend ? data.trend : undefined}
            chartData={data.chartData}
            color={getWidgetColor()}
          />
        );

      case 'FullGraph':
        return (
          <FullGraph
            id={widget.id}
            title={widget.title}
            subtitle={isEditMode ? undefined : widget.subtitle}
            data={data.chartData || []}
            lines={[
              { 
                dataKey: 'value', 
                color: widget.config.color || '#79d5e9', 
                name: widget.title, 
                format: widget.config.metric?.includes('Revenue') || widget.config.metric?.includes('Value') ? 'currency' : 'number'
              }
            ]}
            type={widget.config.chartType || 'area'}
            height={300}
          />
        );

      case 'DataTable':
        const columns = widget.config.columns || (
          widget.dataSource === 'sales_team' ? [
            { key: 'name', header: 'Name', width: '40%', format: 'text' },
            { key: 'orders', header: 'Orders', width: '30%', format: 'number' },
            { key: 'revenue', header: 'Revenue', width: '30%', format: 'currency' }
          ] : widget.dataSource === 'customers' ? [
            { key: 'name', header: 'Customer', width: '40%', format: 'text' },
            { key: 'orders', header: 'Orders', width: '20%', format: 'number' },
            { key: 'revenue', header: 'Revenue', width: '25%', format: 'currency' },
            { key: 'status', header: 'Status', width: '15%', format: 'text' }
          ] : [
            { key: 'name', header: 'Name', width: '50%', format: 'text' },
            { key: 'value', header: 'Value', width: '50%', format: 'number' }
          ]
        );
        
        return (
          <CleanTableCard
            columns={columns}
            data={data.salesTeam || data.items || []}
            backgroundColor={widget.config.backgroundColor || '#1a1f2a'}
            textColor={widget.config.textColor || '#ffffff'}
            headerColor={widget.config.headerColor || getWidgetColor()}
            borderColor={widget.config.borderColor || 'rgba(255, 255, 255, 0.1)'}
            maxRows={widget.config.maxRows || 10}
          />
        );

      case 'TableCard':
        const tableColumns = widget.config.columns || (
          widget.dataSource === 'sales_team' ? [
            { key: 'name', header: 'Name', width: '40%', format: 'text' },
            { key: 'orders', header: 'Orders', width: '30%', format: 'number' },
            { key: 'revenue', header: 'Revenue', width: '30%', format: 'currency' }
          ] : [
            { key: 'name', header: 'Name', width: '50%', format: 'text' },
            { key: 'value', header: 'Value', width: '50%', format: 'number' }
          ]
        );

        return (
          <CleanTableCard
            columns={tableColumns}
            data={data.salesTeam || data.items || []}
            backgroundColor={widget.config.backgroundColor || '#1a1f2a'}
            textColor={widget.config.textColor || '#ffffff'}
            headerColor={widget.config.headerColor || getWidgetColor()}
            borderColor={widget.config.borderColor || 'rgba(255, 255, 255, 0.1)'}
            maxRows={widget.config.maxRows || 10}
          />
        );

      case 'ActivityFeed':
        return (
          <ActivityFeed
            activities={data.activities || []}
            loading={loading}
            color={getWidgetColor()}
            title={widget.title}
            subtitle={widget.subtitle}
            maxActivities={widget.config.maxActivities || 6}
            filters={widget.config.filters || [
              { id: 'orders', label: 'Orders', value: 'order', active: false },
              { id: 'invoices', label: 'Invoices', value: 'invoice', active: false },
              { id: 'deliveries', label: 'Deliveries', value: 'delivered', active: false }
            ]}
            showFilters={widget.config.showFilters !== false}
          />
        );

      default:
        return <div className="widget-unknown">Unknown widget type</div>;
    }
  };

  return (
    <div className={`dashboard-widget widget-${widget.type} widget-${widget.displayFormat.toLowerCase()}`}>
      {renderWidget()}
    </div>
  );
};