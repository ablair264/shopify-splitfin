import React from 'react';
import { ShoppingCart, Package, DollarSign, FileText, User } from 'lucide-react';
import styles from './ActivityFeed.module.css';

export interface Activity {
  id: string;
  action: string;
  customerName: string;
  time: string;
  domain?: string | null;
  amount: number;
  created_at: string;
}

export interface ActivityFilter {
  id: string;
  label: string;
  value: string;
  active: boolean;
}

export interface ActivityFeedProps {
  activities: Activity[];
  loading?: boolean;
  color?: string;
  title?: string;
  subtitle?: string;
  maxActivities?: number;
  filters?: ActivityFilter[];
  onFilterChange?: (filters: ActivityFilter[]) => void;
  showFilters?: boolean;
}

// Function to determine if text should be light or dark based on background color
const getTextColor = (backgroundColor: string) => {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white text for dark backgrounds, dark text for light backgrounds
  return luminance > 0.5 ? '#1a1f2a' : '#ffffff';
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = [],
  loading = false,
  color = '#79d5e9',
  title = 'Recent Activities',
  subtitle = 'Latest system events',
  maxActivities = 6,
  filters = [],
  onFilterChange,
  showFilters = false
}) => {
  const textColor = getTextColor(color);
  const secondaryColor = textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 31, 42, 0.7)';

  // Filter activities based on active filters
  const filteredActivities = filters.length > 0 && filters.some(f => f.active)
    ? activities.filter(activity => {
        const activeFilters = filters.filter(f => f.active);
        return activeFilters.some(filter => {
          const activityType = activity.action.toLowerCase();
          return activityType.includes(filter.value.toLowerCase());
        });
      })
    : activities;

  const handleFilterClick = (filterId: string) => {
    if (onFilterChange) {
      const updatedFilters = filters.map(filter =>
        filter.id === filterId ? { ...filter, active: !filter.active } : filter
      );
      onFilterChange(updatedFilters);
    }
  };

  const getActivityTypeInfo = (activity: Activity) => {
    if (activity.action.toLowerCase().includes('delivered')) {
      return {
        icon: <Package size={16} color="white" />,
        bgColor: '#3b82f6',
        title: 'Order Delivered',
        showAmount: true
      };
    } else if (activity.action.toLowerCase().includes('order')) {
      return {
        icon: <ShoppingCart size={16} color="white" />,
        bgColor: '#22c55e',
        title: 'New Order',
        showAmount: true
      };
    } else if (activity.action.toLowerCase().includes('invoice')) {
      return {
        icon: <FileText size={16} color="white" />,
        bgColor: '#22c55e',
        title: 'Invoice Paid',
        showAmount: true
      };
    } else {
      return {
        icon: <User size={16} color="white" />,
        bgColor: '#64748b',
        title: 'User Logged In',
        showAmount: false
      };
    }
  };

  if (loading) {
    return (
      <div 
        className={styles.activityFeedContainer}
        style={{
          background: color,
          color: textColor
        }}
      >
        <div className={styles.cardHeader}>
          <h3 style={{ color: textColor }}>{title}</h3>
          <p style={{ color: secondaryColor }}>{subtitle}</p>
        </div>
        <div className={styles.loadingState} style={{ color: secondaryColor }}>
          Loading activities...
        </div>
      </div>
    );
  }

  return (
    <div 
      className={styles.activityFeedContainer}
      style={{
        background: color,
        color: textColor
      }}
    >
      <div 
        className={styles.cardHeader}
        style={{
          borderBottom: `1px solid ${textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(26, 31, 42, 0.15)'}`
        }}
      >
        <div>
          <h3 className={styles.cardTitle} style={{ color: textColor }}>{title}</h3>
          <p className={styles.cardSubtitle} style={{ color: secondaryColor }}>
            {subtitle}
          </p>
        </div>
      </div>

      {showFilters && filters.length > 0 && (
        <div 
          className={styles.filterBar}
          style={{
            borderBottom: `1px solid ${textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(26, 31, 42, 0.15)'}`
          }}
        >
          <div className={styles.filterList}>
            {filters.map(filter => (
              <button
                key={filter.id}
                className={`${styles.filterButton} ${filter.active ? styles.active : ''}`}
                onClick={() => handleFilterClick(filter.id)}
                style={{
                  background: filter.active 
                    ? (textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)')
                    : 'transparent',
                  color: filter.active ? textColor : secondaryColor,
                  border: `1px solid ${filter.active 
                    ? (textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)')
                    : (textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)')}`
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.activitiesSimple}>
        {filteredActivities.slice(0, maxActivities).map((activity) => {
          const activityInfo = getActivityTypeInfo(activity);
          
          return (
            <div key={activity.id} className={styles.activityItem}>
              {/* Content area with icon and card */}
              <div className={styles.activityContent}>
                {/* Icon box positioned above the card */}
                <div 
                  className={styles.activityIcon}
                  style={{
                    background: activityInfo.bgColor
                  }}
                >
                  {activityInfo.icon}
                </div>
                
                {/* Activity card - full width */}
                <div 
                  className={styles.activityCard}
                  style={{
                    background: textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    border: `1px solid ${textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)'}`
                  }}
                >
                  <div className={styles.activityMain}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityTitle} style={{ color: textColor }}>
                        {activityInfo.title}
                      </div>
                      <div className={styles.activityCompany} style={{ color: secondaryColor }}>
                        {activity.customerName}
                      </div>
                    </div>
                    <div className={styles.activityRight}>
                      {activityInfo.showAmount && activity.amount > 0 && (
                        <div className={styles.activityAmount} style={{ color: textColor }}>
                          £{activity.amount.toLocaleString()}
                        </div>
                      )}
                      {/* Time indicator in top right */}
                      <div 
                        className={styles.activityTime}
                        style={{ color: secondaryColor }}
                      >
                        {activity.time.replace(' ago', '').replace('hours', 'hr').replace('hour', 'hr').replace('minutes', 'min').replace('minute', 'min')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredActivities.length === 0 && (
          <div className={styles.emptyState} style={{ color: secondaryColor }}>
            No recent activities
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;