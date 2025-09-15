import { SHOPIFY_CONFIG } from '../config';
import { supabase } from '../../services/supabaseService';

interface ShopifyInstallationResult {
  success: boolean;
  shop?: string;
  error?: string;
}

class ShopifyClientAuthService {
  // Generate the OAuth authorization URL
  public generateAuthUrl(shop: string): string {
    const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\.myshopify\.com$/, '');
    const shopDomain = `${cleanShop}.myshopify.com`;
    
    const params = new URLSearchParams({
      client_id: SHOPIFY_CONFIG.API_KEY,
      scope: SHOPIFY_CONFIG.SCOPES,
      redirect_uri: SHOPIFY_CONFIG.REDIRECT_URI,
      state: `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
  }

  // Check if OAuth callback was successful
  public async checkInstallationStatus(): Promise<ShopifyInstallationResult> {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shop = urlParams.get('shop');
      const installed = urlParams.get('installed');
      const error = urlParams.get('error');

      if (error) {
        return {
          success: false,
          error: decodeURIComponent(error),
        };
      }

      if (shop && installed === 'true') {
        // Verify the installation was saved to database
        const { data, error: dbError } = await supabase
          .from('shopify_shops')
          .select('shop_domain, status')
          .eq('shop_domain', shop)
          .eq('status', 'active')
          .single();

        if (data && !dbError) {
          // Clean up URL parameters
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);

          return {
            success: true,
            shop: data.shop_domain,
          };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Error checking installation status:', error);
      return {
        success: false,
        error: 'Failed to verify installation',
      };
    }
  }

  // Get shop by domain from Supabase
  public async getShop(shopDomain: string): Promise<any> {
    try {
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
    } catch (error) {
      console.error('Error fetching shop:', error);
      return null;
    }
  }

  // Get shops for current user (if user system is implemented)
  public async getUserShops(userId?: string): Promise<any[]> {
    try {
      if (!userId) {
        // If no user system, return all active shops (for development)
        const { data, error } = await supabase
          .from('shopify_shops')
          .select('*')
          .eq('status', 'active');

        return data || [];
      }

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
    } catch (error) {
      console.error('Error fetching user shops:', error);
      return [];
    }
  }

  // Mark shop as uninstalled (this would typically be done by webhook)
  public async uninstallShop(shopDomain: string): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Error uninstalling shop:', error);
      throw error;
    }
  }

  // Test connection by making a simple API call
  public async testConnection(shopDomain: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  }

  // Initialize from stored credentials
  public async initializeFromStorage(): Promise<string | null> {
    try {
      // Check localStorage first
      const storedShop = localStorage.getItem('shopify_shop_domain');
      if (storedShop) {
        const shop = await this.getShop(storedShop);
        if (shop && shop.status === 'active') {
          return storedShop;
        } else {
          // Clean up invalid stored shop
          localStorage.removeItem('shopify_shop_domain');
        }
      }

      // Check for any active shops (for single-shop use case)
      const shops = await this.getUserShops();
      if (shops.length > 0) {
        const shopDomain = shops[0].shop_domain;
        localStorage.setItem('shopify_shop_domain', shopDomain);
        return shopDomain;
      }

      return null;
    } catch (error) {
      console.error('Error initializing from storage:', error);
      return null;
    }
  }

  // Store shop domain locally
  public storeShopDomain(shopDomain: string): void {
    localStorage.setItem('shopify_shop_domain', shopDomain);
  }

  // Clear stored credentials
  public clearStoredCredentials(): void {
    localStorage.removeItem('shopify_shop_domain');
  }
}

export const shopifyClientAuthService = new ShopifyClientAuthService();