import React, { useState } from 'react';
import CardChart from './CardChart';
import DataTable from './DataTable';
import type { TableColumn } from './DataTable';
import styles from './FlexibleChart.module.css';

export interface ChartDataItem {
  name: string;
  value: number;
  [key: string]: any;
}

export interface FlexibleChartProps {
  id?: string;
  title: string;
  subtitle?: string;
  data: ChartDataItem[];
  defaultType?: 'horizontal-bar' | 'pie' | 'vertical-bar' | 'table';
  showTypeSwitcher?: boolean;
  height?: number;
  colors?: string[];
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  formatValue?: (value: number) => string;
  showRanking?: boolean;
  maxItems?: number;
  emptyMessage?: string;
  tableColumns?: Array<{
    key: string;
    header: string;
    width?: string;
    render?: (item: ChartDataItem, index?: number) => React.ReactNode;
  }>;
}

const FlexibleChart: React.FC<FlexibleChartProps> = ({
  id = 'flexible-chart',
  title,
  subtitle,
  data,
  defaultType = 'horizontal-bar',
  showTypeSwitcher = false,
  height = 300,
  colors = ['#79d5e9', '#4daeac', '#61bc8e', '#fbbf24', '#dc2626'],
  loading = false,
  error = null,
  onClick,
  formatValue = (value) => value.toLocaleString(),
  showRanking = false,
  maxItems,
  emptyMessage = 'No data available',
  tableColumns
}) => {
  const [currentType, setCurrentType] = useState(defaultType);

  // Chart type options
  const chartTypeOptions = [
    { value: 'horizontal-bar', label: 'Horizontal Bars', icon: '📊' },
    { value: 'pie', label: 'Pie Chart', icon: '🥧' },
    { value: 'vertical-bar', label: 'Vertical Bars', icon: '📈' },
    { value: 'table', label: 'Table', icon: '📋' }
  ];

  // Process data
  const processedData = maxItems ? data.slice(0, maxItems) : data;
  
  // Prepare data for charts
  const chartData = processedData.map((item, index) => ({
    ...item,
    color: colors[index % colors.length]
  }));

  // Default table columns if not provided
  const defaultTableColumns: TableColumn<ChartDataItem>[] = [
    ...(showRanking ? [{
      key: 'rank',
      header: '#',
      width: '60px',
      className: styles.rankColumn,
      render: (_: ChartDataItem, index?: number) => (
        <span className={styles.rankNumber}>{(index || 0) + 1}</span>
      )
    }] : []),
    {
      key: 'name',
      header: 'NAME',
      width: showRanking ? '60%' : '70%',
      render: (item) => (
        <span className={styles.itemName}>{item.name}</span>
      )
    },
    {
      key: 'value',
      header: 'TOTAL',
      width: showRanking ? '30%' : '30%',
      className: styles.valueColumn,
      render: (item) => (
        <span className={styles.itemValue}>
          {formatValue(item.value)}
        </span>
      )
    }
  ];

  // Use provided columns or default ones
  const columns = tableColumns ? tableColumns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width,
    className: col.key === 'value' ? styles.valueColumn : undefined,
    render: col.render ? (item: ChartDataItem, index?: number) => col.render!(item, index) : undefined
  })) : defaultTableColumns;

  // Render chart type switcher
  const renderTypeSwitcher = () => {
    if (!showTypeSwitcher) return null;

    return (
      <div className={styles.typeSwitcher}>
        {chartTypeOptions.map(option => (
          <button
            key={option.value}
            className={`${styles.switcherButton} ${
              currentType === option.value ? styles.active : ''
            }`}
            onClick={() => setCurrentType(option.value as any)}
            title={option.label}
          >
            {option.icon}
          </button>
        ))}
      </div>
    );
  };

  // Render content based on current type
  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading data...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorState}>
          <span>⚠️ {error}</span>
        </div>
      );
    }

    if (processedData.length === 0) {
      return (
        <div className={styles.emptyState}>
          <span>📊 {emptyMessage}</span>
        </div>
      );
    }

    if (currentType === 'table') {
      return (
        <div className={styles.tableWrapper}>
          <DataTable
            columns={columns}
            data={processedData}
            keyExtractor={(item: ChartDataItem) => item.id || item.name || Math.random().toString()}
            className={styles.dataTable}
          />
        </div>
      );
    }

    // Determine chart design and type
    let design = 'default';
    let type: 'bar' | 'pie' = 'bar';

    switch (currentType) {
      case 'horizontal-bar':
        design = 'horizontal-bars';
        type = 'bar';
        break;
      case 'pie':
        design = 'pie-with-legend';
        type = 'pie';
        break;
      case 'vertical-bar':
        design = 'default';
        type = 'bar';
        break;
    }

    return (
      <div className={styles.chartWrapper}>
        <CardChart
          id={id}
          title=""
          data={chartData}
          type={type}
          dataKey="value"
          colors={colors}
          height={height - 80} // Account for header
          design={design as any}
          showLegend={currentType === 'pie'}
          onClick={onClick}
        />
      </div>
    );
  };

  return (
    <div className={styles.container} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {renderTypeSwitcher()}
      </div>
      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default FlexibleChart;