/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React from 'react';
import { FaCog, FaEdit, FaSyncAlt, FaCalendarAlt, FaEye, FaCompress } from 'react-icons/fa';
import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  title: string;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  onRefresh: () => void;
  isEditMode: boolean;
  onEditModeToggle: () => void;
  onTitleChange?: (newTitle: string) => void;
  metricDisplayMode?: 'full' | 'compact';
  onMetricDisplayModeChange?: (value: 'full' | 'compact') => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  dateRange,
  onDateRangeChange,
  onRefresh,
  isEditMode,
  onEditModeToggle,
  onTitleChange,
  metricDisplayMode,
  onMetricDisplayModeChange
}) => {
  const [showEditOptions, setShowEditOptions] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(title);

  React.useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  const handleTitleClick = () => {
    if (onTitleChange) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = () => {
    if (onTitleChange && editedTitle.trim() !== title) {
      onTitleChange(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle(title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

  return (
    <div className={styles.dashboardHeaderBar}>
      <div className={styles.headerMain}>
        {/* Title Section */}
        <div className={styles.headerLeft}>
          {isEditingTitle ? (
            <div className={styles.titleEditContainer}>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSave}
                className={styles.titleInput}
                autoFocus
              />
            </div>
          ) : (
            <h1 
              className={`${styles.headerTitle} ${onTitleChange ? styles.editableTitle : ''}`}
              onClick={handleTitleClick}
              title={onTitleChange ? "Click to edit title" : ""}
            >
              {title}
              {onTitleChange && <FaEdit className={styles.editIcon} />}
            </h1>
          )}
          <span className={styles.currentDate}>{new Date().toLocaleDateString('en-GB', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>

        {/* Controls Section */}
        <div className={styles.headerControls}>
        {/* Date Range Selector */}
        <div className={styles.dateRangeSelector}>
          <FaCalendarAlt className={styles.controlIcon} />
          <select 
            value={dateRange} 
            onChange={(e) => onDateRangeChange(e.target.value)}
            className={styles.dateSelect}
          >
            <option value="7_days">Last 7 Days</option>
            <option value="30_days">Last 30 Days</option>
            <option value="90_days">Last 90 Days</option>
            <option value="last_month">Last Month</option>
            <option value="quarter">This Quarter</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
            <option value="12_months">Last 12 Months</option>
          </select>
        </div>

        {/* Edit Mode Toggle */}
        <button 
          className={`${styles.controlBtn} ${isEditMode ? styles.active : ''}`}
          onClick={() => {
            onEditModeToggle();
            setShowEditOptions(isEditMode ? false : showEditOptions);
          }}
          title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
        >
          <FaEdit />
          <span>{isEditMode ? 'Done' : 'Edit'}</span>
        </button>

        {/* Refresh Button */}
        <button 
          className={styles.controlBtn} 
          onClick={onRefresh}
          title="Refresh Data"
        >
          <FaSyncAlt />
          <span>Refresh</span>
        </button>
        </div>
      </div>

    </div>
  );
};

export default DashboardHeader;