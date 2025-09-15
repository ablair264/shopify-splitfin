import React, { useEffect, useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import styles from './InventoryTableCard.module.css';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  gross_stock_level: number;
  reorder_level: number;
  brand_name?: string;
  category?: string;
  retail_price?: number;
  cost_price?: number;
  purchase_price?: number;
  created_date?: string;
}

interface TableOption {
  id: string;
  title: string;
  subtitle: string;
}

interface InventoryTableCardProps {
  companyId: string;
}

const InventoryTableCard: React.FC<InventoryTableCardProps> = ({ companyId }) => {
  const [selectedTable, setSelectedTable] = useState('top-selling');
  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [brands, setBrands] = useState<any[]>([]);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  const tableOptions: TableOption[] = [
    { id: 'top-selling', title: 'Top Selling Items', subtitle: 'Best performing products' },
    { id: 'top-inventory', title: 'Top Inventory Items', subtitle: 'Highest quantities in stock' },
    { id: 'low-stock', title: 'Low Stock Items', subtitle: 'Items below reorder level' },
    { id: 'out-of-stock', title: 'Out of Stock', subtitle: 'Items with zero stock' },
    { id: 'recent-items', title: 'Recently Added', subtitle: 'Latest items added to catalog' },
    { id: 'high-value', title: 'High Value Items', subtitle: 'Most expensive inventory' }
  ];

  const dateRangeOptions = [
    { id: 'all', label: 'All Time' },
    { id: '7days', label: 'Last 7 Days' },
    { id: '30days', label: 'Last 30 Days' },
    { id: '90days', label: 'Last 90 Days' },
    { id: '1year', label: 'Last Year' }
  ];

  useEffect(() => {
    if (companyId) {
      fetchBrands();
    }
  }, [companyId]);
  
  useEffect(() => {
    if (companyId && brands.length > 0) {
      fetchInventoryData();
    }
  }, [companyId, selectedTable, brandFilter, dateRange, brands]);

  const fetchBrands = async () => {
    try {
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (brandsError) throw brandsError;
      
      if (brandsData && brandsData.length > 0) {
        setBrands(brandsData);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!brands || brands.length === 0) {
        setData([]);
        return;
      }
      
      // Filter by selected brand if not 'all'
      let brandIds = brands.map(brand => brand.id);
      if (brandFilter !== 'all' && brandFilter) {
        brandIds = [brandFilter];
      }

      // Build query based on selected table
      let query = supabase
        .from('items')
        .select('id, name, sku, gross_stock_level, reorder_level, brand_id, retail_price, cost_price, purchase_price, created_date')
        .in('brand_id', brandIds)
        .eq('status', 'active');
      
      // Apply date range filter for 'recent-items'
      if (selectedTable === 'recent-items' && dateRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (dateRange) {
          case '7days':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30days':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90days':
            startDate.setDate(now.getDate() - 90);
            break;
          case '1year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        
        query = query.gte('created_date', startDate.toISOString());
      }

      // Apply filters based on table type
      switch (selectedTable) {
        case 'top-selling':
          // For now, use top inventory as placeholder for top selling
          // TODO: Implement actual sales data query
          query = query
            .not('gross_stock_level', 'is', null)
            .order('gross_stock_level', { ascending: false });
          break;
        case 'top-inventory':
          query = query
            .not('gross_stock_level', 'is', null)
            .order('gross_stock_level', { ascending: false });
          break;
        case 'low-stock':
          // For low stock, we need to use a raw query since Supabase doesn't have direct column comparison
          const { data: lowStockItems, error: lowStockError } = await supabase
            .from('items')
            .select('id, name, sku, gross_stock_level, reorder_level, brand_id, retail_price, cost_price, purchase_price, created_date')
            .in('brand_id', brandIds)
            .eq('status', 'active')
            .not('reorder_level', 'is', null)
            .gt('reorder_level', 0)
            .not('gross_stock_level', 'is', null)
            .order('gross_stock_level', { ascending: true })
            .limit(50); // Get more to filter locally
          
          if (lowStockError) throw lowStockError;
          
          // Filter locally where gross_stock_level <= reorder_level
          const filteredItems = lowStockItems?.filter(item => 
            item.gross_stock_level !== null && 
            item.reorder_level !== null && 
            item.gross_stock_level <= item.reorder_level
          ).slice(0, 8) || [];
          
          // Add brand names to items
          const enrichedItems = filteredItems.map(item => {
            const brand = brands.find(b => b.id === item.brand_id);
            return {
              ...item,
              brand_name: brand?.brand_name || 'Unknown Brand'
            };
          });
          
          setData(enrichedItems);
          return;
        case 'out-of-stock':
          query = query
            .eq('gross_stock_level', 0)
            .order('created_date', { ascending: false });
          break;
        case 'recent-items':
          query = query
            .not('created_date', 'is', null)
            .order('created_date', { ascending: false });
          break;
        case 'high-value':
          // Use retail_price for high value items
          query = query
            .not('retail_price', 'is', null)
            .gt('retail_price', 0)
            .order('retail_price', { ascending: false });
          break;
      }

      const { data: items, error: itemsError } = await query.limit(8);

      if (itemsError) throw itemsError;

      // Add brand names to items
      const enrichedItems = items?.map(item => {
        const brand = brands.find(b => b.id === item.brand_id);
        return {
          ...item,
          brand_name: brand?.brand_name || 'Unknown Brand'
        };
      }) || [];

      setData(enrichedItems);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-GB').format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (item: InventoryItem) => {
    if (item.gross_stock_level === 0) return styles.statusOutOfStock;
    if (item.reorder_level > 0 && item.gross_stock_level <= item.reorder_level) return styles.statusLowStock;
    return styles.statusInStock;
  };

  const getStatusText = (item: InventoryItem) => {
    if (item.gross_stock_level === 0) return 'Out of Stock';
    if (item.reorder_level > 0 && item.gross_stock_level <= item.reorder_level) return 'Low Stock';
    return 'In Stock';
  };

  const currentTable = tableOptions.find(t => t.id === selectedTable);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading inventory data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.accent} />
      <div className={styles.content}>
        {/* Header with dropdown and filters */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.dropdown}>
              <button 
                className={styles.dropdownButton}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div>
                  <h3 className={styles.title}>{currentTable?.title}</h3>
                  <p className={styles.subtitle}>{currentTable?.subtitle}</p>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`} 
                />
              </button>
              
              {dropdownOpen && (
                <div className={styles.dropdownMenu}>
                  {tableOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`${styles.dropdownItem} ${selectedTable === option.id ? styles.dropdownItemActive : ''}`}
                      onClick={() => {
                        setSelectedTable(option.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <div>
                        <div className={styles.dropdownItemTitle}>{option.title}</div>
                        <div className={styles.dropdownItemSubtitle}>{option.subtitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Filters */}
          <div className={styles.headerRight}>
            <div className={styles.filters}>
              {/* Brand Filter */}
              <div className={styles.filterGroup}>
                <button 
                  className={styles.filterButton}
                  onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                >
                  <Filter size={14} />
                  <span>{brandFilter === 'all' ? 'All Brands' : brands.find(b => b.id === brandFilter)?.brand_name || 'All Brands'}</span>
                  <ChevronDown size={14} className={`${styles.filterChevron} ${brandDropdownOpen ? styles.chevronOpen : ''}`} />
                </button>
                
                {brandDropdownOpen && (
                  <div className={styles.filterDropdown}>
                    <button
                      className={`${styles.filterOption} ${brandFilter === 'all' ? styles.filterOptionActive : ''}`}
                      onClick={() => {
                        setBrandFilter('all');
                        setBrandDropdownOpen(false);
                      }}
                    >
                      All Brands
                    </button>
                    {brands.map((brand) => (
                      <button
                        key={brand.id}
                        className={`${styles.filterOption} ${brandFilter === brand.id ? styles.filterOptionActive : ''}`}
                        onClick={() => {
                          setBrandFilter(brand.id);
                          setBrandDropdownOpen(false);
                        }}
                      >
                        {brand.brand_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Date Range Filter - Only show for recent items */}
              {selectedTable === 'recent-items' && (
                <div className={styles.filterGroup}>
                  <button 
                    className={styles.filterButton}
                    onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                  >
                    <span>{dateRangeOptions.find(d => d.id === dateRange)?.label || 'All Time'}</span>
                    <ChevronDown size={14} className={`${styles.filterChevron} ${dateDropdownOpen ? styles.chevronOpen : ''}`} />
                  </button>
                  
                  {dateDropdownOpen && (
                    <div className={styles.filterDropdown}>
                      {dateRangeOptions.map((option) => (
                        <button
                          key={option.id}
                          className={`${styles.filterOption} ${dateRange === option.id ? styles.filterOptionActive : ''}`}
                          onClick={() => {
                            setDateRange(option.id);
                            setDateDropdownOpen(false);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table content */}
        <div className={styles.tableContent}>
          {data.length === 0 ? (
            <div className={styles.emptyState}>No items found</div>
          ) : (
            <>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderCell} style={{ width: '40px' }}>
                  #
                </div>
                <div className={styles.tableHeaderCell} style={{ flex: '1', textAlign: 'left' }}>
                  Product
                </div>
                <div className={styles.tableHeaderCell} style={{ width: '100px', textAlign: 'right' }}>
                  Stock Level
                </div>
              </div>
              
              {data.map((item, index) => (
                <div key={item.id} className={styles.tableRow}>
                  <div className={styles.tableCell} style={{ width: '40px' }}>
                    <span className={styles.rank}>{index + 1}</span>
                  </div>
                  <div className={styles.tableCell} style={{ flex: '1' }}>
                    <div className={styles.productInfo}>
                      <span className={styles.productName}>{item.name}</span>
                      <span className={styles.productDetails}>
                        {item.brand_name} • {item.sku}
                      </span>
                    </div>
                  </div>
                  <div className={styles.tableCell} style={{ width: '100px', textAlign: 'right' }}>
                    <span className={`${styles.stockValue} ${getStatusColor(item)}`}>
                      {formatValue(item.gross_stock_level || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryTableCard;