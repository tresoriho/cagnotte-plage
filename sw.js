/**
 * Service Worker — Cagnotte Sortie Plage 🏖️
 * Gère le cache hors-ligne, les notifications PUSH natives et l'installation PWA.
 */

const CACHE_NAME = 'cagnotte-plage-v1.3';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/config.js',
    './js/supabase.js',
    './js/countdown.js',
    './js/notifications.js',
    './js/participants.js',
    './js/payments.js',
    './js/admin.js',
    './js/app.js',
    './assets/images/app-logo.png',
    './assets/images/wave-logo.png',
    './assets/images/hero-beach.jpg',
    './assets/images/friends-beach.jpg',
    './assets/icons/favicon.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/icons/apple-touch-icon.png'
];

// Installation du Service Worker et mise en cache initiale
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn("Certains assets n'ont pas pu être mis en cache :", err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Stratégie Réseau en premier avec fallback sur le cache
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // Ne pas intercepter les appels API Supabase ou externes en direct
    if (event.request.url.includes('supabase.co') || event.request.url.includes('api.wave.com') || event.request.url.includes('qrserver.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Réception des Notifications PUSH natives
self.addEventListener('push', (event) => {
    let payload = {
        title: '🏖️ Sortie Plage — Nouvelle mise à jour',
        body: 'Un événement vient de se produire sur la cagnotte !',
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        url: './index.html'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            payload = Object.assign(payload, parsed);
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || './assets/icons/icon-192.png',
        badge: payload.badge || './assets/icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'cagnotte-notification-' + Date.now(),
        renotify: true,
        data: {
            url: payload.url || './index.html'
        },
        actions: [
            { action: 'open', title: '👀 Voir la cagnotte' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// Clic sur une notification du système
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = new URL(event.notification.data?.url || './index.html', self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
