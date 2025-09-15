import { useState, useEffect } from 'react';
import { shopifyService, shopifyAuthService } from '../services';

interface UseShopifyAuthResult {
  isConnected: boolean;
  shopDomain?: string;
  isLoading: boolean;
  error?: string;
  connect: (shopDomain: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  checkConnection: () => Promise<void>;
}

export const useShopifyAuth = (): UseShopifyAuthResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      
      const status = shopifyService.getStatus();
      setIsConnected(status.connected);
      setShopDomain(status.shop);
    } catch (err: any) {
      setError(err.message || 'Failed to check connection');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = async (domain: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(undefined);
      
      const success = await shopifyService.initialize(domain);
      
      if (success) {
        setIsConnected(true);
        setShopDomain(domain);
        return true;
      } else {
        setError('Failed to connect to Shopify');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      setIsLoading(true);
      await shopifyService.disconnect();
      setIsConnected(false);
      setShopDomain(undefined);
      setError(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isConnected,
    shopDomain,
    isLoading,
    error,
    connect,
    disconnect,
    checkConnection,
  };
};