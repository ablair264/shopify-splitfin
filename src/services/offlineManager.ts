// Offline Manager Service
// Handles offline data storage, sync, and network status

export interface OfflineRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
  retryCount: number;
  table: string; // Which table this affects (customers, enquiries, orders, etc.)
  operation: 'create' | 'update' | 'delete';
  localId?: string; // For temporary local IDs
}

export interface OfflineData {
  customers: any[];
  enquiries: any[];
  orders: any[];
  items: any[];
  lastSync: number;
}

class OfflineManager {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    this.initDB();
    this.setupNetworkListeners();
    // Disabled service worker for now
    // this.registerServiceWorker();
    
    // Unregister any existing service workers
    this.unregisterServiceWorkers();
  }

  // Initialize IndexedDB for offline storage
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SplitfinOfflineDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for cached data
        if (!db.objectStoreNames.contains('cachedData')) {
          const cachedStore = db.createObjectStore('cachedData', { keyPath: 'table' });
          cachedStore.createIndex('lastUpdated', 'lastUpdated');
        }

        // Store for pending offline requests
        if (!db.objectStoreNames.contains('offlineRequests')) {
          const requestsStore = db.createObjectStore('offlineRequests', { keyPath: 'id' });
          requestsStore.createIndex('timestamp', 'timestamp');
          requestsStore.createIndex('table', 'table');
        }

        // Store for temporary local data
        if (!db.objectStoreNames.contains('localData')) {
          const localStore = db.createObjectStore('localData', { keyPath: 'id' });
          localStore.createIndex('table', 'table');
          localStore.createIndex('created', 'created');
        }
      };
    });
  }

  // Unregister all service workers
  private async unregisterServiceWorkers(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Service Worker unregistered:', registration);
        }
      } catch (error) {
        console.error('Service Worker unregistration failed:', error);
      }
    }
  }

  // Register service worker
  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'OFFLINE_SYNC_COMPLETE') {
            this.handleSyncComplete(event.data.syncedCount);
          }
        });

        // Request background sync registration (if available)
        try {
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            await (registration as any).sync.register('offline-sync');
          }
        } catch (error) {
          console.warn('Background sync not supported:', error);
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Setup network status listeners
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners(true);
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners(false);
    });
  }

  // Add network status listener
  public addNetworkListener(callback: (isOnline: boolean) => void): void {
    this.listeners.add(callback);
  }

  // Remove network status listener
  public removeNetworkListener(callback: (isOnline: boolean) => void): void {
    this.listeners.delete(callback);
  }

  // Notify all listeners of network status change
  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(callback => callback(isOnline));
  }

  // Get network status
  public getNetworkStatus(): boolean {
    return this.isOnline;
  }

  // Cache data for offline use
  public async cacheData(table: string, data: any[]): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readwrite');
      const store = transaction.objectStore('cachedData');

      const cachedItem = {
        table,
        data,
        lastUpdated: Date.now()
      };

      const request = store.put(cachedItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get cached data
  public async getCachedData(table: string): Promise<any[] | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cachedData'], 'readonly');
      const store = transaction.objectStore('cachedData');

      const request = store.get(table);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Store offline request
  public async storeOfflineRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    table: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<string> {
    if (!this.db) await this.initDB();

    const request: OfflineRequest = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      method,
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      timestamp: Date.now(),
      retryCount: 0,
      table,
      operation
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineRequests'], 'readwrite');
      const store = transaction.objectStore('offlineRequests');

      const putRequest = store.put(request);
      putRequest.onsuccess = () => resolve(request.id);
      putRequest.onerror = () => reject(putRequest.error);
    });
  }

  // Get pending offline requests
  public async getPendingRequests(): Promise<OfflineRequest[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineRequests'], 'readonly');
      const store = transaction.objectStore('offlineRequests');

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Create local record (for immediate UI feedback)
  public async createLocalRecord(table: string, data: any): Promise<string> {
    if (!this.db) await this.initDB();

    const localId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const localRecord = {
      id: localId,
      table,
      data: { ...data, id: localId, _isLocal: true },
      created: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['localData'], 'readwrite');
      const store = transaction.objectStore('localData');

      const request = store.put(localRecord);
      request.onsuccess = () => resolve(localId);
      request.onerror = () => reject(request.error);
    });
  }

  // Get local records
  public async getLocalRecords(table: string): Promise<any[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['localData'], 'readonly');
      const store = transaction.objectStore('localData');
      const index = store.index('table');

      const request = index.getAll(table);
      request.onsuccess = () => {
        const records = request.result.map(record => record.data);
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Sync offline data when back online
  public async syncOfflineData(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    console.log('Starting offline data sync...');

    try {
      const pendingRequests = await this.getPendingRequests();
      console.log(`Found ${pendingRequests.length} pending requests to sync`);

      for (const request of pendingRequests) {
        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body
          });

          if (response.ok) {
            await this.removeOfflineRequest(request.id);
            console.log(`Synced offline request: ${request.id}`);
          } else {
            console.error(`Failed to sync request ${request.id}:`, response.status);
            await this.incrementRetryCount(request.id);
          }
        } catch (error) {
          console.error(`Error syncing request ${request.id}:`, error);
          await this.incrementRetryCount(request.id);
        }
      }

      // Clean up local records that have been synced
      await this.cleanupSyncedLocalRecords();

    } catch (error) {
      console.error('Error during offline sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Remove synced offline request
  private async removeOfflineRequest(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offlineRequests'], 'readwrite');
      const store = transaction.objectStore('offlineRequests');

      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Increment retry count for failed requests
  private async incrementRetryCount(id: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');

    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        record.retryCount += 1;
        
        // Remove requests that have failed too many times
        if (record.retryCount > 5) {
          store.delete(id);
          console.warn(`Removing failed request after 5 retries: ${id}`);
        } else {
          store.put(record);
        }
      }
    };
  }

  // Clean up local records that have been successfully synced
  private async cleanupSyncedLocalRecords(): Promise<void> {
    // This would involve checking if local records exist in the server data
    // and removing them if they do. Implementation depends on specific sync strategy.
    console.log('Cleaning up synced local records...');
  }

  // Handle sync complete message from service worker
  private handleSyncComplete(syncedCount: number): void {
    console.log(`Background sync completed: ${syncedCount} requests processed`);
    
    // Notify listeners that sync is complete
    this.listeners.forEach(callback => callback(this.isOnline));
  }

  // Get offline status summary
  public async getOfflineStatus(): Promise<{
    isOnline: boolean;
    pendingRequests: number;
    localRecords: number;
    lastSync: number | null;
  }> {
    const pendingRequests = await this.getPendingRequests();
    const allLocalRecords = await this.getAllLocalRecords();
    
    return {
      isOnline: this.isOnline,
      pendingRequests: pendingRequests.length,
      localRecords: allLocalRecords.length,
      lastSync: null // Could store this in localStorage
    };
  }

  // Get all local records across all tables
  private async getAllLocalRecords(): Promise<any[]> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['localData'], 'readonly');
      const store = transaction.objectStore('localData');

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();