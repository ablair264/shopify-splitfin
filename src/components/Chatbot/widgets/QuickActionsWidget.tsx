import React from 'react';

interface QuickActionsProps {
  actionProvider: any;
}

const QuickActionsWidget: React.FC<QuickActionsProps> = ({ actionProvider }) => {
  const actions = [
    { label: '📝 Create Customer', action: () => actionProvider.handleQuickAction('create-customer') },
    { label: '📦 Add Product', action: () => actionProvider.handleQuickAction('add-product') },
    { label: '🛒 New Order', action: () => actionProvider.handleQuickAction('new-order') },
    { label: '📊 View Analytics', action: () => actionProvider.handleQuickAction('analytics') }
  ];

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      border: '1px solid rgba(121, 213, 233, 0.3)'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#79d5e9', fontSize: '14px', fontWeight: '600' }}>
        🚀 Quick Actions
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            style={{
              background: 'linear-gradient(135deg, #79d5e9, #4daeac)',
              color: '#1a1f2a',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6bc7db, #3a9d9a)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #79d5e9, #4daeac)';
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionsWidget;