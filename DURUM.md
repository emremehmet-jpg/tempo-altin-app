# TEMPO DÖVİZ UYGULAMASI — DURUM

> Projenin canlı hafızası. Her oturumun başında okunur, her anlamlı işten
> sonra güncellenir.

**Son güncelleme:** 2 Ekim 2026 (TSİ)
**Durum:** Uygulama iki bölümlü (Döviz + Altın); kapı, parçalı logolar, Al/Sat,
tema düğmesi, ikon hepsi Emre'nin onayından geçti ("tamamdır"). Oturum kapandı;
sıradaki konu **yayına alma** (arkadaşına link) — seçenekler bölüm 7'de, karar yok.

## 1. NE BU?

tempodoviz.com + tempoaltin.com'un **müşteriye dönük** ortak telefon
uygulaması. Tek uygulama, iki bölüm (19 Eyl 2026'dan beri):

- **KAPI** — açılış ekranı (Emre'nin tarifi, 19 Eyl ikinci sürüm): arka plan
  Emre'nin verdiği lacivert→altın degrade (`public/kapi/zemin.jpg`, sol altta
  TEMPO DÖVİZ logosu görselin içinde; `left center` konumlu ki kesilmesin).
  Ortada **Emre'nin logo görseli** (`public/kapi/logo.png`, 1024 kare, şeffaf;
  kaynak `marka/o-altin-cerceve-1024.jpg`, açık zemini `arac/logo-ayir.mjs`
  ile atıldı — Brave/CDP canvas taşkın doldurma; ölçüler: merkez 511,5/512,
  dış R 291, iç r 155, boşluklar 144–153° ve 324–333°). Kapıda `saturate(1.25)
  contrast(1.12)` ile canlandırılır (Emre: "daha canlı ve net"). **KARAR (Emre):
  logo değiştirilmez, görselin kendisi kullanılır** — SVG çizim denendi,
  istenmedi. **2 Eki 2026'dan beri:** `arac/kanat-ayir.py` logo.png'yi İKİ AYRI
  görsele böler (`kapi/kanat-doviz.png`, `kanat-altin.png`; kanatlar pikselde
  zaten ayrı iki parça → bağlı bileşen etiketi). Aynı adımda 2× büyütme +
  keskinleştirme, kenar sızıntısı temizliği, canlılık filtresi ve gölge
  görsele işlenir. Görseller 1024 tuvalin 150–874 karesi (CSS'te %14,648 /
  %70,703). **TUZAK:** CSS `filter` dönen katmandayken iPhone logoyu bulanık
  çiziyordu → filtre CSS'ten kalktı, görsele işlendi. **TUZAK:** eski
  `clip-path` zikzak bölmesi (`arac/kanat-kes.mjs`, artık kullanılmıyor) bir
  kanadın ucunu geride bırakıyordu. Dokunma: `#kapi-donen` tıklamasında açı
  hesaplanır (148,5°–328,5° arası Döviz). Python aracı için pillow+numpy+scipy
  gerekir (sistem python'unda yok; venv kur). Açılışta 1,5 sn'de bir tur döner; sonra çemberin DIŞ
  kenarında kavisli **DÖVİZ** (sol-üst) / **ALTIN** (sağ-alt) yazıları belirir
  (`<textPath>`, 1024 viewBox, yarıçap 312 / 342). Dokunulan kanat **ortasından
  tutulup kendine bir kez çekilir** (Emre'nin tarifi, 2 Eki): hafif basılır,
  dışa kayarak büyür (sana gelir), söner — 750 ms, ağırlık merkezi `--ox/--oy`,
  dışa yön `--yx/--yy`; iki kanat birebir simetrik. Öbürü yerinde küçülüp söner.
  480 ms'de kapı söner (350 ms), bölüm belirir. Üst çubuktaki markaya dokununca kapıya dönülür (dönüş tekrarlanmaz).
  Adres: `#` kapı, `#doviz/kurlar`, `#altin/fiyatlar`.
- **DÖVİZ bölümü** — Kurlar, Hesapla, **Al/Sat** (ortadaki büyük sekme: 2 Eki'den
  beri dairesiz, tek başına TEMPO O'su — `marka/tempo-o.png` maskesi, marka rengi), O Gün, İletişim + sitedeki kayan kur bandı + son iki hane mavi.
  **Tempo Lens** sekmede değil; Kurlar'ın altındaki karttan açılır (Emre, 19 Eyl).
  Üst çubuk sitedeki gibi beyaz, sol üstte **TEMPO DÖVİZ | 1988** logosu:
  üç maske parçası (`public/marka/tempo-yazi/o/bant.png`, `arac/logo-parcala.mjs`
  ile Emre'nin `marka/logo-yatay-doviz-2400.png`'sinden kesildi; currentColor
  ile boyanır → koyuda beyaz). **O parçası 3 sn'de bir 0,45 sn'de hızlı bir tur
  dönüp bir kez zıplar** (`@keyframes oZipla`, linear; Emre "ağır dönüyor" dedi,
  hızlandırıldı). **Altın üst çubuğu da aynı logo**, altın renkte: TEMP + O
  Döviz parçalarından (aynı şekil, 2400 px), bant `altin-bant.png`
  (tempoaltin.com logosundan, `logo-parcala.mjs ... altin`). Sağda **aydınlat/karart** düğmesi:
  `html[data-tema]` = acik|koyu, localStorage'da; yoksa sistem tercihi.
  Yalnız Döviz'i etkiler.
  **Al/Sat:** uygulama işlem yapmaz — yön (alıyorum → Tempo SATIŞ kuru /
  satıyorum → ALIŞ kuru), para, tutar → TL karşılığı; tek eylem **"Arayıp
  teyit edin"** (Emre: WhatsApp'tan talep diye bir şey yok, kaldırıldı);
  havale/EFT adımları.
- **ALTIN bölümü** — tempoaltin.com dili: sıcak siyah #14110c, altın #d5aa45,
  Instrument Serif başlıklar, kuruş altın renkte. Varsayılan koyu (site de
  öyle açılıyor); üst çubukta kendi **aydınlat/karart** düğmesi var
  (`html[data-tema-altin="acik"]` → sitenin krem paleti; localStorage
  `tema-altin`; Döviz'in seçiminden bağımsız). Sekmeler: Fiyatlar (Gram / Ziynet / Gümüş·Platin, üstte Has
  Altın mührü), Hesapla (TL ↔ gram/adet; TL→altın SATIŞ, altın→TL ALIŞ),
  Mağaza (site kategorilerine ve hizmetlerine köprü; sipariş sitede),
  İletişim (saatler 09–18 / 09–15, siteden).
  Tema değişkenleri `body[data-bolum="altin"]` üzerinde; aynı bileşenler
  (kart, liste, segment, sekme) iki bölümde de kullanılır.

PWA olarak yapıldı:
iPhone'da Safari → Paylaş → "Ana Ekrana Ekle" ile kendi ikonuyla, tam ekran,
App Store'suz kuruluyor. `~/Desktop/döviz-takip paneli` (iç izleme aracı)
ile **ilgisi yok**; o ayrı proje.

## 2. NASIL ÇALIŞTIRILIR

- `Başlat.command`'a çift tıkla **veya** `node server.mjs` (paket kurulumu yok).
- Mac: http://localhost:3100 · Telefon (aynı Wi-Fi): http://192.168.1.105:3100
  (IP değişirse sunucu açılışta yenisini yazar).
- Port 3100 — 3000 iç panelde kullanılıyor, çakışmasın diye.

## 3. VERİ KAYNAĞI

Sitenin kendi API'si; uygulama hiçbir veri üretmiyor.

| Uç | Ne verir | Not |
|---|---|---|
| `/api/rates/live` | 8 TL paritesi + 6 çapraz; alış, satış, değişim %, validFrom | 20 sn'de bir çekilir (site de öyle) |
| `/api/rates/history?para=USD-TRY&gun=2` | 48 saatlik değer dizisi | kart açılınca; 5 dk önbellek |
| `/api/tcmb/gecmis?parite=USD&gun=YYYY-MM-DD` | TCMB o gün alış/satış | `birim` alanına dikkat: JPY 100 birim üzerinden |
| `/api/altin/fiyatlar` → **tempoaltin.com**/api/fiyatlar | `{updatedAt, quotes:[{key,name,buy,sell,changePct}]}` 20 kalem | 30 sn'de bir, yalnız Altın bölümü açıkken. Anahtarlar: HAS_ALTIN GRAM_ALTIN AYAR22/18/14 CEYREK YARIM TAM ATA RESAT IKIBUCUK BESLI GREMSE GUMUS PLATIN PALADYUM USD EUR GBP CHF. Geçmiş ucu YOK (404). |

**Tempo Altın sitesi notu (19 Eyl):** Next.js e-ticaret (87 ürün, alış+satış).
Ürün fiyatı (1 gr külçe 7.479 ₺) ≠ API has altın (6.831 ₺): ürüne işçilik/
sertifika bindirilmiş. Uygulama API'deki piyasa fiyatlarını gösterir; ürün
fiyatı için siteye köprü. Sitedeki telefon/vergi no yer tutucu (000…), o
yüzden Altın iletişimde Döviz'in numaraları kullanıldı; adres aynı (Mahir İz 18/1A).

**Tuzak — CORS:** API yalnızca kendi adresinden çağrıya izin veriyor. Bu
yüzden `server.mjs` `/api/*` isteklerini siteye aktarıyor. Uygulama ileride
sitenin altına (`tempodoviz.com/app`) taşınırsa bu katmana gerek kalmaz;
`public/` klasörü olduğu gibi kopyalanabilir.

## 3b. TEMPO LENS (kamerayla fiyat çevirme)

Emre'nin daha önce tasarladığı akış. `public/lens/` altında.

**KARAR (Emre, 12 Eyl):** Sembol aranmaz. Kullanıcı PARİTEYİ seçer
(EUR→TL, USD→TL, EUR→USD, USD→EUR; 14 Eyl'de TL→EUR, TL→USD eklendi); kamera
gördüğü **her sayıyı** kaynak para sayar ve çevirir. Elenenler: %'li, saat
(12:30), yıl gibi 4 haneliler (1900–2099; kaynak TL ise gösterilir — TL'de
o aralık olağan fiyat), 7+ hane, güveni <70 satırlar, karenin %1,2'sinden
alçak satırlar. TL→döviz çevirisi de Tempo SATIŞ kuruyla (tutar / satış);
Hesapla ekranıyla tutarlı. Emre alış istersek `cevir` ters dalı değişir.

**MOTOR: PaddleOCR (PP-OCRv4) + ONNX Runtime Web** — `vendor/paddle/`
(paddle-ocr.js 10 MB, det 4,7 MB, rec 10,8 MB) + `vendor/ort/` (14 MB).
İlk açılışta ~40 MB iner, `immutable` önbellek. `arac/paddle-derle.sh`
yeniden derler (esbuild; tarif içinde).

**Neden Tesseract'tan geçildi (12 Eyl, Emre'nin kareli defter testi):**
Tesseract spiral halkaları ve çizgileri "1" okuyordu, el yazısı 32/44/55'i
"4, 5, 253" yapıyordu. Aynı sentetik görselde ölçüm:
Tesseract → `"on" "WE" "Tn" "Hm" "NC" "22" "44" "55"`;
Paddle → `"32"(100) "44"(100) "55"(100)`, çöp yok. Menü, küçük punto (5/5),
tek haneli 9 da tam. Paddle satır bazlı döner ("Carbonara 18"); sayı satır
metninden regex'le çıkarılıp kutu içinde karakter oranıyla konumlanır.
Paddle görüntüyü 32'nin katına büyütür; kutular geri ölçeklenir (`oku`).

**Kutu bölme (14 Eyl, Emre'nin telefon testi):** Gerçek defterde 44/55 gibi
alt alta sıkışık sayıları Paddle'ın algılayıcısı TEK uzun kutuda birleştirip
"345"/"14" okuyordu; olasılık eşiği (0,3–0,7) hiçbir şey değiştirmedi. Çözüm
`lens.js kutulariBol`: algılama ve tanıma ayrı çağrılır; aradaki her kutunun
mürekkep satır profili çıkarılır (koyu/açık zemin otomatik), boş yatay
şeritten bölünür, parçalar ayrı ayrı tanınır. Sentetik "zor defter" (sıkışık,
eğik, bulanık): önce `"345"(65)` → şimdi 32/44/55 hepsi 100.

**Paket yamaları (`arac/paddle-derle.sh`, sed ile, grep'le doğrulanır):**
eşik 0,03→0,3 (`window.TEMPO_OCR.esik` ile ayarlanır); afAfRec (aynı hizadaki
kutuları tek satıra birleştirme) kapalı; dik kutuyu 90° çevirme kapalı (tek
haneli "1" dik kutu verir, çevrilince çöp); `motor.detection` /
`motor.recognition` ve `ImageRaw` dışa açık. **TUZAK:** vendor "immutable"
önbellekli; paket her derlendiğinde `lens.js PAKET_SURUM` artırılmalı (şimdi 2),
yoksa telefon/test tarayıcısı eski paketi kullanır (bunu yaşadık).

**Sayı eleme ekleri (14 Eyl):** antet/iletişim satırları (@, www, .com, Tel,
No:, 0'la başlayan telefon) atlanır; 0 ile başlayan tam sayı (0216) atlanır;
kare kenarına dayanan kutu (kesik sayı "1" okunuyordu) atlanır. Rozetler artık
izlenen sayıya bağlı kalıcı öğe (her turda yeniden yaratılıp göz kırpmıyor).

**Ekran düzeni:** üst bant (parite + "1 EUR = 56,22 TL · Tempo satış" +
sayaç — Emre kur bilgisini görüntünün DIŞINDA istedi), orta canlı görüntü +
rozetler (yalnız karşılık: "1.798 TL"), alt bant (parite çipleri, deklanşör).

**Canlı döngü:** deklanşörsüz, tek geçiş (CANLI_KENAR 1000). Kırpma: yatayda
kameranın tam karesi, dikeyde bantlar dışı. Kamera açılınca ilk okumaya kadar
2,5 sn beklenir (SABITLENME_MS; iPhone odak/zoom oturuyor), zoom destekliyorsa
1x'e çekilir. Her turda 24×24 küçük kare öncekiyle kıyaslanır (HAREKET_ESIK 9):
hareket varsa okunmaz ("Telefonu sabit tutun…"), 1,2 sn sürerse rozetler
kaldırılır. Parite değişince canlı rozetler sıfırlanır, sonraki tur yeniden
kurar (Emre: "önceki paritenin fiyatı kalmasın"). Kayıp turu 2; aynı metin
örtüşmese de yakınsa aynı sayı sayılır (kamera kayınca çift rozet çıkıyordu). Kareler arası izleme
(`izlemeGuncelle`): örtüşme ≥%40 aynı sayı; okumalar güven puanıyla oylanır,
en çok puan gösterilir; berabere → mevcut kalır; 3 tur görünmeyen silinir.
"Uzun okuma hemen kazanır" kuralı 14 Eyl'de KALDIRILDI (tek karede "44"→"444"
kalıcı oluyordu); tek istisna kuruş tamamlama ("18" → "18,50").
Deklanşör: kareyi dondurur (1600 px), liste çıkarır.

**Denenip vazgeçilenler (Tesseract dönemi, kayıt için):** rakam kısıtı
(whitelist) harfleri rakama zoruyordu; gri/kontrast/eşik ön işleme fayda
etmedi; PSM 11/6 dönüşümü ve 2000 px büyütme geçişi Paddle'la gereksizleşti.

### Test altyapısı (tuzaklar dahil)

- `arac/test-surucu.mjs`: Brave'i CDP ile sürer, GERÇEK zamanda bekler,
  `#log` metnini + ekran görüntüsünü alır. `node arac/test-surucu.mjs <url>
  <sn> <png> [y4m]`. `arac/y4m-uret.py` PNG'den sahte kamera akışı üretir.
- **TUZAK:** `--virtual-time-budget` ile OCR/kamera testi güvenilmez —
  zamanlayıcılar hızlanıyor, kamera "açılmıyor" gibi görünüyor, ekran
  görüntüsü erken alınıyor. Saatlerce bunu kovaladık; CDP sürücüsü kullan.
- **TUZAK:** Site API'si IP başına istek sınırı koyuyor (429). server.mjs
  artık yanıtları önbellekliyor (live 15 sn, history 5 dk, tcmb 1 sa) ve
  429'da son bilinen yanıtı `x-tempo-bayat: 1` başlığıyla veriyor.
- Test sayfaları `arac/test-sayfalari/` içinde durur; kullanmak için
  `public/_test/`e kopyalanır, bitince silinir (yayına gitmesin).
  `oku.html`: sentetik sahneler (defter / zor defter / menü) çizer, uygulamanın
  gerçek `window.TempoLens.oku` + `sayilariBul`ünü iframe üzerinden çağırır,
  satırları ve bulunan sayıları loglar (`?sahne=zor`, `?dataurl=1` PNG döker).
  `canli.html`: uygulamayı 390 px iframe'de (`allow="camera"`) açar, "Kamerayı
  Aç"a basar, rozet metinlerini saniye saniye loglar; y4m ile:
  `node arac/test-surucu.mjs http://localhost:3100/_test/canli.html 25 ss.png zor.y4m`.
  `zor-defter.png` hazır zor sahne (y4m-uret.py ile akışa çevrilir).

## 3c. YEREL HTTPS (telefonda canlı kamera için)

Tarayıcı kamerayı yalnızca https'te açar. Tünel araçları (cloudflared)
indirilemedi (izin denetleyicisi engelledi); onun yerine **kendi kök
sertifikamız**: `sertifika/uret.sh` (openssl) → `ca.crt` + `server.crt`
(SAN: localhost, <mac>.local, Wi-Fi IP; 825 gün). Sunucu 3101'de https.

Telefon tarafı BİR KEZ: `http://<ip>:3100/kurulum` sayfası adım adım anlatıyor
(profil indir → Ayarlar'da yükle → Genel → Hakkında → Sertifika Güven
Ayarları → aç). Sonra `https://finnovapc2-macbook-air.local:3101`.
`Başlat.command` her açılışta sunucu sertifikasını tazeler (IP değişse de
kök aynı kaldığı için telefonda tekrar bir şey yapılmaz).

## 4. DOSYALAR

```
server.mjs            geliştirme sunucusu + API aktarımı (bağımlılık yok)
Başlat.command        çift tıkla çalıştır
public/index.html     kapı + Döviz bölümü (5 ekran) + Altın bölümü (4 ekran)
public/app.css        görünüm; iki paletin değişkenleri sitelerin CSS'inden, kapı, bant, altın stilleri
public/app.js         kabuk (kapı/bölüm/ekran yönlendirme, tema rengi) + Döviz davranışı
public/altin.js       Altın bölümü: fiyat çekme, liste, hesaplama, açık/kapalı
public/manifest.webmanifest, sw.js   PWA
public/ikon/          ana ekran ikonları (lacivert zemin, beyaz "O")
public/lens/          Tempo Lens: lens.js, lens.css, vendor/ (PaddleOCR + ORT)
arac/                 paddle-derle.sh, test-surucu.mjs, y4m-uret.py, logo-ayir.mjs (zemin temizleme),
                      logo-parcala.mjs (yatay logo → TEMP/O/bant maskeleri), kanat-kes.mjs (kapı kanat çokgenleri), test-sayfalari/
public/marka/         tempo-yazi/o/bant.png (döviz), altin-bant.png — maske parçaları
public/kapi/          zemin.jpg (degrade arka plan), logo.png (şeffaf logo)
public/kurulum.html   telefon https kurulum rehberi (/kurulum)
sertifika/            uret.sh + üretilen kök/sunucu sertifikaları (paylaşma)
marka/                logo dosyaları: logo-yatay (döviz), logo-altin-yatay, o-simge-512, o-simge-altin-180
                      ("O" iki markada aynı şekil; uygulamada favicon.png maske + renk ile çizilir)
```

## 5. KARARLAR

- **PWA, native değil.** App Store'suz kurulum + siteyle aynı kod tabanı.
  Sonra istenirse Capacitor ile sarılıp mağazaya da çıkar.
- **Çerçevesiz (vanilla) HTML/CSS/JS.** Build adımı yok; `public/` doğrudan
  sitenin altına konabilsin diye.
- **Hesaplama yönü ve kur:** TL → döviz büronun SATIŞ kuru, döviz → TL ALIŞ
  kuru (müşteri gözüyle doğru olan bu). O Gün ekranı TCMB satış kullanır.
- **Alarm / bülten / müşteri kabul** v1'de siteye köprü; sitede zaten
  çalışıyor, kopyalamak yerine bağlandı.
- Marka: lacivert #1B2F52, vurgu #7DA5E3, yazı tipi Anek Latin (siteyle aynı).
- **İki marka, tek kabuk (Emre, 19 Eyl):** Döviz açık/lacivert, Altın koyu/altın;
  kullanıcı bölüm değiştirince marka değişir. Ortak: Anek Latin, "O" logosu,
  kart/liste bileşenleri. Altın başlıkları Instrument Serif (Google Fonts).
- Altın'da alarm/sipariş/ürün listesi v1'de siteye köprü (Döviz'deki kararla aynı).

## 6. TUZAKLAR

- Başsız Brave pencereyi en az 500 px açıyor; 390 px telefon görüntüsü
  almak için sayfa bir iframe'e konularak test edildi.
- Service worker http://192.168.x.x'te kayıt olmaz (tarayıcı kuralı); yalnızca
  https veya localhost. Ana ekrana ekleme yine de çalışır.
- Tarayıcı `<select>` seçili metni kısaltır; para birimi seçicisi bu yüzden
  tam genişlikte.

## 7. SIRADAKİ İŞLER

1. **Emre telefonda dener:** kapı ekranı (renk karışımı, geçiş), Altın bölümü
   görünümü. Geri bildirime göre düzeltmeler.
2. ~~Ana ekran ikonu~~ — 19 Eyl: ikon artık Emre'nin logo görseli (`marka/
   o-altin-cerceve-1024.jpg`, kendi açık zeminiyle; iOS şeffaf ikonu siyaha
   boyar, o yüzden zeminli hali kullanıldı), uygulama adı "Tempo".
   `ikon/favicon.png` DOKUNULMADI: üst çubuktaki "O" maskesi olarak kullanılıyor.
   Telefonda eski ikon görünürse ana ekrandan silip yeniden eklemek gerekir.
3. Altın'da geçmiş grafik yok (API'de geçmiş ucu yok) — istenirse sunucuda
   biriktirilir.
4. Lens (kareli defter/menü testi) — önceki turdan bekleyen.
5. **Yayına alma (Emre'nin bir sonraki sorusu, 19 Eyl):** uygulama şu an yalnız
   Emre'nin Wi-Fi'ında açılıyor; başkasına link atılamaz. Seçenekler:
   (a) sitenin altına `tempodoviz.com/app` — asıl plan, sitenin barındırmasına
   erişim ister; (b) Cloudflare Pages/Vercel'de deneme adresi — `server.mjs`
   aktarması küçük bir fonksiyona çevrilir (~yarım saat), önerilen ilk adım;
   (c) geçici tünel (cloudflared) — Mac açıkken. Uygulama iki siteden veri
   çektiği için nereye konursa konsun en az bir aktarma katmanı gerekir.
   Cloudflare hesabı var mı sorulacak.
6. İsteğe bağlı: aşağı çekince yenileme, alarm/bildirim.

## 8. OTURUM GÜNLÜĞÜ

- **2 Eki 2026** — Kapı: logo netleştirildi/canlandırıldı (kanat-ayir.py, filtre
  görsele işlendi), kanatlar ayrı görsel, yeni "kendine çek" hareketi (iki kanat
  aynı). Telefon bağlantısı: Mac IP'si .116 oldu, sertifika tazelendi; telefon
  aynı Wi-Fi'de açamadı — sebep henüz bulunmadı (Emre kontrol edecek).
  Al/Sat sekmesi: daire kalktı, tek başına TEMPO O'su (Emre). sw SURUM tempo-v8.

- **19 Eyl 2026** — tempoaltin.com incelendi (tüm sekmeler + tasarım: CSS
  değişkenleri, yazı tipleri, ekran görüntüleri), `/api/fiyatlar` bulundu.
  tempodoviz.com tasarımı da aynı yöntemle çıkarıldı. Emre'nin tarifiyle
  uygulama iki bölümlü oldu: kapı ekranı (önce sol lacivert / sağ altın
  karışımı; sonra Emre'nin görselleriyle dönen SVG logo + kanat seçimi), Döviz bölümü (eski + bant + pip mavi), Altın bölümü (fiyatlar,
  hesapla, mağaza, iletişim). server.mjs `/api/altin/*` aktarması. 390 px
  CDP görüntüleriyle doğrulandı; konsol hatasız. Kapı üç sürüm geçirdi:
  renk karışımı → SVG çizim logo (Emre: "logoyu değiştirme") → Emre'nin
  görseli, zemini ayrılmış, dıştan kavisli yazılar. Sonra: ana ekran ikonu =
  logo görseli, ad "Tempo"; Döviz üst çubuğu beyaz + parçalı logo (O dönüp
  zıplıyor), aydınlat/karart, ortadaki sekme Lens → Al/Sat (WhatsApp talebi
  kaldırıldı, yalnız "Arayıp teyit edin"). Son tur: Altın'a aynı logo (altın),
  kapı logosu canlandırıldı, kanat kesimi zikzağa göre düzeltildi. Emre onayladı;
  yayına alma konuşulacak.

- **14 Eyl 2026** — Emre'nin telefon testi: alt alta 44/55 tek kutuda
  birleşiyor, antetteki telefon/adres sayı sanılıyor, kenardaki kesik sayı
  "1" okunuyordu. Kutu bölme (mürekkep profili), paket yamaları (eşik,
  afAfRec, döndürme kapalı, aşamalar dışa açık), antet/kenar/sıfır elemesi,
  kalıcı rozetler. Sentetik zor defter + canlı akış testiyle doğrulandı.
  İkinci tur: "444" için oylama düzeltildi; eski http ikonundan açılınca
  https adresine götüren sarı bant (index/app.js `guvenli-uyari`, /adres'ten).
  Üçüncü tur: TL→EUR / TL→USD pariteleri (üç çip grubuna da), yıl filtresi
  TL'de kapalı, üst bantta "TL → EUR" yazımı. Dördüncü tur (Big Chefs menü
  testi: çift rozet, açılışta zoom): sabitlenme süresi, hareket algılama,
  yakın eşleme, parite değişiminde sıfırlama.

- **12 Eyl 2026 (5)** — Emre'nin kareli defter testi çöp üretti → motor
  PaddleOCR'a geçirildi (ölçümle), Tesseract dosyaları silindi, arac/
  paddle-derle.sh eklendi.
- **12 Eyl 2026 (4)** — Üç geçişli döngü (büyütme), güven ağırlıklı oylama,
  API önbelleği (429), CDP test sürücüsü. İnternet yeniden başlayınca IP
  .107 oldu, sertifika tazelendi.
- **12 Eyl 2026 (3)** — Lens canlı tarama + "sadece sayı" kararı; yerel https
  (öz-imzalı CA) ve /kurulum sayfası; vendor dosyalarına kalıcı önbellek.
- **12 Eyl 2026 (2)** — Tempo Lens eklendi: 5. sekme, Kurlar'da tanıtım
  kartı, tam ekran kamera katmanı, OCR + fiyat bulma + rozetler. Tesseract
  projeye indirildi. Sahte menüyle test: 6/6 doğru.
- **12 Eyl 2026** — Proje kuruldu. Site incelendi (API'ler, renkler, ikonlar),
  ikonlar üretildi, 4 ekran yazıldı, başsız tarayıcıda 390 px'te doğrulandı.
