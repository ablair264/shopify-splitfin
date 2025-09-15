// Enhanced widget templates leveraging your full schema
import React from 'react';
import { HandCoins, Box, Truck, TriangleAlert, ChartBar, ClockAlert, FilePlus2, Warehouse } from 'lucide-react';

export const expandedWidgetTemplates = [
  // ============== FINANCIAL METRICS ==============
  {
    id: 'gross-margin-metric',
    name: 'Gross Margin',
    description: 'Display gross margin percentage',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'financial_metrics_aggregated',
    icon: <HandCoins />,
    config: {
      metric: 'gross_margin_percent',
      showTrend: true,
      dateRange: '30_days',
      displayMode: 'medium',
      format: 'percentage'
    }
  },
  {
    id: 'cash-flow-metric',
    name: 'Cash Collected',
    description: 'Total cash collected this period',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'financial_metrics_aggregated',
    icon: <HandCoins />,
    config: {
      metric: 'cash_collected',
      showTrend: true,
      dateRange: '30_days',
      displayMode: 'medium',
      format: 'currency'
    }
  },
  {
    id: 'overdue-receivables',
    name: 'Overdue Receivables',
    description: 'Amount of overdue receivables',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'financial_metrics_aggregated',
    icon: <TriangleAlert />,
    config: {
      metric: 'overdue_receivables',
      showTrend: false,
      dateRange: 'current',
      displayMode: 'compact',
      format: 'currency',
      alertThreshold: 10000
    }
  },
  {
    id: 'days-sales-outstanding',
    name: 'Days Sales Outstanding',
    description: 'Average collection period',
    type: 'metric',
    displayFormat: 'MetricCardSquare',
    dataSource: 'financial_metrics_aggregated',
    icon: <ClockAlert />,
    config: {
      metric: 'days_sales_outstanding',
      showTrend: true,
      dateRange: '30_days',
      format: 'days'
    }
  },

  // ============== INVENTORY METRICS ==============
  {
    id: 'stock-value-metric',
    name: 'Total Stock Value',
    description: 'Current inventory value',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'inventory_metrics_aggregated',
    icon: <Box />,
    config: {
      metric: 'total_stock_value',
      showTrend: true,
      dateRange: 'current',
      displayMode: 'large',
      format: 'currency'
    }
  },
  {
    id: 'low-stock-alert',
    name: 'Low Stock Items',
    description: 'Items below reorder level',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'inventory_metrics_aggregated',
    icon: <TriangleAlert />,
    config: {
      metric: 'items_below_reorder',
      showTrend: false,
      dateRange: 'current',
      displayMode: 'compact',
      alertThreshold: 1,
      alertColor: '#ef4444'
    }
  },
  {
    id: 'inventory-turnover',
    name: 'Inventory Turnover',
    description: 'Inventory turnover ratio',
    type: 'metric',
    displayFormat: 'MetricCardSquare',
    dataSource: 'inventory_metrics_aggregated',
    icon: <ChartBar />,
    config: {
      metric: 'inventory_turnover_ratio',
      showTrend: true,
      dateRange: '30_days',
      format: 'ratio'
    }
  },
  {
    id: 'stock-accuracy',
    name: 'Stock Accuracy',
    description: 'Inventory accuracy percentage',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'inventory_metrics_aggregated',
    icon: <Warehouse />,
    config: {
      metric: 'stock_accuracy_percent',
      showTrend: false,
      dateRange: 'current',
      displayMode: 'compact',
      format: 'percentage',
      targetValue: 99
    }
  },

  // ============== CUSTOMER ANALYTICS ==============
  {
    id: 'customer-lifetime-value',
    name: 'Average Customer LTV',
    description: 'Average lifetime value per customer',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'customer_analytics_aggregated',
    icon: <ClockAlert />,
    config: {
      metric: 'lifetime_value',
      aggregation: 'average',
      showTrend: true,
      dateRange: '90_days',
      displayMode: 'medium',
      format: 'currency'
    }
  },
  {
    id: 'payment-performance',
    name: 'Payment Performance Score',
    description: 'Customer payment reliability',
    type: 'metric',
    displayFormat: 'MetricCardSquare',
    dataSource: 'customer_analytics_aggregated',
    icon: <FilePlus2 />,
    config: {
      metric: 'payment_performance_score',
      aggregation: 'average',
      showTrend: true,
      dateRange: '30_days',
      format: 'score'
    }
  },
  {
    id: 'customer-segments-chart',
    name: 'Customer Segments',
    description: 'Distribution by customer segment',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'customer_analytics_aggregated',
    icon: <ChartBar />,
    config: {
      groupBy: 'customer_segment',
      metric: 'total_spent',
      chartType: 'pie',
      dateRange: '90_days'
    }
  },

  // ============== SALES PERFORMANCE ==============
  {
    id: 'revenue-growth-rate',
    name: 'Revenue Growth',
    description: 'Revenue growth percentage',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'sales_performance_aggregated',
    icon: <ChartBar />,
    config: {
      metric: 'revenue_growth_percent',
      showTrend: true,
      dateRange: '30_days',
      displayMode: 'medium',
      format: 'percentage',
      trendInverted: false
    }
  },
  {
    id: 'new-vs-repeat-customers',
    name: 'New vs Repeat Customers',
    description: 'Customer acquisition breakdown',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'sales_performance_aggregated',
    icon: <ChartBar />,
    config: {
      metrics: ['new_customers', 'repeat_customers'],
      chartType: 'stacked-bar',
      dateRange: '30_days'
    }
  },
  {
    id: 'order-status-breakdown',
    name: 'Order Status Distribution',
    description: 'Orders by current status',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'sales_performance_aggregated',
    icon: <ChartBar />,
    config: {
      metrics: ['pending_orders', 'confirmed_orders', 'shipped_orders', 'delivered_orders', 'cancelled_orders'],
      chartType: 'donut',
      dateRange: 'current'
    }
  },

  // ============== PRODUCT PERFORMANCE ==============
  {
    id: 'top-products-by-revenue',
    name: 'Top Products by Revenue',
    description: 'Best performing products',
    type: 'table',
    displayFormat: 'DataTable',
    dataSource: 'product_performance_aggregated',
    icon: <Box />,
    config: {
      columns: [
        { key: 'item_name', header: 'Product', width: '40%' },
        { key: 'quantity_sold', header: 'Units Sold', width: '20%' },
        { key: 'revenue_generated', header: 'Revenue', width: '25%', format: 'currency' },
        { key: 'sell_through_rate', header: 'Sell-Through', width: '15%', format: 'percentage' }
      ],
      sortBy: 'revenue_generated',
      limit: 10
    }
  },
  {
    id: 'brand-performance-chart',
    name: 'Brand Performance',
    description: 'Sales by brand',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'brand_trends_aggregated',
    icon: <ChartBar />,
    config: {
      groupBy: 'brand_name',
      metric: 'total_quantity',
      chartType: 'bar',
      dateRange: '30_days'
    }
  },

  // ============== SHIPPING & LOGISTICS ==============
  {
    id: 'shipment-status-overview',
    name: 'Shipment Status',
    description: 'Current shipment statuses',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'shipments',
    icon: <Truck />,
    config: {
      groupBy: 'shipment_status',
      chartType: 'pie',
      dateRange: '7_days'
    }
  },
  {
    id: 'delivery-performance',
    name: 'On-Time Delivery Rate',
    description: 'Percentage of on-time deliveries',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'shipments',
    icon: <Truck />,
    config: {
      metric: 'on_time_delivery_rate',
      calculated: true,
      showTrend: true,
      dateRange: '30_days',
      displayMode: 'medium',
      format: 'percentage',
      targetValue: 95
    }
  },

  // ============== BACKORDERS & PURCHASING ==============
  {
    id: 'backorder-value',
    name: 'Total Backorder Value',
    description: 'Value of items on backorder',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'backorders',
    icon: <TriangleAlert />,
    config: {
      metric: 'backorder_value',
      aggregation: 'sum',
      showTrend: false,
      dateRange: 'current',
      displayMode: 'compact',
      format: 'currency',
      alertThreshold: 1
    }
  },
  {
    id: 'backorder-items-table',
    name: 'Active Backorders',
    description: 'Items currently on backorder',
    type: 'table',
    displayFormat: 'TableCard',
    dataSource: 'backorders',
    icon: <Box />,
    config: {
      columns: [
        { key: 'brand_name', header: 'Brand', width: '25%' },
        { key: 'items_on_backorder', header: 'Items', width: '20%' },
        { key: 'items_outstanding', header: 'Outstanding', width: '20%' },
        { key: 'expected_arrival_date', header: 'Expected', width: '20%', format: 'date' },
        { key: 'backorder_value', header: 'Value', width: '15%', format: 'currency' }
      ],
      filter: { backorder_status: 'pending' }
    }
  },

  // ============== ENQUIRIES & LEADS ==============
  {
    id: 'lead-conversion-rate',
    name: 'Lead Conversion Rate',
    description: 'Percentage of leads converted',
    type: 'metric',
    displayFormat: 'MetricCard',
    dataSource: 'enquiries',
    icon: <ClockAlert />,
    config: {
      metric: 'conversion_rate',
      calculated: true,
      showTrend: true,
      dateRange: '30_days',
      displayMode: 'medium',
      format: 'percentage'
    }
  },
  {
    id: 'enquiry-pipeline',
    name: 'Enquiry Pipeline',
    description: 'Enquiries by status',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'enquiries',
    icon: <ChartBar />,
    config: {
      groupBy: 'status',
      metric: 'estimated_value',
      chartType: 'funnel',
      dateRange: 'current'
    }
  },
  {
    id: 'lead-sources-breakdown',
    name: 'Lead Sources',
    description: 'Enquiries by source',
    type: 'chart',
    displayFormat: 'FullGraph',
    dataSource: 'enquiries',
    icon: <ChartBar />,
    config: {
      groupBy: 'lead_source',
      chartType: 'donut',
      dateRange: '90_days'
    }
  },

  // ============== ACTIVITY FEEDS ==============
  {
    id: 'order-activity-feed',
    name: 'Recent Order Activity',
    description: 'Live feed of order updates',
    type: 'activity',
    displayFormat: 'ActivityFeed',
    dataSource: 'orders',
    icon: <ChartBar />,
    config: {
      refreshInterval: 30,
      limit: 10,
      showTimestamp: true
    }
  },
  {
    id: 'stock-movement-feed',
    name: 'Stock Movements',
    description: 'Recent inventory changes',
    type: 'activity',
    displayFormat: 'ActivityFeed',
    dataSource: 'inventory_metrics_aggregated',
    icon: <Box />,
    config: {
      refreshInterval: 60,
      limit: 10,
      metrics: ['items_received', 'items_sold', 'items_returned']
    }
  }
];
