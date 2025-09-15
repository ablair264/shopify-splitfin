import React from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ResponsiveContainer, XAxis, YAxis, Tooltip
} from 'recharts';
import CountUp from 'react-countup';
import './DashboardMetricCard.css';

export interface DashboardMetricCardProps {
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
  displayMode?: 'full' | 'compact';
  design?: 'variant1' | 'variant2' | 'variant3';
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  onOptionsClick?: () => void;
  onVariantChange?: (variant: 'variant1' | 'variant2' | 'variant3') => void;
}

const DashboardMetricCard: React.FC<DashboardMetricCardProps> = ({
  id,
  title,
  value,
  subtitle,
  trend,
  chartData = [],
  format = 'number',
  displayMode = 'full',
  design = 'variant1',
  icon,
  color = '#79d5e9',
  onClick,
  onOptionsClick,
  onVariantChange
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

  const renderVariantSelector = () => {
    if (!onVariantChange) return null;
    
    return (
      <div className="dashboard-variant-selector">
        <button
          className={`dashboard-variant-button ${design === 'variant1' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange('variant1');
          }}
          title="Area Chart"
        >
          1
        </button>
        <button
          className={`dashboard-variant-button ${design === 'variant2' ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange('variant2');
          }}
          title="Line Chart"
        >
          2
        </button>
        <button
          className={`dashboard-variant-button ${design === 'variant3' ? 'active' : ''}`}
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
    if (!chartData || chartData.length === 0) return null;

    const ChartComponent = design === 'variant3' ? BarChart : design === 'variant2' ? LineChart : AreaChart;
    const DataComponent = design === 'variant3' ? Bar : design === 'variant2' ? Line : Area;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData} {...chartConfig}>
          <defs>
            <linearGradient id={`dashboard-gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
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
              format === 'percentage' ? `${value.toFixed(1)}%` :
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
              fill={`url(#dashboard-gradient-${id})`}
              strokeWidth={2}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  if (displayMode === 'compact') {
    return (
      <div className="dashboard-metric-card-compact" onClick={onClick}>
        {icon && (
          <div className="dashboard-compact-icon" style={{ backgroundColor: `${color}15` }}>
            {icon}
          </div>
        )}
        <div className="dashboard-compact-content">
          <div className="dashboard-compact-value" style={{ color }}>
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
          <div className="dashboard-compact-title">{title}</div>
        </div>
        {trend && (
          <div className={`dashboard-compact-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
            <span className="dashboard-trend-icon">{trend.isPositive ? '↑' : '↓'}</span>
            <span className="dashboard-trend-value">{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`dashboard-metric-card-full dashboard-metric-card-${design}`} 
      onClick={onClick}
      style={{ 
        borderTopColor: design === 'variant3' ? color : undefined,
        borderLeftColor: design === 'variant2' ? color : undefined,
        borderColor: design === 'variant1' ? color : undefined,
        background: design === 'variant1' ? `linear-gradient(135deg, var(--dashboard-background-white) 0%, ${color}15 100%)` : undefined
      }}
    >
      <div className="dashboard-card-header">
        <div className="dashboard-header-left">
          <h3 className="dashboard-card-title">{title}</h3>
        </div>
        <div className="dashboard-header-right">
          {trend && (
            <div className={`dashboard-trend-indicator ${trend.isPositive ? 'positive' : 'negative'}`}>
              <span className="dashboard-trend-icon">{trend.isPositive ? '↑' : '↓'}</span>
              <span className="dashboard-trend-value">{Math.abs(trend.value)}%</span>
            </div>
          )}
          {onOptionsClick && (
            <button className="dashboard-options-button" onClick={(e) => {
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
      
      <div className="dashboard-card-value">
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
      
      {subtitle && <div className="dashboard-card-subtitle">{subtitle}</div>}
      
    </div>
  );
};

export default DashboardMetricCard;