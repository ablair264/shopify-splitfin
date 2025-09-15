import { supabase } from './supabaseService';

export interface Product {
  id: string;
  name: string;
  sku: string;
  gross_stock_level: number;
  net_stock_level: number;
  retail_price: number;
  cost_price: number;
  purchase_price: number;
  brand_id: string;
  manufacturer?: string;
  image_url?: string;
  category?: string;
  colour?: string;
  description?: string;
  ean?: string;
  status: 'active' | 'inactive';
  created_date?: string;
  updated_at?: string;
  height?: number;
  width?: number;
  length?: number;
  diameter?: number;
  packing_unit?: number;
  catalogue_page_number?: number;
  brand?: {
    id: string;
    brand_name: string;
    brand_normalized: string;
    logo_url?: string;
    company_id: string;
    is_active: boolean;
  };
  [key: string]: any;
}

export class BarcodeService {
  /**
   * Search for product by barcode (EAN, SKU, or other identifier)
   */
  static async findProductByBarcode(barcode: string): Promise<Product | null> {
    try {
      // Clean the barcode (remove any whitespace, ensure it's a string)
      const cleanBarcode = String(barcode).trim();
      
      // Try multiple search strategies to find the product
      const searchQueries = [
        // 1. Exact string match
        supabase
          .from('items')
          .select(`
            *,
            brand:brands(
              id,
              brand_name,
              brand_normalized,
              logo_url,
              company_id,
              is_active
            )
          `)
          .eq('ean', cleanBarcode)
          .eq('status', 'active')
          .maybeSingle(),
          
        // 2. Match with .0 suffix (common in Supabase numeric storage)
        supabase
          .from('items')
          .select(`
            *,
            brand:brands(
              id,
              brand_name,
              brand_normalized,
              logo_url,
              company_id,
              is_active
            )
          `)
          .eq('ean', `${cleanBarcode}.0`)
          .eq('status', 'active')
          .maybeSingle(),
          
        // 3. Numeric comparison
        supabase
          .from('items')
          .select(`
            *,
            brand:brands(
              id,
              brand_name,
              brand_normalized,
              logo_url,
              company_id,
              is_active
            )
          `)
          .eq('ean', Number(cleanBarcode))
          .eq('status', 'active')
          .maybeSingle(),
          
        // 4. Text search (in case EAN is stored as text with formatting)
        supabase
          .from('items')
          .select(`
            *,
            brand:brands(
              id,
              brand_name,
              brand_normalized,
              logo_url,
              company_id,
              is_active
            )
          `)
          .textSearch('ean', cleanBarcode)
          .eq('status', 'active')
          .maybeSingle()
      ];

      // Execute all queries and return the first successful match
      for (const query of searchQueries) {
        const { data: product, error } = await query;
        
        if (product && !error) {
          return product;
        }
        
        // Log non-critical errors for debugging
        if (error && error.code !== 'PGRST116') {
          console.warn('Search query failed:', error);
        }
      }

      // If not found by EAN, try by SKU
      let { data: product, error } = await supabase
        .from('items')
        .select(`
          *,
          brand:brands(
            id,
            brand_name,
            brand_normalized,
            logo_url,
            company_id,
            is_active
          )
        `)
        .eq('sku', cleanBarcode)
        .eq('status', 'active')
        .maybeSingle();

      if (product && !error) {
        return product;
      }

      // If still not found, try partial matches on SKU or name
      ({ data: product, error } = await supabase
        .from('items')
        .select(`
          *,
          brand:brands(
            id,
            brand_name,
            brand_normalized,
            logo_url,
            company_id,
            is_active
          )
        `)
        .or(`sku.ilike.%${cleanBarcode}%,name.ilike.%${cleanBarcode}%`)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle());

      if (error && error.code !== 'PGRST116') {
        console.error('Error searching for product:', error);
      }

      return product || null;
    } catch (error) {
      console.error('Error in findProductByBarcode:', error);
      return null;
    }
  }

  /**
   * Get multiple products by barcodes (for batch scanning)
   */
  static async findProductsByBarcodes(barcodes: string[]): Promise<Product[]> {
    try {
      const { data: products, error } = await supabase
        .from('items')
        .select(`
          *,
          brand:brands(
            id,
            brand_name,
            brand_normalized,
            logo_url,
            company_id,
            is_active
          )
        `)
        .or(barcodes.map(code => `ean.eq.${code},sku.eq.${code}`).join(','))
        .eq('status', 'active');

      if (error) {
        console.error('Error searching for products:', error);
        return [];
      }

      return products || [];
    } catch (error) {
      console.error('Error in findProductsByBarcodes:', error);
      return [];
    }
  }

  /**
   * Log barcode scan events (for analytics/debugging)
   */
  static async logScanEvent(barcode: string, found: boolean, productId?: string) {
    // Temporarily disabled - scan_logs table doesn't exist
    console.log('Scan event:', { barcode, found, productId });
    
    // Uncomment when scan_logs table is created:
    // try {
    //   await supabase
    //     .from('scan_logs')
    //     .insert({
    //       barcode,
    //       found,
    //       product_id: productId,
    //       scanned_at: new Date().toISOString()
    //     });
    // } catch (error) {
    //   console.warn('Failed to log scan event:', error);
    // }
  }
}