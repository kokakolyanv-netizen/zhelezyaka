// Офлайн-кэш: приложение открывается без сети, данные берутся из сохранённой копии.
// Запросы к серверу (Google Apps Script) не кэшируются: записи без сети копит очередь в самом приложении.
// Свежая версия приложения: сначала сеть (до 1,5 с), без сети или на медленной — копия из кэша.
const VERSION = "zhelezyaka-v4";
const SHELL = ["./", "index.html", "config.js", "css/app.css", "manifest.webmanifest", "demo/seed.json",
  "js/main.js", "js/state.js", "js/api.js", "js/util.js", "js/shared.js", "js/common.js", "js/athlete.js", "js/coach.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // по одному файлу: если какого-то нет (например, демо-данных в рабочей сборке), остальное всё равно закэшируется
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache:"reload"})).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, {ignoreSearch:true});
    if (isFont && hit) return hit;
    const net = fetch(req, {cache:"no-cache"}).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; });
    if (!hit) return net.catch(() => cache.match("index.html"));
    return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 1500))]);
  })());
});
