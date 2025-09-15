import React, { useState, useCallback, memo } from 'react';
import { Eye, X, Book, Plus, Minus } from 'lucide-react';
import './NewProductListItem.css';

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

interface NewProductListItemProps {
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

const NewProductListItem = memo(({
  product,
  quantity,
  onQuantityChange,
  onAddToOrder,
  isSelected,
  onQuickView,
  showNewBadge = false,
}: NewProductListItemProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  
  const inStock = product.net_stock_level > 0;
  const packingUnit = product.packing_unit || 1;

  // Build image URL
  React.useEffect(() => {
    const brand = product.brand?.brand_name || product.manufacturer || '';
    const sku = product.sku.toLowerCase();
    
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
    const url = `${IMAGEKIT_BASE_URL}/tr:w-80,h-80,c-maintain_ratio,q-80,f-auto/brand-images/${folderName}/${sku}_1.webp`;
    
    const img = new Image();
    img.onload = () => {
      setImageUrl(url);
      setImageLoading(false);
    };
    img.onerror = () => {
      setImageError(true);
      setImageLoading(false);
    };
    img.src = url;
  }, [product.sku, product.brand?.brand_name, product.manufacturer]);

  const handleQuantityChange = useCallback((newQty: number) => {
    const validQty = Math.max(packingUnit, Math.ceil(newQty / packingUnit) * packingUnit);
    onQuantityChange(validQty);
  }, [onQuantityChange, packingUnit]);

  return (
    <div className={`new-product-list-item ${isSelected ? 'selected' : ''}`}>
      {/* New Badge */}
      {showNewBadge && (
        <div className="list-new-badge">New</div>
      )}

      {/* Product Image */}
      <div className="list-image-container">
        {imageLoading ? (
          <div className="list-image-loading">
            <div className="loading-spinner" />
          </div>
        ) : imageError ? (
          <div className="list-image-placeholder">
            <span>No Image</span>
          </div>
        ) : (
          <img 
            src={imageUrl} 
            alt={product.name}
            className="list-product-image"
          />
        )}
      </div>

      {/* Product Info */}
      <div className="list-product-info">
        <h3 className="list-product-name">{product.name}</h3>
        <div className="list-product-meta">
          <span className="list-product-sku">SKU: {product.sku}</span>
          {product.ean && <span className="list-product-ean">EAN: {product.ean}</span>}
          {product.category && <span className="list-product-category">{product.category}</span>}
        </div>
      </div>

      {/* Stock Status */}
      <div className="list-stock-section">
        <div className={`list-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}`}>
          {inStock ? 'In Stock' : 'Factory Order'}
        </div>
        <span className="list-stock-level">
          {inStock ? `${product.net_stock_level} units` : 'On request'}
        </span>
      </div>

      {/* Pricing */}
      <div className="list-pricing-section">
        <div className="list-cost-price">£{product.cost_price?.toFixed(2) || '0.00'}</div>
        <div className="list-retail-price">RRP: £{product.retail_price?.toFixed(2) || '0.00'}</div>
      </div>

      {/* Quantity Controls */}
      <div className="list-quantity-section">
        <button
          className="list-qty-btn minus"
          onClick={() => handleQuantityChange(quantity - packingUnit)}
          disabled={quantity <= packingUnit}
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          value={quantity}
          onChange={(e) => handleQuantityChange(parseInt(e.target.value) || packingUnit)}
          min={packingUnit}
          step={packingUnit}
          className="list-qty-input"
        />
        <button
          className="list-qty-btn plus"
          onClick={() => handleQuantityChange(quantity + packingUnit)}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Actions */}
      <div className="list-actions">
        <button
          className="list-view-btn"
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
            className="list-catalogue-btn"
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

        <button
          className={`list-add-btn ${isSelected ? 'selected' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onAddToOrder();
          }}
          title={isSelected ? 'Remove from Order' : 'Add to Order'}
        >
          {isSelected ? 'Added' : 'Add To Order'}
        </button>
        
        {isSelected && (
          <button
            className="list-remove-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddToOrder();
            }}
            title="Remove from Order"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

NewProductListItem.displayName = 'NewProductListItem';

export { NewProductListItem };
export type { Product };