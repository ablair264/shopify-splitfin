# Customizable Dashboard System

## Overview
A fully customizable, drag-and-drop analytics dashboard system that allows users to create personalized views of their data.

## Features
- 🎛️ **Drag & Drop Interface** - Rearrange widgets by dragging them around
- 🎨 **Color Themes** - Sync with DashboardHeader color selection
- 📊 **Multiple Widget Types** - Metrics, charts, tables, activity feeds
- 🔧 **Widget Variants** - Each widget has 3 different design variants
- 💾 **Persistent Storage** - Saves user preferences to database
- 📚 **Widget Library** - Browse and add widgets from a categorized library
- ⚙️ **Configuration** - Fine-tune each widget's settings

## Usage

```tsx
import { CustomizableDashboard } from './CustomizableDashboard';

// Basic usage
<CustomizableDashboard 
  dashboardId="main" 
  barChartColors="primary" 
/>

// With save callback
<CustomizableDashboard 
  dashboardId="finance" 
  barChartColors={barChartColors}
  onSave={(layout) => console.log('Dashboard saved:', layout)}
/>
```

## Widget Types

### MetricCard Variants
- **Variant 1**: Glassmorphism with left border accent
- **Variant 2**: Clean design with top border accent  
- **Variant 3**: Full border with solid background

### Display Formats
- `MetricCard` - Full-featured metric display
- `MetricCardSquare` - Compact square format
- `ColorfulMetricCard` - Vibrant metric display
- `FullGraph` - Chart widgets (line, bar, area, pie)
- `DataTable` - Tabular data display
- `ActivityFeed` - Live activity stream

## Database Schema

The system uses these tables:
- `user_dashboards` - Stores user dashboard configurations
- `widget_templates` - Pre-defined widget templates
- `dashboard_themes` - Color theme presets

## File Structure

```
CustomizableDashboard/
├── CustomizableDashboard.tsx     # Main dashboard component
├── DashboardWidget.tsx           # Individual widget wrapper
├── WidgetConfigModal.tsx         # Widget configuration modal
├── WidgetLibraryModal.tsx        # Widget library/gallery
├── *.css                         # Styling files
└── index.ts                      # Export definitions
```

## Integration

1. **Database Setup**: Run the SQL migration in `scripts/create-dashboard-tables.sql`
2. **Import Components**: Add to your routing system
3. **Navigation**: Update sidebar navigation (optional)
4. **Styling**: Ensure CSS variables are available for theming

## Configuration Options

Each widget can be configured with:
- **Data Source**: orders, customers, inventory, etc.
- **Metrics**: totalRevenue, totalOrders, etc.
- **Display Format**: MetricCard, FullGraph, etc.
- **Variant**: variant1, variant2, variant3
- **Colors**: Custom color themes
- **Date Range**: Time period for data
- **Auto Refresh**: Refresh interval in seconds

## Color Theme Integration

The dashboard automatically syncs with the parent component's color theme selection, allowing users to change all widget colors simultaneously through the DashboardHeader.