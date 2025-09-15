// Example component showing how to use the ProgressLoader

import React from 'react';
import { useNavigationLoader } from '../hooks/useNavigationLoader';
import { useDataLoader } from '../hooks/useDataLoader';
import { useLoader } from '../contexts/LoaderContext';

// Example 1: Navigation with loader
export const NavigationExample: React.FC = () => {
  const { navigateWithLoader } = useNavigationLoader();

  const handleNavigateToCustomers = () => {
    // Navigate with automatic loading message based on route
    navigateWithLoader('/customers');
  };

  const handleNavigateWithCustomMessage = () => {
    // Navigate with custom loading message
    navigateWithLoader('/orders', 'Preparing your orders...');
  };

  return (
    <div>
      <button onClick={handleNavigateToCustomers}>
        Go to Customers
      </button>
      <button onClick={handleNavigateWithCustomMessage}>
        Go to Orders (Custom Message)
      </button>
    </div>
  );
};

// Example 2: Data fetching with loader
export const DataFetchExample: React.FC = () => {
  // Fetch data with automatic loader
  const { data, error, isLoading, refetch } = useDataLoader(
    async () => {
      // Simulate API call
      const response = await fetch('/api/data');
      return response.json();
    },
    {
      message: 'Fetching your data...',
      minLoadTime: 1000 // Ensure loader shows for at least 1 second
    }
  );

  return (
    <div>
      {error && <p>Error: {error.message}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={refetch}>Refresh Data</button>
    </div>
  );
};

// Example 3: Manual loader control
export const ManualLoaderExample: React.FC = () => {
  const { showLoader, hideLoader, setProgress } = useLoader();

  const handleLongOperation = async () => {
    showLoader('Processing your request...');
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    hideLoader();
  };

  return (
    <div>
      <button onClick={handleLongOperation}>
        Start Long Operation
      </button>
    </div>
  );
};

// Example 4: Component with initial data loading
export const ComponentWithInitialLoad: React.FC = () => {
  const { data } = useDataLoader(
    async () => {
      // This will automatically show loader when component mounts
      const response = await fetch('/api/initial-data');
      return response.json();
    },
    {
      message: 'Loading component data...'
    }
  );

  if (!data) return null;

  return (
    <div>
      <h1>Component loaded with data!</h1>
      {/* Render your component content */}
    </div>
  );
};