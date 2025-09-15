import { useState, useEffect, useCallback } from 'react';
import { airtableService, Item } from '../services/airtableService';

// Hook for managing Airtable items
export function useAirtableItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async (options: {
    filterByFormula?: string;
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    maxRecords?: number;
  } = {}) => {
    if (!airtableService.isConfigured()) {
      setError('Airtable is not configured. Please check your environment variables.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { items: fetchedItems } = await airtableService.getItems(options);
      setItems(fetchedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (item: Partial<Item>) => {
    if (!airtableService.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    setLoading(true);
    setError(null);

    try {
      const newItem = await airtableService.createItem(item);
      setItems(prevItems => [...prevItems, newItem]);
      return newItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<Item>) => {
    if (!airtableService.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    setLoading(true);
    setError(null);

    try {
      const updatedItem = await airtableService.updateItem(id, updates);
      setItems(prevItems => 
        prevItems.map(item => item.id === id ? updatedItem : item)
      );
      return updatedItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    if (!airtableService.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    setLoading(true);
    setError(null);

    try {
      await airtableService.deleteItem(id);
      setItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchItems = useCallback(async (query: string, maxRecords?: number) => {
    if (!airtableService.isConfigured()) {
      setError('Airtable is not configured');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const results = await airtableService.searchItems(query, maxRecords);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search items');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const syncFromSupabase = useCallback(async (companyId?: string) => {
    if (!airtableService.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await airtableService.syncFromSupabase(companyId);
      // Refresh items after sync
      await fetchItems();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync from Supabase';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    searchItems,
    syncFromSupabase,
    isConfigured: airtableService.isConfigured()
  };
}

// Hook for managing a single Airtable item
export function useAirtableItem(id?: string) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItem = useCallback(async (itemId: string) => {
    if (!airtableService.isConfigured()) {
      setError('Airtable is not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedItem = await airtableService.getItem(itemId);
      setItem(fetchedItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch item');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (updates: Partial<Item>) => {
    if (!id || !airtableService.isConfigured()) {
      throw new Error('Item ID is required and Airtable must be configured');
    }

    setLoading(true);
    setError(null);

    try {
      const updatedItem = await airtableService.updateItem(id, updates);
      setItem(updatedItem);
      return updatedItem;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const deleteItem = useCallback(async () => {
    if (!id || !airtableService.isConfigured()) {
      throw new Error('Item ID is required and Airtable must be configured');
    }

    setLoading(true);
    setError(null);

    try {
      await airtableService.deleteItem(id);
      setItem(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete item';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Auto-fetch item when ID is provided
  useEffect(() => {
    if (id) {
      fetchItem(id);
    }
  }, [id, fetchItem]);

  return {
    item,
    loading,
    error,
    fetchItem,
    updateItem,
    deleteItem,
    isConfigured: airtableService.isConfigured()
  };
}

// Hook for low stock items
export function useAirtableLowStock() {
  const [lowStockItems, setLowStockItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLowStockItems = useCallback(async (maxRecords?: number) => {
    if (!airtableService.isConfigured()) {
      setError('Airtable is not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const items = await airtableService.getLowStockItems(maxRecords);
      setLowStockItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch low stock items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLowStockItems();
  }, [fetchLowStockItems]);

  return {
    lowStockItems,
    loading,
    error,
    refreshLowStock: fetchLowStockItems,
    isConfigured: airtableService.isConfigured()
  };
}