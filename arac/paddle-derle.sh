#!/bin/zsh
# PaddleOCR tarayıcı paketini yeniden derler (public/lens/vendor/paddle/paddle-ocr.js).
# Normalde gerekmez; paket sürümü değişirse çalıştırılır. npm + internet ister.
set -e
V="$(cd "$(dirname "$0")/.." && pwd)/public/lens/vendor"   # cd'den ÖNCE çözülmeli
D=$(mktemp -d); cd "$D"
npm init -y >/dev/null
npm install --silent @gutenye/ocr-browser@1.4.8 onnxruntime-web@1.29.0 esbuild
# --- YAMALAR (kütüphanenin varsayılanları menü/el yazısı için uygun değil) ---
# Her yama grep ile doğrulanır; paket sürümü değişip metin kayarsa derleme durur.
C=node_modules/@gutenye/ocr-common/build
B=node_modules/@gutenye/ocr-browser/build
yama() { sed -i '' "s|$1|$2|" "$3"; grep -qF -- "$4" "$3" || { echo "YAMA tutmadı: $4"; exit 1; }; }
# 1) Metin olasılık eşiği 0,03 → 0,3 (DB standardı); lens.js window.TEMPO_OCR.esik ile değiştirebilir.
yama 'outputToImage(modelOutput, 0\.03)' 'outputToImage(modelOutput, (globalThis.TEMPO_OCR?.esik ?? 0.3))' $C/models/Detection.js 'TEMPO_OCR?.esik'
# 2) Kutu genişletme oranı da ayarlanabilir.
yama 'const unclip_ratio = 1\.5;' 'const unclip_ratio = (globalThis.TEMPO_OCR?.unclip ?? 1.5);' $C/backend/splitIntoLineImages.js 'TEMPO_OCR?.unclip'
# 3) Uzun/dik kutuyu 90° çevirme KAPALI: kütüphane dikey Çince metin varsayıyor;
#    bizde tek haneli "1"/"7" ya da alt alta birleşmiş sayılar dik kutu verir, çevrilince çöp okunur.
yama 'if (dst_img_height / dst_img_width >= 1\.5) {' 'if (false) { /* Tempo: döndürme kapalı */' $C/backend/splitIntoLineImages.js 'döndürme kapalı'
# 4) Aynı hizadaki kutuları tek satıra birleştirme (afAfRec) kapalı: her sayının kendi kutusu kalsın.
yama 'mainLine = afAfRec(mainLine);' '/* afAfRec kapalı (Tempo) */' $C/models/Recognition.js 'afAfRec kapalı'
# 5) Algılama ve tanıma ayrı ayrı çağrılabilsin (lens.js aradaki kutuları böler).
yama 'this.#recognition = recognition;' 'this.#recognition = recognition; this.detection = detection; this.recognition = recognition;' $C/Ocr.js 'this.detection = detection'
# 6) Tarayıcı ImageRaw sınıfı dışarı: bölünmüş kutulardan tanıma girdisi üretmek için.
printf '\nexport { ImageRaw };\n' >> $B/index.js   # dosya satır sonu olmadan bitiyor; yorum satırına yapışmasın
cat > giris.js <<'JS'
import Ocr, { ImageRaw } from "@gutenye/ocr-browser";
import { env } from "onnxruntime-web";
window.PaddleOcr = { Ocr, ImageRaw, env };
JS
# --alias: WebGPU'suz küçük ONNX derlemesi (14 MB; jsep sürümü 28 MB)
# --external: opencv.js'in Node'a özgü require'ları; tarayıcıda o dallara girilmiyor
npx esbuild giris.js --bundle --format=iife --minify --platform=browser \
  --alias:onnxruntime-web=onnxruntime-web/wasm \
  --external:path --external:fs --external:crypto --external:url --external:module \
  --external:worker_threads --external:perf_hooks --external:os --external:child_process \
  --outfile=paddle-ocr.js
cp paddle-ocr.js "$V/paddle/"
cp node_modules/@gutenye/ocr-models/assets/ch_PP-OCRv4_det_infer.onnx "$V/paddle/det.onnx"
cp node_modules/@gutenye/ocr-models/assets/ch_PP-OCRv4_rec_infer.onnx "$V/paddle/rec.onnx"
cp node_modules/@gutenye/ocr-models/assets/ppocr_keys_v1.txt "$V/paddle/keys.txt"
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.{mjs,wasm} "$V/ort/"
echo "Tamam: $V"
