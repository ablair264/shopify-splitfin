import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import CountUp from 'react-countup';
import { useColors } from './ColorProvider';
import styles from './ColorfulMetricCard.module.css';

export interface ColorfulMetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  chartData?: Array<{ name: string; value: number }>;
  color?: 'purple' | 'blue' | 'orange' | 'green' | 'red' | 'yellow' | string;
  format?: 'currency' | 'number' | 'percentage';
  onClick?: () => void;
  className?: string;
  cardIndex?: number; // For multicolored mode
  useContextColors?: boolean; // Whether to use context colors instead of predefined
}

const ColorfulMetricCard: React.FC<ColorfulMetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  chartData,
  color,
  format = 'number',
  onClick,
  className = '',
  cardIndex = 0,
  useContextColors = false
}) => {
  const { getMetricCardColor } = useColors();
  
  // Determine final color to use
  const finalColor = useContextColors ? getMetricCardColor(cardIndex) : color || 'blue';

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    
    const Icon = trend.isPositive ? TrendingUp : TrendingDown;
    return <Icon size={16} />;
  };

  // Handle both predefined color names and hex values
  const getColorClass = () => {
    if (useContextColors || finalColor.startsWith('#')) {
      return 'custom';
    }
    return finalColor;
  };

  const getCustomColorStyle = () => {
    if (useContextColors || finalColor.startsWith('#')) {
      return {
        '--gradient-start': finalColor,
        '--gradient-end': `${finalColor}CC`, // Add some transparency
      } as React.CSSProperties;
    }
    return {};
  };

  const cardClasses = [
    styles.colorfulMetricCard,
    styles[`color${getColorClass().charAt(0).toUpperCase() + getColorClass().slice(1)}`] || '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        ...getCustomColorStyle()
      }}
    >
      <div className={styles.metricCardHeader}>
        <div className={styles.metricCardIcon}>{icon}</div>
        {trend && (
          <div className={`${styles.metricTrend} ${trend.isPositive ? styles.positive : styles.negative}`}>
            {getTrendIcon()}
            <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(0)}%</span>
          </div>
        )}
      </div>
      
      <div className={styles.metricCardBody}>
        <h3 className={styles.metricTitle}>{title}</h3>
        <div className={styles.metricValue}>
          {typeof value === 'number' ? (
            <CountUp
              start={0}
              end={value}
              duration={1.5}
              separator=","
              formattingFn={formatValue}
            />
          ) : (
            formatValue(value)
          )}
        </div>
        {subtitle && <p className={styles.metricSubtitle}>{subtitle}</p>}
      </div>
      
      {chartData && chartData.length > 0 && (
        <div className={styles.metricCardChart}>
          <div className={styles.chartContainer}>
            {/* Simple sparkline-style chart using SVG */}
            <svg width="100%" height="60" viewBox="0 0 300 60" className={styles.chartSvg}>
              <defs>
                <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={finalColor} stopOpacity="0.3"/>
                  <stop offset="100%" stopColor={finalColor} stopOpacity="0"/>
                </linearGradient>
              </defs>
              {(() => {
                const values = chartData.map(d => d.value);
                const maxValue = Math.max(...values);
                const minValue = Math.min(...values);
                const range = maxValue - minValue || 1;
                
                const points = chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 300;
                  const y = 60 - ((d.value - minValue) / range) * 50;
                  return `${x},${y}`;
                }).join(' ');
                
                const pathData = `M ${points.split(' ').map(p => p).join(' L ')} L 300,60 L 0,60 Z`;
                
                return (
                  <>
                    <path
                      d={pathData}
                      fill={`url(#gradient-${title.replace(/\s/g, '')})`}
                      stroke={finalColor}
                      strokeWidth="2"
                    />
                    <polyline
                      points={points}
                      fill="none"
                      stroke={finalColor}
                      strokeWidth="2"
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorfulMetricCard;