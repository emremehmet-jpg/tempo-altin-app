// Tempo Döviz uygulaması — geliştirme sunucusu.
//
// İki iş yapar:
//   1. public/ klasörünü olduğu gibi sunar (uygulamanın kendisi).
//   2. /api/... isteklerini www.tempodoviz.com'a, /api/altin/... isteklerini
//      tempoaltin.com'a aktarır (ikisinin de CORS başlığı yok).
//
// 2. madde neden gerekli: sitenin API'si yalnızca kendi adresinden çağrıya
// izin veriyor (CORS başlığı yok). Telefondaki uygulama 192.168.x.x'ten
// doğrudan siteye soramaz; bu sunucu araya girip soruyor. Uygulama ileride
// sitenin altına (tempodoviz.com/app) alındığında aynı adreste olacağı için
// bu aktarma katmanına gerek kalmaz.
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
const PORT = Number(process.env.PORT || 3100);
const PORT_HTTPS = PORT + 1;
const SITE = "www.tempodoviz.com";
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
  ".gz": "application/gzip",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

// Site API'si IP başına istek sınırı koyuyor (429 gördük: testler + telefon +
// Mac aynı IP'den soruyordu). Bu yüzden yanıtlar burada kısa süre saklanır;
// kaç istemci olursa olsun siteye seyrek gidilir. Site 429/hata dönerse son
// bilinen yanıt verilir (bayat ama boş değil).
const ONBELLEK_SN = { "/api/rates/live": 15, "/api/rates/history": 300, "/api/tcmb/gecmis": 3600, "/api/altin/fiyatlar": 30 };
const onbellek = new Map(); // url → { zaman, durum, tur, govde }
const bekleyen = new Map(); // url → Promise (aynı anda tek üst istek)

function ustIstek(url) {
  // Altın uçları ayrı sitede: /api/altin/x → tempoaltin.com/api/x
  const altin = url.startsWith("/api/altin/");
  const hedef = altin ? SITE_ALTIN : SITE;
  const yol = altin ? url.replace("/api/altin/", "/api/") : url;
  return new Promise((cozul) => {
    const dis = https.request({ hostname: hedef, path: yol, method: "GET",
      headers: { "user-agent": "TempoDovizApp/0.1 (gelistirme)", accept: "application/json" } }, (yanit) => {
      const parcalar = [];
      yanit.on("data", (p) => parcalar.push(p));
      yanit.on("end", () => cozul({ durum: yanit.statusCode || 502, tur: yanit.headers["content-type"] || "application/json", govde: Buffer.concat(parcalar) }));
    });
    dis.on("error", (hata) => cozul({ durum: 502, tur: "application/json; charset=utf-8", govde: Buffer.from(JSON.stringify({ hata: "Siteye ulaşılamadı: " + hata.message })) }));
    dis.end();
  });
}

async function apiAktar(req, res) {
  const url = req.url;
  const yol = url.split("?")[0];
  const sure = ONBELLEK_SN[yol] ?? 0;
  const eski = onbellek.get(url);
  const simdi = Date.now();
  let yanit;
  if (eski && simdi - eski.zaman < sure * 1000) {
    yanit = eski;
  } else {
    if (!bekleyen.has(url)) {
      bekleyen.set(url, ustIstek(url).finally(() => bekleyen.delete(url)));
    }
    const taze = await bekleyen.get(url);
    if (taze.durum === 200) {
      yanit = { ...taze, zaman: simdi };
      onbellek.set(url, yanit);
    } else if (eski) {
      yanit = { ...eski, bayat: true }; // site sınır koydu / hata verdi → son bilinen
      console.warn(`API ${taze.durum} (${yol}) — önbellekten bayat yanıt verildi`);
    } else {
      yanit = taze;
      if (taze.durum === 429) console.warn(`API 429 (${yol}) — site istek sınırı; birkaç dakika bekleyin`);
    }
  }
  res.writeHead(yanit.durum, {
    "content-type": yanit.tur,
    "cache-control": "no-store",
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
    // Okuma motoru dosyaları (~20 MB) değişmez: bir kez insin, telefonda kalsın.
    // Geri kalanı geliştirme sırasında her açılışta taze gelsin.
    const kalici = yol.startsWith("/lens/vendor/");
    res.writeHead(200, {
      "content-type": MIME[uz] || "application/octet-stream",
      "cache-control": kalici ? "public, max-age=31536000, immutable" : "no-cache",
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
  if (yol.startsWith("/api/")) { apiAktar(req, res); return; }
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
    adresleriYaz("Tempo Döviz uygulaması ZATEN ÇALIŞIYOR. Bu pencereyi kapatabilirsin.");
    process.exit(0);
  }
  console.error("Sunucu başlatılamadı:", hata.message);
  process.exit(1);
});

sunucu.listen(PORT, "0.0.0.0", () => {
  // HTTPS: sertifika varsa aynı uygulamayı bir de güvenli porttan sun.
  // Telefonda canlı kamera yalnızca https'te açılır.
  const crt = path.join(SERTIFIKA, "server.crt"), key = path.join(SERTIFIKA, "server.key");
  if (fs.existsSync(crt) && fs.existsSync(key)) {
    https.createServer({ cert: fs.readFileSync(crt), key: fs.readFileSync(key) }, istek)
      .listen(PORT_HTTPS, "0.0.0.0", () => { httpsVar = true; adresleriYaz("Tempo Döviz uygulaması çalışıyor:"); bitir(); })
      .on("error", (h) => { console.error("HTTPS açılamadı:", h.message); adresleriYaz("Tempo Döviz uygulaması çalışıyor (yalnızca http):"); bitir(); });
  } else {
    adresleriYaz("Tempo Döviz uygulaması çalışıyor:");
    bitir();
  }
  function bitir() {
    console.log("Bu pencere açık kaldığı sürece uygulama telefondan açılır.");
    console.log("Durdurmak için pencereyi kapat (veya Ctrl+C).");
  }
});
