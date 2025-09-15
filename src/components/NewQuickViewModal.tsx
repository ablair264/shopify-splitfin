import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Barcode,
  Package,
  DollarSign,
  Tag,
  Info,
  CheckCircle,
  XCircle,
  Palette,
  Ruler,
  Weight,
  Book,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

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
  weight?: number;
  style?: string;
  brand?: {
    id: string;
    brand_name: string;
    brand_normalized: string;
    logo_url?: string;
  };
  [key: string]: any;
}

interface NewQuickViewModalProps {
  product: Product;
  quantity: number;
  onQuantityChange: (n: number) => void;
  onAddToOrder: (product: Product, qty: number) => void;
  onClose: () => void;
}

// ImageKit base URL
const IMAGEKIT_BASE_URL = 'https://ik.imagekit.io/a7kelms9a';

const NewQuickViewModal: React.FC<NewQuickViewModalProps> = ({
  product,
  quantity,
  onQuantityChange,
  onAddToOrder,
  onClose,
}) => {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const inStock = product.net_stock_level > 0;
  const packingUnit = product.packing_unit || 1;

  // Load multiple images
  const loadProductImages = useCallback(async () => {
    setLoading(true);
    const foundImages: string[] = [];
    
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
        const imageUrl = `${IMAGEKIT_BASE_URL}/tr:w-600,h-600,c-maintain_ratio,q-85,f-auto/brand-images/${folderName}/${sku}_${i}.webp`;
        
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            foundImages.push(imageUrl);
            resolve();
          };
          img.onerror = () => reject();
          img.src = imageUrl;
        });
      } catch {
        break;
      }
    }
    
    if (foundImages.length === 0) {
      foundImages.push('/placeholder.png');
    }
    
    setImageUrls(foundImages);
    setLoading(false);
  }, [product]);

  useEffect(() => {
    loadProductImages();
  }, [loadProductImages]);

  const goToPrevious = () => {
    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : imageUrls.length - 1);
  };

  const goToNext = () => {
    setCurrentImageIndex(prev => prev < imageUrls.length - 1 ? prev + 1 : 0);
  };

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(packingUnit, Math.ceil(newQty / packingUnit) * packingUnit);
    onQuantityChange(validQty);
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  };

  return ReactDOM.createPortal(
    <div className="new-modal-overlay" onClick={onClose}>
      <div className="new-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="new-modal-header">
          <h2>Product Details</h2>
          <button className="new-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="new-modal-body">
          {/* Product Title */}
          <div className="new-product-title-section">
            <h3>{product.name}</h3>
            <div className={`new-status-badge ${inStock ? 'new-status-green' : 'new-status-orange'}`}>
              {inStock ? <CheckCircle size={16} /> : <Package size={16} />}
              <span>{inStock ? 'In Stock' : 'Factory Order'}</span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="new-description-text">
              {product.description}
            </div>
          )}

          <div className="new-product-details-grid">
            {/* Image Section */}
            <div className="new-product-image-section">
              {loading ? (
                <div className="new-image-loading">
                  <div className="new-loading-spinner" />
                  <span>Loading images...</span>
                </div>
              ) : (
                <div className="new-image-carousel">
                  <img
                    src={imageUrls[currentImageIndex]}
                    alt={`${product.name} - Image ${currentImageIndex + 1}`}
                    className="new-product-detail-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== '/placeholder.png') {
                        target.src = '/placeholder.png';
                      }
                    }}
                  />

                  {/* Navigation arrows - only show if multiple images */}
                  {imageUrls.length > 1 && (
                    <>
                      <button
                        className="new-carousel-nav new-carousel-prev"
                        onClick={goToPrevious}
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <button
                        className="new-carousel-nav new-carousel-next"
                        onClick={goToNext}
                      >
                        <ChevronRight size={20} />
                      </button>
                      <div className="new-image-counter">
                        {currentImageIndex + 1} / {imageUrls.length}
                      </div>
                    </>
                  )}
                  
                  {/* Brand Logo Badge */}
                  {product.brand?.logo_url && (
                    <div className="new-brand-badge">
                      <img 
                        src={product.brand.logo_url} 
                        alt={product.brand.brand_name}
                        className="new-brand-badge-logo"
                      />
                    </div>
                  )}
                </div>
              )}
              
            </div>

            {/* Details Section with Pricing and Controls */}
            <div className="new-product-info-section">
              {/* Large Pricing Section */}
              <div className="new-pricing-section">
                <div className="new-pricing-item">
                  <div className="new-pricing-label">Price</div>
                  <div className="new-pricing-value cost">{formatCurrency(product.cost_price)}</div>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="new-quantity-controls-below">
                <div className="new-quantity-selector-compact">
                  <button
                    onClick={() => handleQuantityChange(quantity - packingUnit)}
                    disabled={quantity <= packingUnit}
                    className="new-qty-btn-compact"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || packingUnit)}
                    min={packingUnit}
                    step={packingUnit}
                    className="new-qty-input-compact"
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + packingUnit)}
                    className="new-qty-btn-compact"
                  >
                    ＋
                  </button>
                </div>
<button
  className="new-add-to-order-btn"
  onClick={() => onAddToOrder(product, quantity)}
>
  Add to Order
</button>
              </div>

              <div className="new-details-grid">
                <div className="new-detail-item">
                  <div className="new-detail-label">
                    <Barcode size={16} />
                    SKU
                  </div>
                  <div className="new-detail-value">{product.sku}</div>
                </div>

                {/* Only show category if not 'uncategorized' */}
                {product.category && product.category.toLowerCase() !== 'uncategorized' && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Package size={16} />
                      Category
                    </div>
                    <div className="new-detail-value">{product.category}</div>
                  </div>
                )}

                {/* Show style if not null */}
                {product.style && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Tag size={16} />
                      Style
                    </div>
                    <div className="new-detail-value">{product.style}</div>
                  </div>
                )}

                {/* Show colour if not null */}
                {product.colour && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Palette size={16} />
                      Colour
                    </div>
                    <div className="new-detail-value">{product.colour}</div>
                  </div>
                )}


                {/* Show weight if not null */}
                {product.weight && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Weight size={16} />
                      Weight
                    </div>
                    <div className="new-detail-value">{product.weight}g</div>
                  </div>
                )}

                {/* Show dimensions if not null */}
                {(product.height || product.width || product.length || product.diameter) && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Ruler size={16} />
                      Dimensions
                    </div>
                    <div className="new-detail-value">
                      {[
                        product.length && `L: ${product.length}cm`,
                        product.width && `W: ${product.width}cm`,
                        product.height && `H: ${product.height}cm`,
                        product.diameter && `⌀: ${product.diameter}cm`
                      ].filter(Boolean).join(', ')}
                    </div>
                  </div>
                )}

                <div className="new-detail-item">
                  <div className="new-detail-label">
                    <Package size={16} />
                    Packing Unit
                  </div>
                  <div className="new-detail-value">{product.packing_unit || 1} per pack</div>
                </div>

                {product.catalogue_page_number && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Book size={16} />
                      Catalogue Page
                    </div>
                    <div className="new-detail-value">{product.catalogue_page_number}</div>
                  </div>
                )}

                {product.ean && (
                  <div className="new-detail-item">
                    <div className="new-detail-label">
                      <Barcode size={16} />
                      EAN
                    </div>
                    <div className="new-detail-value">{String(product.ean).split('.')[0]}</div>
                  </div>
                )}
              </div>
            </div>
          </div>


        </div>

      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};

export default NewQuickViewModal;