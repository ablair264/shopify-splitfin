import { shopifyApiService } from './shopifyApiService';
import { aiEnrichmentService } from '../../services/aiEnrichmentService';
import { pricelistProcessingService, PriceChange } from '../../services/pricelistProcessingService';
import { SHOPIFY_CONFIG } from '../config';
import { 
  ShopifyProduct, 
  ShopifyProductUpload,
  ShopifyVariantUpload 
} from '../types';
import * as XLSX from 'xlsx';

interface ProductEnrichmentResult {
  sku: string;
  enrichedData: {
    title: string;
    description: string;
    product_type: string;
    tags: string[];
    seo_title?: string;
    seo_description?: string;
    google_product_category?: string;
    material?: string;
    color?: string;
    size?: string;
    features?: string[];
  };
  confidence: number;
}

interface BatchUploadResult {
  successful: number;
  failed: number;
  errors: Array<{
    sku: string;
    error: string;
  }>;
  products: ShopifyProduct[];
}

interface ProductMapping {
  shopifyField: keyof ShopifyProductUpload;
  sourceField: string;
  transform?: (value: any) => any;
}

class ShopifyProductService {
  private productMappings: ProductMapping[] = [
    { shopifyField: 'sku', sourceField: 'sku' },
    { shopifyField: 'title', sourceField: 'name' },
    { shopifyField: 'description', sourceField: 'description' },
    { shopifyField: 'vendor', sourceField: 'brand_name' },
    { shopifyField: 'product_type', sourceField: 'category' },
    { shopifyField: 'price', sourceField: 'retail_price', transform: (v) => parseFloat(v) || 0 },
    { shopifyField: 'cost', sourceField: 'cost_price', transform: (v) => parseFloat(v) || 0 },
    { shopifyField: 'barcode', sourceField: 'ean' },
    { shopifyField: 'weight', sourceField: 'weight', transform: (v) => parseFloat(v) || 0 },
    { shopifyField: 'inventory_quantity', sourceField: 'gross_stock_level', transform: (v) => parseInt(v) || 0 },
  ];

  // Process and enrich products from file upload
  public async processFileForShopify(file: File): Promise<{
    preview: ShopifyProductUpload[];
    enrichmentAvailable: boolean;
  }> {
    try {
      // Use existing pricelist processing service
      const processingResult = await pricelistProcessingService.processFile(file);
      
      // Convert to Shopify format
      const shopifyProducts = this.convertToShopifyFormat(processingResult.changes);
      
      return {
        preview: shopifyProducts.slice(0, 10),
        enrichmentAvailable: true,
      };
    } catch (error) {
      console.error('Error processing file for Shopify:', error);
      throw error;
    }
  }

  // Convert internal format to Shopify format
  private convertToShopifyFormat(changes: PriceChange[]): ShopifyProductUpload[] {
    return changes.map(change => ({
      sku: change.sku,
      title: change.product_name,
      description: change.description || change.product_name,
      vendor: change.manufacturer || 'Unknown',
      product_type: change.category || 'General',
      tags: [change.manufacturer, change.category].filter(Boolean),
      price: change.new_price,
      cost: change.new_price,
      barcode: change.ean,
      weight: 0, // Would need to be added to PriceChange interface
      weight_unit: 'kg' as const,
      inventory_quantity: 0, // Would need to be fetched separately
    }));
  }

