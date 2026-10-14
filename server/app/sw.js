/* VibeCheck PWA Service Worker
 * - navigation: network-first, private HTML is never persisted
 * - app assets: stale-while-revalidate with versioned request support
 * - API writes: network-only with a consistent offline JSON response
 */
const VERSION = 'v1.11.0-redesign-v4-finish';
const CACHE_PREFIX = 'vc-pwa-';
const CACHE_SHELL = `${CACHE_PREFIX}shell-${VERSION}`;
const CACHE_RUNTIME = `${CACHE_PREFIX}runtime-${VERSION}`;
const OFFLINE_URL = '/app/offline.html';
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/app/theme-init.js',
  '/app/offline.js',
  '/app/manifest.webmanifest',
  '/app/app.css',
  '/app/redesign.css',
  '/app/assets/fonts/onest-cyrillic.woff2',
  '/app/assets/fonts/onest-cyrillic-ext.woff2',
  '/app/assets/fonts/onest-latin.woff2',
  '/app/assets/fonts/onest-latin-ext.woff2',
  '/app/app.js',
  '/app/emoji-picker.js',
  '/app/i18n-extra.js',
  '/app/i18n.js',
  '/app/vc_install.js',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png',
  '/app/icons/icon-maskable-512.png',
  '/app/icons/apple-touch-icon.png',
  '/app/icons/badge-96.png',
  '/app/assets/fonts/manrope-regular.woff2',
  '/app/assets/fonts/manrope-medium.woff2',
  '/app/assets/fonts/manrope-semibold.woff2',
  '/app/assets/fonts/manrope-bold.woff2',
  '/app/assets/fonts/literata-600-cyrillic.woff2',
  '/app/assets/fonts/literata-600-latin.woff2'
];

function isCacheableResponse(response) {
  return !!response && response.ok && (response.type === 'basic' || response.type === 'default');
}

async function matchAppAsset(request, allowQueryFreeFallback = false) {
  const runtime = await caches.open(CACHE_RUNTIME);
  const shell = await caches.open(CACHE_SHELL);
  let match = await runtime.match(request);
  if (!match) match = await shell.match(request);
  if (match) return match;

  // Versioned assets must not fall back to a query-free cached copy while the
  // network is available: that could run an older app.js after a deployment.
  // The query-free pre-cache is only used below as an explicit offline fallback.
  const url = new URL(request.url);
  if (allowQueryFreeFallback && url.search) {
    match = await runtime.match(url.pathname);
    if (!match) match = await shell.match(url.pathname);
  }
  return match || null;
}

async function evictStaleVersionedAssets(runtime, request) {
  const url = new URL(request.url);
  if (!url.search) return;
  const keys = await runtime.keys();
  const stale = [];
  for (const key of keys) {
    const keyUrl = new URL(key.url);
    if (keyUrl.pathname === url.pathname && keyUrl.search !== url.search) stale.push(key);
  }
  await Promise.all(stale.map((key) => runtime.delete(key)));
}

async function fetchAndCacheAsset(request) {
  const response = await fetch(request);
  if (!isCacheableResponse(response)) return response;
  try {
    const runtime = await caches.open(CACHE_RUNTIME);
    await runtime.put(request, response.clone());
    await evictStaleVersionedAssets(runtime, request);
  } catch (error) {
    // Cache Storage full or unavailable (e.g. QuotaExceededError): serve the
    // live network response instead of failing into an Offline 503 (APP-004).
  }
  return response;
}

