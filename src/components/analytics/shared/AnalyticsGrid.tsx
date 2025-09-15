import React from 'react';
import styles from './AnalyticsGrid.module.css';

export interface AnalyticsGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4 | 'auto';
  gap?: 'small' | 'medium' | 'large';
  responsive?: boolean;
}

const AnalyticsGrid: React.FC<AnalyticsGridProps> = ({
  children,
  className = '',
  columns = 2,
  gap = 'medium',
  responsive = true
}) => {
  
  const getGridClass = () => {
    const baseClass = styles.grid;
    const columnClass = columns === 'auto' ? styles.gridAuto : styles[`grid${columns}Col`];
    const gapClass = styles[`gap${gap.charAt(0).toUpperCase() + gap.slice(1)}`];
    const responsiveClass = responsive ? styles.responsive : '';
    
    return `${baseClass} ${columnClass} ${gapClass} ${responsiveClass} ${className}`.trim();
  };

  return (
    <div className={getGridClass()}>
      {children}
    </div>
  );
};

// Grid item wrapper component
export interface GridItemProps {
  children: React.ReactNode;
  colSpan?: 1 | 2 | 3 | 4 | 'full';
  rowSpan?: 1 | 2 | 3 | 4;
  className?: string;
}

export const GridItem: React.FC<GridItemProps> = ({
  children,
  colSpan = 1,
  rowSpan = 1,
  className = ''
}) => {
  
  const getItemClass = () => {
    const baseClass = styles.gridItem;
    const colSpanClass = colSpan === 'full' ? styles.colSpanFull : styles[`colSpan${colSpan}`];
    const rowSpanClass = rowSpan > 1 ? styles[`rowSpan${rowSpan}`] : '';
    
    return `${baseClass} ${colSpanClass} ${rowSpanClass} ${className}`.trim();
  };

  return (
    <div className={getItemClass()}>
      {children}
    </div>
  );
};

export default AnalyticsGrid;