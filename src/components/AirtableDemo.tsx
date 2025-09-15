import React, { useState } from 'react';
import { useAirtableItems, useAirtableLowStock } from '../hooks/useAirtable';
import { Item } from '../services/airtableService';

const AirtableDemo: React.FC = () => {
  const {
    items,
    loading,
    error,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    searchItems,
    syncFromSupabase,
    isConfigured
  } = useAirtableItems();

  const {
    lowStockItems,
    loading: lowStockLoading,
    error: lowStockError,
    refreshLowStock
  } = useAirtableLowStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [syncResult, setSyncResult] = useState<{ synced: number; errors: string[] } | null>(null);
  
  // Form state for creating new item
  const [newItem, setNewItem] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    brand_id: '',
    gross_stock_level: 0,
    reorder_level: 0,
    retail_price: 0,
    cost_price: 0,
    status: 'active'
  });

  if (!isConfigured) {
    return (
      <div style={{ padding: '20px', background: '#fee', border: '1px solid #f88', borderRadius: '8px', color: '#800' }}>
        <h2>Airtable Not Configured</h2>
        <p>To use the Airtable integration, please set the following environment variables:</p>
        <ul>
          <li><code>REACT_APP_AIRTABLE_BASE_ID</code> - Your Airtable base ID</li>
          <li><code>REACT_APP_AIRTABLE_API_KEY</code> - Your Airtable API key</li>
        </ul>
        <p>Add these to your <code>.env</code> file and restart the development server.</p>
      </div>
    );
  }

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const results = await searchItems(searchQuery);
      setSearchResults(results);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem(newItem);
      // Reset form
      setNewItem({
        name: '',
        sku: '',
        description: '',
        category: '',
        brand_id: '',
        gross_stock_level: 0,
        reorder_level: 0,
        retail_price: 0,
        cost_price: 0,
        status: 'active'
      });
      alert('Item created successfully!');
    } catch (error) {
      alert('Failed to create item: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleUpdateStock = async (itemId: string, newStock: number) => {
    try {
      await updateItem(itemId, { gross_stock_level: newStock });
      alert('Stock updated successfully!');
    } catch (error) {
      alert('Failed to update stock: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      try {
        await deleteItem(itemId);
        alert('Item deleted successfully!');
      } catch (error) {
        alert('Failed to delete item: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleSyncFromSupabase = async () => {
    try {
      const result = await syncFromSupabase();
      setSyncResult(result);
    } catch (error) {
      alert('Failed to sync from Supabase: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Airtable Integration Demo</h1>

      {error && (
        <div style={{ padding: '10px', background: '#fee', border: '1px solid #f88', borderRadius: '4px', marginBottom: '20px', color: '#800' }}>
          Error: {error}
        </div>
      )}

      {/* Sync from Supabase */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Sync from Supabase</h2>
        <button 
          onClick={handleSyncFromSupabase}
          disabled={loading}
          style={{ padding: '10px 15px', background: '#007cba', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Syncing...' : 'Sync Items from Supabase'}
        </button>
        
        {syncResult && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f8ff', border: '1px solid #b0c4de', borderRadius: '4px' }}>
            <p><strong>Sync Result:</strong></p>
            <p>Items synced: {syncResult.synced}</p>
            {syncResult.errors.length > 0 && (
              <div>
                <p>Errors:</p>
                <ul>
                  {syncResult.errors.map((error, index) => (
                    <li key={index} style={{ color: '#d32f2f' }}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Search Items */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Search Items</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or SKU..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button 
            onClick={handleSearch}
            disabled={loading}
            style={{ padding: '8px 15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <h3>Search Results ({searchResults.length})</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              {searchResults.map(item => (
                <div key={item.id} style={{ padding: '10px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                  <strong>{item.name}</strong> (SKU: {item.sku})
                  <br />
                  <small>Stock: {item.gross_stock_level} | Reorder: {item.reorder_level}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Create New Item */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Create New Item</h2>
        <form onSubmit={handleCreateItem} style={{ display: 'grid', gap: '10px', maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="Item Name"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            required
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="SKU"
            value={newItem.sku}
            onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
            required
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Category"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <input
            type="text"
            placeholder="Brand ID"
            value={newItem.brand_id}
            onChange={(e) => setNewItem({ ...newItem, brand_id: e.target.value })}
            required
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="number"
              placeholder="Stock Level"
              value={newItem.gross_stock_level}
              onChange={(e) => setNewItem({ ...newItem, gross_stock_level: parseInt(e.target.value) || 0 })}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="number"
              placeholder="Reorder Level"
              value={newItem.reorder_level}
              onChange={(e) => setNewItem({ ...newItem, reorder_level: parseInt(e.target.value) || 0 })}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              type="number"
              step="0.01"
              placeholder="Retail Price"
              value={newItem.retail_price}
              onChange={(e) => setNewItem({ ...newItem, retail_price: parseFloat(e.target.value) || 0 })}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Cost Price"
              value={newItem.cost_price}
              onChange={(e) => setNewItem({ ...newItem, cost_price: parseFloat(e.target.value) || 0 })}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            style={{ padding: '10px', background: '#007cba', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Creating...' : 'Create Item'}
          </button>
        </form>
      </section>

      {/* All Items */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>All Items ({items.length})</h2>
          <button 
            onClick={() => fetchItems()}
            disabled={loading}
            style={{ padding: '8px 15px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          {items.map(item => (
            <div key={item.id} style={{ padding: '15px', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0' }}>{item.name}</h4>
                  <p style={{ margin: '0 0 5px 0' }}>SKU: {item.sku}</p>
                  <p style={{ margin: '0 0 5px 0' }}>
                    Stock: {item.gross_stock_level} | Reorder: {item.reorder_level}
                    {item.gross_stock_level <= item.reorder_level && (
                      <span style={{ color: '#d32f2f', fontWeight: 'bold' }}> (LOW STOCK)</span>
                    )}
                  </p>
                  {item.retail_price && <p style={{ margin: '0' }}>Price: £{item.retail_price.toFixed(2)}</p>}
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => {
                      const newStock = prompt('Enter new stock level:', item.gross_stock_level.toString());
                      if (newStock !== null) {
                        handleUpdateStock(item.id, parseInt(newStock) || 0);
                      }
                    }}
                    style={{ padding: '4px 8px', background: '#ffc107', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Update Stock
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    style={{ padding: '4px 8px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && !loading && (
          <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
            No items found. Try syncing from Supabase or creating a new item.
          </p>
        )}
      </section>

      {/* Low Stock Items */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Low Stock Items ({lowStockItems.length})</h2>
          <button 
            onClick={() => refreshLowStock()}
            disabled={lowStockLoading}
            style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            {lowStockLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {lowStockError && (
          <div style={{ padding: '10px', background: '#fee', border: '1px solid #f88', borderRadius: '4px', marginBottom: '15px', color: '#800' }}>
            Error: {lowStockError}
          </div>
        )}

        <div style={{ display: 'grid', gap: '10px' }}>
          {lowStockItems.map(item => (
            <div key={item.id} style={{ padding: '15px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '4px' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#c53030' }}>{item.name}</h4>
              <p style={{ margin: '0 0 5px 0' }}>SKU: {item.sku}</p>
              <p style={{ margin: '0', fontWeight: 'bold' }}>
                Current Stock: {item.gross_stock_level} | Reorder Level: {item.reorder_level}
              </p>
            </div>
          ))}
        </div>

        {lowStockItems.length === 0 && !lowStockLoading && (
          <p style={{ textAlign: 'center', color: '#28a745', fontWeight: 'bold' }}>
            ✅ No low stock items found!
          </p>
        )}
      </section>
    </div>
  );
};

export default AirtableDemo;