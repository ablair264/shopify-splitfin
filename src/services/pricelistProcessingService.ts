import { supabase } from './supabaseService';
import * as XLSX from 'xlsx';

export interface PriceChange {
  sku: string;
  product_name: string;
  current_price?: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  action: 'update' | 'create';
  confidence: number;
  brand_id?: string;
  category?: string;
  description?: string;
  manufacturer?: string;
  ean?: string;
  packing_unit?: number;
}

export interface ProcessingResult {
  preview: any[];
  changes: PriceChange[];
  supplier: string;
  brand: string;
  totalProducts: number;
  newProducts: number;
  priceUpdates: number;
}

class PricelistProcessingService {
  private extractTextFromPDF = async (file: File): Promise<string> => {
    // For now, return a placeholder. In production, you'd use a PDF parsing library
    // like PDF.js or send to a server-side service
    return new Promise((resolve) => {
      resolve('PDF text extraction not yet implemented. Please use CSV or Excel files.');
    });
  };

  private parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  private parseCSVFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const result = lines.map(line => {
            // Simple CSV parsing - in production you might want a more robust parser
            return line.split(',').map(cell => cell.trim().replace(/"/g, ''));
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  private detectSupplierFromFilename = (filename: string): { supplier: string; brand: string } => {
    const name = filename.toLowerCase();
    
    if (name.includes('rader')) return { supplier: 'Rader Design', brand: 'Rader' };
    if (name.includes('elvang')) return { supplier: 'Elvang Danmark A/S', brand: 'Elvang' };
    if (name.includes('myflame') || name.includes('my-flame')) return { supplier: 'My Flame Lifestyle', brand: 'My Flame Lifestyle' };
    if (name.includes('remember')) return { supplier: 'Remember Deutschland GmbH', brand: 'Remember' };
    if (name.includes('relaxound')) return { supplier: 'Relaxound GmbH', brand: 'Relaxound' };
    if (name.includes('gefu')) return { supplier: 'GEFU', brand: 'GEFU' };
    
    return { supplier: 'Unknown Supplier', brand: 'Unknown' };
  };

  private mapColumnsToSchema = (headers: string[]): { [key: string]: number } => {
    const mapping: { [key: string]: number } = {};
    const candidates: {
      [key: string]: Array<{ index: number; score: number; header: string }>
    } = {
      sku: [],
      name: [],
      price: [],
      retail_price: [],
      ean: [],
      category: [],
      manufacturer: [],
      packing_unit: []
    };
    
    headers.forEach((header, index) => {
      const headerLower = header.toString().toLowerCase().trim();
      const headerClean = headerLower.replace(/[_\-\s]/g, '');
      
      // SKU mapping
      if (headerLower === 'sku') candidates.sku.push({ index, score: 100, header });
      else if (headerLower === 'article') candidates.sku.push({ index, score: 90, header });
      else if (headerLower === 'item_no' || headerLower === 'itemno') candidates.sku.push({ index, score: 85, header });
      else if (headerLower === 'product_code' || headerLower === 'productcode') candidates.sku.push({ index, score: 80, header });
      else if (headerLower === 'code') candidates.sku.push({ index, score: 70, header });
      else if (headerLower.includes('sku')) candidates.sku.push({ index, score: 60, header });
      else if (headerLower.includes('article')) candidates.sku.push({ index, score: 50, header });
      
      // Name mapping  
      if (headerLower === 'name') candidates.name.push({ index, score: 100, header });
      else if (headerLower === 'product_name' || headerClean === 'productname') candidates.name.push({ index, score: 95, header });
      else if (headerLower === 'title') candidates.name.push({ index, score: 90, header });
      else if (headerLower === 'description' && !candidates.name.some(c => c.score > 80)) {
        candidates.name.push({ index, score: 70, header });
      }
      else if (headerLower.includes('name')) candidates.name.push({ index, score: 60, header });
      
      // Price mapping - distinguish between cost and retail prices
      if (headerLower === 'cost_price' || headerClean === 'costprice') {
        candidates.price.push({ index, score: 100, header });
      } else if (headerLower === 'purchase_price' || headerClean === 'purchaseprice') {
        candidates.price.push({ index, score: 95, header });
      } else if (headerLower === 'wholesale_price' || headerClean === 'wholesaleprice') {
        candidates.price.push({ index, score: 90, header });
      } else if (headerLower === 'cost') {
        candidates.price.push({ index, score: 85, header });
      } else if (headerLower === 'wholesale') {
        candidates.price.push({ index, score: 80, header });
      } else if (headerLower.includes('cost') && headerLower.includes('price')) {
        candidates.price.push({ index, score: 75, header });
      } else if (headerLower.includes('purchase') && headerLower.includes('price')) {
        candidates.price.push({ index, score: 70, header });
      }
      
      // Retail price mapping (separate from cost price)
      if (headerLower === 'retail_price' || headerClean === 'retailprice') {
        candidates.retail_price.push({ index, score: 100, header });
      } else if (headerLower === 'rrp') {
        candidates.retail_price.push({ index, score: 95, header });
      } else if (headerLower === 'msrp') {
        candidates.retail_price.push({ index, score: 90, header });
      } else if (headerLower === 'retail') {
        candidates.retail_price.push({ index, score: 85, header });
      } else if (headerLower.includes('retail') && headerLower.includes('price')) {
        candidates.retail_price.push({ index, score: 80, header });
      }
      
      // Generic price (only if we haven't found specific cost/retail prices)
      if (headerLower === 'price' && candidates.price.length === 0) {
        candidates.price.push({ index, score: 50, header });
      }
      
      // EAN mapping
      if (headerLower === 'ean') candidates.ean.push({ index, score: 100, header });
      else if (headerLower === 'barcode') candidates.ean.push({ index, score: 90, header });
      else if (headerLower === 'gtin') candidates.ean.push({ index, score: 85, header });
      else if (headerLower.includes('ean')) candidates.ean.push({ index, score: 70, header });
      else if (headerLower.includes('barcode')) candidates.ean.push({ index, score: 65, header });
      
      // Category mapping
      if (headerLower === 'category') candidates.category.push({ index, score: 100, header });
      else if (headerLower === 'group') candidates.category.push({ index, score: 80, header });
      else if (headerLower === 'type') candidates.category.push({ index, score: 70, header });
      else if (headerLower.includes('category')) candidates.category.push({ index, score: 60, header });
      
      // Manufacturer mapping
      if (headerLower === 'manufacturer') candidates.manufacturer.push({ index, score: 100, header });
      else if (headerLower === 'brand') candidates.manufacturer.push({ index, score: 90, header });
      else if (headerLower === 'supplier') candidates.manufacturer.push({ index, score: 85, header });
      else if (headerLower.includes('manufacturer')) candidates.manufacturer.push({ index, score: 70, header });
      else if (headerLower.includes('brand')) candidates.manufacturer.push({ index, score: 65, header });
      
      // Packing unit mapping
      if (headerLower === 'packing_unit' || headerClean === 'packingunit') {
        candidates.packing_unit.push({ index, score: 100, header });
      } else if (headerLower === 'pack_size' || headerClean === 'packsize') {
        candidates.packing_unit.push({ index, score: 95, header });
      } else if (headerLower === 'quantity' || headerLower === 'qty') {
        candidates.packing_unit.push({ index, score: 85, header });
      } else if (headerLower === 'unit') {
        candidates.packing_unit.push({ index, score: 80, header });
      } else if (headerLower === 'packing') {
        candidates.packing_unit.push({ index, score: 75, header });
      } else if (headerLower.includes('pack')) {
        candidates.packing_unit.push({ index, score: 60, header });
      }
    });
    
    // Select best candidate for each field
    Object.entries(candidates).forEach(([field, fieldCandidates]) => {
      if (fieldCandidates.length > 0) {
        fieldCandidates.sort((a, b) => b.score - a.score);
        mapping[field] = fieldCandidates[0].index;
      }
    });
    
    // Log the mapping for debugging
    console.log('Column mapping:', {
      headers,
      mapping,
      candidates: Object.entries(candidates).reduce((acc, [field, cands]) => {
        acc[field] = cands.map(c => `${c.header}(${c.score})`);
        return acc;
      }, {} as any)
    });
    
    return mapping;
  };

  private cleanPrice = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return 0;
    
    // Remove currency symbols, spaces, and convert commas to dots
    const cleaned = priceStr.toString()
      .replace(/[£$€¥₹]/g, '')
      .replace(/,/g, '.')
      .replace(/\s+/g, '')
      .trim();
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  private getBrandId = async (brandName: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id')
        .ilike('brand_name', `%${brandName}%`)
        .single();
      
      if (error || !data) {
        console.log(`Brand not found: ${brandName}`);
        return null;
      }
      
      return data.id;
    } catch (error) {
      console.error('Error fetching brand ID:', error);
      return null;
    }
  };

  private getExistingProduct = async (sku: string, brandId?: string): Promise<any | null> => {
    try {
      // Build query with proper error handling
      // Don't filter by brand_id - we want to find products by SKU regardless of brand
      const query = supabase
        .from('items')
        .select('id, sku, name, purchase_price, cost_price, retail_price, brand_id, status')
        .eq('sku', sku);
      
      // Use maybeSingle() instead of single() to handle no results gracefully
      const { data, error } = await query.maybeSingle();
      
      if (error) {
        console.warn(`Error querying product with SKU ${sku}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.warn(`Exception querying product with SKU ${sku}:`, error);
      return null;
    }
  };

  private processDataRows = async (
    rows: any[][],
    mapping: { [key: string]: number },
    brandId: string | null
  ): Promise<PriceChange[]> => {
    const changes: PriceChange[] = [];
    
    // Extract all SKUs first for batch lookup
    const skuList: string[] = [];
    const validRows: { row: any[]; index: number }[] = [];
    
    for (let i = 1; i < rows.length; i++) { // Skip header row
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const sku = row[mapping.sku]?.toString().trim();
      const name = row[mapping.name]?.toString().trim();
      const newPrice = this.cleanPrice(row[mapping.price]);
      
      if (!sku || !name || newPrice <= 0) continue;
      
      skuList.push(sku);
      validRows.push({ row, index: i });
    }
    
    // Batch lookup existing products
    const existingProducts = await this.batchGetExistingProducts(skuList, brandId);
    
    // Process each valid row
    for (const { row } of validRows) {
      const sku = row[mapping.sku]?.toString().trim();
      const name = row[mapping.name]?.toString().trim();
      const newPrice = this.cleanPrice(row[mapping.price]);
      
      const existingProduct = existingProducts[sku];
      
      if (existingProduct) {
        // Update existing product
        const currentPrice = existingProduct.purchase_price || existingProduct.cost_price || 0;
        const priceChange = newPrice - currentPrice;
        const priceChangePercent = currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;
        
        changes.push({
          sku,
          product_name: name,
          current_price: currentPrice,
          new_price: newPrice,
          price_change: priceChange,
          price_change_percent: priceChangePercent,
          action: 'update',
          confidence: 0.95,
          brand_id: brandId || undefined,
          category: row[mapping.category]?.toString().trim(),
          description: row[mapping.name]?.toString().trim(),
          manufacturer: row[mapping.manufacturer]?.toString().trim(),
          ean: row[mapping.ean]?.toString().trim(),
          packing_unit: mapping.packing_unit !== undefined ? parseInt(row[mapping.packing_unit]) : undefined
        });
      } else {
        // Create new product
        changes.push({
          sku,
          product_name: name,
          new_price: newPrice,
          price_change: newPrice,
          price_change_percent: 100,
          action: 'create',
          confidence: 0.9,
          brand_id: brandId || undefined,
          category: row[mapping.category]?.toString().trim(),
          description: row[mapping.name]?.toString().trim(),
          manufacturer: row[mapping.manufacturer]?.toString().trim(),
          ean: row[mapping.ean]?.toString().trim(),
          packing_unit: mapping.packing_unit !== undefined ? parseInt(row[mapping.packing_unit]) : undefined
        });
      }
    }
    
    return changes;
  };

  private batchGetExistingProducts = async (
    skuList: string[],
    brandId: string | null
  ): Promise<{ [sku: string]: any }> => {
    if (skuList.length === 0) return {};
    
    try {
      // Query all SKUs at once
      // Don't filter by brand_id here - we want to find products by SKU regardless of brand
      // and update the brand if needed
      const query = supabase
        .from('items')
        .select('id, sku, name, purchase_price, cost_price, retail_price, brand_id, status')
        .in('sku', skuList);
      
      const { data, error } = await query;
      
      if (error) {
        console.warn('Error in batch product lookup:', error);
        return {};
      }
      
      // Create lookup map
      const productMap: { [sku: string]: any } = {};
      if (data) {
        data.forEach(product => {
          if (product.sku) {
            productMap[product.sku] = product;
          }
        });
      }
      
      return productMap;
    } catch (error) {
      console.warn('Exception in batch product lookup:', error);
      return {};
    }
  };

  public processFile = async (file: File): Promise<ProcessingResult> => {
    const { supplier, brand } = this.detectSupplierFromFilename(file.name);
    const brandId = await this.getBrandId(brand);
    
    let rawData: any[];
    
    // Parse file based on type
    const extension = file.name.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'csv':
        rawData = await this.parseCSVFile(file);
        break;
      case 'xlsx':
      case 'xls':
        rawData = await this.parseExcelFile(file);
        break;
      case 'pdf':
        throw new Error('PDF processing not yet implemented. Please convert to CSV or Excel format.');
      default:
        throw new Error('Unsupported file format. Please use CSV, Excel, or PDF files.');
    }
    
    if (rawData.length < 2) {
      throw new Error('File appears to be empty or has no data rows.');
    }
    
    // Map columns to our schema
    const headers = rawData[0];
    const columnMapping = this.mapColumnsToSchema(headers);
    
    if (!columnMapping.sku || !columnMapping.name || !columnMapping.price) {
      const detectedColumns = Object.entries(columnMapping)
        .map(([field, index]) => `${field}: column ${index + 1} (${headers[index]})`)
        .join(', ');
      
      const missingColumns = [];
      if (!columnMapping.sku) missingColumns.push('SKU');
      if (!columnMapping.name) missingColumns.push('Name');
      if (!columnMapping.price) missingColumns.push('Price');
      
      throw new Error(
        `Could not identify required columns in the file.\n` +
        `Missing: ${missingColumns.join(', ')}\n` +
        `Detected: ${detectedColumns || 'none'}\n` +
        `Headers: ${headers.join(', ')}`
      );
    }
    
    // Process data rows
    const changes = await this.processDataRows(rawData, columnMapping, brandId);
    
    const newProducts = changes.filter(c => c.action === 'create').length;
    const priceUpdates = changes.filter(c => c.action === 'update').length;
    
    return {
      preview: rawData.slice(0, 10), // First 10 rows for preview
      changes,
      supplier,
      brand,
      totalProducts: changes.length,
      newProducts,
      priceUpdates
    };
  };

  public applyChanges = async (changes: PriceChange[]): Promise<void> => {
    const updates = changes.filter(c => c.action === 'update');
    const creates = changes.filter(c => c.action === 'create');
    
    // Apply price updates
    for (const change of updates) {
      try {
        const updateData: any = {
          purchase_price: change.new_price,
          cost_price: change.new_price,
          updated_at: new Date().toISOString()
        };
        
        // Also update brand_id if provided
        if (change.brand_id) {
          updateData.brand_id = change.brand_id;
        }
        
        const { error } = await supabase
          .from('items')
          .update(updateData)
          .eq('sku', change.sku);
        
        if (error) {
          console.error(`Failed to update product ${change.sku}:`, error);
        }
      } catch (error) {
        console.error(`Error updating product ${change.sku}:`, error);
      }
    }
    
    // Create new products
    for (const change of creates) {
      try {
        const newProduct = {
          sku: change.sku,
          name: change.product_name,
          description: change.description || change.product_name,
          brand_id: change.brand_id,
          category: change.category,
          manufacturer: change.manufacturer,
          ean: change.ean,
          packing_unit: change.packing_unit || 1,
          purchase_price: change.new_price,
          cost_price: change.new_price,
          retail_price: change.new_price * 2.5, // Default markup
          gross_stock_level: 0,
          reorder_level: 0,
          status: 'active',
          created_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('items')
          .insert([newProduct]);
        
        if (error) {
          console.error(`Failed to create product ${change.sku}:`, error);
        }
      } catch (error) {
        console.error(`Error creating product ${change.sku}:`, error);
      }
    }
    
    // Run the existing export processes (integrate with your current Pricelists system)
    await this.triggerExportProcesses();
  };

  private triggerExportProcesses = async (): Promise<void> => {
    // Import the export service dynamically to avoid circular dependencies
    const { pricelistExportService } = await import('./pricelistExportService');
    
    try {
      console.log('Triggering export processes for updated inventory...');
      
      // Run the full export workflow that integrates with your existing Pricelists system
      await pricelistExportService.runFullExportWorkflow();
      
      console.log('Export processes completed successfully');
      
    } catch (error) {
      console.error('Error in export processes:', error);
      // Don't throw error - updates to inventory should succeed even if exports fail
    }
  };
}

export const pricelistProcessingService = new PricelistProcessingService();