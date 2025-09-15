import { supabase } from './supabaseService';

// Airtable configuration
const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const AIRTABLE_BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_NAME = 'Items'; // Default table name

// Validate Airtable configuration
if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
  console.warn('Airtable configuration missing. Please set REACT_APP_AIRTABLE_BASE_ID and REACT_APP_AIRTABLE_API_KEY environment variables.');
}

// Item interface based on Supabase schema
export interface Item {
  id: string;
  name: string;
  sku: string;
  ean?: string;
  description?: string;
  category?: string;
  brand_id: string;
  brand_name?: string;
  gross_stock_level: number;
  reorder_level: number;
  retail_price?: number;
  cost_price?: number;
  status: string;
  image_url?: string;
  created_date: string;
  last_modified?: string;
  legacy_item_id?: string;
  manufacturer?: string;
}

// Airtable record format
export interface AirtableRecord {
  id?: string;
  fields: {
    [key: string]: any;
  };
  createdTime?: string;
}

// Airtable response format
export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Field mapping between Supabase and Airtable
const FIELD_MAPPING = {
  // Supabase field -> Airtable field
  id: 'ID',
  name: 'Name',
  sku: 'SKU',
  ean: 'EAN',
  description: 'Description',
  category: 'Category',
  brand_id: 'Brand ID',
  brand_name: 'Brand Name',
  gross_stock_level: 'Stock Level',
  reorder_level: 'Reorder Level',
  retail_price: 'Retail Price',
  cost_price: 'Cost Price',
  status: 'Status',
  image_url: 'Image URL',
  created_date: 'Created Date',
  last_modified: 'Last Modified',
  legacy_item_id: 'Legacy Item ID',
  manufacturer: 'Manufacturer'
};

// Reverse mapping for reading from Airtable
const REVERSE_FIELD_MAPPING = Object.fromEntries(
  Object.entries(FIELD_MAPPING).map(([key, value]) => [value, key])
);

class AirtableService {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(tableName: string = AIRTABLE_TABLE_NAME) {
    this.baseUrl = `${AIRTABLE_API_URL}/${AIRTABLE_BASE_ID}/${tableName}`;
    this.headers = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Convert Supabase item to Airtable record format
   */
  private mapToAirtable(item: Partial<Item>): AirtableRecord {
    const fields: { [key: string]: any } = {};
    
    Object.entries(item).forEach(([key, value]) => {
      const airtableField = FIELD_MAPPING[key as keyof typeof FIELD_MAPPING];
      if (airtableField && value !== undefined && value !== null) {
        fields[airtableField] = value;
      }
    });

    return { fields };
  }

  /**
   * Convert Airtable record to Supabase item format
   */
  private mapFromAirtable(record: AirtableRecord): Item {
    const item: any = {};
    
    Object.entries(record.fields).forEach(([airtableField, value]) => {
      const supabaseField = REVERSE_FIELD_MAPPING[airtableField];
      if (supabaseField && value !== undefined && value !== null) {
        item[supabaseField] = value;
      }
    });

    // Ensure required fields have default values
    return {
      id: item.id || record.id || '',
      name: item.name || '',
      sku: item.sku || '',
      brand_id: item.brand_id || '',
      gross_stock_level: item.gross_stock_level || 0,
      reorder_level: item.reorder_level || 0,
      status: item.status || 'active',
      created_date: item.created_date || record.createdTime || new Date().toISOString(),
      ...item
    };
  }

  /**
   * Check if Airtable is properly configured
   */
  isConfigured(): boolean {
    return !!(AIRTABLE_BASE_ID && AIRTABLE_API_KEY);
  }

  /**
   * Create a new item in Airtable
   */
  async createItem(item: Partial<Item>): Promise<Item> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    try {
      const airtableRecord = this.mapToAirtable(item);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(airtableRecord),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const createdRecord: AirtableRecord = await response.json();
      return this.mapFromAirtable(createdRecord);
    } catch (error) {
      console.error('Error creating item in Airtable:', error);
      throw error;
    }
  }

