# Kapı logosunu (public/kapi/logo.png) İKİ AYRI kanat görseline ayırır:
#   public/kapi/kanat-doviz.png (sol-üst) ve public/kapi/kanat-altin.png (sağ-alt).
# Kanatlar pikselde zaten iki ayrı parça → bağlı bileşen etiketiyle kesin ayrılır
# (eski clip-path zikzağı bir kanadın ucunu öbür tarafta bırakıyordu).
# Netlik için: kenardaki açık zemin sızıntısı temizlenir, 2 kat büyütülüp
# keskinleştirilir, canlılık (saturate 1.25, contrast 1.12) ve gölge görsele işlenir
# — iPhone'da filtreli + dönen katman düşük çözünürlükte çiziliyordu.
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

# 2) Canlılık — CSS saturate(1.25) contrast(1.12) ile aynı formül
s = 1.25
M = np.array([[.213 + .787 * s, .715 - .715 * s, .072 - .072 * s],
              [.213 - .213 * s, .715 + .285 * s, .072 - .072 * s],
              [.213 - .213 * s, .715 - .715 * s, .072 + .928 * s]])
rgb = np.clip(rgb @ M.T, 0, 1)
rgb = np.clip((rgb - .5) * 1.12 + .5, 0, 1)

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

    renk = Image.fromarray((rgb[a0:a1, a0:a1] * 255).round().astype(np.uint8))
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
