import { useState, useCallback } from 'react';
import { shopifyService } from '../services';

interface UseShopifyProductsResult {
  uploadProducts: (
    file: File,
    options?: {
      enableAI?: boolean;
      enhanceDescriptions?: boolean;
      generateSEO?: boolean;
      autoPublish?: boolean;
    }
  ) => Promise<any>;
  uploadImages: (
    images: Array<{ url: string; filename: string }>,
    options?: {
      autoMatch?: boolean;
      requireConfirmation?: boolean;
    }
  ) => Promise<any>;
  isUploading: boolean;
  uploadProgress: number;
  error?: string;
  lastResult?: any;
}

export const useShopifyProducts = (): UseShopifyProductsResult => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [lastResult, setLastResult] = useState<any>();

  const uploadProducts = useCallback(async (
    file: File,
    options: {
      enableAI?: boolean;
      enhanceDescriptions?: boolean;
      generateSEO?: boolean;
      autoPublish?: boolean;
    } = {}
  ) => {
    try {
      setIsUploading(true);
      setError(undefined);
      setUploadProgress(0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await shopifyService.uploadProducts(file, options);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setLastResult(result);
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to upload products');
      throw err;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000);
    }
  }, []);

  const uploadImages = useCallback(async (
    images: Array<{ url: string; filename: string }>,
    options: {
      autoMatch?: boolean;
      requireConfirmation?: boolean;
    } = {}
  ) => {
    try {
      setIsUploading(true);
      setError(undefined);
      setUploadProgress(0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 300);

      const result = await shopifyService.matchAndUploadImages(images, options);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setLastResult(result);
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to upload images');
      throw err;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 2000);
    }
  }, []);

  return {
    uploadProducts,
    uploadImages,
    isUploading,
    uploadProgress,
    error,
    lastResult,
  };
};