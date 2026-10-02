// Yatay TEMPO DÖVİZ | 1988 logosunu (beyaz zemin, lacivert) üç MASKE parçasına böler:
//   tempo-yazi.png  "TEMP" (O hariç)      tempo-o.png  yalnız O      tempo-bant.png  "DÖVİZ | 1988" bandı
// Maske = koyu piksel opak, beyaz şeffaf (bant içindeki beyaz yazı da şeffaf → renk verilince
// bant dolu, yazı delik kalır). Uygulamada CSS mask + currentColor ile istenen renkte çizilir;
// O ayrı parça olduğu için tek başına döndürülüp zıplatılabilir.
// Kullanım: node arac/logo-parcala.mjs <logo.png> <cikti-klasoru> [önek=tempo]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const [,, girdi, klasor, onek = "tempo"] = process.argv;
const B = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const port = 9336;
const p = spawn(B, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/tempo-brave-logo2`, "about:blank"], { stdio: "ignore" });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const bekleyen = new Map();
const cagir = (m, params = {}) => new Promise((res, rej) => { const k = ++id; bekleyen.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method: m, params })); });
const b64 = fs.readFileSync(girdi).toString("base64");
const mime = girdi.endsWith(".jpg") ? "image/jpeg" : "image/png";
const kod = `
(async () => {
  const img = new Image(); img.src = "data:${mime};base64,${b64}"; await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H), px = d.data;
  // alfa = koyuluk (beyaz 0 → şeffaf, lacivert → opak); renk siyah (maske için önemsiz)
  const out = new Uint8ClampedArray(W * H * 4);
  // kaynak PNG şeffaf olabilir: kendi alfası da sınır
  // Renkli (altın) logo da olabilir: beyaza yakın piksel şeffaf (bant yazısı), gerisi kendi alfasıyla opak
  for (let i = 0; i < W * H; i++) { const lum = (px[i*4] + px[i*4+1] + px[i*4+2]) / 3; const koyu = Math.max(0, Math.min(255, Math.round((225 - lum) * 255 / 30))); out[i*4+3] = Math.min(koyu, px[i*4+3]); }
  // satır/sütun doluluk profilleri
  const dolu = (i) => out[i*4+3] > 100;
  const satir = new Array(H).fill(0), sutun = new Array(W).fill(0);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (dolu(y * W + xx)) { satir[y]++; sutun[xx]++; }
  // bant: tam genişliğe yakın dolu satırlar (alt kısım)
  let bantUst = H; for (let y = H - 1; y >= 0; y--) { if (satir[y] > W * 0.6) bantUst = y; else if (bantUst < H) break; }
  // yazı satırları: bant üstündeki dolu bölge
  let yaziAlt = 0; for (let y = bantUst - 1; y >= 0; y--) if (satir[y] > 0) { yaziAlt = y; break; }
  let yaziUst = 0; for (let y = 0; y < yaziAlt; y++) if (satir[y] > 0) { yaziUst = y; break; }
  // O: yazı bölgesinde sağdan ilk boş sütun kümesi (P ile O arası)
  const sutunYazi = new Array(W).fill(0);
  for (let y = yaziUst; y <= yaziAlt; y++) for (let xx = 0; xx < W; xx++) if (dolu(y * W + xx)) sutunYazi[xx]++;
  let sag = W - 1; while (sag > 0 && sutunYazi[sag] === 0) sag--;
  let oSol = sag; while (oSol > 0 && sutunYazi[oSol] > 0) oSol--;      // O'nun sol kenarındaki boşluk
  let pSag = oSol; while (pSag > 0 && sutunYazi[pSag] === 0) pSag--;
  let sol = 0; while (sol < W && sutunYazi[sol] === 0) sol++;
  x.putImageData(new ImageData(out, W, H), 0, 0);
  const kes = (x0, y0, w, h) => { const k = document.createElement("canvas"); k.width = w; k.height = h; k.getContext("2d").drawImage(c, x0, y0, w, h, 0, 0, w, h); return k.toDataURL("image/png"); };
  return JSON.stringify({
    W, H, yaziUst, yaziAlt, bantUst, sol, pSag, oSol, sag,
    yazi: kes(sol, yaziUst, pSag - sol + 1, yaziAlt - yaziUst + 1),
    o: kes(oSol + 1, yaziUst, sag - oSol, yaziAlt - yaziUst + 1),
    bant: kes(0, bantUst, W, H - bantUst),
    tam: kes(0, 0, W, H),
  });
})()`;
try {
  let hedefler;
  for (let i = 0; i < 50; i++) { try { hedefler = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await bekle(200); } }
  ws = new WebSocket(hedefler.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { const b = bekleyen.get(m.id); bekleyen.delete(m.id); m.error ? b.rej(new Error(m.error.message)) : b.res(m.result); } };
  await cagir("Runtime.enable");
  const r = await cagir("Runtime.evaluate", { expression: kod, awaitPromise: true, returnByValue: true });
  const v = JSON.parse(r.result.value);
  fs.mkdirSync(klasor, { recursive: true });
  for (const [ad, dosya] of [["yazi", `${onek}-yazi.png`], ["o", `${onek}-o.png`], ["bant", `${onek}-bant.png`], ["tam", `${onek}-tam.png`]]) {
    fs.writeFileSync(path.join(klasor, dosya), Buffer.from(v[ad].split(",")[1], "base64")); delete v[ad];
  }
  console.log(JSON.stringify(v));
} finally { p.kill(); }
