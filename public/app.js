/* Tempo Döviz & Altın uygulaması — kabuk + Döviz bölümü davranışı.
   (Altın bölümü altin.js'de; Lens lens.js'de.)

   Yapı: uygulama KAPI ile açılır (Döviz mi, Altın mı?). Seçilen bölümün
   kendi üst çubuğu, ekranları ve alt sekmeleri vardır. Adres çubuğu:
     #            kapı
     #doviz/kurlar, #doviz/hesapla, #doviz/lens, #doviz/ogun, #doviz/iletisim
     #altin/fiyatlar, #altin/hesapla, #altin/magaza, #altin/iletisim
   (eski #kurlar biçimi de tanınır → döviz)

   Döviz veri kaynağı sitenin kendi API'si (server.mjs üzerinden aktarılır):
     /api/rates/live                      canlı kurlar, 20 sn'de bir
     /api/rates/history?para=USD-TRY&gun=2  48 saatlik eğilim
     /api/tcmb/gecmis?parite=USD&gun=YYYY-MM-DD  o günkü TCMB kuru */

(() => {
  "use strict";

  const $ = (s, k = document) => k.querySelector(s);
  const $$ = (s, k = document) => [...k.querySelectorAll(s)];

  // ---------- Sayı biçimleme (TR) ----------
  const fmt4 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmt2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtTam = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const fmtYuzde = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSaat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
  const fmtTarihUzun = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long", timeZone: "Europe/Istanbul" });

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
  // 48,6099 → 48,<span class=kurus>60<span class=pip>99</span></span>
  // Sitede olduğu gibi: son iki hane (pip) mavi, kalanı düz.
  function fiyatHtml(n) {
    const s = fmt4.format(n);
    const i = s.lastIndexOf(",");
    const kurus = s.slice(i + 1);
    return `${s.slice(0, i)},<span class="kurus">${kurus.slice(0, 2)}<span class="pip">${kurus.slice(2)}</span></span>`;
  }

  const BAYRAK = { us: "🇺🇸", eu: "🇪🇺", gb: "🇬🇧", ch: "🇨🇭", sa: "🇸🇦", ca: "🇨🇦", au: "🇦🇺", jp: "🇯🇵", tr: "🇹🇷", se: "🇸🇪", kw: "🇰🇼", ru: "🇷🇺", cn: "🇨🇳", ae: "🇦🇪" };
  const BAYRAK_KOD = { USD: "us", EUR: "eu", GBP: "gb", CHF: "ch", SAR: "sa", CAD: "ca", AUD: "au", JPY: "jp", SEK: "se", KWD: "kw", RUB: "ru", CNY: "cn", AED: "ae" };

  // ---------- Durum ----------
  const durum = {
    kurlar: [],
    sonBasari: null,     // Date
    hata: false,
    grup: "tl",
    acik: null,          // açık (genişletilmiş) parite: "USD/TRY"
    egilim: new Map(),   // "USD-TRY" → number[]
    hesapPara: "USD",
    hesapYon: "tlden",   // "tlden" | "dovizden"
    ogunYon: "dovizden",
  };

  // ---------- Kapı ve bölümler ----------
  const TEMA_RENGI = { kapi: "#16284a", doviz: "#1b2f52", altin: "#14110c" };
  const ILK_EKRAN = { doviz: "kurlar", altin: "fiyatlar" };
  const kapi = $("#kapi");
  let bolum = "kapi";           // "kapi" | "doviz" | "altin"
  let kapiZamanlayici = null;

  function temaRengi(b) { $("#tema-rengi").setAttribute("content", TEMA_RENGI[b]); }

  // Adres çubuğunu güncelle; tarayıcı geçmişini şişirmemek için replace
  function adresYaz(b, ekran) {
    const h = b === "kapi" ? "" : `#${b}/${ekran}`;
    if (location.hash !== h) history.replaceState(null, "", h || location.pathname);
  }

  // Bölüm içinde ekran değiştir (alt sekmeler)
  function ekranAc(ad, b = bolum) {
    if (b === "kapi") return;
    const kok = $(`#bolum-${b}`);
    $$(".ekran", kok).forEach((e) => (e.hidden = e.dataset.ekran !== ad));
    const sekmeAd = ad === "lens" ? "kurlar" : ad;   // Lens'in sekmesi yok, Kurlar'ın altından açılır
    $$(".sekme", kok).forEach((s) => s.classList.toggle("aktif", s.dataset.hedef === sekmeAd));
    adresYaz(b, ad);
    window.scrollTo({ top: 0 });
    if (b === "doviz") {
      if (ad === "hesapla") hesapla();
      if (ad === "alsat") alsatHesapla();
      if (ad === "iletisim") acikMi();
      document.dispatchEvent(new CustomEvent("ekran", { detail: ad }));   // Lens dinler
    } else {
      document.dispatchEvent(new CustomEvent("altin-ekran", { detail: ad })); // altin.js dinler
    }
  }

  // Bölümü göster (kapı gizlenir)
  function bolumAc(b, ekran = ILK_EKRAN[b]) {
    clearTimeout(kapiZamanlayici);
    bolum = b;
    document.body.dataset.bolum = b;
    temaRengi(b);
    kapi.hidden = true;
    kapi.classList.remove("secildi-doviz", "secildi-altin", "gidiyor", "geliyor", "sonuyor");
    $$(".bolum").forEach((k) => (k.hidden = k.dataset.bolum !== b));
    ekranAc(ekran, b);
    document.dispatchEvent(new CustomEvent("bolum", { detail: b }));
  }

  // Kapıya dön (üst çubuktaki marka)
  function kapiAc() {
    clearTimeout(kapiZamanlayici);
    bolum = "kapi";
    document.body.dataset.bolum = "kapi";
    temaRengi("kapi");
    $$(".bolum").forEach((k) => (k.hidden = true));
    kapi.classList.remove("secildi-doviz", "secildi-altin", "gidiyor", "sonuyor");
    kapi.classList.add("geliyor");
    kapi.hidden = false;
    adresYaz("kapi");
    window.scrollTo({ top: 0 });
    document.dispatchEvent(new CustomEvent("bolum", { detail: "kapi" }));
  }

  // Kapıda seçim: dokunulan kanat kendine çekilir (CSS), kapı söner, bölüm belirir
  const azHareket = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function kanatSec(hedef) {
    if (kapi.classList.contains("gidiyor")) return;
    kapi.classList.remove("geliyor");
    kapi.classList.add("gidiyor", "secildi-" + hedef);
    temaRengi(hedef);
    if (azHareket) { bolumAc(hedef); return; }
    kapiZamanlayici = setTimeout(() => {
      kapi.classList.add("sonuyor");
      kapiZamanlayici = setTimeout(() => { kapi.classList.remove("sonuyor"); bolumAc(hedef); }, 350);
    }, 480);
  }
  // Dokunulan yerin açısı: boşluklar ≈148,5° ve ≈328,5° (ekran ekseni, y aşağı);
  // aradaki sol-üst yarı Döviz, kalan sağ-alt yarı Altın.
  $("#kapi-donen").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    let aci = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    if (aci < 0) aci += 360;
    kanatSec(aci > 148.5 && aci < 328.5 ? "doviz" : "altin");
  });
  $$(".kanat").forEach((k) => {
    k.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); kanatSec(k.dataset.bolum); } });
  });
  $$("[data-kapi]").forEach((b) => b.addEventListener("click", kapiAc));
  $$(".bolum").forEach((kok) =>
    $$("[data-hedef]", kok).forEach((s) => s.addEventListener("click", () => ekranAc(s.dataset.hedef, kok.dataset.bolum)))
  );

  // Adresten aç: "#doviz/kurlar" · eski "#kurlar" · boş → kapı
  function adrestenAc() {
    const h = location.hash.slice(1);
    if (!h) { if (bolum !== "kapi") kapiAc(); return; }
    let [b, e] = h.split("/");
    if (!ILK_EKRAN[b]) { e = b; b = "doviz"; }             // eski biçim
    const kok = $(`#bolum-${b}`);
    if (!e || !$(`.ekran[data-ekran="${e}"]`, kok)) e = ILK_EKRAN[b];
    if (b === bolum) ekranAc(e, b); else bolumAc(b, e);
  }
  window.addEventListener("hashchange", adrestenAc);

  // ---------- Canlı kurlar ----------
  const durumBtn = $("#durum");
  const durumMetin = $("#durum-metin");

  function durumYaz() {
    durumBtn.classList.remove("hata", "bekliyor");
    if (durum.hata && !durum.sonBasari) {
      durumBtn.classList.add("hata");
      durumMetin.textContent = "Bağlantı yok";
    } else if (durum.hata) {
      durumBtn.classList.add("bekliyor");
      durumMetin.textContent = "Son: " + fmtSaat.format(durum.sonBasari);
    } else if (durum.sonBasari) {
      durumMetin.textContent = "Canlı · " + fmtSaat.format(durum.sonBasari);
    } else {
      durumBtn.classList.add("bekliyor");
      durumMetin.textContent = "Bağlanıyor…";
    }
  }

  let cekiliyor = false;
  async function kurlariCek() {
    if (cekiliyor) return;
    cekiliyor = true;
    try {
      const y = await fetch("/api/rates/live", { cache: "no-store" });
      if (!y.ok) throw new Error("HTTP " + y.status);
      const veri = await y.json();
      if (!Array.isArray(veri.kurlar)) throw new Error("Beklenmeyen yanıt");
      durum.kurlar = veri.kurlar;
      durum.sonBasari = new Date();
      durum.hata = false;
      listeCiz();
      bantCiz();
      hesapla();
      alsatHesapla();
    } catch (e) {
      durum.hata = true;
    } finally {
      cekiliyor = false;
      durumYaz();
    }
  }
  durumBtn.addEventListener("click", kurlariCek);

  // 20 sn'de bir; uygulama arka plana atılınca dur, dönünce hemen çek
  let sayac = null;
  function sayacBaslat() {
    clearInterval(sayac);
    sayac = setInterval(kurlariCek, 20000);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInterval(sayac);
    else { kurlariCek(); sayacBaslat(); }
  });

  // ---------- Kayan kur bandı (sitedeki gibi) ----------
  const bantIc = $("#bant-ic");
  function bantCiz() {
    const tl = durum.kurlar.filter((k) => k.quoteCode === "TRY");
    if (!tl.length) return;
    const parca = tl.map((k) => {
      const d = k.degisimYuzde ?? 0;
      const sinif = d > 0.0001 ? "arti" : d < -0.0001 ? "eksi" : "";
      return `<span><b>${k.code}/${k.quoteCode}</b> <i>Alış</i> ${fmt4.format(k.buyRate)} <i>Satış</i> ${fmt4.format(k.sellRate)} <em class="${sinif}">${sinif === "arti" ? "▲" : sinif === "eksi" ? "▼" : ""}</em></span>`;
    }).join("");
    // İki kopya art arda: -%50 kaydırınca dikişsiz döner
    bantIc.innerHTML = parca + parca;
    bantIc.style.setProperty("--bant-sure", `${Math.max(30, tl.length * 5)}s`);
  }

  // ---------- Kur listesi ----------
  const liste = $("#kur-liste");
  const kurAnahtar = (k) => `${k.code}/${k.quoteCode}`;

  $$(".segment [role=tab]").forEach((b) =>
    b.addEventListener("click", () => {
      durum.grup = b.dataset.grup;
      $$(".segment [role=tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
      durum.acik = null;
      listeCiz();
    })
  );

  function listeCiz() {
    const secili = durum.kurlar.filter((k) => (durum.grup === "tl" ? k.quoteCode === "TRY" : k.quoteCode !== "TRY"));
    if (!secili.length) {
      liste.innerHTML = `<li class="yukleniyor">${durum.hata ? "Kurlar alınamadı. Bağlantınızı kontrol edip yenileyin." : "Kurlar yükleniyor…"}</li>`;
      return;
    }
    liste.innerHTML = secili.map((k) => {
      const a = kurAnahtar(k);
      const d = k.degisimYuzde ?? 0;
      const sinif = d > 0.0001 ? "arti" : d < -0.0001 ? "eksi" : "sabit";
      const ok = sinif === "arti" ? "▲" : sinif === "eksi" ? "▼" : "•";
      const bayrak = k.quoteCode === "TRY"
        ? `<span class="bayrak">${BAYRAK[k.flagCode] || "💱"}</span>`
        : `<span class="bayrak capraz">${k.code}<br>${k.quoteCode}</span>`;
      const acik = durum.acik === a;
      return `<li class="kur" data-kod="${a}">
        <button class="kur-satir" type="button" aria-expanded="${acik}">
          <span class="kur-ad">${bayrak}<span><span class="kur-kod">${k.code}/${k.quoteCode}</span><span class="kur-isim">${k.name}</span></span></span>
          <span class="fiyat">${fiyatHtml(k.buyRate)}<small>alış</small></span>
          <span class="fiyat">${fiyatHtml(k.sellRate)}<small class="degisim ${sinif}">${ok} %${fmtYuzde.format(Math.abs(d))}</small></span>
        </button>
        ${acik ? `<div class="kur-detay" data-detay="${a}"></div>` : ""}
      </li>`;
    }).join("");
    if (durum.acik) detayDoldur(durum.acik);
  }

  liste.addEventListener("click", (e) => {
    const satir = e.target.closest(".kur-satir");
    if (!satir) return;
    const a = satir.closest(".kur").dataset.kod;
    durum.acik = durum.acik === a ? null : a;
    listeCiz();
  });

  async function detayDoldur(a) {
    const kutu = $(`[data-detay="${a}"]`);
    if (!kutu) return;
    const k = durum.kurlar.find((x) => kurAnahtar(x) === a);
    const para = a.replace("/", "-");
    const gunc = k?.validFrom ? fmtSaat.format(new Date(k.validFrom)) : "—";
    kutu.innerHTML = `<div class="detay-ust"><span>Son 48 saat</span><span>Güncelleme <b>${gunc}</b></span></div><div class="detay-bos">Eğilim yükleniyor…</div>`;
    let degerler = durum.egilim.get(para);
    if (!degerler) {
      try {
        const y = await fetch(`/api/rates/history?para=${para}&gun=2`, { cache: "no-store" });
        const v = await y.json();
        degerler = Array.isArray(v.degerler) ? v.degerler : [];
        durum.egilim.set(para, degerler);
        setTimeout(() => durum.egilim.delete(para), 5 * 60 * 1000); // 5 dk sonra tazele
      } catch { degerler = []; }
    }
    const yine = $(`[data-detay="${a}"]`);
    if (!yine) return; // kullanıcı bu arada kapattı
    if (degerler.length < 3) {
      yine.querySelector(".detay-bos").textContent = "Eğilim için yeterli veri birikmedi.";
      return;
    }
    const min = Math.min(...degerler), max = Math.max(...degerler);
    const W = 320, H = 56, P = 3;
    const nokta = degerler.map((v, i) => {
      const x = P + (i / (degerler.length - 1)) * (W - 2 * P);
      const y = max === min ? H / 2 : P + (1 - (v - min) / (max - min)) * (H - 2 * P);
      return [x.toFixed(1), y.toFixed(1)];
    });
    const yol = nokta.map((p, i) => (i ? "L" : "M") + p.join(",")).join(" ");
    const ilk = degerler[0], son = degerler[degerler.length - 1];
    const fark = son - ilk, farkY = ilk ? (fark / ilk) * 100 : 0;
    const sinif = fark > 0 ? "arti" : fark < 0 ? "eksi" : "sabit";
    yine.innerHTML = `
      <div class="detay-ust"><span>Son 48 saat · en düşük <b>${fmt4.format(min)}</b> · en yüksek <b>${fmt4.format(max)}</b></span></div>
      <svg class="egilim" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="48 saatlik eğilim">
        <path class="alan" d="${yol} L${W - P},${H} L${P},${H} Z"/>
        <path class="cizgi" d="${yol}"/>
      </svg>
      <div class="detay-ust" style="margin-top:6px"><span>48 saatlik değişim</span><b class="degisim ${sinif}">${fark >= 0 ? "▲ " : "▼ "}${fmt4.format(Math.abs(fark))} (%${fmtYuzde.format(Math.abs(farkY))})</b></div>`;
  }

  // ---------- Hesaplama ----------
  const hesapTutar = $("#hesap-tutar");
  const hesapSonuc = $("#hesap-sonuc");
  const hesapBilgi = $("#hesap-bilgi");
  const hesapParaKutu = $("#hesap-para");

  function hesapParaCiz() {
    const tl = durum.kurlar.filter((k) => k.quoteCode === "TRY");
    if (!tl.length) { hesapParaKutu.innerHTML = ""; return; }
    hesapParaKutu.innerHTML = tl.map((k) =>
      `<button type="button" role="radio" aria-checked="${k.code === durum.hesapPara}" data-kod="${k.code}">${BAYRAK[k.flagCode] || ""} ${k.code}</button>`
    ).join("");
  }
  hesapParaKutu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kod]");
    if (!b) return;
    durum.hesapPara = b.dataset.kod;
    hesapla();
  });
  $("#hesap-cevir").addEventListener("click", () => {
    durum.hesapYon = durum.hesapYon === "tlden" ? "dovizden" : "tlden";
    // Sonucu yeni girdi yap: kullanıcı "10.000 TL → 205 USD" gördükten sonra
    // yönü çevirince 205 USD'den devam etmek ister
    const sonuc = hesapSonuc.dataset.deger;
    if (sonuc) hesapTutar.value = fmt2.format(Number(sonuc));
    hesapla();
  });
  hesapTutar.addEventListener("input", () => { tutarBicimle(hesapTutar); hesapla(); });

  function hesapla() {
    if ($("#ekran-hesapla").hidden) return;
    hesapParaCiz();
    const k = durum.kurlar.find((x) => x.code === durum.hesapPara && x.quoteCode === "TRY");
    const tlden = durum.hesapYon === "tlden";
    $("#hesap-ust-etiket").textContent = tlden ? "Tutar (TL)" : `Tutar (${durum.hesapPara})`;
    $("#hesap-alt-etiket").textContent = tlden ? `Karşılığı (${durum.hesapPara})` : "Karşılığı (TL)";
    const tutar = sayiOku(hesapTutar.value);
    if (!k || tutar === null) {
      hesapSonuc.textContent = "—";
      delete hesapSonuc.dataset.deger;
      hesapBilgi.textContent = k ? "" : "Kurlar yükleniyor…";
      return;
    }
    // Müşteri TL verip döviz alıyorsa büronun SATIŞ kuru,
    // döviz verip TL alıyorsa büronun ALIŞ kuru geçerli.
    const kur = tlden ? k.sellRate : k.buyRate;
    const sonuc = tlden ? tutar / kur : tutar * kur;
    hesapSonuc.dataset.deger = String(sonuc);
    hesapSonuc.textContent = `${fmt2.format(sonuc)} ${tlden ? durum.hesapPara : "₺"}`;
    hesapBilgi.innerHTML = tlden
      ? `<b>1 ${k.code} = ${fmt4.format(kur)} ₺</b> satış kuru üzerinden. Yüksek tutarlarda tutarınıza özel fiyat için arayın.`
      : `<b>1 ${k.code} = ${fmt4.format(kur)} ₺</b> alış kuru üzerinden. Yüksek tutarlarda tutarınıza özel fiyat için arayın.`;
  }

  // ---------- O gün kur ----------
  const OGUN_PARALAR = [
    ["USD", "Amerikan Doları"], ["EUR", "Euro"], ["GBP", "İngiliz Sterlini"], ["CHF", "İsviçre Frangı"],
    ["CAD", "Kanada Doları"], ["SAR", "Suudi Arabistan Riyali"], ["JPY", "Japon Yeni"], ["AED", "BAE Dirhemi"],
    ["KWD", "Kuveyt Dinarı"], ["SEK", "İsveç Kronu"], ["CNY", "Çin Yuanı"], ["RUB", "Rus Rublesi"],
  ];
  const ogunTarih = $("#ogun-tarih");
  const ogunPara = $("#ogun-para");
  const ogunTutar = $("#ogun-tutar");
  const ogunSonuc = $("#ogun-sonuc");
  const ogunBilgi = $("#ogun-bilgi");

  ogunPara.innerHTML = OGUN_PARALAR.map(([k, ad]) => `<option value="${k}">${BAYRAK[BAYRAK_KOD[k]] || ""} ${k} — ${ad}</option>`).join("");
  {
    // Bugün, İstanbul saatiyle
    const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
    ogunTarih.max = bugun;
    ogunTarih.value = bugun;
  }
  $("#ogun-cevir").addEventListener("click", () => {
    durum.ogunYon = durum.ogunYon === "dovizden" ? "tlden" : "dovizden";
    ogunHesapla();
  });
  ogunTarih.addEventListener("change", ogunSorgula);
  ogunPara.addEventListener("change", ogunSorgula);
  ogunTutar.addEventListener("input", () => { tutarBicimle(ogunTutar); ogunHesapla(); });

  let ogunVeri = null;
  async function ogunSorgula() {
    const gun = ogunTarih.value, parite = ogunPara.value;
    if (!gun) return;
    ogunSonuc.hidden = false;
    ogunSonuc.innerHTML = `<div class="detay-bos">TCMB kuru alınıyor…</div>`;
    ogunVeri = null;
    try {
      const y = await fetch(`/api/tcmb/gecmis?parite=${parite}&gun=${gun}`, { cache: "no-store" });
      const v = await y.json();
      if (gun !== ogunTarih.value || parite !== ogunPara.value) return; // eski yanıt
      if (!y.ok || v.hata) {
        ogunSonuc.innerHTML = `<p class="hata">${v.hata || "Kur bilgisi alınamadı."}</p>`;
        return;
      }
      ogunVeri = v;
      ogunHesapla();
    } catch {
      ogunSonuc.innerHTML = `<p class="hata">Kur bilgisi alınamadı. Bağlantınızı kontrol edin.</p>`;
    }
  }

  function ogunHesapla() {
    const dovizden = durum.ogunYon === "dovizden";
    const kod = ogunPara.value;
    $("#ogun-yon-metin").textContent = dovizden ? "Dövizden TL’ye" : "TL’den dövize";
    $("#ogun-tutar-etiket").textContent = dovizden ? `Tutar (${kod})` : "Tutar (TL)";
    if (!ogunVeri) return;
    const v = ogunVeri;
    const tutar = sayiOku(ogunTutar.value);
    // TCMB bazı paraları 100 birim üzerinden ilan eder (JPY gibi) → v.birim
    const birim = v.birim || 1;
    const karsilik = tutar === null ? null : dovizden ? (tutar * v.satis) / birim : (tutar * birim) / v.satis;
    const istenen = fmtTarihUzun.format(new Date(v.istenenGun + "T12:00:00"));
    const kurGunu = fmtTarihUzun.format(new Date(v.kurGunu + "T12:00:00"));
    ogunSonuc.innerHTML = `
      <span class="etiket">${istenen}</span>
      <div class="buyuk">${karsilik === null ? "—" : fmt2.format(karsilik)}<small>${dovizden ? "₺" : kod}</small></div>
      ${v.yedegeDusuldu ? `<p class="uyari">Bu tarihte kur ilan edilmemiş (hafta sonu/tatil); ${kurGunu} kuru kullanıldı.</p>` : ""}
      <div class="satir"><span>TCMB alış ${birim > 1 ? `(${birim} ${kod})` : ""}</span><b>${fmt4.format(v.alis)} ₺</b></div>
      <div class="satir"><span>TCMB satış ${birim > 1 ? `(${birim} ${kod})` : ""}</span><b>${fmt4.format(v.satis)} ₺</b></div>`;
    ogunBilgi.textContent = "Kaynak: TCMB gösterge kurları. Hesaplama satış kuru üzerinden yapılır.";
  }

  // ---------- Aydınlat / karart ----------
  // Seçim html[data-tema] = "acik" | "koyu"; yoksa sistem tercihi. localStorage'da kalır.
  // Yalnız Döviz bölümünü etkiler (Altın her zaman koyu).
  const temaBtn = $("#tema");
  function temaUygula(t) {
    if (t) document.documentElement.dataset.tema = t; else delete document.documentElement.dataset.tema;
    try { t ? localStorage.setItem("tema", t) : localStorage.removeItem("tema"); } catch {}
  }
  try { const t = localStorage.getItem("tema"); if (t) temaUygula(t); } catch {}
  temaBtn.addEventListener("click", () => {
    const sistemKoyu = matchMedia("(prefers-color-scheme: dark)").matches;
    const suAnKoyu = document.documentElement.dataset.tema === "koyu" || (!document.documentElement.dataset.tema && sistemKoyu);
    temaUygula(suAnKoyu ? "acik" : "koyu");
  });

  // ---------- Al / Sat ----------
  const alsatTutar = $("#alsat-tutar");
  const alsatParaKutu = $("#alsat-para");
  durum.alsatYon = "al";       // "al": müşteri döviz alır (büro SATIŞ kuru) | "sat": döviz satar (büro ALIŞ kuru)
  durum.alsatPara = "USD";

  $$("#ekran-alsat .segment [role=tab]").forEach((b) =>
    b.addEventListener("click", () => {
      durum.alsatYon = b.dataset.yon;
      $$("#ekran-alsat .segment [role=tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
      alsatHesapla();
    })
  );
  alsatParaKutu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-kod]");
    if (!b) return;
    durum.alsatPara = b.dataset.kod;
    alsatHesapla();
  });
  alsatTutar.addEventListener("input", () => { tutarBicimle(alsatTutar); alsatHesapla(); });

  function alsatHesapla() {
    if ($("#ekran-alsat").hidden) return;
    const tl = durum.kurlar.filter((k) => k.quoteCode === "TRY");
    alsatParaKutu.innerHTML = tl.map((k) =>
      `<button type="button" role="radio" aria-checked="${k.code === durum.alsatPara}" data-kod="${k.code}">${BAYRAK[k.flagCode] || ""} ${k.code}</button>`
    ).join("");
    const k = tl.find((x) => x.code === durum.alsatPara);
    const al = durum.alsatYon === "al";
    const kod = durum.alsatPara;
    $("#alsat-tutar-etiket").textContent = `Tutar (${kod})`;
    $("#alsat-kur-etiket").textContent = al ? "Tempo satış kuru" : "Tempo alış kuru";
    $("#alsat-toplam-etiket").textContent = al ? "Ödeyeceğiniz" : "Alacağınız";
    const tutar = sayiOku(alsatTutar.value);
    const bilgi = $("#alsat-bilgi");
    if (!k || tutar === null) {
      $("#alsat-kur").textContent = "—"; $("#alsat-toplam").textContent = "—";
      bilgi.textContent = k ? "" : "Kurlar yükleniyor…";
      return;
    }
    const kur = al ? k.sellRate : k.buyRate;
    const toplam = tutar * kur;
    $("#alsat-kur").textContent = `${fmt4.format(kur)} ₺`;
    $("#alsat-toplam").textContent = `${fmt2.format(toplam)} ₺`;
    bilgi.innerHTML = al
      ? `<b>${fmt2.format(tutar)} ${kod}</b> için yaklaşık <b>${fmt2.format(toplam)} ₺</b>. Yüksek tutarlarda tutarınıza özel fiyat için arayın.`
      : `<b>${fmt2.format(tutar)} ${kod}</b> karşılığında yaklaşık <b>${fmt2.format(toplam)} ₺</b>. Yüksek tutarlarda tutarınıza özel fiyat için arayın.`;
  }

  // ---------- İletişim: şu an açık mı? ----------
  function acikMi() {
    const simdi = new Date();
    const parcalar = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(simdi);
    const al = (t) => parcalar.find((p) => p.type === t)?.value;
    const gun = al("weekday"), dk = Number(al("hour")) * 60 + Number(al("minute"));
    const kapanis = gun === "Paz" ? null : gun === "Cmt" ? 15 * 60 : 18 * 60;
    const acik = kapanis !== null && dk >= 8 * 60 && dk < kapanis;
    const kutu = $("#acik-kapali");
    kutu.classList.toggle("kapali", !acik);
    if (acik) kutu.innerHTML = `Şu an açık <span>· ${String(Math.floor(kapanis / 60)).padStart(2, "0")}:00'a kadar</span>`;
    else kutu.innerHTML = `Şu an kapalı <span>· ${gun === "Cmt" ? "Pazartesi" : gun === "Paz" ? "Pazartesi" : dk < 8 * 60 ? "bugün" : gun === "Cum" ? "Cumartesi" : "yarın"} 08:00'de açılır</span>`;
  }

  // Lens gibi ek modüllerin kullanması için
  window.TempoApp = {
    get kurlar() { return durum.kurlar; },
    get sonBasari() { return durum.sonBasari; },
    get bolum() { return bolum; },
    fmt2, fmt4, fmtSaat, sayiOku, tutarBicimle, ekranAc, bolumAc, kapiAc,
  };

  // ---------- Başlat ----------
  document.body.dataset.bolum = "kapi";
  adrestenAc();
  kurlariCek();
  sayacBaslat();
  ogunSorgula();

  if ("serviceWorker" in navigator) {
    // https veya localhost dışında kayıt olmaz; hata sessizce yutulur
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // http://192.168… (eski ana ekran ikonu) ile açıldıysa: kamera burada açılmaz.
  // Sunucudan https adresini alıp üstte sarı bantla göster. Ana ekrandan
  // (standalone) açılmışsa bağlantı Safari'de açılır; ikon oradan yeniden eklenir.
  if (location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    fetch("/adres").then((r) => r.json()).then((a) => {
      if (!a.portHttps) return;
      const adres = `https://${a.ad || a.ip}:${a.portHttps}/`;
      const bant = document.getElementById("guvenli-uyari");
      const link = document.getElementById("guvenli-adres");
      link.href = adres; bant.hidden = false;
    }).catch(() => {});
  }
})();
