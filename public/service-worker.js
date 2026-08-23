/* global self */

const CACHE_PREFIX = 'fliplet-app-shell-';
const CACHE_METADATA_NAME = 'fliplet-cache-metadata';
const SCOPE_URL = new URL('./', self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname;
const INDEX_URL = new URL('index.html', SCOPE_URL).href;
const ASSET_MANIFEST_URL = new URL('asset-manifest.json', SCOPE_URL).href;
const WEB_MANIFEST_URL = new URL('manifest.json', SCOPE_URL).href;
const FAVICON_URL = new URL('favicon.ico', SCOPE_URL).href;
const APPLE_TOUCH_ICON_URL = new URL('apple-touch-icon.png', SCOPE_URL).href;
const ANDROID_ICON_192_URL = new URL('android-chrome-192x192.png', SCOPE_URL).href;
const ANDROID_ICON_512_URL = new URL('android-chrome-512x512.png', SCOPE_URL).href;
const CACHE_READY_URL = new URL('__fliplet_cache_ready__', SCOPE_URL).href;
const CURRENT_CACHE_URL = new URL('__fliplet_current_cache__', SCOPE_URL).href;
let currentCacheName;

function isAppUrl(value) {
  const url = new URL(value, SCOPE_URL);
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);
}

async function fetchForPrecache(url) {
  const response = await fetch(url, { cache: 'reload' });

  if (!response.ok) {
    throw new Error(`Could not precache ${url} (${response.status})`);
  }

  return response;
}

function hashManifest(manifestText) {
  let hash = 5381;

  for (let index = 0; index < manifestText.length; index += 1) {
    hash = (hash * 33) ^ manifestText.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

async function getCompleteAppCacheNames() {
  const cacheNames = (await caches.keys()).filter((cacheName) =>
    cacheName.startsWith(CACHE_PREFIX)
  );
  const readiness = await Promise.all(
    cacheNames.map(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.match(CACHE_READY_URL)) ? cacheName : null;
    })
  );

  return readiness.filter(Boolean);
}

async function rememberCurrentCache(cacheName) {
  currentCacheName = cacheName;
  const metadataCache = await caches.open(CACHE_METADATA_NAME);
  await metadataCache.put(CURRENT_CACHE_URL, new Response(cacheName));
}

async function getCurrentCacheName() {
  const completeCacheNames = await getCompleteAppCacheNames();

  if (currentCacheName && completeCacheNames.includes(currentCacheName)) {
    return currentCacheName;
  }

  const metadataCache = await caches.open(CACHE_METADATA_NAME);
  const storedResponse = await metadataCache.match(CURRENT_CACHE_URL);
  const storedCacheName = storedResponse ? await storedResponse.text() : '';

  if (completeCacheNames.includes(storedCacheName)) {
    currentCacheName = storedCacheName;
    return storedCacheName;
  }

  currentCacheName = completeCacheNames[completeCacheNames.length - 1];
  return currentCacheName;
}

async function matchCurrentAppCache(request) {
  const selectedCacheName = await getCurrentCacheName();
  const completeCacheNames = await getCompleteAppCacheNames();
  const fallbackCacheNames = completeCacheNames
    .filter((cacheName) => cacheName !== selectedCacheName)
    .reverse();
  const cacheNames = selectedCacheName
    ? [selectedCacheName, ...fallbackCacheNames]
    : fallbackCacheNames;

  for (const cacheName of cacheNames) {
    const response = await (await caches.open(cacheName)).match(request);
    if (response) return response;
  }

  return undefined;
}

