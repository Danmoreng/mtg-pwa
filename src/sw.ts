/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback (scope is /mtg-pwa/, so 'index.html' resolves correctly)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Scryfall API cache
registerRoute(
  ({ url }) => url.origin === 'https://api.scryfall.com',
  new StaleWhileRevalidate({
    cacheName: 'scryfall-api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 86400, maxEntries: 1000 })
    ],
  })
)

// Images cache
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 2592000, maxEntries: 1000 })
    ],
  })
)

// Handle push events (if needed for future features)
self.addEventListener('push', (event: PushEvent) => {
  // Handle push notifications here
  console.log('Push event received:', event)
})

// Handle notification clicks (if needed for future features)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  // Handle notification clicks here
  console.log('Notification click event received:', event)
})