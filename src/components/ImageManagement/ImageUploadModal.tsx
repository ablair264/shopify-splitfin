import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabaseService';
import { authService } from '../../services/authService';
import styles from './ImageUploadModal.module.css';
import { Brand } from './types';

interface ImageUploadModalProps {
  brands: Brand[];
  onClose: () => void;
  onUploadSuccess: () => void;
  defaultBrand?: string;
}

interface FilePreview {
  file: File;
  preview: string;
  name: string;
  size: number;
  brand?: string;
}

const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  brands,
  onClose,
  onUploadSuccess,
  defaultBrand
}) => {
  const [selectedBrand, setSelectedBrand] = useState<string>(defaultBrand || brands[0]?.id || '');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
  };

  // Process files
  const processFiles = (selectedFiles: File[]) => {
    setErrors([]);
    const newErrors: string[] = [];

    selectedFiles.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        newErrors.push(`${file.name} is not an image file`);
        return;
      }

      // Create file preview with default brand (can be changed later)
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview: FilePreview = {
          file,
          preview: e.target?.result as string,
          name: file.name,
          size: file.size,
          brand: selectedBrand || brands[0]?.id || ''
        };
        setFiles(prev => [...prev, preview]);
      };
      reader.readAsDataURL(file);
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }
  };

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  }, [selectedBrand]);

  // Remove file from preview
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Update file brand
  const updateFileBrand = (index: number, brand: string) => {
    setFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, brand } : file
    ));
  };

  // Handle upload to Supabase Storage
  const handleUpload = async () => {
    // Validate all files have a brand
    const filesWithoutBrand = files.filter(f => !f.brand);
    if (filesWithoutBrand.length > 0) {
      setErrors([`Please select a brand for: ${filesWithoutBrand.map(f => f.name).join(', ')}`]);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      const totalFiles = files.length;
      let uploadedCount = 0;
      const uploadErrors: string[] = [];

      for (const filePreview of files) {
        try {
          const fileName = `${Date.now()}_${filePreview.file.name}`;
          const brandName = brands.find(b => b.id === filePreview.brand)?.brand_name || 'Unknown';
          
          console.log(`Uploading ${fileName} to bucket: ${brandName}`);
          
          // Simple direct upload to bucket root
          console.log(`Upload path: ${fileName}`);
          
          const { data, error } = await supabase.storage
            .from(brandName)
            .upload(fileName, filePreview.file, {
              contentType: filePreview.file.type,
              upsert: false
            });
            
          console.log('Upload result:', { data, error });

          if (error) throw error;

          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
        } catch (error) {
          console.error(`Error uploading ${filePreview.name}:`, error);
          uploadErrors.push(`Failed to upload ${filePreview.name}`);
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
        }
      }

      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
      } else {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors([error instanceof Error ? error.message : 'An error occurred during upload']);
    } finally {
      setUploading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <h2>Upload Images</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Brand Selection */}
          <div className={styles.formGroup}>
            <label>Default Brand for New Files</label>
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                // Update any files that don't have a brand set yet
                setFiles(prev => prev.map(file => 
                  !file.brand ? { ...file, brand: e.target.value } : file
                ));
              }}
            >
              <option value="">Select a brand...</option>
              {brands.map(brand => (
                <option key={brand.id} value={brand.id}>
                  {brand.brand_name}
                </option>
              ))}
            </select>
            {files.length === 0 && (
              <small style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                This will be applied to newly uploaded files. You can change individual file brands below.
              </small>
            )}
          </div>

          {/* Drop Zone */}
          <div
            className={`${styles.dropZone} ${dragActive ? styles.dragActive : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className={styles.fileInput}
            />
            <div className={styles.dropZoneContent}>
              <span>📤</span>
              <h3>Drop images here or click to browse</h3>
              <p>Support for JPG, PNG, WebP, GIF</p>
              <p className={styles.fileTypes}>Maximum 10MB per file</p>
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className={styles.errorContainer}>
              {errors.map((error, index) => (
                <div key={index} className={styles.errorMessage}>
                  ⚠️ {error}
                </div>
              ))}
            </div>
          )}

          {/* File Previews */}
          {files.length > 0 && (
            <div className={styles.filePreviewsContainer}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Selected Files ({files.length})</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setFiles(prev => prev.map(file => ({ ...file, brand: e.target.value })));
                        e.target.value = ''; // Reset dropdown
                      }
                    }}
                    style={{ 
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Apply brand to all...</option>
                    {brands.map(brand => (
                      <option key={brand.id} value={brand.id}>
                        {brand.brand_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.filePreviews}>
                {files.map((file, index) => (
                  <div key={index} className={styles.filePreviewItem}>
                    <div className={styles.previewImageContainer}>
                      <img src={file.preview} alt={file.name} />
                    </div>
                    <div className={styles.previewInfo}>
                      <div className={styles.fileName} title={file.name}>
                        {file.name}
                      </div>
                      <div className={styles.fileSize}>
                        {formatFileSize(file.size)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Brand:</label>
                        <select
                          value={file.brand || ''}
                          onChange={(e) => updateFileBrand(index, e.target.value)}
                          className={styles.fileBrandSelect}
                        >
                          <option value="">Select brand...</option>
                          {brands.map(brand => (
                            <option key={brand.id} value={brand.id}>
                              {brand.brand_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      className={styles.removeFileBtn}
                      onClick={() => removeFile(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className={styles.uploadProgressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className={styles.progressText}>
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton}
            onClick={onClose}
            disabled={uploading}
          >
            Cancel
          </button>
          <button 
            className={styles.uploadButton}
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} Image${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
