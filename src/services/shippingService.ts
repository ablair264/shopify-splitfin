import { supabase } from './supabaseService';
import { authService } from './authService';

export interface WarehouseNotification {
  id: string;
  company_id: string;
  order_id: string;
  notification_type: 'sent_to_packing' | 'packed' | 'delivery_booked' | 'delivered';
  message: string;
  sent_to_user_id?: string;
  sent_by_user_id?: string;
  read_at?: string;
  email_sent: boolean;
  email_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WarehouseActivityLog {
  id: string;
  company_id: string;
  order_id: string;
  user_id?: string;
  action: string;
  previous_status?: string;
  new_status?: string;
  notes?: string;
  created_at: string;
}

export interface OrderWithShipping {
  id: string;
  legacy_order_number?: string;
  warehouse_status: 'pending' | 'sent_to_packing' | 'packed' | 'delivery_booked' | 'delivered';
  sent_to_packing_at?: string;
  sent_to_packing_by?: string;
  packed_at?: string;
  packed_by?: string;
  delivery_booked_at?: string;
  delivery_booked_by?: string;
  customer_id?: string;
  total?: number;
  order_date?: string;
  order_status?: string;
  created_at?: string;
  customers?: {
    display_name?: string;
    trading_name?: string;
  };
}

export const shippingService = {
  // Send order to packing
  async sendOrderToPacking(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('orders')
        .update({
          warehouse_status: 'sent_to_packing',
          sent_to_packing_at: new Date().toISOString(),
          sent_to_packing_by: user.id
        })
        .eq('id', orderId);

      if (error) throw error;

      return { success: true, message: 'Order sent to packing successfully' };
    } catch (error) {
      console.error('Error sending order to packing:', error);
      return { success: false, message: 'Failed to send order to packing' };
    }
  },

  // Update order to packed status
  async markOrderAsPacked(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('orders')
        .update({
          warehouse_status: 'packed',
          packed_at: new Date().toISOString(),
          packed_by: user.id
        })
        .eq('id', orderId);

      if (error) throw error;

      return { success: true, message: 'Order marked as packed successfully' };
    } catch (error) {
      console.error('Error marking order as packed:', error);
      return { success: false, message: 'Failed to mark order as packed' };
    }
  },

  // Book delivery for order
  async bookDelivery(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('orders')
        .update({
          warehouse_status: 'delivery_booked',
          delivery_booked_at: new Date().toISOString(),
          delivery_booked_by: user.id
        })
        .eq('id', orderId);

      if (error) throw error;

      return { success: true, message: 'Delivery booked successfully' };
    } catch (error) {
      console.error('Error booking delivery:', error);
      return { success: false, message: 'Failed to book delivery' };
    }
  },

  // Mark order as delivered
  async markAsDelivered(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          warehouse_status: 'delivered',
          order_status: 'delivered' // Also update the main order status
        })
        .eq('id', orderId);

      if (error) throw error;

      return { success: true, message: 'Order marked as delivered successfully' };
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      return { success: false, message: 'Failed to mark order as delivered' };
    }
  },

  // Get orders by warehouse status for current user's company
  async getOrdersByWarehouseStatus(companyId: string): Promise<{
    pending: OrderWithShipping[];
    sentToPacking: OrderWithShipping[];
    packed: OrderWithShipping[];
    deliveryBooked: OrderWithShipping[];
    delivered: OrderWithShipping[];
  }> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          legacy_order_number,
          warehouse_status,
          sent_to_packing_at,
          sent_to_packing_by,
          packed_at,
          packed_by,
          delivery_booked_at,
          delivery_booked_by,
          customer_id,
          total,
          order_date,
          order_status,
          created_at,
          customers:customer_id(display_name, trading_name)
        `)
        .eq('company_id', companyId)
        .in('warehouse_status', ['pending', 'sent_to_packing', 'packed', 'delivery_booked', 'delivered'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orders = (data || []).map(order => ({
        ...order,
        customers: Array.isArray(order.customers) ? order.customers[0] : order.customers
      })) as OrderWithShipping[];

      return {
        pending: orders.filter(o => o.warehouse_status === 'pending'),
        sentToPacking: orders.filter(o => o.warehouse_status === 'sent_to_packing'),
        packed: orders.filter(o => o.warehouse_status === 'packed'),
        deliveryBooked: orders.filter(o => o.warehouse_status === 'delivery_booked'),
        delivered: orders.filter(o => o.warehouse_status === 'delivered')
      };
    } catch (error) {
      console.error('Error fetching orders by warehouse status:', error);
      return {
        pending: [],
        sentToPacking: [],
        packed: [],
        deliveryBooked: [],
        delivered: []
      };
    }
  },

  // Get warehouse notifications for current user
  async getWarehouseNotifications(userId: string, limit: number = 20): Promise<WarehouseNotification[]> {
    try {
      const { data, error } = await supabase
        .from('warehouse_notifications')
        .select('*')
        .eq('sent_to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching warehouse notifications:', error);
      return [];
    }
  },

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('warehouse_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      return !error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Get warehouse activity log for an order
  async getWarehouseActivityLog(orderId: string): Promise<WarehouseActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('warehouse_activity_log')
        .select(`
          *,
          users(first_name, last_name)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching warehouse activity log:', error);
      return [];
    }
  },

  // Get unread notification count
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('warehouse_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('sent_to_user_id', userId)
        .is('read_at', null);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      return 0;
    }
  }
};