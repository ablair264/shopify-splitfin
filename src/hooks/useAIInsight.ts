import { useState, useCallback } from 'react';
import { aiInsightService } from '../services/aiInsightService';
import { AIInsight } from '../components/AIInsightModal/AIInsightModal';

interface DataPoint {
  name: string;
  value: number;
  change?: number;
  previousValue?: number;
  date?: string;
}

interface UseAIInsightProps {
  cardTitle: string;
  dataType: 'revenue' | 'orders' | 'customers' | 'products' | 'performance' | 'general';
  timeFrame?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export const useAIInsight = ({ cardTitle, dataType, timeFrame = 'monthly' }: UseAIInsightProps) => {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = useCallback(async (currentData: DataPoint[], historicalData?: DataPoint[]) => {
    if (!currentData || currentData.length === 0) {
      setError('No data available for analysis');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const context = {
        cardTitle,
        currentData,
        historicalData,
        timeFrame,
        dataType
      };

      const generatedInsight = await aiInsightService.generateInsight(context);
      setInsight(generatedInsight);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setError('Failed to generate insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [cardTitle, dataType, timeFrame]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const resetInsight = useCallback(() => {
    setInsight(null);
    setError(null);
  }, []);

  return {
    insight,
    isLoading,
    isModalOpen,
    error,
    generateInsight,
    openModal,
    closeModal,
    resetInsight
  };
};