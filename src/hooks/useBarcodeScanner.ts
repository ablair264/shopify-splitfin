import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxLength?: number;
  timeout?: number; // Time between keystrokes to consider scan complete (ms)
}

export const useBarcodeScanner = ({
  onScan,
  minLength = 8,
  maxLength = 20,
  timeout = 100
}: BarcodeScannerOptions) => {
  const [buffer, setBuffer] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastKeystrokeTime = useRef<number>(0);
  const bufferRef = useRef<string>('');

  useEffect(() => {
    console.log('Barcode scanner hook mounted, buffer:', buffer);
    bufferRef.current = buffer;
  }, [buffer]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      console.log('Key pressed:', event.key, 'Current buffer:', bufferRef.current);
      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeTime.current;
      
      // If too much time has passed, clear the buffer (new scan started)
      if (timeSinceLastKey > timeout * 2) {
        setBuffer('');
        bufferRef.current = '';
      }
      
      lastKeystrokeTime.current = now;

      // Handle Enter key (most scanners send Enter after barcode)
      if (event.key === 'Enter') {
        event.preventDefault();
        
        if (bufferRef.current.length >= minLength && bufferRef.current.length <= maxLength) {
          onScan(bufferRef.current.trim());
        }
        setBuffer('');
        bufferRef.current = '';
        return;
      }

      // Only process alphanumeric characters and common barcode characters
      if (/^[a-zA-Z0-9\-_.]$/.test(event.key)) {
        // Always capture barcode scanner input regardless of focus
        setBuffer(prev => {
          const newBuffer = prev + event.key;
          bufferRef.current = newBuffer;
          return newBuffer;
        });
        
        // Only prevent default if not in an input field
        if (document.activeElement?.tagName !== 'INPUT' && 
            document.activeElement?.tagName !== 'TEXTAREA') {
          event.preventDefault();
        }
        
        // Clear timeout and set new one
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          setBuffer('');
          bufferRef.current = '';
        }, timeout);
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyPress);
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onScan, minLength, maxLength, timeout]); // Removed buffer from dependencies to avoid recreating listener

  return { buffer, clearBuffer: () => setBuffer('') };
};