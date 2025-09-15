import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { X, Camera, CameraOff } from 'lucide-react';
import '../styles/BarcodeScanner.css';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [lastResult, setLastResult] = useState<string>('');

  const { ref } = useZxing({
    onDecodeResult(result) {
      const text = result.getText();
      if (text && text !== lastResult) {
        setLastResult(text);
        onScan(text);
      }
    },
    paused: !isScanning,
  }) as { ref: React.RefObject<HTMLVideoElement> };

  return (
    <div className="barcode-scanner-overlay">
      <div className="barcode-scanner-container">
        <div className="scanner-header">
          <h2>Scan Barcode</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="scanner-content">
          {isScanning ? (
            <>
              <video ref={ref} className="scanner-video" />
              <div className="scanner-frame"></div>
              <p className="scanner-hint">Position barcode within the frame</p>
            </>
          ) : (
            <div className="scanner-paused">
              <CameraOff size={48} />
              <p>Scanner paused</p>
            </div>
          )}
        </div>

        <div className="scanner-controls">
          <button 
            className={`scanner-toggle ${isScanning ? 'active' : ''}`}
            onClick={() => setIsScanning(!isScanning)}
          >
            {isScanning ? <CameraOff size={20} /> : <Camera size={20} />}
            {isScanning ? 'Pause Scanner' : 'Resume Scanner'}
          </button>
          
          {lastResult && (
            <div className="last-scan">
              <strong>Last scan:</strong> {lastResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;