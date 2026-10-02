// Logo görselinin açık zeminini atar (taşkın doldurma: köşelerden ve ortadaki delikten
// başlar, yumuşak degrade geçişleri takip eder, logonun sert kenarında durur).
// Çıktı: şeffaf PNG + ölçüler (merkez, dış yarıçap, boşluk açıları).
import { spawn } from "node:child_process";
import fs from "node:fs";
const [,, girdi, cikti] = process.argv;
const B = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const port = 9335;
const p = spawn(B, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/tempo-brave-logo`, "about:blank"], { stdio: "ignore" });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const bekleyen = new Map();
const cagir = (m, params = {}) => new Promise((res, rej) => { const k = ++id; bekleyen.set(k, { res, rej }); ws.send(JSON.stringify({ id: k, method: m, params })); });
const b64 = fs.readFileSync(girdi).toString("base64");
const kod = `
(async () => {
  const img = new Image(); img.src = "data:image/jpeg;base64,${b64}"; await img.decode();
  const W = img.width, H = img.height;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H), px = d.data;
  const gor = new Uint8Array(W * H);          // 1 = zemin
  const ESIK = 7;                              // komşuya göre en fazla fark (degrade yumuşak, kenar sert)
  const yigin = [];
  const ekle = (i) => { if (!gor[i]) { gor[i] = 1; yigin.push(i); } };
  // tohumlar: dört köşe + merkez (delik)
  for (const [sx, sy] of [[2,2],[W-3,2],[2,H-3],[W-3,H-3],[W>>1,H>>1]]) ekle(sy * W + sx);
  while (yigin.length) {
    const i = yigin.pop(); const r = px[i*4], g = px[i*4+1], b = px[i*4+2];
    const xx = i % W, yy = (i / W) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = xx + dx, ny = yy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (gor[j]) continue;
      const dr = Math.abs(px[j*4]-r), dg = Math.abs(px[j*4+1]-g), db = Math.abs(px[j*4+2]-b);
      // ayrıca yalnız açık ve renksiz pikseller zemin sayılır (lacivert/altına asla girmez)
      const lum = (px[j*4]+px[j*4+1]+px[j*4+2])/3, sat = Math.max(px[j*4],px[j*4+1],px[j*4+2]) - Math.min(px[j*4],px[j*4+1],px[j*4+2]);
      if (dr <= ESIK && dg <= ESIK && db <= ESIK && lum > 120 && sat < 40) ekle(j);
    }
  }
  // Kenar yumuşatma: zemine komşu logo pikselleri açıklığına göre yarı saydam
  const out = new Uint8ClampedArray(px);
  for (let i = 0; i < W * H; i++) {
    if (gor[i]) { out[i*4+3] = 0; continue; }
    const xx = i % W, yy = (i / W) | 0; let komsuZemin = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = xx+dx, ny = yy+dy; if (nx>=0&&ny>=0&&nx<W&&ny<H&&gor[ny*W+nx]) komsuZemin = true; }
    if (komsuZemin) { const lum = (px[i*4]+px[i*4+1]+px[i*4+2])/3; out[i*4+3] = Math.max(0, Math.min(255, Math.round((215 - lum) * 255 / 90))); }
  }
  // Ölçüler: logo sınır kutusu → merkez ve dış yarıçap; orta yarıçapta boşluk açıları
  let x0=W,y0=H,x1=0,y1=0; for (let i=0;i<W*H;i++){ if(out[i*4+3]>128){ const xx=i%W, yy=(i/W)|0; if(xx<x0)x0=xx; if(xx>x1)x1=xx; if(yy<y0)y0=yy; if(yy>y1)y1=yy; } }
  const cx=(x0+x1)/2, cy=(y0+y1)/2, R=Math.max(x1-x0,y1-y0)/2;
  // iç yarıçap: merkezden sağa doğru ilk dolu piksel
  let rIc=0; for (let r=0;r<R;r++){ const i=Math.round(cy)*W+Math.round(cx+r); if(out[i*4+3]>128){ rIc=r; break; } }
  const rm=(R+rIc)/2, bos=[];
  for (let a=0;a<360;a++){ const t=a*Math.PI/180; const i=Math.round(cy+rm*Math.sin(t))*W+Math.round(cx+rm*Math.cos(t)); if(out[i*4+3]<128) bos.push(a); }
  x.putImageData(new ImageData(out, W, H), 0, 0);
  const png = c.toDataURL("image/png");
  return JSON.stringify({ W, H, x0, y0, x1, y1, cx, cy, R, rIc, bos, zeminOran: gor.reduce((s,v)=>s+v,0)/(W*H), png });
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
  fs.writeFileSync(cikti, Buffer.from(v.png.split(",")[1], "base64"));
  delete v.png;
  // boşluk açılarını aralıklara indirge
  const aralik = []; for (const a of v.bos) { const son = aralik[aralik.length - 1]; if (son && a === son[1] + 1) son[1] = a; else aralik.push([a, a]); }
  v.bosAralik = aralik; delete v.bos;
  console.log(JSON.stringify(v));
} finally { p.kill(); }