  /**
   * Get an item by ID from Airtable
   */
  async getItem(id: string): Promise<Item | null> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: this.headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const record: AirtableRecord = await response.json();
      return this.mapFromAirtable(record);
    } catch (error) {
      console.error('Error getting item from Airtable:', error);
      throw error;
    }
  }

  /**
   * Get multiple items with optional filtering
   */
  async getItems(options: {
    filterByFormula?: string;
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    maxRecords?: number;
    offset?: string;
  } = {}): Promise<{ items: Item[]; offset?: string }> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.filterByFormula) {
        params.append('filterByFormula', options.filterByFormula);
      }
      
      if (options.sort) {
        options.sort.forEach((sortOption, index) => {
          params.append(`sort[${index}][field]`, sortOption.field);
          params.append(`sort[${index}][direction]`, sortOption.direction);
        });
      }
      
      if (options.maxRecords) {
        params.append('maxRecords', options.maxRecords.toString());
      }
      
      if (options.offset) {
        params.append('offset', options.offset);
      }

      const url = params.toString() ? `${this.baseUrl}?${params.toString()}` : this.baseUrl;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const data: AirtableResponse = await response.json();
      const items = data.records.map(record => this.mapFromAirtable(record));
      
      return {
        items,
        offset: data.offset
      };
    } catch (error) {
      console.error('Error getting items from Airtable:', error);
      throw error;
    }
  }

  /**
   * Update an item in Airtable
   */
  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    try {
      const airtableRecord = this.mapToAirtable(updates);
      
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(airtableRecord),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      const updatedRecord: AirtableRecord = await response.json();
      return this.mapFromAirtable(updatedRecord);
    } catch (error) {
      console.error('Error updating item in Airtable:', error);
      throw error;
    }
  }

  /**
   * Delete an item from Airtable
   */
  async deleteItem(id: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: this.headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Airtable API error: ${response.status} - ${errorText}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting item from Airtable:', error);
      throw error;
    }
  }

  /**
   * Sync items from Supabase to Airtable
   */
  async syncFromSupabase(companyId?: string): Promise<{ synced: number; errors: string[] }> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    const errors: string[] = [];
    let synced = 0;

    try {
      // Get items from Supabase
      let query = supabase
        .from('items')
        .select(`
          id,
          name,
          sku,
          ean,
          description,
          category,
          brand_id,
          gross_stock_level,
          reorder_level,
          retail_price,
          cost_price,
          status,
          image_url,
          created_date,
          last_modified,
          legacy_item_id,
          manufacturer,
          brands!inner(
            id,
            brand_name,
            company_id
          )
        `)
        .eq('status', 'active');

      if (companyId) {
        query = query.eq('brands.company_id', companyId);
      }

      const { data: items, error } = await query;

      if (error) {
        throw error;
      }

      if (!items || items.length === 0) {
        return { synced: 0, errors: [] };
      }

      // Sync items to Airtable in batches of 10 (Airtable limit)
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const airtableRecords = batch.map(item => {
          // Since brands is joined, it should be a single object, not an array
          const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
          return this.mapToAirtable({
            ...item,
            brand_name: brand?.brand_name
          });
        });

        try {
          const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ records: airtableRecords }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorText}`);
          } else {
            synced += batch.length;
          }
        } catch (error) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { synced, errors };
    } catch (error) {
      console.error('Error syncing from Supabase to Airtable:', error);
      throw error;
    }
  }

  /**
   * Search items by name or SKU
   */
  async searchItems(query: string, maxRecords: number = 50): Promise<Item[]> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    const filterFormula = `OR(SEARCH("${query}", {Name}), SEARCH("${query}", {SKU}))`;
    
    const { items } = await this.getItems({
      filterByFormula: filterFormula,
      maxRecords
    });

    return items;
  }

  /**
   * Get low stock items
   */
  async getLowStockItems(maxRecords: number = 100): Promise<Item[]> {
    if (!this.isConfigured()) {
      throw new Error('Airtable is not configured');
    }

    const filterFormula = `{Stock Level} <= {Reorder Level}`;
    
    const { items } = await this.getItems({
      filterByFormula: filterFormula,
      sort: [{ field: 'Stock Level', direction: 'asc' }],
      maxRecords
    });

    return items;
  }
}

// Export a default instance
export const airtableService = new AirtableService();

// Export the class for custom instances
export { AirtableService };