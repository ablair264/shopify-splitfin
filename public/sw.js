// Service Worker for Splitfin App
// Provides offline functionality and caching

const CACHE_NAME = 'splitfin-v1.0.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/dashboard',
  '/customers',
  '/enquiries',
  '/orders',
  '/inventory',
  '/analytics',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache resources:', error);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Supabase API calls for special handling
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(handleSupabaseRequest(request));
    return;
  }
  
  // Handle static assets and pages
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Try to fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache if not ok
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response for caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Return offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            return new Response('Offline content not available', { status: 503 });
          });
      })
  );
});

// Handle Supabase API requests with offline fallback
async function handleSupabaseRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Network failed for Supabase request, checking cache...');
    
    // For GET requests, try cache
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('Serving cached Supabase data');
        return cachedResponse;
      }
    }
    
    // For POST/PUT/DELETE requests, store for later sync
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const requestBody = await request.clone().text();
      await storeOfflineRequest({
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: requestBody,
        timestamp: Date.now()
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Stored for offline sync',
        offline: true 
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw error;
  }
}

// Store offline requests for later sync
async function storeOfflineRequest(requestData) {
  try {
    const cache = await caches.open(`${CACHE_NAME}-offline-requests`);
    const key = `offline-request-${requestData.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    await cache.put(key, new Response(JSON.stringify(requestData)));
    console.log('Stored offline request:', key);
  } catch (error) {
    console.error('Failed to store offline request:', error);
  }
}

// Background sync for offline requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    event.waitUntil(syncOfflineRequests());
  }
});

// Sync stored offline requests when back online
async function syncOfflineRequests() {
  try {
    const cache = await caches.open(`${CACHE_NAME}-offline-requests`);
    const requests = await cache.keys();
    
    console.log(`Found ${requests.length} offline requests to sync`);
    
    for (const request of requests) {
      try {
        const response = await cache.match(request);
        const requestData = await response.json();
        
        // Attempt to replay the request
        const replayResponse = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (replayResponse.ok) {
          // Remove from offline cache if successful
          await cache.delete(request);
          console.log('Successfully synced offline request:', request.url);
        } else {
          console.error('Failed to sync offline request:', replayResponse.status);
        }
      } catch (error) {
        console.error('Error syncing individual request:', error);
      }
    }
    
    // Notify the app that sync is complete
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_SYNC_COMPLETE',
        syncedCount: requests.length
      });
    });
    
  } catch (error) {
    console.error('Error during offline sync:', error);
  }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== `${CACHE_NAME}-offline-requests`) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_OFFLINE_STATUS') {
    event.ports[0].postMessage({
      isOnline: navigator.onLine,
      hasOfflineData: true // We'll implement this check
    });
  }
});

console.log('Service Worker loaded successfully');