// Widget Configuration with expanded data sources based on your schema
export const widgetDataSources = {
  // Sales Performance Metrics
  sales: {
    totalRevenue: {
      query: 'sales_performance_aggregated',
      metrics: ['total_revenue', 'revenue_growth_percent'],
      periods: ['today', 'week', 'month', 'quarter', 'year']
    },
    orderMetrics: {
      query: 'sales_performance_aggregated',
      metrics: ['total_orders', 'average_order_value', 'order_growth_percent'],
      statuses: ['pending_orders', 'confirmed_orders', 'shipped_orders', 'delivered_orders', 'cancelled_orders']
    },
    customerActivity: {
      query: 'sales_performance_aggregated',
      metrics: ['unique_customers', 'new_customers', 'repeat_customers']
    }
  },

  // Customer Analytics
  customers: {
    segments: {
      query: 'customer_analytics_aggregated',
      metrics: ['total_spent', 'order_count', 'lifetime_value', 'average_order_value'],
      groupBy: ['customer_segment']
    },
    paymentPerformance: {
      query: 'customer_analytics_aggregated',
      metrics: ['on_time_payments', 'late_payments', 'payment_performance_score']
    },
    engagement: {
      query: 'customer_analytics_aggregated',
      metrics: ['days_since_last_order', 'order_frequency_days']
    },
    geographic: {
      query: 'customers',
      metrics: ['coordinates', 'billing_city_town', 'shipping_city_town'],
      visualization: 'map'
    }
  },

  // Financial Metrics
  finance: {
    revenue: {
      query: 'financial_metrics_aggregated',
      metrics: ['gross_revenue', 'net_revenue', 'gross_margin', 'gross_margin_percent']
    },
    cashFlow: {
      query: 'financial_metrics_aggregated',
      metrics: ['cash_collected', 'total_receivables', 'overdue_receivables', 'days_sales_outstanding']
    },
    invoices: {
      query: 'invoices',
      metrics: ['total', 'balance'],
      statuses: ['draft', 'sent', 'overdue', 'paid'],
      groupBy: ['invoice_status', 'customer_id']
    },
    discounts: {
      query: 'financial_metrics_aggregated',
      metrics: ['discounts_given', 'returns_value']
    }
  },

  // Inventory Management
  inventory: {
    stockLevels: {
      query: 'inventory_metrics_aggregated',
      metrics: ['total_stock_value', 'total_items_in_stock', 'unique_skus']
    },
    stockMovement: {
      query: 'inventory_metrics_aggregated',
      metrics: ['items_received', 'items_sold', 'items_returned', 'inventory_turnover_ratio']
    },
    stockAlerts: {
      query: 'inventory_metrics_aggregated',
      metrics: ['items_below_reorder', 'items_out_of_stock', 'items_overstocked'],
      alertThresholds: true
    },
    warehouseMetrics: {
      query: 'inventory_metrics_aggregated',
      groupBy: ['warehouse_id'],
      metrics: ['stock_accuracy_percent', 'days_inventory_outstanding']
    }
  },

  // Product Performance
  products: {
    topPerformers: {
      query: 'product_performance_aggregated',
      metrics: ['quantity_sold', 'revenue_generated', 'sell_through_rate'],
      sortBy: 'revenue_generated',
      limit: 10
    },
    productTrends: {
      query: 'product_performance_aggregated',
      metrics: ['times_ordered', 'contribution_margin', 'return_rate'],
      timeline: true
    },
    brandPerformance: {
      query: 'brand_trends_aggregated',
      metrics: ['total_quantity', 'order_count'],
      groupBy: ['brand_name']
    }
  },

  // Order Management
  orders: {
    orderStatus: {
      query: 'orders',
      groupBy: ['order_status'],
      metrics: ['count', 'total'],
      realtime: true
    },
    returns: {
      query: 'orders',
      filter: 'returns = true',
      metrics: ['count', 'return_reason'],
      groupBy: ['return_reason']
    },
    orderTimeline: {
      query: 'orders',
      metrics: ['order_date', 'order_status'],
      visualization: 'timeline'
    }
  },

  // Shipping & Logistics
  shipping: {
    shipmentStatus: {
      query: 'shipments',
      groupBy: ['shipment_status'],
      metrics: ['count', 'courier_id']
    },
    deliveryPerformance: {
      query: 'shipments',
      metrics: ['date_shipped', 'date_delivered', 'estimated_delivery_date'],
      calculated: ['on_time_delivery_rate', 'average_delivery_time']
    },
    failedDeliveries: {
      query: 'shipments',
      filter: 'non_delivered = true',
      metrics: ['non_delivered_reason', 'customer_id']
    }
  },

  // Purchase Orders & Backorders
  purchasing: {
    purchaseOrders: {
      query: 'purchase_orders',
      groupBy: ['order_status', 'brand_id'],
      metrics: ['order_total', 'quantity_of_items']
    },
    backorders: {
      query: 'backorders',
      groupBy: ['backorder_status'],
      metrics: ['items_on_backorder', 'backorder_value', 'items_outstanding'],
      alertOnBackorder: true
    },
    supplierPerformance: {
      query: 'purchase_orders',
      metrics: ['estimated_arrival', 'is_shipped'],
      calculated: ['on_time_delivery_rate']
    }
  },

  // Lead & Enquiry Management
  enquiries: {
    leadPipeline: {
      query: 'enquiries',
      groupBy: ['status', 'priority'],
      metrics: ['count', 'estimated_value']
    },
    conversionFunnel: {
      query: 'enquiries',
      metrics: ['converted_to_customer', 'conversion_date'],
      calculated: ['conversion_rate', 'average_conversion_time']
    },
    leadSources: {
      query: 'enquiries',
      groupBy: ['lead_source'],
      metrics: ['count', 'estimated_value', 'converted_to_customer']
    }
  },

  // Customer Communications
  communications: {
    conversations: {
      query: 'conversations',
      groupBy: ['status', 'priority'],
      metrics: ['count', 'resolved_at'],
      calculated: ['average_resolution_time']
    },
    notifications: {
      query: 'notifications',
      groupBy: ['notification_type', 'priority'],
      filter: 'read = false',
      metrics: ['count'],
      realtime: true
    }
  }
};

