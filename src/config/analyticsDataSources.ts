// Analytics Data Sources Configuration
// Maps analytics widgets to their aggregated data sources for optimal performance

export interface DataSourceConfig {
  table: string;
  description: string;
  filters?: string[];
  metrics: {
    [key: string]: {
      field: string;
      aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
      format?: 'currency' | 'number' | 'percent';
      label: string;
    };
  };
  dimensions?: {
    [key: string]: {
      field: string;
      label: string;
      type: 'date' | 'string' | 'number';
    };
  };
  defaultPeriod?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export const ANALYTICS_DATA_SOURCES: { [key: string]: DataSourceConfig } = {
  // Sales Performance Metrics
  salesRevenue: {
    table: 'sales_performance_aggregated',
    description: 'Pre-aggregated sales revenue data',
    filters: ['company_id', 'period_type', 'period_date'],
    metrics: {
      totalRevenue: {
        field: 'total_revenue',
        format: 'currency',
        label: 'Total Revenue'
      },
      orderCount: {
        field: 'total_orders',
        format: 'number',
        label: 'Total Orders'
      },
      avgOrderValue: {
        field: 'average_order_value',
        format: 'currency',
        label: 'Average Order Value'
      },
      itemsSold: {
        field: 'total_items_sold',
        format: 'number',
        label: 'Items Sold'
      }
    },
    dimensions: {
      period: {
        field: 'period_label',
        label: 'Period',
        type: 'string'
      },
      periodDate: {
        field: 'period_date',
        label: 'Date',
        type: 'date'
      }
    },
    defaultPeriod: 'day'
  },

  // Customer Analytics
  customerMetrics: {
    table: 'customer_analytics_aggregated',
    description: 'Customer behavior and value metrics',
    filters: ['company_id', 'period_type', 'customer_id'],
    metrics: {
      totalSpent: {
        field: 'total_spent',
        format: 'currency',
        label: 'Customer Spend'
      },
      orderCount: {
        field: 'order_count',
        format: 'number',
        label: 'Orders'
      },
      lifetimeValue: {
        field: 'lifetime_value',
        format: 'currency',
        label: 'Lifetime Value'
      },
      paymentScore: {
        field: 'payment_performance_score',
        format: 'percent',
        label: 'Payment Score'
      }
    },
    dimensions: {
      segment: {
        field: 'customer_segment',
        label: 'Segment',
        type: 'string'
      }
    }
  },

  // Brand Performance (existing)
  brandTrends: {
    table: 'brand_trends_aggregated',
    description: 'Brand sales trends over time',
    filters: ['company_id', 'period_type', 'brand_id'],
    metrics: {
      quantity: {
        field: 'total_quantity',
        format: 'number',
        label: 'Units Sold'
      },
      orderCount: {
        field: 'order_count',
        format: 'number',
        label: 'Orders'
      }
    },
    dimensions: {
      brand: {
        field: 'brand_name',
        label: 'Brand',
        type: 'string'
      },
      period: {
        field: 'period_label',
        label: 'Period',
        type: 'string'
      }
    }
  },

  // Inventory Metrics
  inventoryHealth: {
    table: 'inventory_metrics_aggregated',
    description: 'Inventory levels and movement',
    filters: ['company_id', 'period_type', 'brand_id', 'warehouse_id'],
    metrics: {
      stockValue: {
        field: 'total_stock_value',
        format: 'currency',
        label: 'Stock Value'
      },
      itemsInStock: {
        field: 'total_items_in_stock',
        format: 'number',
        label: 'Items in Stock'
      },
      turnoverRatio: {
        field: 'inventory_turnover_ratio',
        format: 'number',
        label: 'Turnover Ratio'
      },
      belowReorder: {
        field: 'items_below_reorder',
        format: 'number',
        label: 'Below Reorder Level'
      }
    }
  },

  // Financial Metrics
  financialPerformance: {
    table: 'financial_metrics_aggregated',
    description: 'Financial performance metrics',
    filters: ['company_id', 'period_type'],
    metrics: {
      grossRevenue: {
        field: 'gross_revenue',
        format: 'currency',
        label: 'Gross Revenue'
      },
      netRevenue: {
        field: 'net_revenue',
        format: 'currency',
        label: 'Net Revenue'
      },
      receivables: {
        field: 'total_receivables',
        format: 'currency',
        label: 'Total Receivables'
      },
      overdueAmount: {
        field: 'overdue_receivables',
        format: 'currency',
        label: 'Overdue Amount'
      },
      grossMargin: {
        field: 'gross_margin_percent',
        format: 'percent',
        label: 'Gross Margin %'
      }
    }
  },

  // Product Performance
  productPerformance: {
    table: 'product_performance_aggregated',
    description: 'Individual product sales performance',
    filters: ['company_id', 'period_type', 'item_id', 'brand_id'],
    metrics: {
      quantitySold: {
        field: 'quantity_sold',
        format: 'number',
        label: 'Units Sold'
      },
      revenue: {
        field: 'revenue_generated',
        format: 'currency',
        label: 'Revenue'
      },
      sellThrough: {
        field: 'sell_through_rate',
        format: 'percent',
        label: 'Sell-Through Rate'
      }
    }
  },

  // Pre-built Views
  salesTrends: {
    table: 'v_sales_trends',
    description: 'Sales trends with growth calculations',
    filters: ['company_id', 'period_type'],
    metrics: {
      revenue: {
        field: 'total_revenue',
        format: 'currency',
        label: 'Revenue'
      },
      growth: {
        field: 'growth_percent',
        format: 'percent',
        label: 'Growth %'
      }
    }
  },

  topProducts: {
    table: 'v_top_products',
    description: 'Top performing products by revenue',
    filters: ['company_id', 'period_type', 'period_date'],
    metrics: {
      revenue: {
        field: 'revenue_generated',
        format: 'currency',
        label: 'Revenue'
      },
      quantity: {
        field: 'quantity_sold',
        format: 'number',
        label: 'Units Sold'
      }
    },
    dimensions: {
      product: {
        field: 'product_name',
        label: 'Product',
        type: 'string'
      },
      brand: {
        field: 'brand_name',
        label: 'Brand',
        type: 'string'
      }
    }
  }
};

// Helper function to get available metrics for a data source
export const getAvailableMetrics = (dataSource: string): string[] => {
  const source = ANALYTICS_DATA_SOURCES[dataSource];
  return source ? Object.keys(source.metrics) : [];
};

// Helper function to build query for aggregated data
export const buildAggregatedQuery = (
  dataSource: string,
  metrics: string[],
  filters: Record<string, any>,
  groupBy?: string[],
  orderBy?: { field: string; direction: 'asc' | 'desc' }
) => {
  const source = ANALYTICS_DATA_SOURCES[dataSource];
  if (!source) throw new Error(`Unknown data source: ${dataSource}`);

  const selectFields = metrics.map(m => source.metrics[m]?.field).filter(Boolean);
  const dimensions = groupBy?.map(g => source.dimensions?.[g]?.field).filter(Boolean) || [];

  return {
    table: source.table,
    select: [...selectFields, ...dimensions].join(', '),
    filters,
    groupBy: dimensions,
    orderBy
  };
};