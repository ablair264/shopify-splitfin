import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { ArrowLeft } from 'lucide-react';
import { ProgressLoader } from '../ProgressLoader';
import FixOrder from '../FixOrder';
import './Settings.css';

export default function Settings() {
  const [userRole, setUserRole] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/login');
          return;
        }

        // Load user data from Supabase
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', user.id)
          .single();

        if (error) throw error;
        
        setUserRole(userData?.role || '');
        setUserName(`${userData?.first_name || ''} ${userData?.last_name || ''}`.trim());
        setUserEmail(user.email || '');
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [navigate]);

  // Get the current settings tab from the URL
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/settings/general')) return 'general';
    if (path.includes('/settings/profile')) return 'profile';
    if (path.includes('/settings/notifications')) return 'notifications';
    if (path.includes('/settings/database')) return 'database';
    if (path.includes('/settings/security')) return 'security';
    if (path.includes('/settings/fix-order')) return 'fix-order';
    return 'general'; // default
  };

  const currentTab = getCurrentTab();

  if (loading) {
    return (
      <ProgressLoader
        isVisible={true}
        message="Loading settings..."
        progress={50}
      />
    );
  }

  // Redirect to general settings if no specific tab is selected
  if (location.pathname === '/settings') {
    navigate('/settings/general');
    return null;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
          title="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1>Settings - {currentTab.charAt(0).toUpperCase() + currentTab.slice(1)}</h1>
      </div>

      <div className="settings-content">
        <div className="settings-main">
          <div className="settings-section">
            <div className="section-content">
              {currentTab === 'general' && <GeneralSettings userName={userName} userEmail={userEmail} userRole={userRole} />}
              {currentTab === 'profile' && (
                <ProfileSettings 
                  userName={userName} 
                  onProfileUpdate={(name) => setUserName(name)}
                  savingProfile={savingProfile}
                  setSavingProfile={setSavingProfile}
                />
              )}
              {currentTab === 'notifications' && <NotificationSettings />}
              {currentTab === 'database' && userRole === 'Admin' && <DatabaseSettings />}
              {currentTab === 'security' && <SecuritySettings />}
              {currentTab === 'fix-order' && (userRole === 'Manager' || userRole === 'Admin') && <FixOrder />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// General Settings Component
function GeneralSettings({ userName, userEmail, userRole }: { userName: string; userEmail: string; userRole: string }) {
  const navigate = useNavigate();

  return (
    <div className="general-settings">
      <div className="setting-group">
        <h3>Account Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <label>Name</label>
            <p>{userName || 'Not set'}</p>
          </div>
          <div className="info-item">
            <label>Email</label>
            <p>{userEmail}</p>
          </div>
          <div className="info-item">
            <label>Role</label>
            <p className="role-badge">{userRole || 'User'}</p>
          </div>
        </div>
      </div>

      {/* Manager Tools Section */}
      {(userRole === 'Manager' || userRole === 'Admin') && (
        <div className="setting-group">
          <h3>Management Tools</h3>
          <div className="tools-grid">
            <button 
              className="tool-button" 
              onClick={() => navigate('/settings/fix-order')}
            >
              <span>🔧</span>
              <span>Fix Order</span>
              <small>Edit and re-submit orders to Zoho</small>
            </button>
          </div>
        </div>
      )}

      <div className="setting-group">
        <h3>Application Preferences</h3>
        <div className="preference-item">
          <div className="preference-info">
            <h4>Theme</h4>
            <p>Choose your preferred color theme</p>
          </div>
          <select className="preference-select" defaultValue="dark">
            <option value="dark">Dark</option>
            <option value="light">Light (Coming soon)</option>
          </select>
        </div>
        
        <div className="preference-item">
          <div className="preference-info">
            <h4>Language</h4>
            <p>Select your preferred language</p>
          </div>
          <select className="preference-select" defaultValue="en">
            <option value="en">English</option>
            <option value="es">Spanish (Coming soon)</option>
            <option value="fr">French (Coming soon)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Profile Settings Component
function ProfileSettings({ 
  userName, 
  onProfileUpdate, 
  savingProfile, 
  setSavingProfile 
}: { 
  userName: string; 
  onProfileUpdate: (name: string) => void;
  savingProfile: boolean;
  setSavingProfile: (saving: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    department: ''
  });

  useEffect(() => {
    // Initialize form with current user name
    const names = userName.split(' ');
    setFormData({
      firstName: names[0] || '',
      lastName: names.slice(1).join(' ') || '',
      phone: '',
      department: ''
    });
  }, [userName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('users')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('auth_user_id', user.id);

      if (error) throw error;

      onProfileUpdate(`${formData.firstName} ${formData.lastName}`.trim());
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="profile-settings">
      <div className="setting-group">
        <h3>Profile Information</h3>
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input 
              type="text" 
              id="firstName" 
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="Enter your first name"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input 
              type="text" 
              id="lastName" 
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Enter your last name"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input 
              type="tel" 
              id="phone" 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Enter your phone number"
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input 
              type="text" 
              id="department" 
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="Enter your department"
              className="form-input"
            />
          </div>
          
          <button type="submit" className="save-button" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Notification Settings Component
function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    newCustomers: true,
    lowInventory: false,
    dailyReports: true,
    weeklyReports: false
  });

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="notification-settings">
      <div className="setting-group">
        <h3>Email Notifications</h3>
        <div className="notification-list">
          <div className="notification-item">
            <div className="notification-info">
              <h4>Order Updates</h4>
              <p>Receive notifications when order status changes</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={notifications.orderUpdates}
                onChange={() => handleToggle('orderUpdates')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          <div className="notification-item">
            <div className="notification-info">
              <h4>New Customers</h4>
              <p>Get notified when new customers are added</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={notifications.newCustomers}
                onChange={() => handleToggle('newCustomers')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          <div className="notification-item">
            <div className="notification-info">
              <h4>Low Inventory Alerts</h4>
              <p>Alerts when inventory falls below threshold</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={notifications.lowInventory}
                onChange={() => handleToggle('lowInventory')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <h3>Report Emails</h3>
        <div className="notification-list">
          <div className="notification-item">
            <div className="notification-info">
              <h4>Daily Reports</h4>
              <p>Receive daily sales and activity reports</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={notifications.dailyReports}
                onChange={() => handleToggle('dailyReports')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          <div className="notification-item">
            <div className="notification-info">
              <h4>Weekly Summary</h4>
              <p>Get weekly performance summaries</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={notifications.weeklyReports}
                onChange={() => handleToggle('weeklyReports')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// Database Settings Component - Admin only
function DatabaseSettings() {
  const [activeTab, setActiveTab] = useState<'maintenance' | 'export'>('maintenance');
  
  return (
    <div className="database-settings">
      <div className="setting-group">
        <h3>Database Management</h3>
        <p className="setting-description">
          Manage database operations and maintenance tasks. These operations should be performed during off-peak hours.
          <br /><small style={{ color: '#a0a0a0', marginTop: '0.5rem', display: 'block' }}>Access restricted to Admins</small>
        </p>
      </div>

      {/* Database Tools Tabs */}
      <div className="setting-group">
        <div className="migration-tabs">
          <button 
            className={`migration-tab ${activeTab === 'maintenance' ? 'active' : ''}`}
            onClick={() => setActiveTab('maintenance')}
          >
            Database Maintenance
          </button>
          <button 
            className={`migration-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Data Export
          </button>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'maintenance' && (
          <div className="tools-grid">
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>🔧</span>
              <span>Optimize Tables</span>
              <small>Improve database performance</small>
            </button>
            
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>🗑️</span>
              <span>Clean Up Data</span>
              <small>Remove old records</small>
            </button>
            
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>♻️</span>
              <span>Rebuild Indexes</span>
              <small>Optimize query performance</small>
            </button>
          </div>
        )}
        
        {activeTab === 'export' && (
          <div className="tools-grid">
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>📊</span>
              <span>Export Orders</span>
              <small>Download order data</small>
            </button>
            
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>👥</span>
              <span>Export Customers</span>
              <small>Download customer data</small>
            </button>
            
            <button className="tool-button" onClick={() => alert('Feature coming soon')}>
              <span>📦</span>
              <span>Export Inventory</span>
              <small>Download inventory data</small>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Security Settings Component
function SecuritySettings() {
  const handlePasswordChange = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      alert('Password reset email sent! Please check your inbox.');
    } catch (error) {
      console.error('Error sending password reset:', error);
      alert('Failed to send password reset email');
    }
  };

  return (
    <div className="security-settings">
      <div className="setting-group">
        <h3>Password & Authentication</h3>
        <button className="action-button" onClick={handlePasswordChange}>
          Change Password
        </button>
      </div>

      <div className="setting-group">
        <h3>Two-Factor Authentication</h3>
        <p className="setting-description">
          Add an extra layer of security to your account by enabling two-factor authentication.
        </p>
        <button className="action-button secondary" disabled>
          Enable 2FA (Coming soon)
        </button>
      </div>

      <div className="setting-group">
        <h3>Active Sessions</h3>
        <p className="setting-description">
          View and manage your active sessions across different devices.
        </p>
        <div className="session-list">
          <div className="session-item">
            <div className="session-info">
              <h4>Current Session</h4>
              <p>Chrome on Windows • Active now</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
