# tempoaltin.com — Site Analiz Raporu

Tarih: 2026-10-02 · Yöntem: yalnızca GET (curl, sıralı, ~1 sn arayla). Hesap açılmadı, form gönderilmedi, POST yapılmadı.
Teknoloji: Next.js App Router (turbopack), React Server Components, Server Actions, Cloudflare önünde. `robots.txt` = `Disallow: /`, `sitemap.xml` boş.

Bu klasördeki dosyalar:

| Dosya | İçerik |
|---|---|
| `RAPOR.md` | bu rapor |
| `urunler.json` | 87 ürünün tamamı: id, slug, ad, kategori, gram, saflık/ayar, şekil, fiyat (satış, gram başı, geri alış), **fiyat formülü** (`price.rule`) + formül kontrolü, stok/max adet, kampanyalar, açıklama, görseller, gramaj varyantları; ayrıca aynı anda alınmış `/api/fiyatlar` snapshot'ı |
| `kategoriler.json` | 5 ana + 9 alt kategori, sıra, açıklama, ürün sırası (Önerilen), sıralama/filtre seçenekleri, header nav |
| `sayfalar.json` | sayfa envanteri: route, title, description, amaç, başlıklar, form alanları, butonlar |
| `endpoints.json` | JSON API'ler, tüm Server Action ID'leri ve argümanları, sipariş enum'ları, çerezler, giriş gerektiren route'lar, dış servisler |
| `sayfalar/*.md` | her sayfanın okunur tam metni (form alanları `{input …}`, butonlar `[BUTON: …]`, linkler markdown) |
| `sayfalar/sozlesmeler/*.md` | 11 yasal metnin tamamı |
| `sayfalar/kategori/*.md`, `sayfalar/urun/*.md` | 14 kategori + 87 ürün sayfası metni |
| `sayfalar/_ortak-header.md`, `_ortak-footer.md` | ortak header/footer |
| `gorsel/` | indirilen tüm görseller, sitedeki yolları korunarak (`gorsel/urun/*.jpg`, `gorsel/marka/kulce/{gold,gold995,silver}/*.webp`, logo, mağaza, og, ikonlar): 298 dosya, 53 MB |
| `html/`, `js/`, `css/app.css` | ham HTML (sayfalar, ürünler, aramalar), 19 JS chunk, global CSS |
| `fiyat-once.json` / `fiyat-analiz.json` | fiyat karşılaştırmasında kullanılan eş zamanlı snapshot ve ürün bazında oranlar |
| `metin.py`, `rsc.py`, `urun-parse.py`, `urun-final.py`, `fiyat-analiz.py`, `al.sh` | yeniden üretmek için kullanılan scriptler |

---

## 1. Sayfa envanteri

### 1.1 Ortak yerleşim
- **Header**: logo (`/marka/tempo-altin-1988-altin.png`), ürün menüsü (Altın, Gümüş, Ziynet, Takı; her biri açıklama ve alt kategorilerle bir mega-menüye açılır), hizmet nav'ı (Hesaba Havale, Hesaptan Fizikiye, Gel Al, Vadeli Altın, Kampanyalar, Düzenli Birikim), Sepet, Giriş, tema düğmesi (açık/koyu), arama kutusu (`/arama?q=`; 3+ haneli sayı yazılırsa `/butce?tutar=<n>`'ye gider; placeholder "Ürün, gramaj veya bütçe (örn. 10000)").
- **Mobil menü** (MobileNav): ürün ağacı + "Keşfet" (Bütçenize göre altın `/butce`, Hediyelik altın `/hediyelik`, hizmet linkleri) + telefon + çalışma saatleri.
- **Footer**: Ürünler / Hizmetler / Teslimat & Ödeme / Kurumsal & Yasal / İletişim kolonları. Adres: Mahir İz Caddesi No:18/1A Altunizade – Üsküdar / İstanbul. Tel (0216) 000 00 00, info@tempoaltin.com (Cloudflare e-posta gizleme ile), WhatsApp wa.me/905000000000. Çalışma saatleri: hafta içi 09:00–18:00, Cumartesi 09:00–15:00. Uyarı metni (cayma hakkı yok, 5549 kimlik tespiti), VISA / MASTERCARD / 3D SECURE / 256-BIT SSL rozetleri, ünvan/vergi/MERSİS satırı, "Mücevher İhracatçıları Birliği üyesi". Telefon, vergi no ve MERSİS gibi bilgiler sitede hâlâ yer tutucu (000…).

