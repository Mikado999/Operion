// Change this version number to trigger an update!
const VERSION = 'v1.1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Chrome REQUIRES a fetch handler to show the install button
self.addEventListener('fetch', (event) => {
  // We don't have to do anything here, just having the listener is enough
});

// Support for the skipWaiting message
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
