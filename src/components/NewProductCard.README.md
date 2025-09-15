# NewProductCard Component Usage Guide

## Overview
The NewProductCard component is a modern, responsive product card designed for e-commerce applications. It includes features like multiple images, stock status, quantity selection, and action buttons.

## Grid Layout Solution

### Problem
When the sidebar collapses, the grid can expand to show 5 cards in a row, causing overlapping and layout issues.

### Solution
The CSS includes responsive grid rules that limit the maximum number of columns to 4, preventing overlapping when the sidebar collapses.

## Usage

### Basic Implementation

```jsx
import { NewProductCard } from './components/NewProductCard';
import './components/NewProductCard.css';

// In your component
<div className="product-grid">
  {products.map(product => (
    <NewProductCard
      key={product.id}
      product={product}
      quantity={quantity}
      onQuantityChange={handleQuantityChange}
      onAddToOrder={handleAddToOrder}
      isSelected={isSelected}
      onQuickView={handleQuickView}
      showNewBadge={isNewProduct}
    />
  ))}
</div>
```

### Grid Container Classes

Use one of these class names for your grid container:
- `.product-grid` (recommended)
- `.products-grid`
- `.contains-product-cards` (fallback)

### Responsive Breakpoints

The grid automatically adjusts based on screen size:
- **4 columns**: 1340px and above (max 4 columns to prevent 5-column layout)
- **3 columns**: 1020px - 1339px
- **2 columns**: 680px - 1019px
- **1 column**: Below 680px

### Handling Sidebar Collapse

The CSS handles sidebar collapse scenarios automatically. If your app adds specific classes when the sidebar collapses, the grid will respect the maximum column limit.

Supported patterns:
- `.sidebar-collapsed .product-grid`
- `.main-content-expanded .product-grid`
- Any container with `grid` in the class name containing `.new-product-card`

### Custom Implementation

If you need custom grid behavior:

```css
.custom-product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  padding: 20px;
  max-width: 1440px; /* Prevents too many columns */
  margin: 0 auto;
}

/* Force max 4 columns on large screens */
@media (min-width: 1340px) {
  .custom-product-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

## Component Props

| Prop | Type | Description |
|------|------|-------------|
| `product` | `Product` | Product data object |
| `quantity` | `number` | Current quantity selected |
| `onQuantityChange` | `(qty: number) => void` | Callback when quantity changes |
| `onAddToOrder` | `() => void` | Callback when add to order is clicked |
| `isSelected` | `boolean` | Whether the product is selected |
| `onQuickView` | `() => void` | Optional callback for quick view |
| `showNewBadge` | `boolean` | Optional flag to show NEW badge |

## Features

- **Responsive Design**: Adapts to different screen sizes
- **Multiple Images**: Supports up to 5 product images with navigation
- **Stock Status**: Shows "Stock" or "Factory Order" badge
- **Quantity Selection**: Respects packing units with +/- controls
- **Action Buttons**: Add to Order, Remove, View Details, and Catalogue
- **Hover Effects**: Smooth transitions and elevated shadow on hover
- **Loading States**: Shows spinner while images load
- **Accessibility**: Keyboard navigable with proper ARIA attributes

## Styling Customization

The component uses CSS custom properties (variables) for theming:

```css
:root {
  --primary-color: #10b981;
  --primary-hover: #059669;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --border-color: #e5e7eb;
}
```

## Tips

1. Always wrap multiple cards in a container with one of the recommended grid classes
2. The card width is fixed at 320px but will scale down on smaller screens
3. Images are fetched from ImageKit CDN with automatic optimization
4. The component is memoized for performance with large product lists
5. Use the `showNewBadge` prop for products added within the last 7 days

## Troubleshooting

- **Cards overlapping**: Ensure you're using one of the recommended grid container classes
- **5 cards in a row**: This is prevented by the CSS max column rules
- **Images not loading**: Check the brand folder mapping in the component
- **Layout breaking on sidebar toggle**: The grid has smooth transitions built-in

## Example with ProductGrid Component

```jsx
import { ProductGrid } from './components/ProductGrid';

<ProductGrid
  products={products}
  selectedProducts={selectedProductIds}
  quantities={productQuantities}
  onQuantityChange={handleQuantityChange}
  onAddToOrder={handleAddToOrder}
  onQuickView={handleQuickView}
  className="my-custom-class"
/>
```

This wrapper component handles all the grid layout logic and properly passes props to each NewProductCard.