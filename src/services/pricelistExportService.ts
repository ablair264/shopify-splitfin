import { supabase } from './supabaseService';
import * as XLSX from 'xlsx';

/**
 * Service to integrate Splitfin updates with the existing Pricelists export system
 * This bridges the gap between Splitfin's real-time updates and the batch export processes
 */
class PricelistExportService {
  private pricelistsBasePath = '/Users/alastairblair/Development/Pricelists';

  /**
   * Export updated inventory data to formats compatible with existing Pricelists system
   */
  public exportToMasterDatasets = async (): Promise<void> => {
    try {
      console.log('Starting master dataset export...');
      
      // Get all active inventory items from Splitfin
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          *,
          brands:brand_id (
            id,
            brand_name
          )
        `)
        .eq('status', 'active');

      if (error) {
        throw new Error(`Failed to fetch inventory: ${error.message}`);
      }

      if (!items || items.length === 0) {
        console.log('No active items found for export');
        return;
      }

      // Group items by brand for export
      const itemsByBrand = this.groupItemsByBrand(items);
      
      // Export each brand to separate master files (compatible with existing system)
      await Promise.all(Object.entries(itemsByBrand).map(([brandName, brandItems]) => 
        this.exportBrandMasterFile(brandName, brandItems)
      ));

      // Create consolidated master file
      await this.createConsolidatedMaster(items);
      
      console.log('Master dataset export completed');
    } catch (error) {
      console.error('Error in exportToMasterDatasets:', error);
      throw error;
    }
  };

  /**
   * Group items by brand name for export
   */
  private groupItemsByBrand = (items: any[]): { [brandName: string]: any[] } => {
    return items.reduce((acc, item) => {
      const brandName = item.brands?.brand_name || item.brands?.name || 'Unknown';
      if (!acc[brandName]) {
        acc[brandName] = [];
      }
      acc[brandName].push(item);
      return acc;
    }, {});
  };

  /**
   * Export individual brand master file (compatible with existing Pricelists system)
   */
  private exportBrandMasterFile = async (brandName: string, items: any[]): Promise<void> => {
    try {
      // Map Splitfin data to Pricelists system format
      const exportData = items.map(item => ({
        // Core product info
        sku: item.sku || '',
        name: item.name || '',
        description: item.description || item.name || '',
        brand_name: brandName,
        category: item.category || '',
        colour: item.colour || '',
        ean: item.ean || '',
        manufacturer: item.manufacturer || brandName,
        
        // Pricing
        cost_price: item.cost_price || 0,
        retail_price: item.retail_price || 0,
        purchase_price: item.purchase_price || item.cost_price || 0,
        
        // Physical attributes
        weight: item.weight || 0,
        height: item.height || 0,
        width: item.width || 0,
        length: item.length || 0,
        diameter: item.diameter || 0,
        volume: item.volume || 0,
        
        // Inventory
        packing_unit: item.packing_unit || 1,
        gross_stock_level: item.gross_stock_level || 0,
        reorder_level: item.reorder_level || 0,
        
        // Additional
        catalogue_page_number: item.catalogue_page_number || '',
        burning_hours: item.burning_hours || '',
        scent: item.scent || '',
        dishwasher: item.dishwasher || '',
        microwave: item.microwave || '',
        
        // Metadata
        status: item.status || 'active',
        created_date: item.created_date,
        updated_at: item.updated_at || new Date().toISOString()
      }));

      // Create Excel file for compatibility
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, brandName);
      
      // Export path compatible with existing system
      const filename = `Master - ${brandName.replace(/[^a-zA-Z0-9]/g, '')}.xlsx`;
      const exportPath = `${this.pricelistsBasePath}/${filename}`;
      
      // Generate and download the Excel file
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Auto-download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      console.log(`✅ Exported ${items.length} items for ${brandName} to ${filename}`);
      
      // Store export data for tracking
      await this.storeExportData(brandName, exportData, 'brand_master');
      
    } catch (error) {
      console.error(`Error exporting brand file for ${brandName}:`, error);
      throw error;
    }
  };

  /**
   * Create consolidated master file (compatible with existing system)
   */
  private createConsolidatedMaster = async (items: any[]): Promise<void> => {
    try {
      // Map all items to consolidated format
      const consolidatedData = items.map(item => ({
        id: item.id || '',
        sku: item.sku || '',
        name: item.name || '',
        description: item.description || item.name || '',
        brand_name: item.brands?.brand_name || item.brands?.name || 'Unknown',
        category: item.category || '',
        colour: item.colour || '',
        ean: item.ean || '',
        manufacturer: item.manufacturer || item.brands?.brand_name || 'Unknown',
        packing_unit: item.packing_unit || 1,
        cost_price: item.cost_price || 0,
        retail_price: item.retail_price || 0,
        purchase_price: item.purchase_price || item.cost_price || 0,
        weight: item.weight || 0,
        height: item.height || 0,
        width: item.width || 0,
        length: item.length || 0,
        volume: item.volume || 0,
        catalogue_page_number: item.catalogue_page_number || '',
        burning_hours: item.burning_hours || '',
        scent: item.scent || '',
        dishwasher: item.dishwasher || '',
        microwave: item.microwave || '',
        image_url: item.image_url || '',
        status: item.status || 'active',
        created_date: item.created_date,
        updated_at: item.updated_at || new Date().toISOString()
      }));

      console.log(`Creating consolidated master with ${consolidatedData.length} total items`);
      
      // Create Excel workbook for consolidated data
      const worksheet = XLSX.utils.json_to_sheet(consolidatedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'All Products');
      
      // Generate and download the consolidated Excel file
      const filename = 'Master - Consolidated.xlsx';
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Auto-download the file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      console.log(`✅ Exported consolidated master with ${consolidatedData.length} items`);
      
      // Store consolidated data
      await this.storeExportData('Consolidated', consolidatedData, 'master_consolidated');
      
    } catch (error) {
      console.error('Error creating consolidated master:', error);
      throw error;
    }
  };

  /**
   * Generate export files for external systems (Shopify, Zoho, etc.)
   */
  public generateSystemExports = async (): Promise<{ [system: string]: any[] }> => {
    try {
      console.log('Generating system exports...');
      
      // Get consolidated data
      const { data: items, error } = await supabase
        .from('items')
        .select(`
          *,
          brands:brand_id (
            id,
            brand_name
          )
        `)
        .eq('status', 'active');

      if (error || !items) {
        throw new Error(`Failed to fetch items for export: ${error?.message}`);
      }

      const exports = {
        shopify: this.formatForShopify(items),
        zoho: this.formatForZoho(items),
        supabase: this.formatForSupabaseItems(items),
        bluealligator: this.formatForBlueAlligator(items)
      };

      // Store each export
      await Promise.all(Object.entries(exports).map(([system, data]) => 
        this.storeExportData(system, data, `export_${system}`)
      ));

      console.log('System exports completed');
      return exports;
      
    } catch (error) {
      console.error('Error generating system exports:', error);
      throw error;
    }
  };

  /**
   * Format data for Shopify import
   */
  private formatForShopify = (items: any[]): any[] => {
    return items.map(item => ({
      'Handle': item.sku?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '',
      'Title': item.name || '',
      'Body (HTML)': item.description || '',
      'Vendor': item.brands?.brand_name || '',
      'Product Category': item.category || '',
      'Type': item.category || '',
      'Tags': `${item.brands?.brand_name || ''}, ${item.category || ''}`,
      'Published': 'TRUE',
      'Option1 Name': 'Title',
      'Option1 Value': 'Default Title',
      'Variant SKU': item.sku || '',
      'Variant Grams': Math.round((item.weight || 0) * 1000),
      'Variant Inventory Tracker': 'shopify',
      'Variant Inventory Qty': item.gross_stock_level || 0,
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': item.retail_price || 0,
      'Variant Compare At Price': '',
      'Variant Requires Shipping': 'TRUE',
      'Variant Taxable': 'TRUE',
      'Variant Barcode': item.ean || '',
      'Image Src': item.image_url || '',
      'Image Position': '1',
      'Image Alt Text': item.name || '',
      'Gift Card': 'FALSE',
      'SEO Title': item.name || '',
      'SEO Description': item.description || '',
      'Google Shopping / Google Product Category': '',
      'Google Shopping / Gender': '',
      'Google Shopping / Age Group': '',
      'Google Shopping / MPN': item.sku || '',
      'Google Shopping / AdWords Grouping': '',
      'Google Shopping / AdWords Labels': '',
      'Google Shopping / Condition': 'new',
      'Google Shopping / Custom Product': 'TRUE',
      'Google Shopping / Custom Label 0': item.brands?.brand_name || '',
      'Google Shopping / Custom Label 1': item.category || '',
      'Google Shopping / Custom Label 2': '',
      'Google Shopping / Custom Label 3': '',
      'Google Shopping / Custom Label 4': '',
      'Variant Image': '',
      'Variant Weight Unit': 'kg',
      'Variant Tax Code': '',
      'Cost per item': item.cost_price || 0,
      'Price / International': '',
      'Compare At Price / International': '',
      'Status': 'active'
    }));
  };

  /**
   * Format data for Zoho Inventory import
   */
  private formatForZoho = (items: any[]): any[] => {
    return items.map(item => ({
      'Item Name': item.name || '',
      'SKU': item.sku || '',
      'Description': item.description || '',
      'Category': item.category || '',
      'Brand': item.brands?.brand_name || '',
      'Manufacturer': item.manufacturer || item.brands?.brand_name || '',
      'UPC': item.ean || '',
      'EAN': item.ean || '',
      'ISBN': '',
      'Part Number': item.sku || '',
      'Item Type': 'inventory',
      'Product Type': 'goods',
      'Stock on hand': item.gross_stock_level || 0,
      'Opening Stock Rate': item.cost_price || 0,
      'Reorder Level': item.reorder_level || 0,
      'Preferred Vendor': item.brands?.brand_name || '',
      'Purchase Rate': item.purchase_price || item.cost_price || 0,
      'Purchase Account': 'Cost of Goods Sold',
      'Purchase Description': item.description || '',
      'Sales Rate': item.retail_price || 0,
      'Sales Account': 'Sales',
      'Sales Description': item.description || '',
      'Tax Preference': 'taxable',
      'Exemption Reason': '',
      'Purchase Tax': '',
      'Sales Tax': '',
      'Item Status': item.status === 'active' ? 'active' : 'inactive',
      'Source': 'user',
      'Is Returnable Item': 'true',
      'Weight': item.weight || 0,
      'Weight Unit': 'kg',
      'Dimensions (Length x Width x Height)': `${item.length || 0} x ${item.width || 0} x ${item.height || 0}`,
      'Dimension Unit': 'cm',
      'Created Time': item.created_date,
      'Last Modified Time': item.updated_at
    }));
  };

  /**
   * Format data for Supabase Items table
   */
  private formatForSupabaseItems = (items: any[]): any[] => {
    return items.map(item => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      brand_id: item.brand_id,
      category: item.category,
      colour: item.colour,
      ean: item.ean,
      manufacturer: item.manufacturer,
      packing_unit: item.packing_unit,
      cost_price: item.cost_price,
      retail_price: item.retail_price,
      purchase_price: item.purchase_price,
      weight: item.weight,
      height: item.height,
      width: item.width,
      length: item.length,
      volume: item.volume,
      gross_stock_level: item.gross_stock_level,
      reorder_level: item.reorder_level,
      catalogue_page_number: item.catalogue_page_number,
      burning_hours: item.burning_hours,
      scent: item.scent,
      dishwasher: item.dishwasher,
      microwave: item.microwave,
      image_url: item.image_url,
      status: item.status,
      created_date: item.created_date,
      updated_at: item.updated_at
    }));
  };

  /**
   * Format data for BlueAlligator system
   */
  private formatForBlueAlligator = (items: any[]): any[] => {
    return items.map(item => ({
      'Product Code': item.sku || '',
      'Product Name': item.name || '',
      'Description': item.description || '',
      'Brand': item.brands?.brand_name || '',
      'Category': item.category || '',
      'Colour': item.colour || '',
      'Barcode': item.ean || '',
      'Supplier': item.manufacturer || item.brands?.brand_name || '',
      'Pack Size': item.packing_unit || 1,
      'Cost Price': item.cost_price || 0,
      'Retail Price': item.retail_price || 0,
      'Weight (kg)': item.weight || 0,
      'Dimensions (cm)': `${item.length || 0}x${item.width || 0}x${item.height || 0}`,
      'Stock Level': item.gross_stock_level || 0,
      'Reorder Level': item.reorder_level || 0,
      'Status': item.status || 'active',
      'Date Added': item.created_date,
      'Last Updated': item.updated_at
    }));
  };

  /**
   * Store export data in a format that can be downloaded or processed
   */
  private storeExportData = async (system: string, data: any[], type: string): Promise<void> => {
    try {
      // In a real implementation, you could:
      // 1. Save to file system
      // 2. Upload to cloud storage
      // 3. Store in database for download
      // 4. Send to external API
      
      // For now, we'll store metadata about the export
      const exportRecord = {
        system,
        type,
        record_count: data.length,
        generated_at: new Date().toISOString(),
        status: 'ready'
      };

      console.log(`Export stored for ${system}:`, exportRecord);
      
      // You could store this in a Supabase table for tracking:
      /*
      const { error } = await supabase
        .from('export_logs')
        .insert([exportRecord]);
      
      if (error) {
        console.error(`Failed to log export for ${system}:`, error);
      }
      */
      
    } catch (error) {
      console.error(`Error storing export data for ${system}:`, error);
    }
  };

  /**
   * Trigger the existing auto_process.py script (if needed)
   */
  public triggerLegacyExports = async (): Promise<void> => {
    try {
      console.log('Triggering legacy export processes...');
      
      // In a real implementation, you could:
      // 1. Call Python script via child process
      // 2. Queue a background job
      // 3. Send webhook to trigger external process
      
      // For now, just log what would happen
      console.log('Would execute: python3 /Users/alastairblair/Development/Pricelists/auto_process.py');
      
      // Example of how you might trigger this:
      /*
      const { exec } = require('child_process');
      exec('cd /Users/alastairblair/Development/Pricelists && python3 auto_process.py', 
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Export process error: ${error}`);
            return;
          }
          console.log(`Export stdout: ${stdout}`);
          console.error(`Export stderr: ${stderr}`);
        }
      );
      */
      
    } catch (error) {
      console.error('Error triggering legacy exports:', error);
    }
  };

  /**
   * Full export workflow - combines all export processes
   */
  public runFullExportWorkflow = async (): Promise<void> => {
    try {
      console.log('Starting full export workflow...');
      
      // Step 1: Export to master datasets (compatible with existing system)
      await this.exportToMasterDatasets();
      
      // Step 2: Generate system exports
      await this.generateSystemExports();
      
      // Step 3: Trigger legacy processes if needed
      await this.triggerLegacyExports();
      
      console.log('Full export workflow completed successfully');
      
    } catch (error) {
      console.error('Error in full export workflow:', error);
      throw error;
    }
  };
}

export const pricelistExportService = new PricelistExportService();