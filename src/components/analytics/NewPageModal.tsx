import React, { useState } from 'react';
import {
  X,
  Save,
  Users,
  ClipboardList,
  FileText,
  UserCheck,
  Database,
  DollarSign,
  Home,
  BarChart3,
  Settings,
  ShoppingCart,
  Warehouse,
  Calendar,
  Mail,
  Bell
} from 'lucide-react';
import './NewPageModal.css';

interface NewPageModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (pageName: string, icon: string, template: string) => void;
}

const availableIcons = [
  { icon: <Users />, name: 'users', label: 'Users' },
  { icon: <ClipboardList />, name: 'orders', label: 'Orders' },
  { icon: <FileText />, name: 'invoices', label: 'Invoices' },
  { icon: <UserCheck />, name: 'sales', label: 'Sales Team' },
  { icon: <Database />, name: 'admin', label: 'Admin' },
  { icon: <DollarSign />, name: 'finance', label: 'Finance' },
  { icon: <Home />, name: 'overview', label: 'Overview' },
  { icon: <BarChart3 />, name: 'analytics', label: 'Analytics' },
  { icon: <Settings />, name: 'settings', label: 'Settings' },
  { icon: <ShoppingCart />, name: 'cart', label: 'Cart' },
  { icon: <Warehouse />, name: 'inventory', label: 'Inventory' },
  { icon: <Calendar />, name: 'calendar', label: 'Calendar' },
  { icon: <Mail />, name: 'mail', label: 'Mail' },
  { icon: <Bell />, name: 'notifications', label: 'Notifications' }
];

