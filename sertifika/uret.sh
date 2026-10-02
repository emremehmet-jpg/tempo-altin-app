#!/bin/zsh
# Geliştirme için yerel HTTPS sertifikası üretir.
#
# Neden gerekli: iPhone'da tarayıcı canlı kamerayı yalnızca https adreslerde
# açar. Bu betik bir "kök sertifika" (CA) ve onunla imzalı bir sunucu
# sertifikası üretir. Kök sertifika iPhone'a BİR KEZ kurulur (kurulum
# sayfasında anlatılıyor); sunucu sertifikası Mac'in adresi değişince
# bu betik yeniden çalıştırılarak tazelenir (kök aynı kalır, telefonda
# yeniden bir şey yapmak gerekmez).
#
# Kullanım:  zsh sertifika/uret.sh
set -e
cd "$(dirname "$0")"

AD=$(scutil --get LocalHostName)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)
GUN=825   # iOS'un kabul ettiği en uzun süre

if [ ! -f ca.key ]; then
  echo "Kök sertifika üretiliyor (bir kez)..."
  openssl genrsa -out ca.key 2048 2>/dev/null
  cat > ca.cnf <<CNF
[req]
distinguished_name=dn
x509_extensions=v3
prompt=no
[dn]
CN=Tempo Doviz Gelistirme CA
O=Tempo Doviz
[v3]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
CNF
  openssl req -x509 -new -key ca.key -sha256 -days $GUN -config ca.cnf -out ca.crt
fi

echo "Sunucu sertifikası üretiliyor: $AD.local, $IP"
cat > server.ext <<EXT
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
subjectAltName=DNS:localhost,DNS:$AD.local,DNS:$(echo $AD | tr 'A-Z' 'a-z').local,IP:127.0.0.1,IP:$IP
EXT
openssl genrsa -out server.key 2048 2>/dev/null
openssl req -new -key server.key -subj "/CN=Tempo Doviz Uygulamasi/O=Tempo Doviz" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days $GUN -sha256 -extfile server.ext -out server.crt 2>/dev/null
rm -f server.csr
echo "Tamam: sertifika/server.crt ($AD.local, $IP)"
