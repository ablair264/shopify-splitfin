import React from 'react';
import {
  X,
  Barcode,
  Package,
  DollarSign,
  Warehouse,
  Image,
  Tag,
  Info,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import styles from './ProductDetailsModal.module.css';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  ean?: string;
  description?: string;
  category?: string;
  brand_id: string;
  brand_name?: string;
  gross_stock_level: number;
  reorder_level: number;
  retail_price?: number;
  cost_price?: number;
  purchase_price?: number;
  status: string;
  image_url?: string;
  created_date: string;
}

interface ProductDetailsModalProps {
  product: InventoryItem;
  onClose: () => void;
}

const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ product, onClose }) => {
  const getStockStatus = () => {
    if (product.gross_stock_level === 0) {
      return { status: 'Out of Stock', color: 'red', icon: XCircle };
    }
    if (product.reorder_level > 0 && product.gross_stock_level <= product.reorder_level) {
      return { status: 'Low Stock', color: 'orange', icon: AlertTriangle };
    }
    return { status: 'In Stock', color: 'green', icon: CheckCircle };
  };

  const stockInfo = getStockStatus();
  const StatusIcon = stockInfo.icon;

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateMargin = () => {
    if (!product.purchase_price || !product.retail_price) return '—';
    return `${((product.retail_price - product.purchase_price) / product.purchase_price * 100).toFixed(1)}%`;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Product Details</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.productDetailsGrid}>
            {/* Image Section */}
            <div className={styles.productImageSection}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className={styles.productDetailImage} />
              ) : (
                <div className={styles.imagePlaceholderLarge}>
                  <Image size={48} />
                  <span>No Image Available</span>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className={styles.productInfoSection}>
              <div className={styles.productTitleSection}>
                <h3>{product.name}</h3>
                <div className={`${styles.statusBadge} ${styles[`status${stockInfo.color.charAt(0).toUpperCase() + stockInfo.color.slice(1)}`]}`}>
                  <StatusIcon size={16} />
                  <span>{stockInfo.status}</span>
                </div>
              </div>

              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Barcode size={16} />
                    SKU
                  </div>
                  <div className={styles.detailValue}>{product.sku}</div>
                </div>

                {product.ean && (
                  <div className={styles.detailItem}>
                    <div className={styles.detailLabel}>
                      <Barcode size={16} />
                      EAN/Barcode
                    </div>
                    <div className={styles.detailValue}>{product.ean}</div>
                  </div>
                )}

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Tag size={16} />
                    Brand
                  </div>
                  <div className={styles.detailValue}>{product.brand_name || '—'}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Package size={16} />
                    Category
                  </div>
                  <div className={styles.detailValue}>{product.category || '—'}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Warehouse size={16} />
                    Stock Level
                  </div>
                  <div className={`${styles.detailValue} ${styles.stockValue}`}>
                    {product.gross_stock_level}
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <AlertTriangle size={16} />
                    Reorder Level
                  </div>
                  <div className={styles.detailValue}>{product.reorder_level}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <DollarSign size={16} />
                    Purchase Price
                  </div>
                  <div className={styles.detailValue}>{formatCurrency(product.purchase_price)}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <DollarSign size={16} />
                    Cost Price
                  </div>
                  <div className={styles.detailValue}>{formatCurrency(product.cost_price)}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <DollarSign size={16} />
                    Retail Price
                  </div>
                  <div className={`${styles.detailValue} ${styles.priceValue}`}>
                    {formatCurrency(product.retail_price)}
                  </div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Info size={16} />
                    Margin
                  </div>
                  <div className={styles.detailValue}>{calculateMargin()}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Calendar size={16} />
                    Created Date
                  </div>
                  <div className={styles.detailValue}>{formatDate(product.created_date)}</div>
                </div>

                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>
                    <Info size={16} />
                    Status
                  </div>
                  <div className={styles.detailValue}>
                    <span className={`${styles.statusText} ${styles[`status${product.status.charAt(0).toUpperCase() + product.status.slice(1)}`]}`}>
                      {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {product.description && (
            <div className={styles.descriptionSection}>
              <h4>
                <Info size={16} />
                Product Description
              </h4>
              <p>{product.description}</p>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsModal;