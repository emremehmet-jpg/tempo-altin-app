# Kapı logosunu (public/kapi/logo.png) İKİ AYRI kanat görseline ayırır:
#   public/kapi/kanat-doviz.png (sol-üst) ve public/kapi/kanat-altin.png (sağ-alt).
# Kanatlar pikselde zaten iki ayrı parça → bağlı bileşen etiketiyle kesin ayrılır
# (eski clip-path zikzağı bir kanadın ucunu öbür tarafta bırakıyordu).
# Netlik için: kenardaki zemin sızıntısı temizlenir, 2 kat büyütülüp
# keskinleştirilir, gölge görsele işlenir — iPhone'da filtreli + dönen katman
# düşük çözünürlükte çiziliyordu.
# 2 Eki 2026'dan beri kaynak altın O (arac/o-zemin-ayir.py üretir); Döviz kanadı
# aynı metalik ışıkla kurumsal Parliament (#1B2F52) tonuna boyanır (PARLIAMENT).
# Kullanım: python3 arac/kanat-ayir.py   (pillow, numpy, scipy gerekir)
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

KAYNAK = "public/kapi/logo.png"
KES = (150, 874)        # 1024'lük tuvalde kırpılan kare (gölge payı dahil)
OLCEK = 2

img = np.array(Image.open(KAYNAK).convert("RGBA")).astype(np.float64)
rgb, al = img[..., :3] / 255, img[..., 3] / 255

# 1) Kenar renk temizliği: yalnız yarı saydam kenar piksellerine en yakın opak
#    rengi ver (logonun kendi ince açık kenar çizgisi opak, korunur)
ic = al > 0.99
_, (iy, ix) = nd.distance_transform_edt(~ic, return_indices=True)
rgb = rgb[iy, ix]

# 2) Döviz kanadı için metalik Parliament: altının parlaklığı (ışık/gölge
#    bantları) korunur, renk lacivert rampasından okunur. Rampanın ortası
#    Parliament #1B2F52; parlak bantlar çelik mavisine, en parlak ışık beyaza gider.
PARLIAMENT = [(0.00, (0x0a, 0x13, 0x26)), (0.45, (0x1b, 0x2f, 0x52)), (0.72, (0x2c, 0x47, 0x78)),
              (0.88, (0x5c, 0x7c, 0xb2)), (0.97, (0xb4, 0xc6, 0xe4)), (1.00, (0xe8, 0xef, 0xf9))]
def parliament(rgb, maske):
    Y = rgb @ np.array([.2126, .7152, .0722])
    lo, hi = np.percentile(Y[maske], [1, 99.5])
    t = np.clip((Y - lo) / (hi - lo), 0, 1)
    xs = [d for d, _ in PARLIAMENT]
    return np.dstack([np.interp(t, xs, [c[i] / 255 for _, c in PARLIAMENT]) for i in range(3)])

# 3) Kanatları ayır: iki büyük parça; kırıntılar en yakın parçaya
lab, n = nd.label(al > 0.04)
boy = nd.sum(np.ones_like(al), lab, range(1, n + 1))
buyuk = np.argsort(boy)[-2:] + 1
_, (ky, kx) = nd.distance_transform_edt(~np.isin(lab, buyuk), return_indices=True)
sahip = lab[ky, kx]

a0, a1 = KES
cx = cy = 511.5
W = (a1 - a0) * OLCEK
merkezler = {}
for etiket in buyuk:
    m = (sahip == etiket) & (al > 0)
    yy, xx = np.nonzero(m)
    agirlik = al[yy, xx]
    gx, gy = np.average(xx, weights=agirlik), np.average(yy, weights=agirlik)
    ad = "doviz" if gy < cy else "altin"     # sol-üst = Döviz
    a = np.where(m, al, 0)
    kanat_rgb = parliament(rgb, m & (al > .5)) if ad == "doviz" else rgb

    renk = Image.fromarray((kanat_rgb[a0:a1, a0:a1] * 255).round().astype(np.uint8))
    renk = renk.resize((W, W), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=45, threshold=2))
    alfa = Image.fromarray((a[a0:a1, a0:a1] * 255).round().astype(np.uint8)).resize((W, W), Image.LANCZOS)
    # kenarı sıkılaştır (yumuşak ama keskin geçiş)
    A = np.asarray(alfa).astype(np.float64) / 255
    A = np.clip((A - .5) * 1.3 + .5, 0, 1)

    # 4) Gölge (eski CSS: drop-shadow 0 10px 16px rgba(0,0,0,.4) — 520 px kutuda)
    k = 1024 / 520 * OLCEK
    golge = nd.gaussian_filter(nd.shift(A, (10 * k, 0), order=1), sigma=8 * k) * .4
    C = np.asarray(renk).astype(np.float64) / 255
    out_a = A + golge * (1 - A)
    out_rgb = np.where(out_a[..., None] > 0, C * A[..., None] / np.maximum(out_a, 1e-6)[..., None], 0)
    out = np.dstack([out_rgb, out_a])
    Image.fromarray((out * 255).round().astype(np.uint8)).save(f"public/kapi/kanat-{ad}.png", optimize=True)

    # çekme hareketi için: kanadın ağırlık merkezi (kutuya göre %) ve dışa yön
    dx, dy = gx - cx, gy - cy
    L = (dx * dx + dy * dy) ** .5
    merkezler[ad] = {"ox": round((gx - a0) / (a1 - a0) * 100, 1), "oy": round((gy - a0) / (a1 - a0) * 100, 1),
                     "yx": round(dx / L, 3), "yy": round(dy / L, 3)}

print(json.dumps({"kutu_sol_ust_%": round(a0 / 1024 * 100, 3), "kutu_genislik_%": round((a1 - a0) / 1024 * 100, 3), **merkezler}))
