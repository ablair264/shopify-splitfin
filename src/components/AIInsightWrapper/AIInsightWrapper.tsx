import React from 'react';
import AIInsightButton from '../AIInsightButton/AIInsightButton';
import AIInsightModal from '../AIInsightModal/AIInsightModal';
import { useAIInsight } from '../../hooks/useAIInsight';
import './AIInsightWrapper.css';

interface DataPoint {
  name: string;
  value: number;
  change?: number;
  previousValue?: number;
  date?: string;
}

interface AIInsightWrapperProps {
  children: React.ReactNode;
  cardTitle: string;
  currentData: DataPoint[];
  historicalData?: DataPoint[];
  dataType: 'revenue' | 'orders' | 'customers' | 'products' | 'performance' | 'general';
  timeFrame?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  buttonPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: 'small' | 'medium' | 'large';
  buttonVariant?: 'primary' | 'secondary' | 'ghost';
}

const AIInsightWrapper: React.FC<AIInsightWrapperProps> = ({
  children,
  cardTitle,
  currentData,
  historicalData,
  dataType,
  timeFrame = 'monthly',
  buttonPosition = 'top-right',
  buttonSize = 'small',
  buttonVariant = 'ghost'
}) => {
  const {
    insight,
    isLoading,
    isModalOpen,
    error,
    generateInsight,
    closeModal
  } = useAIInsight({ cardTitle, dataType, timeFrame });

  const handleInsightClick = () => {
    generateInsight(currentData, historicalData);
  };

  return (
    <div className="ai-insight-wrapper">
      <div className="ai-insight-wrapper__content">
        {children}
      </div>
      
      <div className={`ai-insight-wrapper__button ai-insight-wrapper__button--${buttonPosition}`}>
        <AIInsightButton
          onClick={handleInsightClick}
          isLoading={isLoading}
          disabled={currentData.length === 0}
          size={buttonSize}
          variant={buttonVariant}
          tooltip={error || (currentData.length === 0 ? 'No data available' : 'Get AI insights')}
        />
      </div>

      <AIInsightModal
        isOpen={isModalOpen}
        onClose={closeModal}
        cardTitle={cardTitle}
        insight={insight}
        isLoading={isLoading}
      />
    </div>
  );
};

export default AIInsightWrapper;