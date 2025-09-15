import React from 'react';
import styles from './CleanTableCard.module.css';

interface TableColumn {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

interface CleanTableCardProps {
  data: Array<any>;
  columns: TableColumn[];
  backgroundColor?: string;
  textColor?: string;
  headerColor?: string;
  borderColor?: string;
  maxRows?: number;
}

const CleanTableCard: React.FC<CleanTableCardProps> = ({
  data,
  columns,
  backgroundColor = '#1a1f2a',
  textColor = '#ffffff',
  headerColor = '#79d5e9',
  borderColor = 'rgba(255, 255, 255, 0.1)',
  maxRows = 10
}) => {
  const displayData = data.slice(0, maxRows);

  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-';
    
    switch (format) {
      case 'currency':
        return typeof value === 'number' ? `£${value.toLocaleString()}` : value;
      case 'percentage':
        return typeof value === 'number' ? `${value}%` : value;
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'date':
        return value instanceof Date ? value.toLocaleDateString() : value;
      default:
        return value;
    }
  };

  return (
    <div 
      className={styles.tableContainer}
      style={{ 
        backgroundColor,
        color: textColor,
        borderColor
      }}
    >
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((column) => (
              <th
                key={column.key}
                className={styles.headerCell}
                style={{
                  width: column.width,
                  textAlign: column.align || 'left',
                  color: headerColor
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, index) => (
            <tr key={index} className={styles.dataRow}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={styles.dataCell}
                  style={{
                    textAlign: column.align || 'left'
                  }}
                >
                  {formatValue(row[column.key], column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {displayData.length === 0 && (
        <div className={styles.emptyState}>
          <p>No data available</p>
        </div>
      )}
    </div>
  );
};

export default CleanTableCard;