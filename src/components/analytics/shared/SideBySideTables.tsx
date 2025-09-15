import React from 'react';
import DataTable from './DataTable';
import type { TableColumn } from './DataTable';
import styles from './SideBySideTables.module.css';

export interface TableConfig<T = any> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    width?: string;
    render?: (item: T, index?: number) => React.ReactNode;
  }>;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  showIndex?: boolean;
  maxRows?: number;
}

export interface SideBySideTablesProps {
  leftTable: TableConfig;
  rightTable: TableConfig;
  className?: string;
}

const SideBySideTables: React.FC<SideBySideTablesProps> = ({
  leftTable,
  rightTable,
  className = ''
}) => {
  
  const renderTable = (config: TableConfig, side: 'left' | 'right') => {
    const {
      title,
      subtitle,
      data,
      columns,
      loading = false,
      error = null,
      emptyMessage = 'No data available',
      onRowClick,
      showIndex = false,
      maxRows
    } = config;

    // Process data
    const processedData = maxRows ? data.slice(0, maxRows) : data;

    // Prepare columns with optional index
    const tableColumns: TableColumn<any>[] = [
      ...(showIndex ? [{
        key: 'index',
        header: '#',
        width: '40px',
        className: styles.indexColumn,
        render: (_: any, index?: number) => (
          <span className={styles.indexNumber}>{(index || 0) + 1}</span>
        )
      }] : []),
      ...columns.map(col => ({
        key: col.key,
        header: col.header,
        width: col.width,
        render: col.render
      }))
    ];

    return (
      <div className={`${styles.tableContainer} ${side === 'left' ? styles.leftTable : styles.rightTable}`}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>{title}</h3>
          {subtitle && <p className={styles.tableSubtitle}>{subtitle}</p>}
        </div>
        
        <div className={styles.tableContent}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingSpinner}></div>
              <span>Loading data...</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <span>⚠️ {error}</span>
            </div>
          ) : processedData.length === 0 ? (
            <div className={styles.emptyState}>
              <span>📊 {emptyMessage}</span>
            </div>
          ) : (
            <DataTable
              columns={tableColumns}
              data={processedData}
              keyExtractor={(item: any) => item.id || item.name || Math.random().toString()}
              onRowClick={onRowClick}
              className={styles.dataTable}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {renderTable(leftTable, 'left')}
      {renderTable(rightTable, 'right')}
    </div>
  );
};

export default SideBySideTables;