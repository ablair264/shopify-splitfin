import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoader } from '../contexts/LoaderContext';

export const useNavigationLoader = () => {
  const navigate = useNavigate();
  const { showLoader, hideLoader } = useLoader();

  const navigateWithLoader = useCallback((to: string, message?: string) => {
    showLoader(message);
    
    // Simulate some loading time for smoother UX
    setTimeout(() => {
      navigate(to);
      setTimeout(() => {
        hideLoader();
      }, 500); // Give time for the new component to mount
    }, 300);
  }, [navigate, showLoader, hideLoader]);

  return { navigateWithLoader };
};