import { SHOPIFY_CONFIG } from '../config';
import { 
  ShopifyProduct, 
  ShopifyOrder, 
  ShopifyCustomer,
  ShopifyBulkOperation,
  ShopifyWebhook
} from '../types';

interface ShopifySession {
  shop: string;
  accessToken: string;
}

class ShopifyApiService {
  private session: ShopifySession | null = null;
  private rateLimitBucket = SHOPIFY_CONFIG.RATE_LIMIT.REST_API.BUCKET_SIZE;
  private lastRequestTime = 0;
  private graphqlCost = 0;
  private graphqlCostResetTime = Date.now();

  public setSession(session: ShopifySession) {
    this.session = session;
  }

  public getSession(): ShopifySession | null {
    return this.session;
  }

  private async handleRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // REST API rate limiting
    if (timeSinceLastRequest < 1000 / SHOPIFY_CONFIG.RATE_LIMIT.REST_API.LEAK_RATE) {
      const delay = (1000 / SHOPIFY_CONFIG.RATE_LIMIT.REST_API.LEAK_RATE) - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.session) {
      throw new Error('No Shopify session available');
    }

    await this.handleRateLimit();

    const url = `https://${this.session.shop}/admin/api/${SHOPIFY_CONFIG.API_VERSION}/${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': this.session.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (response.status === 429) {
      // Rate limited, wait and retry
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.makeRequest<T>(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async makeGraphQLRequest<T>(query: string, variables?: any): Promise<T> {
    if (!this.session) {
      throw new Error('No Shopify session available');
    }

    // Check GraphQL cost limit
    const now = Date.now();
    if (now - this.graphqlCostResetTime > 1000) {
      this.graphqlCost = Math.max(0, this.graphqlCost - SHOPIFY_CONFIG.RATE_LIMIT.GRAPHQL_API.RESTORE_RATE);
      this.graphqlCostResetTime = now;
    }

    const response = await fetch(`https://${this.session.shop}/admin/api/${SHOPIFY_CONFIG.API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': this.session.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    // Update GraphQL cost
    if (result.extensions?.cost) {
      this.graphqlCost += result.extensions.cost.actualQueryCost;
      
      // If we're approaching the limit, wait
      if (this.graphqlCost > SHOPIFY_CONFIG.RATE_LIMIT.GRAPHQL_API.COST_LIMIT * 0.8) {
        const waitTime = (this.graphqlCost - SHOPIFY_CONFIG.RATE_LIMIT.GRAPHQL_API.COST_LIMIT * 0.5) / 
          SHOPIFY_CONFIG.RATE_LIMIT.GRAPHQL_API.RESTORE_RATE * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (result.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  // Products API
  async getProducts(params?: {
    limit?: number;
    page_info?: string;
    fields?: string;
    ids?: string;
    since_id?: string;
    title?: string;
    vendor?: string;
    handle?: string;
    product_type?: string;
    status?: 'active' | 'archived' | 'draft';
    collection_id?: string;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    published_at_min?: string;
    published_at_max?: string;
    published_status?: 'published' | 'unpublished' | 'any';
  }): Promise<{ products: ShopifyProduct[] }> {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.makeRequest<{ products: ShopifyProduct[] }>(`products.json${queryParams ? `?${queryParams}` : ''}`);
  }

  async getProduct(productId: string): Promise<{ product: ShopifyProduct }> {
    return this.makeRequest<{ product: ShopifyProduct }>(`products/${productId}.json`);
  }

  async createProduct(product: Partial<ShopifyProduct>): Promise<{ product: ShopifyProduct }> {
    return this.makeRequest<{ product: ShopifyProduct }>('products.json', {
      method: 'POST',
      body: JSON.stringify({ product }),
    });
  }

  async updateProduct(productId: string, product: Partial<ShopifyProduct>): Promise<{ product: ShopifyProduct }> {
    return this.makeRequest<{ product: ShopifyProduct }>(`products/${productId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ product }),
    });
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.makeRequest(`products/${productId}.json`, {
      method: 'DELETE',
    });
  }

  // Orders API
  async getOrders(params?: {
    limit?: number;
    page_info?: string;
    fields?: string;
    ids?: string;
    since_id?: string;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
    processed_at_min?: string;
    processed_at_max?: string;
    attribution_app_id?: string;
    status?: 'open' | 'closed' | 'cancelled' | 'any';
    financial_status?: 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any' | 'unpaid';
    fulfillment_status?: 'shipped' | 'partial' | 'unshipped' | 'any' | 'unfulfilled';
  }): Promise<{ orders: ShopifyOrder[] }> {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.makeRequest<{ orders: ShopifyOrder[] }>(`orders.json${queryParams ? `?${queryParams}` : ''}`);
  }

  async getOrder(orderId: string): Promise<{ order: ShopifyOrder }> {
    return this.makeRequest<{ order: ShopifyOrder }>(`orders/${orderId}.json`);
  }

  // Customers API
  async getCustomers(params?: {
    limit?: number;
    page_info?: string;
    fields?: string;
    ids?: string;
    since_id?: string;
    created_at_min?: string;
    created_at_max?: string;
    updated_at_min?: string;
    updated_at_max?: string;
  }): Promise<{ customers: ShopifyCustomer[] }> {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.makeRequest<{ customers: ShopifyCustomer[] }>(`customers.json${queryParams ? `?${queryParams}` : ''}`);
  }

  async getCustomer(customerId: string): Promise<{ customer: ShopifyCustomer }> {
    return this.makeRequest<{ customer: ShopifyCustomer }>(`customers/${customerId}.json`);
  }

  // Bulk Operations (GraphQL)
  async createBulkOperation(query: string): Promise<string> {
    const mutation = `
      mutation {
        bulkOperationRunQuery(
          query: """${query}"""
        ) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const result = await this.makeGraphQLRequest<any>(mutation);
    
    if (result.bulkOperationRunQuery.userErrors.length > 0) {
      throw new Error(result.bulkOperationRunQuery.userErrors[0].message);
    }

    return result.bulkOperationRunQuery.bulkOperation.id;
  }

  async pollBulkOperation(operationId: string): Promise<ShopifyBulkOperation> {
    const query = `
      query {
        node(id: "${operationId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `;

    const result = await this.makeGraphQLRequest<any>(query);
    return result.node;
  }

  async waitForBulkOperation(operationId: string): Promise<ShopifyBulkOperation> {
    let attempts = 0;
    
    while (attempts < SHOPIFY_CONFIG.BULK_OPERATION.MAX_POLL_ATTEMPTS) {
      const operation = await this.pollBulkOperation(operationId);
      
      if (operation.status === 'COMPLETED' || operation.status === 'FAILED' || operation.status === 'CANCELED') {
        return operation;
      }
      
      await new Promise(resolve => setTimeout(resolve, SHOPIFY_CONFIG.BULK_OPERATION.POLLING_INTERVAL));
      attempts++;
    }
    
    throw new Error('Bulk operation timed out');
  }

  // Webhooks
  async createWebhook(webhook: {
    topic: string;
    address: string;
    format?: 'json' | 'xml';
  }): Promise<{ webhook: ShopifyWebhook }> {
    return this.makeRequest<{ webhook: ShopifyWebhook }>('webhooks.json', {
      method: 'POST',
      body: JSON.stringify({ webhook }),
    });
  }

  async getWebhooks(): Promise<{ webhooks: ShopifyWebhook[] }> {
    return this.makeRequest<{ webhooks: ShopifyWebhook[] }>('webhooks.json');
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.makeRequest(`webhooks/${webhookId}.json`, {
      method: 'DELETE',
    });
  }

  // Analytics
  async getAnalytics(reportType: string, params?: any): Promise<any> {
    const query = `
      query {
        shop {
          analyticsData(
            reportType: ${reportType}
            ${params ? `params: ${JSON.stringify(params)}` : ''}
          ) {
            ... on AnalyticsReport {
              data
              error
            }
          }
        }
      }
    `;

    return this.makeGraphQLRequest(query);
  }

  // Product count
  async getProductCount(params?: any): Promise<{ count: number }> {
    const queryParams = new URLSearchParams(params).toString();
    return this.makeRequest<{ count: number }>(`products/count.json${queryParams ? `?${queryParams}` : ''}`);
  }

  // Order count
  async getOrderCount(params?: any): Promise<{ count: number }> {
    const queryParams = new URLSearchParams(params).toString();
    return this.makeRequest<{ count: number }>(`orders/count.json${queryParams ? `?${queryParams}` : ''}`);
  }

  // Customer count
  async getCustomerCount(params?: any): Promise<{ count: number }> {
    const queryParams = new URLSearchParams(params).toString();
    return this.makeRequest<{ count: number }>(`customers/count.json${queryParams ? `?${queryParams}` : ''}`);
  }
}

export const shopifyApiService = new ShopifyApiService();