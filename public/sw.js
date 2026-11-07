/* Notifications only. No fetch interception, no offline caching, no Push subscription yet. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = pages.find(page => new URL(page.url).origin === self.location.origin);
    if (open) { await open.focus(); return; }
    await self.clients.openWindow('/?resume=1');
  })());
});
