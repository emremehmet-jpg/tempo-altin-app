// Tempo Altın uygulaması — geliştirme sunucusu.
//
// İki iş yapar:
//   1. public/ klasörünü olduğu gibi sunar (uygulamanın kendisi).
//   2. /api/altin/... isteklerini tempoaltin.com/api/...'ye aktarır.
//
// 2. madde neden gerekli: sitenin API'si CORS başlığı vermiyor. Telefondaki
// uygulama 192.168.x.x'ten doğrudan siteye soramaz; bu sunucu araya girip
// soruyor. Uygulama ileride sitenin altına (tempoaltin.com/app) alındığında
// aynı adreste olacağı için bu aktarma katmanına gerek kalmaz.
//
// Port 3200 (Tempo Döviz uygulaması 3100'de; ikisi yan yana çalışır).
//
// Hiçbir paket gerektirmez: `node server.mjs` yeter.

import http from "node:http";
import https from "node:https";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const KOK = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(KOK, "public");
const PORT = Number(process.env.PORT || 3200);
const PORT_HTTPS = PORT + 1;
const SITE_ALTIN = "tempoaltin.com"; // /api/altin/fiyatlar → tempoaltin.com/api/fiyatlar
const SERTIFIKA = path.join(KOK, "sertifika");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
};

// Site API'leri IP başına istek sınırı koyabiliyor (Döviz'de 429 gördük: testler +
// telefon + Mac aynı IP'den soruyordu). Bu yüzden yanıtlar burada kısa süre saklanır;
// kaç istemci olursa olsun siteye seyrek gidilir. Site 429/hata dönerse son
// bilinen yanıt verilir (bayat ama boş değil).
// Uygulamanın uçları → sitedeki karşılığı. Süre: önbellekte kaç saniye kalır.
//   /api/altin/fiyatlar          → /api/fiyatlar (JSON, olduğu gibi)
//   /api/altin/urun-fiyatlari    → /arama?q=a sayfası okunur, 87 ürünün GERÇEK satış/alış
//                                  fiyatı JSON'a çevrilir (sitede ürün fiyatı için JSON uç yok;
//                                  fiyatlar sunucuda HTML'e basılıyor). Biçim değişir de
//                                  okunamazsa boş döner, uygulama formüle düşer.
//   /api/altin/gorsel?u=&w=      → /_next/image (sitenin küçültülmüş ürün görseli)
const UC = {
  "/api/altin/fiyatlar": { sure: 30, yol: () => "/api/fiyatlar" },
  "/api/altin/urun-fiyatlari": { sure: 60, yol: () => "/arama?q=a", cevir: urunFiyatlariOku },
  "/api/altin/gorsel": { sure: 6 * 3600, yol: gorselYolu, ikili: true },
};
const onbellek = new Map(); // url → { zaman, durum, tur, govde }
const bekleyen = new Map(); // url → Promise (aynı anda tek üst istek)

// Görsel: yalnız sitenin kendi /urun/ ve /marka/ yolları; genişlik Next'in izinli boyutlarından
function gorselYolu(q) {
  const u = q.get("u") || "";
  if (!/^\/(urun|marka)\/[\w./-]+\.(jpg|jpeg|png|webp)$/i.test(u)) return null;
  const w = [384, 640, 1080].includes(Number(q.get("w"))) ? Number(q.get("w")) : 640;
  return `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75`;
}

// Arama sayfasındaki ürün kartları: <article> … href="/urun/<slug>" … <p>7.203<!-- -->,<span>43</span> <span>₺</span></p>
// <p>7.203,43 ₺ / gr · alış 6.511,82 ₺</p> … (tükenmişse "Tükendi")
function urunFiyatlariOku(html) {
  const sayi = (t) => Number(t.replace(/\./g, "").replace(",", "."));
  const duz = (t) => t.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const fiyatlar = {};
  for (const kart of html.split("<article").slice(1)) {
    const slug = kart.match(/href="\/urun\/([a-z0-9-]+)"/)?.[1];
    if (!slug || fiyatlar[slug]) continue;
    const p = [...kart.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => duz(m[1]));
    const satis = p.map((t) => t.match(/^([\d.]+,\d{2}) ₺$/)).find(Boolean);
    const alt = p.find((t) => /alış/.test(t)) || "";
    if (!satis) continue;
    fiyatlar[slug] = {
      satis: sayi(satis[1]),
      gramBasi: (alt.match(/([\d.]+,\d{2}) ₺ \/ gr/) || [])[1] ? sayi(alt.match(/([\d.]+,\d{2}) ₺ \/ gr/)[1]) : null,
      alis: (alt.match(/alış ([\d.]+,\d{2})/) || [])[1] ? sayi(alt.match(/alış ([\d.]+,\d{2})/)[1]) : null,
      tukendi: /Tükendi|Yakında Stokta/.test(duz(kart)),
    };
  }
  return { okunan: Object.keys(fiyatlar).length, zaman: new Date().toISOString(), fiyatlar };
}

function ustIstek(yol, ikili) {
  return new Promise((cozul) => {
    const dis = https.request({ hostname: SITE_ALTIN, path: yol, method: "GET",
      headers: { "user-agent": "TempoAltinApp/0.1 (gelistirme)", accept: ikili ? "image/webp,image/*" : "application/json,text/html" } }, (yanit) => {
      const parcalar = [];
      yanit.on("data", (p) => parcalar.push(p));
      yanit.on("end", () => cozul({ durum: yanit.statusCode || 502, tur: yanit.headers["content-type"] || "application/json", govde: Buffer.concat(parcalar) }));
    });
    dis.on("error", (hata) => cozul({ durum: 502, tur: "application/json; charset=utf-8", govde: Buffer.from(JSON.stringify({ hata: "Siteye ulaşılamadı: " + hata.message })) }));
    dis.end();
  });
}

async function apiAktar(req, res) {
  const adres = new URL(req.url, "http://x");
  const uc = UC[adres.pathname];
  const siteYolu = uc && uc.yol(adres.searchParams);
  if (!siteYolu) { res.writeHead(404, { "content-type": "application/json; charset=utf-8" }); return res.end('{"hata":"Bilinmeyen uç"}'); }
  const anahtar = siteYolu;
  const eski = onbellek.get(anahtar);
  const simdi = Date.now();
  let yanit;
  if (eski && simdi - eski.zaman < uc.sure * 1000) {
    yanit = eski;
  } else {
    if (!bekleyen.has(anahtar)) {
      bekleyen.set(anahtar, ustIstek(siteYolu, uc.ikili).finally(() => bekleyen.delete(anahtar)));
    }
    let taze = await bekleyen.get(anahtar);
    if (taze.durum === 200 && uc.cevir) {
      const v = uc.cevir(taze.govde.toString("utf8"));
      // Hiç ürün okunamadıysa (sayfa biçimi değişti) başarısız say → son bilinen / boş
      taze = v.okunan ? { durum: 200, tur: "application/json; charset=utf-8", govde: Buffer.from(JSON.stringify(v)) }
                      : { durum: 502, tur: "application/json; charset=utf-8", govde: Buffer.from('{"hata":"Ürün fiyatları okunamadı","fiyatlar":{}}') };
      if (!v.okunan) console.warn("Arama sayfasından ürün fiyatı okunamadı — sayfa biçimi değişmiş olabilir");
    }
    if (taze.durum === 200) {
      yanit = { ...taze, zaman: simdi };
      onbellek.set(anahtar, yanit);
    } else if (eski) {
      yanit = { ...eski, bayat: true }; // site sınır koydu / hata verdi → son bilinen
      console.warn(`API ${taze.durum} (${adres.pathname}) — önbellekten bayat yanıt verildi`);
    } else {
      yanit = taze;
      if (taze.durum === 429) console.warn(`API 429 (${adres.pathname}) — site istek sınırı; birkaç dakika bekleyin`);
    }
  }
  res.writeHead(yanit.durum, {
    "content-type": yanit.tur,
    "cache-control": uc.ikili && yanit.durum === 200 ? "public, max-age=21600" : "no-store",
    ...(yanit.bayat ? { "x-tempo-bayat": "1" } : {}),
  });
  res.end(yanit.govde);
}

