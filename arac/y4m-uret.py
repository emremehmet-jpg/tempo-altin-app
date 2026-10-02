# PNG → y4m (sahte kamera akışı). Kullanım: python3 y4m-uret.py girdi.png cikti.y4m
# Pillow gerekir (python3 -m venv v && v/bin/pip install pillow).
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("YCbCr"); w, h = im.size
y, cb, cr = im.split(); cb = cb.resize((w // 2, h // 2)); cr = cr.resize((w // 2, h // 2))
with open(sys.argv[2], "wb") as f:
    f.write(f"YUV4MPEG2 W{w} H{h} F30:1 Ip A1:1 C420jpeg\n".encode())
    for _ in range(10): f.write(b"FRAME\n" + y.tobytes() + cb.tobytes() + cr.tobytes())
print("y4m", w, h)
