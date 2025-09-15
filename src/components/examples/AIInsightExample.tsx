import React from 'react';
import AIEnhancedTableCard from '../analytics/shared/AIEnhancedTableCard';

const AIInsightExample: React.FC = () => {
  // Sample sales data
  const salesData = [
    { product: 'Widget A', revenue: 15420, units: 120, change: 5.2 },
    { product: 'Widget B', revenue: 12300, units: 98, change: -2.1 },
    { product: 'Widget C', revenue: 18900, units: 145, change: 8.7 },
    { product: 'Widget D', revenue: 9870, units: 76, change: 1.3 },
    { product: 'Widget E', revenue: 22100, units: 167, change: 12.4 }
  ];

  // Sample historical data for comparison
  const historicalSalesData = [
    { product: 'Widget A', revenue: 14650, units: 114 },
    { product: 'Widget B', revenue: 12570, units: 100 },
    { product: 'Widget C', revenue: 17420, units: 133 },
    { product: 'Widget D', revenue: 9743, units: 75 },
    { product: 'Widget E', revenue: 19680, units: 149 }
  ];

  const salesColumns = [
    { key: 'product', header: 'Product', format: 'text' as const, width: '30%' },
    { key: 'revenue', header: 'Revenue', format: 'currency' as const, width: '25%', align: 'right' as const },
    { key: 'units', header: 'Units Sold', format: 'number' as const, width: '25%', align: 'right' as const },
    { key: 'change', header: 'Change %', format: 'percentage' as const, width: '20%', align: 'right' as const }
  ];

  // Sample customer data
  const customerData = [
    { customer: 'Acme Corp', orders: 24, value: 45600, last_order: '2024-01-15' },
    { customer: 'TechFlow Inc', orders: 18, value: 38200, last_order: '2024-01-12' },
    { customer: 'Global Systems', orders: 31, value: 52300, last_order: '2024-01-18' },
    { customer: 'DataPoint LLC', orders: 15, value: 28900, last_order: '2024-01-10' },
    { customer: 'Innovation Hub', orders: 22, value: 41500, last_order: '2024-01-16' }
  ];

  const customerColumns = [
    { key: 'customer', header: 'Customer', format: 'text' as const, width: '35%' },
    { key: 'orders', header: 'Orders', format: 'number' as const, width: '20%', align: 'right' as const },
    { key: 'value', header: 'Total Value', format: 'currency' as const, width: '25%', align: 'right' as const },
    { key: 'last_order', header: 'Last Order', format: 'date' as const, width: '20%', align: 'right' as const }
  ];

  return (
    <div style={{ padding: '20px', display: 'grid', gap: '24px', gridTemplateColumns: '1fr 1fr' }}>
      <div>
        <h3 style={{ color: '#ffffff', marginBottom: '16px' }}>Product Sales Performance</h3>
        <AIEnhancedTableCard
          data={salesData}
          columns={salesColumns}
          cardTitle="Product Sales Performance"
          dataType="revenue"
          timeFrame="monthly"
          historicalData={historicalSalesData}
          aiButtonPosition="top-right"
          aiButtonSize="small"
          aiButtonVariant="ghost"
        />
      </div>

      <div>
        <h3 style={{ color: '#ffffff', marginBottom: '16px' }}>Top Customers</h3>
        <AIEnhancedTableCard
          data={customerData}
          columns={customerColumns}
          cardTitle="Top Customers"
          dataType="customers"
          timeFrame="monthly"
          aiButtonPosition="top-right"
          aiButtonSize="small"
          aiButtonVariant="secondary"
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ color: '#ffffff', marginBottom: '16px' }}>Usage Examples</h3>
        <div style={{ 
          background: '#1a1f2a', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff'
        }}>
          <h4 style={{ color: '#79d5e9', marginBottom: '12px' }}>How to integrate AI Insights:</h4>
          <pre style={{ 
            background: '#0f172a', 
            padding: '16px', 
            borderRadius: '6px', 
            fontSize: '13px',
            overflow: 'auto'
          }}>
{`// Replace regular table cards with AI-enhanced versions:
<AIEnhancedTableCard
  data={yourData}
  columns={yourColumns}
  cardTitle="Your Card Title"
  dataType="revenue" // or 'orders', 'customers', etc.
  timeFrame="monthly"
  historicalData={previousPeriodData} // optional
  enableAIInsights={true}
  aiButtonPosition="top-right"
  aiButtonSize="small"
  aiButtonVariant="ghost"
/>

// Or wrap any existing component:
<AIInsightWrapper
  cardTitle="Your Analysis"
  currentData={dataPoints}
  dataType="performance"
>
  <YourExistingTableComponent />
</AIInsightWrapper>`}
          </pre>
          
          <div style={{ marginTop: '16px' }}>
            <p><strong>Features:</strong></p>
            <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>Click the AI brain icon on any table to get intelligent insights</li>
              <li>Compares current data with historical trends when available</li>
              <li>Provides actionable recommendations and forecasts</li>
              <li>Supports multiple data types: revenue, orders, customers, products, performance</li>
              <li>Powered by OpenAI with fallback to rule-based analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsightExample;