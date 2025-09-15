import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  Download,
  X,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { pricelistProcessingService } from '../../services/pricelistProcessingService';
import styles from './PricelistUpload.module.css';

interface PricelistFile {
  id: string;
  file: File;
  supplier: string;
  brand: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  preview?: any[];
  changes?: PriceChange[];
  error?: string;
}

interface PriceChange {
  sku: string;
  product_name: string;
  current_price?: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  action: 'update' | 'create';
  confidence: number;
}

interface PricelistUploadProps {
  onClose: () => void;
}

const PricelistUpload: React.FC<PricelistUploadProps> = ({ onClose }) => {
  const [files, setFiles] = useState<PricelistFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  }, []);

  const handleFiles = async (fileList: File[]) => {
    const validFiles = fileList.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return ['csv', 'xlsx', 'xls', 'pdf'].includes(extension || '');
    });

    for (const file of validFiles) {
      const fileId = Date.now().toString() + Math.random().toString(36);
      const pricelistFile: PricelistFile = {
        id: fileId,
        file,
        supplier: detectSupplier(file.name),
        brand: detectBrand(file.name),
        status: 'uploading'
      };

      setFiles(prev => [...prev, pricelistFile]);

      try {
        // Process the file
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'processing' } : f
        ));

        const result = await pricelistProcessingService.processFile(file);
        
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'ready',
            preview: result.preview,
            changes: result.changes
          } : f
        ));

      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed'
          } : f
        ));
      }
    }
  };

  const detectSupplier = (filename: string): string => {
    const name = filename.toLowerCase();
    if (name.includes('rader')) return 'Rader';
    if (name.includes('elvang')) return 'Elvang';
    if (name.includes('myflame') || name.includes('my-flame')) return 'My Flame';
    if (name.includes('remember')) return 'Remember';
    if (name.includes('relaxound')) return 'Relaxound';
    if (name.includes('gefu')) return 'GEFU';
    return 'Unknown';
  };

  const detectBrand = (filename: string): string => {
    // Same logic as supplier for now, but could be different
    return detectSupplier(filename);
  };

  const handleApplyChanges = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.changes) return;

    setApplying(fileId);
    try {
      await pricelistProcessingService.applyChanges(file.changes);
      
      // Remove the file from the list after successful application
      setFiles(prev => prev.filter(f => f.id !== fileId));
      
    } catch (error) {
      console.error('Failed to apply changes:', error);
      // You might want to show an error message here
    } finally {
      setApplying(null);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const selectedFileData = selectedFile ? files.find(f => f.id === selectedFile) : null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <Sparkles className={styles.headerIcon} />
            <h2>Supplier Pricelist Upload</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {selectedFile ? (
            // Preview Mode
            <div className={styles.previewMode}>
              <div className={styles.previewHeader}>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className={styles.backButton}
                >
                  ← Back to Upload
                </button>
                <h3>{selectedFileData?.file.name}</h3>
              </div>
              
              {selectedFileData && (
                <PriceChangePreview 
                  file={selectedFileData}
                  onApply={() => handleApplyChanges(selectedFile)}
                  applying={applying === selectedFile}
                />
              )}
            </div>
          ) : (
            // Upload Mode
            <>
              <div 
                className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={48} className={styles.uploadIcon} />
                <h3>Drop supplier pricelists here</h3>
                <p>Supports CSV, Excel (.xlsx, .xls), and PDF files</p>
                <p className={styles.aiNote}>
                  <Sparkles size={16} />
                  AI will automatically detect supplier, extract products, and match to your inventory
                </p>
                
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileInput}
                  className={styles.fileInput}
                  id="file-input"
                />
                <label htmlFor="file-input" className={styles.uploadButton}>
                  Choose Files
                </label>
              </div>

              {files.length > 0 && (
                <div className={styles.fileList}>
                  <h3>Processing Files</h3>
                  {files.map(file => (
                    <FileStatus 
                      key={file.id}
                      file={file}
                      onPreview={() => setSelectedFile(file.id)}
                      onRemove={() => removeFile(file.id)}
                      onApply={() => handleApplyChanges(file.id)}
                      applying={applying === file.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const FileStatus: React.FC<{
  file: PricelistFile;
  onPreview: () => void;
  onRemove: () => void;
  onApply: () => void;
  applying: boolean;
}> = ({ file, onPreview, onRemove, onApply, applying }) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case 'uploading':
        return <RefreshCw size={16} className={styles.spinning} />;
      case 'processing':
        return <RefreshCw size={16} className={styles.spinning} />;
      case 'ready':
        return <CheckCircle size={16} className={styles.successIcon} />;
      case 'error':
        return <AlertCircle size={16} className={styles.errorIcon} />;
    }
  };

  const getStatusText = () => {
    switch (file.status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'AI processing...';
      case 'ready':
        return `Ready - ${file.changes?.length || 0} changes found`;
      case 'error':
        return file.error || 'Processing failed';
    }
  };

  return (
    <div className={`${styles.fileItem} ${styles[file.status]}`}>
      <div className={styles.fileInfo}>
        <FileText size={20} className={styles.fileIcon} />
        <div className={styles.fileDetails}>
          <div className={styles.fileName}>{file.file.name}</div>
          <div className={styles.fileSupplier}>{file.supplier} • {file.brand}</div>
          <div className={styles.fileStatus}>
            {getStatusIcon()}
            {getStatusText()}
          </div>
        </div>
      </div>

      <div className={styles.fileActions}>
        {file.status === 'ready' && (
          <>
            <button 
              onClick={onPreview}
              className={styles.actionButton}
              title="Preview Changes"
            >
              <Eye size={16} />
            </button>
            <button 
              onClick={onApply}
              className={styles.applyButton}
              disabled={applying}
              title="Apply Changes"
            >
              {applying ? <RefreshCw size={16} className={styles.spinning} /> : <CheckCircle size={16} />}
              {applying ? 'Applying...' : 'Apply'}
            </button>
          </>
        )}
        
        <button 
          onClick={onRemove}
          className={styles.removeButton}
          title="Remove"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

const PriceChangePreview: React.FC<{
  file: PricelistFile;
  onApply: () => void;
  applying: boolean;
}> = ({ file, onApply, applying }) => {
  if (!file.changes) return null;

  const totalChanges = file.changes.length;
  const priceIncreases = file.changes.filter(c => c.price_change > 0).length;
  const priceDecreases = file.changes.filter(c => c.price_change < 0).length;
  const newProducts = file.changes.filter(c => c.action === 'create').length;

  return (
    <div className={styles.preview}>
      <div className={styles.previewSummary}>
        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{totalChanges}</div>
            <div className={styles.summaryLabel}>Total Changes</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{newProducts}</div>
            <div className={styles.summaryLabel}>New Products</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{priceIncreases}</div>
            <div className={styles.summaryLabel}>Price Increases</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryValue}>{priceDecreases}</div>
            <div className={styles.summaryLabel}>Price Decreases</div>
          </div>
        </div>
        
        <button 
          onClick={onApply}
          className={styles.applyAllButton}
          disabled={applying}
        >
          {applying ? <RefreshCw size={16} className={styles.spinning} /> : <CheckCircle size={16} />}
          {applying ? 'Applying Changes...' : 'Apply All Changes'}
        </button>
      </div>

      <div className={styles.changesList}>
        {file.changes.map((change, index) => (
          <div key={index} className={`${styles.changeItem} ${styles[change.action]}`}>
            <div className={styles.changeProduct}>
              <div className={styles.changeSku}>{change.sku}</div>
              <div className={styles.changeName}>{change.product_name}</div>
            </div>
            
            <div className={styles.changePrices}>
              {change.action === 'update' && change.current_price && (
                <>
                  <span className={styles.currentPrice}>£{change.current_price.toFixed(2)}</span>
                  <span className={styles.arrow}>→</span>
                </>
              )}
              <span className={styles.newPrice}>£{change.new_price.toFixed(2)}</span>
              {change.action === 'update' && (
                <span className={`${styles.changeAmount} ${change.price_change > 0 ? styles.increase : styles.decrease}`}>
                  {change.price_change > 0 ? '+' : ''}£{change.price_change.toFixed(2)} ({change.price_change_percent.toFixed(1)}%)
                </span>
              )}
            </div>
            
            <div className={styles.changeAction}>
              <span className={`${styles.actionBadge} ${styles[change.action]}`}>
                {change.action === 'create' ? 'New' : 'Update'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricelistUpload;