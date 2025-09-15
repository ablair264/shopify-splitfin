import { SHOPIFY_CONFIG } from '../config';
import { shopifyApiService } from './shopifyApiService';
import { supabase } from '../../services/supabaseService';

interface ShopifyAuthResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  associated_user_scope?: string;
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    email_verified: boolean;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
  };
}

interface ShopifyShop {
  id: string;
  shop_domain: string;
  access_token: string;
  scope: string;
  shop_name?: string;
  email?: string;
  shop_owner?: string;
  timezone?: string;
  currency?: string;
  country_code?: string;
  installed_at: string;
  uninstalled_at?: string;
  status: 'active' | 'uninstalled';
}

class ShopifyAuthService {
  // Generate the OAuth authorization URL
  public generateAuthUrl(shop: string, state: string): string {
    const params = new URLSearchParams({
      client_id: SHOPIFY_CONFIG.API_KEY,
      scope: SHOPIFY_CONFIG.SCOPES,
      redirect_uri: SHOPIFY_CONFIG.REDIRECT_URI,
      state: state,
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Verify the webhook HMAC
  public verifyWebhookHmac(data: string, hmacHeader: string): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', SHOPIFY_CONFIG.API_SECRET_KEY)
      .update(data, 'utf8')
      .digest('base64');

    return hash === hmacHeader;
  }

  // Verify the OAuth callback parameters
  public verifyOAuthCallback(query: URLSearchParams): boolean {
    const hmac = query.get('hmac');
    if (!hmac) return false;

    // Remove hmac and signature from params
    const params = new URLSearchParams(query);
    params.delete('hmac');
    params.delete('signature');

    // Sort parameters
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Calculate HMAC
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha256', SHOPIFY_CONFIG.API_SECRET_KEY)
      .update(sortedParams, 'utf8')
      .digest('hex');

    return hash === hmac;
  }

  // Exchange the authorization code for an access token
  public async exchangeCodeForToken(shop: string, code: string): Promise<ShopifyAuthResponse> {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CONFIG.API_KEY,
        client_secret: SHOPIFY_CONFIG.API_SECRET_KEY,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    return response.json();
  }

  // Save shop installation to database
  public async saveShopInstallation(
    shop: string,
    accessToken: string,
    scope: string,
    userId?: string
  ): Promise<ShopifyShop> {
    try {
      // Get shop details from Shopify
      shopifyApiService.setSession({ shop, accessToken });
      const shopData = await shopifyApiService.makeRequest<any>('shop.json');

      const shopRecord: Partial<ShopifyShop> = {
        shop_domain: shop,
        access_token: accessToken,
        scope: scope,
        shop_name: shopData.shop.name,
        email: shopData.shop.email,
        shop_owner: shopData.shop.shop_owner,
        timezone: shopData.shop.timezone,
        currency: shopData.shop.currency,
        country_code: shopData.shop.country_code,
        installed_at: new Date().toISOString(),
        status: 'active',
      };

      // Save to Supabase
      const { data, error } = await supabase
        .from('shopify_shops')
        .upsert([shopRecord], {
          onConflict: 'shop_domain',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save shop installation: ${error.message}`);
      }

      // If userId is provided, link the shop to the user
      if (userId) {
        await this.linkShopToUser(shop, userId);
      }

      return data;
    } catch (error) {
      console.error('Error saving shop installation:', error);
      throw error;
    }
  }

  // Link a shop to a user
  public async linkShopToUser(shopDomain: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_shops')
      .upsert([
        {
          user_id: userId,
          shop_domain: shopDomain,
          role: 'owner',
          created_at: new Date().toISOString(),
        },
      ], {
        onConflict: 'user_id,shop_domain',
      });

    if (error) {
      throw new Error(`Failed to link shop to user: ${error.message}`);
    }
  }

  // Get shop by domain
  public async getShop(shopDomain: string): Promise<ShopifyShop | null> {
    const { data, error } = await supabase
      .from('shopify_shops')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  // Get shops for a user
  public async getUserShops(userId: string): Promise<ShopifyShop[]> {
    const { data, error } = await supabase
      .from('user_shops')
      .select(`
        shop_domain,
        role,
        shopify_shops (*)
      `)
      .eq('user_id', userId);

    if (error || !data) {
      return [];
    }

    return data
      .map(item => item.shopify_shops)
      .filter(shop => shop && shop.status === 'active');
  }

  // Mark shop as uninstalled
  public async uninstallShop(shopDomain: string): Promise<void> {
    const { error } = await supabase
      .from('shopify_shops')
      .update({
        status: 'uninstalled',
        uninstalled_at: new Date().toISOString(),
      })
      .eq('shop_domain', shopDomain);

    if (error) {
      throw new Error(`Failed to mark shop as uninstalled: ${error.message}`);
    }
  }

  // Initialize session from stored shop
  public async initializeSession(shopDomain: string): Promise<boolean> {
    const shop = await this.getShop(shopDomain);
    
    if (!shop) {
      return false;
    }

    shopifyApiService.setSession({
      shop: shop.shop_domain,
      accessToken: shop.access_token,
    });

    return true;
  }

  // Create mandatory webhooks
  public async createMandatoryWebhooks(shopDomain: string): Promise<void> {
    const webhookTopics = [
      'app/uninstalled',
      'shop/update',
    ];

    for (const topic of webhookTopics) {
      try {
        await shopifyApiService.createWebhook({
          topic,
          address: `${SHOPIFY_CONFIG.WEBHOOK_URI}/${topic.replace('/', '-')}`,
          format: 'json',
        });
      } catch (error) {
        console.error(`Failed to create webhook for ${topic}:`, error);
      }
    }
  }

  // Verify request authenticity for embedded apps
  public verifyRequest(sessionToken: string): boolean {
    try {
      const [header, payload, signature] = sessionToken.split('.');
      
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', SHOPIFY_CONFIG.API_SECRET_KEY)
        .update(`${header}.${payload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      if (signature !== expectedSignature) {
        return false;
      }

      // Decode and verify payload
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      
      // Check expiration
      if (decodedPayload.exp && decodedPayload.exp < Date.now() / 1000) {
        return false;
      }

      // Check audience and issuer
      const expectedIssuer = decodedPayload.dest.replace('https://', '');
      if (decodedPayload.aud !== SHOPIFY_CONFIG.API_KEY || decodedPayload.iss !== expectedIssuer) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying session token:', error);
      return false;
    }
  }
}

export const shopifyAuthService = new ShopifyAuthService();