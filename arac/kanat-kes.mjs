// Kapı logosunu (şeffaf PNG) iki kanada ayıran clip-path çokgenlerini üretir.
// Düz çizgi yetmiyor: boşluklar zikzaklı (basamaklı uçlar). Her yarıçapta boşluğun
// ORTA açısı bulunur, kesim bu orta çizgiyi izler; böylece hiçbir kanadın ucu
// öbür tarafa taşmaz. Çıktı: CSS polygon() (yüzde, kare kutu).
// Kullanım: node arac/kanat-kes.mjs public/kapi/logo.png
import { spawn } from "node:child_process";
import fs from "node:fs";
const [,, girdi] = process.argv;
const B = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const port = 9337;
const p = spawn(B, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/tempo-brave-kanat`, "about:blank"], { stdio: "ignore" });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const bekleyen = new Map();
const cagir = (m, params = {}) => new Promise((res, rej) => { const k = ++id; bekleyen.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method: m, params })); });
const b64 = fs.readFileSync(girdi).toString("base64");
const kod = `
(async () => {
  const img = new Image(); img.src = "data:image/png;base64,${b64}"; await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const a = x.getImageData(0, 0, W, H).data;
  const dolu = (xx, yy) => a[((yy|0) * W + (xx|0)) * 4 + 3] > 100;
  // merkez ve yarıçaplar
  let x0=W,y0=H,x1=0,y1=0; for (let yy=0;yy<H;yy++) for (let xx=0;xx<W;xx++) if (dolu(xx,yy)) { if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; }
  const cx=(x0+x1)/2, cy=(y0+y1)/2, R=Math.max(x1-x0,y1-y0)/2;
  let rIc=0; for (let r=0;r<R;r++) if (dolu(cx+r, cy)) { rIc=r; break; }
  // her yarıçapta iki boşluğun orta açısı (0,25° adım)
  const ortalar = (rr, aMerkez) => {
    const bos = []; for (let d=-45; d<=45; d+=0.25) { const t=(aMerkez+d)*Math.PI/180; if (!dolu(cx+rr*Math.cos(t), cy+rr*Math.sin(t))) bos.push(aMerkez+d); }
    if (!bos.length) return null;
    // merkeze en yakın kesintisiz boş kümeyi al
    const kumeler=[]; for (const b of bos) { const son=kumeler[kumeler.length-1]; if (son && b-son[son.length-1] <= 0.3) son.push(b); else kumeler.push([b]); }
    const k = kumeler.sort((p,q)=>Math.abs((p[0]+p[p.length-1])/2-aMerkez)-Math.abs((q[0]+q[q.length-1])/2-aMerkez))[0];
    return (k[0]+k[k.length-1])/2;
  };
  const yol = (aMerkez) => { const n=[]; for (let rr=rIc-6; rr<=R+8; rr+=3) { const o=ortalar(rr,aMerkez); if (o!==null) n.push([rr,o]); } return n; };
  return JSON.stringify({ W, cx, cy, R, rIc, g1: yol(148.5), g2: yol(328.5) });
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
  const P = (rr, a) => { const t = a * Math.PI / 180; return `${((v.cx + rr * Math.cos(t)) / v.W * 100).toFixed(1)}% ${((v.cy + rr * Math.sin(t)) / v.W * 100).toFixed(1)}%`; };
  const UZAK = v.W * 2;
  // g1 alt-sol boşluk (≈148°), g2 üst-sağ boşluk (≈328°). Zincir: g1 dıştan içe → delik merkezi → g2 içten dışa.
  const zincir = [P(UZAK, v.g1[v.g1.length - 1][1]), ...[...v.g1].reverse().map(([rr, a]) => P(rr, a)), `50% 50%`, ...v.g2.map(([rr, a]) => P(rr, a)), P(UZAK, v.g2[v.g2.length - 1][1])];
  // kapanış: sol-üst kanat için 328° → 148° yönünde (270, 180 üzerinden); sağ-alt için 328° → 148° (30, 90 üzerinden)
  const solUst = [...zincir, P(UZAK, 270), P(UZAK, 210)].join(", ");
  const sagAlt = [...zincir, P(UZAK, 30), P(UZAK, 90)].join(", ");
  console.log(JSON.stringify({ cx: v.cx, cy: v.cy, R: v.R, rIc: v.rIc, g1: v.g1.length, g2: v.g2.length }));
  console.log("SOLUST=" + solUst);
  console.log("SAGALT=" + sagAlt);
} finally { p.kill(); }
