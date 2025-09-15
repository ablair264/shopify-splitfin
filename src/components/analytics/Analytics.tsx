import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ColorProvider } from './shared';
import AnalyticsOverview from './AnalyticsOverview';
import AnalyticsDemo from '../views/AnalyticsDemo';
import { CustomizableDashboard } from './CustomizableDashboard';
import { analyticsPageService } from '../../services/analyticsPageService';
import CustomAnalyticsPage from './CustomAnalyticsPage';
import { withLoader } from '../../hoc/withLoader';
import './Analytics.css';

function Analytics() {
  const navigate = useNavigate();
  const location = useLocation();
  const [barChartColors, setBarChartColors] = useState<any>('primary');

  // Redirect to overview if on base analytics path
  useEffect(() => {
    if (location.pathname === '/analytics') {
      navigate('/analytics/overview');
    }
  }, [location.pathname, navigate]);

  return (
    <ColorProvider barChartColors={barChartColors} graphColors={{ primary: '#79d5e9', secondary: '#4daeac', tertiary: '#f77d11' }}>
      <div className="analytics-container">
        <Routes>
          <Route path="overview" element={<CustomizableDashboard dashboardId="main" barChartColors={barChartColors} />} />
          <Route path="custom" element={<CustomizableDashboard dashboardId="main" barChartColors={barChartColors} />} />
          <Route path="custom/:pageId" element={<CustomAnalyticsPage barChartColors={barChartColors} />} />
        </Routes>
      </div>
    </ColorProvider>
  );
}

export default withLoader(Analytics);