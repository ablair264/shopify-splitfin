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
  Upload,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import styles from './AddProductModal.module.css';

interface AddProductModalProps {
  brands: Array<{ id: string; brand_name: string }>;
  onClose: () => void;
  onAdd: () => void;
}

const AddProductModal: React.FC<AddProductModalProps> = ({ brands, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    ean: '',
    brand_id: '',
    category: '',
    description: '',
    gross_stock_level: 0,
    reorder_level: 0,
    purchase_price: 0,
    cost_price: 0,
    retail_price: 0,
    status: 'active',
    image_url: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

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
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      const { error: insertError } = await supabase
        .from('items')
        .insert({
          ...formData,
          created_date: new Date().toISOString()
        });

      if (insertError) throw insertError;

      onAdd();
    } catch (err: any) {
      setError(err.message || 'Failed to add product');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.sku || !formData.brand_id) {
        setError('Product name, SKU, and brand are required');
        return;
      }
    }
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const margin = formData.purchase_price && formData.retail_price
    ? ((formData.retail_price - formData.purchase_price) / formData.purchase_price * 100).toFixed(1)
    : '0';

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Add New Product</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.stepIndicator}>
          <div className={`${styles.step} ${currentStep >= 1 ? styles.active : ''}`}>
            <span>1</span>
            <label>Basic Info</label>
          </div>
          <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''}`}>
            <span>2</span>
            <label>Pricing & Stock</label>
          </div>
          <div className={`${styles.step} ${currentStep >= 3 ? styles.active : ''}`}>
            <span>3</span>
            <label>Additional Details</label>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
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
                      placeholder="Enter product name"
                      required
                      autoFocus
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label><Barcode size={16} /> SKU *</label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      placeholder="Enter unique SKU"
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
                      placeholder="Enter EAN/Barcode"
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
                      placeholder="Enter category"
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
            )}

            {/* Step 2: Pricing & Stock */}
            {currentStep === 2 && (
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
                      placeholder="0.00"
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
                      placeholder="0.00"
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
                      placeholder="0.00"
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
                    <label><Warehouse size={16} /> Initial Stock</label>
                    <input
                      type="number"
                      name="gross_stock_level"
                      value={formData.gross_stock_level}
                      onChange={handleInputChange}
                      placeholder="0"
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
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Additional Details */}
            {currentStep === 3 && (
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
                      rows={6}
                      placeholder="Enter detailed product description..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.modalFooter}>
            <div className={styles.footerLeft}>
              {currentStep > 1 && (
                <button type="button" className={styles.btnSecondary} onClick={prevStep}>
                  <ChevronLeft size={18} />
                  Previous
                </button>
              )}
            </div>
            <div className={styles.footerRight}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Cancel
              </button>
              {currentStep < 3 ? (
                <button type="button" className={styles.btnPrimary} onClick={nextStep}>
                  Next
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={18} className={styles.spinner} />
                      Adding Product...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Add Product
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;