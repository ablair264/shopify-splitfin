// src/components/ProductList/ProductList.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../services/supabaseService';
import { ProgressLoader } from '../ProgressLoader';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Modal from 'react-modal';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useParams } from 'react-router-dom';
import { Search, Download, FileText, Upload, ShoppingCart } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import styles from './ProductList.module.css';

Modal.setAppElement('#root');

interface Product {
  id: string;
  name: string;
  sku: string;
  ean?: string;
  stock_level: number;
  retail_price: number;
  brand?: string;
  brand_id?: string;
  quantity: number;
  selected: boolean;
  image_url?: string;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      res(dataUrl.split(',')[1]);
    };
    reader.onerror = () => rej(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Generate barcode as data URL
function generateBarcodeDataUrl(ean: string): string {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, ean, {
      format: 'EAN13',
      width: 1.5,
      height: 40,
      displayValue: true,
      fontSize: 12,
      margin: 5
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
}

// Product Image Component
const ProductImage: React.FC<{ product: Product; onImageClick: () => void }> = ({ 
  product, 
  onImageClick 
}) => {
  const [loading, setLoading] = useState(!product.image_url);
  const [error, setError] = useState(false);

  if (error || !product.image_url) {
    return (
      <div className={styles.imageLoading}>
        <span>🖼️</span>
      </div>
    );
  }

  return (
    <div className={styles.productImageContainer} onClick={onImageClick}>
      <img
        src={product.image_url}
        alt={product.sku}
        className={styles.productImage}
        onLoad={() => setLoading(false)}
        onError={() => setError(true)}
      />
      {loading && (
        <div className={styles.imageLoading}>
          <div className={styles.spinner}></div>
        </div>
      )}
    </div>
  );
};

// Image Modal Component
const ImageModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  imageUrl: string; 
  productName: string 
}> = ({ isOpen, onClose, imageUrl, productName }) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className={styles.imageModal}
      overlayClassName={styles.imageModalOverlay}
    >
      <div className={styles.imageModalContent}>
        <img src={imageUrl} alt={productName} className={styles.modalImage} />
        <button onClick={onClose} className={styles.modalCloseBtn}>
          Close
        </button>
      </div>
    </Modal>
  );
};

