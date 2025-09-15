import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, TrendingUp, TrendingDown, Minus, AlertCircle, BarChart3, Lightbulb, Target, Zap } from 'lucide-react';
import './AIInsightModal.css';

export interface AIInsight {
  insight: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'unavailable';
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  itemTrends?: {
    topItem: string;
    emergingTrends: string[];
    decliningItems: string[];
  };
  valueAnalysis?: {
    currentAOV: number;
    historicalComparison: string;
    recommendations: string[];
  };
  volumeTrends?: {
    comparison: string;
    seasonalPattern: string;
    monthlyTrend: string;
  };
  revenueBreakdown?: string;
  customerAnalysis?: string;
  growthDrivers?: string;
  recommendations?: string[];
  forecast?: string;
}

interface AIInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardTitle: string;
  insight: AIInsight | null;
  isLoading: boolean;
}

const AIInsightModal: React.FC<AIInsightModalProps> = ({
  isOpen,
  onClose,
  cardTitle,
  insight,
  isLoading
}) => {
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnimationClass('modal-enter');
      setTimeout(() => setAnimationClass('modal-enter-active'), 10);
    } else {
      setAnimationClass('modal-exit');
    }
  }, [isOpen]);

  // Scroll to top when modal opens
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Ensure modal appears at viewport center regardless of scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position when closing
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getTrendIcon = () => {
    if (!insight) return <Minus className="trend-icon" />;
    
    switch (insight.trend) {
      case 'increasing':
        return <TrendingUp className="trend-icon trend-up" />;
      case 'decreasing':
        return <TrendingDown className="trend-icon trend-down" />;
      case 'stable':
        return <Minus className="trend-icon trend-stable" />;
      default:
        return <AlertCircle className="trend-icon trend-unavailable" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const modalContent = (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div 
        className={`ai-modal-container ${animationClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <h2>{cardTitle} - AI Analysis</h2>
            {insight && (
              <div className="trend-badge">
                {getTrendIcon()}
                <span className={`trend-text trend-${insight.trend}`}>
                  {insight.trend}
                </span>
              </div>
            )}
          </div>
          <button className="ai-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="ai-modal-body">
          {isLoading ? (
            <div className="ai-loading-state">
              <div className="ai-loader">
                <div className="loader-dot"></div>
                <div className="loader-dot"></div>
                <div className="loader-dot"></div>
              </div>
              <p>Analyzing your data...</p>
            </div>
          ) : insight ? (
            <>
              {/* Key Insight Section */}
              <div className="ai-section">
                <div className="ai-section-header">
                  <Lightbulb size={18} />
                  <h3>Key Insight</h3>
                </div>
                <div className="ai-section-content">
                  <p>{insight.insight}</p>
                </div>
              </div>

              {/* Trend Analysis Section */}
              {insight.trend !== 'unavailable' && (
                <div className="ai-section">
                  <div className="ai-section-header">
                    <BarChart3 size={18} />
                    <h3>Trend Analysis</h3>
                  </div>
                  <div className="ai-section-content">
                    {insight.volumeTrends ? (
                      <div className="trend-details">
                        <div className="trend-item">
                          <span className="trend-label">Comparison:</span>
                          <span className="trend-value">{insight.volumeTrends.comparison}</span>
                        </div>
                        <div className="trend-item">
                          <span className="trend-label">Seasonal Pattern:</span>
                          <span className="trend-value">{insight.volumeTrends.seasonalPattern}</span>
                        </div>
                        <div className="trend-item">
                          <span className="trend-label">Monthly Trend:</span>
                          <span className="trend-value">{insight.volumeTrends.monthlyTrend}</span>
                        </div>
                      </div>
                    ) : (
                      <p>{insight.trend}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations Section */}
              <div className="ai-section">
                <div className="ai-section-header">
                  <Target size={18} />
                  <h3>Recommended Action</h3>
                </div>
                <div className="ai-section-content recommended-action">
                  <p>{insight.action}</p>
                  {insight.recommendations && insight.recommendations.length > 0 && (
                    <ul className="recommendations-list">
                      {insight.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Additional Analysis */}
              {(insight.itemTrends || insight.valueAnalysis || insight.forecast) && (
                <div className="ai-section">
                  <div className="ai-section-header">
                    <Zap size={18} />
                    <h3>Deep Analysis</h3>
                  </div>
                  <div className="ai-section-content">
                    {insight.itemTrends && (
                      <div className="analysis-subsection">
                        <h4>Item Performance</h4>
                        <p><strong>Top Item:</strong> {insight.itemTrends.topItem}</p>
                        {insight.itemTrends.emergingTrends.length > 0 && (
                          <p><strong>Emerging:</strong> {insight.itemTrends.emergingTrends.join(', ')}</p>
                        )}
                      </div>
                    )}
                    {insight.forecast && (
                      <div className="analysis-subsection">
                        <h4>Forecast</h4>
                        <p>{insight.forecast}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer Metadata */}
              <div className="ai-modal-footer">
                <div 
                  className="priority-badge"
                  style={{ backgroundColor: getPriorityColor(insight.priority) + '20', 
                           color: getPriorityColor(insight.priority) }}
                >
                  Priority: {insight.priority}
                </div>
                <div className="impact-badge">
                  Impact: {insight.impact}
                </div>
              </div>
            </>
          ) : (
            <div className="ai-error-state">
              <AlertCircle size={48} />
              <h3>Unable to generate insights at this time</h3>
              <p>Please try again in a few moments</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render modal using Portal to ensure it's at document root
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default AIInsightModal;
