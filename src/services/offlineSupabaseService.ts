// Offline-aware Supabase Service
// Wraps Supabase calls with offline support

import { supabase } from './supabaseService';
import { offlineManager } from './offlineManager';

export interface OfflineSupabaseResponse<T = any> {
  data: T | null;
  error: any;
  isFromCache: boolean;
  isLocal: boolean;
}

class OfflineSupabaseService {
  private isOnline: boolean = navigator.onLine;

  constructor() {
    offlineManager.addNetworkListener((isOnline) => {
      this.isOnline = isOnline;
    });
  }

  // Enhanced select with offline support
  async select<T = any>(
    table: string,
    query: string = '*',
    filters?: Record<string, any>
  ): Promise<OfflineSupabaseResponse<T[]>> {
    try {
      if (this.isOnline) {
        // Try network first
        let supabaseQuery = supabase.from(table).select(query);
        
        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              supabaseQuery = supabaseQuery.in(key, value);
            } else if (typeof value === 'object' && value.operator) {
              // Advanced filter: { operator: 'gte', value: 100 }
              const operator = value.operator as 'gte' | 'gt' | 'lte' | 'lt' | 'eq' | 'neq' | 'like' | 'ilike';
              supabaseQuery = (supabaseQuery as any)[operator](key, value.value);
            } else {
              supabaseQuery = supabaseQuery.eq(key, value);
            }
          });
        }

        const { data, error } = await supabaseQuery;

        if (!error && data) {
          // Cache successful responses
          await offlineManager.cacheData(table, data);
          return { data: data as T[], error: null, isFromCache: false, isLocal: false };
        }

        throw error;
      } else {
        throw new Error('Network unavailable');
      }
    } catch (error) {
      console.log(`Network error for ${table}, checking cache...`);
      
      // Try cache
      const cachedData = await offlineManager.getCachedData(table);
      if (cachedData) {
        // Apply client-side filtering for cached data
        let filteredData = cachedData;
        if (filters) {
          filteredData = this.applyClientFilters(cachedData, filters);
        }
        
        return { 
          data: filteredData as T[], 
          error: null, 
          isFromCache: true, 
          isLocal: false 
        };
      }

      // Try local data
      const localData = await offlineManager.getLocalRecords(table);
      if (localData.length > 0) {
        return { 
          data: localData as T[], 
          error: null, 
          isFromCache: false, 
          isLocal: true 
        };
      }

      return { data: null, error, isFromCache: false, isLocal: false };
    }
  }

  // Enhanced insert with offline support
  async insert<T = any>(
    table: string,
    data: Partial<T> | Partial<T>[],
    options: { returning?: string } = {}
  ): Promise<OfflineSupabaseResponse<T[]>> {
    const records = Array.isArray(data) ? data : [data];
    
    if (this.isOnline) {
      try {
        const { data: insertedData, error } = await supabase
          .from(table)
          .insert(records)
          .select(options.returning || '*');

        if (!error) {
          // Update cache with new data
          const cachedData = await offlineManager.getCachedData(table) || [];
          const updatedCache = [...cachedData, ...(insertedData || [])];
          await offlineManager.cacheData(table, updatedCache);

          return { data: (insertedData || []) as T[], error: null, isFromCache: false, isLocal: false };
        }

        throw error;
      } catch (error) {
        // Fall through to offline handling
      }
    }

    // Offline handling
    console.log(`Storing ${table} insert for offline sync`);
    
    const localRecords: T[] = [];
    for (const record of records) {
      // Create local record for immediate UI feedback
      const localId = await offlineManager.createLocalRecord(table, record);
      const localRecord = { ...record, id: localId, _isLocal: true } as T;
      localRecords.push(localRecord);

      // Store request for later sync
      await offlineManager.storeOfflineRequest(
        `/rest/v1/${table}`,
        'POST',
        {
          'Content-Type': 'application/json',
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
        },
        record,
        table,
        'create'
      );
    }

    return { data: localRecords, error: null, isFromCache: false, isLocal: true };
  }

  // Enhanced update with offline support
  async update<T = any>(
    table: string,
    updates: Partial<T>,
    filters: Record<string, any>,
    options: { returning?: string } = {}
  ): Promise<OfflineSupabaseResponse<T[]>> {
    if (this.isOnline) {
      try {
        let supabaseQuery = supabase.from(table).update(updates);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          supabaseQuery = supabaseQuery.eq(key, value);
        });

        const { data, error } = await supabaseQuery.select(options.returning || '*');

        if (!error) {
          // Update cache
          const cachedData = await offlineManager.getCachedData(table) || [];
          const updatedCache = cachedData.map((item: any) => {
            const shouldUpdate = Object.entries(filters).every(([key, value]) => item[key] === value);
            return shouldUpdate ? { ...item, ...updates } : item;
          });
          await offlineManager.cacheData(table, updatedCache);

          return { data: (data || []) as T[], error: null, isFromCache: false, isLocal: false };
        }

        throw error;
      } catch (error) {
        // Fall through to offline handling
      }
    }

    // Offline handling
    console.log(`Storing ${table} update for offline sync`);
    
    // Store request for later sync
    await offlineManager.storeOfflineRequest(
      `/rest/v1/${table}?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [`${k}=eq.${v}`]))}`,
      'PATCH',
      {
        'Content-Type': 'application/json',
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
      },
      updates,
      table,
      'update'
    );

    // Update local cache optimistically
    const cachedData = await offlineManager.getCachedData(table) || [];
    const updatedCache = cachedData.map((item: any) => {
      const shouldUpdate = Object.entries(filters).every(([key, value]) => item[key] === value);
      return shouldUpdate ? { ...item, ...updates, _isPendingSync: true } : item;
    });
    await offlineManager.cacheData(table, updatedCache);

    return { data: updatedCache.filter((item: any) => 
      Object.entries(filters).every(([key, value]) => item[key] === value)
    ), error: null, isFromCache: true, isLocal: false };
  }

  // Enhanced delete with offline support
  async delete<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<OfflineSupabaseResponse<T[]>> {
    if (this.isOnline) {
      try {
        let supabaseQuery = supabase.from(table).delete();

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          supabaseQuery = supabaseQuery.eq(key, value);
        });

        const { data, error } = await supabaseQuery.select();

        if (!error) {
          // Update cache
          const cachedData = await offlineManager.getCachedData(table) || [];
          const updatedCache = cachedData.filter((item: any) => 
            !Object.entries(filters).every(([key, value]) => item[key] === value)
          );
          await offlineManager.cacheData(table, updatedCache);

          return { data, error: null, isFromCache: false, isLocal: false };
        }

        throw error;
      } catch (error) {
        // Fall through to offline handling
      }
    }

    // Offline handling
    console.log(`Storing ${table} delete for offline sync`);
    
    // Store request for later sync
    await offlineManager.storeOfflineRequest(
      `/rest/v1/${table}?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [`${k}=eq.${v}`]))}`,
      'DELETE',
      {
        'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY || ''}`
      },
      {},
      table,
      'delete'
    );

    // Update local cache optimistically
    const cachedData = await offlineManager.getCachedData(table) || [];
    const itemsToDelete = cachedData.filter((item: any) => 
      Object.entries(filters).every(([key, value]) => item[key] === value)
    );
    
    const updatedCache = cachedData.filter((item: any) => 
      !Object.entries(filters).every(([key, value]) => item[key] === value)
    );
    await offlineManager.cacheData(table, updatedCache);

    return { data: itemsToDelete, error: null, isFromCache: true, isLocal: false };
  }

  // Apply client-side filters to cached data
  private applyClientFilters(data: any[], filters: Record<string, any>): any[] {
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(item[key]);
        }
        if (typeof value === 'object' && value.operator) {
          const itemValue = item[key];
          switch (value.operator) {
            case 'gte': return itemValue >= value.value;
            case 'gt': return itemValue > value.value;
            case 'lte': return itemValue <= value.value;
            case 'lt': return itemValue < value.value;
            case 'neq': return itemValue !== value.value;
            case 'like': return String(itemValue).toLowerCase().includes(String(value.value).toLowerCase());
            case 'ilike': return String(itemValue).toLowerCase().includes(String(value.value).toLowerCase());
            default: return itemValue === value.value;
          }
        }
        return item[key] === value;
      });
    });
  }

  // Get network and sync status
  public async getStatus() {
    return await offlineManager.getOfflineStatus();
  }

  // Manually trigger sync
  public async sync() {
    return await offlineManager.syncOfflineData();
  }
}

// Export singleton instance
export const offlineSupabase = new OfflineSupabaseService();