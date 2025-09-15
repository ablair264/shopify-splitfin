import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Download,
  Trash2,
  Sparkles,
  Zap
} from 'lucide-react';
import { 
  imageProcessingService, 
  BatchUploadProgress, 
  ImageProcessingResult 
} from '../../services/imageProcessingService';
import { supabase } from '../../services/supabaseService';
import styles from './BatchImageUpload.module.css';

interface Brand {
  id: string;
  brand_name: string;
}

interface BatchImageUploadProps {
  companyId: string;
  onClose: () => void;
  onComplete?: (results: ImageProcessingResult[]) => void;
}

const BatchImageUpload: React.FC<BatchImageUploadProps> = ({
  companyId,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<'select-brand' | 'upload-files' | 'processing' | 'results'>('select-brand');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchUploadProgress>({
    total: 0,
    processed: 0,
    current: '',
    results: [],
    errors: []
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBrands();
  }, [companyId]);

  const loadBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('brand_name');

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error loading brands:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startProcessing = async () => {
    if (!selectedBrand || selectedFiles.length === 0) return;

    setProcessing(true);
    setStep('processing');

    try {
      const finalProgress = await imageProcessingService.processBatchImages(
        selectedFiles,
        companyId,
        selectedBrand.id,
        (currentProgress) => {
          setProgress({ ...currentProgress });
        }
      );

      setProgress(finalProgress);
      setStep('results');

      if (onComplete) {
        onComplete(finalProgress.results);
      }
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadResults = () => {
    const csvContent = [
      'Original Filename,Final Filename,Matched SKU,Product Type,Detected Color,Confidence,Success,Error',
      ...progress.results.map(result => 
        `"${result.originalFilename}","${result.finalFilename}","${result.matchedSku || ''}","${result.productType || ''}","${result.detectedColor || ''}",${result.confidence || 0},${result.success},"${result.error || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-processing-results-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderBrandSelection = () => (
    <div className={styles.step}>
      <div className={styles.header}>
        <h2>🏷️ Select Brand</h2>
        <p>Choose the brand for your image uploads</p>
      </div>

      <div className={styles.brandGrid}>
        {brands.map(brand => (
          <div
            key={brand.id}
            className={`${styles.brandCard} ${selectedBrand?.id === brand.id ? styles.selected : ''}`}
            onClick={() => setSelectedBrand(brand)}
          >
            <div className={styles.brandIcon}>
              <ImageIcon size={24} />
            </div>
            <span className={styles.brandName}>{brand.brand_name}</span>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button className={styles.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button 
          className={styles.btnPrimary}
          onClick={() => setStep('upload-files')}
          disabled={!selectedBrand}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderFileUpload = () => (
    <div className={styles.step}>
      <div className={styles.header}>
        <h2>📁 Upload Images</h2>
        <p>Upload images for <strong>{selectedBrand?.brand_name}</strong></p>
      </div>

      <div 
        className={styles.dropZone}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={48} />
        <h3>Drag & drop images here</h3>
        <p>or click to browse files</p>
        <small>Supports: JPG, PNG, WebP, GIF</small>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {selectedFiles.length > 0 && (
        <div className={styles.fileList}>
          <h3>Selected Files ({selectedFiles.length})</h3>
          <div className={styles.files}>
            {selectedFiles.map((file, index) => (
              <div key={index} className={styles.fileItem}>
                <div className={styles.fileInfo}>
                  <ImageIcon size={16} />
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                </div>
                <button
                  className={styles.removeButton}
                  onClick={() => removeFile(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.processingInfo}>
        <h3>🤖 AI Processing Pipeline:</h3>
        <div className={styles.pipeline}>
          <div className={styles.pipelineStep}>
            <Zap size={20} />
            <div>
              <strong>SKU Matching</strong>
              <p>Smart filename analysis to match product SKUs</p>
            </div>
          </div>
          <div className={styles.pipelineStep}>
            <Sparkles size={20} />
            <div>
              <strong>WebP Conversion</strong>
              <p>Optimized format for better performance</p>
            </div>
          </div>
          <div className={styles.pipelineStep}>
            <Eye size={20} />
            <div>
              <strong>AI Analysis</strong>
              <p>Product type and color detection</p>
            </div>
          </div>
          <div className={styles.pipelineStep}>
            <Upload size={20} />
            <div>
              <strong>Cloud Storage</strong>
              <p>Organized by brand in Supabase storage</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.btnSecondary} 
          onClick={() => setStep('select-brand')}
        >
          Back
        </button>
        <button 
          className={styles.btnPrimary}
          onClick={startProcessing}
          disabled={selectedFiles.length === 0}
        >
          🚀 Process {selectedFiles.length} Images
        </button>
      </div>
    </div>
  );

  const renderProcessing = () => (
    <div className={styles.step}>
      <div className={styles.header}>
        <h2>🤖 AI Processing in Progress</h2>
        <p>Processing images with AI-powered analysis...</p>
      </div>

      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${(progress.processed / progress.total) * 100}%` }}
          />
        </div>
        
        <div className={styles.progressStats}>
          <span>{progress.processed} / {progress.total} processed</span>
          <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
        </div>

        {progress.current && (
          <div className={styles.currentFile}>
            <span>Processing: <strong>{progress.current}</strong></span>
          </div>
        )}
      </div>

      <div className={styles.processingSteps}>
        <div className={styles.stepIndicator}>
          <CheckCircle className={styles.stepComplete} size={20} />
          <span>SKU Matching & Filename Generation</span>
        </div>
        <div className={styles.stepIndicator}>
          <CheckCircle className={styles.stepComplete} size={20} />
          <span>WebP Conversion & Optimization</span>
        </div>
        <div className={styles.stepIndicator}>
          <CheckCircle className={styles.stepComplete} size={20} />
          <span>AI Product Analysis</span>
        </div>
        <div className={styles.stepIndicator}>
          <CheckCircle className={styles.stepComplete} size={20} />
          <span>Cloud Storage Upload</span>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    const successCount = progress.results.filter(r => r.success).length;
    const failureCount = progress.results.filter(r => !r.success).length;
    
    return (
      <div className={styles.step}>
        <div className={styles.header}>
          <h2>✅ Processing Complete!</h2>
          <p>Processed {progress.total} images for <strong>{selectedBrand?.brand_name}</strong></p>
        </div>

        <div className={styles.resultsSummary}>
          <div className={styles.summaryCard}>
            <CheckCircle className={styles.successIcon} size={24} />
            <div>
              <span className={styles.summaryCount}>{successCount}</span>
              <span className={styles.summaryLabel}>Successful</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <XCircle className={styles.errorIcon} size={24} />
            <div>
              <span className={styles.summaryCount}>{failureCount}</span>
              <span className={styles.summaryLabel}>Failed</span>
            </div>
          </div>
          <div className={styles.summaryCard}>
            <Eye className={styles.infoIcon} size={24} />
            <div>
              <span className={styles.summaryCount}>
                {(progress.results.reduce((sum, r) => sum + (r.confidence || 0), 0) / progress.results.length * 100).toFixed(0)}%
              </span>
              <span className={styles.summaryLabel}>Avg Confidence</span>
            </div>
          </div>
        </div>

        <div className={styles.resultsTable}>
          <div className={styles.tableHeader}>
            <span>Original File</span>
            <span>Final File</span>
            <span>SKU</span>
            <span>Product Type</span>
            <span>Color</span>
            <span>Status</span>
          </div>
          <div className={styles.tableBody}>
            {progress.results.map((result, index) => (
              <div key={index} className={styles.tableRow}>
                <span className={styles.fileName}>{result.originalFilename}</span>
                <span className={styles.finalName}>{result.finalFilename || '-'}</span>
                <span className={styles.sku}>{result.matchedSku || '-'}</span>
                <span>{result.productType || '-'}</span>
                <span>{result.detectedColor || '-'}</span>
                <div className={styles.status}>
                  {result.success ? (
                    <CheckCircle className={styles.successIcon} size={16} />
                  ) : (
                    <XCircle className={styles.errorIcon} size={16} />
                  )}
                  <span className={result.success ? styles.successText : styles.errorText}>
                    {result.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={downloadResults}>
            <Download size={16} />
            Download Results
          </button>
          <button className={styles.btnPrimary} onClick={onClose}>
            Complete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.modal}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.content}>
        <button className={styles.closeButton} onClick={onClose}>×</button>
        
        {step === 'select-brand' && renderBrandSelection()}
        {step === 'upload-files' && renderFileUpload()}
        {step === 'processing' && renderProcessing()}
        {step === 'results' && renderResults()}
      </div>
    </div>
  );
};

export default BatchImageUpload;