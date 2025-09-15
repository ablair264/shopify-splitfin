import React, {
  useEffect,
  useState,
  useMemo,
} from 'react';
import { supabase } from '../services/supabaseService';
import { withLoader } from '../hoc/withLoader';

const STATUS_OPTIONS = [
  'All',
  'Order Required',
  'No Order Required',
  'Surplus Warning!',
  'Stock Surplus',
] as const;
type Status = typeof STATUS_OPTIONS[number];

interface StockRow {
  sku: string;
  name: string;
  brand: string;
  price: number;
  currentStock: number;
  actualAvailable: number;
  committedStock: number;
  backorderQty: number;
}

type ProductInfo = {
  name: string;
  brand: string;
  price: number;
  available: number;
  actual: number;
};

function OrderManagement() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<Status>('All');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Helper function to get status class name
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Stock Surplus':
        return 'stock-surplus';
      case 'Surplus Warning!':
        return 'surplus-warning';
      case 'No Order Required':
        return 'no-order-required';
      case 'Order Required':
        return 'order-required';
      default:
        return '';
    }
  };

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        // Get current user's company
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .single();

        if (!userData?.company_id) {
          throw new Error('User company not found');
        }

        // Fetch items from Supabase
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*')
          .eq('status', 'active');

        if (itemsError) {
          throw new Error(`Failed to fetch items: ${itemsError.message}`);
        }

        const infoMap = new Map<string, ProductInfo>();
        
        itemsData?.forEach((item) => {
          if (item.sku) {
            infoMap.set(item.sku, {
              name: String(item.name || ''),
              brand: String(item.manufacturer || ''),
              price: Number(item.purchase_price || 0),
              available: Number(item.gross_stock_level || 0),
              actual: Number(item.net_stock_level || 0),
            });
          }
        });

        // Fetch purchase orders from Supabase
        const { data: poData, error: poError } = await supabase
          .from('purchase_orders')
          .select(`
            *,
            purchase_order_line_items (
              item_id,
              quantity_ordered,
              quantity_received
            )
          `)
          .eq('company_id', userData.company_id)
          .neq('order_status', 'received');

        if (poError) {
          console.error('Error fetching purchase orders:', poError);
          // Continue without backorder data
        }

        const boMap: Record<string, number> = {};
        poData?.forEach((po) => {
          po.purchase_order_line_items?.forEach((lineItem: any) => {
            const ordered = lineItem.quantity_ordered || 0;
            const received = lineItem.quantity_received || 0;
            const diff = ordered - received;
            
            if (diff > 0 && lineItem.item_id) {
              // We need to find the SKU from the item_id
              const item = itemsData?.find(i => i.id === lineItem.item_id);
              if (item?.sku) {
                boMap[item.sku] = (boMap[item.sku] || 0) + diff;
              }
            }
          });
        });

        const out: StockRow[] = [];
        infoMap.forEach(({ name, brand, price, available, actual }, sku) => {
          if (price > 0) {
            out.push({
              sku,
              name,
              brand,
              price,
              currentStock: available,
              actualAvailable: actual,
              committedStock: available - actual,
              backorderQty: boMap[sku] || 0,
            });
          }
        });
        setRows(out);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Derived state
  const brands = useMemo(() => {
    const b = Array.from(new Set(rows.map((r) => r.brand))).filter(Boolean);
    return ['All', ...b];
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        const term = search.toLowerCase();
        if (
          term &&
          !(
            r.sku.toLowerCase().includes(term) ||
            r.name.toLowerCase().includes(term)
          )
        )
          return false;
        if (brandFilter !== 'All' && r.brand !== brandFilter) return false;
        if (statusFilter !== 'All') {
          const total = r.currentStock + r.backorderQty;
          const deficit = total - r.committedStock;
          const st =
            deficit < 0
              ? 'Order Required'
              : deficit === 0
              ? 'No Order Required'
              : deficit > 40
              ? 'Surplus Warning!'
              : 'Stock Surplus';
          if (st !== statusFilter) return false;
        }
        return true;
      }),
    [rows, search, brandFilter, statusFilter]
  );

  const runningTotal = useMemo(
    () =>
      rows.reduce((sum, r) => {
        if (selected[r.sku]) {
          const qty = quantities[r.sku] || 1;
          return sum + r.price * qty;
        }
        return sum;
      }, 0),
    [rows, selected, quantities]
  );

  // Handlers
  const toggleSelect = (sku: string) => {
    setSelected((s) => ({ ...s, [sku]: !s[sku] }));
    setQuantities((q) => ({ ...q, [sku]: q[sku] || 1 }));
  };

  const updateQuantity = (sku: string, qty: number) => {
    setQuantities(q => ({ ...q, [sku]: qty }));
  };

  const generateCSV = () => {
    const cols = ['Name', 'SKU', 'Quantity', 'TotalPrice'];
    const lines = [cols.join(',')];
    Object.entries(selected).forEach(([sku, sel]) => {
      if (sel) {
        const r = rows.find((x) => x.sku === sku)!;
        const qty = quantities[sku] || 1;
        lines.push(
          [
            `"${r.name.replace(/"/g, '""')}"`,
            sku,
            String(qty),
            (r.price * qty).toFixed(2),
          ].join(',')
        );
      }
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-order-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getOrderStatus = (row: StockRow) => {
    const total = row.currentStock + row.backorderQty;
    const deficit = total - row.committedStock;
    if (deficit < 0) return 'Order Required';
    if (deficit === 0) return 'No Order Required';
    if (deficit > 40) return 'Surplus Warning!';
    return 'Stock Surplus';
  };

  const toggleRowExpansion = (sku: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sku)) {
        newSet.delete(sku);
      } else {
        newSet.add(sku);
      }
      return newSet;
    });
  };

  // Early return for error
  if (error) {
    return (
      <div className="product-table-container">
        <div style={{ color: 'red', textAlign: 'center', padding: '2rem' }}>
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="product-table-container" style={{ position: 'relative' }}>
      <h2>Order Management</h2>

      <div className="product-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Search SKU or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="select-wrapper">
          <label>Brand:&nbsp;</label>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="select-wrapper">
          <label>Status:&nbsp;</label>
          {STATUS_OPTIONS.map((s) => {
            const isActive = statusFilter === s;
            const cls = isActive
              ? getStatusClass(s)
              : 'stock-badge-outline';
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`stock-badge ${cls}`}
              >
                {s}
              </button>
            );
          })}
        </div>

        <button
          onClick={generateCSV}
          disabled={!Object.values(selected).some(Boolean)}
          className="export-button"
        >
          Generate Purchase Order
        </button>
      </div>

      <div className="table-container" style={{ maxHeight: '600px', overflow: 'auto' }}>
        <table className="stock-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#1A1F2A', zIndex: 1 }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>✓</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Qty</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>SKU</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Item Name</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Brand</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Price</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Current Stock</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Back Order</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Committed Stock</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Total Stock</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Stock Deficit</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Order Status</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const total = row.currentStock + row.backorderQty;
              const deficit = total - row.committedStock;
              const status = getOrderStatus(row);
              const isExpanded = expandedRows.has(row.sku);
              
              return (
                <React.Fragment key={row.sku}>
                  <tr 
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      backgroundColor: isExpanded ? 'rgba(121, 213, 233, 0.1)' : 'transparent'
                    }}
                    onClick={() => toggleRowExpansion(row.sku)}
                  >
                  <td style={{ padding: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={!!selected[row.sku]}
                      onChange={() => toggleSelect(row.sku)}
                    />
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <input
                      type="number"
                      min={1}
                      disabled={!selected[row.sku]}
                      value={quantities[row.sku] || 1}
                      onChange={(e) => updateQuantity(row.sku, Number(e.target.value))}
                      style={{ 
                        width: '60px', 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '4px',
                        color: 'white',
                        padding: '0.25rem'
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.75rem' }}>{row.sku}</td>
                  <td style={{ padding: '0.75rem' }}>{row.name}</td>
                  <td style={{ padding: '0.75rem' }}>{row.brand}</td>
                  <td style={{ padding: '0.75rem' }}>£{row.price.toFixed(2)}</td>
                  <td style={{ padding: '0.75rem' }}>{row.currentStock}</td>
                  <td style={{ padding: '0.75rem' }}>{row.backorderQty}</td>
                  <td style={{ padding: '0.75rem' }}>{row.committedStock}</td>
                  <td style={{ padding: '0.75rem' }}>{total}</td>
                  <td style={{ padding: '0.75rem' }}>{deficit}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span className={`stock-badge ${getStatusClass(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', width: '50px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowExpansion(row.sku);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#79d5e9',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0.25rem',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
                
                {/* Expanded Content */}
                {isExpanded && (
                  <tr style={{ backgroundColor: 'rgba(121, 213, 233, 0.05)' }}>
                    <td colSpan={13} style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: '#79d5e9' }}>Stock Analysis</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            <div style={{ 
                              background: 'rgba(255,255,255,0.05)', 
                              padding: '0.75rem', 
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Available Stock</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{row.actualAvailable}</div>
                            </div>
                            <div style={{ 
                              background: 'rgba(255,255,255,0.05)', 
                              padding: '0.75rem', 
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Total Value</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>£{(row.currentStock * row.price).toFixed(2)}</div>
                            </div>
                            <div style={{ 
                              background: 'rgba(255,255,255,0.05)', 
                              padding: '0.75rem', 
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                              <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Reorder Suggestion</div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: deficit < 0 ? '#ef4444' : '#10b981' }}>
                                {deficit < 0 ? Math.abs(deficit) : 'No reorder needed'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px' }}>
                          <button
                            style={{
                              background: 'linear-gradient(135deg, #79d5e9 0%, #4daeac 100%)',
                              color: '#1a1f2a',
                              border: 'none',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '500',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Quick select functionality
                              if (!selected[row.sku]) {
                                toggleSelect(row.sku);
                                if (deficit < 0) {
                                  updateQuantity(row.sku, Math.abs(deficit));
                                }
                              }
                            }}
                          >
                            {selected[row.sku] ? '✓ Selected' : 'Quick Select'}
                          </button>
                          
                          <button
                            style={{
                              background: 'rgba(255,255,255,0.1)',
                              color: 'white',
                              border: '1px solid rgba(255,255,255,0.2)',
                              padding: '0.5rem 1rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(row.sku);
                            }}
                          >
                            Close Details
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.values(selected).some(Boolean) && (
        <div className="running-total-box">
          Total: £{runningTotal.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export default withLoader(OrderManagement);