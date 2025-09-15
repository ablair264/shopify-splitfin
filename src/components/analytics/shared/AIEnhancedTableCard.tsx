import React from 'react';
import CleanTableCard from './CleanTableCard';
import AIInsightWrapper from '../../AIInsightWrapper/AIInsightWrapper';

interface TableColumn {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

interface AIEnhancedTableCardProps {
  data: Array<any>;
  columns: TableColumn[];
  cardTitle: string;
  dataType: 'revenue' | 'orders' | 'customers' | 'products' | 'performance' | 'general';
  timeFrame?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  historicalData?: Array<any>;
  backgroundColor?: string;
  textColor?: string;
  headerColor?: string;
  borderColor?: string;
  maxRows?: number;
  // AI Insight specific props
  enableAIInsights?: boolean;
  aiButtonPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  aiButtonSize?: 'small' | 'medium' | 'large';
  aiButtonVariant?: 'primary' | 'secondary' | 'ghost';
}

const AIEnhancedTableCard: React.FC<AIEnhancedTableCardProps> = ({
  data,
  columns,
  cardTitle,
  dataType,
  timeFrame = 'monthly',
  historicalData,
  backgroundColor = '#1a1f2a',
  textColor = '#ffffff',
  headerColor = '#79d5e9',
  borderColor = 'rgba(255, 255, 255, 0.1)',
  maxRows = 10,
  enableAIInsights = true,
  aiButtonPosition = 'top-right',
  aiButtonSize = 'small',
  aiButtonVariant = 'ghost'
}) => {
  // Convert table data to AI-friendly format
  const convertToDataPoints = (tableData: Array<any>, columns: TableColumn[]) => {
    return tableData.slice(0, maxRows).map((row, index) => {
      // Find the most relevant numeric column for insights
      const valueColumn = columns.find(col => 
        col.format === 'currency' || col.format === 'number' || col.format === 'percentage'
      );
      
      const nameColumn = columns.find(col => 
        col.format === 'text' || (!col.format && typeof row[col.key] === 'string')
      );
      
      return {
        name: nameColumn ? row[nameColumn.key] : `Row ${index + 1}`,
        value: valueColumn ? (parseFloat(row[valueColumn.key]) || 0) : 0,
        change: row.change || undefined,
        previousValue: row.previousValue || undefined,
        date: row.date || undefined
      };
    });
  };

  const currentDataPoints = convertToDataPoints(data, columns);
  const historicalDataPoints = historicalData ? convertToDataPoints(historicalData, columns) : undefined;

  const tableCard = (
    <CleanTableCard
      data={data}
      columns={columns}
      backgroundColor={backgroundColor}
      textColor={textColor}
      headerColor={headerColor}
      borderColor={borderColor}
      maxRows={maxRows}
    />
  );

  if (!enableAIInsights) {
    return tableCard;
  }

  return (
    <AIInsightWrapper
      cardTitle={cardTitle}
      currentData={currentDataPoints}
      historicalData={historicalDataPoints}
      dataType={dataType}
      timeFrame={timeFrame}
      buttonPosition={aiButtonPosition}
      buttonSize={aiButtonSize}
      buttonVariant={aiButtonVariant}
    >
      {tableCard}
    </AIInsightWrapper>
  );
};

export default AIEnhancedTableCard;