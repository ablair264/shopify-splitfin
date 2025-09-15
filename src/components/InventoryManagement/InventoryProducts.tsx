import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Package2, 
  Search, 
  Filter, 
  Plus,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Image,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bot,
  Sparkles,
  Upload
} from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import { useComponentLoader, withLoader } from '../../hoc/withLoader';
import ProductDetailsModal from './ProductDetailsModal';
import EditProductModal from './EditProductModal';
import AddProductModal from './AddProductModal';
import { AIProductEnricher } from '../AIProductEnricher';
import PricelistUpload from './PricelistUpload';
import styles from './InventoryProducts.module.css';

const ITEMS_PER_PAGE = 25;

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
  status: string;
  image_url?: string;
  created_date: string;
}

const SORT_OPTIONS = [
  { label: 'Newest to Oldest', value: 'created_newest' },
  { label: 'Oldest to Newest', value: 'created_oldest' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Stock (Low to High)', value: 'stock_asc' },
  { label: 'Stock (High to Low)', value: 'stock_desc' }
];

const InventoryProducts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showLoader, hideLoader, setProgress } = useComponentLoader();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    brand: searchParams.get('brand') || '',
    stockFilter: searchParams.get('filter') || '',
    sort: searchParams.get('sort') || 'stock_desc'
  });

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIEnrichModal, setShowAIEnrichModal] = useState(false);
  const [showPricelistUpload, setShowPricelistUpload] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);

  const loadUserInfo = async () => {
    try {
      showLoader('Loading user information...');
      setProgress(10);
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Auth user:', user);
      if (!user) {
        setError('No authenticated user found');
        setLoading(false);
        hideLoader();
        return;
      }

      setProgress(30);
      const { data: userData, error } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();
      
      console.log('User data query result:', userData, error);

      if (error) {
        console.error('Error fetching user data:', error);
        setError('Error loading user data');
        setLoading(false);
        hideLoader();
        return;
      }

      if (userData?.company_id) {
        setCompanyId(userData.company_id);
        setProgress(50);
      } else {
        setError('No company information found');
        setLoading(false);
        hideLoader();
      }
    } catch (error) {
      console.error('Error loading user info:', error);
      setError('Error loading user information');
      setLoading(false);
      hideLoader();
    }
  };

  const fetchBrands = useCallback(async () => {
    try {
      if (!companyId) {
        console.error('No company_id available');
        return;
      }

      setProgress(60);
      const { data, error } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('brand_name');

      if (error) {
        console.error('Error fetching brands:', error);
        return;
      }

      if (data) {
        setBrands(data);
        setProgress(70);
      }
    } catch (err) {
      console.error('Error in fetchBrands:', err);
    }
  }, [companyId, setProgress]);

  const loadItems = useCallback(async (page = 1, isInitialLoad = false) => {
    try {
      // Only show loader if this is the first load
      if (isInitialLoad) {
        showLoader('Loading inventory...');
        setProgress(80);
      }
      setLoading(true);
      setError(null);

      if (!companyId) {
        setError('No company information available');
        setLoading(false);
        if (isInitialLoad) hideLoader();
        return;
      }
      
      // Build base query
      let query = supabase
        .from('items')
        .select(`
          *,
          brands!inner (
            id,
            brand_name
          )
        `, { count: 'exact' })
        .eq('brands.company_id', companyId)
        .eq('status', 'active');

      // Apply brand filter
      if (filters.brand) {
        query = query.eq('brand_id', filters.brand);
      }

      // Apply search filter
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }

      // Apply stock filter
      if (filters.stockFilter === 'out-of-stock') {
        query = query.eq('gross_stock_level', 0);
      } else if (filters.stockFilter === 'low-stock') {
        query = query.gt('reorder_level', 0).lte('gross_stock_level', 'reorder_level');
      } else if (filters.stockFilter === 'in-stock') {
        query = query.gt('gross_stock_level', 0);
      }

      // Apply sorting
      switch (filters.sort) {
        case 'created_newest':
          query = query.order('created_date', { ascending: false });
          break;
        case 'created_oldest':
          query = query.order('created_date', { ascending: true });
          break;
        case 'name_asc':
          query = query.order('name', { ascending: true });
          break;
        case 'name_desc':
          query = query.order('name', { ascending: false });
          break;
        case 'stock_asc':
          query = query.order('gross_stock_level', { ascending: true });
          break;
        case 'stock_desc':
          query = query.order('gross_stock_level', { ascending: false });
          break;
      }

      // Pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      if (data) {
        const formattedItems = data.map((item: any) => ({
          ...item,
          brand_name: item.brands?.brand_name
        }));
        setItems(formattedItems);
        setTotalItems(count || 0);
        setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE));
        setCurrentPage(page);
        if (isInitialLoad) {
          setProgress(100);
          setTimeout(() => hideLoader(), 300);
        }
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load products');
      if (isInitialLoad) hideLoader();
    } finally {
      setLoading(false);
    }
  }, [filters, companyId, showLoader, hideLoader, setProgress]);

  // Load user info on mount
  useEffect(() => {
    loadUserInfo();
  }, []);

  // Fetch brands when companyId is available
  useEffect(() => {
    if (companyId) {
      fetchBrands();
    }
  }, [companyId, fetchBrands]);

  // Load items when filters change and companyId is available
  useEffect(() => {
    if (companyId) {
      loadItems(1, items.length === 0);
    }
  }, [filters, companyId]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  const handlePageChange = (page: number) => {
    loadItems(page, false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      const { error } = await supabase
        .from('items')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (!error) {
        loadItems(currentPage, false);
      }
    }
  };

  const getStockStatusIcon = (item: InventoryItem) => {
    if (item.gross_stock_level === 0) {
      return <XCircle className={styles.stockIconOut} size={16} />;
    }
    if (item.reorder_level > 0 && item.gross_stock_level <= item.reorder_level) {
      return <AlertTriangle className={styles.stockIconLow} size={16} />;
    }
    return <CheckCircle className={styles.stockIconIn} size={16} />;
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(value);
  };

  if (loading && items.length === 0 && !error) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <h3>Loading Products...</h3>
        <p>Please wait while we fetch your inventory</p>
      </div>
    );
  }

  // Show empty state only after loading is complete and no error
  if (!loading && items.length === 0 && !error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1>Inventory Management</h1>
            <p className={styles.subtitle}>
              Manage your product catalog and inventory
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.aiEnrichButton}
              onClick={() => setShowAIEnrichModal(true)}
              title="Enhance products with AI"
            >
              <Sparkles size={18} />
              AI Enhance
            </button>
            <button 
              className={styles.addButton}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        </div>
        
        <div className={styles.emptyState}>
          <Package2 size={64} />
          <h3>No products found</h3>
          <p>Get started by adding your first product to the inventory</p>
          <button 
            className={styles.addButton}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            Add First Product
          </button>
        </div>
        
        {showAddModal && (
          <AddProductModal
            brands={brands}
            onClose={() => setShowAddModal(false)}
            onAdd={() => {
              loadItems(1, false);
              setShowAddModal(false);
            }}
          />
        )}

        {showAIEnrichModal && companyId && (
          <AIProductEnricher
            companyId={companyId}
            onClose={() => setShowAIEnrichModal(false)}
            onComplete={() => {
              // Refresh the product list after enrichment
              loadItems(currentPage, false);
              setShowAIEnrichModal(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1>Inventory Management</h1>
          <p className={styles.subtitle}>
            Manage your product catalog and inventory
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.pricelistButton}
            onClick={() => setShowPricelistUpload(true)}
            title="Upload supplier pricelists"
          >
            <Upload size={18} />
            Upload Pricelists
          </button>
          <button 
            className={styles.aiEnrichButton}
            onClick={() => setShowAIEnrichModal(true)}
            title="Enhance products with AI"
          >
            <Sparkles size={18} />
            AI Enhance
          </button>
          <button 
            className={styles.addButton}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
      </div>

      <div className={styles.filtersSection}>
        <div className={styles.searchBox}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <Filter size={18} />
          <select
            value={filters.brand}
            onChange={(e) => handleFilterChange('brand', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Brands</option>
            {brands.map(brand => (
              <option key={brand.id} value={brand.id}>
                {brand.brand_name}
              </option>
            ))}
          </select>

          <select
            value={filters.stockFilter}
            onChange={(e) => handleFilterChange('stockFilter', e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Stock Levels</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

          <select
            value={filters.sort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
            className={styles.filterSelect}
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <XCircle />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.resultsInfo}>
        <span>
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
          {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems} products
        </span>
      </div>

      <div className={styles.productsGrid}>
        {items.map(item => (
          <div key={item.id} className={styles.productCard}>
            <div className={styles.productImage}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} />
              ) : (
                <div className={styles.imagePlaceholder}>
                  <Image size={40} />
                </div>
              )}
            </div>
            
            <div className={styles.productInfo}>
              <h3 className={styles.productName}>{item.name}</h3>
              <p className={styles.productSku}>SKU: {item.sku}</p>
              <p className={styles.productBrand}>{item.brand_name}</p>
              
              <div className={styles.stockInfo}>
                {getStockStatusIcon(item)}
                <span>Stock: {item.gross_stock_level}</span>
              </div>
              
              <p className={styles.productPrice}>
                {formatCurrency(item.retail_price)}
              </p>
            </div>

            <div className={styles.productActions}>
              <button
                className={styles.actionButton}
                onClick={() => {
                  setSelectedProduct(item);
                  setShowDetailsModal(true);
                }}
                title="View Details"
              >
                <Eye size={18} />
              </button>
              <button
                className={styles.actionButton}
                onClick={() => {
                  setSelectedProduct(item);
                  setShowEditModal(true);
                }}
                title="Edit"
              >
                <Edit2 size={18} />
              </button>
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => handleDeleteProduct(item.id)}
                title="Delete"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageButton}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          
          <button
            className={styles.pageButton}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showDetailsModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedProduct(null);
          }}
        />
      )}

      {showEditModal && selectedProduct && (
        <EditProductModal
          product={selectedProduct}
          brands={brands}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onUpdate={() => {
            loadItems(currentPage, false);
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
        />
      )}

      {showAddModal && (
        <AddProductModal
          brands={brands}
          onClose={() => setShowAddModal(false)}
          onAdd={() => {
            loadItems(1, false);
            setShowAddModal(false);
          }}
        />
      )}

      {showAIEnrichModal && companyId && (
        <AIProductEnricher
          companyId={companyId}
          onClose={() => setShowAIEnrichModal(false)}
          onComplete={() => {
            // Refresh the product list after enrichment
            loadItems(currentPage, false);
            setShowAIEnrichModal(false);
          }}
        />
      )}

      {showPricelistUpload && (
        <PricelistUpload
          onClose={() => {
            setShowPricelistUpload(false);
            // Refresh the product list after pricelist updates
            loadItems(currentPage, false);
          }}
        />
      )}
    </div>
  );
};

export default withLoader(InventoryProducts);