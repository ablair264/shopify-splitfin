import React from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip
} from 'recharts';
import CountUp from 'react-countup';
import styles from './MediumMetricCard.module.css';

export interface MediumMetricCardProps {
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
  design?: 'variant1' | 'variant2' | 'variant3';
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  onOptionsClick?: () => void;
  onVariantChange?: (variant: 'variant1' | 'variant2' | 'variant3') => void;
  isEditMode?: boolean;
}

const MediumMetricCard: React.FC<MediumMetricCardProps> = ({
  id,
  title,
  value,
  subtitle,
  trend,
  chartData = [],
  format = 'number',
  design = 'variant1',
  icon,
  color = '#79d5e9',
  onClick,
  onOptionsClick,
  onVariantChange,
  isEditMode = false
}) => {

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

  // Variant selector removed - variants are now set in config modal only

  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null;

    const ChartComponent = design === 'variant3' ? BarChart : design === 'variant2' ? LineChart : AreaChart;
    const DataComponent = design === 'variant3' ? Bar : design === 'variant2' ? Line : Area;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData} {...chartConfig}>
          <defs>
            <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="name" hide />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: '#1a1f2a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              fontSize: '12px',
              padding: '8px'
            }}
            labelStyle={{ color: '#a0a0a0' }}
            formatter={(value: number) => [
              format === 'currency' ? `£${Math.round(value).toLocaleString()}` :
              format === 'percentage' ? `${Math.round(value)}%` :
              Math.round(value).toLocaleString(),
              ''
            ]}
          />
          {design === 'variant3' ? (
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          ) : design === 'variant2' ? (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          ) : (
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#gradient-${id})`}
              strokeWidth={2}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div 
      className={`${styles.mediumMetricCard} ${styles[`metricCard${design.charAt(0).toUpperCase() + design.slice(1)}`]}`} 
      onClick={onClick} 
      style={{
        ...(design === 'variant1' && {
          borderTopColor: color,
          borderBottomColor: color,
          borderLeftColor: color,
          borderRightColor: color
        }),
        ...(design === 'variant2' && {
          borderLeftColor: color
        }),
        ...(design === 'variant3' && {
          borderTopColor: color
        }),
        background: design === 'variant1' ? `linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, ${color}15 100%)` : undefined
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

export default MediumMetricCard;