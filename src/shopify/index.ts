// Main Shopify module exports
export { default as ShopifyDashboard } from './components/ShopifyDashboard';

// Services
export {
  shopifyService,
  shopifyApiService,
  shopifyAuthService,
  shopifyProductService,
  shopifyImageService,
  shopifyAnalyticsService,
  shopifyOrderCustomerService,
  shopifyMarketingService,
} from './services';

// Types
export * from './types';

// Configuration
export { SHOPIFY_CONFIG, WEBHOOK_TOPICS } from './config';

// Hooks (to be created)
export { useShopifyAuth } from './hooks/useShopifyAuth';
export { useShopifyProducts } from './hooks/useShopifyProducts';
export { useShopifyAnalytics } from './hooks/useShopifyAnalytics';