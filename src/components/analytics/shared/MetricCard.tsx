import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import CountUp from 'react-countup';
import { useColors } from './ColorProvider';
import styles from './MetricCard.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export interface MetricCardProps {
  id: string;
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: Array<{ name: string; value: number }>;
  format?: 'currency' | 'number' | 'percentage';
  displayMode?: 'compact' | 'medium' | 'large';
  design?: 'variant1' | 'variant2' | 'variant3';
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  onOptionsClick?: () => void;
  onVariantChange?: (variant: 'variant1' | 'variant2' | 'variant3') => void;
  cardIndex?: number;
  isEditMode?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  subtitle,
  trend,
  chartData = [],
  format = 'number',
  displayMode = 'medium',
  design = 'variant1',
  icon,
  color: propColor,
  onClick,
  onOptionsClick,
  onVariantChange,
  cardIndex = 0,
  isEditMode = false
}) => {
  const { getMetricCardColor } = useColors();
  
  // Use context color if no specific color is provided
  const color = propColor || getMetricCardColor(cardIndex);

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat('en-GB').format(val);
    }
  };

  const chartConfig = {
    margin: { top: 5, right: 10, bottom: 5, left: 10 },
    strokeWidth: 2,
  };

  const renderVariantSelector = (isEditMode: boolean = false) => {
    // Only show variant selector in edit mode AND when onVariantChange is provided
    if (!onVariantChange || !isEditMode) return null;
    
    return (
      <div className={styles.variantSelector}>
        <button
          className={`${styles.variantButton} ${design === 'variant1' ? styles.active : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange('variant1');
          }}
          title="Area Chart"
        >
          1
        </button>
        <button
          className={`${styles.variantButton} ${design === 'variant2' ? styles.active : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange('variant2');
          }}
          title="Line Chart"
        >
          2
        </button>
        <button
          className={`${styles.variantButton} ${design === 'variant3' ? styles.active : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange('variant3');
          }}
          title="Bar Chart"
        >
          3
        </button>
      </div>
    );
  };

  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return null;
    }

    const labels = chartData.map(item => item.name);
    const values = chartData.map(item => item.value);

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
        },
      },
      elements: {
        point: {
          radius: 0,
        },
      },
      interaction: {
        intersect: false,
      },
    };

    // Different chart configs for each variant
    let chartDataConfig, ChartComponent;
    
    if (design === 'variant1') {
      // Line chart for variant 1 (glassmorphism with side accent)
      ChartComponent = Line;
      chartDataConfig = {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: 'transparent',
            fill: false,
            borderWidth: 2,
            tension: 0.4,
          },
        ],
      };
    } else if (design === 'variant2') {
      // Bar chart for variant 2 (top accent)
      ChartComponent = Bar;
      const barColors = values.map((_, index) => 
        index === Math.floor(values.length / 2) ? '#FF9F00' : color  // Highlight middle bar
      );
      chartDataConfig = {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: barColors,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      };
    } else {
      // Area chart for variant 3 (full border)
      ChartComponent = Line;
      chartDataConfig = {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: `${color}40`,
            fill: true,
            borderWidth: 2,
            tension: 0.4,
          },
        ],
      };
    }

    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ChartComponent data={chartDataConfig} options={chartOptions} />
      </div>
    );
  };

  if (displayMode === 'compact') {
    return (
      <div 
        className={styles.metricCardCompact} 
        onClick={onClick} 
        style={{ 
          borderLeftColor: color,
          borderLeftWidth: '3px'
        }}
      >
        <div className={styles.compactIcon} style={{ backgroundColor: color }}>
          {icon || '💰'}
        </div>
        <div className={styles.compactContent}>
          <div className={styles.compactValue} style={{ color: 'var(--text-primary)' }}>
            {typeof value === 'number' ? (
              <CountUp
                end={value}
                duration={1.5}
                separator=","
                prefix={format === 'currency' ? '£' : ''}
                suffix={format === 'percentage' ? '%' : ''}
                decimals={format === 'percentage' ? 1 : 0}
              />
            ) : (
              value
            )}
          </div>
          <div className={styles.compactTitle}>{title}</div>
        </div>
        {trend && (
          <div className={`${styles.compactTrend} ${trend.isPositive ? styles.positive : styles.negative}`}>
            <span className={styles.trendIcon}>{trend.isPositive ? '↗' : '↘'}</span>
            <span className={styles.trendValue}>+{Math.abs(trend.value).toFixed(0)}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${styles.metricCardFull} ${styles[`metricCard${design.charAt(0).toUpperCase() + design.slice(1)}`]} ${styles[displayMode]}`} 
      onClick={onClick} 
      style={{
        ...(design === 'variant1' && {
          borderLeftColor: color
        }),
        ...(design === 'variant2' && {
          borderTopColor: color
        }),
        ...(design === 'variant3' && {
          borderTopColor: color,
          borderBottomColor: color,
          borderLeftColor: color,
          borderRightColor: color
        }),
        background: design === 'variant1' ? `rgba(var(--bg-secondary-rgb), 0.8)` : undefined,
        backdropFilter: design === 'variant1' ? 'blur(10px)' : undefined
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <h3 className={styles.cardTitle}>{title}</h3>
        </div>
        <div className={styles.headerRight}>
          {trend && (
            <div className={`${styles.trendIndicator} ${trend.isPositive ? styles.positive : styles.negative}`}>
              <span className={styles.trendIcon}>{trend.isPositive ? '↑' : '↓'}</span>
              <span className={styles.trendValue}>{Math.abs(trend.value).toFixed(0)}%</span>
            </div>
          )}
          {renderVariantSelector(isEditMode)}
          {onOptionsClick && (
            <button className={styles.optionsButton} onClick={(e) => {
              e.stopPropagation();
              onOptionsClick();
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className={styles.cardValue}>
        {typeof value === 'number' ? (
          <CountUp
            end={value}
            duration={1.5}
            separator=","
            prefix={format === 'currency' ? '£' : ''}
            suffix={format === 'percentage' ? '%' : ''}
            decimals={format === 'percentage' ? 1 : 0}
          />
        ) : (
          value
        )}
      </div>
      
      {subtitle && <div className={styles.cardSubtitle}>{subtitle}</div>}
      
      {chartData && chartData.length > 0 && (
        <div className={styles.cardChart}>
          {renderChart()}
        </div>
      )}
      
      {chartData && chartData.length > 0 && (
        <div className={styles.cardDateRange}>
          <span>{chartData[0]?.name}</span>
          <span>{chartData[chartData.length - 1]?.name}</span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;