  // Enrich products with AI
  public async enrichProductsWithAI(
    products: ShopifyProductUpload[],
    options: {
      enhanceDescriptions?: boolean;
      generateSEO?: boolean;
      suggestCategories?: boolean;
      extractAttributes?: boolean;
    } = {}
  ): Promise<ProductEnrichmentResult[]> {
    const results: ProductEnrichmentResult[] = [];
    const batchSize = SHOPIFY_CONFIG.AI_ENHANCEMENT.BATCH_SIZE;
    
    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchPromises = batch.map(product => this.enrichSingleProduct(product, options));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Error in batch enrichment:', error);
        // Continue with next batch
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, SHOPIFY_CONFIG.AI_ENHANCEMENT.RETRY_DELAY));
      }
    }
    
    return results;
  }

  // Enrich single product
  private async enrichSingleProduct(
    product: ShopifyProductUpload,
    options: any
  ): Promise<ProductEnrichmentResult> {
    try {
      const enrichmentPromises = [];
      
      // Prepare enrichment data
      const productData = {
        name: product.title,
        description: product.description,
        category: product.product_type,
        brand: product.vendor,
        sku: product.sku,
      };
      
      // Use existing AI enrichment service
      if (options.enhanceDescriptions) {
        enrichmentPromises.push(
          aiEnrichmentService.enhanceProductDescription(productData)
        );
      }
      
      if (options.suggestCategories) {
        enrichmentPromises.push(
          aiEnrichmentService.suggestProductCategories(productData)
        );
      }
      
      if (options.extractAttributes) {
        enrichmentPromises.push(
          aiEnrichmentService.extractProductAttributes(productData)
        );
      }
      
      const enrichmentResults = await Promise.all(enrichmentPromises);
      
      // Combine results
      const enrichedData: any = {
        title: product.title,
        description: product.description,
        product_type: product.product_type,
        tags: [...product.tags],
      };
      
      // Process enrichment results
      enrichmentResults.forEach(result => {
        if (result.type === 'description' && result.data) {
          enrichedData.description = result.data.enhanced_description || product.description;
          if (result.data.features) {
            enrichedData.features = result.data.features;
            enrichedData.tags.push(...result.data.features.slice(0, 3));
          }
        }
        
        if (result.type === 'categories' && result.data) {
          if (result.data.shopify_category) {
            enrichedData.product_type = result.data.shopify_category;
          }
          if (result.data.google_category) {
            enrichedData.google_product_category = result.data.google_category;
          }
          if (result.data.tags) {
            enrichedData.tags.push(...result.data.tags);
          }
        }
        
        if (result.type === 'attributes' && result.data) {
          if (result.data.material) enrichedData.material = result.data.material;
          if (result.data.color) enrichedData.color = result.data.color;
          if (result.data.size) enrichedData.size = result.data.size;
        }
      });
      
      // Generate SEO if requested
      if (options.generateSEO) {
        enrichedData.seo_title = this.generateSEOTitle(enrichedData.title, product.vendor);
        enrichedData.seo_description = this.generateSEODescription(enrichedData.description, enrichedData.features);
      }
      
      // Remove duplicate tags
      enrichedData.tags = [...new Set(enrichedData.tags)];
      
      return {
        sku: product.sku,
        enrichedData,
        confidence: 0.85,
      };
    } catch (error) {
      console.error(`Error enriching product ${product.sku}:`, error);
      return {
        sku: product.sku,
        enrichedData: {
          title: product.title,
          description: product.description,
          product_type: product.product_type,
          tags: product.tags,
        },
        confidence: 0,
      };
    }
  }

  // Generate SEO title
  private generateSEOTitle(title: string, vendor: string): string {
    const cleanTitle = title.substring(0, 60 - vendor.length - 3);
    return `${cleanTitle} | ${vendor}`;
  }

  // Generate SEO description
  private generateSEODescription(description: string, features?: string[]): string {
    let seoDesc = description.substring(0, 120);
    
    if (features && features.length > 0) {
      const featureString = features.slice(0, 3).join(', ');
      seoDesc += ` Features: ${featureString}`;
    }
    
    return seoDesc.substring(0, 160);
  }

  // Upload products to Shopify
  public async uploadProductsToShopify(
    products: ShopifyProductUpload[],
    enrichmentResults?: ProductEnrichmentResult[]
  ): Promise<BatchUploadResult> {
    const result: BatchUploadResult = {
      successful: 0,
      failed: 0,
      errors: [],
      products: [],
    };
    
    // Create enrichment map
    const enrichmentMap = new Map<string, ProductEnrichmentResult>();
    if (enrichmentResults) {
      enrichmentResults.forEach(r => enrichmentMap.set(r.sku, r));
    }
    
    // Upload products
    for (const product of products) {
      try {
        const enrichment = enrichmentMap.get(product.sku);
        const shopifyProduct = await this.createShopifyProduct(product, enrichment);
        
        result.products.push(shopifyProduct);
        result.successful++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          sku: product.sku,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    return result;
  }

  // Create single Shopify product
  private async createShopifyProduct(
    product: ShopifyProductUpload,
    enrichment?: ProductEnrichmentResult
  ): Promise<ShopifyProduct> {
    // Merge enrichment data if available
    const finalProduct = enrichment ? {
      ...product,
      title: enrichment.enrichedData.title,
      description: enrichment.enrichedData.description,
      product_type: enrichment.enrichedData.product_type,
      tags: enrichment.enrichedData.tags,
    } : product;
    
    // Prepare Shopify product data
    const shopifyProductData: Partial<ShopifyProduct> = {
      title: finalProduct.title,
      body_html: finalProduct.description,
      vendor: finalProduct.vendor,
      product_type: finalProduct.product_type,
      tags: finalProduct.tags.join(', '),
      status: 'active',
      variants: [{
        sku: finalProduct.sku,
        price: finalProduct.price.toString(),
        compare_at_price: finalProduct.compare_at_price?.toString(),
        cost: finalProduct.cost?.toString(),
        barcode: finalProduct.barcode,
        weight: finalProduct.weight,
        weight_unit: finalProduct.weight_unit,
        inventory_quantity: finalProduct.inventory_quantity,
        inventory_management: 'shopify',
        fulfillment_service: 'manual',
        requires_shipping: true,
        taxable: true,
      }] as any,
    };
    
    // Add SEO data if available
    if (enrichment?.enrichedData.seo_title || enrichment?.enrichedData.seo_description) {
      (shopifyProductData as any).metafields = [
        {
          namespace: 'seo',
          key: 'title',
          value: enrichment.enrichedData.seo_title,
          type: 'single_line_text_field',
        },
        {
          namespace: 'seo',
          key: 'description',
          value: enrichment.enrichedData.seo_description,
          type: 'multi_line_text_field',
        },
      ];
    }
    
    // Create product in Shopify
    const response = await shopifyApiService.createProduct(shopifyProductData);
    return response.product;
  }

  // Bulk update products
  public async bulkUpdateProducts(updates: Array<{
    id: string;
    updates: Partial<ShopifyProduct>;
  }>): Promise<BatchUploadResult> {
    const result: BatchUploadResult = {
      successful: 0,
      failed: 0,
      errors: [],
      products: [],
    };
    
    for (const update of updates) {
      try {
        const response = await shopifyApiService.updateProduct(update.id, update.updates);
        result.products.push(response.product);
        result.successful++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          sku: update.id,
          error: error.message || 'Unknown error',
        });
      }
    }
    
    return result;
  }

  // Export Shopify products to various formats
  public async exportProducts(format: 'csv' | 'excel', filters?: any): Promise<Blob> {
    // Get all products with filters
    const allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let pageInfo: string | undefined;
    
    while (hasNextPage) {
      const response = await shopifyApiService.getProducts({
        limit: 250,
        page_info: pageInfo,
        ...filters,
      });
      
      allProducts.push(...response.products);
      
      // Check for next page
      // This would need to be implemented based on Shopify's pagination headers
      hasNextPage = false; // Placeholder
    }
    
    // Convert to export format
    const exportData = allProducts.map(product => ({
      'Handle': product.handle,
      'Title': product.title,
      'Body (HTML)': product.body_html,
      'Vendor': product.vendor,
      'Product Type': product.product_type,
      'Tags': product.tags,
      'Published': product.status === 'active' ? 'TRUE' : 'FALSE',
      'SKU': product.variants[0]?.sku || '',
      'Price': product.variants[0]?.price || '',
      'Compare at Price': product.variants[0]?.compare_at_price || '',
      'Cost': (product.variants[0] as any)?.cost || '',
      'Barcode': product.variants[0]?.barcode || '',
      'Weight': product.variants[0]?.weight || '',
      'Inventory Quantity': product.variants[0]?.inventory_quantity || '',
      'Image Src': product.images[0]?.src || '',
    }));
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = this.convertToCSV(exportData);
      return new Blob([csv], { type: 'text/csv' });
    } else {
      // Convert to Excel
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      return new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
    }
  }

  // Convert data to CSV
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]?.toString() || '';
          return value.includes(',') ? `"${value}"` : value;
        }).join(',')
      ),
    ].join('\n');
    
    return csv;
  }

  // Get product recommendations based on AI analysis
  public async getProductRecommendations(productId: string): Promise<{
    relatedProducts: string[];
    crossSellProducts: string[];
    upSellProducts: string[];
  }> {
    const { product } = await shopifyApiService.getProduct(productId);
    
    // Use AI to analyze product and find recommendations
    const analysis = await aiEnrichmentService.analyzeProductRelationships({
      name: product.title,
      description: product.body_html,
      category: product.product_type,
      tags: product.tags.split(', '),
      price: parseFloat(product.variants[0]?.price || '0'),
    });
    
    return {
      relatedProducts: analysis.related || [],
      crossSellProducts: analysis.crossSell || [],
      upSellProducts: analysis.upSell || [],
    };
  }
}

export const shopifyProductService = new ShopifyProductService();