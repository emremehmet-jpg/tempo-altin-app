/* Tempo Lens — kamerayla fiyat çevirme.

   Kullanıcı PARİTEYİ seçer (EUR→TL, USD→TL, EUR→USD, USD→EUR, TL→EUR, TL→USD). Kamera
   gördüğü HER SAYIYI o paritenin kaynak parası sayar ve anlık Tempo satış
   kuruyla karşılığını sayının yanına rozet olarak yazar. Sayının yanında
   € / $ olup olmaması önemsizdir (Emre'nin kararı, 12 Eyl 2026).

   Okuma motoru: PaddleOCR (PP-OCRv4) + ONNX Runtime, tarayıcıda çalışır;
   görüntü hiçbir yere gönderilmez. Tesseract'tan buna geçildi çünkü
   Tesseract kareli defter/spiral/el yazısında çöp üretiyordu; Paddle aynı
   görselde 32/44/55'i %100 güvenle ve sıfır çöple okudu (12 Eyl ölçümü).

   Akış: kamera açık → sürekli: kare al → oku → sayıları bul → çevir →
   rozet. Deklanşör görüntüyü dondurup ayrıntılı liste çıkarır.
   Kurlar app.js'den (window.TempoApp) gelir; ayrı istek atılmaz. */

(() => {
  "use strict";
  const T = window.TempoApp;
  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];

  const VENDOR = "/lens/vendor";
  // Sunucu /lens/vendor'ı "immutable" (1 yıl) önbellekletiyor. paddle-ocr.js her
  // yeniden derlendiğinde bu sayı artırılır; yoksa telefon eski paketi kullanır.
  const PAKET_SURUM = 2;
  const EN_UZUN_KENAR = 1600; // dondurulmuş kare — ayrıntı için büyük
  const CANLI_KENAR = 1000;   // canlı kare — hız/doğruluk dengesi (Paddle'ın önerdiği ~960)
  const EN_AZ_GUVEN = 70;     // Paddle güveni (0–100); çöp genelde <50

  const durum = {
    kaynak: "EUR", hedef: "TRY",   // seçili parite
    motor: null, motorSoz: null,   // PaddleOCR
    akis: null,                    // MediaStream
    bulunan: [], resim: { w: 0, h: 0 }, tariyor: false,   // dondurulmuş kare
    canli: false, canliBulunan: [],                        // canlı döngü
  };

  // ---------- Öğeler ----------
  const giris = $("#lens-giris"), sonuc = $("#lens-sonuc");
  const acBtn = $("#lens-ac"), galeriBtn = $("#lens-galeri"), tekrarBtn = $("#lens-tekrar");
  const dosya = $("#lens-dosya"), dosyaKamera = $("#lens-dosya-kamera");
  const not = $("#lens-not");
  const kamera = $("#kamera"), video = $("#kamera-video"), gorunum = $("#kamera-gorunum");
  const kameraEtiketler = $("#kamera-etiketler"), kameraDurum = $("#kamera-durum");
  const kameraParite = $("#kamera-parite"), kameraKurMetin = $("#kamera-kur-metin");
  const resim = $("#lens-resim"), etiketler = $("#lens-etiketler");
  const yukleniyor = $("#lens-yukleniyor"), cubuk = $("#lens-cubuk-ic"), yukleniyorMetin = $("#lens-yukleniyor-metin");
  const liste = $("#lens-liste"), bilgiBaslik = $("#lens-bilgi-baslik"), bilgiAlt = $("#lens-bilgi-alt");

  if (!window.isSecureContext) {
    // http://192.168… adresinde tarayıcı canlı kamerayı açmaz (güvenlik kuralı).
    not.textContent = "Bu adreste canlı kamera açılmaz. Güvenli (https) adres için Mac'teki pencerede yazan kurulum sayfasını bir kez açın; şimdilik \"Kamerayı Aç\" telefonun kamerasını açar, çektiğiniz fotoğraf okunur.";
  }

  // ---------- Parite (üç seçici grubu birbirine bağlı) ----------
  const PARA_AD = { TRY: "TL", USD: "USD", EUR: "EUR", GBP: "GBP" };
  function pariteYaz() {
    const p = `${durum.kaynak}-${durum.hedef}`;
    $$("[data-parite]").forEach((b) => b.setAttribute("aria-checked", b.dataset.parite === p));
    kurGostergesiYaz();
  }
  // Kamera ekranının ÜST BANDI (görüntünün dışı): hangi kurdan çevrildiği
  function kurGostergesiYaz() {
    kameraParite.textContent = `${PARA_AD[durum.kaynak]} → ${PARA_AD[durum.hedef]}`;
    const c = T.kurlar.length ? cevir(durum.kaynak, 1, durum.hedef) : null;
    kameraKurMetin.textContent = c ? c.kur + " · Tempo satış" : "kur alınıyor…";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-parite]");
    if (!b) return;
    [durum.kaynak, durum.hedef] = b.dataset.parite.split("-");
    pariteYaz();
    if (!sonuc.hidden) sonucCiz();            // yeniden OCR yapmadan
    if (durum.canli) {                        // önceki paritenin rozetleri kalmasın; bir sonraki tur yeniden kurar
      izlenen = []; durum.canliBulunan = []; kameraEtiketler.innerHTML = "";
      kameraDurum.textContent = "Sayı aranıyor…";
    }
  });
  pariteYaz();

  // ---------- OCR motoru (PaddleOCR) ----------
  function betikYukle(src) {
    return new Promise((cozul, reddet) => {
      if (window.PaddleOcr) return cozul();
      const s = document.createElement("script");
      s.src = src; s.onload = cozul; s.onerror = () => reddet(new Error("Okuma motoru yüklenemedi"));
      document.head.appendChild(s);
    });
  }
  function motorHazirla() {
    if (durum.motor) return Promise.resolve(durum.motor);
    if (durum.motorSoz) return durum.motorSoz;
    durum.motorSoz = (async () => {
      await betikYukle(`${VENDOR}/paddle/paddle-ocr.js?s=${PAKET_SURUM}`);
      const { Ocr, env } = window.PaddleOcr;
      env.wasm.wasmPaths = `${VENDOR}/ort/`;
      env.wasm.numThreads = 1; // çoklu iş parçacığı için COOP/COEP başlıkları gerekir; şimdilik tek
      const m = await Ocr.create({ models: {
        detectionPath: `${VENDOR}/paddle/det.onnx`,
        recognitionPath: `${VENDOR}/paddle/rec.onnx`,
        dictionaryPath: `${VENDOR}/paddle/keys.txt`,
      } });
      durum.motor = m;
      return m;
    })().catch((e) => { durum.motorSoz = null; throw e; });
    return durum.motorSoz;
  }
  // Lens sekmesi açılınca motoru arka planda ısıt
  document.addEventListener("ekran", (e) => { if (e.detail === "lens") motorHazirla().catch(() => {}); });

  // Tuvali oku → satırlar [{ metin, guven, kutu:{x0,y0,x1,y1} }] (tuval koordinatı).
  //
  // İki aşama ayrı çağrılır (paket bunun için yamalı, bkz. arac/paddle-derle.sh):
  //   1. algılama → metin kutuları,  2. kutular BÖLÜNÜR,  3. tanıma.
  // Neden: Paddle'ın algılayıcısı alt alta sıkışık yazılmış sayıları (44 / 55)
  // tek uzun kutuda birleştiriyor, tanıyıcı da o kutuyu "345" gibi okuyordu
  // (14 Eyl ölçümü; olasılık eşiği 0,3–0,7 arasında hiçbir şey değiştirmedi).
  // Kutu içindeki mürekkep satır satır sayılır; boş yatay şeritten bölünür.
  const girisTuval = document.createElement("canvas");
  async function oku(motor, tuval) {
    // Paddle girişi 32'nin katı olmalı; kütüphane de aynı şekilde büyütür. Burada
    // biz büyütüyoruz ki kutu koordinatları ile piksellerimiz aynı düzlemde olsun.
    const W = Math.ceil(tuval.width / 32) * 32, H = Math.ceil(tuval.height / 32) * 32;
    girisTuval.width = W; girisTuval.height = H;
    const g = girisTuval.getContext("2d", { willReadFrequently: true });
    g.drawImage(tuval, 0, 0, W, H);
    const blob = await new Promise((r) => girisTuval.toBlob(r, "image/jpeg", 0.9));
    const url = URL.createObjectURL(blob);
    try {
      const kutular = await motor.detection.run(url);
      const satirlar = await motor.recognition.run(kutulariBol(kutular, g, W, H));
      const ox = tuval.width / W, oy = tuval.height / H;
      return satirlar.map((s) => {
        const xs = s.box.map((p) => p[0] * ox), ys = s.box.map((p) => p[1] * oy);
        return { metin: String(s.text || "").trim(), guven: Math.round((s.mean || 0) * 100),
          kutu: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } };
      }).filter((s) => s.metin);
    } finally { URL.revokeObjectURL(url); }
  }

  // Bir algılama kutusunu yatay mürekkep profiline göre alt kutulara böler.
  // Tek parça çıkarsa kütüphanenin kendi (perspektif düzeltilmiş) kırpması kalır.
  function kutulariBol(kutular, g, W, H) {
    const { ImageRaw } = window.PaddleOcr;
    const sonuc = [];
    for (const k of kutular) {
      const xs = k.box.map((p) => p[0]), ys = k.box.map((p) => p[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H, Math.ceil(Math.max(...ys)));
      const w = x1 - x0, h = y1 - y0;
      if (w < 8 || h < 12) { sonuc.push(k); continue; }
      const { data } = g.getImageData(x0, y0, w, h);
      // Gri değerler; koyu-mürekkep/açık-kağıt mı, tersi mi? (p5, medyan, p95)
      const gri = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) gri[i] = (data[i * 4] * 3 + data[i * 4 + 1] * 6 + data[i * 4 + 2]) / 10;
      const sirali = Uint8Array.from(gri).sort();
      const p5 = sirali[Math.floor(sirali.length * 0.05)], p50 = sirali[sirali.length >> 1], p95 = sirali[Math.floor(sirali.length * 0.95)];
      const koyuMurekkep = p50 - p5 >= p95 - p50;
      const kontrast = koyuMurekkep ? p50 - p5 : p95 - p50;
      if (kontrast < 40) { sonuc.push(k); continue; }          // ayırt edilecek mürekkep yok
      const esik = koyuMurekkep ? p5 + kontrast * 0.5 : p95 - kontrast * 0.5;
      const murekkep = (i) => (koyuMurekkep ? gri[i] < esik : gri[i] > esik);
      // Satır profili: her satırdaki mürekkepli piksel sayısı
      const satir = new Uint16Array(h);
      for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (murekkep(y * w + x)) n++; satir[y] = n; }
      const tavan = Math.max(...satir);
      const dolu = (y) => satir[y] > Math.max(1, tavan * 0.06);
      // Dolu satır koşuları → parçalar
      const parcalar = [];
      for (let y = 0; y < h; y++) {
        if (!dolu(y)) continue;
        let yb = y; while (yb + 1 < h && dolu(yb + 1)) yb++;
        parcalar.push({ ya: y, yb }); y = yb;
      }
      const enBoy = Math.max(0, ...parcalar.map((p) => p.yb - p.ya + 1));
      // Küçük parçalar (noktalar, virgül, çizgi) komşusuna katılır ya da atılır
      const asil = parcalar.filter((p) => p.yb - p.ya + 1 >= Math.max(6, enBoy * 0.3));
      if (asil.length < 2) { sonuc.push(k); continue; }
      for (const p of asil) {
        for (const q of parcalar) if (q !== p && (Math.abs(q.ya - p.yb) <= 3 || Math.abs(p.ya - q.yb) <= 3)) { p.ya = Math.min(p.ya, q.ya); p.yb = Math.max(p.yb, q.yb); }
      }
      for (const p of asil) {
        // Parçanın yatay sınırı: o satırlardaki mürekkepli sütunlar
        let xa = w, xb = -1;
        for (let y = p.ya; y <= p.yb; y++) for (let x = 0; x < w; x++) if (murekkep(y * w + x)) { if (x < xa) xa = x; if (x > xb) xb = x; }
        if (xb < xa) continue;
        const pay = Math.round((p.yb - p.ya) * 0.25) + 3;
        const kx0 = Math.max(0, x0 + xa - pay), kx1 = Math.min(W, x0 + xb + 1 + pay);
        const ky0 = Math.max(0, y0 + p.ya - pay), ky1 = Math.min(H, y0 + p.yb + 1 + pay);
        const kd = g.getImageData(kx0, ky0, kx1 - kx0, ky1 - ky0);
        sonuc.push({ image: new ImageRaw({ data: kd.data, width: kd.width, height: kd.height }),
          box: [[kx0, ky0], [kx1, ky0], [kx1, ky1], [kx0, ky1]] });
      }
    }
    return sonuc;
  }

  // ---------- Kamera ----------
  async function kamerayiAc() {
    if (!navigator.mediaDevices?.getUserMedia) { dosyaKamera.click(); return; }
    try {
      durum.akis = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch {
      dosyaKamera.click(); // izin verilmedi / kamera yok → telefonun kamera uygulaması
      return;
    }
    video.srcObject = durum.akis;
    kamera.hidden = false;
    try { await video.play(); } catch {}
    const iz = durum.akis.getVideoTracks()[0];
    const yetenek = iz.getCapabilities ? iz.getCapabilities() : {};
    $("#kamera-flas").hidden = !yetenek.torch;
    // Açılışta iPhone bazen yakınlaştırılmış başlıyor; destekliyorsa 1x'e çek
    if (yetenek.zoom) { try { await iz.applyConstraints({ advanced: [{ zoom: 1 }] }); } catch {} }
    pariteYaz();
    canliBaslat();
  }
  function kamerayiKapat() {
    durum.canli = false;
    if (durum.akis) durum.akis.getTracks().forEach((t) => t.stop());
    durum.akis = null;
    video.srcObject = null;
    kamera.hidden = true;
    kameraEtiketler.innerHTML = "";
    durum.canliBulunan = [];
    izlenen = [];
  }
  let flasAcik = false;
  $("#kamera-flas").addEventListener("click", async () => {
    const iz = durum.akis?.getVideoTracks()[0];
    if (!iz) return;
    flasAcik = !flasAcik;
    try { await iz.applyConstraints({ advanced: [{ torch: flasAcik }] }); } catch {}
  });
  $("#kamera-kapat").addEventListener("click", kamerayiKapat);
  $("#kamera-galeri").addEventListener("click", () => { kamerayiKapat(); dosya.click(); });
  $("#kamera-yardim").addEventListener("click", () => {
    const p = $("#kamera-ipucu");
    p.textContent = p.dataset.uzun ? "Sayıları çerçeveye alın; karşılıkları kendiliğinden belirir"
      : "Telefonu sabit tutun, yazı aydınlık olsun. Gördüğü her sayıyı seçili paritenin kaynak parası sayar. Parlama varsa açıyı değiştirin.";
    p.dataset.uzun = p.dataset.uzun ? "" : "1";
  });
  // Deklanşör: görüntüyü dondur, tam kareyi ayrıntılı oku, liste çıkar
  $("#kamera-cek").addEventListener("click", () => {
    if (!video.videoWidth) return;
    durum.canli = false;
    const c = document.createElement("canvas");
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    kamerayiKapat();
    tara(c);
  });

  acBtn.addEventListener("click", kamerayiAc);
  galeriBtn.addEventListener("click", () => dosya.click());
  tekrarBtn.addEventListener("click", () => { sonuc.hidden = true; giris.hidden = false; kamerayiAc(); });
  for (const inp of [dosya, dosyaKamera]) {
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      inp.value = "";
      if (!f) return;
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); tara(im); };
      im.onerror = () => { URL.revokeObjectURL(url); hataGoster("Fotoğraf açılamadı."); };
      im.src = url;
    });
  }

  // ---------- Canlı tarama ----------
  // Kamera açıkken sürekli: kareyi al → oku → rozetleri yerleştir. Deklanşör
  // gerekmez. Her tur telefonda 1–3 sn; rozetler bir sonraki tura kadar kalır.
  const canliTuval = document.createElement("canvas");
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  const SABITLENME_MS = 2500;   // kamera açıldıktan sonra ilk okumaya kadar bekleme
  const HAREKET_ESIK = 9;       // 24×24 küçük karede ortalama gri farkı (0–255); üstü "hareket var"
  const kucukTuval = document.createElement("canvas"); kucukTuval.width = kucukTuval.height = 24;
  let oncekiKucuk = null;
  function hareketVar(tuval) {
    const g = kucukTuval.getContext("2d", { willReadFrequently: true });
    g.drawImage(tuval, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data, gri = new Float32Array(576);
    for (let i = 0; i < 576; i++) gri[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
    let fark = 0;
    if (oncekiKucuk) { for (let i = 0; i < 576; i++) fark += Math.abs(gri[i] - oncekiKucuk[i]); fark /= 576; }
    const ilk = !oncekiKucuk;
    oncekiKucuk = gri;
    return ilk ? false : fark > HAREKET_ESIK;
  }

  function kareAl() {
    const W = gorunum.clientWidth, H = gorunum.clientHeight;
    const vw = video.videoWidth, vh = video.videoHeight;
    const olcek = Math.max(W / vw, H / vh);            // video object-fit: cover
    const ox = (W - vw * olcek) / 2, oy = (H - vh * olcek) / 2;
    // Yatayda kameranın TÜM karesi (ekranda görünenden geniştir; kenardaki
    // sayılar kesilmeden okunur), dikeyde bantların dışında kalan her yer
    const sy = H * 0.04, sh = H * 0.92;
    const vx = 0, vy = Math.max(0, (sy - oy) / olcek);
    const vw2 = vw, vh2 = Math.min(vh - vy, sh / olcek);
    const cs = Math.min(1, CANLI_KENAR / Math.max(vw2, vh2));
    canliTuval.width = Math.round(vw2 * cs); canliTuval.height = Math.round(vh2 * cs);
    canliTuval.getContext("2d").drawImage(video, vx, vy, vw2, vh2, 0, 0, canliTuval.width, canliTuval.height);
    // tuval koordinatı → ekran koordinatı
    const ekrana = (k) => ({
      x0: ox + (vx + k.x0 / cs) * olcek, y0: oy + (vy + k.y0 / cs) * olcek,
      x1: ox + (vx + k.x1 / cs) * olcek, y1: oy + (vy + k.y1 / cs) * olcek,
    });
    return { tuval: canliTuval, ekrana };
  }

  async function canliBaslat() {
    if (durum.canli) return;
    durum.canli = true;
    kameraDurum.textContent = durum.motor ? "Kamera netleşiyor… telefonu sabit tutun" : "Okuma motoru yükleniyor… (ilk seferde ~40 MB)";
    let motor;
    // Kamera ilk saniyelerde odak/pozlama/yakınlaştırma değiştirir; o karelerde
    // okumak yanlış konumda rozet bırakıyordu. Motor hazırlanırken en az 2,5 sn beklenir.
    try { [motor] = await Promise.all([motorHazirla(), bekle(SABITLENME_MS)]); } catch { kameraDurum.textContent = "Okuma motoru yüklenemedi"; return; }
    kameraDurum.textContent = "Sayı aranıyor…";
    kurGostergesiYaz();
    izlenen = []; oncekiKucuk = null;
    let hareketBasi = 0;
    while (durum.canli && durum.akis) {
      if (!video.videoWidth || document.hidden) { await bekle(200); continue; }
      const { tuval, ekrana } = kareAl();
      // Telefon hareket ediyorsa okuma yapılmaz (rozetler yanlış yere düşer,
      // aynı sayı iki kez izlenir). Hareket uzarsa eski rozetler de kaldırılır.
      if (hareketVar(tuval)) {
        hareketBasi = hareketBasi || Date.now();
        kameraDurum.textContent = "Telefonu sabit tutun…";
        if (Date.now() - hareketBasi > 1200 && izlenen.length) { izlenen = []; durum.canliBulunan = []; kameraEtiketler.innerHTML = ""; }
        await bekle(150); continue;
      }
      hareketBasi = 0;
      let satirlar;
      try { satirlar = await oku(motor, tuval); } catch { break; }
      if (!durum.canli) break;
      const bulunan = sayilariBul(satirlar, tuval.height, tuval.width).map((b) => ({ ...b, kutu: ekrana(b.kutu) }));
      izlemeGuncelle(bulunan);
      durum.canliBulunan = izlenen;
      canliCiz(izlenen);
      kurGostergesiYaz(); // kur 20 sn'de bir tazeleniyor; gösterge geride kalmasın
      kameraDurum.textContent = izlenen.length ? `${izlenen.length} sayı · canlı` : "Sayı aranıyor…";
      await bekle(60);
    }
  }

  // ---------- Kareler arası izleme ----------
  // Bir kare bir sayıyı kaçırabilir ya da farklı okuyabilir. Her sayıyı
  // konumuyla izleriz: örtüşen okumalar güven puanıyla oylanır, en çok puanı
  // toplayan metin gösterilir; birkaç kare görünmeyen silinir.
  // "Uzun okuma hemen kazanır" kuralı KALDIRILDI (14 Eyl): tek karede
  // "44"ün "444" okunması bir daha düzelmiyordu. Tek istisna: eski metnin
  // kuruşla uzatılmışı ("18" → "18,50") — o eksik okumanın tamamlanmasıdır.
  const KAYIP_TUR = 2;
  let izlenen = [];
  // Aynı metin, kutular örtüşmese de yakınsa (kamera kaydı): aynı sayı sayılır
  function yakin(a, b) {
    const h = Math.max(a.y1 - a.y0, b.y1 - b.y0);
    return Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2) < h * 2 && Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) < h * 1.5;
  }
  function ortusme(a, b) {
    const x = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const y = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const kesisim = x * y;
    const kucuk = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
    return kucuk ? kesisim / kucuk : 0;
  }
  function izlemeGuncelle(yeni) {
    for (const t of izlenen) t.eslesti = false;
    for (const y of yeni) {
      let en = null, enO = 0;
      for (const t of izlenen) { if (t.eslesti) continue; const o = ortusme(t.kutu, y.kutu); if (o > enO) { enO = o; en = t; } }
      if (!(en && enO >= 0.4)) { en = izlenen.find((t) => !t.eslesti && t.metin === y.metin && yakin(t.kutu, y.kutu)) || null; enO = en ? 1 : 0; }
      if (en && enO >= 0.4) {
        en.eslesti = true; en.kayip = 0; en.kutu = y.kutu;
        const o = en.oylar[y.metin] || (en.oylar[y.metin] = { puan: 0, tutar: y.tutar });
        o.puan += y.guven;
        const eskiHane = en.metin.replace(/\D/g, ""), yeniHane = y.metin.replace(/\D/g, "");
        const kurusTamamlama = yeniHane.length > eskiHane.length && y.metin.startsWith(en.metin) && /^[.,]\d{1,2}$/.test(y.metin.slice(en.metin.length));
        if (kurusTamamlama) { en.metin = y.metin; en.tutar = y.tutar; continue; }
        const [kazanan, kv] = Object.entries(en.oylar).sort((p, q) => q[1].puan - p[1].puan)[0];
        if (kv.puan > (en.oylar[en.metin]?.puan || 0)) { en.metin = kazanan; en.tutar = kv.tutar; } // berabere → mevcut kalır
      } else izlenen.push({ ...y, kayip: 0, eslesti: true, oylar: { [y.metin]: { puan: y.guven, tutar: y.tutar } } });
    }
    for (const t of izlenen) if (!t.eslesti) t.kayip++;
    izlenen = izlenen.filter((t) => t.kayip < KAYIP_TUR);
  }

  // Rozetler izlenen sayıya bağlı öğelerdir: her turda yeniden yaratılmaz, yeri
  // güncellenir (yoksa her turda belirme animasyonu baştan oynar, göz kırpar).
  function canliCiz(bulunan) {
    const W = gorunum.clientWidth;
    if (!T.kurlar.length) { kameraEtiketler.innerHTML = ""; kameraDurum.textContent = "Kur alınamadı"; return; }
    const kalan = new Set();
    for (const b of bulunan) {
      if (b.kutu.x1 < 0 || b.kutu.x0 > W) continue; // ekran dışında
      if (b.yilGibi && durum.kaynak !== "TRY") continue;
      const c = cevir(durum.kaynak, b.tutar, durum.hedef);
      if (!c) continue;
      if (!b.el) {
        b.el = { rozet: document.createElement("span"), isaret: document.createElement("span") };
        b.el.isaret.className = "lens-isaret";
        kameraEtiketler.append(b.el.isaret, b.el.rozet);
      }
      const { rozet, isaret } = b.el;
      const sagda = b.kutu.x1 < W * 0.7;
      rozet.className = "lens-etiket" + (sagda ? "" : " sol");
      rozet.textContent = tutarYaz(c.deger, durum.hedef);   // yalnız karşılık; kur üst bantta
      rozet.style.left = (sagda ? b.kutu.x1 + 8 : b.kutu.x0 - 8) + "px";
      rozet.style.top = (b.kutu.y0 + b.kutu.y1) / 2 + "px";
      isaret.style.left = (b.kutu.x0 - 4) + "px"; isaret.style.top = (b.kutu.y0 - 4) + "px";
      isaret.style.width = (b.kutu.x1 - b.kutu.x0 + 8) + "px"; isaret.style.height = (b.kutu.y1 - b.kutu.y0 + 8) + "px";
      kalan.add(rozet); kalan.add(isaret);
    }
    for (const e of [...kameraEtiketler.children]) if (!kalan.has(e)) e.remove();
  }

  // ---------- Dondurulmuş kare ----------
  async function tara(kaynak) {
    if (durum.tariyor) return;
    durum.tariyor = true;

    const kw = kaynak.videoWidth || kaynak.naturalWidth || kaynak.width;
    const kh = kaynak.videoHeight || kaynak.naturalHeight || kaynak.height;
    const olcek = Math.min(1, EN_UZUN_KENAR / Math.max(kw, kh));
    const c = document.createElement("canvas");
    c.width = Math.round(kw * olcek); c.height = Math.round(kh * olcek);
    c.getContext("2d").drawImage(kaynak, 0, 0, c.width, c.height);
    durum.resim = { w: c.width, h: c.height };

    resim.src = c.toDataURL("image/jpeg", 0.85);
    etiketler.innerHTML = ""; liste.innerHTML = ""; durum.bulunan = [];
    giris.hidden = true; sonuc.hidden = false;
    yukleniyor.hidden = false; cubuk.style.width = "30%";
    yukleniyorMetin.textContent = durum.motor ? "Sayılar okunuyor…" : "Okuma motoru yükleniyor… (ilk seferde ~40 MB)";
    window.scrollTo({ top: 0 });

    try {
      const motor = await motorHazirla();
      yukleniyorMetin.textContent = "Sayılar okunuyor…"; cubuk.style.width = "70%";
      const satirlar = await oku(motor, c);
      durum.bulunan = sayilariBul(satirlar, c.height, c.width);
      yukleniyor.hidden = true;
      sonucCiz();
    } catch (e) {
      yukleniyor.hidden = true;
      hataGoster("Okuma yapılamadı: " + (e && e.message ? e.message : "bilinmeyen hata"));
    } finally {
      durum.tariyor = false;
    }
  }

  function hataGoster(mesaj) {
    giris.hidden = true; sonuc.hidden = false; yukleniyor.hidden = true;
    liste.innerHTML = `<li class="bos">${mesaj}</li>`;
  }

  // ---------- Sayı bulma ----------
  // "18" "18,50" "18.50" "1.203,50" "1,203.50" "18.-" → sayı; olmazsa null
  function tutarCoz(m) {
    let t = m.replace(/[\s'’]/g, "").replace(/\.-$/, "").replace(/[.,]+$/, "");
    if (!/^\d[\d.,]*$/.test(t)) return null;
    const sonV = t.lastIndexOf(","), sonN = t.lastIndexOf(".");
    let govde, kusurat = "";
    if (sonV >= 0 && sonN >= 0) {
      const ayrac = Math.max(sonV, sonN);
      govde = t.slice(0, ayrac); kusurat = t.slice(ayrac + 1);
    } else if (sonV >= 0 || sonN >= 0) {
      const ayrac = Math.max(sonV, sonN);
      const kalan = t.slice(ayrac + 1);
      // 3 hane → binlik ayracı (1.203); 1–2 hane → kuruş (18,5 / 18,50)
      if (kalan.length === 3 && t.indexOf(",") === sonV && t.indexOf(".") === sonN) { govde = t; kusurat = ""; }
      else { govde = t.slice(0, ayrac); kusurat = kalan; }
    } else govde = t;
    govde = govde.replace(/[.,]/g, "");
    if (kusurat.length > 2 || govde.length > 7) return null;
    const n = Number(govde + (kusurat ? "." + kusurat : ""));
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
    return n;
  }

  // Satır metninde sayı adayları: rakamla başlayıp rakam/ayraçla süren parçalar.
  // Elenenler: yüzdeler (%20, 20%), saatler (12:30), yıl gibi duran 4 haneliler
  // (1900–2099), düşük güvenli satırlar, çok alçak (gürültü) satırlar.
  const SAYI_RX = /(?<![\d.,:%])(\d[\d.,'’]*\d|\d)(?![\d.,:]|\s*%)/g;
  // İletişim/adres satırları (antet, kartvizit): e-posta, site, telefon (0'la
  // başlayan 3+ hane), "Tel", "No:". Buradaki sayılar fiyat değildir.
  const ILETISIM_RX = /@|www\.|\.com|\.net|\.org|http|\btel(?![a-z])|telefon|\bgsm\b|\bfax\b|\bno[:.]|(?<![\d,.])0\d{2,}/i;
  function sayilariBul(satirlar, tuvalYuk = 0, tuvalGen = Infinity) {
    const bulunan = [];
    const enAzYuk = tuvalYuk * 0.012;
    for (const s of satirlar) {
      if (s.guven < EN_AZ_GUVEN) continue;
      if (s.kutu.y1 - s.kutu.y0 < enAzYuk) continue;
      // Kare kenarına dayanmış kutu: sayı kesik olabilir ("1" gibi okunur), atla
      if (s.kutu.x0 <= 1 || s.kutu.y0 <= 1 || s.kutu.x1 >= tuvalGen - 1 || s.kutu.y1 >= tuvalYuk - 1) continue;
      const metin = s.metin;
      if (ILETISIM_RX.test(metin)) continue;
      const adaylar = [];
      for (const e of metin.matchAll(SAYI_RX)) {
        const ham = e[1], bas = e.index;
        if (metin[bas - 1] === "%") continue;               // %20
        if (/^0\d/.test(ham)) continue;                      // 0216 (telefon, kod); 0,50 serbest
        const tutar = tutarCoz(ham);
        if (tutar === null) continue;
        // Yıl gibi duran 4 haneli (2024): kaynak TL değilse çizimde atlanır;
        // TL'de 1900–2099 arası fiyat olağan olduğu için gösterilir.
        const yilGibi = /^\d{4}$/.test(ham) && tutar >= 1900 && tutar <= 2099;
        // Sayının satır içindeki yeri: karakter oranıyla yaklaşık kutu
        const gen = s.kutu.x1 - s.kutu.x0, n = Math.max(metin.length, 1);
        const kutu = { x0: s.kutu.x0 + (gen * bas) / n, x1: s.kutu.x0 + (gen * (bas + ham.length)) / n, y0: s.kutu.y0, y1: s.kutu.y1 };
        adaylar.push({ tutar, metin: ham, kutu, yilGibi });
      }
      if (!adaylar.length) continue;
      // Satırın geri kalanı ürün adı olur ("Carbonara 18" → "Carbonara")
      const etiket = metin.replace(SAYI_RX, " ").replace(/[€$£₺%]|EUR|USD|GBP|TL/gi, " ").replace(/[.·•…_-]{2,}/g, " ").replace(/\s+/g, " ").trim().slice(0, 28);
      for (const a of adaylar) bulunan.push({ ...a, etiket, guven: s.guven });
    }
    return bulunan;
  }

  // ---------- Çevirme ----------
  function kurBul(k, q) { return T.kurlar.find((x) => x.code === k && x.quoteCode === q); }
  // Tempo SATIŞ kuru: müşteri gözüyle "bu fiyatı ödemek için kaç TL gerekir"
  function cevir(kaynak, tutar, hedef) {
    if (kaynak === hedef) return null;
    const d = kurBul(kaynak, hedef); if (d) return { deger: tutar * d.sellRate, kur: `1 ${kaynak} = ${T.fmt4.format(d.sellRate)} ${PARA_AD[hedef] || hedef}` };
    const t = kurBul(hedef, kaynak); if (t) return { deger: tutar / t.sellRate, kur: `1 ${hedef} = ${T.fmt4.format(t.sellRate)} ${PARA_AD[kaynak] || kaynak}` };
    const a = kurBul(kaynak, "TRY"), b = kurBul(hedef, "TRY");
    if (a && b) return { deger: (tutar * a.sellRate) / b.sellRate, kur: `${kaynak}/TRY ve ${hedef}/TRY üzerinden` };
    return null;
  }
  function tutarYaz(n, para) {
    const s = para === "TRY" && n >= 100 ? new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n) : T.fmt2.format(n);
    return `${s} ${PARA_AD[para] || para}`;
  }

  // ---------- Dondurulmuş sonucu çiz ----------
  function sonucCiz() {
    const { w, h } = durum.resim;
    etiketler.innerHTML = ""; liste.innerHTML = "";
    if (!durum.bulunan.length) {
      liste.innerHTML = `<li class="bos">Fotoğrafta okunabilir sayı bulunamadı. Yazı net ve aydınlık görünsün; yeniden deneyin.</li>`;
      bilgiBaslik.textContent = "Sayı bulunamadı"; bilgiAlt.textContent = "";
      return;
    }
    if (!T.kurlar.length) {
      liste.innerHTML = `<li class="bos">Kurlar henüz alınamadı; bağlantıyı kontrol edip sağ üstten yenileyin.</li>`;
      return;
    }
    let kurMetin = "";
    for (const b of durum.bulunan) {
      if (b.yilGibi && durum.kaynak !== "TRY") continue;
      const c = cevir(durum.kaynak, b.tutar, durum.hedef);
      if (!c) continue;
      kurMetin = c.kur;
      const kaynakMetin = `${T.fmt2.format(b.tutar).replace(/,00$/, "")} ${PARA_AD[durum.kaynak]}`;
      const sagda = b.kutu.x1 / w < 0.72;
      const rozet = document.createElement("span");
      rozet.className = "lens-etiket" + (sagda ? "" : " sol");
      rozet.textContent = tutarYaz(c.deger, durum.hedef);
      rozet.style.left = ((sagda ? b.kutu.x1 + 6 : b.kutu.x0 - 6) / w * 100) + "%";
      rozet.style.top = (((b.kutu.y0 + b.kutu.y1) / 2) / h * 100) + "%";
      const isaret = document.createElement("span");
      isaret.className = "lens-isaret";
      isaret.style.left = (b.kutu.x0 / w * 100 - 0.5) + "%"; isaret.style.top = (b.kutu.y0 / h * 100 - 0.5) + "%";
      isaret.style.width = ((b.kutu.x1 - b.kutu.x0) / w * 100 + 1) + "%"; isaret.style.height = ((b.kutu.y1 - b.kutu.y0) / h * 100 + 1) + "%";
      etiketler.append(isaret, rozet);
      const li = document.createElement("li");
      li.innerHTML = `<span>${b.etiket ? b.etiket + " · " : ""}${kaynakMetin}</span><b>${tutarYaz(c.deger, durum.hedef)}</b>`;
      liste.appendChild(li);
    }
    bilgiBaslik.textContent = `${PARA_AD[durum.kaynak]} → ${PARA_AD[durum.hedef]} · Tempo satış kuru`;
    const saat = T.sonBasari ? T.fmtSaat.format(T.sonBasari) : "—";
    bilgiAlt.textContent = `${kurMetin} · Güncellendi ${saat}`;
  }

  // Test sayfaları için (public/_test): motor + okuma + sayı bulma dışarıdan çağrılabilir
  window.TempoLens = { motorHazirla, oku, sayilariBul };

  // Arka plana atılınca kamerayı bırak (pil ve gizlilik)
  document.addEventListener("visibilitychange", () => { if (document.hidden && durum.akis) kamerayiKapat(); });
})();