async function refreshAppShell() {
  const previousCurrentCacheName = await getCurrentCacheName();
  const manifestResponse = await fetchForPrecache(ASSET_MANIFEST_URL);
  const manifestText = await manifestResponse.clone().text();
  const manifest = JSON.parse(manifestText);
  const cacheName = `${CACHE_PREFIX}${hashManifest(manifestText)}`;
  const cache = await caches.open(cacheName);
  const cacheIsReady = Boolean(await cache.match(CACHE_READY_URL));
  const assetUrls = new Set([
    INDEX_URL,
    ASSET_MANIFEST_URL,
    WEB_MANIFEST_URL,
    FAVICON_URL,
    APPLE_TOUCH_ICON_URL,
    ANDROID_ICON_192_URL,
    ANDROID_ICON_512_URL,
  ]);

  Object.values(manifest.files || {}).forEach((assetPath) => {
    const assetUrl = new URL(assetPath, SCOPE_URL);

    if (isAppUrl(assetUrl) && !assetUrl.pathname.endsWith('.map')) {
      assetUrls.add(assetUrl.href);
    }
  });

  (manifest.entrypoints || []).forEach((assetPath) => {
    const assetUrl = new URL(assetPath, SCOPE_URL);

    if (isAppUrl(assetUrl) && !assetUrl.pathname.endsWith('.map')) {
      assetUrls.add(assetUrl.href);
    }
  });

  const urlsToRefresh = cacheIsReady
    ? [
        INDEX_URL,
        ASSET_MANIFEST_URL,
        WEB_MANIFEST_URL,
        FAVICON_URL,
        APPLE_TOUCH_ICON_URL,
        ANDROID_ICON_192_URL,
        ANDROID_ICON_512_URL,
      ]
    : Array.from(assetUrls);
  let freshIndex;

  const results = await Promise.allSettled(
    urlsToRefresh.map(async (assetUrl) => {
      const response =
        assetUrl === ASSET_MANIFEST_URL
          ? manifestResponse.clone()
          : await fetchForPrecache(assetUrl);

      if (assetUrl === INDEX_URL) {
        freshIndex = response.clone();
      }

      await cache.put(assetUrl, response);
    })
  );
  const failedResult = results.find((result) => result.status === 'rejected');

  if (failedResult) {
    if (!cacheIsReady) {
      await caches.delete(cacheName);
    }

    throw failedResult.reason;
  }

  await cache.put(CACHE_READY_URL, new Response('ready'));
  await rememberCurrentCache(cacheName);

  const cacheNames = await caches.keys();
  const appCacheNames = cacheNames.filter((existingCacheName) =>
    existingCacheName.startsWith(CACHE_PREFIX)
  );
  const completeCacheNames = await getCompleteAppCacheNames();
  const previousCompleteCacheNames = completeCacheNames.filter(
    (existingCacheName) =>
      existingCacheName !== cacheName
  );
  const previousCacheName =
    previousCurrentCacheName &&
    previousCurrentCacheName !== cacheName &&
    previousCompleteCacheNames.includes(previousCurrentCacheName)
      ? previousCurrentCacheName
      : previousCompleteCacheNames[previousCompleteCacheNames.length - 1];
  const cachesToDelete = appCacheNames.filter(
    (existingCacheName) =>
      existingCacheName !== cacheName &&
      existingCacheName !== previousCacheName
  );

  // Keep the immediately previous complete shell for tabs still running it.
  await Promise.all(
    cachesToDelete.map((existingCacheName) => caches.delete(existingCacheName))
  );

  return freshIndex || cache.match(INDEX_URL);
}

self.addEventListener('install', (event) => {
  event.waitUntil(refreshAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (!requestUrl.pathname.startsWith(SCOPE_PATH)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      refreshAppShell().catch(async () => {
        const cachedIndex = await matchCurrentAppCache(INDEX_URL);
        return cachedIndex || fetch(request);
      })
    );
    return;
  }

  if (!['script', 'style', 'font', 'image'].includes(request.destination)) {
    return;
  }

  event.respondWith(
    matchCurrentAppCache(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        const selectedCacheName = await getCurrentCacheName();

        if (selectedCacheName) {
          const cache = await caches.open(selectedCacheName);
          await cache.put(request, networkResponse.clone());
        }
      }

      return networkResponse;
    })
  );
});
