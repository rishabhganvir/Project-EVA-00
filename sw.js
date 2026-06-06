const CACHE = 'eva00-v1';
const ASSETS = ['./index.html','./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  if (e.action === 'reschedule') {
    e.waitUntil(clients.matchAll({type:'window'}).then(cls => {
      const c = cls.find(c => c.focused) || cls[0];
      if (c) { c.focus(); c.postMessage({type:'reschedule', taskId: data.taskId}); }
      else clients.openWindow('./index.html#today');
    }));
  } else if (e.action === 'done') {
    e.waitUntil(clients.matchAll({type:'window'}).then(cls => {
      const c = cls.find(c => c.focused) || cls[0];
      if (c) { c.focus(); c.postMessage({type:'markDone', taskId: data.taskId}); }
    }));
  } else {
    e.waitUntil(clients.matchAll({type:'window'}).then(cls => {
      const c = cls.find(c => c.focused) || cls[0];
      if (c) c.focus();
      else clients.openWindow('./index.html#today');
    }));
  }
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { taskId, taskName, scheduledTime, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification('EVA-00 Reminder', {
        body: `"${taskName}" is due now. Have you completed it?`,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'task-' + taskId,
        requireInteraction: true,
        data: { taskId, taskName },
        actions: [
          { action: 'done', title: '✅ Mark done' },
          { action: 'reschedule', title: '🕐 Reschedule' }
        ]
      });
    }, delay);
  }
  if (e.data && e.data.type === 'CANCEL_NOTIFICATION') {
    self.registration.getNotifications({tag: 'task-' + e.data.taskId}).then(ns => ns.forEach(n => n.close()));
  }
});
