import { useState, useCallback, useEffect } from 'react';
import { useLoader } from '../contexts/LoaderContext';

interface UseDataLoaderOptions {
  showLoader?: boolean;
  message?: string;
  minLoadTime?: number;
}

export function useDataLoader<T>(
  fetchFunction: () => Promise<T>,
  options: UseDataLoaderOptions = {}
) {
  const { showLoader = true, message, minLoadTime = 500 } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { showLoader: showGlobalLoader, hideLoader } = useLoader();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    if (showLoader) {
      showGlobalLoader(message);
    }

    const startTime = Date.now();

    try {
      const result = await fetchFunction();
      
      // Ensure minimum load time for better UX
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
      
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
      if (showLoader) {
        hideLoader();
      }
    }
  }, [fetchFunction, showLoader, showGlobalLoader, hideLoader, message, minLoadTime]);

  // Auto-load on mount if needed
  useEffect(() => {
    loadData();
  }, []); // Only run once on mount

  return {
    data,
    error,
    isLoading,
    refetch: loadData
  };
}