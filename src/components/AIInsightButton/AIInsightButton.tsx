import React from 'react';
import { Brain, Loader2 } from 'lucide-react';
import './AIInsightButton.css';

interface AIInsightButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'ghost';
  tooltip?: string;
}

const AIInsightButton: React.FC<AIInsightButtonProps> = ({
  onClick,
  isLoading = false,
  disabled = false,
  size = 'medium',
  variant = 'primary',
  tooltip = 'Get AI insights'
}) => {
  return (
    <button
      className={`ai-insight-btn ai-insight-btn--${size} ai-insight-btn--${variant}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      title={tooltip}
    >
      {isLoading ? (
        <Loader2 className="ai-insight-btn__icon ai-insight-btn__icon--spinning" size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
      ) : (
        <Brain className="ai-insight-btn__icon" size={size === 'small' ? 14 : size === 'large' ? 20 : 16} />
      )}
      {size !== 'small' && (
        <span className="ai-insight-btn__text">
          {isLoading ? 'Analyzing...' : 'AI Insights'}
        </span>
      )}
    </button>
  );
};

export default AIInsightButton;