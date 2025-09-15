import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseService';
import { ProgressLoader } from '../ProgressLoader';
import styles from './ImageManagement.module.css';
import ImageCard from './ImageCard';
import ImageUploadModal from './ImageUploadModal';
import BatchImageUpload from './BatchImageUpload';
import { ImageItem, Brand } from './types';

const IMAGES_PER_PAGE = 50;

const ImageManagement: React.FC = () => {
  const { brandId } = useParams<{ brandId?: string }>();
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndData();
  }, [brandId]);

  const loadUserAndData = async () => {
    try {
      // Load user company info
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .single();
        
        if (userData?.company_id) {
          setCompanyId(userData.company_id);
        }
      }
      
      await loadData();
    } catch (error) {
      console.error('Error loading user data:', error);
      await loadData(); // Still try to load data
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load brands
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('is_active', true)
        .order('brand_name');

      if (brandsError) throw brandsError;
      setBrands(brandsData || []);

      // Load images from storage - brands are direct folders
      const imageItems: ImageItem[] = [];
      
      if (brandId) {
        // Load for specific brand
        const brand = brandsData?.find(b => b.id === brandId);
        if (brand) {
          // List files directly from bucket root
          const { data: files, error: filesError } = await supabase.storage
            .from(brand.brand_name)
            .list('', {
              limit: 1000,
              offset: 0
            });

          if (!filesError && files) {
            const brandImages = files.map(file => {
              const { data } = supabase.storage
                .from(brand.brand_name)
                .getPublicUrl(file.name);

              return {
                id: file.id || file.name,
                name: file.name,
                url: data.publicUrl,
                brand_id: brand.id,
                brand_name: brand.brand_name,
                size: file.metadata?.size || 0,
                uploaded_at: file.created_at || new Date().toISOString(),
                content_type: file.metadata?.mimetype || 'image/jpeg'
              };
            });
            imageItems.push(...brandImages);
          }
        }
      } else {
        // Load for all brands
        for (const brand of brandsData || []) {
          try {
            // List files directly from bucket root
            const { data: files, error: filesError } = await supabase.storage
              .from(brand.brand_name)
              .list('', {
                limit: 1000,
                offset: 0
              });

            if (!filesError && files) {
              const brandImages = files.map(file => {
                const { data } = supabase.storage
                  .from(brand.brand_name)
                  .getPublicUrl(file.name);

                return {
                  id: file.id || file.name,
                  name: file.name,
                  url: data.publicUrl,
                  brand_id: brand.id,
                  brand_name: brand.brand_name,
                  size: file.metadata?.size || 0,
                  uploaded_at: file.created_at || new Date().toISOString(),
                  content_type: file.metadata?.mimetype || 'image/jpeg'
                };
              });
              imageItems.push(...brandImages);
            }
          } catch (error) {
            // Skip brands that don't have buckets yet
            console.log(`No bucket found for brand: ${brand.brand_name}`);
          }
        }
      }

      setImages(imageItems);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await loadData();
    setRefreshing(false);
  }, [brandId]);

  const handleUploadSuccess = useCallback(async () => {
    setShowUploadModal(false);
    await handleRefresh();
  }, [handleRefresh]);

  const handleBrandClick = useCallback((brandIdToSelect: string) => {
    navigate(brandIdToSelect === 'all' ? '/images' : `/images/${brandIdToSelect}`);
  }, [navigate]);

  const handleDeleteImage = useCallback(async (imageId: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    
    try {
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      // Delete directly from bucket
      const { error } = await supabase.storage
        .from(image.brand_name)
        .remove([image.name]);

      if (error) throw error;

      setImages(prev => prev.filter(img => img.id !== imageId));
      setSelectedImages(prev => prev.filter(id => id !== imageId));
    } catch (err) {
      console.error('Error deleting image:', err);
      alert('Failed to delete image');
    }
  }, [images]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedImages.length === 0) return;
    const confirmMessage = `Are you sure you want to delete ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''}?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      // Group by brand for deletion
      const brandGroups: { [brandName: string]: string[] } = {};
      
      selectedImages.forEach(id => {
        const image = images.find(img => img.id === id);
        if (image) {
          if (!brandGroups[image.brand_name]) {
            brandGroups[image.brand_name] = [];
          }
          brandGroups[image.brand_name].push(image.name);
        }
      });

      // Delete from each brand bucket
      for (const [brandName, fileNames] of Object.entries(brandGroups)) {
        const { error } = await supabase.storage
          .from(brandName)
          .remove(fileNames);
        
        if (error) throw error;
      }

      if (error) throw error;

      setImages(prev => prev.filter(img => !selectedImages.includes(img.id)));
      setSelectedImages([]);
    } catch (err) {
      console.error('Error deleting images:', err);
      alert('Failed to delete images');
    }
  }, [selectedImages, images]);

  const handleSelectImage = useCallback((imageId: string) => {
    setSelectedImages(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentImageIds = currentImages.map(img => img.id);
    const allSelected = currentImageIds.every(id => selectedImages.includes(id));
    if (allSelected) {
      setSelectedImages(prev => prev.filter(id => !currentImageIds.includes(id)));
    } else {
      setSelectedImages(prev => Array.from(new Set([...prev, ...currentImageIds])));
    }
  }, []);

  // Memoized data processing
  const processedImages = useMemo(() => {
    let filtered = [...images];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img =>
        img.name.toLowerCase().includes(query) ||
        img.brand_name.toLowerCase().includes(query)
      );
    }

    // Sort images
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        case 'size':
          return b.size - a.size;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [images, searchQuery, sortBy]);

  // Pagination
  const totalPages = Math.ceil(processedImages.length / IMAGES_PER_PAGE);
  const currentImages = processedImages.slice(
    (currentPage - 1) * IMAGES_PER_PAGE,
    currentPage * IMAGES_PER_PAGE
  );

  const stats = useMemo(() => {
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const brandCounts = brands.map(brand => ({
      ...brand,
      count: images.filter(img => img.brand_id === brand.id).length
    }));
    const activeBrands = brandCounts.filter(b => b.count > 0).length;
    return { totalSize, brandCounts, activeBrands };
  }, [images, brands]);

  const allDisplayedSelected = currentImages.length > 0 && currentImages.every(img => selectedImages.includes(img.id));

  return (
    <div className={styles.imageManagementContainer}>
      {/* Header */}
      <div className={styles.imageHeader}>
        <div className={styles.headerLeft}>
          <h1>Image Management{brandId ? ` - ${brands.find(b => b.id === brandId)?.brand_name}` : ''}</h1>
          <p className={styles.headerSubtitle}>
            {brandId ? `Manage product images for ${brands.find(b => b.id === brandId)?.brand_name}` : 'Manage product images across all brands'}
          </p>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={styles.batchUploadButton} 
            onClick={() => setShowBatchUpload(true)}
            disabled={!companyId}
          >
            <span>🤖</span> AI Batch Upload
          </button>
          <button className={styles.uploadButton} onClick={() => setShowUploadModal(true)}>
            <span>📤</span> Upload Images
          </button>
          <button
            className={`${styles.refreshButton} ${refreshing ? styles.refreshing : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <span className={styles.refreshIcon}>🔄</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.errorBanner}>
          <span>⚠️ {error}</span>
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🖼️</div>
          <div className={styles.statContent}>
            <h3>Total Images</h3>
            <p className={styles.statValue}>{images.length}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💾</div>
          <div className={styles.statContent}>
            <h3>Total Size</h3>
            <p className={styles.statValue}>
              {(stats.totalSize / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏷️</div>
          <div className={styles.statContent}>
            <h3>Active Brands</h3>
            <p className={styles.statValue}>
              {stats.activeBrands} / {brands.length}
            </p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👁️</div>
          <div className={styles.statContent}>
            <h3>Showing</h3>
            <p className={styles.statValue}>
              {currentImages.length} / {processedImages.length}
            </p>
          </div>
        </div>
      </div>

      {/* Brand Filter Pills */}
      {!brandId && (
        <div className={styles.brandFilters}>
          <button
            className={`${styles.brandPill} ${!brandId ? styles.active : ''}`}
            onClick={() => handleBrandClick('all')}
          >
            All Brands ({images.length})
          </button>
          {stats.brandCounts.map(brand => (
            <button
              key={brand.id}
              className={`${styles.brandPill} ${brandId === brand.id ? styles.active : ''}`}
              onClick={() => handleBrandClick(brand.id)}
              style={{ '--brand-color': '#79d5e9' } as React.CSSProperties}
            >
              {brand.brand_name} ({brand.count})
            </button>
          ))}
        </div>
      )}

      {/* Controls Section */}
      <div className={styles.controlsSection}>
        <div className={styles.searchContainer}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search images by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className={styles.clearSearch} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        <div className={styles.controlsRight}>
          {selectedImages.length > 0 && (
            <div className={styles.selectionInfo}>
              <span>{selectedImages.length} selected</span>
              <button className={styles.bulkDeleteBtn} onClick={handleBulkDelete}>
                Delete Selected
              </button>
            </div>
          )}

          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
          >
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date (Newest First)</option>
            <option value="size">Sort by Size</option>
          </select>

        </div>
      </div>

      {/* Select All Checkbox */}
      {currentImages.length > 0 && (
        <div className={styles.selectAllContainer}>
          <input
            type="checkbox"
            id="selectAll"
            checked={allDisplayedSelected}
            onChange={handleSelectAll}
          />
          <label htmlFor="selectAll">
            Select All on Page ({currentImages.length})
          </label>
        </div>
      )}

      {/* Content Area */}
      <div className={styles.contentArea}>
        {loading ? (
          <ProgressLoader
            isVisible={true}
            message="Loading images..."
            progress={50}
          />
        ) : processedImages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🖼️</div>
            <h3>No images found</h3>
            <p>
              {searchQuery
                ? `No images match "${searchQuery}"`
                : brandId
                  ? `No images for ${brands.find(b => b.id === brandId)?.brand_name}`
                  : 'Upload your first image to get started'
              }
            </p>
            {searchQuery && (
              <button className={styles.clearFiltersBtn} onClick={() => setSearchQuery('')}>
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.imagesGrid}>
              {currentImages.map(image => (
                <ImageCard
                  key={image.id}
                  image={image}
                  isSelected={selectedImages.includes(image.id)}
                  onSelect={() => handleSelectImage(image.id)}
                  onDelete={() => handleDeleteImage(image.id)}
                  brandColor="#79d5e9"
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className={styles.paginationBtn}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className={styles.paginationBtn}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ImageUploadModal
          brands={brandId ? brands.filter(b => b.id === brandId) : brands}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={handleUploadSuccess}
          defaultBrand={brandId}
        />
      )}

      {/* AI Batch Upload Modal */}
      {showBatchUpload && companyId && (
        <BatchImageUpload
          companyId={companyId}
          onClose={() => setShowBatchUpload(false)}
          onComplete={async () => {
            setShowBatchUpload(false);
            await handleRefresh();
          }}
        />
      )}
    </div>
  );
};

export default ImageManagement;
