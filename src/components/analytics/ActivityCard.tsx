import React, { useEffect, useState } from 'react';
import { ShoppingCart, Package, DollarSign, FileText, User } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import styles from './ActivityCard.module.css';

export interface Activity {
  id: string;
  action: string;
  customerName: string;
  time: string;
  domain?: string | null;
  amount: number;
  created_at: string;
  company_id: string;
}

export interface ActivityCardProps {
  maxActivities?: number;
  className?: string;
}

const ActivityCard: React.FC<ActivityCardProps> = ({
  maxActivities = 6,
  className = ''
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Get user's company
      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', authUser.id)
        .single();

      if (!userData?.company_id) return;

      // Get recent activities for the user's company
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          legacy_order_number,
          total,
          order_status,
          created_at,
          company_id,
          customers (display_name, trading_name)
        `)
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .limit(maxActivities * 2); // Get more than we need to filter different types

      if (ordersError) {
        console.error('Error loading activities:', ordersError);
        setError('Failed to load activities');
        return;
      }

      // Transform orders into activities
      const orderActivities: Activity[] = (ordersData || []).map(order => {
        const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
        return {
          id: order.id,
          action: order.order_status === 'delivered' ? 'Order Delivered' : 'New Order',
          customerName: customer?.display_name || customer?.trading_name || 'Unknown Customer',
          time: formatTimeAgo(order.created_at),
          amount: order.total || 0,
          created_at: order.created_at,
          company_id: order.company_id
        };
      });

      // Use only real order activities
      const allActivities = orderActivities
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, maxActivities);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      setError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
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
        title: 'User Activity',
        showAmount: false
      };
    }
  };

  if (loading) {
    return (
      <div className={`${styles.activityCardContainer} ${className}`}>
        <div className={styles.cardHeader}>
          <h3>Recent Activities</h3>
          <p>Latest system events</p>
        </div>
        <div className={styles.loadingState}>
          Loading activities...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.activityCardContainer} ${className}`}>
        <div className={styles.cardHeader}>
          <h3>Recent Activities</h3>
          <p>Latest system events</p>
        </div>
        <div className={styles.errorState}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.activityCardContainer} ${className}`}>
      <div className={styles.activitiesSimple}>
        {activities.map((activity) => {
          const activityInfo = getActivityTypeInfo(activity);
          
          return (
            <div key={activity.id} className={styles.activityItem}>
              <div className={styles.activityContent}>
                <div 
                  className={styles.activityIcon}
                  style={{
                    background: activityInfo.bgColor
                  }}
                >
                  {activityInfo.icon}
                </div>
                
                <div className={styles.activityCard}>
                  <div className={styles.activityMain}>
                    <div className={styles.activityInfo}>
                      <div className={styles.activityTitle}>
                        {activityInfo.title}
                      </div>
                      <div className={styles.activityCompany}>
                        {activity.customerName}
                      </div>
                    </div>
                    <div className={styles.activityRight}>
                      {activityInfo.showAmount && activity.amount > 0 && (
                        <div className={styles.activityAmount}>
                          £{activity.amount.toLocaleString()}
                        </div>
                      )}
                      <div className={styles.activityTime}>
                        {activity.time.replace(' ago', '').replace('hours', 'hr').replace('hour', 'hr').replace('minutes', 'min').replace('minute', 'min')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {activities.length === 0 && (
          <div className={styles.emptyState}>
            No recent activities
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityCard;