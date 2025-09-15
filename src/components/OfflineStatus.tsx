import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Upload, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { offlineManager } from '../services/offlineManager';
import styles from './OfflineStatus.module.css';

interface OfflineStatusState {
  isOnline: boolean;
  pendingRequests: number;
  localRecords: number;
  lastSync: number | null;
  syncing: boolean;
}

const OfflineStatus: React.FC = () => {
  const [status, setStatus] = useState<OfflineStatusState>({
    isOnline: true,
    pendingRequests: 0,
    localRecords: 0,
    lastSync: null,
    syncing: false
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Initial status load
    loadStatus();

    // Listen for network changes
    const handleNetworkChange = (isOnline: boolean) => {
      setStatus(prev => ({ ...prev, isOnline }));
      if (isOnline) {
        handleSync();
      }
    };

    offlineManager.addNetworkListener(handleNetworkChange);

    // Periodic status updates
    const interval = setInterval(loadStatus, 30000); // Every 30 seconds

    return () => {
      offlineManager.removeNetworkListener(handleNetworkChange);
      clearInterval(interval);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const offlineStatus = await offlineManager.getOfflineStatus();
      setStatus(prev => ({
        ...prev,
        ...offlineStatus
      }));
    } catch (error) {
      console.error('Error loading offline status:', error);
    }
  };

  const handleSync = async () => {
    if (!status.isOnline || status.syncing) return;
    
    setStatus(prev => ({ ...prev, syncing: true }));
    try {
      await offlineManager.syncOfflineData();
      await loadStatus();
    } catch (error) {
      console.error('Error during manual sync:', error);
    } finally {
      setStatus(prev => ({ ...prev, syncing: false }));
    }
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getStatusColor = () => {
    if (!status.isOnline) return '#ef4444'; // Red
    if (status.pendingRequests > 0 || status.localRecords > 0) return '#f59e0b'; // Orange
    return '#10b981'; // Green
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.syncing) return 'Syncing...';
    if (status.pendingRequests > 0 || status.localRecords > 0) return 'Pending sync';
    return 'Online';
  };

  const shouldShow = !status.isOnline || status.pendingRequests > 0 || status.localRecords > 0 || expanded;

  if (!shouldShow) return null;

  return (
    <div className={styles.offlineStatus}>
      <div 
        className={styles.statusBar}
        onClick={() => setExpanded(!expanded)}
        style={{ backgroundColor: getStatusColor() }}
      >
        <div className={styles.statusIcon}>
          {status.syncing ? (
            <Upload className={styles.spinning} size={16} />
          ) : status.isOnline ? (
            <Wifi size={16} />
          ) : (
            <WifiOff size={16} />
          )}
        </div>
        
        <span className={styles.statusText}>
          {getStatusText()}
        </span>

        {(status.pendingRequests > 0 || status.localRecords > 0) && (
          <span className={styles.pendingCount}>
            {status.pendingRequests + status.localRecords}
          </span>
        )}
      </div>

      {expanded && (
        <div className={styles.statusDetails}>
          <div className={styles.detailsHeader}>
            <h4>Connection Status</h4>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              className={styles.closeButton}
            >
              ×
            </button>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                {status.isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div>
                <div className={styles.detailLabel}>Network</div>
                <div className={styles.detailValue}>
                  {status.isOnline ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Upload size={20} />
              </div>
              <div>
                <div className={styles.detailLabel}>Pending Sync</div>
                <div className={styles.detailValue}>
                  {status.pendingRequests} requests
                </div>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <Database size={20} />
              </div>
              <div>
                <div className={styles.detailLabel}>Local Data</div>
                <div className={styles.detailValue}>
                  {status.localRecords} records
                </div>
              </div>
            </div>

            <div className={styles.detailItem}>
              <div className={styles.detailIcon}>
                <CheckCircle size={20} />
              </div>
              <div>
                <div className={styles.detailLabel}>Last Sync</div>
                <div className={styles.detailValue}>
                  {formatLastSync(status.lastSync)}
                </div>
              </div>
            </div>
          </div>

          {status.isOnline && (status.pendingRequests > 0 || status.localRecords > 0) && (
            <div className={styles.actions}>
              <button 
                onClick={handleSync}
                disabled={status.syncing}
                className={styles.syncButton}
              >
                {status.syncing ? (
                  <>
                    <Upload className={styles.spinning} size={16} />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Sync Now
                  </>
                )}
              </button>
            </div>
          )}

          {!status.isOnline && (
            <div className={styles.offlineMessage}>
              <AlertCircle size={16} />
              <span>
                You're working offline. Changes will be synced when you reconnect.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineStatus;