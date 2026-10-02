// Service worker — yalnızca https veya localhost'ta çalışır (tarayıcı kuralı).
// Telefondan 192.168.x.x ile bakarken devreye girmez; bu normaldir.
// Görevi: uygulama kabuğunu önbelleğe alıp çevrimdışıyken de açılmasını sağlamak.
// Kur verisi (/api/) hiçbir zaman önbelleğe alınmaz — her zaman ağdan gelir.
const SURUM = "tempo-v8";
const KABUK = ["/", "/index.html", "/app.css", "/app.js", "/altin.js", "/manifest.webmanifest",
  "/ikon/ikon-192.png", "/ikon/apple-touch-icon.png", "/ikon/favicon.png",
  "/marka/tempo-yazi.png", "/marka/tempo-o.png", "/marka/tempo-bant.png", "/marka/altin-bant.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // ağdan, önbelleksiz
  e.respondWith(
    fetch(e.request)
      .then((y) => { const k = y.clone(); caches.open(SURUM).then((c) => c.put(e.request, k)); return y; })
      .catch(() => caches.match(e.request))
  );
});
