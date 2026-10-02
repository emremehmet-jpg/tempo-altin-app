/* Tempo Altın uygulaması — kabuk: giriş ekranı, ekran yönlendirme, ortak yardımcılar.
   (Fiyatlar, hesaplama, tema, açık/kapalı altin.js'de; vitrin, ürünler, hizmetler,
   sözleşmeler magaza.js'de.)

   Uygulama TEMPO ALTIN | 1988 logosuyla açılır (giriş): logo belirir, O bir tur
   dönüp bir kez zıplar, giriş söner. Adres çubuğu:
     (boş) vitrin · #urunler/<kategori> · #urun/<slug> · #fiyatlar · #hesapla · #daha …
   (ayrıntı aşağıda "Ekranlar ve adresler"). Giriş yalnız ilk açılışta oynar. */

(() => {
  "use strict";

  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];

  // ---------- Sayı biçimleme (TR) ----------
  const fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTam = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const fmtSaat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  // "10.000,50" → 10000.5 ; boş → null
  function sayiOku(metin) {
    const t = String(metin).replace(/\./g, "").replace(",", ".").replace(/\s/g, "").trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  // Yazarken binlik ayracı ekle; virgülden sonrasına dokunma
  function tutarBicimle(input) {
    const ham = input.value;
    const [govde, kurus] = ham.replace(/\./g, "").split(",");
    const n = govde === "" ? "" : Number(govde);
    if (govde !== "" && !Number.isFinite(n)) return;
    const yeni = (govde === "" ? "" : fmtTam.format(n)) + (kurus !== undefined ? "," + kurus.replace(/[^\d]/g, "").slice(0, 4) : "");
    if (yeni !== ham) input.value = yeni;
  }

  // ---------- Ekranlar ve adresler ----------
  // Adres biçimi: #ad/parametre?sorgu   örn. #urun/tempo-1-gr-kulce-altin-999-9,
  // #urunler/taki?sirala=gram, #sozlesme/kvkk, #butce?tutar=10000. Boş → vitrin.
  // İki tür ekran var:
  //   statik  — index.html'de <section data-ekran="ad"> (fiyatlar, hesapla, iletisim, daha)
  //   dinamik — magaza.js'in sayfaKaydet(ad, ciz) ile kaydettiği; #ekran-sayfa içine çizilir
  // Bağlantılar düz <a href="#..."> → tarayıcı geçmişi tutulur, telefonda geri hareketi çalışır.
  const kok = $("#bolum-altin");
  const ILK_EKRAN = "vitrin";
  const sayfalar = {};
  const sayfaKutu = $("#ekran-sayfa");
  // Alt sekmelerden hangisi yanar (yoksa "daha")
  const SEKMESI = { vitrin: "vitrin", butce: "vitrin", hediyelik: "vitrin", urunler: "urunler", urun: "urunler",
    fiyatlar: "fiyatlar", hesapla: "hesapla" };
  let sonAdres = null;

  function ekranAc(ad, param = [], sorgu = new URLSearchParams()) {
    const statik = $(`.ekran[data-ekran="${ad}"]:not(#ekran-sayfa)`, kok);
    if (!statik && !sayfalar[ad]) { ad = ILK_EKRAN; param = []; sorgu = new URLSearchParams(); }
    const hedef = statik || sayfaKutu;
    $$(".ekran", kok).forEach((e) => (e.hidden = e !== hedef));
    const sekme = SEKMESI[ad] || "daha";
    $$(".sekme", kok).forEach((s) => s.classList.toggle("aktif", s.dataset.hedef === sekme));
    if (!statik) {
      sayfaKutu.dataset.sayfa = ad;
      sayfaKutu.innerHTML = "";
      sayfalar[ad](sayfaKutu, param, sorgu);
    }
    // Aynı sayfada yalnız sorgu değiştiyse (sıralama, filtre) kaydırma yerinde kalsın
    const adres = ad + "/" + param.join("/");
    if (adres !== sonAdres) window.scrollTo({ top: 0 });
    sonAdres = adres;
    document.dispatchEvent(new CustomEvent("altin-ekran", { detail: ad })); // altin.js dinler
  }

  // Kodla gitmek için (git("urun/x")); degistir: geçmişe yeni kayıt eklemeden
  function git(h, degistir = false) {
    h = h ? "#" + h.replace(/^#/, "") : "";
    if (location.hash === h || (!h && !location.hash)) return adrestenAc();
    if (degistir) { history.replaceState(null, "", h || location.pathname); adrestenAc(); }
    else location.hash = h;
  }

  // Alt sekmeler: geçmişi şişirmesin
  $$(".sekme[data-hedef]", kok).forEach((s) => s.addEventListener("click", () => git(s.dataset.hedef === ILK_EKRAN ? "" : s.dataset.hedef, true)));
  $(".marka", kok).addEventListener("click", () => git("", true));

  // Eski adresler: #altin/fiyatlar → fiyatlar, #magaza → urunler
  function adrestenAc() {
    const h = decodeURIComponent(location.hash.slice(1)).replace(/^altin\/?/, "");
    const [yol, sorgu = ""] = h.split("?");
    let [ad, ...param] = yol.split("/").filter(Boolean);
    if (ad === "magaza") ad = "urunler";
    ekranAc(ad || ILK_EKRAN, param, new URLSearchParams(sorgu));
  }
  window.addEventListener("hashchange", adrestenAc);

  // ---------- Giriş ----------
  // Logo .6 sn'de belirir; O .65 sn'de başlar, .75 sn sürer (CSS girisO) → 1,4 sn.
  // Biraz bekleyip söner (350 ms). Dokunulursa hemen söner.
  const giris = $("#giris");
  const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let girisZamanlayici = null;
  function girisBitir() {
    if (!giris || giris.classList.contains("sonuyor")) return;
    clearTimeout(girisZamanlayici);
    giris.classList.add("sonuyor");
    setTimeout(() => giris.remove(), 350);
  }
  if (giris) {
    giris.addEventListener("click", girisBitir);
    girisZamanlayici = setTimeout(girisBitir, azHareket ? 900 : 1900);
  }

  // altin.js ve magaza.js'in kullanması için
  window.TempoApp = {
    fmt2, fmtSaat, sayiOku, tutarBicimle, git,
    sayfaKaydet: (ad, ciz) => { sayfalar[ad] = ciz; },
    get sayfa() { return sayfaKutu.hidden ? null : sayfaKutu.dataset.sayfa; },
    yenidenCiz: adrestenAc,   // veri gelince açık dinamik sayfayı tazele
  };

  // ---------- Başlat ----------
  // Tüm betikler (magaza.js sayfalarını kaydetsin) yüklendikten sonra
  document.addEventListener("DOMContentLoaded", adrestenAc);

  if ("serviceWorker" in navigator) {
    // https veya localhost dışında kayıt olmaz; hata sessizce yutulur
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
})();
