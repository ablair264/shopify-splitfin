import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImageCard.module.css';
import { ImageItem } from './types';

interface ImageCardProps {
  image: ImageItem;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  brandColor: string;
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  isSelected,
  onSelect,
  onDelete,
  brandColor
}) => {
  const [imageError, setImageError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copying, setCopying] = useState(false);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className={`${styles.imageCard} ${isSelected ? styles.selected : ''}`}
    >
      {/* Selection checkbox */}
      <div 
        className={styles.selectionCheckbox}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
        />
      </div>

      {/* Brand tag */}
      <div 
        className={styles.brandTag}
        style={{ '--brand-color': brandColor } as React.CSSProperties}
      >
        {image.brand_name}
      </div>

      {/* Image preview with uniform aspect ratio */}
      <div className={styles.imagePreview}>
        {!imageError ? (
          <img
            src={image.url}
            alt={image.name}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>🖼️</span>
            <p>Unable to load image</p>
          </div>
        )}
      </div>

      {/* Hover overlay with actions */}
      <div className={styles.hoverOverlay}>
        <div className={styles.hoverActions}>
          <button 
            className={styles.hoverActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            title="Download"
          >
            <span>⬇</span>
          </button>
          <button 
            className={styles.hoverActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleCopyUrl();
            }}
            title="Copy URL"
          >
            <span>{copying ? '✓' : '📋'}</span>
          </button>
          <button 
            className={`${styles.hoverActionBtn} ${styles.infoBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            title="View Details"
          >
            <span>ℹ️</span>
          </button>
          <button 
            className={`${styles.hoverActionBtn} ${styles.deleteBtn}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <span>🗑️</span>
          </button>
        </div>
      </div>

      {/* Image name */}
      <div className={styles.imageName} title={image.name}>
        {image.name}
      </div>

      {/* Image meta info */}
      <div className={styles.imageMeta}>
        <span className={styles.metaItem}>
          {formatFileSize(image.size)}
        </span>
        <span className={styles.metaItem}>
          {new Date(image.uploaded_at).toLocaleDateString()}
        </span>
      </div>

      {/* Expanded details modal - rendered as portal */}
      {showDetails && createPortal(
        <div 
          className={styles.detailsModal} 
          onClick={() => setShowDetails(false)}
        >
          <div 
            className={styles.detailsContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.detailsHeader}>
              <h3>Image Details</h3>
              <button 
                className={styles.closeDetailsBtn}
                onClick={() => setShowDetails(false)}
              >
                ✕
              </button>
            </div>
            
            <div className={styles.detailsBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Filename:</span>
                <span className={styles.detailValue}>{image.name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Brand:</span>
                <span className={styles.detailValue}>{image.brand_name}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Size:</span>
                <span className={styles.detailValue}>{formatFileSize(image.size)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Type:</span>
                <span className={styles.detailValue}>{image.content_type}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Uploaded:</span>
                <span className={styles.detailValue}>{formatDate(image.uploaded_at)}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>ID:</span>
                <span className={styles.detailValue}>{image.id}</span>
              </div>
              
              <div className={styles.urlRow}>
                <label className={styles.detailLabel}>URL:</label>
                <div className={styles.urlContainer}>
                  <input
                    type="text"
                    value={image.url}
                    readOnly
                    className={styles.urlInput}
                  />
                  <button
                    className={styles.copyUrlBtn}
                    onClick={handleCopyUrl}
                  >
                    {copying ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ImageCard;
