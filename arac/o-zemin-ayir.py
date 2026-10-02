# Lacivert zeminli altın O görselini (marka/o-altin-lacivert-1024.png) şeffaf
# logoya çevirir → public/kapi/logo.png (kanat-ayir.py'nin kaynağı).
# Zemin koyu lacivert, logo altın: zemin rengi yerel olarak tahmin edilir,
# kenar pikselleri en yakın iç renkle zeminden "ayrıştırılır" (alfa + renk).
# Kapı ölçüleri eski logoya göre kurulu (merkez 511,5, dış R 291, yazı yarıçapı
# 312/342) → logo merkez etrafında R 281 → 291 ölçeklenir.
# Kullanım: python3 arac/o-zemin-ayir.py   (pillow, numpy, scipy gerekir)
import numpy as np
from PIL import Image
from scipy import ndimage as nd

KAYNAK = "marka/o-altin-lacivert-1024.png"
HEDEF_R = 291

P = np.array(Image.open(KAYNAK).convert("RGB")).astype(np.float64) / 255
R = P[..., 0]

# Zemin: kırmızısı düşük pikseller; logonun altındaki zemin normalize bulanıklıkla doldurulur
zemin = R < 70 / 255
zemin = nd.binary_erosion(zemin, iterations=3)
w = nd.gaussian_filter(zemin.astype(float), 12)
B = np.dstack([nd.gaussian_filter(P[..., c] * zemin, 12) for c in range(3)]) / np.maximum(w, 1e-6)[..., None]

# Logo içi: kesin opak bölge; kenar bandında renk en yakın iç pikselden
ic = nd.binary_erosion(R > 120 / 255, iterations=2)
_, (iy, ix) = nd.distance_transform_edt(~ic, return_indices=True)
F = P[iy, ix]
d = F - B
alfa = np.clip(((P - B) * d).sum(-1) / np.maximum((d * d).sum(-1), 1e-6), 0, 1)
alfa[ic] = 1
alfa[nd.distance_transform_edt(~ic) > 4] = 0           # uzaktaki zemin gürültüsü
C = np.clip((P - (1 - alfa[..., None]) * B) / np.maximum(alfa, 1e-6)[..., None], 0, 1)
C = np.where(alfa[..., None] > .5, C, F)                # ince kenarda renk = iç renk

rgba = Image.fromarray((np.dstack([C, alfa]) * 255).round().astype(np.uint8))

# Ölçek: dış yarıçap HEDEF_R olsun, merkez sabit
yy, xx = np.nonzero(alfa > .5)
cx, cy = (xx.min() + xx.max()) / 2, (yy.min() + yy.max()) / 2
r = np.hypot(xx - cx, yy - cy).max()
k = HEDEF_R / r
yeni = round(1024 * k)
buyuk = rgba.resize((yeni, yeni), Image.LANCZOS)
tuval = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
ox, oy = round(511.5 - cx * k), round(511.5 - cy * k)
tuval.paste(buyuk, (ox, oy))
tuval.save("public/kapi/logo.png", optimize=True)
print(f"merkez {cx:.1f},{cy:.1f}  R {r:.1f} → {HEDEF_R} (×{k:.4f})")
