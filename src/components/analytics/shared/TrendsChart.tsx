import React from 'react';
import {
  LineChart, Line, AreaChart, Area, ResponsiveContainer, 
  XAxis, YAxis, Tooltip, Legend, Brush
} from 'recharts';
import styles from './TrendsChart.module.css';

export interface TrendDataPoint {
  date: string;
  [key: string]: any;
}

export interface TrendLine {
  dataKey: string;
  name: string;
  color: string;
  type?: 'line' | 'area';
  strokeWidth?: number;
  strokeDasharray?: string;
}

export interface TrendsChartProps {
  id?: string;
  title: string;
  subtitle?: string;
  data: TrendDataPoint[];
  lines: TrendLine[];
  height?: number;
  showBrush?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
  onClick?: () => void;
  className?: string;
}

const TrendsChart: React.FC<TrendsChartProps> = ({
  id = 'trends-chart',
  title,
  subtitle,
  data,
  lines,
  height = 400,
  showBrush = false,
  showGrid = true,
  showLegend = true,
  loading = false,
  error = null,
  emptyMessage = 'No trend data available',
  formatValue = (value) => value.toLocaleString(),
  onClick,
  className = ''
}) => {

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p 
              key={index} 
              className={styles.tooltipValue}
              style={{ color: entry.color }}
            >
              {entry.name}: {formatValue(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render content
  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading trend data...</span>
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

    if (data.length === 0) {
      return (
        <div className={styles.emptyState}>
          <span>📈 {emptyMessage}</span>
        </div>
      );
    }

    // Determine if we need area chart
    const hasAreaLines = lines.some(line => line.type === 'area');
    
    if (hasAreaLines) {
      return (
        <ResponsiveContainer width="100%" height={height - 60}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 60 : 0 }}>
            <defs>
              {lines.filter(line => line.type === 'area').map((line, index) => (
                <linearGradient key={`gradient-${line.dataKey}`} id={`gradient-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={line.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={line.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            
            <XAxis 
              dataKey="date" 
              stroke="#666"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#666"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatValue}
            />
            
            {showGrid && (
              <defs>
                <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                  <path d="M 0 0 L 0 1 M 0 0 L 1 0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                </pattern>
              </defs>
            )}
            
            <Tooltip content={<CustomTooltip />} />
            
            {showLegend && (
              <Legend 
                verticalAlign="top" 
                height={36}
                iconType="line"
                wrapperStyle={{
                  fontSize: '12px',
                  color: '#a0a0a0',
                  paddingBottom: '20px'
                }}
              />
            )}
            
            {lines.map((line) => {
              if (line.type === 'area') {
                return (
                  <Area
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    stroke={line.color}
                    fill={`url(#gradient-${line.dataKey})`}
                    strokeWidth={line.strokeWidth || 2}
                    strokeDasharray={line.strokeDasharray}
                  />
                );
              } else {
                return (
                  <Line
                    key={line.dataKey}
                    type="monotone"
                    dataKey={line.dataKey}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth || 2}
                    strokeDasharray={line.strokeDasharray}
                    dot={{ fill: line.color, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                );
              }
            })}
            
            {showBrush && (
              <Brush 
                dataKey="date" 
                height={30} 
                stroke="#79d5e9"
                fill="rgba(121, 213, 233, 0.1)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Regular line chart
    return (
      <ResponsiveContainer width="100%" height={height - 60}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: showBrush ? 60 : 0 }}>
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#666"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatValue}
          />
          
          {showGrid && (
            <defs>
              <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                <path d="M 0 0 L 0 1 M 0 0 L 1 0" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
              </pattern>
            </defs>
          )}
          
          <Tooltip content={<CustomTooltip />} />
          
          {showLegend && (
            <Legend 
              verticalAlign="top" 
              height={36}
              iconType="line"
              wrapperStyle={{
                fontSize: '12px',
                color: '#a0a0a0',
                paddingBottom: '20px'
              }}
            />
          )}
          
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              strokeWidth={line.strokeWidth || 2}
              strokeDasharray={line.strokeDasharray}
              dot={{ fill: line.color, r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
          
          {showBrush && (
            <Brush 
              dataKey="date" 
              height={30} 
              stroke="#79d5e9"
              fill="rgba(121, 213, 233, 0.1)"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className={`${styles.container} ${className}`} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default TrendsChart;