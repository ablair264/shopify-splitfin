export const SHOPIFY_CONFIG = {
  // These will be populated from environment variables
  API_KEY: process.env.REACT_APP_SHOPIFY_API_KEY || '',
  API_SECRET_KEY: process.env.REACT_APP_SHOPIFY_API_SECRET_KEY || '',
  SCOPES: [
    'read_products',
    'write_products',
    'read_product_listings',
    'read_inventory',
    'write_inventory',
    'read_orders',
    'write_orders',
    'read_customers',
    'write_customers',
    'read_analytics',
    'read_marketing_events',
    'write_marketing_events',
    'read_reports',
    'write_reports',
    'read_price_rules',
    'write_price_rules',
    'read_discounts',
    'write_discounts',
  ].join(','),
  HOST: process.env.REACT_APP_HOST || process.env.URL || 'http://localhost:3000',
  REDIRECT_URI: process.env.REACT_APP_SHOPIFY_REDIRECT_URI || `${process.env.URL || 'http://localhost:3000'}/auth/callback`,
  WEBHOOK_URI: process.env.REACT_APP_WEBHOOK_URI || `${process.env.URL || 'http://localhost:3000'}/.netlify/functions/shopify-webhook`,
  API_VERSION: '2024-01',
  
  // Rate limiting configuration
  RATE_LIMIT: {
    REST_API: {
      BUCKET_SIZE: 40,
      LEAK_RATE: 2, // requests per second
    },
    GRAPHQL_API: {
      COST_LIMIT: 1000,
      RESTORE_RATE: 50, // points per second
    },
  },
  
  // Bulk operation settings
  BULK_OPERATION: {
    MAX_OBJECTS_PER_OPERATION: 100000,
    POLLING_INTERVAL: 1000, // ms
    MAX_POLL_ATTEMPTS: 300, // 5 minutes max
  },
  
  // AI Enhancement settings
  AI_ENHANCEMENT: {
    BATCH_SIZE: 10,
    PARALLEL_REQUESTS: 3,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // ms
  },
  
  // Image processing settings
  IMAGE_PROCESSING: {
    MAX_IMAGE_SIZE: 20 * 1024 * 1024, // 20MB
    ALLOWED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    BATCH_SIZE: 5,
    CDN_URL: process.env.REACT_APP_CDN_URL || '',
  },
  
  // Analytics settings
  ANALYTICS: {
    REFRESH_INTERVAL: 300000, // 5 minutes
    MAX_CACHE_AGE: 3600000, // 1 hour
    DEFAULT_DATE_RANGE: 30, // days
  },
};

// Webhook topics
export const WEBHOOK_TOPICS = {
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  PRODUCTS_DELETE: 'products/delete',
  ORDERS_CREATE: 'orders/create',
  ORDERS_UPDATED: 'orders/updated',
  ORDERS_PAID: 'orders/paid',
  ORDERS_CANCELLED: 'orders/cancelled',
  ORDERS_FULFILLED: 'orders/fulfilled',
  CUSTOMERS_CREATE: 'customers/create',
  CUSTOMERS_UPDATE: 'customers/update',
  INVENTORY_ITEMS_UPDATE: 'inventory_items/update',
  INVENTORY_LEVELS_UPDATE: 'inventory_levels/update',
} as const;

// GraphQL Queries fragments
export const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    title
    handle
    descriptionHtml
    vendor
    productType
    tags
    status
    totalInventory
    tracksInventory
    onlineStoreUrl
    createdAt
    updatedAt
    images(first: 10) {
      edges {
        node {
          id
          url
          altText
        }
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          sku
          price
          compareAtPrice
          barcode
          weight
          weightUnit
          inventoryQuantity
          inventoryItem {
            id
            cost
            tracked
          }
        }
      }
    }
    seo {
      title
      description
    }
  }
`;

export const ORDER_FRAGMENT = `
  fragment OrderFields on Order {
    id
    name
    email
    createdAt
    updatedAt
    displayFinancialStatus
    displayFulfillmentStatus
    totalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    subtotalPriceSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    totalTaxSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    totalDiscountsSet {
      shopMoney {
        amount
        currencyCode
      }
    }
    customer {
      id
      email
      firstName
      lastName
      ordersCount
      totalSpentV2 {
        amount
        currencyCode
      }
    }
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          sku
          variant {
            id
            title
            sku
            price
          }
          originalUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountedUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
    shippingAddress {
      address1
      address2
      city
      province
      country
      zip
      phone
    }
    billingAddress {
      address1
      address2
      city
      province
      country
      zip
      phone
    }
  }
`;

export const CUSTOMER_FRAGMENT = `
  fragment CustomerFields on Customer {
    id
    email
    firstName
    lastName
    phone
    acceptsMarketing
    ordersCount
    totalSpentV2 {
      amount
      currencyCode
    }
    createdAt
    updatedAt
    state
    tags
    defaultAddress {
      address1
      address2
      city
      province
      country
      zip
      phone
    }
    addresses(first: 10) {
      edges {
        node {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
        }
      }
    }
  }
`;