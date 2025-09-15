import React, { createContext, useContext, useState, useCallback } from 'react';

interface LoaderContextType {
  isLoading: boolean;
  progress: number;
  message?: string;
  showLoader: (message?: string) => void;
  hideLoader: () => void;
  setProgress: (progress: number) => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error('useLoader must be used within a LoaderProvider');
  }
  return context;
};

interface LoaderProviderProps {
  children: React.ReactNode;
}

export const LoaderProvider: React.FC<LoaderProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const showLoader = useCallback((customMessage?: string) => {
    setIsLoading(true);
    setProgress(0);
    setMessage(customMessage);
  }, []);

  const hideLoader = useCallback(() => {
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
      setMessage(undefined);
    }, 300);
  }, []);

  const updateProgress = useCallback((newProgress: number) => {
    setProgress(newProgress);
  }, []);

  const value = {
    isLoading,
    progress,
    message,
    showLoader,
    hideLoader,
    setProgress: updateProgress,
  };

  return (
    <LoaderContext.Provider value={value}>
      {children}
    </LoaderContext.Provider>
  );
};