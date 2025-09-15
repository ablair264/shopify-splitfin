import React, { useState, useEffect, useCallback, memo } from 'react';
import { Eye, Plus, X, Book, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import './NewProductCard.css';

interface Product {
  id: string;
  name: string;
  sku: string;
  gross_stock_level: number;
  net_stock_level: number;
  retail_price: number;
  cost_price: number;
  purchase_price: number;
  brand_id: string;
  manufacturer?: string;
  image_url?: string;
  category?: string;
  colour?: string;
  description?: string;
  ean?: string;
  status: 'active' | 'inactive';
  created_date?: string;
  updated_at?: string;
  height?: number;
  width?: number;
  length?: number;
  diameter?: number;
  packing_unit?: number;
  catalogue_page_number?: number;
  brand?: {
    id: string;
    brand_name: string;
    brand_normalized: string;
    logo_url?: string;
  };
  [key: string]: any;
}

interface NewProductCardProps {
  product: Product;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToOrder: () => void;
  isSelected: boolean;
  onQuickView?: () => void;
  showNewBadge?: boolean;
}

// ImageKit base URL
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/a7kelms9a';

const NewProductCard = memo(({
  product,
  quantity,
  onQuantityChange,
  onAddToOrder,
  isSelected,
  onQuickView,
  showNewBadge = false,
}: NewProductCardProps) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const inStock = product.net_stock_level > 0;
  const packingUnit = product.packing_unit || 1;

  // Build image URLs for multiple images
  const buildImageUrls = useCallback(async () => {
    setImageLoading(true);
    const urls: string[] = [];
    
    const brand = product.brand?.brand_name || product.manufacturer || '';
    const sku = product.sku.toLowerCase();
    
    // Brand folder mapping
    const brandFolderMap: { [key: string]: string } = {
      'elvang': 'elvang',
      'räder': 'rader',
      'rader': 'rader',
      'myflame': 'myflame',
      'my flame': 'myflame',
      'my-flame-lifestyle': 'myflame',
      'relaxound': 'relaxound',
      'remember': 'remember'
    };
    
    const folderName = brandFolderMap[brand.toLowerCase()] || brand.toLowerCase().replace(/\s+/g, '-');
    
    // Try to load up to 5 images
    for (let i = 1; i <= 5; i++) {
      try {
        const imageUrl = `${IMAGEKIT_BASE_URL}/tr:w-300,h-300,c-maintain_ratio,q-80,f-auto/brand-images/${folderName}/${sku}_${i}.webp`;
        
        // Test if image exists
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            urls.push(imageUrl);
            resolve();
          };
          img.onerror = () => reject();
          img.src = imageUrl;
        });
      } catch {
        break; // Stop trying when we hit a missing image
      }
    }
    
    setImageUrls(urls);
    setImageError(urls.length === 0);
    setImageLoading(false);
  }, [product.sku, product.brand?.brand_name, product.manufacturer]);

  useEffect(() => {
    buildImageUrls();
  }, [buildImageUrls]);

  const handleQuantityChange = useCallback((newQty: number) => {
    const validQty = Math.max(packingUnit, Math.ceil(newQty / packingUnit) * packingUnit);
    onQuantityChange(validQty);
  }, [onQuantityChange, packingUnit]);

  const goToPrevImage = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : imageUrls.length - 1);
  };

  const goToNextImage = () => {
    setCurrentImageIndex(prev => prev < imageUrls.length - 1 ? prev + 1 : 0);
  };

  return (
    <div className={`new-product-card ${isSelected ? 'selected' : ''}`}>
      {/* New Badge */}
      {showNewBadge && (
        <div className="new-product-badge">New</div>
      )}

      {/* Image Section with Multiple Image Support */}
      <div className="product-image-section">
        {imageLoading ? (
          <div className="image-loading">
            <div className="loading-spinner" />
          </div>
        ) : imageError || imageUrls.length === 0 ? (
          <div className="image-placeholder">
            <span>No Image</span>
          </div>
        ) : (
          <>
            <img 
              src={imageUrls[currentImageIndex]} 
              alt={product.name}
              className="product-image"
            />
            
            {/* Image Navigation */}
            {imageUrls.length > 1 && (
              <>
                <button 
                  className="image-nav prev-image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevImage();
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  className="image-nav next-image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextImage();
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <div className="image-indicator">
                  {currentImageIndex + 1}/{imageUrls.length}
                </div>
              </>
            )}
          </>
        )}

        {/* Stock Badge */}
        <div className={`stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}`}>
          {inStock ? 'Stock' : 'Factory Order'}
        </div>

        {/* Product Name - positioned at bottom of image area */}
        <h3 className="product-name" title={product.name}>
          {product.name}
        </h3>
      </div>

      {/* Product Info */}
      <div className="product-info">
        {/* Two-column info grid: SKU/EAN and Category/Packing Units */}
        <div className="product-details-grid">
          <p className="product-sku">{product.sku}</p>
          <p className="product-ean">{product.ean || 'N/A'}</p>
          <p className="product-category">{product.category || 'Uncategorized'}</p>
          <p className="product-packing">{packingUnit} unit{packingUnit > 1 ? 's' : ''}</p>
        </div>

        {/* Pricing Section */}
        <div className="pricing-section">
          <p className="product-price">£{product.cost_price?.toFixed(2) || '0.00'}</p>
        </div>

        {/* Action Buttons Top Row - View More and Catalogue (smaller, icon-only) */}
        <div className="action-buttons-top">
          <button
            className="view-btn"
            onClick={(e) => {
              e.stopPropagation();
              onQuickView?.();
            }}
            title="View Details"
          >
            View More
          </button>
          
          {product.catalogue_page_number && (
            <button
              className="catalogue-btn"
              onClick={(e) => {
                e.stopPropagation();
                const brandName = product.brand?.brand_normalized || 'general';
                const catalogueUrl = `/catalogues/${brandName}-catalogue.pdf#page=${product.catalogue_page_number}`;
                window.open(catalogueUrl, '_blank');
              }}
              title={`View in Catalogue - Page ${product.catalogue_page_number}`}
            >
              <Book size={16} />
            </button>
          )}
        </div>

        {/* Bottom Row - Quantity Selector and Main Action Buttons */}
        <div className="bottom-controls">
          <div className="quantity-selector" onClick={(e) => e.stopPropagation()}>
            <button
              className="qty-btn"
              onClick={() => handleQuantityChange(quantity - packingUnit)}
              disabled={quantity <= packingUnit}
            >
              −
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || packingUnit)}
              min={packingUnit}
              step={packingUnit}
              className="qty-input"
            />
            <button
              className="qty-btn"
              onClick={() => handleQuantityChange(quantity + packingUnit)}
            >
              ＋
            </button>
          </div>

          <div className="main-actions">
            <button
              className={`add-btn ${isSelected ? 'selected' : ''} ${isAnimating ? 'animating' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSelected) {
                  setIsAnimating(true);
                  setTimeout(() => setIsAnimating(false), 600);
                }
                onAddToOrder();
              }}
              title={isSelected ? 'Remove from Order' : 'Add to Order'}
            >
              {isSelected ? 'Added' : 'Add To Order'}
            </button>
            
            <button
              className="remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected) {
                  onAddToOrder(); // This toggles the selection
                }
              }}
              title="Remove from Order"
              disabled={!isSelected}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
});

NewProductCard.displayName = 'NewProductCard';

export { NewProductCard };
export type { Product };