self.addEventListener('install', (event) => {
  // A failed core pre-cache keeps the previous worker active instead of
  // activating a partially usable offline release.
  event.waitUntil(caches.open(CACHE_SHELL).then((cache) => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_SHELL && key !== CACHE_RUNTIME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // A root-scope registration (shell served at "/") must leave everything outside the app alone.
  if (url.pathname !== '/' && !url.pathname.startsWith('/app/')) return;

  const isApi = url.pathname === '/app/api.php' || url.pathname === '/app/auth.php';
  if (isApi) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ ok: false, err: 'offline' }),
      {
        status: 503,
        statusText: 'Offline',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    )));
    return;
  }

  // Other mutations must pass through untouched and must never enter a cache.
  if (request.method === 'HEAD') {
    event.respondWith(fetch(request));
    return;
  }
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const fallback = await caches.match(OFFLINE_URL);
        return fallback || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  const isAppAsset = url.pathname.startsWith('/app/') && (
    /\.(css|js|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|webmanifest|ico)$/.test(url.pathname) ||
    url.pathname.startsWith('/app/icons/')
  );

  if (isAppAsset) {
    const refresh = fetchAndCacheAsset(request);
    event.waitUntil(refresh.then(() => undefined).catch(() => undefined));
    event.respondWith((async () => {
      const cached = await matchAppAsset(request, false);
      if (cached) {
        return cached;
      }
      try {
        return await refresh;
      } catch (error) {
        const fallback = await matchAppAsset(request, true);
        if (fallback) return fallback;
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // User photos and other private resources are intentionally network-only.
  event.respondWith(fetch(request));
});

/* Web Push handlers */
const PUSH_ACTION_COPY = {
  uk: { open: '\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438', dismiss: '\u0417\u0430\u043a\u0440\u0438\u0442\u0438' },
  ru: { open: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c', dismiss: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c' },
  en: { open: 'Open', dismiss: 'Close' },
  es: { open: 'Abrir', dismiss: 'Cerrar' },
  de: { open: '\u00d6ffnen', dismiss: 'Schlie\u00dfen' },
  fr: { open: 'Ouvrir', dismiss: 'Fermer' },
  pt: { open: 'Abrir', dismiss: 'Fechar' },
  it: { open: 'Apri', dismiss: 'Chiudi' },
  tr: { open: 'A\u00e7', dismiss: 'Kapat' }
};

function notificationLocale(payload) {
  const raw = payload.lang || payload.locale || (payload.data && (payload.data.lang || payload.data.locale)) || 'ru';
  const locale = String(raw).toLowerCase().split(/[-_]/)[0];
  return locale === 'uk' ? 'uk' : 'ru';
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Откровенно';
  const locale = notificationLocale(payload);
  const actionCopy = PUSH_ACTION_COPY[locale];
  const actions = Array.isArray(payload.actions) && payload.actions.length
    ? payload.actions.slice(0, 2)
    : [
        { action: 'open', title: actionCopy.open },
        { action: 'dismiss', title: actionCopy.dismiss }
      ];
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/app/icons/icon-192.png',
    badge: payload.badge || '/app/icons/badge-96.png',
    tag: payload.tag || 'msg',
    data: Object.assign({}, payload.data || {}, { url: payload.url || (payload.data && payload.data.url) || '/app/', lang: locale }),
    lang: locale,
    vibrate: [80, 40, 80],
    requireInteraction: false,
    actions
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  // Root mode (scope "/"): the shell lives at "/" and "/app/" only redirects there, so open "/" directly.
  const scopePath = new URL(self.registration.scope).pathname;
  let targetUrl = new URL(scopePath, self.location.origin).href;
  try {
    const requested = new URL(
      (event.notification.data && event.notification.data.url) || scopePath,
      self.location.origin
    );
    if (requested.origin === self.location.origin && (requested.pathname.startsWith('/app/') || requested.pathname === '/')) {
      if (scopePath === '/' && (requested.pathname === '/app/' || requested.pathname === '/app/index.php')) requested.pathname = '/';
      targetUrl = requested.href;
    }
  } catch (error) {}

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if (client.url.includes('/app/') || new URL(client.url).pathname === '/') {
        await client.focus();
        client.postMessage({ type: 'navigate', url: targetUrl });
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  }));
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    let subscription = event.newSubscription || null;
    let error = '';

    /* Chromium can fire this event without a replacement subscription. Reuse
       the previous applicationServerKey where the browser exposes it, then let
       the open app persist the replacement on its authenticated API route. */
    if (!subscription) {
      try {
        const options = { userVisibleOnly: true };
        const oldOptions = event.oldSubscription && event.oldSubscription.options;
        if (oldOptions && oldOptions.applicationServerKey) {
          options.applicationServerKey = oldOptions.applicationServerKey;
        }
        subscription = await self.registration.pushManager.subscribe(options);
      } catch (subscriptionError) {
        error = subscriptionError && subscriptionError.message ? subscriptionError.message : 'resubscribe_failed';
      }
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const message = {
      type: 'pushsubscriptionchange',
      subscription: subscription ? subscription.toJSON() : null,
      error
    };
    clients.forEach((client) => client.postMessage(message));
  })());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'content-refresh') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);
    await Promise.allSettled(SHELL_ASSETS.map(async (asset) => {
      const response = await fetch(asset, { cache: 'no-store' });
      if (isCacheableResponse(response)) await cache.put(asset, response);
    }));
  })());
});
