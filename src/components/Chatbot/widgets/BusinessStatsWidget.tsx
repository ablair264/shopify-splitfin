import React from 'react';

interface BusinessStatsProps {
  customerCount: number;
  orderCountThisWeek: number;
  orderCountThisMonth: number;
  productCount: number;
  recentOrdersThisWeek?: any[];
  recentOrdersThisMonth?: any[];
  topProducts?: any[];
}

const BusinessStatsWidget: React.FC<BusinessStatsProps> = ({ 
  customerCount, 
  orderCountThisWeek,
  orderCountThisMonth,
  productCount,
  recentOrdersThisWeek = [],
  recentOrdersThisMonth = [],
  topProducts = []
}) => {
  // Debug logging
  console.log('BusinessStatsWidget received props:');
  console.log('- customerCount:', customerCount);
  console.log('- orderCountThisWeek:', orderCountThisWeek);
  console.log('- orderCountThisMonth:', orderCountThisMonth);
  console.log('- productCount:', productCount);
  console.log('- recentOrdersThisWeek:', recentOrdersThisWeek);
  console.log('- recentOrdersThisMonth:', recentOrdersThisMonth);
  console.log('- topProducts:', topProducts);
  
  // Ensure we have fallback values
  const safeCustomerCount = customerCount ?? 0;
  const safeOrderCountThisWeek = orderCountThisWeek ?? 0;
  const safeOrderCountThisMonth = orderCountThisMonth ?? 0;
  const safeProductCount = productCount ?? 0;
  
  // Calculate additional metrics
  const totalValueThisWeek = recentOrdersThisWeek.reduce((sum, order) => sum + (order.total_amount || order.total || 0), 0);
  const avgOrderValueThisWeek = safeOrderCountThisWeek > 0 ? (totalValueThisWeek / safeOrderCountThisWeek).toFixed(2) : '0';
  
  const totalValueThisMonth = recentOrdersThisMonth.reduce((sum, order) => sum + (order.total_amount || order.total || 0), 0);
  const avgOrderValueThisMonth = safeOrderCountThisMonth > 0 ? (totalValueThisMonth / safeOrderCountThisMonth).toFixed(2) : '0';
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, #79d5e9, #4daeac)',
      borderRadius: '12px',
      padding: '16px',
      margin: '8px 0',
      color: '#1a1f2a',
      fontSize: '14px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <h4 style={{ margin: '0 0 12px 0', fontWeight: '600', fontSize: '16px' }}>📊 Business Performance Overview</h4>
      
      {/* This Week Stats */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1a1f2a', opacity: 0.9 }}>📅 This Week</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>{safeOrderCountThisWeek}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Orders</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>£{totalValueThisWeek.toFixed(2)}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Revenue</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>£{avgOrderValueThisWeek}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Avg Order</div>
          </div>
        </div>
      </div>

      {/* This Month Stats */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1a1f2a', opacity: 0.9 }}>📆 This Month</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>{safeOrderCountThisMonth}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Orders</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>£{totalValueThisMonth.toFixed(2)}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Revenue</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.25)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '18px', color: '#1a1f2a' }}>£{avgOrderValueThisMonth}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Avg Order</div>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#1a1f2a', opacity: 0.9 }}>📈 Overall</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#1a1f2a' }}>{safeCustomerCount.toLocaleString()}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Total Customers</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#1a1f2a' }}>{safeProductCount.toLocaleString()}</div>
            <div style={{ fontSize: '11px', fontWeight: '500' }}>Active Products</div>
          </div>
        </div>
      </div>

      {/* Recent Orders This Week */}
      {recentOrdersThisWeek.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', opacity: 0.9 }}>🕒 Recent Orders This Week</div>
          <div style={{ fontSize: '11px', maxHeight: '60px', overflowY: 'auto' }}>
            {recentOrdersThisWeek.slice(0, 3).map((order, index) => (
              <div key={index} style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                borderRadius: '4px', 
                padding: '4px 6px', 
                marginBottom: '2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '500' }}>
                  {order.legacy_order_number || order.id || `Order ${index + 1}`}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  £{(order.total_amount || order.total || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders This Month */}
      {recentOrdersThisMonth.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', opacity: 0.9 }}>📅 Recent Orders This Month</div>
          <div style={{ fontSize: '11px', maxHeight: '60px', overflowY: 'auto' }}>
            {recentOrdersThisMonth.slice(0, 3).map((order, index) => (
              <div key={index} style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                borderRadius: '4px', 
                padding: '4px 6px', 
                marginBottom: '2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '500' }}>
                  {order.legacy_order_number || order.id || `Order ${index + 1}`}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  £{(order.total_amount || order.total || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Products Preview */}
      {topProducts.length > 0 && (
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', opacity: 0.9 }}>🏆 Top Products by Stock</div>
          <div style={{ fontSize: '11px', maxHeight: '60px', overflowY: 'auto' }}>
            {topProducts.slice(0, 3).map((product, index) => (
              <div key={index} style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                borderRadius: '4px', 
                padding: '4px 6px', 
                marginBottom: '2px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {product.name || product.product_name || `Product ${index + 1}`}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>
                  {product.net_stock_level || product.stock_quantity || 0} units
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessStatsWidget;