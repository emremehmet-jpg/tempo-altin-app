<!-- kaynak: https://tempoaltin.com/sozlesmeler/guvenlik -->
<!-- title: Güvenlik Politikası | Tempo Altın -->
<!-- description: Güvenlik Politikası — Tempo Altın yasal bilgilendirme metni. -->

# Güvenlik Politikası

Son güncelleme: Eylül 2026

Tempo Altın olarak müşterilerimizin bilgi ve işlem güvenliğini en üst düzeyde tutmayı taahhüt ediyoruz. Site’de gerçekleştirdiğiniz tüm işlemler ve paylaştığınız bilgiler güncel güvenlik standartlarıyla korunur.

## SSL ile Şifreli Bağlantı

Site’nin tamamı 256-bit SSL/TLS sertifikası ile korunur; tarayıcınız ile sunucularımız arasındaki tüm veri akışı şifrelenir. Adres çubuğundaki kilit simgesi ve “https://” ile başlayan adres, bağlantınızın şifreli olduğunu gösterir. Kimlik, iletişim ve sipariş bilgileriniz bu kanal üzerinden iletilir.

## 3D Secure ile Güvenli Ödeme

Sitede yapılan kart ödemeleri 3D Secure protokolü ile yapılır: bankanız, kayıtlı telefonunuza tek kullanımlık doğrulama kodu gönderir; kod girilmeden işlem tamamlanmaz. Böylece kart hamili dışında kimsenin kartınızla alışveriş yapması engellenir. Ödeme yalnızca sipariş sahibine ait kartla kabul edilir; kart üzerindeki ad ile üyelik adının uyuşmaması halinde ek doğrulama istenir. Tek istisna, [Düzenli Birikim Talimatı](/sozlesmeler/birikim-talimati) ile açık rızanızı verdiğiniz kayıtlı kart tahsilatlarıdır; bu tahsilatlar da yalnızca sizin adınıza kayıtlı kartla ve ödeme kuruluşunda saklanan güvenli kart belirteciyle yapılır.

## Kart Bilgileriniz Saklanmaz

Kart numarası, son kullanma tarihi ve CVV bilgileri sunucularımızda hiçbir şekilde saklanmaz; doğrudan lisanslı ödeme kuruluşunun PCI DSS uyumlu altyapısına şifreli olarak iletilir. Sistemlerimizde yalnızca kartın ilk 6 ve son 4 hanesi ile işlem referansı tutulur.

## Hesap Güvenliği

- Şifreler geri döndürülemez şekilde (bcrypt) saklanır; personelimiz dahil kimse şifrenizi göremez.

- Telefon numarası SMS ile, e-posta bağlantı ile doğrulanır; hassas işlemlerde tek kullanımlık kod istenir.

- Başarısız giriş ve ödeme denemeleri sınırlandırılır; şüpheli hareketlerde hesap geçici olarak kilitlenir.

- Yönetici erişimleri iki aşamalı doğrulama ile korunur ve tüm işlemler denetim kaydına alınır.

## Fiyat Kilidi ve İşlem Bütünlüğü

Ödeme sayfasındaki fiyat sunucu tarafında kilitlenir; tarayıcıda görünen tutar ile tahsil edilen tutar her zaman aynıdır. Piyasa verisinin güncelliği sürekli izlenir; veri gecikirse satış otomatik olarak durdurulur.

## Teslimat Güvenliği

Gönderiler içeriği belli olmayan ambalajla, bedelinin tamamı üzerinden sigortalı taşınır ve yalnızca sipariş sahibine kimlik ibrazı ile teslim edilir.

## Kişisel Verileriniz

Paylaştığınız tüm bilgiler 6698 sayılı KVKK kapsamında korunur; yalnızca siparişin tamamlanması ve yasal yükümlülüklerimiz için işlenir. Ayrıntı için [Gizlilik Politikası ve KVKK Aydınlatma Metni](/sozlesmeler/kvkk)’ni inceleyiniz.

## Şüpheli Durumlarda

Hesabınızda veya ödemelerinizde olağandışı bir durum fark ederseniz vakit kaybetmeden (0216) 000 00 00 numarasından veya info@tempoaltin.com adresinden bize ulaşın.
