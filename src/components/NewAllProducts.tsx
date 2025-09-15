import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { withLoader } from '../hoc/withLoader';
import { NewProductCard } from './NewProductCard';
import { NewProductListItem } from './NewProductListItem';
import NewQuickViewModal from './NewQuickViewModal';
import BarcodeScanner from './BarcodeScanner';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { BarcodeService } from '../services/barcodeService';
import { Search, Filter, ArrowUpDown, Grid3X3, List, ShoppingCart, X, Scan, Camera, CheckCircle, HelpCircle, ChevronDown, Package } from 'lucide-react';
import './NewProductCard.css';
import './NewProductListItem.css';
import './NewQuickViewModal.css';
import './NewAllProducts.css';


// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Brand {
  id: string;
  brand_name: string;
  brand_normalized: string;
  logo_url?: string;
  company_id: string;
  is_active: boolean;
}

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
  legacy_item_id?: string;
  brand?: Brand;
  [key: string]: any;
}

interface LineItem {
  product: Product;
  qty: number;
  total: number;
}

interface Customer {
  id: string;
  display_name: string;
  trading_name: string;
  email?: string;
  phone?: string;
  linked_sales_user?: string;
  linked_company: string;
  is_active: boolean;
  [key: string]: any;
}

function NewAllProducts() {
  const { customerId, brand: brandID } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  
  // Filter and view states
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColour, setSelectedColour] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [visibleProducts, setVisibleProducts] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [showScanHelp, setShowScanHelp] = useState(false);
  
  // Data states
  const [categories, setCategories] = useState<string[]>([]);
  const [colours, setColours] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  
  // Modal and cart states
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  
  // Barcode scanner states
  const [scannerActive, setScannerActive] = useState(true);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not-found'>('idle');
  const [scannedProductConfirmation, setScannedProductConfirmation] = useState<{ name: string; sku: string } | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSalesAgent = user.role === 'Sales';

  // Brand document
  const brandDoc = useMemo(() => {
    if (products.length === 0) return null;
    const brand = products[0].brand;
    if (!brand) return null;
    
    return {
      name: brand.brand_name,
      brand_normalized: brand.brand_normalized,
      logoUrl: brand.logo_url || `/logos/${brand.brand_normalized}.png`,
    };
  }, [products]);

  // Pagination state
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalProductCount, setTotalProductCount] = useState(0);
  const ITEMS_PER_PAGE = 200;

  // Load products from Supabase with pagination
  useEffect(() => {
    if (!brandID) {
      console.error('No brandID provided to NewAllProducts');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setProducts([]); // Reset products when brandID changes
    setHasMoreProducts(true);
    
    const loadInitialProducts = async () => {
      try {
        const { data: brandData, error: brandError } = await supabase
          .from('brands')
          .select('id, brand_name, brand_normalized, logo_url, company_id')
          .eq('brand_normalized', brandID.toLowerCase())
          .eq('is_active', true)
          .single();

        if (brandError || !brandData) {
          console.error('Error fetching brand:', brandError);
          setProducts([]);
          setLoading(false);
          return;
        }

        // Get total count first
        const { count: totalCount } = await supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brandData.id)
          .eq('status', 'active');

        setTotalProductCount(totalCount || 0);

        // Load first batch of products
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select(`
            id, name, description, category, colour, image_url, sku, ean,
            retail_price, cost_price, purchase_price, gross_stock_level,
            net_stock_level, status, created_date, updated_at, manufacturer,
            height, width, length, diameter, packing_unit, catalogue_page_number,
            legacy_item_id
          `)
          .eq('brand_id', brandData.id)
          .eq('status', 'active')
          .order('name')
          .range(0, ITEMS_PER_PAGE - 1);

        if (itemsError) {
          console.error('Error fetching items:', itemsError);
          setProducts([]);
          setLoading(false);
          return;
        }

        const items: Product[] = [];
        const qInit: Record<string, number> = {};
        const uniqueCategories = new Set<string>();
        const uniqueColours = new Set<string>();

        // Load saved quantities
        let savedQuantities: Record<string, number> = {};
        if (selectedCustomer) {
          const quantitiesKey = `ORDER_QUANTITIES_${selectedCustomer.id}`;
          try {
            const storedQuantities = localStorage.getItem(quantitiesKey);
            if (storedQuantities) {
              savedQuantities = JSON.parse(storedQuantities);
            }
          } catch {
            // Ignore parse errors
          }
        }

        itemsData?.forEach((item) => {
          const product: Product = {
            id: item.id,
            name: item.name || '',
            sku: item.sku || '',
            gross_stock_level: item.gross_stock_level || 0,
            net_stock_level: item.net_stock_level || 0,
            retail_price: item.retail_price || 0,
            cost_price: item.cost_price || 0,
            purchase_price: item.purchase_price || 0,
            brand_id: brandData.id,
            manufacturer: item.manufacturer,
            image_url: item.image_url,
            category: item.category || '',
            colour: item.colour || '',
            description: item.description || '',
            ean: item.ean || '',
            status: item.status as 'active' | 'inactive',
            created_date: item.created_date,
            updated_at: item.updated_at,
            height: item.height,
            width: item.width,
            length: item.length,
            diameter: item.diameter,
            packing_unit: item.packing_unit,
            catalogue_page_number: item.catalogue_page_number,
            legacy_item_id: item.legacy_item_id,
            brand: { ...brandData, is_active: true }
          };
          
          items.push(product);
          const packingUnit = item.packing_unit || 1;
          qInit[item.id] = savedQuantities[item.id] || packingUnit;
          
          if (item.category) uniqueCategories.add(item.category);
          if (item.colour) uniqueColours.add(item.colour);
        });
        
        setProducts(items);
        setQuantities(qInit);
        setCategories(Array.from(uniqueCategories).sort());
        setColours(Array.from(uniqueColours).sort());
        setHasMoreProducts(items.length >= ITEMS_PER_PAGE);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialProducts();
  }, [brandID, selectedCustomer]);

  // Load more products function
  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMoreProducts) return;

    setLoadingMore(true);
    try {
      const brand = products[0]?.brand;
      if (!brand) return;

      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, name, description, category, colour, image_url, sku, ean,
          retail_price, cost_price, purchase_price, gross_stock_level,
          net_stock_level, status, created_date, updated_at, manufacturer,
          height, width, length, diameter, packing_unit, catalogue_page_number,
          legacy_item_id
        `)
        .eq('brand_id', brand.id)
        .eq('status', 'active')
        .order('name')
        .range(products.length, products.length + ITEMS_PER_PAGE - 1);

      if (itemsError) {
        console.error('Error fetching more items:', itemsError);
        return;
      }

      if (!itemsData || itemsData.length === 0) {
        setHasMoreProducts(false);
        return;
      }

      // Load saved quantities for new items
      let savedQuantities: Record<string, number> = {};
      if (selectedCustomer) {
        const quantitiesKey = `ORDER_QUANTITIES_${selectedCustomer.id}`;
        try {
          const storedQuantities = localStorage.getItem(quantitiesKey);
          if (storedQuantities) {
            savedQuantities = JSON.parse(storedQuantities);
          }
        } catch {
          // Ignore parse errors
        }
      }

      const newItems: Product[] = [];
      const newQuantities: Record<string, number> = { ...quantities };
      const newCategories = new Set(categories);
      const newColours = new Set(colours);

      itemsData.forEach((item) => {
        const product: Product = {
          id: item.id,
          name: item.name || '',
          sku: item.sku || '',
          gross_stock_level: item.gross_stock_level || 0,
          net_stock_level: item.net_stock_level || 0,
          retail_price: item.retail_price || 0,
          cost_price: item.cost_price || 0,
          purchase_price: item.purchase_price || 0,
          brand_id: brand.id,
          manufacturer: item.manufacturer,
          image_url: item.image_url,
          category: item.category || '',
          colour: item.colour || '',
          description: item.description || '',
          ean: item.ean || '',
          status: item.status as 'active' | 'inactive',
          created_date: item.created_date,
          updated_at: item.updated_at,
          height: item.height,
          width: item.width,
          length: item.length,
          diameter: item.diameter,
          packing_unit: item.packing_unit,
          catalogue_page_number: item.catalogue_page_number,
          legacy_item_id: item.legacy_item_id,
          brand: { ...brand, is_active: true }
        };
        
        newItems.push(product);
        const packingUnit = item.packing_unit || 1;
        newQuantities[item.id] = savedQuantities[item.id] || packingUnit;
        
        if (item.category) newCategories.add(item.category);
        if (item.colour) newColours.add(item.colour);
      });

      setProducts(prev => [...prev, ...newItems]);
      setQuantities(newQuantities);
      setCategories(Array.from(newCategories).sort());
      setColours(Array.from(newColours).sort());
      setHasMoreProducts(newItems.length >= ITEMS_PER_PAGE);
    } catch (err) {
      console.error('Error loading more products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreProducts, products, quantities, selectedCustomer]);

  // Customer fetching logic (keeping existing)
  useEffect(() => {
    if (location.state?.selectedCustomer) {
      setSelectedCustomer(location.state.selectedCustomer);
      return;
    }

    if (customerId) {
      const fetchCustomer = async () => {
        try {
          const { data: customerData, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('is_active', true)
            .single();

          if (error || !customerData) {
            setShowModal(true);
          } else {
            setSelectedCustomer(customerData);
            localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customerData));
          }
        } catch (err) {
          setShowModal(true);
        }
      };
      fetchCustomer();
      return;
    }

    const stored = localStorage.getItem('SELECTED_CUSTOMER');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setSelectedCustomer(parsed);
          return;
        }
      } catch {
        // ignore parse error
      }
    }

    setShowModal(true);
  }, [location.state, customerId]);

  // Fetch customers for sales agent
  useEffect(() => {
    if (!isSalesAgent || !user.id) return;

    const fetchCustomers = async () => {
      try {
        const { data: customersData, error } = await supabase
          .from('customers')
          .select('*')
          .eq('linked_sales_user', user.id)
          .eq('is_active', true);

        if (!error) {
          setAllCustomers(customersData || []);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      }
    };

    fetchCustomers();
  }, [user.id, isSalesAgent]);

  // Load/save selections
  useEffect(() => {
    if (selectedCustomer) {
      const selectedKey = `ORDER_SELECTED_${selectedCustomer.id}`;
      const quantitiesKey = `ORDER_QUANTITIES_${selectedCustomer.id}`;
      
      try {
        const storedSelected = localStorage.getItem(selectedKey);
        const storedQuantities = localStorage.getItem(quantitiesKey);
        
        setSelected(storedSelected ? JSON.parse(storedSelected) : {});
        
        if (storedQuantities) {
          const parsedQuantities = JSON.parse(storedQuantities);
          setQuantities(prev => ({ ...prev, ...parsedQuantities }));
        }
      } catch {
        setSelected({});
      }
    }
  }, [selectedCustomer]);

  // Save selections to localStorage
  useEffect(() => {
    if (selectedCustomer) {
      const timeoutId = setTimeout(() => {
        const selectedKey = `ORDER_SELECTED_${selectedCustomer.id}`;
        const quantitiesKey = `ORDER_QUANTITIES_${selectedCustomer.id}`;
        
        localStorage.setItem(selectedKey, JSON.stringify(selected));
        
        const selectedQuantities = Object.keys(selected)
          .filter(id => selected[id])
          .reduce((acc, id) => {
            const product = products.find(p => p.id === id);
            const packingUnit = product?.packing_unit || 1;
            acc[id] = quantities[id] || packingUnit;
            return acc;
          }, {} as Record<string, number>);
          
        localStorage.setItem(quantitiesKey, JSON.stringify(selectedQuantities));
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selected, quantities, selectedCustomer, products]);

  // Enhanced filtering
  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    
    let result = products.filter((p) =>
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    );
    
    if (hideOutOfStock) {
      result = result.filter(p => p.net_stock_level > 0);
    }
    
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    if (selectedColour !== 'all') {
      result = result.filter(p => p.colour === selectedColour);
    }
    
    if (sortBy === 'none') {
      result.sort((a, b) => b.id.localeCompare(a.id));
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.retail_price - b.retail_price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.retail_price - a.retail_price);
    }
    
    return result;
  }, [products, debouncedSearch, hideOutOfStock, selectedCategory, selectedColour, sortBy]);

  // Barcode scanner handler
  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    if (!scannerActive) return;
    
    setLastScannedBarcode(barcode);
    setScanStatus('scanning');
    
    try {
      // First check if product is already visible in current filtered list
      const visibleProduct = filtered.find(p => 
        p.sku === barcode || p.ean === barcode
      );
      
      if (visibleProduct) {
        // Product found in current view
        setScanStatus('found');
        
        // Add to order with packing unit quantity
        const packingUnit = visibleProduct.packing_unit || 1;
        const currentQty = quantities[visibleProduct.id] || packingUnit;
        const newQty = currentQty + packingUnit;
        
        setQuantities(prev => ({
          ...prev,
          [visibleProduct.id]: newQty
        }));
        
        setSelected(prev => ({
          ...prev,
          [visibleProduct.id]: true
        }));
        
        setScannedProductConfirmation({ name: visibleProduct.name, sku: visibleProduct.sku });
        setTimeout(() => setScannedProductConfirmation(null), 3000); // Hide after 3 seconds
        
        // Log successful scan
        await BarcodeService.logScanEvent(barcode, true, visibleProduct.id);
        
        // Reset status after delay
        setTimeout(() => setScanStatus('idle'), 2000);
        return;
      }
      
      // Search database for product
      const foundProduct = await BarcodeService.findProductByBarcode(barcode);
      
      if (foundProduct) {
        setScanStatus('found');
        
        // Check if product belongs to current brand
        if (foundProduct.brand_id === brandID) {
          // Product found and belongs to current brand
          const packingUnit = foundProduct.packing_unit || 1;
          
          setQuantities(prev => ({
            ...prev,
            [foundProduct.id]: packingUnit
          }));
          
          setSelected(prev => ({
            ...prev,
            [foundProduct.id]: true
          }));
          
          // Set search to show the product
          setSearch(foundProduct.sku);
          
          // Show quick view modal
          setScannedProductConfirmation({ name: foundProduct.name, sku: foundProduct.sku });
          setTimeout(() => setScannedProductConfirmation(null), 3000); // Hide after 3 seconds
        } else {
          // Product found but wrong brand - show alert
          alert(`Product found but belongs to different brand: ${foundProduct.brand?.brand_name || 'Unknown'}`);
        }
        
        await BarcodeService.logScanEvent(barcode, true, foundProduct.id);
      } else {
        setScanStatus('not-found');
        await BarcodeService.logScanEvent(barcode, false);
        
        // Show not found message
        alert(`Product not found for barcode: ${barcode}`);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      setScanStatus('not-found');
      alert('Error scanning barcode. Please try again.');
    }
    
    // Reset status after delay
    setTimeout(() => setScanStatus('idle'), 2000);
  }, [scannerActive, filtered, quantities, brandID, products]);

  // Initialize barcode scanner
  const { buffer } = useBarcodeScanner({
    onScan: (barcode) => {
      console.log('Scanner triggered with barcode:', barcode);
      handleBarcodeScanned(barcode);
    },
    minLength: 8,
    maxLength: 20,
    timeout: 100
  });

  // Infinite scroll setup
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingRef.current) {
          isLoadingRef.current = true;
          
          // Use setTimeout to debounce rapid intersection changes
          setTimeout(() => {
            // First check if we need to load more data from server
            if (hasMoreProducts && !loadingMore && products.length > 0 && visibleProducts >= filtered.length - 10) {
              loadMoreProducts();
            }
            // Also handle display pagination
            if (visibleProducts < filtered.length) {
              setVisibleProducts(prev => Math.min(prev + 50, filtered.length));
            }
            
            isLoadingRef.current = false;
          }, 50);
        }
      },
      { threshold: 0.1, rootMargin: '500px' }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [filtered.length, visibleProducts, hasMoreProducts, loadingMore, products.length, loadMoreProducts]);

  // Reset visible products when filters change
  useEffect(() => {
    setVisibleProducts(50);
  }, [debouncedSearch, hideOutOfStock, selectedCategory, selectedColour, sortBy]);

  const selectedTotal = useMemo(() => {
    return filtered.reduce((sum, p) => {
      if (!selected[p.id]) return sum;
      return sum + p.cost_price * (quantities[p.id] || 1);
    }, 0);
  }, [filtered, selected, quantities]);

  const selectedItems = useMemo(() => {
    return filtered
      .filter(p => selected[p.id])
      .map(p => ({
        product: p,
        quantity: quantities[p.id] || (p.packing_unit || 1)
      }));
  }, [filtered, selected, quantities]);

  const handleQtyChange = useCallback((id: string, qty: number) => {
    const product = products.find(p => p.id === id);
    const packingUnit = product?.packing_unit || 1;
    const validQty = Math.max(packingUnit, Math.ceil(qty / packingUnit) * packingUnit);
    setQuantities((prev) => ({ ...prev, [id]: validQty }));
  }, [products]);

  const handleAddToOrder = useCallback((prod: Product) => {
    setSelected((prev) => ({ ...prev, [prod.id]: !prev[prod.id] }));
  }, []);

  const handleClearOrder = useCallback(() => {
    setSelected({});
    setQuantities({});
    
    if (selectedCustomer) {
      const selectedKey = `ORDER_SELECTED_${selectedCustomer.id}`;
      const quantitiesKey = `ORDER_QUANTITIES_${selectedCustomer.id}`;
      localStorage.removeItem(selectedKey);
      localStorage.removeItem(quantitiesKey);
    }
  }, [selectedCustomer]);

  const handleReviewOrder = useCallback(() => {
    const itemsToReview: LineItem[] = filtered
      .filter((p) => selected[p.id])
      .map((p) => ({
        product: p,
        qty: quantities[p.id] || 1,
        total: p.cost_price * (quantities[p.id] || 1),
      }));
    navigate('/order-summary', {
      state: {
        items: itemsToReview,
        orderTotal: selectedTotal,
        brand: brandDoc?.name || '',
        customer: selectedCustomer || null,
      },
    });
  }, [filtered, selected, quantities, selectedTotal, brandDoc, selectedCustomer, navigate]);

  const isNewProduct = useCallback((product: Product) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const creationDate = product.created_date || product.updated_at;
    return creationDate ? new Date(creationDate) > thirtyDaysAgo : false;
  }, []);

  if (loading) {
    return (
      <div className="new-allproducts-loading">
        <Lottie
          animationData={loaderAnimation}
          loop
          autoplay
          className="loader-large"
        />
      </div>
    );
  }

  return (
    <>
      <div className="new-allproducts-page">
        {/* Customer Picker Modal */}
        {!selectedCustomer && showModal && (
          <div className="new-customer-picker-modal">
            <div className="new-modal-picker-content">
              <h2>Select a Customer</h2>
              <select
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const customer = allCustomers.find((c) => c.id === selectedId);
                  if (customer) {
                    localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customer));
                    setSelectedCustomer(customer);
                    setShowModal(false);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Select a customer...</option>
                {allCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name || c.trading_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Brand Header with SplitScan */}
        {brandDoc && (
          <div className="new-brand-header-redesign">
            <div className="brand-header-left">
              <img 
                src={brandDoc.logoUrl} 
                alt={brandDoc.name}
                className="brand-header-logo"
                onError={(e) => {
                  e.currentTarget.src = `/logos/${brandDoc.brand_normalized}.png`;
                }}
              />
              <div className="brand-header-info">
                <h1>{brandDoc.name}</h1>
                <p>{filtered.length} Products Available</p>
              </div>
            </div>
            
            {/* SplitScan Section */}
            <div className="splitscan-section-header">
              <img src="/logos/splitscan-logo.png" alt="SplitScan" className="splitscan-logo-large" />
              <div className="splitscan-controls">
                <button 
                  className={`splitscan-btn ${scannerActive ? 'active' : ''}`}
                  onClick={() => setScannerActive(!scannerActive)}
                >
                  <Scan size={20} />
                  <span>Scanner</span>
                </button>
                <button 
                  className="splitscan-btn"
                  onClick={() => setShowCameraScanner(true)}
                >
                  <Camera size={20} />
                  <span>Camera</span>
                </button>
                <button
                  className="splitscan-btn help-btn"
                  onClick={() => setShowScanHelp(true)}
                >
                  <HelpCircle size={20} />
                  <span>Help</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Width Search Bar */}
        <div className="search-bar-container">
          <div className="search-input-wrapper-full">
            <Search className="search-icon" size={20} />
            <input
              type="search"
              placeholder="Search by product name, SKU, or scan barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-full"
            />
            {search && (
              <button 
                className="search-clear-btn"
                onClick={() => setSearch('')}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Control Bar */}
        <div className="control-bar-container">
          <div className="control-bar">
            {/* Controls Section */}
            <div className="controls-section">
              {/* Filters Button */}
              <button 
                className={`control-button filters-button ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter size={18} />
                <span>Filters</span>
                {(selectedCategory !== 'all' || selectedColour !== 'all' || hideOutOfStock) && (
                  <span className="filter-count">
                    {[selectedCategory !== 'all', selectedColour !== 'all', hideOutOfStock].filter(Boolean).length}
                  </span>
                )}
                <ChevronDown size={16} className={`chevron ${showFilters ? 'rotated' : ''}`} />
              </button>

              {/* Stock Toggle */}
              <div className="stock-toggle-wrapper">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={hideOutOfStock}
                    onChange={() => setHideOutOfStock(!hideOutOfStock)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">Hide out of stock</span>
              </div>

              {/* View Toggle */}
              <div className="view-toggle">
                <span className="toggle-label">View:</span>
                <button
                  className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  <Grid3X3 size={18} />
                  <span>Grid</span>
                </button>
                <button
                  className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <List size={18} />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Filters Bar */}
          <div className={`filters-bar ${showFilters ? 'expanded' : ''}`}>
            <div className="filters-content">
              {/* Sort Dropdown */}
              <div className="filter-group">
                <label>Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="filter-select"
                >
                  <option value="none">Default</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
              </div>

              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="filter-group">
                  <label>Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Colour Filter */}
              {colours.length > 0 && (
                <div className="filter-group">
                  <label>Colour</label>
                  <select
                    value={selectedColour}
                    onChange={(e) => setSelectedColour(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Colours</option>
                    {colours.map(colour => (
                      <option key={colour} value={colour}>{colour}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Clear Filters Button */}
              {(selectedCategory !== 'all' || selectedColour !== 'all' || sortBy !== 'none') && (
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedColour('all');
                    setSortBy('none');
                    setHideOutOfStock(false);
                  }}
                >
                  <X size={16} />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="new-products-wrapper" ref={gridWrapperRef}>
          <div className={`new-products-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
            {filtered.slice(0, visibleProducts).map((p, index) => (
              viewMode === 'grid' ? (
                <NewProductCard
                  key={p.id}
                  product={p}
                  quantity={quantities[p.id] || (p.packing_unit || 1)}
                  onQuantityChange={(q) => handleQtyChange(p.id, q)}
                  onAddToOrder={() => handleAddToOrder(p)}
                  isSelected={!!selected[p.id]}
                  onQuickView={() => setQuickViewProduct(p)}
                  showNewBadge={isNewProduct(p)}
                />
              ) : (
                <NewProductListItem
                  key={p.id}
                  product={p}
                  quantity={quantities[p.id] || (p.packing_unit || 1)}
                  onQuantityChange={(q) => handleQtyChange(p.id, q)}
                  onAddToOrder={() => handleAddToOrder(p)}
                  isSelected={!!selected[p.id]}
                  onQuickView={() => setQuickViewProduct(p)}
                  showNewBadge={isNewProduct(p)}
                />
              )
            ))}
          </div>
          {visibleProducts < filtered.length && (
            <div ref={loadMoreRef} className="new-load-more-trigger" />
          )}
          
          {loadingMore && (
            <div className="loading-more-indicator">
              <div className="spinner"></div>
              <p>Loading more products...</p>
            </div>
          )}
          
          {!hasMoreProducts && products.length > 0 && (
            <div className="all-products-loaded">
              <p>All products loaded ({totalProductCount} total)</p>
            </div>
          )}
        </div>

        {/* Scanner Help Modal */}
        {showScanHelp && ReactDOM.createPortal(
          <div className="help-modal-overlay" onClick={() => setShowScanHelp(false)}>
            <div className="help-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-header">
                <h2>How to Use SplitScan</h2>
                <button onClick={() => setShowScanHelp(false)} className="help-close-btn">
                  <X size={20} />
                </button>
              </div>
              <div className="help-modal-body">
                <div className="help-section">
                  <div className="help-icon">
                    <Scan size={32} />
                  </div>
                  <div className="help-text">
                    <h3>Keyboard Scanner</h3>
                    <p>Use a physical barcode scanner connected to your device. When activated (green indicator), simply scan any product barcode to automatically add it to your order.</p>
                  </div>
                </div>
                <div className="help-section">
                  <div className="help-icon">
                    <Camera size={32} />
                  </div>
                  <div className="help-text">
                    <h3>Camera Scanner</h3>
                    <p>Use your device's camera to scan barcodes. Perfect for mobile devices - just point your camera at the barcode and the product will be added automatically.</p>
                  </div>
                </div>
                <div className="help-tips">
                  <h4>Pro Tips:</h4>
                  <ul>
                    <li>Products are automatically added with their default packing unit quantity</li>
                    <li>The scanner will search across all products, even if filtered out</li>
                    <li>A confirmation appears when a product is successfully scanned</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Sliding Cart Summary (keeping existing) */}
        {showCartSummary && ReactDOM.createPortal(
          <div className="new-cart-overlay" onClick={() => setShowCartSummary(false)}>
            <div className="new-cart-modal" onClick={(e) => e.stopPropagation()}>
              <div className="new-cart-header">
                <h3>Order Summary</h3>
                <button 
                  className="new-cart-close"
                  onClick={() => setShowCartSummary(false)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="new-cart-items">
                {selectedItems.length === 0 ? (
                  <p className="new-no-items">No items in order yet</p>
                ) : (
                  selectedItems.map(({ product, quantity }) => (
                    <div key={product.id} className="new-cart-item">
                      <div className="new-cart-item-info">
                        <span className="new-cart-item-name">{product.name}</span>
                        <span className="new-cart-item-sku">{product.sku}</span>
                      </div>
                      <div className="new-cart-item-quantity">
                        <span>{quantity} × £{product.cost_price.toFixed(2)}</span>
                      </div>
                      <button
                        className="new-cart-item-remove"
                        onClick={() => setSelected(prev => ({ ...prev, [product.id]: false }))}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="new-cart-footer">
                <div className="new-cart-total">
                  Total: <strong>£{selectedTotal.toFixed(2)}</strong>
                </div>
                <div className="new-cart-actions">
                  <button
                    className="new-btn-primary"
                    onClick={() => {
                      setShowCartSummary(false);
                      handleReviewOrder();
                    }}
                    disabled={selectedItems.length === 0}
                  >
                    Review Order
                  </button>
                  <button
                    className="new-btn-secondary"
                    onClick={handleClearOrder}
                    disabled={selectedItems.length === 0}
                  >
                    Clear Order
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Quick View Modal */}
        {quickViewProduct && (
          <NewQuickViewModal
            product={quickViewProduct}
            quantity={quantities[quickViewProduct.id] || (quickViewProduct.packing_unit || 1)}
            onQuantityChange={(q) => handleQtyChange(quickViewProduct.id, q)}
            onAddToOrder={() => handleAddToOrder(quickViewProduct)}
            onClose={() => setQuickViewProduct(null)}
          />
        )}

        {/* Camera Barcode Scanner */}
        {showCameraScanner && (
          <BarcodeScanner
            onScan={(barcode) => {
              handleBarcodeScanned(barcode);
              setShowCameraScanner(false);
            }}
            onClose={() => setShowCameraScanner(false)}
          />
        )}
        
        {/* Scan Confirmation Overlay */}
        {ReactDOM.createPortal(
          scannedProductConfirmation && (
            <div className="scan-confirmation-overlay">
              <div className="scan-confirmation-content">
                <CheckCircle size={48} className="scan-success-icon" />
                <h2>Product Added</h2>
                <p><strong>{scannedProductConfirmation.name}</strong></p>
                <p>SKU: {scannedProductConfirmation.sku}</p>
              </div>
            </div>
          ),
          document.body
        )}

        {/* Bottom Bar */}
        {ReactDOM.createPortal(
          <div 
            className="new-bottom-bar-redesign"
            onClick={() => setShowCartSummary(!showCartSummary)}
          >
            <div className="bottom-bar-content">
              <div className="cart-summary-info">
                <div className="cart-icon-wrapper">
                  <ShoppingCart size={24} />
                  {selectedItems.length > 0 && (
                    <span className="cart-badge">{selectedItems.length}</span>
                  )}
                </div>
                <div className="cart-details">
                  <span className="cart-label">Order Total</span>
                  <span className="cart-total">£{selectedTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="bottom-bar-actions">
                <button 
                  className="cart-summary-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCartSummary(!showCartSummary);
                  }}
                >
                  <Package size={18} />
                  View Order ({selectedItems.length})
                </button>
                <button
                  className="place-order-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReviewOrder();
                  }}
                  disabled={selectedItems.length === 0}
                >
                  Place Order
                </button>
                {selectedItems.length > 0 && (
                  <button
                    className="clear-order-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearOrder();
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
}

export default withLoader(NewAllProducts);