function dosyaSun(req, res) {
  let yol = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (yol === "/") yol = "/index.html";
  const tam = path.normalize(path.join(PUBLIC, yol));
  if (!tam.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(tam, (hata, veri) => {
    if (hata) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Bulunamadı: " + yol);
    }
    const uz = path.extname(tam).toLowerCase();
    // Geliştirme sırasında her açılışta taze gelsin
    res.writeHead(200, {
      "content-type": MIME[uz] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(veri);
  });
}

function agAdresleri() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);
}
function bonjourAdi() {
  try { return execSync("scutil --get LocalHostName", { encoding: "utf8" }).trim() + ".local"; } catch { return null; }
}
function adresleriYaz(baslik) {
  const ip = agAdresleri()[0];
  const ad = bonjourAdi();
  console.log("");
  console.log(baslik);
  console.log(`  Bu Mac:            http://localhost:${PORT}`);
  if (httpsVar) {
    console.log(`  Telefon (https):   https://${ad || ip}:${PORT_HTTPS}`);
    console.log(`  İlk kurulum:       http://${ip}:${PORT}/kurulum   ← telefonda BİR KEZ aç`);
  } else {
    console.log(`  Telefon:           http://${ip}:${PORT}   (aynı Wi-Fi)`);
    console.log("  (https yok: önce  zsh sertifika/uret.sh  çalıştırın)");
  }
  console.log("");
}

function istek(req, res) {
  const yol = new URL(req.url, "http://x").pathname;
  if (yol.startsWith("/api/altin/")) { apiAktar(req, res); return; }
  if (yol.startsWith("/api/")) { res.writeHead(404); return res.end(); }
  if (yol === "/tempo-ca.crt") {
    // iPhone bu dosyayı "profil" olarak tanır ve kurulumu önerir
    return fs.readFile(path.join(SERTIFIKA, "ca.crt"), (h, v) => {
      if (h) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": "application/x-x509-ca-cert", "content-disposition": 'attachment; filename="tempo-ca.crt"' });
      res.end(v);
    });
  }
  if (yol === "/adres") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    return res.end(JSON.stringify({ ip: agAdresleri()[0], ad: bonjourAdi(), portHttps: httpsVar ? PORT_HTTPS : null, port: PORT }));
  }
  if (yol === "/kurulum") { req.url = "/kurulum.html"; }
  dosyaSun(req, res);
}

let httpsVar = false;
const sunucu = http.createServer(istek);

sunucu.on("error", (hata) => {
  if (hata.code === "EADDRINUSE") {
    // Başlat.command'a ikinci kez tıklanınca buraya düşer: sorun yok,
    // önceki kopya çalışmaya devam ediyor.
    httpsVar = fs.existsSync(path.join(SERTIFIKA, "server.crt"));
    adresleriYaz("Tempo Altın uygulaması ZATEN ÇALIŞIYOR. Bu pencereyi kapatabilirsin.");
    process.exit(0);
  }
  console.error("Sunucu başlatılamadı:", hata.message);
  process.exit(1);
});

sunucu.listen(PORT, "0.0.0.0", () => {
  // HTTPS: sertifika varsa aynı uygulamayı bir de güvenli porttan sun.
  // Telefonda ana ekran uygulaması (service worker, çevrimdışı açılış) yalnızca https'te tam çalışır.
  const crt = path.join(SERTIFIKA, "server.crt"), key = path.join(SERTIFIKA, "server.key");
  if (fs.existsSync(crt) && fs.existsSync(key)) {
    https.createServer({ cert: fs.readFileSync(crt), key: fs.readFileSync(key) }, istek)
      .listen(PORT_HTTPS, "0.0.0.0", () => { httpsVar = true; adresleriYaz("Tempo Altın uygulaması çalışıyor:"); bitir(); })
      .on("error", (h) => { console.error("HTTPS açılamadı:", h.message); adresleriYaz("Tempo Altın uygulaması çalışıyor (yalnızca http):"); bitir(); });
  } else {
    adresleriYaz("Tempo Altın uygulaması çalışıyor:");
    bitir();
  }
  function bitir() {
    console.log("Bu pencere açık kaldığı sürece uygulama telefondan açılır.");
    console.log("Durdurmak için pencereyi kapat (veya Ctrl+C).");
  }
});
