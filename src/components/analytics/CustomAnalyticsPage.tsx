import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CustomizableDashboard } from './CustomizableDashboard';
import { analyticsPageService, AnalyticsPage } from '../../services/analyticsPageService';

interface CustomAnalyticsPageProps {
  barChartColors?: string;
}

export const CustomAnalyticsPage: React.FC<CustomAnalyticsPageProps> = ({ barChartColors }) => {
  const { pageId } = useParams<{ pageId: string }>();
  const [page, setPage] = useState<AnalyticsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      if (!pageId) {
        setError('Page ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let pageData = null;
        
        // Special handling for 'customers' page - create it if it doesn't exist
        if (pageId === 'customers') {
          console.log('Handling special customers page...');
          try {
            // First try to find existing customer analytics page
            const existingPages = await analyticsPageService.getUserPages();
            pageData = existingPages.find((page: AnalyticsPage) => page.template === 'customers' && page.name === 'Customer Analytics');
            
            if (!pageData) {
              console.log('Creating customer analytics page from template...');
              pageData = await analyticsPageService.createPage({
                name: 'Customer Analytics',
                icon: 'FaChartLine',
                template: 'customers'
              });
              console.log('Customer analytics page created successfully:', pageData);
            } else {
              console.log('Found existing customer analytics page:', pageData);
            }
          } catch (createError) {
            console.error('Failed to handle customer analytics page:', createError);
            setError('Failed to create customer analytics page');
            return;
          }
        } else {
          // Regular UUID-based page lookup
          pageData = await analyticsPageService.getPage(pageId);
        }
        
        if (!pageData) {
          setError('Page not found');
          return;
        }
        
        setPage(pageData);
        setError(null);
      } catch (err) {
        console.error('Failed to load custom analytics page:', err);
        setError('Failed to load analytics page');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [pageId]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        color: 'var(--text-primary)'
      }}>
        Loading analytics page...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        color: 'var(--color-error)',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <h3>Error Loading Page</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        color: 'var(--text-primary)'
      }}>
        Page not found
      </div>
    );
  }

  return (
    <CustomizableDashboard
      dashboardId={`custom-${page.id}`}
      barChartColors={barChartColors}
      customPageData={page}
    />
  );
};

export default CustomAnalyticsPage;