### 1.2 Herkese açık sayfalar (tam metinleri `sayfalar/`)
| Route | Amaç / bölümler | Form / CTA |
|---|---|---|
| `/` | Hero "Altın, sade haliyle." + ürün görselleri + HAS ALTIN gram fiyatı; 6 slaytlık banner karuseli (7 sn'de bir döner: Bilezik, Düzenli Birikim, Teslimat, Vadeli Altın, Gel Al, Hesaba Havale); **Vitrin** (8 ürün, "87 ürün · fiyatlar canlı"); "Ne kadar ayırmak istersiniz?" bütçe formu (`/butce?tutar=`); Özel gün (hediyelik vesileleri); 3 güven kartı; "Ne arıyorsunuz?" kategori kartları; Düzenli Birikim tanıtımı; kurumsal blok (mağaza fotoğrafı) | tutar inputu, Ekle butonları |
| `/kategori/<slug>` (14 adet) | breadcrumb, H1, açıklama, Sırala (`sirala` = '' Önerilen / `gram` / `fiyat-artan` / `fiyat-azalan`, "Uygula" butonu), alt kategori chip'leri, filtre chip'leri `?filtre=kampanyali` / `?filtre=stokta`, ürün kartları, altta "Fiyatlar nasıl belirlenir?" ve "Teslimat" bilgi blokları. **Sayfalama yok**, tüm ürünler tek sayfada | kart: ad, "10,00 gr · 22 Ayar", favori kalbi, görsel, fiyat, "₺/gr · alış …", Ekle / adet sayacı |
| `/urun/<slug>` (87 adet) | breadcrumb; galeri (bileziklerde 6 görsel); H1; "1,00 gr · 24 Ayar · 999,9"; favori; fiyat (kuruş küçük), ₺/gr; "Geri alış X ₺ · Son güncelleme HH:MM"; "Ödemeye geçtiğinizde fiyat 3 dakika sunucuda sabitlenir."; **Gramaj** varyant seçici (aynı ailedeki ürünler, fiyatlarıyla); Adet (Hesaba Havale'de "Gram") sayacı; **Sepete Ekle**; "Bu üründe kampanya var" kutusu; 3 madde teslimat; Paylaş (WhatsApp/X/Facebook/link kopyala); "Fiyat alarmı kur — hedefe gelince e-posta/SMS" (giriş gerekir); Ürün bilgileri (açıklama + özellik tablosu: Ağırlık, Saflık, Ayar, Ürün şekli, Kart/kutu boyutu, Basım yılı); Güvenli ödeme ve müşteri tanıma; Teslimat; Sertifika ve nakde çevirme; İptal ve iade; Benzer ürünler. JSON-LD Product + BreadcrumbList | AddToCart |
| `/sepet` | "Sepetim N ürün". Boşken "Sepetiniz boş." + Ürünleri gör. Doluyken: aşağıda §3 | |
| `/arama?q=` | "“q” — N sonuç" + ürün grid'i. `q=a` 87 sonucun hepsini döndürür | |
| `/butce?tutar=&amac=` | "Ne kadar ayırmak istersiniz?" tutar + hazır tutarlar (1.000 / 2.500 / 5.000 / 10.000 / 25.000), kartlar: En yüksek gramaj, Hesaba altın havale (≈X gr), "Bütçeye uygun ürün" sayısı; amaç sekmeleri `yatirim` / `hediye` / `iscilik` (En düşük marj) / `kampanya`; ürün listesi | |
| `/hediyelik?vesile=&tutar=` | vesile: `dugun`, `yeni-dogan`, `dogum-gunu`, `yildonumu`, `mezuniyet`, `kurumsal`; bütçe: 2.500 / 5.000 / 7.500 / 15.000 / 30.000 / 60.000; ürün listesi; Hediye notu ve ambalaj ("ödeme adımında not ekleyin", pakete fiyatlı belge konmaz), Alıcıya doğrudan teslim, Kurumsal fatura ("Fatura adımında Kurumsal seçin") | |
| `/hizmetler` | 4 hizmet kartı | |
| `/gel-al` | Mağaza bilgisi, 4 adım (Sipariş verin → Hazırlandı bildirimi → Mağazaya gelin → Kimlikle teslim), Fiyat kilidi / Stoktan hemen / Kimlik tespiti, SSS (bekleme süresi 3 iş günü) | |
| `/vadeli-altin` | Vade: 15 gün −%0,50 · 30 gün −%1,00 · 45 gün −%1,75 · 60 gün −%2,00 · 90 gün −%3,00 (kilitli ara toplam üzerinden). 4 adım (ödeme adımında **"Teslimat zamanı"** seçimi), SSS | |
| `/duzenli-birikim` | Simülatör (ürün: 1/2,5/5/10/20/50 g külçe, Çeyrek/Yarım/Tam; sıklık WEEKLY/BIWEEKLY/MONTHLY; süre 3–36 ay range), sonuç (toplam gram, bugünkü fiyatla tutar, dönem başı), "Bu planı kur" → `/hesap/birikim/yeni?urun=<slug>&siklik=MONTHLY&donem=12` (giriş ister); 4 adım; SSS (en fazla 5 aktif plan, 3 gün önce bildirim, başarısız tahsilatta 3 gün tekrar deneme, ardından 7 gün geçerli ödeme linki) | |
| `/hesaptan-fiziki-altin` | Banka altın hesabındaki gramı Tempo'ya aktarıp külçe alma; 4 adım; **talep formu** (§4); SSS | form |
| `/kampanyalar` | (1) **İlk Siparişine 250 ₺ İndirim**: 5.000 ₺ ve üzeri ilk sipariş, kişi başı 1, bitiş 31.10.2026; (2) **Havale/EFT ile Gümüşte %2 İndirim**, en fazla 2.000 TL, kişi başı 3, bitiş 31.10.2026; Birikim ve Vadeli tanıtımları | |
| `/kargo-ve-teslimat` | Sigortalı kargo (ücretsiz, hafta içi 16:00 kesim, 1–3 iş günü), Moto kurye (İstanbul, 200.000 ₺ altı, aynı gün), Zırhlı araç, Mağazadan teslim, kimlik, hasarlı paket | |
| `/siparis-takip` | Sipariş no (TKM…) veya kargo takip no + siparişteki cep telefonu → durum ekranı (§4) | form |
| `/iletisim` | adres, telefon, WhatsApp, e-posta, saatler + iletişim formu | form |
| `/hakkimizda` | kurumsal metin (1988, LBMA, Darphane, MASAK, MİB) | |
| `/blog` | "Henüz yazı yok." (hiç post yok; `/blog/<x>` 404) | |
| `/giris`, `/kayit`, `/sifremi-unuttum`, `/sifre-sifirla?token=`, `/dogrula?token=` | §5 | |
| `/sozlesmeler/*` (11) | `mesafeli-satis`, `on-bilgilendirme`, `iptal-ve-iade`, `guvenlik`, `kvkk`, `masak`, `ticari-ileti`, `uyelik-sozlesmesi`, `kullanim-kosullari`, `cerez-politikasi`, `birikim-talimati` — tam metinler `sayfalar/sozlesmeler/` | |

### 1.3 Giriş gerektiren route'lar (307 → `/giris?next=…`)
`/odeme`, `/hesap`, `/hesap/siparisler`, `/hesap/favoriler`, `/hesap/adresler`, `/hesap/birikim`, `/hesap/birikim/yeni`, `/hesap/alarmlar`, `/hesap/kimlik`, `/hesap/faturalar`, `/siparis/<orderNo>`. Not: `/hesap/*` alt yollarının hepsi `next=/hesap`'e yönleniyor. Var olmayan yollar (ör. `/hesap/profil`, `/hesap/ayarlar`) 404 dönüyor, yani yukarıdaki liste gerçekten var olan route'ları gösteriyor. Profil formu (ProfileForm) `/hesap` üzerinde.

---

## 2. Ürünler ve fiyatlama

### 2.1 Katalog: 87 ürün (hepsi `urunler.json`'da)
Tam liste üç yoldan doğrulandı: kategori sayfaları (sayfalama yok), `/arama?q=a` (87 sonuç) ve ana sayfadaki "87 ürün" yazısı. Gizli veya linksiz ürün bulunmadı.

| Ana kategori (sıra) | Alt kategoriler | Adet |
|---|---|---|
| 1. `gram-kulce-altin` — Gram Külçe Altın ("1 gramdan 12,5 kilograma…") | `995-kulce-altin` (11), `9999-kulce-altin` (12) | 23 |
| 2. `gram-kulce-gumus` — Gram Külçe Gümüş (50 g–15 kg, 999.0) | – | 9 |
| 3. `ziynet-altin` — Ziynet Altın | `ceyrek-yarim-tam` (5), `resat-altin` (4), `ata-altin` (3) | 12 |
| 4. `hesaba-altin-havale` — Hesaba Altın Havale | – | 1 |
| 5. `taki` — Takı (22 ayar bilezik) | `burma-bilezik` (9), `kibrit-copu-bilezik` (6), `ajda-bilezik` (6), `model-bilezik` (21) | 42 |

- Altın külçe: 1 / 2,5 / 5 / 10 / 10 parçalı / 20 / 50 / 100 / 250 / 500 g / 1 kg × {995.0, 999.9} + 12,5 kg Large Bar (999.9, LBMA Good Delivery).
- Gümüş: 50 / 100 / 250 g, 10 ons (311,04 g), 500 g, 1 kg, 100 ons (3,11 kg), 5 kg, 15 kg. Sayfa "Saflık 999,9" yazıyor, ad "999.0" diyor; sitedeki bir tutarsızlık.
- Ziynet: Çeyrek / Yarım / Tam / Ziynet 2,5'lik / 5'lik (yeni tarihli), Ata Lira / Ata Yarım / Ata Çeyrek (102. Yıl), Reşat Lira, Reşat Lira kulplu, Reşat 5'lik, Reşat 5'lik kulplu. Kesin gramlar açıklamada (çeyrek 1,754 g, Ata 7,216 g…).
- Bilezik (42): burma, 2'li burma, 3'lü burma, ajda, zikzak ajda, kibrit çöpü, parçalı kibrit çöpü, badem, balık sırtı, dokulu, ince çizgili, italyan, simli, sıra desen. 6–20 g, 22 ayar / 916.
- Hesaba Altın Havale (1 gr): adet = gram, max 100000, teslimat yöntemi "Altın hesabı" (IBAN ile).

Ürün kimliği cuid biçiminde (`cmu13ql5z002j0yo8lpzzpa0t`); cart action'ları bu `productId`'yi alıyor. Slug ayrıca JSON-LD `sku` olarak geçiyor.
Stok: hepsi `InStock`. AddToCart `max` değeri stokla eşleşiyor ve 100 ile sınırlı görünüyor (çoğu 100; bazıları 99/98; 12,5 kg için 3). Stok 0 olursa buton "Yakında Stokta", listede "Tükendi" yazıyor.
Kampanya rozetleri: 87 üründe "İlk siparişinde 5.000 ₺+ alışverişte 250 ₺ indirim", 9 gümüş üründe ek olarak "Havale/EFT ile %2 indirim (max 2.000 ₺)".
Görseller: külçelerde marka kart görseli `/marka/kulce/{gold|gold995|silver}/<gram>.webp`. 10 ons → 250g.webp ve 100 ons → 5kg.webp görselini kullanıyor; parçalı 10 g de normal 10g görselini kullanıyor. Ziynet/bilezikte `/urun/<slug>-N.jpg` (1400×1400). Liste görselleri `/_next/image?url=…&w=3840&q=75` üzerinden servis ediliyor. Hepsi `gorsel/` altında.
KDV: külçe ve ziynet altın KDV'den istisna; gümüş ve takıda KDV fiyata dahil (Ön Bilgilendirme Formu).

### 2.2 Fiyat nasıl hesaplanıyor? (sabit değil, canlı)
Tüm fiyatlar sunucu tarafında `/api/fiyatlar` kotasyonlarından türetiliyor. Eş zamanlı bir snapshot (`fiyat-once.json`, updatedAt 08:34:52Z) ile `/arama?q=a` listesindeki 87 fiyat karşılaştırıldı. **85 ürün kuruşu kuruşuna tuttu**; kalan 2 ürün (parçalı 10 g) ≈1 ₺ sapmayla tutuyor. Fiyatlar 2 haneye yuvarlanıyor.

```
Külçe altın:   satış     = HAS_ALTIN.sell × gram × saflık × (1 + marj[gram])     saflık: 999.9→0.9999, 995.0→0.995
               geri alış = HAS_ALTIN.buy  × gram × saflık × 0.99
   marj: 1g %9,5 · 2,5g %7,5 · 5g %5,5 · 10g %4,5 · 10g parçalı ≈%5,38 · 20g %4,0 · 50g %3,5 · 100g %3,0
         250g %2,6 · 500g %2,3 · 1kg %2,0 · 12,5kg %1,5
Hesaba havale: satış/gram = HAS_ALTIN.sell × 0.9999 × 1.012   (geri alış gösterimi = HAS.buy × 0.9999 × 0.99)
Gümüş:         satış     = GUMUS.sell × gram × (1 + marj)   ; geri alış = GUMUS.buy × gram × 0.99
   marj: 50g %25 · 100g %20 · 250g %15 · 10 ons %14 · 500g %12 · 1kg %10 · 100 ons %9 · 5kg %8 · 15kg %7   (ons = 31,1035 g)
22 ayar bilezik: satış   = HAS_ALTIN.sell × 0.916 × gram × 1.05  (≈%5 işçilik; tüm modellerde aynı → ₺/gr aynı)
               geri alış = AYAR22.buy × gram × 0.99
Ziynet (adet): satış     = KOT.sell × (1 + marj) ; geri alış = KOT.buy × 0.99
   Çeyrek CEYREK %2,5 · Yarım YARIM %2,3 · Tam TAM %2,1 · 2,5'lik IKIBUCUK %2,0 · 5'lik BESLI %2,0
   Ata Lira ATA %2,2 · Ata Yarım YARIM %2,8 · Ata Çeyrek CEYREK %3,0
   Reşat RESAT %2,2 · Reşat kulplu RESAT %2,6 · Reşat 5'li BESLI %2,4 · Reşat 5'li kulplu BESLI %2,8
```
Geri alış her üründe kotasyon alışının %99'u. Ürün başına kural `urunler.json → products[].price.rule` içinde, `formulaCheck` alanında da tahmin edilen değerler var. Not: AYAR22, CEYREK gibi bazı kotasyonların `changePct` değeri 0, yani bunlar daha seyrek güncelleniyor olabilir. Bileziğin satışı AYAR22'den değil HAS'tan hesaplanıyor.
"Son güncelleme HH:MM" fiyat kaynağının zamanını gösteriyor. İstemci tarafında polling yok: `/api/fiyatlar` site JS'inde çağrılmıyor, fiyatlar SSR ile geliyor ve sepet değişiminde `router.refresh()` yapılıyor. Güvenlik metnine göre "veri gecikirse satış otomatik olarak durdurulur".

---

## 3. Sepet ve ödeme (en önemli kısım)

### 3.1 Sepet saklama
- **Sunucu tarafında** tutuluyor, **`tk_cart` çerezi** (zorunlu, 30 gün; Çerez Politikası) ile ilişkilendiriliyor. localStorage'da sepet yok; tek localStorage anahtarı `tk_theme`.
- Değişiklikler Server Action ile yapılıyor: `addToCartAction(productId, qty)` → `{ok, capped, available, qty, error}`, `setProductQtyAction(productId, qty)` (liste kartındaki sayaç), `setQtyAction(lineId, qty)` (sepet satırı; 0 = Kaldır), `clearCartAction()`. Her başarılı işlemden sonra `router.refresh()` çağrılıyor. ID'ler `endpoints.json`'da.
- Stok sınırı: istenen adet stoğu aşarsa sunucu adedi kısıyor (`capped`) ve şu mesaj çıkıyor: "Stok sınırı: sepette en fazla N adet olabilir (sepetteki adet: M)". Liste sayacında "En fazla N adet". Başarılıysa "Sepete eklendi".
- Misafir sepete ekleyebiliyor (login gerekmiyor); ödeme için giriş zorunlu.

### 3.2 Sepet sayfası (doluyken; `CartLines` ve `CartNudge` bileşenleri chunk `3eej68-f43ml4.js`'ten çıkarıldı)
- Kart içinde satırlar: 64/72 px görsel, ürün adı ("Tempo " öneki silinmiş, ürüne link), "10,00 gr · birim 63.248,25 ₺", adet sayacı (− / adet / +, + en fazla `product.available`), satır toplamı (`lineTotal`), "Kaldır". En altta "Sepeti boşalt".
- Sepet veri modeli: `cart.lines[] = {id, qty, lineTotal, product:{slug, name, image, weightGr, price, available}}`.
- **CartNudge**: altın sol çizgili bir öneri satırı (`text`, opsiyonel `productId` ve `productName`) ve "+1 <ürün> ekle" butonu. Muhtemelen "250 ₺ indirim için X ₺ daha" gibi kampanya eşiği teşvikleri için.
- Özet kutusu (ara toplam, indirim, kargo, "Ödemeye geç") sunucuda render edildiği için boş sepetle görülemedi. Bilinen kurallar:
  - **Kargo ücretsiz** (sigortalı). 500.000 ₺ üzeri özel sigortalı taşıma, 2.000.000 ₺ üzeri zırhlı araç. Moto kurye yalnızca İstanbul'da ve 200.000 ₺'ye kadar. Kampanya metni "ücretsiz teslimat kampanyaları kargo **ve kurye ücretini** sıfırlar" diyor, yani moto kurye ücretli olabilir; tutarı görülemedi.
  - Kampanya indirimleri "ödeme adımında toplamdan düşer".

### 3.3 Fiyat kilidi
- "Ödemeye geçtiğinizde fiyat **3 dakika sunucuda** sabitlenir." Kart ödemesinde 3D Secure bu süre içinde tamamlanmalı; süre dolarsa işlem güncel fiyattan yeniden başlıyor (Mesafeli Satış 3.2).
- **Havale/EFT**: fiyat sipariş oluşturulduktan sonra **30 dakika** geçerli; ödeme gelmezse sipariş otomatik iptal (durum `PAYMENT_PENDING`).
- Kilit sepette değil `/odeme`'ye girişte başlıyor. Geri sayım arayüzü `/odeme` chunk'ında olduğu için görülemedi.

### 3.4 Ödeme `/odeme` — adımlar ve alanlar
`/odeme` login gerektiriyor ve route'a özel JS chunk'ı ancak oturum açıkken yükleniyor. Turbopack'te herkese açık bir chunk listesi de olmadığından bu chunk alınamadı. Aşağıdaki akış site metinleri, yasal metinler ve diğer chunk'lardaki enum'lardan yeniden kuruldu. Her madde kaynağıyla birlikte veriliyor:
1. **Giriş / üyelik**: misafir `/giris?next=/odeme`'ye yönleniyor; kayıt sihirbazındaki son buton "Ödemeye devam et".
2. **Kimlik (KYC)**: "Kimlik bilgileri yalnızca ilk siparişte istenir" (kayıt sayfası). `/hesap/kimlik` route'u var. Profilde TCKN alanı "İlk siparişte istenir" ya da maskeli `123*****45` gösteriyor. KVKK ve MASAK metinlerine göre toplananlar: ad, soyad, doğum tarihi, T.C. kimlik no, kimlik belgesi türü/no/görüntüsü, uyruk, anne-baba adı (eşik aşılırsa). Kart sahibi ile üye adı uyuşmazsa ek doğrulama isteniyor.
3. **Teslimat yöntemi** (`shippingMethod`): `CARGO` sigortalı kargo (ücretsiz, 1–3 iş günü) · `MOTO` moto kurye (İstanbul, <200.000 ₺) · `PICKUP` Gel Al (mağaza; 3 iş günü bekletilir) · `ACCOUNT` altın hesabına havale (hesaba havale ürünü; "Ödemede altın hesabınızın **IBAN**'ını yazın; hesap adınıza olmalı").
4. **Teslimat zamanı** (Vadeli Altın): hemen veya 15/30/45/60/90 gün (−%0,5/1/1,75/2/3, kilitli ara toplam üzerinden). Siparişte `deliveryDays` ve `deliveryDueAt` alanları var.
5. **Teslimat adresi**: adres defteri `/hesap/adresler`. Hediyede alıcının adresi girilebiliyor. Belirsiz adresler (otopark, kapı önü) kabul edilmiyor.
6. **Fatura**: Bireysel / **Kurumsal** seçimi ("Fatura adımında Kurumsal seçin"). Faturalar `/hesap/faturalar`'da (e-arşiv entegratörü).
7. **Hediye notu** (opsiyonel; "pakete fiyatlı belge konmaz").
8. **Ödeme yöntemi**: **Kredi/banka kartı (3D Secure)** veya **Havale/EFT** (yalnızca sipariş sahibinin kendi kartı/hesabı). Taksit ya da başka yöntemden hiç bahsedilmiyor. Gümüşte havaleye %2 indirim (max 2.000 ₺). İlk siparişte 5.000 ₺+ için 250 ₺ indirim otomatik düşüyor.
9. **Onaylar**: **Ön Bilgilendirme Formu** ve **Mesafeli Satış Sözleşmesi** elektronik onayı (sözleşme "sipariş onaylandığı anda kurulur", bir örneği e-postayla gidiyor). Cayma hakkı olmadığı bilgilendirmesi var (MSY m.15/1-a).
10. Sonuç: sipariş no `TKM<YYYYMMDD><4 hane>` (örn. TKM202609170001), e-posta ve SMS. Kart ödemesinde 3DS onayıyla birlikte sipariş kesinleşiyor ve iptal edilemiyor.

Sipariş durumları (OrderTrack chunk'ı): `PAYMENT_PENDING → PAID / COMPLIANCE_REVIEW → PREPARING → PACKED → SHIPPED → DELIVERED / COMPLETED`, ayrıca `CANCELLED`, `REFUNDED`, `PAYMENT_FAILED*`. Yolculuk etiketleri: Sipariş alındı · Ödeme onaylandı · Hazırlanıyor · Paketlendi · (kargo: Yolda · Teslim edildi | Gel Al: Teslime hazır · Teslim edildi | Hesap: Aktarılıyor · Hesaba geçti). Durum ekranında Teslimat (kargo firması + takip no), Zaman çizelgesi, Ürünler (ad × adet, gram), Toplam ve Sipariş günlüğü (events) var.

### 3.5 Ödeme sağlayıcısı: **iyzico**
- Kanıt: HTTP `Content-Security-Policy` başlığında `frame-src 'self' https://*.iyzipay.com https://*.iyzico.com; form-action 'self' https://*.iyzipay.com https://*.iyzico.com`. Başka sağlayıcıya (PayTR, Param, Sipay vb.) ait hiçbir iz yok.
- `script-src 'self'` olduğu için iyzico'nun JS'i (checkout form script'i) yüklenemez. Buna göre olası entegrasyon şöyle: sunucu iyzico **Checkout Form / ödeme sayfası** başlatıyor ve sayfa `/odeme` içinde **iframe** olarak gömülüyor (frame-src). Ya da tarayıcı iyzico'ya form-post veya yönlendirme yapıyor (form-action). Kart bilgisi Tempo'ya hiç gelmiyor ("kart bilgileri Tempo'ya iletilmez"; sistemde yalnızca ilk 6 ve son 4 hane ile işlem referansı tutuluyor).
- Dönüş adresi: **`/api/odeme/callback`** (GET isteğine `400 {"error":"Geçersiz istek"}` dönüyor, yani iyzico'nun POST callback'i).
- Düzenli Birikim: kart iyzico'da saklanıyor (kart saklama). Dönem tahsilatları **3DS'siz** kayıtlı karttan çekiliyor (Birikim Talimatı ile açık rıza). `tk_birikim` çerezi (1 saat) dönemin ödeme linkini o döneme bağlıyor.
- Kesin teyit (iframe mi, yönlendirme mi) ancak giriş yapılmış bir oturumda `/odeme` chunk'ına bakılarak alınabilir.

---

## 4. Diğer formlar ve endpoint'ler (ayrıntı `endpoints.json`)
- JSON: `GET /api/fiyatlar` (20 kotasyon: HAS_ALTIN, GRAM_ALTIN, AYAR22, AYAR18, AYAR14, CEYREK, YARIM, TAM, ATA, RESAT, IKIBUCUK, BESLI, GREMSE, GUMUS, PLATIN, PALADYUM, USD, EUR, GBP, CHF; alanlar `{key,name,buy,sell,changePct}` + `updatedAt`), `POST /api/odeme/callback`. Başka `/api/*` yok; denenen tüm adayları 404 döndü.
- Server Actions: cart ×4, favori, login, şifremi unuttum, şifre sıfırla, profil güncelle, kayıt ×4, sipariş takip, iletişim, hesaptan fiziki talep. Hepsi aynı sayfa URL'ine POST ve `Next-Action: <id>` başlığı kullanıyor. ID'ler her deploy'da değişir; PWA'nın bunlara doğrudan bağlanması kırılgan olur, kendi API'mizi kurmak gerekir.
- **Sipariş takip** formu: `orderNo` (TKM… veya kargo takip no), `phone`.
- **İletişim** formu: `website` (honeypot), `name`, `email`, `phone?`, `type` (CONTACT Genel / SIPARIS / IADE / DIGER), `subject`, `orderNo?`, `message` (min 10), `kvkk` (zorunlu checkbox).
- **Hesaptan fiziki** formu: `fullName`, `phone`, `email`, `bank` (örn. Kuveyt Türk), `gram` (decimal), `delivery` (PICKUP / CARGO), `note?` (max 500), `kvkk`.
- **Favoriler**: kalp butonu, login gerekiyor. **Fiyat alarmı**: login gerekiyor, kanal e-posta veya SMS (`/hesap/alarmlar`).
- Dış servisler: yok. Analytics, harita, reCAPTCHA, chat yok (CSP `connect-src 'self'`). Cloudflare e-posta gizleme script'i ve WhatsApp linki var. SMS ve e-posta sağlayıcısının adı geçmiyor (KVKK yalnızca "SMS ve e-posta servis sağlayıcıları, e-fatura/e-arşiv entegratörü, barındırma" diyor). Çerez Politikası üçüncü taraf takip çerezi olmadığını belirtiyor.

## 5. Kimlik doğrulama
- **Giriş** (`/giris`): `email` + `password`. Hesapta 2FA açıksa sunucu `needsTotp` döndürüyor ve "2FA kodu (Google/Microsoft Authenticator)" alanı (`totp`, 6 hane) çıkıyor. `next` gizli alanı var. Telefonla veya OTP ile giriş yok.
- **Kayıt** (`/kayit`, 4 adım):
  1. Ülke kodu (28 ülke, varsayılan +90) ve cep numarası ("Başında 0 olmadan, 5 ile başlayan 10 hane") girilir, `signupSendOtpAction` çağrılır. Numara zaten kayıtlıysa "giriş yapın / şifrenizi sıfırlayın" gösteriliyor. Demo modunda kod ekranda görünüyor ("Demo modu — SMS gönderilmedi, kod: …").
  2. **6 haneli SMS OTP** (yapıştırma destekli, 60 sn yeniden gönderme sayacı), `signupVerifyOtpAction`, dönen `token` sonraki adımlarda kullanılıyor.
  3. E-posta, `signupCheckEmailAction`.
  4. Ad, Soyad (min 2), Şifre (min 8, harf ve rakam; 4 kademeli güç göstergesi), zorunlu Üyelik Sözleşmesi + KVKK onayı (`kvkk`), opsiyonel ticari ileti izni (`marketing`), sonra `signupCompleteAction`. Kullanıcı otomatik giriş yapıyor ve e-postasına doğrulama linki (`/dogrula?token=`) gidiyor.
  - TC kimlik kayıtta istenmiyor, ilk siparişte isteniyor.
- Şifremi unuttum (`email`) → e-postadaki link → `/sifre-sifirla?token=` (`password` min 8).
- Profil: firstName, lastName, phone, e-posta (salt okunur), TCKN (maskeli, salt okunur), smsNotifications, marketing, şifre değiştirme (currentPassword, newPassword).
- Oturum çerezi: **`tk_session`** (30 gün). Personel paneli `tk_panel` (8 saat, ayrı adreste). Şifreler bcrypt ile saklanıyor. Başarısız denemeler sınırlanıyor.

## 6. Tasarım (kısa)
- Fontlar: **Anek Latin** (sans; `--font-sans`, değişken genişlik `'wdth' 88` başlıklarda) ve **Instrument Serif** (display/italic vurgular, `<em>`). Sayılar için `.fin` sınıfı (tabular), kuruş küçük yazılıyor (`.kurus`).
- Açık tema token'ları: `--gold #d5aa45`, `--gold-deep #9a7a2a`, `--gold-light #e7c766`, `--bg #f4efe6`, `--bg-2 #ece7dd`, `--surface #fff`, `--surface-2 #f7f4ee`, `--ink #1b1916`, `--body #2a2622`, `--muted #6b635a`, `--up #2e8b57`, `--down #c2261f`, `--warning #925d00`; marka yeşili `#005447` / `#003d34` (sertifika kartı, hata sayfası). `--radius-ctl 12px`, `--radius-card 24px`. Koyu tema `[data-theme=dark]` (çerez ve localStorage `tk_theme`).
- Bileşen sınıfları: btn (primary / secondary / gold / ghost / soft / outline / link, sm / lg), card, tile, chip, seg, counter, otp-box, wizard, journey (sipariş yolculuğu), sim (birikim simülatörü), ticker, banner, plinth (ürün görsel zemini, multiply). Banner temaları: satin, green, obsidian, paper (gradyanlar `0uaugsclfm_8p.js` içinde).
- Ürün görseli yoksa sertifika kartı SVG olarak üretiliyor (yeşil kart, altın şerit, QR, barkod, "SERTİFİKA / CERTIFICATE · TA000000").

## 7. Eksikler / doğrulanamayanlar
- `/odeme` UI'si, `/hesap/*` sayfaları ve dolu sepetteki özet kutusu login veya POST gerektirdiği için görülemedi. Moto kurye ücreti, kilit geri sayım arayüzü, adres ve fatura form alanlarının tam adları, iyzico'nun iframe mi yönlendirme mi olduğu da bu nedenle açık. Bunları kesinleştirmek için bir test hesabıyla oturum açıp CDP ile `/odeme`'nin chunk'larını ve ağ trafiğini izlemek gerekiyor (`arac/test-surucu.mjs`).
- Blog boş. Sitedeki telefon, vergi no ve MERSİS yer tutucu değerler.