const pageTemplates = [
  {
    id: 'customers',
    name: 'Customers',
    description: 'Customer analytics, demographics, and behavior tracking',
    widgets: [
      { type: 'metric', title: 'Total Customers', metric: 'totalCustomers' },
      { type: 'metric', title: 'New Customers', metric: 'newCustomers' },
      { type: 'metric', title: 'Active Customers', metric: 'activeCustomers' },
      { type: 'chart', title: 'Customer Growth', chartType: 'line' },
      { type: 'table', title: 'Top Customers' }
    ]
  },
  {
    id: 'orders',
    name: 'Orders',
    description: 'Order tracking, fulfillment status, and order analytics',
    widgets: [
      { type: 'metric', title: 'Total Orders', metric: 'totalOrders' },
      { type: 'metric', title: 'Pending Orders', metric: 'pendingOrders' },
      { type: 'metric', title: 'Order Conversion', metric: 'orderConversion' },
      { type: 'chart', title: 'Orders Over Time', chartType: 'bar' },
      { type: 'table', title: 'Recent Orders' }
    ]
  },
  {
    id: 'invoices',
    name: 'Invoices',
    description: 'Invoice status, payment tracking, and revenue analytics',
    widgets: [
      { type: 'metric', title: 'Total Revenue', metric: 'totalRevenue' },
      { type: 'metric', title: 'Outstanding Invoices', metric: 'outstandingInvoices' },
      { type: 'metric', title: 'Paid Invoices', metric: 'paidInvoices' },
      { type: 'chart', title: 'Revenue Trend', chartType: 'area' },
      { type: 'table', title: 'Invoice Status' }
    ]
  },
  {
    id: 'sales-team',
    name: 'Sales Team',
    description: 'Sales performance, team metrics, and individual tracking',
    widgets: [
      { type: 'metric', title: 'Team Performance', metric: 'teamPerformance' },
      { type: 'metric', title: 'Monthly Targets', metric: 'monthlyTargets' },
      { type: 'metric', title: 'Conversion Rate', metric: 'conversionRate' },
      { type: 'chart', title: 'Sales Performance', chartType: 'bar' },
      { type: 'table', title: 'Sales Team Leaderboard' }
    ]
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'System administration, user management, and system metrics',
    widgets: [
      { type: 'metric', title: 'System Health', metric: 'systemHealth' },
      { type: 'metric', title: 'Active Users', metric: 'activeUsers' },
      { type: 'metric', title: 'Storage Usage', metric: 'storageUsage' },
      { type: 'chart', title: 'System Activity', chartType: 'line' },
      { type: 'table', title: 'Recent Admin Actions' }
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Financial overview, budgeting, and expense tracking',
    widgets: [
      { type: 'metric', title: 'Total Revenue', metric: 'totalRevenue' },
      { type: 'metric', title: 'Monthly Expenses', metric: 'monthlyExpenses' },
      { type: 'metric', title: 'Profit Margin', metric: 'profitMargin' },
      { type: 'chart', title: 'Financial Trend', chartType: 'area' },
      { type: 'table', title: 'Budget vs Actual' }
    ]
  },
  {
    id: 'overview',
    name: 'Overview',
    description: 'High-level dashboard with key business metrics',
    widgets: [
      { type: 'metric', title: 'Total Revenue', metric: 'totalRevenue' },
      { type: 'metric', title: 'Total Orders', metric: 'totalOrders' },
      { type: 'metric', title: 'Active Customers', metric: 'activeCustomers' },
      { type: 'chart', title: 'Business Overview', chartType: 'area' },
      { type: 'activity', title: 'Recent Activity' }
    ]
  }
];

export const NewPageModal: React.FC<NewPageModalProps> = ({ isVisible, onClose, onSave }) => {
  const [pageName, setPageName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('analytics');
  const [selectedTemplate, setSelectedTemplate] = useState('overview');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pageName.trim()) {
      onSave(pageName.trim(), selectedIcon, selectedTemplate);
      setPageName('');
      setSelectedIcon('analytics');
      setSelectedTemplate('overview');
      onClose();
    }
  };

  const handleClose = () => {
    setPageName('');
    setSelectedIcon('analytics');
    setSelectedTemplate('overview');
    onClose();
  };

  const handleTemplateSelection = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Auto-populate name and icon based on template
    const template = pageTemplates.find(t => t.id === templateId);
    if (template) {
      setPageName(template.name);
      
      // Map template ID to appropriate icon
      const iconMap: Record<string, string> = {
        'customers': 'users',
        'orders': 'orders',
        'invoices': 'invoices',
        'sales-team': 'sales',
        'admin': 'admin',
        'finance': 'finance',
        'overview': 'overview'
      };
      
      const iconName = iconMap[templateId] || 'analytics';
      setSelectedIcon(iconName);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="new-page-modal-overlay" onClick={handleClose}>
      <div className="new-page-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Analytics Page</h2>
          <button className="close-btn" onClick={handleClose}>
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Page Name */}
          <div className="form-section">
            <h3>Page Details</h3>
            
            <div className="form-group">
              <label htmlFor="pageName">Page Name</label>
              <input
                id="pageName"
                type="text"
                value={pageName}
                onChange={e => setPageName(e.target.value)}
                placeholder="Enter page name..."
                required
              />
            </div>
          </div>

          {/* Icon Selection */}
          <div className="form-section">
            <h3>Choose Icon</h3>
            <div className="icon-grid">
              {availableIcons.map(iconItem => (
                <button
                  key={iconItem.name}
                  type="button"
                  className={`icon-option ${selectedIcon === iconItem.name ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(iconItem.name)}
                  title={iconItem.label}
                >
                  {iconItem.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Template Selection */}
          <div className="form-section">
            <h3>Choose Template</h3>
            <div className="template-grid">
              {pageTemplates.map(template => (
                <div
                  key={template.id}
                  className={`template-option template-${template.id} ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelection(template.id)}
                >
                  <div className="template-header">
                    <h4>{template.name}</h4>
                  </div>
                  <div className="template-description">
                    {template.description}
                  </div>
                  <div className="template-widgets">
                    <div className="widget-count">
                      {template.widgets.length} widgets included
                    </div>
                    <div className="widget-types">
                      {template.widgets.slice(0, 3).map((widget, index) => (
                        <span key={index} className="widget-type">
                          {widget.title}
                        </span>
                      ))}
                      {template.widgets.length > 3 && (
                        <span className="widget-type">+{template.widgets.length - 3} more</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="create-btn">
              <Save /> Create Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewPageModal;