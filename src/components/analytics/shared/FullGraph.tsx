import React, { useState, useMemo } from 'react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import styles from './FullGraph.module.css';

// Register required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

interface FullGraphProps {
  id: string;
  title: string;
  subtitle?: string;
  data: Array<any>;
  type?: 'area' | 'line' | 'bar' | 'composed' | 'pie' | 'doughnut' | 'donut';
  lines?: Array<{
    dataKey: string;
    color: string;
    name: string;
    type?: 'line' | 'area' | 'bar';
    yAxisId?: 'left' | 'right';
    format?: 'currency' | 'number' | 'percentage';
  }>;
  showBrush?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  dateRange?: { start: Date; end: Date };
  onDateRangeChange?: (range: { start: Date; end: Date }) => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  customColors?: Record<string, string>;
}

const FullGraph: React.FC<FullGraphProps> = ({
  id,
  title,
  subtitle,
  data,
  type = 'area',
  lines = [{ dataKey: 'value', color: '#79d5e9', name: 'Value' }],
  showBrush = true,
  showGrid = true,
  showLegend = true,
  height = 400,
  dateRange,
  onDateRangeChange,
  onExport,
  onFullscreen,
  customColors
}) => {
  // Use the data passed from parent component - no internal filtering
  const filteredData = data || [];

  const formatAxisDate = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      if (isNaN(date.getTime())) return tickItem; // Return original if invalid date
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    } catch {
      return tickItem;
    }
  };

  const formatTooltipDate = (value: string) => {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return value; // Return original if invalid date
      return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return value;
    }
  };

  const formatValue = (value: number, format: string = 'currency') => {
    if (typeof value !== 'number') return value;
    if (format === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toFixed(0);
    } else if (format === 'percentage') {
      return `${value.toFixed(1)}%`;
    } else { // currency
      if (value >= 1000000) {
        return `£${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `£${(value / 1000).toFixed(1)}K`;
      }
      return `£${value.toFixed(0)}`;
    }
  };

  const renderChart = () => {
    // Handle pie/doughnut charts differently (including 'donut' as alias for 'doughnut')
    if (type === 'pie' || type === 'doughnut' || type === 'donut') {
      const pieData = {
        labels: filteredData?.map(item => item.name || item.date) || [],
        datasets: [{
          data: filteredData?.map(item => item[lines[0]?.dataKey || 'value']) || [],
          backgroundColor: [
            '#79d5e9',
            '#799de9', 
            '#79e9c5',
            '#FF9F00',
            '#C96868',
            '#A459D1',
            '#FFB84C',
            '#16B3AC',
            '#F266AB',
            '#A25772'
          ],
          borderWidth: 2,
          borderColor: '#1a1f2a'
        }]
      };

      const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: showLegend,
            position: 'right' as const,
            labels: {
              color: '#a0a0a0',
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: '#1a1f2a',
            titleColor: '#a0a0a0',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                const value = context.raw;
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                const format = lines[0]?.format || 'currency';
                return `${context.label}: ${formatValue(value, format)} (${percentage}%)`;
              }
            }
          },
        },
      };

      const ChartComponent = type === 'pie' ? Pie : Doughnut; // 'donut' is handled as 'doughnut'
      
      return (
        <div style={{ width: '100%', height: height }}>
          <ChartComponent data={pieData} options={pieOptions} />
        </div>
      );
    }

    // Original line/bar chart logic
    const chartData = {
      labels: filteredData?.map(item => item.name || item.date) || [],
      datasets: lines.map((line, index) => {
        const color = customColors?.[line.dataKey] || line.color;
        return {
          label: line.name,
          data: filteredData?.map(item => item[line.dataKey]) || [],
          borderColor: color,
          backgroundColor: line.type === 'bar' ? color : `${color}40`,
          fill: line.type === 'area',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
        };
      })
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegend,
          position: 'top' as const,
          labels: {
            color: '#a0a0a0',
            usePointStyle: true,
            pointStyle: 'line',
          }
        },
        tooltip: {
          backgroundColor: '#1a1f2a',
          titleColor: '#a0a0a0',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => {
              const line = lines[context.datasetIndex];
              return formatValue(context.raw, line?.format || 'currency');
            }
          }
        },
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: showGrid,
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: '#666',
            font: { size: 12 }
          }
        },
        y: {
          display: true,
          grid: {
            display: showGrid,
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: '#666',
            font: { size: 12 },
            callback: (value: any) => {
              const leftLine = lines.find(l => (l.yAxisId || 'left') === 'left');
              return formatValue(value, leftLine?.format || 'currency');
            }
          }
        },
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 4,
        },
      },
    };

    const ChartComponent = type === 'bar' ? Bar : Line;

    return (
      <div style={{ width: '100%', height: height }}>
        <ChartComponent data={chartData} options={chartOptions} />
      </div>
    );
  };

  return (
    <div className={styles.fullGraphContainer}>
      <div className={styles.fullGraphHeader}>
        <div className={styles.graphHeaderLeft}>
          <h2 className={styles.graphTitle}>{title}</h2>
          {subtitle && <p className={styles.graphSubtitle}>{subtitle}</p>}
        </div>
        <div className={styles.graphHeaderRight}>
          <div className={styles.graphActions}>
            {onExport && (
              <button 
                className={styles.graphActionButton} 
                onClick={onExport} 
                title="Export"
                aria-label="Export graph data"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path d="M10 3v10m0 0l-3-3m3 3l3-3M5 17h10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            {onFullscreen && (
              <button 
                className={styles.graphActionButton} 
                onClick={onFullscreen} 
                title="Fullscreen"
                aria-label="Toggle fullscreen view"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path d="M4 7V4h3m9 0h-3v3m0 9v-3h3m-9 3H4v-3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={styles.fullGraphContent}>
        {filteredData && filteredData.length > 0 ? (
          renderChart()
        ) : (
          <div style={{
            height: height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px'
          }}>
            No data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
};

export default FullGraph;