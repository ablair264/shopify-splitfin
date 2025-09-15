import React, { useEffect } from 'react';
import { useLoader } from '../contexts/LoaderContext';
import { useLocation } from 'react-router-dom';

// Route-based loading messages
const getLoadingMessage = (pathname: string): string => {
  const routeMessages: { [key: string]: string } = {
    '/dashboard': 'Loading Dashboard...',
    '/orders': 'Fetching Orders...',
    '/orders/new': 'Preparing New Order...',
    '/orders/view': 'Loading Order Details...',
    '/customers': 'Fetching Customer Data...',
    '/customers/new': 'Loading Customer Form...',
    '/customers/map': 'Loading Customer Map...',
    '/analytics': 'Loading Analytics...',
    '/analytics/overview': 'Preparing Analytics Overview...',
    '/analytics/custom': 'Loading Custom Dashboard...',
    '/products': 'Loading Products...',
    '/brands': 'Fetching Brand Information...',
    '/settings': 'Loading Settings...',
    '/profile': 'Loading Profile...',
    '/inventory': 'Loading Inventory...',
    '/finance': 'Loading Finance Data...',
    '/suppliers': 'Loading Suppliers...'
  };

  // Try exact match first
  if (routeMessages[pathname]) {
    return routeMessages[pathname];
  }
  
  // Try to match parent routes
  const pathSegments = pathname.split('/').filter(Boolean);
  for (let i = pathSegments.length; i > 0; i--) {
    const partialPath = '/' + pathSegments.slice(0, i).join('/');
    if (routeMessages[partialPath]) {
      return routeMessages[partialPath];
    }
  }
  
  return 'Loading...';
};

interface WithLoaderOptions {
  customMessage?: string;
  showLoader?: boolean;
  minLoadTime?: number;
}

// Higher-Order Component to wrap any component with loader functionality
export function withLoader<T extends {}>(
  WrappedComponent: React.ComponentType<T>,
  options: WithLoaderOptions = {}
) {
  const { 
    customMessage, 
    showLoader: shouldShowLoader = true,
    minLoadTime = 1000
  } = options;

  return (props: T) => {
    const { showLoader, hideLoader, setProgress } = useLoader();
    const location = useLocation();
    const [isComponentMounted, setIsComponentMounted] = React.useState(false);

    useEffect(() => {
      if (shouldShowLoader) {
        setIsComponentMounted(false);
        const message = customMessage || getLoadingMessage(location.pathname);
        showLoader(message);
        
        // Simulate realistic progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15 + 5; // Progress between 5-20% each interval
          if (progress > 85) progress = 85; // Cap at 85% until completion
          setProgress(progress);
        }, 150);

        // Minimum load time for better UX
        const timer = setTimeout(() => {
          clearInterval(progressInterval);
          setProgress(100);
          setTimeout(() => {
            hideLoader();
            setIsComponentMounted(true);
          }, 300);
        }, minLoadTime);

        return () => {
          clearInterval(progressInterval);
          clearTimeout(timer);
        };
      } else {
        setIsComponentMounted(true);
      }
    }, [location.pathname, shouldShowLoader]); // Re-run when route changes

    // Always render the component, but the global ProgressLoader will overlay it
    return <WrappedComponent {...props} />;
  };
}

// Hook for manual loader control within components
export const useComponentLoader = () => {
  const { showLoader, hideLoader, setProgress } = useLoader();
  const location = useLocation();

  const showComponentLoader = (customMessage?: string) => {
    const message = customMessage || getLoadingMessage(location.pathname);
    showLoader(message);
  };

  return {
    showLoader: showComponentLoader,
    hideLoader,
    setProgress
  };
};