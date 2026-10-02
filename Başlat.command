#!/bin/zsh
# Çift tıkla: sertifikayı tazeler (Mac'in adresi değişmiş olabilir),
# sunucuyu açar, telefon adreslerini ekrana yazar.
cd "$(dirname "$0")"
echo "Tempo Altın uygulaması başlatılıyor..."
zsh sertifika/uret.sh >/dev/null 2>&1 || echo "(sertifika tazelenemedi, http ile devam)"
node server.mjs