export default function ProductList() {
  const { brandName } = useParams<{ brandName?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [printing, setPrinting] = useState(false);
  const [printingItems, setPrintingItems] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const productsPerPage = 25;

  useEffect(() => {
    if (brandName) {
      loadProducts();
    }
  }, [brandName]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setLoadingProgress(20);
      
      // Get brand info from Supabase
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('brand_normalized', brandName?.toLowerCase())
        .single();

      if (brandError) {
        console.error('Brand not found:', brandError);
        setLoadingProgress(100);
        setLoading(false);
        return;
      }

      setLoadingProgress(50);

      // Load products from Supabase
      const { data: items, error } = await supabase
        .from('items')
        .select('*')
        .eq('brand_id', brandData.id)
        .eq('status', 'active')
        .gt('retail_price', 0)
        .order('name');

      if (error) throw error;

      setLoadingProgress(80);

      const products: Product[] = (items || []).map(item => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        ean: item.ean,
        stock_level: item.gross_stock_level || 0,
        retail_price: item.retail_price || 0,
        brand: brandData.brand_name,
        brand_id: brandData.id,
        quantity: 1,
        selected: false,
        image_url: item.image_url
      }));

      setProducts(products);
      setLoadingProgress(100);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, quantity: Math.max(1, quantity) } : p
    ));
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setProducts(prev => prev.map(p => 
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allSelected = filteredProducts.every(p => p.selected);
    setProducts(prev => prev.map(p => ({ ...p, selected: !allSelected })));
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const selectedProducts = useMemo(() => {
    return products.filter(p => p.selected);
  }, [products]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  const handleImageClick = (product: Product) => {
    if (product.image_url) {
      setSelectedImage({ url: product.image_url, name: product.name });
    }
  };

  const exportPDF = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select some products to export');
      return;
    }

    const comp = window.prompt('Enter Customer Name:', companyName);
    if (comp === null) return;
    const agent = window.prompt('Enter Sales Agent Name:', agentName);
    if (agent === null) return;
    setCompanyName(comp);
    setAgentName(agent);

    setPrinting(true);
    
    // Small delay to ensure state update
    await new Promise((r) => setTimeout(r, 50));

    const items = await Promise.all(
      selectedProducts.map(async (product) => {
        const total = product.retail_price * product.quantity;
        let dataUrl = '';

        try {
          if (product.image_url) {
            const resp = await fetch(product.image_url);
            const blob = await resp.blob();
            const b64 = await blobToBase64(blob);
            dataUrl = `data:${blob.type};base64,${b64}`;
          } else {
            const resp = await fetch('/fallback.png');
            const blob = await resp.blob();
            const b64 = await blobToBase64(blob);
            dataUrl = `data:${blob.type};base64,${b64}`;
          }
        } catch {
          const resp = await fetch('/fallback.png');
          const blob = await resp.blob();
          const b64 = await blobToBase64(blob);
          dataUrl = `data:${blob.type};base64,${b64}`;
        }

        const barcodeDataUrl = product.ean ? generateBarcodeDataUrl(product.ean) : '';
        return { original: product, dataUrl, barcodeDataUrl, quantity: product.quantity, total };
      })
    );

    setPrintingItems(items);
    await new Promise((r) => setTimeout(r, 50));

    const el = document.getElementById('pdf-content')!;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
    
    // Wait for all images to load
    const images = el.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map(
        img =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
            } else {
              img.onload = () => resolve(null);
              img.onerror = () => resolve(null);
            }
          })
      )
    );
    
    // Additional wait to ensure rendering is complete
    await new Promise((r) => setTimeout(r, 100));
    
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 794, // A4 width in pixels at 96 DPI
      backgroundColor: '#ffffff'
    });
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    
    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    pdf.save('photo-quotation.pdf');

    el.style.display = 'none';
    setPrinting(false);
  };

  const exportExcel = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select some products to export');
      return;
    }

    const rows = await Promise.all(
      selectedProducts.map(async (product) => {
        let imgBase64 = '';
        try {
          if (product.image_url) {
            const resp = await fetch(product.image_url);
            const blob = await resp.blob();
            imgBase64 = await blobToBase64(blob);
          }
        } catch {
          imgBase64 = '';
        }
        return { original: product, imgBase64, qty: product.quantity };
      })
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stocklist');

    ws.addRow(['Image', 'Name', 'SKU', 'EAN', 'Price', 'Qty', 'Total']);

    [12, 30, 15, 15, 12, 8, 12].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    rows.forEach(({ original, imgBase64, qty }, idx) => {
      const total = original.retail_price * qty;
      const rowIndex = idx + 2;

      ws.addRow(['', original.name, original.sku, original.ean || '', original.retail_price, qty, total]);

      if (imgBase64) {
        const imageId = wb.addImage({
          base64: imgBase64,
          extension: 'png',
        });
        ws.addImage(imageId, {
          tl: { col: 0, row: rowIndex - 1 },
          ext: { width: 50, height: 50 },
          editAs: 'oneCell',
        });
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'stocklist.xlsx');
  };

  const handleImageUpload = async (productId: string, file: File) => {
    if (!file) return;
    
    try {
      // Upload to Supabase Storage
      const fileName = `${productId}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Update product with image URL
      const { error: updateError } = await supabase
        .from('items')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Refresh products
      await loadProducts();
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    }
  };

  if (loading) {
    return (
      <ProgressLoader
        isVisible={true}
        progress={loadingProgress}
        message="Loading products..."
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Products</h1>
          <p>Manage your inventory items</p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={`${styles.btn} ${styles.btnSecondary}`} 
            onClick={exportExcel}
            disabled={selectedProducts.length === 0}
          >
            <FileText size={20} /> Excel Quote
          </button>
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`} 
            onClick={exportPDF}
            disabled={selectedProducts.length === 0}
          >
            <Download size={20} /> PDF Quote
          </button>
        </div>
      </div>

      {/* Brand Banner */}
      {brandName && (
        <div className={styles.brandBanner}>
          <img
            src={`/logos/${normalize(brandName)}.png`}
            alt={`${brandName} logo`}
            className={styles.brandLogo}
          />
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.selectionInfo}>
          {selectedProducts.length > 0 && (
            <span className={styles.selectedCount}>
              <ShoppingCart size={16} />
              {selectedProducts.length} selected
            </span>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className={styles.tableContainer}>
        {filteredProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📦</div>
            <h3>No Products Found</h3>
            <p>Try adjusting your search or add new products.</p>
          </div>
        ) : (
          <>
            <div className={styles.tableHeader}>
              <div className={styles.tableHeaderRow}>
                <div className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => p.selected)}
                    onChange={toggleSelectAll}
                    className={styles.checkbox}
                  />
                </div>
                <div>Image</div>
                <div>Name</div>
                <div>SKU</div>
                <div>Price</div>
                <div>Quantity</div>
                <div>Total</div>
                <div>Stock</div>
                <div>Upload</div>
              </div>
            </div>
            
            <div className={styles.tableBody}>
              {currentProducts.map((product) => (
                <div key={product.id} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    <input
                      type="checkbox"
                      checked={product.selected}
                      onChange={() => toggleSelection(product.id)}
                      className={styles.checkbox}
                    />
                  </div>
                  
                  <div className={styles.tableCell}>
                    <ProductImage 
                      product={product} 
                      onImageClick={() => handleImageClick(product)}
                    />
                  </div>
                  
                  <div className={styles.tableCell} data-label="Name">
                    <div className={styles.productName}>{product.name}</div>
                  </div>
                  
                  <div className={styles.tableCell} data-label="SKU">
                    <div className={styles.productSku}>{product.sku}</div>
                  </div>
                  
                  <div className={styles.tableCell} data-label="Price">
                    <div className={styles.price}>£{product.retail_price.toFixed(2)}</div>
                  </div>
                  
                  <div className={styles.tableCell} data-label="Quantity">
                    <input
                      type="number"
                      min={1}
                      value={product.quantity}
                      onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                      className={styles.quantityInput}
                    />
                  </div>
                  
                  <div className={styles.tableCell} data-label="Total">
                    <div className={styles.total}>
                      £{(product.retail_price * product.quantity).toFixed(2)}
                    </div>
                  </div>
                  
                  <div className={styles.tableCell} data-label="Stock">
                    <span className={`${styles.stockBadge} ${
                      product.stock_level > 0 ? styles.stockIn : styles.stockOut
                    }`}>
                      {product.stock_level > 0 ? `In Stock (${product.stock_level})` : 'Out of Stock'}
                    </span>
                  </div>
                  
                  <div className={styles.tableCell} data-label="Upload">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(product.id, file);
                      }}
                      className={styles.fileInput}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {(currentPage - 1) * productsPerPage + 1} to {Math.min(currentPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} products
          </div>
          <div className={styles.paginationControls}>
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
        </div>
      )}

      {/* Loading Overlay */}
      {printing && (
        <ProgressLoader
          isVisible={true}
          progress={50}
          message="Generating quote..."
        />
      )}

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          isOpen={true}
          onClose={() => setSelectedImage(null)}
          imageUrl={selectedImage.url}
          productName={selectedImage.name}
        />
      )}

      {/* PDF Template - Hidden by default */}
      <div
        id="pdf-content"
        className={styles.pdfTemplate}
        style={{ 
          display: 'none',
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: '794px',
          padding: '40px',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <div className={styles.pdfHeader}>
          <h3 className={styles.pdfTitle} style={{ color: '#333333', margin: 0 }}>Photo Quote</h3>
        </div>
        <div className={styles.pdfCustomerInfo}>
          <h1 className={styles.pdfCustomerName} style={{ color: '#000000' }}>{companyName}</h1>
          <p className={styles.pdfAgentName} style={{ color: '#666666' }}>{agentName}</p>
        </div>
        <table className={styles.pdfTable} style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Image</th>
              <th style={{ textAlign: 'left', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>SKU</th>
              <th style={{ textAlign: 'left', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Name</th>
              <th style={{ textAlign: 'right', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Rate</th>
              <th style={{ textAlign: 'center', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Stock Status</th>
              <th style={{ textAlign: 'center', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Quantity</th>
              <th style={{ textAlign: 'right', backgroundColor: '#f5f5f5', padding: '12px', color: '#000000', borderBottom: '2px solid #333' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printingItems.map(({ original, dataUrl, barcodeDataUrl, quantity, total }) => (
              <tr key={original.id}>
                <td className={styles.pdfImageCell} style={{ padding: '12px', borderBottom: '1px solid #ddd', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img src={dataUrl} alt={original.sku} style={{ width: '60px', height: '60px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '4px' }} />
                    {barcodeDataUrl && (
                      <img src={barcodeDataUrl} alt={`Barcode for ${original.ean}`} style={{ width: '100px', height: 'auto' }} />
                    )}
                  </div>
                </td>
                <td style={{ fontSize: '12px', fontFamily: 'monospace', color: '#000000', padding: '12px', borderBottom: '1px solid #ddd' }}>{original.sku}</td>
                <td style={{ fontSize: '13px', maxWidth: '200px', color: '#000000', padding: '12px', borderBottom: '1px solid #ddd' }}>{original.name}</td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: '#000000', padding: '12px', borderBottom: '1px solid #ddd' }}>£{original.retail_price.toFixed(2)}</td>
                <td style={{ textAlign: 'center', fontSize: '12px', color: original.stock_level > 0 ? '#22c55e' : '#ef4444', padding: '12px', borderBottom: '1px solid #ddd' }}>
                  {original.stock_level > 0 ? 'In Stock' : 'Out of Stock'}
                </td>
                <td style={{ textAlign: 'center', fontSize: '13px', color: '#000000', padding: '12px', borderBottom: '1px solid #ddd' }}>{quantity}</td>
                <td style={{ textAlign: 'right', fontSize: '14px', fontWeight: '600', color: '#000000', padding: '12px', borderBottom: '1px solid #ddd' }}>£{total.toFixed(2)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
              <td colSpan={6} style={{ textAlign: 'right', paddingTop: '15px', fontSize: '14px', color: '#000000' }}>Grand Total:</td>
              <td style={{ textAlign: 'right', paddingTop: '15px', fontSize: '16px', color: '#000000', fontWeight: 'bold' }}>
                £{printingItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles.pdfFooter} style={{ marginTop: '30px', padding: '10px', backgroundColor: '#f5f5f5' }}>
          <div className={styles.pdfDate} style={{ color: '#666666' }}>Date: {new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
