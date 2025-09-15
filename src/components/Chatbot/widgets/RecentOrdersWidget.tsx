import React from 'react';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  customers: {
    display_name: string;
    company: string;
  };
}

interface RecentOrdersProps {
  orders: Order[];
}

const RecentOrdersWidget: React.FC<RecentOrdersProps> = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
        border: '1px solid rgba(121, 213, 233, 0.3)',
        color: '#79d5e9',
        fontSize: '14px'
      }}>
        No recent orders found.
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      border: '1px solid rgba(121, 213, 233, 0.3)'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#79d5e9', fontSize: '14px', fontWeight: '600' }}>
        📋 Recent Orders
      </h4>
      {orders.slice(0, 3).map((order) => (
        <div
          key={order.id}
          style={{
            background: 'rgba(121, 213, 233, 0.1)',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '6px',
            fontSize: '12px',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: '600' }}>
              {order.customers?.display_name || 'Unknown Customer'}
            </div>
            <div style={{ color: '#79d5e9', fontWeight: '600' }}>
              ${order.total_amount}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#cccccc', marginTop: '2px' }}>
            {order.status} • {new Date(order.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentOrdersWidget;