import React, { useState } from 'react';
import {
  X,
  Save,
  Barcode,
  Package,
  DollarSign,
  Warehouse,
  Image,
  Tag,
  Info,
  Loader2
} from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import styles from './AddProductModal.module.css'; // Reuse the same styles

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
}

interface EditProductModalProps {
  product: InventoryItem;
  brands: Array<{ id: string; brand_name: string }>;
  onClose: () => void;
  onUpdate: () => void;
}

const EditProductModal: React.FC<EditProductModalProps> = ({ 
  product, 
  brands, 
  onClose, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState({
    name: product.name || '',
    sku: product.sku || '',
    ean: product.ean || '',
    brand_id: product.brand_id || '',
    category: product.category || '',
    description: product.description || '',
    gross_stock_level: product.gross_stock_level || 0,
    reorder_level: product.reorder_level || 0,
    purchase_price: product.purchase_price || 0,
    cost_price: product.cost_price || 0,
    retail_price: product.retail_price || 0,
    status: product.status || 'active',
    image_url: product.image_url || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('price') || name.includes('stock') || name.includes('level')
        ? parseFloat(value) || 0
        : value
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Product name is required');
      return false;
    }
    if (!formData.sku.trim()) {
      setError('SKU is required');
      return false;
    }
    if (!formData.brand_id) {
      setError('Brand is required');
      return false;
    }
    if (formData.retail_price <= 0) {
      setError('Retail price must be greater than 0');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('items')
        .update({
          name: formData.name,
          sku: formData.sku,
          ean: formData.ean,
          brand_id: formData.brand_id,
          category: formData.category,
          description: formData.description,
          gross_stock_level: formData.gross_stock_level,
          reorder_level: formData.reorder_level,
          purchase_price: formData.purchase_price,
          cost_price: formData.cost_price,
          retail_price: formData.retail_price,
          status: formData.status,
          image_url: formData.image_url
        })
        .eq('id', product.id);

      if (updateError) throw updateError;

      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const margin = formData.purchase_price && formData.retail_price
    ? ((formData.retail_price - formData.purchase_price) / formData.purchase_price * 100).toFixed(1)
    : '0';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Edit Product</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {/* Basic Information */}
            <div className={styles.formStep}>
              <h3><Info size={18} /> Basic Information</h3>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label><Barcode size={16} /> SKU *</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label><Barcode size={16} /> EAN/Barcode</label>
                  <input
                    type="text"
                    name="ean"
                    value={formData.ean}
                    onChange={handleInputChange}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label><Tag size={16} /> Brand *</label>
                  <select
                    name="brand_id"
                    value={formData.brand_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select Brand</option>
                    {brands.map(brand => (
                      <option key={brand.id} value={brand.id}>
                        {brand.brand_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing & Stock */}
            <div className={styles.formStep}>
              <h3><DollarSign size={18} /> Pricing & Stock Information</h3>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Purchase Price</label>
                  <input
                    type="number"
                    name="purchase_price"
                    value={formData.purchase_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Cost Price</label>
                  <input
                    type="number"
                    name="cost_price"
                    value={formData.cost_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Retail Price *</label>
                  <input
                    type="number"
                    name="retail_price"
                    value={formData.retail_price}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Margin</label>
                  <input
                    type="text"
                    value={`${margin}%`}
                    disabled
                    className={styles.marginInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label><Warehouse size={16} /> Stock Level</label>
                  <input
                    type="number"
                    name="gross_stock_level"
                    value={formData.gross_stock_level}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Reorder Level</label>
                  <input
                    type="number"
                    name="reorder_level"
                    value={formData.reorder_level}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className={styles.formStep}>
              <h3><Image size={18} /> Additional Details</h3>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Image URL</label>
                  <input
                    type="text"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleInputChange}
                    placeholder="Enter image URL (optional)"
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Product Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Enter detailed product description..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <div className={styles.footerLeft}></div>
            <div className={styles.footerRight}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;