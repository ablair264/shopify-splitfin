import React from 'react';
import CountUp from 'react-countup';
import styles from './CompactCard.module.css';

export interface CompactCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  format?: 'currency' | 'number' | 'percentage';
  color?: string;
  onClick?: () => void;
}

const CompactCard: React.FC<CompactCardProps> = ({
  title,
  value,
  icon,
  trend,
  format = 'number',
  color = '#79d5e9',
  onClick
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

  return (
    <div 
      className={styles.compactCard} 
      onClick={onClick}
      style={{ 
        borderLeftColor: color,
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid'
      }}
    >
      <div className={styles.compactIcon} style={{ backgroundColor: color }}>
        {icon || '💰'}
      </div>
      <div className={styles.compactContent}>
        <div className={styles.compactValue}>
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
};

export default CompactCard;