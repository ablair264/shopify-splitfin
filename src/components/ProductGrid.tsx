import React from 'react';
import { NewProductCard } from './NewProductCard';
import type { Product } from './NewProductCard';
import './NewProductCard.css';

interface ProductGridProps {
  products: Product[];
  selectedProducts: Set<string>;
  quantities: Record<string, number>;
  onQuantityChange: (productId: string, quantity: number) => void;
  onAddToOrder: (productId: string) => void;
  onQuickView?: (product: Product) => void;
  className?: string;
}

/**
 * ProductGrid component that properly handles NewProductCard layout
 * Prevents overlapping issues when sidebar collapses by limiting to 4 columns max
 */
export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  selectedProducts,
  quantities,
  onQuantityChange,
  onAddToOrder,
  onQuickView,
  className = ''
}) => {
  return (
    <div className={`product-grid ${className}`}>
      {products.map(product => (
        <NewProductCard
          key={product.id}
          product={product}
          quantity={quantities[product.id] || product.packing_unit || 1}
          onQuantityChange={(qty) => onQuantityChange(product.id, qty)}
          onAddToOrder={() => onAddToOrder(product.id)}
          isSelected={selectedProducts.has(product.id)}
          onQuickView={() => onQuickView?.(product)}
          showNewBadge={product.created_date ? 
            new Date(product.created_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : 
            false
          }
        />
      ))}
    </div>
  );
};

export default ProductGrid;