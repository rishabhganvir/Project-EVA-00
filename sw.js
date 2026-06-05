/* ============================================================
   EVA-00 SERVICE WORKER
   Enables offline use, caching, and background push notifications
   ============================================================ */

const CACHE_NAME = 'eva00-v1';
const OFFLINE_CACHE = 'eva00-offline-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&family=Nunito+Sans:wght@300;400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css',
];

// ---- INSTALL ----
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS.filter(url => !url.startsWith('http')));
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE ----
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== OFFLINE_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH — Network first, fallback to cache ----
self.addEventListener('fetch', (e) => {
  // Skip non-GET and API calls
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.anthropic.com')) return;
  if (e.request.url.includes('mcp.notion.com')) return;
  if (e.request.url.includes('googleapis.com/mcp')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // For navigation requests, serve app shell
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// ---- PUSH NOTIFICATIONS ----
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'EVA-00 Reminder';
  const options = {
    body: data.body || 'You have a pending task.',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'done', title: '✓ Mark done' },
      { action: 'snooze', title: '⏰ Snooze 30 min' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ---- NOTIFICATION CLICK ----
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'done') {
    // Could post message to client to mark task done
    self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({ action: 'task-done', taskId: e.notification.data.taskId }));
    });
  } else if (e.action === 'snooze') {
    // Snooze for 30 minutes
    const taskId = e.notification.data?.taskId;
    setTimeout(() => {
      self.registration.showNotification('⏰ EVA-00 Snooze reminder', {
        body: e.notification.body,
        icon: 'icons/icon-192.png',
        data: e.notification.data
      });
    }, 30 * 60 * 1000);
  } else {
    // Open app on notification tap
    e.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/index.html');
        }
      })
    );
  }
});

// ---- BACKGROUND SYNC ----
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-tasks') {
    // Future: sync tasks to backend
    console.log('[EVA-00 SW] Background sync triggered');
  }
});

// ---- PERIODIC SYNC (if supported) ----
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'morning-briefing') {
    e.waitUntil(
      self.registration.showNotification('☀️ Good morning from EVA-00', {
        body: 'Your day is ready. Tap to see today\'s tasks.',
        icon: 'icons/icon-192.png'
      })
    );
  }
});
