import React, { useState } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { Scan, Download, Trash2 } from 'lucide-react';
import '../styles/BarcodeScannerApp.css';

interface ScannedItem {
  id: string;
  barcode: string;
  timestamp: Date;
}

const BarcodeScannerApp: React.FC = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);

  const handleScan = (barcode: string) => {
    const newItem: ScannedItem = {
      id: Date.now().toString(),
      barcode,
      timestamp: new Date(),
    };
    setScannedItems([...scannedItems, newItem]);
  };

  const handleDelete = (id: string) => {
    setScannedItems(scannedItems.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all scanned barcodes?')) {
      setScannedItems([]);
    }
  };

  const handleExport = () => {
    const csv = 'Barcode,Timestamp\n' + 
      scannedItems.map(item => 
        `${item.barcode},${item.timestamp.toLocaleString()}`
      ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcodes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="scanner-app">
      <div className="scanner-app-header">
        <h1>Barcode Scanner</h1>
        <div className="header-stats">
          <span>{scannedItems.length} items scanned</span>
        </div>
      </div>

      <div className="scanner-app-actions">
        <button 
          className="scan-button"
          onClick={() => setShowScanner(true)}
        >
          <Scan size={20} />
          Scan Barcode
        </button>

        {scannedItems.length > 0 && (
          <>
            <button 
              className="export-button"
              onClick={handleExport}
            >
              <Download size={20} />
              Export CSV
            </button>
            <button 
              className="clear-button"
              onClick={handleClearAll}
            >
              <Trash2 size={20} />
              Clear All
            </button>
          </>
        )}
      </div>

      <div className="scanned-items">
        {scannedItems.length === 0 ? (
          <div className="empty-state">
            <Scan size={48} color="#ccc" />
            <p>No barcodes scanned yet</p>
            <p className="hint">Click "Scan Barcode" to start</p>
          </div>
        ) : (
          <div className="items-grid">
            {scannedItems.map((item) => (
              <div key={item.id} className="scanned-item">
                <div className="item-barcode">{item.barcode}</div>
                <div className="item-time">
                  {item.timestamp.toLocaleTimeString()}
                </div>
                <button 
                  className="item-delete"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showScanner && (
        <BarcodeScanner 
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};

export default BarcodeScannerApp;