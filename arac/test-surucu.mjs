// Brave'i CDP ile sürer: sayfayı açar, gerçek zamanda bekler, günlük + ekran görüntüsü alır.
// Kullanım: node surucu.mjs <url> <bekleme_sn> <cikti.png> [y4m]
import { spawn } from "node:child_process";
import fs from "node:fs";
const [,, url, sn = "60", cikti = "ss.png", y4m] = process.argv;
const B = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const port = 9333;
const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, "--window-size=800,900",
  "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--user-data-dir=/tmp/tempo-brave-profil`, "about:blank"];
if (y4m) args.push(`--use-file-for-fake-video-capture=${y4m}`);
const p = spawn(B, args, { stdio: "ignore" });
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const bekleyen = new Map();
const cagir = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = ++id; bekleyen.set(m, { res, rej });
  ws.send(JSON.stringify({ id: m, method, params, sessionId }));
});
try {
  let hedefler;
  for (let i = 0; i < 50; i++) { try { hedefler = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await bekle(200); } }
  const sayfa = hedefler.find((t) => t.type === "page");
  ws = new WebSocket(sayfa.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { const b = bekleyen.get(m.id); bekleyen.delete(m.id); m.error ? b.rej(new Error(m.error.message)) : b.res(m.result); } };
  await cagir("Page.enable"); await cagir("Runtime.enable");
  await cagir("Page.navigate", { url });
  await bekle(Number(sn) * 1000);
  const log = await cagir("Runtime.evaluate", { expression: "document.getElementById('log')?.textContent || ''", returnByValue: true });
  console.log(log.result.value);
  const ss = await cagir("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(cikti, Buffer.from(ss.data, "base64"));
  console.log("görüntü:", cikti);
} finally { p.kill(); }
