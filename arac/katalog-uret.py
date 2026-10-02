# tempoaltin.com araştırma verisinden (kaynak/tempoaltin-site/) uygulamanın
# katalog dosyasını üretir: public/veri/katalog.json + public/veri/sozlesmeler/*.md
#
#   python3 arac/katalog-uret.py
#
# Ürünlerin değişmeyen bilgileri (ad, gram, açıklama, özellikler, görseller,
# fiyat formülü) buraya gömülür. FİYATLAR gömülmez: server.mjs sitenin arama
# sayfasından canlı okur (/api/altin/urun-fiyatlari); okunamazsa uygulama
# formülü canlı kotasyonla (/api/altin/fiyatlar) uygular.
# Site ürün eklerse/çıkarırsa: araştırmayı tazele (kaynak/tempoaltin-site/RAPOR.md)
# ve bu betiği yeniden çalıştır. Paket gerektirmez.
import json, os, re, shutil

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAK = os.path.join(KOK, "kaynak", "tempoaltin-site")
HEDEF = os.path.join(KOK, "public", "veri")

urunler = json.load(open(os.path.join(KAYNAK, "urunler.json"), encoding="utf-8"))["products"]
kat = json.load(open(os.path.join(KAYNAK, "kategoriler.json"), encoding="utf-8"))

def gorsel_yolu(i):
    # "https://tempoaltin.com/urun/x-1.jpg" → "/urun/x-1.jpg" (sitedeki yol)
    return re.sub(r"^https?://[^/]+", "", i["url"])

cikti_urun = []
for p in urunler:
    r = p["price"]["rule"]
    cikti_urun.append({
        "id": p["id"],                      # sitenin productId'si (sepet bunu bekler)
        "slug": p["slug"],
        "ad": p["name"],
        "tamAd": p["fullName"],
        "tur": p["kind"],                   # BULLION | COIN | JEWELRY | ACCOUNT_TRANSFER
        "metal": p["metal"],                # GOLD | SILVER
        "kategori": p["categoryPath"],      # [ana, alt?]
        "sira": p["orderInCategory"],
        "gram": p["weightGr"],
        "gramMetin": p["weightText"],
        "ozet": p["summaryLine"],
        "ayar": p.get("ayar"),
        "saflik": p.get("purity"),
        "birim": p["qtyUnit"],              # Adet | Gram
        "enFazla": p["maxQty"],
        "aciklama": p["description"],
        "ozellik": p["specs"],
        "gorsel": [gorsel_yolu(i) for i in p["images"]],
        "kampanya": p["campaigns"],
        "varyant": [v["slug"] for v in p.get("weightVariants") or []],
        # Fiyat formülü (yedek): satış = kot[satisKot].sell × (gram × saflık | 1) × satisCarpan
        "formul": {
            "tip": "gram" if r["type"] == "per_gram" else "adet",
            "satisKot": r["sellQuote"], "satisCarpan": r["sellFactor"], "saflik": r.get("purityFactor", 1),
            "alisKot": r["buyQuote"], "alisCarpan": r["buyFactor"],
            "alisSaflik": r.get("buyPurityFactor", r.get("purityFactor", 1)),
        },
    })

cikti_kat = []
for c in kat["categories"]:
    cikti_kat.append({k2: c[k1] for k1, k2 in [("slug", "slug"), ("name", "ad"), ("desc", "aciklama"),
                                                ("parent", "ust"), ("order", "sira"), ("children", "alt"),
                                                ("products", "urunler")] if k1 in c})

os.makedirs(HEDEF, exist_ok=True)
json.dump({"kaynak": "tempoaltin.com (2 Eki 2026)", "kategoriler": cikti_kat, "urunler": cikti_urun},
          open(os.path.join(HEDEF, "katalog.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# Sözleşmeler: başlıktaki kaynak/title yorumları atılır, metin olduğu gibi
sd = os.path.join(HEDEF, "sozlesmeler")
os.makedirs(sd, exist_ok=True)
for f in sorted(os.listdir(os.path.join(KAYNAK, "sayfalar", "sozlesmeler"))):
    t = open(os.path.join(KAYNAK, "sayfalar", "sozlesmeler", f), encoding="utf-8").read()
    t = re.sub(r"^<!--.*?-->\n", "", t, flags=re.M).lstrip()
    open(os.path.join(sd, f), "w", encoding="utf-8").write(t)

print(f"{len(cikti_urun)} ürün, {len(cikti_kat)} kategori, {len(os.listdir(sd))} sözleşme → public/veri/")
