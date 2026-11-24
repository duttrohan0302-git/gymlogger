// GymLogger service worker: lets the app open with no signal.
// - Page loads: network first (so new deploys show up), cached copy when offline
// - Built assets (hashed filenames): cache first
// - GitHub API (sync) is never touched: it's cross-origin and handled by the app
const CACHE = 'gymlogger-v1'
const SCOPE = self.registration.scope

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([SCOPE, SCOPE + 'manifest.webmanifest'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(SCOPE, copy)); return res })
        .catch(() => caches.match(SCOPE))
    )
    return
  }

  if (req.url.includes('/assets/') || req.url.includes('/icons/')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
        return res
      }))
    )
    return
  }

  // Everything else (seed data, manifest): network first, cache fallback
  e.respondWith(
    fetch(req)
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res })
      .catch(() => caches.match(req))
  )
})
