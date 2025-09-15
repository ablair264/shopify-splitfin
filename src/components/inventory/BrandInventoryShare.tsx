import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseService';
import styles from './BrandInventoryShare.module.css';

interface BrandInventoryData {
  brand_id: string;
  brand_name: string;
  total_stock: number;
  total_value: number;
  percentage: number;
  color: string;
}

interface BrandInventoryShareProps {
  companyId: string;
}

// Color palette for the chart
const COLORS = [
  '#61bc8e', // Green
  '#79d5e9', // Blue
  '#f77d11', // Orange
  '#fbbf24', // Yellow
  '#a78bfa', // Purple
  '#f87171', // Red
  '#34d399', // Emerald
  '#60a5fa', // Light Blue
];

const BrandInventoryShare: React.FC<BrandInventoryShareProps> = ({ companyId }) => {
  const [data, setData] = useState<BrandInventoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBrand, setHoveredBrand] = useState<BrandInventoryData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchBrandInventoryData();
  }, [companyId]);

  const fetchBrandInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get all brands for the company
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (brandsError) {
        throw brandsError;
      }

      if (!brands || brands.length === 0) {
        setData([]);
        return;
      }

      // Get inventory data for each brand
      const brandInventoryPromises = brands.map(async (brand) => {
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('gross_stock_level, cost_price')
          .eq('brand_id', brand.id)
          .eq('status', 'active');

        if (itemsError) {
          console.error(`Error fetching items for brand ${brand.brand_name}:`, itemsError);
          return null;
        }

        // Calculate total stock and value for the brand
        const totalStock = items?.reduce((sum, item) => sum + (item.gross_stock_level || 0), 0) || 0;
        const totalValue = items?.reduce((sum, item) => 
          sum + ((item.gross_stock_level || 0) * (item.cost_price || 0)), 0
        ) || 0;

        return {
          brand_id: brand.id,
          brand_name: brand.brand_name,
          total_stock: totalStock,
          total_value: totalValue,
        };
      });

      const brandInventoryData = (await Promise.all(brandInventoryPromises))
        .filter(item => item !== null) as Omit<BrandInventoryData, 'percentage' | 'color'>[];

      // Calculate percentages based on total stock count
      const totalInventoryStock = brandInventoryData.reduce((sum, brand) => sum + brand.total_stock, 0);
      
      const processedData: BrandInventoryData[] = brandInventoryData
        .map((brand, index) => ({
          ...brand,
          percentage: totalInventoryStock > 0 ? (brand.total_stock / totalInventoryStock) * 100 : 0,
          color: COLORS[index % COLORS.length],
        }))
        .filter(brand => brand.percentage > 0) // Only show brands with inventory
        .sort((a, b) => b.percentage - a.percentage); // Sort by percentage descending

      setData(processedData);
    } catch (err) {
      console.error('Error fetching brand inventory data:', err);
      setError('Failed to load brand inventory data');
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleBrandHover = (brand: BrandInventoryData) => {
    setHoveredBrand(brand);
  };

  const handleBrandLeave = () => {
    setHoveredBrand(null);
  };

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

  if (data.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No inventory data available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.accent} />
      <div className={styles.content}>
        <h3 className={styles.title}>Brand Inventory Share</h3>
        
        <div className={styles.barsContainer}>
          {data.map((brand, index) => (
            <div 
              key={brand.brand_id} 
              className={styles.brandItem}
              onMouseEnter={() => handleBrandHover(brand)}
              onMouseLeave={handleBrandLeave}
              onTouchStart={() => handleBrandHover(brand)}
            >
              <div className={styles.brandHeader}>
                <span className={styles.brandLabel}>{brand.brand_name}</span>
                <span className={styles.brandPercent}>{brand.percentage.toFixed(1)}%</span>
              </div>
              <div className={styles.brandBarContainer}>
                <div className={styles.brandBar}>
                  <div 
                    className={styles.brandProgress} 
                    style={{ 
                      width: `${brand.percentage}%`,
                      backgroundColor: brand.color 
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fixed position tooltip at bottom */}
        <div className={styles.tooltipArea}>
          {hoveredBrand && (
            <div className={styles.tooltip}>
              <p className={styles.tooltipLabel}>{hoveredBrand.brand_name}</p>
              <div className={styles.tooltipDetails}>
                <span className={styles.tooltipItems}>
                  Items: {hoveredBrand.total_stock.toLocaleString()}
                </span>
                <span className={styles.tooltipPercent}>
                  {hoveredBrand.percentage.toFixed(1)}% share
                </span>
                <span className={styles.tooltipValue}>
                  {formatValue(hoveredBrand.total_value)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandInventoryShare;