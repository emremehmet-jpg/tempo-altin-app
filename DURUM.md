# TEMPO ALTIN UYGULAMASI — DURUM

> Projenin canlı hafızası. Her oturumun başında okunur, her anlamlı işten
> sonra güncellenir.

**Son güncelleme:** 2 Ekim 2026 (TSİ)
**Durum:** Tempo Altın, Döviz'den AYRI bir uygulama (port 3200). 2 Eki (4):
tempoaltin.com'un içeriği uygulamaya gömüldü — vitrin, 87 ürün, 14 kategori,
ürün sayfaları (sitenin gerçek fiyatıyla), bütçe/hediyelik, hizmetler, kampanyalar,
11 sözleşme. **Sepet ve ödeme SİTEDE** (Emre'nin kararı, aşağıda Kararlar).
Emre'nin telefonda denemesi bekleniyor.

## 1. NE BU?

tempoaltin.com'un **müşteriye dönük** telefon uygulaması (PWA). Kardeş proje
`~/Desktop/tempo-doviz-app` (Tempo Döviz, port 3100; github tempo-doviz-app).
Bu klasör onun kopyasından türedi (github.com/emremehmet-jpg/tempo-altin-app);
2 Eki 2026'da kapı, Döviz bölümü ve Tempo Lens çıkarıldı, yalnız Altın kaldı.

- **GİRİŞ** — `#giris`: sıcak siyah zemin, ortada Emre'nin logosu
  (`marka/logo-altin-yatay-2400.png`, 2400×782; `arac/logo-parcala.mjs ... altin`
  ile `public/marka/altin-yazi/o/bant.png` maskelerine bölündü — Döviz logosuyla
  piksel piksel aynı geometri). Logo .6 sn'de belirir; O .65 sn'de başlayıp .75 sn'de
  bir tur + bir zıplama yapar (`@keyframes girisO`, üst çubuktaki `oZipla`'nın tek
  seferliği, zıplama O yüksekliğinin %30'u); 1,9 sn'de giriş söner (350 ms).
  Dokununca hemen geçer. Bant içindeki "ALTIN | 1988" logodaki gibi beyaz: maske
  deliğinin arkasında beyaz şerit (`.giris-bant-zemin`). Fiyatlar giriş sırasında çekilir.
- **Üst çubuk** — aynı parçalı logo (altın), O 3 sn'de bir döner+zıplar; logoya
  dokununca Fiyatlar. Sağda aydınlat/karart (`html[data-tema-altin="acik"]` krem,
  localStorage `tema-altin`; varsayılan koyu) ve canlı durum rozeti.
- **Sekmeler** — Vitrin · Ürünler · Fiyatlar · Hesapla · Daha. Üst çubukta sepet
  simgesi (tempoaltin.com/sepet açar).
  - **Vitrin** (`/`): sitenin ana sayfası — kahraman + canlı Has Altın, 6 slayt (7 sn),
    8 ürünlük vitrin, bütçe formu, özel gün çipleri, güven kartları, kategori kartları,
    Düzenli Birikim, kurumsal blok.
  - **Ürünler** (`#urunler[/kategori]?sirala=&filtre=&q=`): ana + alt kategori çipleri,
    sıralama (Önerilen/gram/fiyat), Kampanyalı/Stokta, arama (3+ haneli sayı → bütçe).
  - **Ürün** (`#urun/<slug>`): galeri, fiyat, ₺/gr, geri alış, gramaj varyantları,
    kampanya, paylaş, fiyat alarmı (site), ürün bilgileri tablosu, yasal bloklar, benzer ürünler.
    "Sepete ekle — tempoaltin.com ↗" ürünün sitedeki sayfasını açar.
  - **Fiyatlar / Hesapla**: eskisi gibi (altin.js).
  - **Daha** (`#daha`): Hesabım/Sepetim/Üye ol (site), hizmetler, alışveriş, kurumsal, 11 sözleşme.
  - Dinamik sayfalar: `#butce`, `#hediyelik`, `#hizmetler`, `#gel-al`, `#vadeli-altin`
    (canlı örnek indirim), `#duzenli-birikim` (simülatör; "Bu planı kur" siteye),
    `#hesaptan-fiziki-altin` (form sitede), `#kampanyalar` (kalan gün), `#kargo-ve-teslimat`,
    `#hakkimizda`, `#siparis-takip` (sorgu sitede), `#sozlesme/<slug>`, `#iletisim`.
  - Eski adresler: `#altin/...` → aynı ekran, `#magaza` → Ürünler.
- tempoaltin.com dili: sıcak siyah #14110c, altın #d5aa45, Instrument Serif
  başlıklar, kuruş altın renkte, gövde Anek Latin.

## 2. NASIL ÇALIŞTIRILIR

- `Başlat.command`'a çift tıkla **veya** `node server.mjs` (paket kurulumu yok).
- Mac: http://localhost:3200 · Telefon (aynı Wi-Fi): http://<ip>:3200
  (2 Eki: 192.168.1.116; sunucu açılışta güncelini yazar). https: 3201.
- Port 3200 — Döviz uygulaması 3100'de, iç panel 3000'de; hepsi yan yana çalışır.

## 3. VERİ KAYNAĞI

Sitenin kendi API'si; uygulama hiçbir veri üretmiyor.

| Uç | Ne verir | Not |
|---|---|---|
| `/api/altin/urun-fiyatlari` → **tempoaltin.com**/arama?q=a (HTML) | `{okunan, zaman, fiyatlar:{slug:{satis, gramBasi, alis, tukendi}}}` 87 ürün | 60 sn önbellek. Sitede ürün fiyatı için JSON uç YOK (fiyatlar sunucuda HTML'e basılıyor) → `server.mjs urunFiyatlariOku` kart kartı okur. Okunamazsa (biçim değişti) uygulama formüle düşer. |
| `/api/altin/gorsel?u=/urun/..&w=384\|640\|1080` → /_next/image | sitenin küçültülmüş görseli (webp) | 6 sa; yalnız /urun/ ve /marka/ yolları |
| `/api/altin/fiyatlar` → **tempoaltin.com**/api/fiyatlar | `{updatedAt, quotes:[{key,name,buy,sell,changePct}]}` 20 kalem | 30 sn'de bir, uygulama öndeyken. Anahtarlar: HAS_ALTIN GRAM_ALTIN AYAR22/18/14 CEYREK YARIM TAM ATA RESAT IKIBUCUK BESLI GREMSE GUMUS PLATIN PALADYUM USD EUR GBP CHF. Geçmiş ucu YOK (404). |

**Tempo Altın sitesi notu (19 Eyl):** Next.js e-ticaret (87 ürün, alış+satış).
Ürün fiyatı (1 gr külçe 7.479 ₺) ≠ API has altın (6.831 ₺): ürüne işçilik/
sertifika bindirilmiş. Uygulama API'deki piyasa fiyatlarını gösterir; ürün
fiyatı için siteye köprü. Sitedeki telefon/vergi no yer tutucu (000…), o
yüzden Altın iletişimde Döviz'in numaraları kullanıldı; adres aynı (Mahir İz 18/1A).

**Tuzak — CORS:** API yalnızca kendi adresinden çağrıya izin veriyor. Bu
yüzden `server.mjs` `/api/altin/*` isteklerini siteye aktarıyor (diğer `/api/` 404).
Uygulama ileride sitenin altına (`tempoaltin.com/app`) taşınırsa bu katmana gerek kalmaz;
`public/` klasörü olduğu gibi kopyalanabilir.

## 3b. SİTENİN İÇERİĞİ (2 Eki 2026 araştırması)

`kaynak/tempoaltin-site/`: RAPOR.md (sayfalar, ürünler, fiyat formülleri, sepet/ödeme,
iyzico, üyelik), urunler.json, kategoriler.json, endpoints.json (server action'lar),
sayfalar/*.md (her sayfanın tam metni). `python3 arac/katalog-uret.py` bundan
`public/veri/katalog.json` (87 ürün, 14 kategori, fiyat formülü) ve
`public/veri/sozlesmeler/*.md` üretir. Site ürün ekler/çıkarırsa araştırma tazelenip
betik yeniden çalıştırılır (fiyatlar zaten canlı).
- **Fiyat formülü (yedek):** külçe `HAS.sell × gram × saflık × (1+marj)`, gümüş
  `GUMUS.sell × gram × (1+marj)`, bilezik `HAS.sell × 0,916 × gram × 1,05`, ziynet
  `kot.sell × (1+marj)`, geri alış `kot.buy × … × 0,99`. 85/87 kuruşu kuruşuna tuttu.
- **Sepet** sitede `tk_cart` çerezi + Server Action (`addToCartAction`…); başka adresten
  eklenemez (Next.js Origin denetimi + çerez tempoaltin.com'da). **Ödeme** `/odeme`
  (giriş ister), iyzico (CSP frame-src/form-action *.iyzipay.com), dönüş `/api/odeme/callback`.
- Sitedeki telefon/vergi/MERSİS yer tutucu (000…); uygulamanın kendi sayfalarında
  İletişim'deki numara kullanıldı, sözleşme metinleri sitedeki gibi (yer tutucularıyla) bırakıldı.

## 3c. YEREL HTTPS (telefonda canlı kamera için)

Service worker (çevrimdışı açılış) yalnızca https'te çalışır. Tünel araçları (cloudflared)
indirilemedi (izin denetleyicisi engelledi); onun yerine **kendi kök
sertifikamız**: `sertifika/uret.sh` (openssl) → `ca.crt` + `server.crt`
(SAN: localhost, <mac>.local, Wi-Fi IP; 825 gün). Sunucu 3201'de https.

Telefon tarafı BİR KEZ: `http://<ip>:3200/kurulum` sayfası adım adım anlatıyor
(profil indir → Ayarlar'da yükle → Genel → Hakkında → Sertifika Güven
Ayarları → aç). Sonra `https://<ip>:3201`.
`Başlat.command` her açılışta sunucu sertifikasını tazeler (IP değişse de
kök aynı kaldığı için telefonda tekrar bir şey yapılmaz).

## 4. DOSYALAR

```
server.mjs            geliştirme sunucusu + /api/altin aktarımı (bağımlılık yok), port 3200/3201
Başlat.command        çift tıkla çalıştır
public/index.html     giriş + Altın (4 ekran)
public/app.css        görünüm (paylaşılan bileşenler + Altın paleti + giriş)
public/app.js         kabuk: giriş, adres yönlendirme (statik + dinamik ekran), sayı yardımcıları (window.TempoApp)
public/altin.js       kotasyon çekme (altin-kotasyon olayı), fiyat listesi, hesaplama, tema, açık/kapalı
public/magaza.js      vitrin, ürünler, ürün, bütçe, hediyelik, hizmetler, kampanyalar, sözleşmeler
public/veri/          katalog.json + sozlesmeler/*.md (arac/katalog-uret.py üretir)
public/manifest.webmanifest, sw.js   PWA (SURUM tempo-altin-v2)
public/marka/         altin-yazi/o/bant/tam.png — logo maske parçaları
public/ikon/          ana ekran ikonları (HENÜZ Döviz'den kalma iki kanatlı logo)
public/kurulum.html   telefon https kurulum rehberi (/kurulum)
sertifika/            uret.sh + üretilen kök/sunucu sertifikaları (paylaşma)
arac/                 logo-parcala.mjs (yatay logo → maske), katalog-uret.py, test-surucu.mjs (Brave CDP
                      ekran görüntüsü + konsol hataları; port 9343, Döviz'inki 9333 — aynı anda çalışınca karışıyordu)
kaynak/tempoaltin-site/  sitenin araştırma verisi (bkz. 3b)
marka/                logo-altin-yatay-2400.png (Emre, 2 Eki), eski logo dosyaları
```

## 5. KARARLAR

- **Altın ayrı uygulama, ayrı link (Emre, 2 Eki 2026).** Döviz'le ortak kapı yok.
- **Sitenin her şeyi uygulamada, ama sepet ve ödeme SİTEDE (Emre, 2 Eki 2026).** Seçenekler
  sunuldu: (a) sitenin iç arayüzü (server action) üzerinden uygulamada ödeme, (b) siteye
  API eklemek (kod erişimi gerekir), (c) ödeme sitede — Emre (c)'yi seçti. Sonra "sepet
  uygulamada" da mümkün olmadığı anlaşıldı (çerez/Origin), Emre "sepet sitede"yi seçti.
  Uygulama tempoaltin.com/app altına taşınınca sepet ve ödeme uygulamaya alınabilir.
- Siteye giden her şey `↗` işaretli ve yeni sekmede: sepete ekle, sepet, hesap, üye ol,
  fiyat alarmı, birikim planı kur, hesaptan fiziki talep formu, sipariş sorgulama, iletişim formu.
- **PWA, çerçevesiz (vanilla) HTML/CSS/JS**, build yok; `public/` sitenin altına konabilir.
- **Hesaplama yönü:** TL → altın SATIŞ, altın → TL ALIŞ (müşteri gözüyle).
- Alarm/sipariş/ürün listesi v1'de siteye köprü. Ürün fiyatı ≠ API fiyatı
  (işçilik/sertifika); uygulama piyasa fiyatını gösterir.
- Sitedeki telefon/vergi no yer tutucu → iletişimde Döviz'in numaraları; adres aynı.

## 6. TUZAKLAR

- Başsız Brave pencereyi en az 500 px açıyor; 390 px görüntü için sayfa bir
  iframe'e konup `arac/test-surucu.mjs` ile çekilir (test sayfası `public/_test/`e
  konur, bitince silinir).
- Service worker http://192.168.x.x'te kayıt olmaz; yalnız https veya localhost.
- Mac'in Bonjour adı değişebiliyor (2 Eki'de `Mac.hgw.local` göründü); telefonda IP'li adres güvenli.

## 7. SIRADAKİ İŞLER

1. Emre telefonda dener: giriş, vitrin, ürün sayfaları, siteye geçiş (sepete ekle → site).
2. **Ana ekran ikonu** Altın'a özel değil (Döviz'in iki kanatlı logosu); altın O ile yenilenmeli.
3. Altın'da geçmiş grafik yok (API'de geçmiş ucu yok) — istenirse sunucuda biriktirilir.
4. Yayına alma: tempoaltin.com/app veya Cloudflare Pages/Vercel (aktarma küçük fonksiyona).

## 8. OTURUM GÜNLÜĞÜ

- **2 Eki 2026 (4)** — tempoaltin.com baştan sona incelendi (alt ajan; yalnız GET; 87 ürün,
  fiyat formülleri, sepet/ödeme/iyzico, üyelik, 11 sözleşme → kaynak/tempoaltin-site/).
  Uygulamaya gömüldü: magaza.js (vitrin, ürünler, ürün, bütçe, hediyelik, hizmet sayfaları,
  birikim simülatörü, kampanyalar, sipariş takip, sözleşmeler), Daha sekmesi, sepet simgesi.
  server.mjs: /api/altin/urun-fiyatlari (sitenin gerçek fiyatları) + /api/altin/gorsel.
  Sekmeler Vitrin/Ürünler/Fiyatlar/Hesapla/Daha. 390 px görüntü + gezinme testiyle
  doğrulandı (sekmeler, sıralama, geri, arama→bütçe, eski adresler), konsol hatasız.

- **2 Eki 2026 (3)** — Altın Döviz'den ayrıldı: kapı, Döviz bölümü, Lens (40 MB
  vendor) ve ilgili araçlar silindi; server.mjs yalnız tempoaltin.com aktarıyor,
  port 3200. Emre'nin yeni logosu (2400 px) maske parçalarına bölündü; giriş ekranı
  eklendi (O bir tur + bir zıplama). 390 px CDP görüntüsüyle doğrulandı.
  Önceki geçmiş (Döviz + ortak dönem) için `~/Desktop/tempo-doviz-app/DURUM.md`.
