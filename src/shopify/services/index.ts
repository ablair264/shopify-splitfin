// Main Shopify services export
export { shopifyApiService } from './shopifyApiService';
export { shopifyAuthService } from './shopifyAuthService';
export { shopifyProductService } from './shopifyProductService';
export { shopifyImageService } from './shopifyImageService';
export { shopifyAnalyticsService } from './shopifyAnalyticsService';
export { shopifyOrderCustomerService } from './shopifyOrderCustomerService';
export { shopifyMarketingService } from './shopifyMarketingService';

// Shopify types
export * from '../types';

// Main Shopify service class that orchestrates all functionality
import { shopifyApiService } from './shopifyApiService';
import { shopifyAuthService } from './shopifyAuthService';
import { shopifyProductService } from './shopifyProductService';
import { shopifyImageService } from './shopifyImageService';
import { shopifyAnalyticsService } from './shopifyAnalyticsService';
import { shopifyOrderCustomerService } from './shopifyOrderCustomerService';
import { shopifyMarketingService } from './shopifyMarketingService';
import { WEBHOOK_TOPICS } from '../config';

interface ShopifyAppStatus {
  connected: boolean;
  shop?: string;
  permissions: string[];
  lastSync?: string;
  errors?: string[];
}

class ShopifyService {
  private _status: ShopifyAppStatus = {
    connected: false,
    permissions: [],
  };

  // Initialize the Shopify app connection
  public async initialize(shopDomain: string): Promise<boolean> {
    try {
      const success = await shopifyAuthService.initializeSession(shopDomain);
      
      if (success) {
        this._status.connected = true;
        this._status.shop = shopDomain;
        this._status.lastSync = new Date().toISOString();
        
        // Verify permissions
        await this.verifyPermissions();
        
        // Setup webhooks if needed
        await this.setupWebhooks();
      }
      
      return success;
    } catch (error) {
      console.error('Error initializing Shopify service:', error);
      this._status.errors = [error.message];
      return false;
    }
  }

  // Get app status
  public getStatus(): ShopifyAppStatus {
    return { ...this._status };
  }

  // Verify that we have the necessary permissions
  private async verifyPermissions(): Promise<void> {
    try {
      // Test each permission by making a simple API call
      const permissions: string[] = [];
      
      // Test products permission
      try {
        await shopifyApiService.getProducts({ limit: 1 });
        permissions.push('products');
      } catch (error) {
        console.warn('No products permission');
      }
      
      // Test orders permission
      try {
        await shopifyApiService.getOrders({ limit: 1 });
        permissions.push('orders');
      } catch (error) {
        console.warn('No orders permission');
      }
      
      // Test customers permission
      try {
        await shopifyApiService.getCustomers({ limit: 1 });
        permissions.push('customers');
      } catch (error) {
        console.warn('No customers permission');
      }
      
      this._status.permissions = permissions;
    } catch (error) {
      console.error('Error verifying permissions:', error);
    }
  }

  // Setup required webhooks
  private async setupWebhooks(): Promise<void> {
    try {
      const existingWebhooks = await shopifyApiService.getWebhooks();
      const existingTopics = new Set(existingWebhooks.webhooks.map(w => w.topic));
      
      // Create missing mandatory webhooks
      const requiredWebhooks = [
        WEBHOOK_TOPICS.PRODUCTS_CREATE,
        WEBHOOK_TOPICS.PRODUCTS_UPDATE,
        WEBHOOK_TOPICS.ORDERS_CREATE,
        WEBHOOK_TOPICS.ORDERS_UPDATED,
      ];
      
      for (const topic of requiredWebhooks) {
        if (!existingTopics.has(topic)) {
          try {
            await shopifyAuthService.createMandatoryWebhooks(this._status.shop!);
          } catch (error) {
            console.warn(`Failed to create webhook for ${topic}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error setting up webhooks:', error);
    }
  }

  // Product Management
  public async uploadProducts(
    file: File,
    options: {
      enableAI?: boolean;
      enhanceDescriptions?: boolean;
      generateSEO?: boolean;
      autoPublish?: boolean;
    } = {}
  ): Promise<any> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    // Process file and convert to Shopify format
    const processed = await shopifyProductService.processFileForShopify(file);
    
    let enrichmentResults;
    if (options.enableAI) {
      enrichmentResults = await shopifyProductService.enrichProductsWithAI(
        processed.preview,
        {
          enhanceDescriptions: options.enhanceDescriptions,
          generateSEO: options.generateSEO,
          suggestCategories: true,
          extractAttributes: true,
        }
      );
    }
    
    // Upload to Shopify
    const uploadResult = await shopifyProductService.uploadProductsToShopify(
      processed.preview,
      enrichmentResults
    );
    
    return {
      processed: processed.preview.length,
      uploaded: uploadResult.successful,
      failed: uploadResult.failed,
      errors: uploadResult.errors,
      products: uploadResult.products,
    };
  }

  // Image Management
  public async matchAndUploadImages(
    images: Array<{ url: string; filename: string }>,
    options: {
      autoMatch?: boolean;
      requireConfirmation?: boolean;
    } = {}
  ): Promise<any> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    return shopifyImageService.batchUploadWithMatching(images, options);
  }

  // Analytics
  public async getStoreDashboard(dateRange?: { start: Date; end: Date }): Promise<any> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    return shopifyAnalyticsService.getAnalyticsDashboard(dateRange);
  }

  // Orders & Customers
  public async getOrdersAndCustomers(filters?: any): Promise<any> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    const [orders, customers] = await Promise.all([
      shopifyOrderCustomerService.getOrders(filters?.orders),
      shopifyOrderCustomerService.getCustomers(filters?.customers),
    ]);

    return { orders, customers };
  }

  // Marketing
  public async generateMarketingContent(
    type: 'social' | 'email' | 'ad' | 'product_description' | 'blog_post' | 'sms',
    options?: any
  ): Promise<any> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    return shopifyMarketingService.generateMarketingMaterials(type, options);
  }

  // Sync with Splitfin data
  public async syncWithSplitfin(): Promise<void> {
    if (!this._status.connected) {
      throw new Error('Shopify not connected');
    }

    try {
      // This would sync data between Shopify and Splitfin systems
      // Implementation depends on your specific business logic
      
      this._status.lastSync = new Date().toISOString();
    } catch (error) {
      console.error('Error syncing with Splitfin:', error);
      throw error;
    }
  }

  // Disconnect from Shopify
  public async disconnect(): Promise<void> {
    this._status = {
      connected: false,
      permissions: [],
    };
  }

  // Health check
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{
      name: string;
      status: 'ok' | 'error';
      message?: string;
    }>;
  }> {
    const services = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check API connection
    try {
      await shopifyApiService.makeRequest('shop.json');
      services.push({ name: 'API', status: 'ok' as const });
    } catch (error) {
      services.push({ 
        name: 'API', 
        status: 'error' as const, 
        message: error.message 
      });
      overallStatus = 'unhealthy';
    }

    // Check products access
    try {
      await shopifyApiService.getProducts({ limit: 1 });
      services.push({ name: 'Products', status: 'ok' as const });
    } catch (error) {
      services.push({ 
        name: 'Products', 
        status: 'error' as const, 
        message: 'No products access' 
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Check orders access
    try {
      await shopifyApiService.getOrders({ limit: 1 });
      services.push({ name: 'Orders', status: 'ok' as const });
    } catch (error) {
      services.push({ 
        name: 'Orders', 
        status: 'error' as const, 
        message: 'No orders access' 
      });
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }

    return { status: overallStatus, services };
  }
}

export const shopifyService = new ShopifyService();