// Widget Templates with expanded options
export const widgetTemplates = {
  // Metric Cards
  metricCards: [
    { id: 'revenue-today', name: 'Today\'s Revenue', dataSource: 'sales.totalRevenue', period: 'today' },
    { id: 'orders-pending', name: 'Pending Orders', dataSource: 'orders.orderStatus', filter: 'pending' },
    { id: 'stock-value', name: 'Total Stock Value', dataSource: 'inventory.stockLevels' },
    { id: 'overdue-receivables', name: 'Overdue Receivables', dataSource: 'finance.cashFlow' },
    { id: 'new-customers-month', name: 'New Customers This Month', dataSource: 'sales.customerActivity' },
    { id: 'backorder-value', name: 'Backorder Value', dataSource: 'purchasing.backorders' },
    { id: 'conversion-rate', name: 'Lead Conversion Rate', dataSource: 'enquiries.conversionFunnel' },
    { id: 'avg-delivery-time', name: 'Avg Delivery Time', dataSource: 'shipping.deliveryPerformance' }
  ],

  // Chart Widgets
  charts: [
    { id: 'revenue-trend', name: 'Revenue Trend', type: 'line', dataSource: 'sales.totalRevenue' },
    { id: 'order-status-pie', name: 'Order Status Distribution', type: 'pie', dataSource: 'orders.orderStatus' },
    { id: 'brand-performance', name: 'Brand Performance', type: 'bar', dataSource: 'products.brandPerformance' },
    { id: 'customer-segments', name: 'Customer Segments', type: 'donut', dataSource: 'customers.segments' },
    { id: 'inventory-turnover', name: 'Inventory Turnover', type: 'area', dataSource: 'inventory.stockMovement' },
    { id: 'payment-performance', name: 'Payment Performance', type: 'stacked-bar', dataSource: 'customers.paymentPerformance' },
    { id: 'lead-sources', name: 'Lead Sources', type: 'funnel', dataSource: 'enquiries.leadSources' },
    { id: 'shipment-status', name: 'Shipment Status', type: 'radial', dataSource: 'shipping.shipmentStatus' }
  ],

  // Table Widgets
  tables: [
    { id: 'top-products', name: 'Top Selling Products', dataSource: 'products.topPerformers' },
    { id: 'recent-orders', name: 'Recent Orders', dataSource: 'orders.orderTimeline' },
    { id: 'customer-list', name: 'Customer Performance', dataSource: 'customers.segments' },
    { id: 'low-stock-items', name: 'Low Stock Alert', dataSource: 'inventory.stockAlerts' },
    { id: 'pending-invoices', name: 'Pending Invoices', dataSource: 'finance.invoices' },
    { id: 'active-backorders', name: 'Active Backorders', dataSource: 'purchasing.backorders' },
    { id: 'open-enquiries', name: 'Open Enquiries', dataSource: 'enquiries.leadPipeline' },
    { id: 'failed-deliveries', name: 'Failed Deliveries', dataSource: 'shipping.failedDeliveries' }
  ],

  // Activity Feeds
  activities: [
    { id: 'recent-activity', name: 'Recent Activity', dataSource: 'mixed', realtime: true },
    { id: 'order-updates', name: 'Order Updates', dataSource: 'orders.orderStatus', realtime: true },
    { id: 'stock-movements', name: 'Stock Movements', dataSource: 'inventory.stockMovement' },
    { id: 'customer-interactions', name: 'Customer Interactions', dataSource: 'communications.conversations' },
    { id: 'system-notifications', name: 'System Notifications', dataSource: 'communications.notifications' }
  ],

  // Map Widgets
  maps: [
    { id: 'customer-map', name: 'Customer Distribution', dataSource: 'customers.geographic' },
    { id: 'delivery-map', name: 'Active Deliveries', dataSource: 'shipping.deliveryPerformance' },
    { id: 'warehouse-locations', name: 'Warehouse Network', dataSource: 'inventory.warehouseMetrics' }
  ],

  // KPI Dashboards
  kpiSets: [
    {
      id: 'sales-kpis',
      name: 'Sales KPIs',
      metrics: ['revenue', 'orders', 'aov', 'conversion_rate', 'customer_acquisition']
    },
    {
      id: 'inventory-kpis',
      name: 'Inventory KPIs',
      metrics: ['stock_value', 'turnover_ratio', 'stockout_rate', 'accuracy']
    },
    {
      id: 'financial-kpis',
      name: 'Financial KPIs',
      metrics: ['gross_margin', 'dso', 'cash_flow', 'receivables']
    }
  ]
};

// Widget size configurations
export const widgetSizes = {
  xs: { w: 3, h: 2 },  // Small metric card
  sm: { w: 4, h: 3 },  // Standard metric card
  md: { w: 6, h: 4 },  // Half-width chart
  lg: { w: 8, h: 5 },  // Large chart
  xl: { w: 12, h: 6 }, // Full-width chart
  table: { w: 12, h: 8 }, // Table widget
  map: { w: 12, h: 10 }   // Map widget
};

// Real-time update intervals (in seconds)
export const updateIntervals = {
  realtime: 5,
  frequent: 30,
  standard: 60,
  slow: 300
};

// Alert thresholds
export const alertThresholds = {
  inventory: {
    lowStock: 10,
    outOfStock: 0,
    overstock: 200
  },
  finance: {
    overdueInvoices: 30, // days
    receivablesThreshold: 10000 // amount
  },
  orders: {
    pendingThreshold: 10,
    processingDelay: 2 // days
  }
};
