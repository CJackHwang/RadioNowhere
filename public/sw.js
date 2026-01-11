self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through for now
});
