import React from 'react';
import styles from './CardTable.module.css';

interface TableCardColumn {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableCardProps {
  id: string;
  title: string;
  subtitle?: string;
  data: Array<any>;
  columns: TableCardColumn[];
  getAvatar?: (row: any) => string | null;
  valueColor?: (value: any, row: any) => string;
  maxRows?: number;
}

const TableCard: React.FC<TableCardProps> = ({
  id,
  title,
  subtitle,
  data,
  columns,
  getAvatar,
  valueColor,
  maxRows = 6
}) => {
  const displayData = data.slice(0, maxRows);
  
  // Add specific class for Most Orders (Brands) table
  const containerClasses = [
    styles.cardTableContainer,
    title.includes('Most Orders') && title.includes('Brands') ? styles.mostOrdersBrands : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className={styles.cardTableHeader}>
        <div className={styles.tableHeaderLeft}>
          <h3 className={styles.tableTitle}>{title}</h3>
          {subtitle && <p className={styles.tableSubtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={styles.cardTableContent}>
        <div className={styles.tableContent}>
          {/* Table header */}
          <div className={styles.tableHeader}>
            {columns.map((column) => (
              <div 
                key={column.key} 
                className={styles.tableHeaderCell}
                style={{ 
                  textAlign: column.align || 'left',
                  width: column.width 
                }}
              >
                {column.label}
              </div>
            ))}
          </div>
          
          {/* Table rows */}
          {displayData.map((row, index) => (
            <div key={`${id}-row-${index}`} className={styles.tableRow}>
              {columns.map((column) => (
                <div 
                  key={column.key}
                  className={styles.tableCell}
                  style={{ 
                    textAlign: column.align || 'left',
                    width: column.width 
                  }}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </div>
              ))}
            </div>
          ))}
        </div>
        {displayData.length === 0 && (
          <div className={styles.emptyState}>
            <p>No data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableCard;