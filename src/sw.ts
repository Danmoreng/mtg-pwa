/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

// Precache and route manifest
precacheAndRoute(self.__WB_MANIFEST)

// Add navigation fallback for SPA
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('index.html')
  )
)

// Cache Scryfall API responses
registerRoute(
  ({ url }) => url.origin === 'https://api.scryfall.com',
  new StaleWhileRevalidate({
    cacheName: 'scryfall-api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
        maxEntries: 1000,
      }),
    ],
  })
)

// Cache image requests
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        maxEntries: 1000,
      }),
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