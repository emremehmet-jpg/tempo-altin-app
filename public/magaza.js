/* Tempo Altın — mağaza: vitrin, ürünler, ürün sayfası, bütçe, hediyelik, hizmetler,
   kampanyalar, sipariş takip, sözleşmeler. tempoaltin.com'un içeriği (Emre, 2 Eki 2026:
   "sitede ne varsa uygulamaya göm").

   Veri:
     /veri/katalog.json            87 ürün + 14 kategori (arac/katalog-uret.py üretir)
     /api/altin/urun-fiyatlari     sitenin GERÇEK ürün fiyatları (server.mjs arama sayfasından okur, 60 sn)
     altin-kotasyon olayı          canlı kotasyon (altin.js); site fiyatı yoksa formül bununla işler
     /veri/sozlesmeler/<slug>.md   11 yasal metin, sitedeki gibi
   Sepet ve ödeme SİTEDE (Emre'nin kararı): sitenin sepeti tempoaltin.com çerezinde
   tutulduğu için uygulamadan doldurulamaz; "Sepete ekle" ürünün sitedeki sayfasını açar.
   Uygulama tempoaltin.com/app altına taşınınca sepet buraya alınabilir.
   Sayfalar TempoApp.sayfaKaydet ile kaydedilir; adresler app.js'de. */

(() => {
  "use strict";

  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];
  const T = window.TempoApp;
  const fmt2 = T.fmt2;
  const fmtTam = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const fmtGr = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const SITE = "https://tempoaltin.com";
  // Sitedeki telefon yer tutucu (000…); uygulama İletişim'deki numarayı kullanır (DURUM.md)
  const TEL = { metin: "(0216) 651 12 95", href: "tel:+902166511295" };
  const SAATLER = "Hafta içi 09:00 – 18:00, Cumartesi 09:00 – 15:00";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tl = (n) => `${fmt2.format(n)} ₺`;
  // 7.203,43 → 7.203,<span class="kurus">43</span> ₺  (sitedeki gibi kuruş küçük)
  const tlHtml = (n) => { const s = fmt2.format(n), i = s.lastIndexOf(","); return `${s.slice(0, i)},<span class="kurus">${s.slice(i + 1)}</span> <span class="tl">₺</span>`; };
  const gorsel = (u, w = 384) => `/api/altin/gorsel?u=${encodeURIComponent(u)}&w=${w}`;
  const dis = (yol) => SITE + yol;
  const disLink = (yol, metin, sinif = "dugme") => `<a class="${sinif}" href="${dis(yol)}" target="_blank" rel="noopener">${metin} <span aria-hidden="true">↗</span></a>`;
  const kucukHarf = (s) => s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

  // ---------- Veri ----------
  const veri = { urunler: [], urun: new Map(), kat: new Map(), anaKat: [], hazir: false };
  let kot = {};             // key → {buy, sell}
  let kotZaman = null;
  let site = {};            // slug → {satis, alis, gramBasi, tukendi}
  let siteZaman = null;

  fetch("/veri/katalog.json").then((y) => y.json()).then((k) => {
    veri.urunler = k.urunler;
    k.urunler.forEach((p) => veri.urun.set(p.slug, p));
    k.kategoriler.forEach((c) => veri.kat.set(c.slug, c));
    veri.anaKat = k.kategoriler.filter((c) => !c.ust).sort((a, b) => a.sira - b.sira);
    veri.hazir = true;
    if (T.sayfa) T.yenidenCiz();
  }).catch(() => { veri.hata = true; if (T.sayfa) T.yenidenCiz(); });

  document.addEventListener("altin-kotasyon", (e) => {
    kot = Object.fromEntries(e.detail.kotasyon.map((q) => [q.key, q]));
    kotZaman = e.detail.guncelleme;
    fiyatTazele();
  });

  let cekiliyor = false;
  async function siteFiyatCek() {
    if (cekiliyor) return;
    cekiliyor = true;
    try {
      const y = await fetch("/api/altin/urun-fiyatlari", { cache: "no-store" });
      const v = await y.json();
      if (v.fiyatlar && Object.keys(v.fiyatlar).length) { site = v.fiyatlar; siteZaman = v.zaman ? new Date(v.zaman) : new Date(); }
    } catch {} finally { cekiliyor = false; fiyatTazele(); }
  }
  siteFiyatCek();
  let sayac = setInterval(siteFiyatCek, 60000);
  document.addEventListener("visibilitychange", () => {
    clearInterval(sayac);
    if (!document.hidden) { siteFiyatCek(); sayac = setInterval(siteFiyatCek, 60000); }
  });

  // Ürün fiyatı: önce sitenin kendi fiyatı; yoksa sitenin formülü canlı kotasyonla
  // (kaynak/tempoaltin-site/RAPOR.md §2.2; 87 üründe 85'i kuruşu kuruşuna tuttu)
  function fiyat(p) {
    const s = site[p.slug];
    if (s) return { satis: s.satis, alis: s.alis, gramBasi: s.gramBasi ?? s.satis / p.gram, tukendi: s.tukendi };
    const f = p.formul, ks = kot[f.satisKot], ka = kot[f.alisKot];
    if (!ks) return null;
    const gram = f.tip === "gram";
    const r2 = (n) => Math.round(n * 100) / 100;
    const satis = r2(ks.sell * (gram ? p.gram * f.saflik : 1) * f.satisCarpan);
    const alis = ka ? r2(ka.buy * (gram ? p.gram * f.alisSaflik : 1) * f.alisCarpan) : null;
    return { satis, alis, gramBasi: satis / p.gram, tukendi: false };
  }
  const havaleMi = (p) => p.tur === "ACCOUNT_TRANSFER";
  const guncelSaat = () => { const z = siteZaman || kotZaman; return z ? T.fmtSaat.format(z) : "—"; };

  // Fiyat yazan yerler data-f="slug:alan" taşır; yeni fiyat gelince yalnız onlar değişir
  // (sayfa yeniden çizilmez → kaydırma, seçimler yerinde kalır)
  const ALAN = {
    satis: (p, f) => tlHtml(f.satis),
    duz: (p, f) => tl(f.satis),
    alt: (p, f) => havaleMi(p) ? `gram fiyatı · alış ${tl(f.alis)}` : `${tl(f.gramBasi)} / gr${f.alis ? ` · alış ${tl(f.alis)}` : ""}`,
    alis: (p, f) => f.alis ? tl(f.alis) : "—",
    gramBasi: (p, f) => tl(f.gramBasi),
    zaman: () => guncelSaat(),
  };
  function fiyatYaz(el) {
    const [slug, alan] = el.dataset.f.split(":");
    const p = veri.urun.get(slug), f = p && fiyat(p);
    if (!f && alan !== "zaman") { el.textContent = "—"; return; }
    el.innerHTML = ALAN[alan](p, f);
  }
  function fiyatTazele() {
    $$("[data-f]").forEach(fiyatYaz);
    $$("[data-kot]").forEach((el) => { const q = kot[el.dataset.kot]; if (q) el.innerHTML = tlHtml(q.sell); });
    $$("[data-hesap]").forEach((el) => el.dispatchEvent(new Event("tazele")));
    $$(".urun-kart").forEach((k) => { const p = veri.urun.get(k.dataset.slug), f = p && fiyat(p); k.classList.toggle("tukendi", !!f?.tukendi); });
  }
  const f = (slug, alan) => `<span data-f="${slug}:${alan}">—</span>`;   // yer tutucu; çizimden sonra doldurulur

  // ---------- Ortak parçalar ----------
  function kart(p) {
    return `<a class="urun-kart" data-slug="${p.slug}" href="#urun/${p.slug}">
      <span class="urun-gorsel${p.tur === "BULLION" || havaleMi(p) ? " kulce" : ""}"><img loading="lazy" decoding="async" src="${gorsel(p.gorsel[0])}" alt=""></span>
      <span class="urun-ad">${esc(p.ad)}</span>
      <span class="urun-ozet">${esc(p.ozet)}</span>
      <span class="urun-fiyat">${f(p.slug, "satis")}${havaleMi(p) ? `<small> / gram</small>` : ""}</span>
      <span class="urun-alt">${f(p.slug, "alt")}</span>
      <span class="urun-tukendi">Tükendi</span>
    </a>`;
  }
  const izgara = (liste) => liste.length ? `<div class="urun-izgara">${liste.map(kart).join("")}</div>` : `<p class="bos">Bu seçimde ürün yok.</p>`;
  const ust = ({ kicker, baslik, metin, dugmeler = "" }) => `
    <header class="sayfa-ust">
      ${kicker ? `<span class="kicker">${kicker}</span>` : ""}
      <h1 class="ekran-baslik">${baslik}</h1>
      ${metin ? `<p class="ekran-alt">${metin}</p>` : ""}
      ${dugmeler ? `<div class="dugmeler">${dugmeler}</div>` : ""}
    </header>`;
  const adimlar = (liste) => `<ol class="adimlar">${liste.map(([b, m], i) => `<li><span class="adim-no">${String(i + 1).padStart(2, "0")}</span><div><b>${b}</b><p>${m}</p></div></li>`).join("")}</ol>`;
  const bilgiKart = (liste) => `<div class="bilgi-kartlar">${liste.map(([b, m]) => `<div><b>${b}</b><small>${m}</small></div>`).join("")}</div>`;
  const sss = (liste) => `<h2 class="bolum-baslik">Sorular</h2><div class="sss">${liste.map(([s, c]) => `<details><summary>${s}</summary><p>${c}</p></details>`).join("")}</div>`;
  const icLink = (h, metin, sinif = "dugme") => `<a class="${sinif}" href="#${h}">${metin}</a>`;
  const yukleniyor = (kutu) => { kutu.innerHTML = `<p class="bos">${veri.hata ? "Ürün bilgileri alınamadı. Bağlantınızı kontrol edip yeniden açın." : "Yükleniyor…"}</p>`; };
  // Çizimden sonra fiyatları doldur
  const bitir = (kutu) => { $$("[data-f]", kutu).forEach(fiyatYaz); fiyatTazele(); };

  function katUrunleri(slug) {
    const c = veri.kat.get(slug);
    return c ? c.urunler.map((s) => veri.urun.get(s)).filter(Boolean) : veri.anaKat.flatMap((k) => k.urunler.map((s) => veri.urun.get(s)));
  }

  // ======================================================================
  // VİTRİN (ana sayfa)
  // ======================================================================
  const VITRIN = ["tempo-1-gr-kulce-altin-999-9", "tempo-5-gr-kulce-altin-999-9", "tempo-10-gr-kulce-altin-999-9", "tempo-50-gr-kulce-altin-999-9",
    "tempo-100-gr-999-0-gumus-kulce", "ceyrek-altin-yeni-tarihli", "ata-lira-altin-102-yil-yeni-tarihli", "tempo-22-ayar-burma-bilezik-10-gr"];
  // Sitedeki 6 slaytlık bant (7 sn'de bir döner)
  const SLAYT = [
    ["22 Ayar Bilezikler", "Zarif tasarım, gerçek değer.", "Burma, Ajda, kibrit çöpü… 22 ayar altının değerini ve işçiliğin zarafetini bir arada; işçilik her üründe ayrı yazılır.", "urunler/taki", "Bilezikleri keşfet", "/urun/tempo-22-ayar-burma-bilezik-10-gr-1.jpg"],
    ["Düzenli Birikim", "Her ay bir külçe.", "Ürünü ve sıklığı seçin, kartınızı bağlayın; her dönem o günün fiyatıyla alınır, sertifikalı külçeniz sigortalı gelir.", "duzenli-birikim", "Planımı kur", "/marka/kulce/gold/1g.webp"],
    ["Teslimat", "Kapınıza, tam sigortalı.", "Hafta içi 16:00’a kadar onaylanan siparişler aynı gün kargoda; içeriği belli olmayan ambalajla, yalnızca size.", "kargo-ve-teslimat", "Teslimat seçenekleri", "/marka/kulce/gold/10g.webp"],
    ["Vadeli Altın", "Bugün alın, vadesinde teslim alın.", "15–90 gün vade seçin; vade uzadıkça %3,00’e varan indirim. Fiyat ve gramaj sipariş anında sabitlenir.", "vadeli-altin", "Nasıl çalışır?", "/marka/kulce/gold/50g.webp"],
    ["Gel Al", "Sipariş internetten, teslim mağazadan.", "Canlı fiyattan sipariş verin, fiyat kilitlensin; hazır bildirimi gelince mağazamızdan kimliğinizle alın.", "gel-al", "İncele", "/marka/kulce/gold/5g.webp"],
    ["Hesaba Altın Havale", "Fiziki teslimatsız, küsuratlı gram.", "Altın hesabınıza IBAN’la 0,01 gr hassasiyetinde havale; aynı gün, en düşük marjla.", "urunler/hesaba-altin-havale", "Başla", "/marka/kulce/gold/1g.webp"],
  ];
  const VESILE = [["dugun", "Düğün"], ["yeni-dogan", "Yeni doğan"], ["dogum-gunu", "Doğum günü"], ["yildonumu", "Yıldönümü"], ["mezuniyet", "Mezuniyet"], ["kurumsal", "Kurumsal hediye"]];
  const KAT_KART = [["gram-kulce-altin", "Gram külçe altın", "1 gr – 12,5 kg · 995,0 ve 999,9"], ["ziynet-altin", "Ziynet altın", "Çeyrek, yarım, tam, Reşat, Ata"],
    ["gram-kulce-gumus", "Gram külçe gümüş", "50 gr – 15 kg · 999,0"], ["taki", "22 ayar bilezik", "Burma, Ajda, kibrit çöpü…"], ["hesaba-altin-havale", "Hesaba altın havale", "Fiziki teslimatsız, küsuratlı gram"]];
  const GUVEN = [["Sertifikalı ürün", "Her külçe seri numaralı üretici sertifikası ve blister ambalajıyla; ziynet ve takılar ayar damgalı."],
    ["Şeffaf fiyat", "Canlı piyasa referansından anlık; ödeme sayfasında gördüğünüz fiyat kilitlenir, sürpriz yok."],
    ["Sigortalı teslimat", "Bedelinin tamamı üzerinden sigortalı, içeriği belli olmayan ambalajla; yalnızca size, kimlik ibrazıyla."]];

  function butceFormu(deger = "") {
    return `<form class="butce-form" data-butce-form>
      <label class="alan"><span class="alan-etiket">Tutar</span>
        <span class="tutar-kutu"><input name="tutar" type="text" inputmode="numeric" autocomplete="off" placeholder="10.000" value="${esc(deger)}"><span>₺</span></span></label>
      <button class="dugme" type="submit">Göster</button>
    </form>`;
  }
  function butceFormuBagla(kutu, amac = "") {
    const form = $("[data-butce-form]", kutu);
    if (!form) return;
    const inp = form.tutar;
    inp.addEventListener("input", () => T.tutarBicimle(inp));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = T.sayiOku(inp.value);
      if (n) T.git(`butce?tutar=${Math.round(n)}${amac ? "&amac=" + amac : ""}`);
    });
  }

  T.sayfaKaydet("vitrin", (kutu) => {
    if (!veri.hazir) return yukleniyor(kutu);
    kutu.innerHTML = `
      <section class="kahraman">
        <span class="kicker">1988’den beri</span>
        <h1>Altın, <em>sade haliyle.</em></h1>
        <p>Sertifikalı külçe, ziynet ve gümüş — canlı piyasadan, sigortalı teslimatla. 1988’den beri; şimdi kapınızda.</p>
        <div class="kahraman-fiyat"><span data-kot="HAS_ALTIN">—</span><small>HAS ALTIN · GRAM</small></div>
        <div class="dugmeler">${icLink("urunler/gram-kulce-altin", "Koleksiyonu gör")}${icLink("hizmetler", "Hizmetler", "dugme ikincil")}</div>
        <div class="kahraman-gorsel" aria-hidden="true">
          <img src="${gorsel("/marka/kulce/gold/10g.webp", 640)}" alt=""><img src="${gorsel("/marka/kulce/gold/1g.webp", 384)}" alt=""><img src="${gorsel("/marka/kulce/gold/50g.webp", 640)}" alt="">
        </div>
      </section>

      <section class="slaytlar" aria-roledescription="carousel" aria-label="Öne çıkanlar">
        <div class="slayt-ray">${SLAYT.map(([k, b, m, h, d, g]) => `
          <a class="slayt" href="#${h}">
            <div><span class="kicker">${k}</span><b>${b}</b><small>${m}</small><span class="slayt-dugme">${d} →</span></div>
            <img loading="lazy" src="${gorsel(g, 384)}" alt="">
          </a>`).join("")}</div>
        <div class="slayt-nokta">${SLAYT.map((_, i) => `<button type="button" aria-label="Slayt ${i + 1}" data-i="${i}"></button>`).join("")}</div>
      </section>

      <div class="bolum-bas"><h2 class="bolum-baslik">Vitrin</h2><a href="#urunler">${veri.urunler.length} ürün · fiyatlar canlı ›</a></div>
      ${izgara(VITRIN.map((s) => veri.urun.get(s)).filter(Boolean))}

      <section class="kart blok">
        <h2 class="bolum-baslik">Ne kadar ayırmak istersiniz?</h2>
        <p class="ekran-alt">Tutarı yazın; bütçenize sığan en yüksek gramajı, gram başı en uygun seçeneği ve varsa kampanyalı ürünleri gösterelim.</p>
        ${butceFormu()}
        <p class="dipnot">Hesaba altın havale ile 500 ₺’den başlayabilirsiniz.</p>
      </section>

      <section class="blok">
        <h2 class="bolum-baslik">Özel gün için altın</h2>
        <p class="ekran-alt">Düğün, yeni doğan, doğum günü, mezuniyet ve kurumsal hediye için seçilmiş ürünler; hediye notu ve doğrudan alıcıya sigortalı gönderim.</p>
        <div class="cipler">${VESILE.map(([v, a]) => `<a class="cip" href="#hediyelik?vesile=${v}">${a}</a>`).join("")}</div>
      </section>

      ${bilgiKart(GUVEN)}

      <h2 class="bolum-baslik">Ne arıyorsunuz?</h2>
      <div class="kat-kartlar">${KAT_KART.map(([s, a, m]) => `<a href="#urunler/${s}"><b>${a}</b><small>${m}</small></a>`).join("")}</div>

      <section class="kart blok vurgu">
        <span class="kicker">Düzenli Birikim</span>
        <h2>Her ay bir külçe.</h2>
        <p>Ürünü ve sıklığı seçin, kartınızı bağlayın; her dönem o günün fiyatıyla alınır, sertifikalı külçeniz sigortalı gelir. Dilediğiniz an durdurun.</p>
        <div class="dugmeler">${icLink("duzenli-birikim", "Planımı kur")}${icLink("kampanyalar", "Kampanyalar", "dugme ikincil")}</div>
      </section>

      <section class="kurumsal">
        <img loading="lazy" src="${gorsel("/marka/magaza.webp", 640)}" alt="Tempo Altın mağazası">
        <span class="kicker">1988’den bugüne</span>
        <h2>Köklü bir kurumun dijital mağazası.</h2>
        <p>Tempo Teknoloji Ticaret Anonim Şirketi, 1988’den bu yana kıymetli maden alanında biriken güveni ve tecrübeyi dijitale taşır. Sertifikalı külçe altın, ziynet ve gümüşü şeffaf fiyatlarla, kurumsal disiplinle sunarız.</p>
        <p>Külçelerimiz, T.C. Hazine ve Maliye Bakanlığı Darphane Genel Müdürlüğü onaylı ve Borsa İstanbul Kıymetli Madenler Piyasası’nda işlem yetkisi bulunan rafinerilerin sertifikalı üretimidir; 24 ayar külçelerde yalnızca LBMA akreditasyonlu üreticilerle çalışırız.</p>
        <div class="dugmeler">${icLink("hakkimizda", "Hakkımızda", "dugme ikincil")}<a class="dugme ikincil" href="${TEL.href}">${TEL.metin}</a></div>
      </section>`;
    butceFormuBagla(kutu);
    slaytBagla(kutu);
    bitir(kutu);
  });

  // Slaytlar: yatay kaydırma (parmakla), 7 sn'de bir kendiliğinden; dokununca durur
  let slaytZaman = null;
  function slaytBagla(kutu) {
    const ray = $(".slayt-ray", kutu), noktalar = $$(".slayt-nokta button", kutu);
    if (!ray) return;
    const sira = () => Math.round(ray.scrollLeft / ray.clientWidth);
    const isaretle = () => noktalar.forEach((n, i) => n.classList.toggle("aktif", i === sira()));
    const git = (i) => ray.scrollTo({ left: i * ray.clientWidth, behavior: "smooth" });
    ray.addEventListener("scroll", isaretle, { passive: true });
    noktalar.forEach((n) => n.addEventListener("click", () => git(Number(n.dataset.i))));
    isaretle();
    clearInterval(slaytZaman);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    slaytZaman = setInterval(() => {
      if (!document.body.contains(ray)) return clearInterval(slaytZaman);
      git((sira() + 1) % noktalar.length);
    }, 7000);
    ray.addEventListener("touchstart", () => clearInterval(slaytZaman), { once: true, passive: true });
  }

  // ======================================================================
  // ÜRÜNLER (kategori) — #urunler/<kategori>?sirala=&filtre=&q=
  // ======================================================================
  const SIRALA = [["", "Önerilen"], ["gram", "Grama göre"], ["fiyat-artan", "Fiyat: artan"], ["fiyat-azalan", "Fiyat: azalan"]];
  const FILTRE = [["kampanyali", "Kampanyalı"], ["stokta", "Stokta"]];
  const BILGI_KAT = `
    <div class="bilgi-kartlar">
      <div><b>Fiyatlar nasıl belirlenir?</b><small>Fiyatlar canlı piyasa referansına göre anlık güncellenir; ödemeye geçtiğinizde gördüğünüz fiyat sunucuda kısa süre sabitlenir. Her ürün için geri alış fiyatımız da yayınlanır.</small></div>
      <div><b>Teslimat</b><small>Hafta içi kesim saatinden önce onaylanan siparişler aynı gün sigortalı kargoya verilir; yüksek tutarlarda özel sigortalı taşıma veya zırhlı araç. Teslimat yalnızca kimlik ibrazıyla yapılır. <a href="#kargo-ve-teslimat">Detaylar</a></small></div>
    </div>`;

  T.sayfaKaydet("urunler", (kutu, [slug], q) => {
    if (!veri.hazir) return yukleniyor(kutu);
    const c = veri.kat.get(slug);
    const ana = c ? (c.ust ? veri.kat.get(c.ust) : c) : null;
    const sirala = q.get("sirala") || "", filtre = q.get("filtre") || "", ara = q.get("q") || "";
    let liste = katUrunleri(c?.slug);
    if (ara) { const a = kucukHarf(ara); liste = veri.urunler.filter((p) => kucukHarf(p.tamAd + " " + p.ozet).includes(a)); }
    if (filtre === "stokta") liste = liste.filter((p) => !fiyat(p)?.tukendi);
    if (filtre === "kampanyali") liste = liste.filter((p) => p.kampanya.length);
    const fs = (p) => fiyat(p)?.satis ?? Infinity;
    if (sirala === "gram") liste = [...liste].sort((a, b) => a.gram - b.gram);
    if (sirala === "fiyat-artan") liste = [...liste].sort((a, b) => fs(a) - fs(b));
    if (sirala === "fiyat-azalan") liste = [...liste].sort((a, b) => fs(b) - fs(a));
    // Aynı kategoride sıralama/filtre değiştiren adres (boş değerler atılır)
    const adres = (deg) => {
      const s = new URLSearchParams(Object.entries({ sirala, filtre, q: ara, ...deg }).filter(([, v]) => v));
      return `#urunler${c ? "/" + c.slug : ""}${s.toString() ? "?" + s : ""}`;
    };
    kutu.innerHTML = `
      ${c ? `<nav class="yol"><a href="#">Vitrin</a> / ${ana && ana !== c ? `<a href="#urunler/${ana.slug}">${esc(ana.ad)}</a> / ` : `<a href="#urunler">Ürünler</a> / `}<span>${esc(c.ad)}</span></nav>` : ""}
      <h1 class="ekran-baslik">${ara ? `“${esc(ara)}”` : c ? esc(c.ad) : "Ürünler"}</h1>
      <p class="ekran-alt">${ara ? `${liste.length} sonuç` : c ? esc(c.aciklama || "") : `${veri.urunler.length} ürün · fiyatlar canlı`}</p>
      <form class="arama" data-arama><input name="q" type="search" placeholder="Ürün, gramaj veya bütçe (örn. 10000)" value="${esc(ara)}" autocomplete="off" enterkeyhint="search"></form>
      <div class="cipler kaydir">
        <a class="cip${!c && !ara ? " aktif" : ""}" href="#urunler">Tümü</a>
        ${veri.anaKat.map((k) => `<a class="cip${ana === k ? " aktif" : ""}" href="#urunler/${k.slug}">${esc(k.ad)}</a>`).join("")}
      </div>
      ${ana?.alt?.length ? `<div class="cipler kaydir alt">
        <a class="cip${c === ana ? " aktif" : ""}" href="#urunler/${ana.slug}">Tümü</a>
        ${ana.alt.map((s) => veri.kat.get(s)).filter(Boolean).map((k) => `<a class="cip${c === k ? " aktif" : ""}" href="#urunler/${k.slug}">${esc(k.ad)}</a>`).join("")}
      </div>` : ""}
      <div class="liste-arac">
        <label class="sirala"><span>Sırala</span><select data-sirala>${SIRALA.map(([v, a]) => `<option value="${v}"${v === sirala ? " selected" : ""}>${a}</option>`).join("")}</select></label>
        ${FILTRE.map(([v, a]) => `<a class="cip kucuk${filtre === v ? " aktif" : ""}" href="${adres({ filtre: filtre === v ? "" : v })}">${a}</a>`).join("")}
      </div>
      ${izgara(liste)}
      ${BILGI_KAT}`;
    $("[data-sirala]", kutu).addEventListener("change", (e) => T.git(adres({ sirala: e.target.value }).slice(1), true));
    $("[data-arama]", kutu).addEventListener("submit", (e) => {
      e.preventDefault();
      const v = e.target.q.value.trim();
      // Sitedeki gibi: 3+ haneli sayı bütçe sayılır
      if (/^[\d.]{3,}$/.test(v)) return T.git(`butce?tutar=${v.replace(/\./g, "")}`);
      T.git(v ? `urunler?q=${encodeURIComponent(v)}` : "urunler");
    });
    bitir(kutu);
  });

  // ======================================================================
  // ÜRÜN — #urun/<slug>
  // ======================================================================
  T.sayfaKaydet("urun", (kutu, [slug]) => {
    if (!veri.hazir) return yukleniyor(kutu);
    const p = veri.urun.get(slug);
    if (!p) { kutu.innerHTML = `<h1 class="ekran-baslik">Ürün bulunamadı</h1><p class="ekran-alt">Bu ürün artık satışta olmayabilir.</p>${icLink("urunler", "Ürünlere dön")}`; return; }
    const [anaS, altS] = p.kategori;
    const ana = veri.kat.get(anaS), alt = veri.kat.get(altS);
    const varyant = p.varyant.map((s) => veri.urun.get(s)).filter(Boolean);
    const kardes = katUrunleri(alt?.slug || anaS).filter((x) => x.slug !== p.slug);
    const i = Math.max(0, katUrunleri(alt?.slug || anaS).findIndex((x) => x.slug === p.slug));
    const benzer = [...kardes.slice(i), ...kardes.slice(0, i)].slice(0, 4);
    const ozellik = Object.entries(p.ozellik);
    const havale = havaleMi(p);
    const paylasMetin = `Tempo ${p.ad} — güncel fiyatını görüntüle: ${dis("/urun/" + p.slug)}`;
    kutu.innerHTML = `
      <nav class="yol"><a href="#urunler/${anaS}">${esc(ana?.ad || "Ürünler")}</a>${alt ? ` / <a href="#urunler/${alt.slug}">${esc(alt.ad)}</a>` : ""}</nav>
      <div class="galeri${p.tur === "BULLION" || havale ? " kulce" : ""}">
        <div class="galeri-ray">${p.gorsel.map((g, n) => `<img ${n ? 'loading="lazy"' : ""} src="${gorsel(g, 1080)}" alt="${esc(p.tamAd)}${p.gorsel.length > 1 ? ` — ${n + 1}` : ""}">`).join("")}</div>
        ${p.gorsel.length > 1 ? `<div class="slayt-nokta">${p.gorsel.map((_, n) => `<button type="button" aria-label="Görsel ${n + 1}" data-i="${n}"></button>`).join("")}</div>` : ""}
      </div>
      <h1 class="urun-baslik">${esc(p.ad)}</h1>
      <p class="urun-ozet">${esc(p.ozet)}</p>
      <div class="urun-fiyat-kutu">
        <div class="urun-fiyat-buyuk">${f(p.slug, "satis")}${havale ? "<small>/ gram</small>" : ""}</div>
        ${havale ? "" : `<div class="urun-gram">${f(p.slug, "gramBasi")} / gr</div>`}
        <p class="urun-geri">Geri alış ${f(p.slug, "alis")} · Son güncelleme ${f(p.slug, "zaman")}</p>
        <p class="urun-kilit">Ödemeye geçtiğinizde fiyat 3 dakika sunucuda sabitlenir.</p>
      </div>
      ${varyant.length > 1 ? `<h2 class="alan-etiket">Gramaj</h2>
        <div class="varyant">${varyant.map((v) => `<a href="#urun/${v.slug}"${v.slug === p.slug ? ' aria-current="true"' : ""}><b>${esc(v.gramMetin)}</b><small>${f(v.slug, "duz")}</small></a>`).join("")}</div>` : ""}

      <div class="satin-al">
        <p class="urun-tukendi-not">Bu ürün şu an stokta yok (sitede “Yakında Stokta”).</p>
        <a class="dugme buyuk" href="${dis("/urun/" + p.slug)}" target="_blank" rel="noopener">Sepete ekle — tempoaltin.com <span aria-hidden="true">↗</span></a>
        <small>${havale ? "Sitede almak istediğiniz gramı yazıp sepete ekleyin." : "Sitede adedi seçip sepete ekleyin."} Sepet ve ödeme tempoaltin.com’da, aynı fiyat ve aynı hesapla tamamlanır.</small>
      </div>

      ${p.kampanya.length ? `<div class="kampanya-kutu"><b>Bu üründe kampanya var.</b>${p.kampanya.map((k) => `<p>${esc(k)}</p>`).join("")}<small>İndirim ödeme adımında toplamdan düşer. <a href="#kampanyalar">Koşullar</a></small></div>` : ""}

      <ul class="madde">
        ${havale ? `<li>Ödemeniz sonrası aynı gün, adınıza kayıtlı banka altın hesabınıza IBAN ile havale.</li><li>0,01 gr hassasiyetinde; fiziki teslimat ve kargo yok.</li>`
          : `<li>Hafta içi 16:00’a kadar onaylanan siparişler aynı gün sigortalı kargoda; 1–3 iş gününde teslim.</li><li>Teslimat yalnızca sipariş sahibine, kimlik ibrazıyla.</li><li>Seri numaralı sertifikalı ambalaj; Türkiye genelinde nakde çevrilebilir.</li>`}
      </ul>

      <div class="paylas">
        <button class="dugme ikincil" type="button" data-paylas>Paylaş</button>
        <a class="dugme ikincil" href="https://wa.me/?text=${encodeURIComponent(paylasMetin)}" target="_blank" rel="noopener">WhatsApp</a>
        ${disLink(`/giris?next=${encodeURIComponent("/urun/" + p.slug)}`, "Fiyat alarmı kur", "dugme ikincil")}
      </div>

      <h2 class="bolum-baslik">Ürün bilgileri</h2>
      <p class="metin">${esc(p.aciklama)}</p>
      ${ozellik.length ? `<dl class="ozellik">${ozellik.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}

      <h2 class="bolum-baslik">Güvenli ödeme ve müşteri tanıma</h2>
      <p class="metin">Ödeme 3D Secure ile ödeme kuruluşunda doğrulanır; kart bilgileri Tempo’ya iletilmez. 5549 sayılı Kanun kapsamında kimlik tespiti yapılır; kart sahibi ile üye bilgileri eşleşmezse doğrulama istenir.</p>
      <h2 class="bolum-baslik">Teslimat</h2>
      <p class="metin">${havale ? "Fiziki teslimat yoktur; ödemede altın hesabınızın IBAN’ını yazarsınız (hesap adınıza olmalı). Gram aynı gün hesabınıza geçer." : "Siparişiniz içeriği belli olmayan ambalajla tam sigortalı gönderilir. 500.000 ₺ üzeri özel sigortalı taşıma, 2.000.000 ₺ üzeri zırhlı araç."} <a href="#kargo-ve-teslimat">Detaylar</a></p>
      <h2 class="bolum-baslik">Sertifika ve nakde çevirme</h2>
      <p class="metin">Ürünler seri numaralı sertifikalı ambalajında teslim edilir; ambalajdan çıkarılmaması önerilir. Mağazamızda anlık alış fiyatımızdan ya da Türkiye genelindeki sarraf ve kuyumcularda nakde çevrilebilir.</p>
      <h2 class="bolum-baslik">İptal ve iade</h2>
      <p class="metin">Kıymetli maden fiyatı piyasaya bağlı değiştiğinden siparişler kesin siparişdir; Mesafeli Sözleşmeler Yönetmeliği m.15/1-a gereği cayma hakkı kullanılamaz. <a href="#sozlesme/iptal-ve-iade">Koşullar</a></p>

      ${benzer.length ? `<h2 class="bolum-baslik">Benzer ürünler</h2>${izgara(benzer)}` : ""}`;
    const tuk = () => kutu.classList.toggle("tukendi", !!fiyat(p)?.tukendi);
    $(".urun-fiyat-buyuk", kutu).dataset.hesap = "1";
    $(".urun-fiyat-buyuk", kutu).addEventListener("tazele", tuk);
    tuk();
    // Galeri noktaları
    const ray = $(".galeri-ray", kutu), nok = $$(".galeri .slayt-nokta button", kutu);
    if (nok.length) {
      const isaret = () => nok.forEach((n, i) => n.classList.toggle("aktif", i === Math.round(ray.scrollLeft / ray.clientWidth)));
      ray.addEventListener("scroll", isaret, { passive: true });
      nok.forEach((n) => n.addEventListener("click", () => ray.scrollTo({ left: Number(n.dataset.i) * ray.clientWidth, behavior: "smooth" })));
      isaret();
    }
    $("[data-paylas]", kutu).addEventListener("click", async (e) => {
      const url = dis("/urun/" + p.slug);
      try {
        if (navigator.share) await navigator.share({ title: `Tempo ${p.ad}`, text: `Tempo ${p.ad} — güncel fiyatını görüntüle`, url });
        else { await navigator.clipboard.writeText(url); e.target.textContent = "Bağlantı kopyalandı"; }
      } catch {}
    });
    bitir(kutu);
  });

  // ======================================================================
  // BÜTÇE — #butce?tutar=&amac=
  // ======================================================================
  const AMAC = [["yatirim", "Yatırım amaçlı"], ["hediye", "Hediye amaçlı"], ["iscilik", "En düşük marj"], ["kampanya", "Kampanyalı"]];
  T.sayfaKaydet("butce", (kutu, _, q) => {
    if (!veri.hazir) return yukleniyor(kutu);
    const tutar = Number(q.get("tutar")) || 10000;
    const amac = q.get("amac") || "yatirim";
    const satilik = veri.urunler.filter((p) => !havaleMi(p) && fiyat(p) && !fiyat(p).tukendi);
    const uygun = satilik.filter((p) => fiyat(p).satis <= tutar);
    const enGram = uygun.filter((p) => p.metal === "GOLD").sort((a, b) => b.gram - a.gram || fiyat(a).satis - fiyat(b).satis)[0];
    const havale = veri.urunler.find(havaleMi);
    const havaleGr = havale && fiyat(havale) ? Math.floor((tutar / fiyat(havale).satis) * 100) / 100 : null;
    let liste = uygun;
    if (amac === "yatirim") liste = uygun.filter((p) => p.metal === "GOLD" && p.tur !== "JEWELRY").sort((a, b) => b.gram - a.gram || fiyat(a).satis - fiyat(b).satis);
    if (amac === "hediye") liste = uygun.filter((p) => p.tur === "COIN" || p.tur === "JEWELRY").sort((a, b) => fiyat(b).satis - fiyat(a).satis);
    if (amac === "iscilik") liste = [...uygun].sort((a, b) => a.formul.satisCarpan - b.formul.satisCarpan || b.gram - a.gram);
    if (amac === "kampanya") liste = uygun.filter((p) => p.kampanya.length > 1).sort((a, b) => fiyat(b).satis - fiyat(a).satis);
    kutu.innerHTML = `
      ${ust({ kicker: "Rehberli alışveriş", baslik: "Ne kadar ayırmak istersiniz?" })}
      ${butceFormu(fmtTam.format(tutar))}
      <div class="cipler">${[1000, 2500, 5000, 10000, 25000, 50000].map((t) => `<a class="cip${t === tutar ? " aktif" : ""}" href="#butce?tutar=${t}&amac=${amac}">${fmtTam.format(t)}</a>`).join("")}</div>
      <div class="ozet-kartlar">
        <div><small>En yüksek gramaj</small>${enGram ? `<b>${esc(enGram.ad)}</b><span>${f(enGram.slug, "duz")}</span><a href="#urun/${enGram.slug}">İncele ›</a>` : `<b>Bu bütçeye ürün yok</b>`}</div>
        <div><small>Hesaba altın havale</small><b>${havaleGr !== null ? `${fmtGr.format(havaleGr)} gr altın` : "—"}</b><span>Fiziki teslimatsız, en düşük marj; küsuratlı gram alınabilir.</span>${havale ? `<a href="#urun/${havale.slug}">Başla ›</a>` : ""}</div>
        <div><small>Bütçeye uygun ürün</small><b>${uygun.length}</b><span>${tl(tutar)} ve altında, stokta ve fiyatı geçerli ürün.</span></div>
      </div>
      <div class="segment segment-4" role="tablist">${AMAC.map(([v, a]) => `<a role="tab" aria-selected="${v === amac}" href="#butce?tutar=${tutar}&amac=${v}">${a}</a>`).join("")}</div>
      ${izgara(liste)}`;
    butceFormuBagla(kutu, amac);
    bitir(kutu);
  });

  // ======================================================================
  // HEDİYELİK — #hediyelik?vesile=&tutar=
  // ======================================================================
  const VESILE_METIN = {
    dugun: "Takıda gelenek: Tam, Ata ve Reşat altın, 22 ayar bilezik.", "yeni-dogan": "Hoş geldin hediyesi: çeyrek altın ve küçük gramaj külçe.",
    "dogum-gunu": "Değeri kalıcı bir hediye: gram külçe veya ziynet.", yildonumu: "Birlikte geçen yıllara: bilezik ya da sertifikalı külçe.",
    mezuniyet: "Yeni başlangıçlara: ilk birikim için gram külçe.", kurumsal: "Çalışanlarınıza ve iş ortaklarınıza; toplu siparişte kurumsal fatura.",
  };
  T.sayfaKaydet("hediyelik", (kutu, _, q) => {
    if (!veri.hazir) return yukleniyor(kutu);
    const vesile = VESILE.some(([v]) => v === q.get("vesile")) ? q.get("vesile") : "dugun";
    const tutar = Number(q.get("tutar")) || 7500;
    const liste = veri.urunler.filter((p) => p.metal === "GOLD" && !havaleMi(p) && fiyat(p) && !fiyat(p).tukendi && fiyat(p).satis <= tutar)
      .sort((a, b) => fiyat(b).satis - fiyat(a).satis);
    kutu.innerHTML = `
      ${ust({ kicker: "Hediyelik altın", baslik: "Geleneğin ağırlığı, sertifikanın güveni.", metin: "Tam ve Ata altın, 22 ayar bilezik veya sertifikalı külçe. Hediye notu ekleyin; pakete fiyatlı belge konmaz, doğrudan alıcıya sigortalı ve kimlik ibrazıyla teslim edilir." })}
      <div class="cipler kaydir">${VESILE.map(([v, a]) => `<a class="cip${v === vesile ? " aktif" : ""}" href="#hediyelik?vesile=${v}&tutar=${tutar}">${a}</a>`).join("")}</div>
      <p class="ekran-alt">${VESILE_METIN[vesile]}</p>
      <div class="alan-etiket">Bütçe</div>
      <div class="cipler">${[2500, 5000, 7500, 15000, 30000, 60000].map((t) => `<a class="cip kucuk${t === tutar ? " aktif" : ""}" href="#hediyelik?vesile=${vesile}&tutar=${t}">${fmtTam.format(t)} ₺</a>`).join("")}</div>
      ${izgara(liste)}
      ${bilgiKart([["Hediye notu ve ambalaj", "Ödeme adımında not ekleyin; sertifikalı ambalaj ve kart ile gönderilir, fiyat içeren belge pakete konmaz."],
        ["Alıcıya doğrudan teslim", "Teslimat adresi olarak alıcının adresini girin; sigortalı gönderim, kimlik ibrazıyla teslim."],
        ["Kurumsal fatura", `Fatura adımında “Kurumsal” seçin; toplu siparişler için bizi arayın: <a href="${TEL.href}">${TEL.metin}</a>.`]])}`;
    bitir(kutu);
  });

  // ======================================================================
  // HİZMETLER ve hizmet sayfaları
  // ======================================================================
  T.sayfaKaydet("hizmetler", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Hizmetler", baslik: "Altını sizin ritminizde.", metin: "Alıp elden teslim alın, bugünden alıp sonra alın, hesabınıza gram gönderin ya da hesabınızdakini külçeye çevirin." })}
      <div class="hizmet-kartlar">${[
        ["gel-al", "Gel Al", "İnternetten alın, mağazadan alın.", "Fiyat kilitli sipariş; hazır olunca bildirilir, kimlikle teslim.", "/marka/kulce/gold/10g.webp"],
        ["vadeli-altin", "Vadeli Altın", "Bugün alın, vadesinde teslim alın.", "15–90 gün vade; vadeye göre %3,00’e varan indirim.", "/marka/kulce/gold/50g.webp"],
        ["urunler/hesaba-altin-havale", "Hesaba Altın Havale", "Fiziki teslimatsız, küsuratlı gram.", "Altın hesabınıza IBAN’la 0,01 gr hassasiyetinde havale; aynı gün.", "/marka/kulce/gold/1g.webp"],
        ["hesaptan-fiziki-altin", "Hesaptan Fiziki Altına", "Hesaptaki gram, elinizde külçe.", "Banka altın hesabınızdaki gramı sertifikalı külçeye çevirin.", "/marka/kulce/gold/5g.webp"],
        ["duzenli-birikim", "Düzenli Birikim", "Her ay bir külçe.", "Ürünü ve sıklığı seçin; her dönem o günün fiyatıyla alınır.", "/marka/kulce/gold/2.5g.webp"],
      ].map(([h, k, b, m, g]) => `<a href="#${h}"><div><span class="kicker">${k}</span><b>${b}</b><small>${m}</small><span class="slayt-dugme">İncele →</span></div><img loading="lazy" src="${gorsel(g)}" alt=""></a>`).join("")}</div>`;
  });

  T.sayfaKaydet("gel-al", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Gel Al", baslik: "Sipariş internetten, teslim mağazadan.", metin: "Siparişinizi canlı fiyattan verin; fiyat o anda kilitlenir. Ürününüz hazırlanır, “hazır” bildirimi gelir, mağazamızdan kimliğinizle teslim alırsınız. Kargo yok, sürpriz yok.",
        dugmeler: icLink("urunler/gram-kulce-altin", "Ürünleri gör") + icLink("iletisim", "Mağaza adresi", "dugme ikincil") })}
      <div class="kart magaza-bilgi"><span class="kicker">Mağaza</span><b>Tempo Altın Mağazası</b><p>Mahir İz Cad. No: 18-A1, Altunizade — Üsküdar / İstanbul</p><small>${SAATLER}</small></div>
      ${adimlar([["Sipariş verin", "Ürünü sepete ekleyin; ödemede teslimat yöntemi olarak Gel Al’ı seçin. Kart ya da havale — fiyat kilitlenir."],
        ["Hazırlandı bildirimi", "Siparişiniz hazırlanır; SMS ve e-posta ile “hazır” bildirimi gelir."],
        ["Mağazaya gelin", "Çalışma saatleri içinde mağazamıza gelin; sipariş numaranız ve kimliğiniz yeterli."],
        ["Kimlikle teslim", "Teslimat yalnızca sipariş sahibine, kimlik ibrazıyla yapılır; sertifikalı ambalaj elinizde kontrol edilir."]])}
      ${bilgiKart([["Fiyat kilidi", "Ödemeye geçtiğiniz anda fiyat 3 dakika sabitlenir; sipariş oluşunca o fiyat sizindir. Mağazaya geldiğinizde piyasa ne olursa olsun aynı tutar."],
        ["Stoktan hemen", "Gel Al siparişleri mağaza stokundan ayrılır. Hazır bildirimini almadan gelmenize gerek yok."],
        ["Kimlik tespiti", "Kıymetli maden satışı 5549 sayılı Kanun kapsamındadır; teslimde kimlik ibrazı zorunludur. Bir başkası adına teslim yapılmaz."]])}
      ${sss([["Ne kadar süre bekler?", "Kartla ödenen siparişler 3 iş günü, havale ile ödenen siparişler ödeme onayından itibaren 3 iş günü mağazada bekletilir. Süre içinde alınmayan siparişler için sizi ararız; iade koşulları için Ön Bilgilendirme Formu geçerlidir."],
        ["Bir başkası benim yerime alabilir mi?", "Hayır. Kimlik tespiti nedeniyle teslimat yalnızca sipariş sahibine yapılır."],
        ["Mağazada ek ürün alabilir miyim?", "Elbette; mağaza fiyatları canlı piyasadan hesaplanır, aynı gün alış-satış yapabilirsiniz."]])}
      <div class="dugmeler son">${icLink("urunler/gram-kulce-altin", "Ürünleri gör")}</div>`;
  });

  const VADE = [[15, 0.5], [30, 1], [45, 1.75], [60, 2], [90, 3]];
  T.sayfaKaydet("vadeli-altin", (kutu) => {
    const ornek = veri.urun.get("tempo-50-gr-kulce-altin-999-9");
    kutu.innerHTML = `
      ${ust({ kicker: "Vadeli Altın", baslik: "Bugün alın, vadesinde teslim alın.", metin: "Altını bugünkü fiyattan alın, 15–90 gün vade seçin; vade uzadıkça sipariş tutarından %0,50’den %3,00’e varan indirim. Fiyat ve gramaj sipariş anında sabitlenir; vadede piyasa ne olursa olsun aynı tutarla teslim.",
        dugmeler: icLink("urunler/gram-kulce-altin", "Ürün seçin") })}
      <div class="vade-tablo">${VADE.map(([g, y]) => `<div><small>Vade</small><b>${g} gün</b><span>−%${fmt2.format(y)}</span></div>`).join("")}</div>
      <p class="bilgi" data-vade-ornek></p>
      ${adimlar([["Ürünü seçin", "Külçe, ziynet ya da gümüş; sepete ekleyin ve ödemeye geçin."],
        ["Teslimat zamanını seçin", "Ödeme adımındaki “Teslimat zamanı”nda 15, 30, 45, 60 ya da 90 günü işaretleyin; indirim anında toplamdan düşer."],
        ["Bugün ödeyin", "Kart ya da havale ile tamamı bugünkü fiyattan ödenir; sipariş numaranız ve teslim tarihi e-postanızda."],
        ["Günü gelince teslim", "Seçtiğiniz sürenin sonunda sigortalı kargo, Gel Al ya da altın hesabı — ödeme adımında seçtiğiniz yöntemle."]])}
      ${sss([["Teslim tarihinden önce alabilir miyim?", "Evet; ancak süre kısalırsa indirim, kısalan süreye karşılık gelen plana göre yeniden hesaplanır ve fark tahsil edilir. Bunun için müşteri hizmetlerimizle görüşmeniz yeterli."],
        ["Fiyat düşerse ne olur?", "Fiyat ve gramaj sipariş anında sabitlenir; yükselirse de düşerse de siparişiniz aynı tutarla teslim edilir. İndirim bunun karşılığıdır."],
        ["Ürünüm nerede bekliyor?", "Siparişiniz stoktan ayrılır ve teslim tarihine kadar sigortalı kasada tutulur; seri numarası sipariş anında size bildirilir."],
        ["Vazgeçersem?", "Kıymetli maden siparişlerinde cayma hakkı bulunmaz (Mesafeli Sözleşmeler Yönetmeliği m.15). Sipariş, teslim tarihinde teslim edilir."]])}`;
    // Örnek: 50 g külçe, 90 gün — canlı fiyatla
    const yaz = $("[data-vade-ornek]", kutu);
    yaz.dataset.hesap = "1";
    const hesapla = () => {
      const fi = ornek && veri.hazir && fiyat(ornek);
      yaz.innerHTML = fi ? `Örnek: bugün <b>${tl(fi.satis)}</b> tutarındaki 50 g külçede 90 gün seçilirse indirim <b>${tl(fi.satis * 0.03)}</b>. İndirim, kilitli ara toplam üzerinden ödeme adımında uygulanır.`
        : "İndirim, kilitli ara toplam üzerinden ödeme adımında uygulanır.";
    };
    yaz.addEventListener("tazele", hesapla);
    hesapla();
  });

  // Düzenli Birikim simülatörü: ürün × sıklık × süre (sitedeki gibi)
  const BIRIKIM_URUN = [["tempo-1-gr-kulce-altin-999-9", "1 g külçe"], ["tempo-2-5-gr-kulce-altin-999-9", "2,5 g külçe"], ["tempo-5-gr-kulce-altin-999-9", "5 g külçe"],
    ["tempo-10-gr-kulce-altin-999-9", "10 g külçe"], ["tempo-20-gr-kulce-altin-999-9", "20 g külçe"], ["tempo-50-gr-kulce-altin-999-9", "50 g külçe"],
    ["ceyrek-altin-yeni-tarihli", "Çeyrek Altın"], ["yarim-altin-yeni-tarihli", "Yarım Altın"], ["tam-altin-yeni-tarihli", "Tam Altın"]];
  const SIKLIK = [["WEEKLY", "Her hafta", 52 / 12], ["BIWEEKLY", "2 haftada bir", 26 / 12], ["MONTHLY", "Her ay", 1]];
  T.sayfaKaydet("duzenli-birikim", (kutu) => {
    const d = { urun: BIRIKIM_URUN[0][0], siklik: "MONTHLY", ay: 12 };
    kutu.innerHTML = `
      ${ust({ kicker: "Düzenli Birikim", baslik: "Kartınızı bağlayın, her ay bir külçe gelsin.", metin: "Ürünü ve sıklığı seçin, bir kez kartınızı ekleyin. Her dönem o günün fiyatıyla alınır ve o dönemin külçesi size kargolanır — adınıza altın tutmayız, bakiye yoktur. 3 gün önce haber veririz; dilediğiniz an durdurursunuz." })}
      <div class="kart sim" data-hesap="1">
        <div class="alan-etiket">Ürün</div>
        <div class="secici" data-sim="urun" role="radiogroup">${BIRIKIM_URUN.map(([s, a]) => `<button type="button" role="radio" data-v="${s}">${a}</button>`).join("")}</div>
        <div class="alan-etiket">Sıklık</div>
        <div class="secici" data-sim="siklik" role="radiogroup">${SIKLIK.map(([v, a]) => `<button type="button" role="radio" data-v="${v}">${a}</button>`).join("")}</div>
        <label class="alan"><span class="alan-etiket" data-sim-sure></span><input type="range" min="3" max="36" value="12" data-sim-ay><span class="aralik"><span>3 ay</span><span>36 ay</span></span></label>
        <div class="sim-sonuc">
          <div><small data-sim-ay-metin></small><b data-sim-gram></b><span data-sim-ozet></span></div>
          <div><small>Dönem başı</small><b data-sim-donem></b><span>Teslimat: her dönem kargoyla size</span></div>
        </div>
        <a class="dugme buyuk" data-sim-kur target="_blank" rel="noopener">Bu planı kur — tempoaltin.com <span aria-hidden="true">↗</span></a>
        <p class="dipnot">Fiyatlar anlık; her dönem o günün fiyatıyla kartınızdan tahsil edilir. 3 gün önce haber veririz, dilediğiniz an durdurursunuz.</p>
      </div>
      <h2 class="bolum-baslik">Nasıl çalışır?</h2>
      ${adimlar([["Planı kurun", "Ürün, adet, sıklık ve süreyi seçin; kartınızı ve adresinizi bir kez ekleyin."],
        ["3 gün önce haber verelim", "E-posta ve SMS ile tahsilat tarihini ve o günkü fiyatı bildiririz; dilerseniz dönemi atlarsınız."],
        ["Dönem günü tahsil edelim", "O günün fiyatıyla kartınızdan çekilir, siparişiniz oluşur, külçeniz hazırlanır."],
        ["Külçeniz kapınızda", "Her dönemin külçesi ayrı kargolanır: sertifikalı, sigortalı, yalnızca size. Plan bir sonraki döneme geçer."]])}
      ${bilgiKart([["Kart güvende", "Kart numarası bizde değil, lisanslı ödeme kuruluşunda saklanır; her tahsilattan önce haber veririz."],
        ["Esnek", "Haftalık, iki haftada bir ya da aylık; istediğiniz gün. Duraklat, atla, iptal et — ücretsiz."],
        ["Elinizde altın", "Bakiye tutmayız; her dönemin külçesi seri numaralı sertifikasıyla kargolanır, kasanıza girer."],
        ["Sigortalı teslimat", "Bedelinin tamamı üzerinden sigortalı; yalnızca size, kimlik ibrazıyla. Mağazadan teslim de mümkün."]])}
      <section class="kart blok vurgu">
        <span class="kicker">Neden düzenli?</span>
        <h2>Zamanı lehinize çevirin.</h2>
        <p>Tek seferde büyük alım, o günün fiyatına bağlı kalır. Düzenli alımda yükselişte az, düşüşte çok gram alırsınız; ortalama maliyetiniz dengelenir ve birikim disiplini kendiliğinden kurulur.</p>
        <ul class="madde"><li>Küçük tutarlarla başlayın; 1 g külçeden itibaren.</li><li>Her dönem elinizde fiziki, sertifikalı altın.</li><li>Dilediğiniz zaman mağazamızda alış fiyatımızdan geri satın.</li></ul>
        <p class="dipnot">Geçmiş performans geleceği garanti etmez.</p>
      </section>
      ${sss([["Kartımdan nasıl tahsilat yapılır?", "Planı kurarken kartınızı bir kez eklersiniz; kart numarası bizde değil, lisanslı ödeme kuruluşunda saklanır. Dönem günü o günün fiyatıyla tahsilat yapılır, siparişiniz oluşur ve külçeniz hazırlanır. Tahsilattan 3 gün önce e-posta ve SMS ile bilgilendirilirsiniz."],
        ["Kartımda bakiye yoksa ne olur?", "Tahsilat yapılamazsa size haber verir, üç gün üst üste yeniden deneriz. Yine olmazsa o dönem için size ödeme bağlantısı gönderilir; 7 gün içinde ödemezseniz dönem atlanmış sayılır ve plan bir sonraki dönemle devam eder."],
        ["Bir dönemi atlayabilir miyim?", "Evet. 3 gün önce gelen bildirimden ya da Hesabım › Düzenli Birikim’den dönemi atlayabilir veya planı duraklatabilirsiniz; o dönem için tahsilat yapılmaz."],
        ["Fiyat nasıl belirlenir?", "Her dönem o günün canlı fiyatından alırsınız; ödeme sayfasında gördüğünüz fiyat kısa süre sabitlenir. Yükseliş ve düşüşler zamana yayıldığı için ortalama maliyetiniz dengelenir."],
        ["Altınım sizde mi birikiyor?", "Hayır. Sizin adınıza altın tutmayız; her dönemin külçesi tahsilatın ardından hazırlanır ve sertifikasıyla size kargolanır. Elinizde fiziki, sertifikalı altın birikir."],
        ["Ürünler nasıl teslim edilir?", "Her dönemin külçesi sertifikasıyla, içeriği belli olmayan ambalajda ve tam sigortalı olarak yalnızca size, kimlik ibrazıyla teslim edilir. Kargo takibini Hesabım › Düzenli Birikim ve Sipariş Takip’ten izlersiniz."],
        ["Planı durdurabilir miyim?", "Evet. Hesabım › Düzenli Birikim’den dilediğiniz an duraklatır, devam ettirir ya da iptal edersiniz. Ceza ya da ücret yoktur."],
        ["Birden fazla plan kurabilir miyim?", "Evet, en fazla 5 aktif plan. Örneğin her hafta 1 g külçe ve her ay bir çeyrek altın."]])}
      <p class="dipnot">Sorunuz için <a href="${TEL.href}">${TEL.metin}</a> · ${SAATLER}</p>`;
    const sim = $(".sim", kutu);
    const hesapla = () => {
      $$("[data-sim=urun] button", sim).forEach((b) => b.setAttribute("aria-checked", b.dataset.v === d.urun));
      $$("[data-sim=siklik] button", sim).forEach((b) => b.setAttribute("aria-checked", b.dataset.v === d.siklik));
      const s = SIKLIK.find((x) => x[0] === d.siklik);
      const donem = Math.max(1, Math.round(d.ay * s[2]));
      $("[data-sim-sure]", sim).textContent = `Süre · ${d.ay} ay · ${donem} dönem`;
      $("[data-sim-ay-metin]", sim).textContent = `${d.ay} ay sonunda`;
      const p = veri.urun.get(d.urun), fi = p && veri.hazir && fiyat(p);
      const ad = BIRIKIM_URUN.find((x) => x[0] === d.urun)[1];
      $("[data-sim-gram]", sim).textContent = p ? `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 3 }).format(donem * p.gram)} gr` : "—";
      $("[data-sim-ozet]", sim).textContent = fi ? `${donem} × ${ad} · bugünkü fiyatla ${fmtTam.format(donem * fi.satis)} ₺` : `${donem} × ${ad}`;
      $("[data-sim-donem]", sim).textContent = fi ? `${fmtTam.format(fi.satis)} ₺` : "—";
      $("[data-sim-kur]", sim).href = dis(`/giris?next=${encodeURIComponent(`/hesap/birikim/yeni?urun=${d.urun}&siklik=${d.siklik}&donem=${donem}`)}`);
    };
    $$("[data-sim] button", sim).forEach((b) => b.addEventListener("click", () => { d[b.parentElement.dataset.sim] = b.dataset.v; hesapla(); }));
    $("[data-sim-ay]", sim).addEventListener("input", (e) => { d.ay = Number(e.target.value); hesapla(); });
    sim.addEventListener("tazele", hesapla);
    hesapla();
  });

  T.sayfaKaydet("hesaptan-fiziki-altin", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Hesaptan Fiziki Altına", baslik: "Hesaptaki gram, elinizde külçe.", metin: "Bankadaki altın hesabınızda duran gramı Tempo’nun altın hesabına aktarın; karşılığını sertifikalı külçe olarak mağazamızdan elden ya da sigortalı kargoyla teslim alın. İşçilik ve sertifika bedeli gramaja göre belirlenir, aramada netleşir." })}
      ${adimlar([["Talep bırakın", "Talep formunu doldurun: banka, gram, teslim tercihi. Ekibimiz sizi arar."],
        ["Transfer bilgileri", "Aramada Tempo’nun altın hesabı bilgileri, gramaj eşleşmesi (örn. 12,50 gr → 10 g + 2,5 g külçe) ve işçilik bedeli netleşir."],
        ["Gramı aktarın", "Bankanızdan altın transferini yapın; gram Tempo hesabına düşünce siparişiniz oluşturulur ve seri numarası bildirilir."],
        ["Teslim alın", "Gel Al ile mağazadan kimliğinizle ya da sigortalı kargoyla adresinize."]])}
      <section class="kart blok">
        <span class="kicker">Talep formu</span>
        <h2>Sizi arayalım.</h2>
        <p>Talebiniz doğrudan operasyon ekibimize gider; ${SAATLER} içinde döneriz. Bu form bir sipariş değildir, ödeme istemez. Formda ad soyad, cep telefonu, e-posta, banka, gram ve teslim tercihi (Gel Al / sigortalı kargo) sorulur.</p>
        <div class="dugmeler">${disLink("/hesaptan-fiziki-altin#talep", "Talep oluştur")}<a class="dugme ikincil" href="${TEL.href}">Ara: ${TEL.metin}</a></div>
      </section>
      ${sss([["Küsuratlı gramım var, ne olur?", "Külçe gramajlarına (1, 2,5, 5, 10, 20, 50, 100 g…) bölünür; kalan küsurat mağazada nakit olarak ödenir ya da hesabınızda bırakılır — aramada birlikte karar verirsiniz."],
        ["Hangi bankalardan transfer olur?", "Altın hesabı açan tüm bankalardan altın transferi (gram cinsinden) yapılabilir; işlem bankanızın altın transfer saatlerine tabidir."],
        ["Ücret var mı?", "Külçe işçilik ve sertifika bedeli gramaja göre belirlenir; sitede yazılı külçe fiyatlarındaki işçilik kalemiyle aynıdır. Transfer masrafı bankanıza aittir."],
        ["Kimlik gerekir mi?", "Evet; kıymetli maden teslimi 5549 sayılı Kanun kapsamında kimlik tespitine tabidir."]])}`;
  });

  // Kampanya bitişi 31.10.2026 — kalan gün sitedeki gibi
  const kalanGun = (t) => Math.max(0, Math.ceil((new Date(t + "T23:59:59+03:00") - new Date()) / 864e5));
  T.sayfaKaydet("kampanyalar", (kutu) => {
    const kalan = kalanGun("2026-10-31");
    kutu.innerHTML = `
      ${ust({ kicker: "Kampanyalar", baslik: "Açık koşul, net indirim.", metin: "Kampanya indirimi ödeme adımında toplamdan anında düşer; ücretsiz teslimat kampanyaları kargo ve kurye ücretini sıfırlar. Koşullar her kampanyada açıkça yazılı, sürpriz yok.",
        dugmeler: icLink("urunler/gram-kulce-altin", "Alışverişe başla") + icLink("duzenli-birikim", "Düzenli Birikim", "dugme ikincil") })}
      <div class="kampanyalar">
        <article class="kart"><span class="kampanya-deger">250,00 ₺<small>indirim</small></span><h2>İlk Siparişine 250 ₺ İndirim</h2><p>5.000 ₺ ve üzeri ilk siparişinde 250 ₺ indirim.</p>
          <div class="etiketler"><span>ilk sipariş</span><span>5.000,00 ₺ ve üzeri</span><span>kişi başı 1</span></div>
          <small>${kalan ? `${kalan} gün kaldı` : "Sona erdi"} · 31.10.2026</small>${icLink("urunler/gram-kulce-altin", "Ürünlere git")}</article>
        <article class="kart"><span class="kampanya-deger">%2,00<small>indirim</small></span><h2>Havale/EFT ile Gümüşte %2 İndirim</h2><p>Gümüş külçe siparişlerinde havale/EFT ile ödemede %2 indirim (en fazla 2.000 TL).</p>
          <div class="etiketler"><span>gümüş</span><span>havale/EFT ile</span><span>kişi başı 3</span></div>
          <small>${kalan ? `${kalan} gün kaldı` : "Sona erdi"} · 31.10.2026</small>${icLink("urunler/gram-kulce-gumus", "Ürünlere git")}</article>
      </div>
      <section class="kart blok vurgu"><span class="kicker">Düzenli Birikim</span><h2>Kampanya beklemeden her ay altın.</h2><p>Ürünü ve sıklığı seçin, kartınızı bağlayın; her dönem o günün fiyatıyla alınır, sertifikalı külçeniz sigortalı gelir. Dilediğiniz an durdurun.</p>${icLink("duzenli-birikim", "Nasıl çalışır?", "dugme ikincil")}</section>
      <section class="kart blok vurgu"><span class="kicker">Vadeli Altın</span><h2>Beklemenin karşılığı: %3,00’e varan indirim.</h2><p>Bugünkü fiyattan alın, 15–90 gün sonra teslim alın; süreye göre indirim ödeme adımında toplamdan düşer.</p>
        <div class="etiketler">${VADE.map(([g, y]) => `<span>${g} gün · −%${fmt2.format(y)}</span>`).join("")}</div>${icLink("vadeli-altin", "Nasıl çalışır?", "dugme ikincil")}</section>`;
  });

  T.sayfaKaydet("kargo-ve-teslimat", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Teslimat", baslik: "Kargo ve Teslimat" })}
      <div class="bilgi-kartlar tek">${[
        ["Sigortalı kargo (ücretsiz)", "Hafta içi 16:00’a kadar ödemesi onaylanan siparişler aynı gün, tam sigortalı olarak kargoya verilir. Teslimat bölgeye göre 1–3 iş günüdür. Paketler içeriği belli olmayan güvenli ambalajla gönderilir."],
        ["Moto kurye (İstanbul)", "İstanbul’un belirli bölgelerinde, 200.000 ₺ altı siparişlerde aynı gün teslimat."],
        ["Zırhlı araç", "Yüksek tutarlı ve kurumsal siparişlerde zırhlı araç teslimatı planlanır; ekibimiz sizinle iletişime geçer."],
        ["Mağazadan teslim", `Mahir İz Cad. No: 18-A1, Altunizade — Üsküdar / İstanbul adresindeki mağazamızdan, randevu ile. ${SAATLER}. <a href="#gel-al">Gel Al</a>`],
        ["Teslimatta kimlik", "Teslimat yalnızca sipariş sahibine, kimlik ibrazı ile yapılır. Üçüncü kişilere teslim edilmez."],
        ["Hasarlı paket", "Paketi teslim alırken kontrol edin; hasar varsa kargo görevlisine tutanak tutturup teslim almayın ve bize bildirin."],
      ].map(([b, m]) => `<div><b>${b}</b><small>${m}</small></div>`).join("")}</div>`;
  });

  T.sayfaKaydet("hakkimizda", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Kurumsal", baslik: "Hakkımızda", metin: "Tempo Teknoloji Ticaret Anonim Şirketi, 1988’den bu yana kıymetli maden alanında biriken tecrübeyi dijitale taşımak için kurulmuştur. Sertifikalı külçe altın, gümüş, ziynet ve 22 ayar takı ürünlerini şeffaf fiyatlarla, kurumsal güvence altında sunuyoruz." })}
      <img class="genis-gorsel" loading="lazy" src="${gorsel("/marka/magaza.webp", 1080)}" alt="Tempo Altın mağazası">
      <h2 class="bolum-baslik">Sertifikalı ürün güvencesi</h2>
      <p class="metin">Külçelerimiz, T.C. Hazine ve Maliye Bakanlığı Darphane Genel Müdürlüğü onaylı ve Borsa İstanbul Kıymetli Madenler Piyasası’nda işlem yetkisi bulunan rafinerilerin sertifikalı üretimidir. 24 ayar külçelerde yalnızca LBMA (London Bullion Market Association) akreditasyonlu üreticilerin ürünleri Tempo güvencesiyle sunulur; her külçe seri numaralı sertifikası ve blister ambalajıyla teslim edilir. Ziynet altınlar ile 22 ayar bilezik ve takılarımız ayar damgalı, sertifikalı ve orijinal ürün garantisiyle satılır.</p>
      <h2 class="bolum-baslik">Şeffaf fiyatlama</h2>
      <p class="metin">Her ürünün fiyatı canlı piyasa referansına göre anlık belirlenir; alış fiyatımız da her zaman görünür.</p>
      <h2 class="bolum-baslik">Güvenli teslimat</h2>
      <p class="metin">Siparişleriniz tam sigortalı olarak, yalnızca sipariş sahibine kimlik doğrulaması ile teslim edilir.</p>
      <h2 class="bolum-baslik">Yasal uyum</h2>
      <p class="metin">MASAK yükümlüsü olarak müşteri tanıma tedbirlerini eksiksiz uygular, Mücevher İhracatçıları Birliği üyesi olarak sektör standartlarına bağlı çalışırız.</p>
      <div class="dugmeler son">${icLink("iletisim", "İletişim")}</div>`;
  });

  T.sayfaKaydet("siparis-takip", (kutu) => {
    kutu.innerHTML = `
      ${ust({ kicker: "Sipariş takip", baslik: "Siparişiniz nerede?", metin: "Ödemeden teslimata her adım kayıt altında. Sipariş numaranız ve siparişteki telefonla anlık durumu görün." })}
      <section class="kart blok">
        <p>Sorgulama tempoaltin.com’da yapılır: <b>sipariş no</b> (TKM202609170001 gibi) veya kargo takip no ile <b>siparişteki cep telefonu</b>. Üyelik gerekmez.</p>
        <div class="dugmeler">${disLink("/siparis-takip", "Siparişimi sorgula")}${disLink("/hesap/siparisler", "Siparişlerim", "dugme ikincil")}</div>
        <p class="dipnot">Sipariş numaranız (TKM…) onay e-postanızda, SMS’inizde ve Hesabım › Siparişlerim’de yer alır.</p>
      </section>
      <h2 class="bolum-baslik">Siparişin yolculuğu</h2>
      <ol class="yolculuk"><li>Sipariş alındı</li><li>Ödeme onaylandı</li><li>Hazırlanıyor</li><li>Paketlendi</li><li>Yolda <small>(Gel Al: Teslime hazır · Hesaba havale: Aktarılıyor)</small></li><li>Teslim edildi <small>(Hesaba havale: Hesaba geçti)</small></li></ol>
      ${bilgiKart([["Her adım kayıtlı", "Ödeme, hazırlık ve teslimat sipariş günlüğüne yazılır; siz de aynı kaydı görürsünüz."],
        ["Tam sigortalı", "Gönderiler bedelinin tamamı üzerinden sigortalı; içeriği belli olmayan ambalajla."],
        ["Yalnızca size", "Teslimat yalnızca sipariş sahibine, kimlik ibrazı ile yapılır."]])}`;
  });

  // ======================================================================
  // SÖZLEŞMELER — #sozlesme/<slug> (metinler /veri/sozlesmeler/, sitedeki gibi)
  // ======================================================================
  const SOZLESME = [["mesafeli-satis", "Mesafeli Satış Sözleşmesi"], ["on-bilgilendirme", "Ön Bilgilendirme Formu"], ["iptal-ve-iade", "İptal ve İade"],
    ["guvenlik", "Güvenlik Politikası"], ["birikim-talimati", "Düzenli Birikim Talimatı"], ["kvkk", "Gizlilik Politikası ve KVKK"], ["masak", "MASAK Bilgilendirme"],
    ["ticari-ileti", "Ticari İleti İzni"], ["uyelik-sozlesmesi", "Üyelik Sözleşmesi"], ["kullanim-kosullari", "Hüküm ve Koşullar"], ["cerez-politikasi", "Çerez Politikası"]];
  $("#daha-sozlesmeler").innerHTML = SOZLESME.map(([s, a]) => `<a href="#sozlesme/${s}">${a} <span>›</span></a>`).join("");

  // Küçük markdown: #/##/### başlık, paragraf, "- " liste, **kalın**, [bağlantı](/yol)
  function md(metin) {
    const satir = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, a, h) => {
      const s = h.match(/^\/sozlesmeler\/([\w-]+)/);
      return s ? `<a href="#sozlesme/${s[1]}">${a}</a>` : h.startsWith("/") ? `<a href="${dis(h)}" target="_blank" rel="noopener">${a}</a>` : `<a href="${h}" target="_blank" rel="noopener">${a}</a>`;
    });
    return metin.split(/\n{2,}/).map((b) => {
      b = b.trim();
      if (!b) return "";
      const h = b.match(/^(#{1,3}) (.+)/);
      if (h) return h[1].length === 1 ? "" : `<h${h[1].length} class="${h[1].length === 2 ? "bolum-baslik" : "alt-baslik"}">${satir(h[2])}</h${h[1].length}>`;
      if (/^- /.test(b)) return `<ul class="madde">${b.split(/\n(?=- )/).map((l) => `<li>${satir(l.slice(2))}</li>`).join("")}</ul>`;
      return `<p class="metin">${satir(b).replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }
  T.sayfaKaydet("sozlesme", async (kutu, [slug]) => {
    const kayit = SOZLESME.find((x) => x[0] === slug);
    if (!kayit) { T.git("daha", true); return; }
    kutu.innerHTML = `${ust({ kicker: "Sözleşmeler", baslik: kayit[1] })}<p class="bos">Yükleniyor…</p>`;
    try {
      const t = await (await fetch(`/veri/sozlesmeler/${slug}.md`)).text();
      if (kutu.dataset.sayfa !== "sozlesme") return;
      kutu.innerHTML = `${ust({ kicker: "Sözleşmeler", baslik: kayit[1] })}<article class="sozlesme">${md(t)}</article>
        <p class="dipnot">Bu metin tempoaltin.com/sozlesmeler/${slug} ile aynıdır.</p>`;
    } catch { $(".bos", kutu).textContent = "Metin alınamadı. Bağlantınızı kontrol edin."; }
  });
})();
