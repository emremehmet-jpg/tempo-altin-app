/* Tempo Altın — canlı fiyatlar, hesaplama, tema, açık/kapalı.
   Veri: tempoaltin.com/api/fiyatlar (server.mjs /api/altin/fiyatlar olarak aktarır)
     { updatedAt, quotes: [{ key, name, buy, sell, changePct }] }  — 20 kalem
   Gruplar (sitedeki sıra korunur):
     gram   HAS_ALTIN GRAM_ALTIN AYAR22 AYAR18 AYAR14
     ziynet CEYREK YARIM TAM ATA RESAT IKIBUCUK BESLI GREMSE
     diger  GUMUS PLATIN PALADYUM
   USD/EUR/GBP/CHF de geliyor ama Tempo Döviz'in işi; burada gösterilmez.
   Biçimleme yardımcıları app.js'den (window.TempoApp). */

(() => {
  "use strict";

  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];
  const T = window.TempoApp;

  const fmt2 = T.fmt2;
  const fmtGram = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fmtYuzde = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 6.831,56 → 6.831,<span class=kurus><span class=pip>56</span></span>  (sitede kuruş altın renkte)
  function fiyatHtml(n) {
    const s = fmt2.format(n);
    const i = s.lastIndexOf(",");
    return `${s.slice(0, i)},<span class="kurus"><span class="pip">${s.slice(i + 1)}</span></span>`;
  }

  const GRUP = {
    gram: ["HAS_ALTIN", "GRAM_ALTIN", "AYAR22", "AYAR18", "AYAR14"],
    ziynet: ["CEYREK", "YARIM", "TAM", "ATA", "RESAT", "IKIBUCUK", "BESLI", "GREMSE"],
    diger: ["GUMUS", "PLATIN", "PALADYUM"],
  };
  // Kısa etiket (yuvarlak rozet) ve birim: gram bazlılar "gr", ziynet "adet"
  const ROZET = {
    HAS_ALTIN: "HAS", GRAM_ALTIN: "GR", AYAR22: "22", AYAR18: "18", AYAR14: "14",
    CEYREK: "¼", YARIM: "½", TAM: "1", ATA: "ATA", RESAT: "RŞT", IKIBUCUK: "2½", BESLI: "5", GREMSE: "GRM",
    GUMUS: "AG", PLATIN: "PT", PALADYUM: "PD",
  };
  const BIRIM = (key) => (GRUP.ziynet.includes(key) ? "adet" : "gram");
  // Hesaplama ekranında sunulan ürünler (sık kullanılanlar önce)
  const HESAP_URUNLER = ["HAS_ALTIN", "GRAM_ALTIN", "AYAR22", "CEYREK", "YARIM", "TAM", "ATA", "RESAT", "GUMUS"];

  const durum = {
    fiyatlar: [],        // quotes
    guncelleme: null,    // Date (sitenin updatedAt)
    sonBasari: null,     // Date (bizim son başarılı çekiş)
    hata: false,
    grup: "gram",
    hesapUrun: "HAS_ALTIN",
    hesapYon: "tlden",   // "tlden" (TL → gram/adet, SATIŞ) | "altindan" (gram/adet → TL, ALIŞ)
  };
  const bul = (key) => durum.fiyatlar.find((q) => q.key === key);

  // ---------- Durum rozeti ----------
  const durumBtn = $("#altin-durum");
  const durumMetin = $("#altin-durum-metin");
  function durumYaz() {
    durumBtn.classList.remove("hata", "bekliyor");
    if (durum.hata && !durum.sonBasari) { durumBtn.classList.add("hata"); durumMetin.textContent = "Bağlantı yok"; }
    else if (durum.hata) { durumBtn.classList.add("bekliyor"); durumMetin.textContent = "Son: " + T.fmtSaat.format(durum.sonBasari); }
    else if (durum.sonBasari) { durumMetin.textContent = "Canlı · " + T.fmtSaat.format(durum.guncelleme || durum.sonBasari); }
    else { durumBtn.classList.add("bekliyor"); durumMetin.textContent = "Bağlanıyor…"; }
  }

  // ---------- Çekiş ----------
  let cekiliyor = false;
  async function fiyatlariCek() {
    if (cekiliyor) return;
    cekiliyor = true;
    try {
      const y = await fetch("/api/altin/fiyatlar", { cache: "no-store" });
      if (!y.ok) throw new Error("HTTP " + y.status);
      const v = await y.json();
      if (!Array.isArray(v.quotes)) throw new Error("Beklenmeyen yanıt");
      durum.fiyatlar = v.quotes;
      durum.guncelleme = v.updatedAt ? new Date(v.updatedAt) : null;
      durum.sonBasari = new Date();
      durum.hata = false;
      // magaza.js ürün fiyatı formülü (yedek) ve vitrindeki Has Altın için dinler
      document.dispatchEvent(new CustomEvent("altin-kotasyon", { detail: { kotasyon: v.quotes, guncelleme: durum.guncelleme } }));
      oneCiz();
      listeCiz();
      hesapla();
    } catch {
      durum.hata = true;
    } finally {
      cekiliyor = false;
      durumYaz();
    }
  }
  durumBtn.addEventListener("click", fiyatlariCek);

  // Site 60 sn'de bir güncelliyor; 30 sn'de bir sormak yeter. Yalnızca
  // uygulama öndeyken.
  let sayac = null;
  function sayacBaslat() { clearInterval(sayac); sayac = setInterval(fiyatlariCek, 30000); }
  function sayacDurdur() { clearInterval(sayac); sayac = null; }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) sayacDurdur(); else { fiyatlariCek(); sayacBaslat(); }
  });

  // ---------- Öne çıkan: Has Altın ----------
  function oneCiz() {
    const has = bul("HAS_ALTIN");
    if (!has) return;
    const d = has.changePct ?? 0;
    const sinif = d > 0.0001 ? "arti" : d < -0.0001 ? "eksi" : "sabit";
    $("#altin-one-fiyat").innerHTML = `${fiyatHtml(has.sell)}<small>₺</small>`;
    $("#altin-one-alt").innerHTML = `Alış <b>${fmt2.format(has.buy)} ₺</b> · <span class="degisim ${sinif}">${sinif === "arti" ? "▲" : sinif === "eksi" ? "▼" : "•"} %${fmtYuzde.format(Math.abs(d))}</span> · Son güncelleme <b>${durum.guncelleme ? T.fmtSaat.format(durum.guncelleme) : "—"}</b>`;
  }

  // ---------- Liste ----------
  const liste = $("#altin-liste");
  $$("#ekran-fiyatlar .segment [role=tab]").forEach((b) =>
    b.addEventListener("click", () => {
      durum.grup = b.dataset.grup;
      $$("#ekran-fiyatlar .segment [role=tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
      listeCiz();
    })
  );

  function listeCiz() {
    const secili = GRUP[durum.grup].map(bul).filter(Boolean);
    if (!secili.length) {
      liste.innerHTML = `<li class="yukleniyor">${durum.hata ? "Fiyatlar alınamadı. Bağlantınızı kontrol edip yenileyin." : "Fiyatlar yükleniyor…"}</li>`;
      return;
    }
    liste.innerHTML = secili.map((q) => {
      const d = q.changePct ?? 0;
      const sinif = d > 0.0001 ? "arti" : d < -0.0001 ? "eksi" : "sabit";
      const ok = sinif === "arti" ? "▲" : sinif === "eksi" ? "▼" : "•";
      // "Has Altın (gr)" → ad "Has Altın", açıklama "gram"
      const ad = q.name.replace(/\s*\((gr|g)\)\s*$/i, "");
      return `<li class="kur" data-kod="${q.key}">
        <div class="kur-satir">
          <span class="kur-ad"><span class="bayrak">${ROZET[q.key] || "•"}</span><span><span class="kur-kod">${ad}</span><span class="kur-isim">${BIRIM(q.key) === "adet" ? "adet · 22 ayar" : "gram"}</span></span></span>
          <span class="fiyat">${fiyatHtml(q.buy)}<small>alış</small></span>
          <span class="fiyat">${fiyatHtml(q.sell)}<small class="degisim ${sinif}">${ok} %${fmtYuzde.format(Math.abs(d))}</small></span>
        </div>
      </li>`;
    }).join("");
  }

  // ---------- Hesaplama ----------
  const tutar = $("#ah-tutar");
  const sonuc = $("#ah-sonuc");
  const bilgi = $("#ah-bilgi");
  const urunKutu = $("#ah-urun");

  function urunCiz() {
    const var_ = HESAP_URUNLER.map(bul).filter(Boolean);
    if (!var_.length) { urunKutu.innerHTML = ""; return; }
    urunKutu.innerHTML = var_.map((q) =>
      `<button type="button" role="radio" aria-checked="${q.key === durum.hesapUrun}" data-kod="${q.key}">${q.name.replace(/\s*\((gr|g)\)\s*$/i, "")}</button>`
    ).join("");
  }
  urunKutu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kod]");
    if (!b) return;
    durum.hesapUrun = b.dataset.kod;
    hesapla();
  });
  $("#ah-cevir").addEventListener("click", () => {
    durum.hesapYon = durum.hesapYon === "tlden" ? "altindan" : "tlden";
    const s = sonuc.dataset.deger;
    if (s) tutar.value = (durum.hesapYon === "tlden" ? fmt2 : fmtGram).format(Number(s));
    hesapla();
  });
  tutar.addEventListener("input", () => { T.tutarBicimle(tutar); hesapla(); });

  function hesapla() {
    if ($("#ekran-altin-hesapla").hidden) return;
    urunCiz();
    const q = bul(durum.hesapUrun);
    const birim = BIRIM(durum.hesapUrun);
    const tlden = durum.hesapYon === "tlden";
    $("#ah-ust-etiket").textContent = tlden ? "Tutar (TL)" : `Miktar (${birim})`;
    $("#ah-alt-etiket").textContent = tlden ? `Karşılığı (${birim})` : "Karşılığı (TL)";
    const n = T.sayiOku(tutar.value);
    if (!q || n === null) {
      sonuc.textContent = "—";
      delete sonuc.dataset.deger;
      bilgi.textContent = q ? "" : "Fiyatlar yükleniyor…";
      return;
    }
    // Müşteri TL verip altın alıyorsa SATIŞ fiyatı, altın verip TL alıyorsa ALIŞ fiyatı
    // (Tempo Döviz'le aynı mantık).
    const fiyat = tlden ? q.sell : q.buy;
    const karsilik = tlden ? n / fiyat : n * fiyat;
    sonuc.dataset.deger = String(karsilik);
    const ad = q.name.replace(/\s*\((gr|g)\)\s*$/i, "");
    sonuc.textContent = tlden ? `${fmtGram.format(karsilik)} ${birim}` : `${fmt2.format(karsilik)} TL`;
    bilgi.innerHTML = tlden
      ? `<b>1 ${birim} ${ad} = ${fmt2.format(fiyat)} TL</b> satış fiyatı üzerinden. Külçe ve ziynette işçilik/sertifika bedeli ayrıca eklenir; kesin fiyat mağazada.`
      : `<b>1 ${birim} ${ad} = ${fmt2.format(fiyat)} TL</b> alış fiyatı üzerinden. Geri alışta ürünün durumu ve sertifikası dikkate alınır.`;
  }

  // ---------- Aydınlat / karart (varsayılan koyu, site gibi) ----------
  const temaBtn = $("#altin-tema");
  function temaUygula(acik) {
    if (acik) document.documentElement.dataset.temaAltin = "acik"; else delete document.documentElement.dataset.temaAltin;
    try { acik ? localStorage.setItem("tema-altin", "acik") : localStorage.removeItem("tema-altin"); } catch {}
    $("#tema-rengi").setAttribute("content", acik ? "#f4efe6" : "#14110c");
  }
  try { if (localStorage.getItem("tema-altin") === "acik") temaUygula(true); } catch {}
  temaBtn.addEventListener("click", () => temaUygula(document.documentElement.dataset.temaAltin !== "acik"));

  // ---------- İletişim: şu an açık mı? (Tempo Altın: hafta içi 09–18, cumartesi 09–15) ----------
  function acikMi() {
    const parcalar = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
    const al = (t) => parcalar.find((p) => p.type === t)?.value;
    const gun = al("weekday"), dk = Number(al("hour")) * 60 + Number(al("minute"));
    const kapanis = gun === "Paz" ? null : gun === "Cmt" ? 15 * 60 : 18 * 60;
    const acik = kapanis !== null && dk >= 9 * 60 && dk < kapanis;
    const kutu = $("#altin-acik-kapali");
    kutu.classList.toggle("kapali", !acik);
    if (acik) kutu.innerHTML = `Şu an açık <span>· ${String(Math.floor(kapanis / 60)).padStart(2, "0")}:00'a kadar</span>`;
    else kutu.innerHTML = `Şu an kapalı <span>· ${gun === "Cmt" || gun === "Paz" ? "Pazartesi" : dk < 9 * 60 ? "bugün" : gun === "Cum" ? "Cumartesi" : "yarın"} 09:00'da açılır</span>`;
  }

  document.addEventListener("altin-ekran", (e) => {
    if (e.detail === "hesapla") hesapla();
    if (e.detail === "iletisim") acikMi();
  });

  // Giriş ekranı oynarken fiyatlar gelsin; giriş sönünce hazır olsun
  fiyatlariCek();
  sayacBaslat();
})();
