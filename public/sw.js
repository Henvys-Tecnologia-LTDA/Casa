// Service worker do Casa a Dois: mostra os avisos (web push) e, no toque, abre o app na tela do aviso.
// Quem manda os avisos é a Edge Function notify (supabase/functions/notify).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Casa a Dois', {
    body: data.body || '',
    icon: '/icon-192.png',
    lang: 'pt-BR',
    data: { url: data.url || '/', household: data.household || null },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const { url, household } = event.notification.data || {};
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) {
      await wins[0].focus();
      wins[0].postMessage({ type: 'abrir-aviso', url, household });
      return;
    }
    const target = new URL(url || '/', self.location.origin);
    if (household) target.searchParams.set('casal', household);
    await self.clients.openWindow(target.href);
  })());
});
