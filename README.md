# Erdal Kazan - Web Sitesi ve Admin Paneli

Erdal Kazan'ın makina boya web sitesi ve projelerin yönetildiği admin paneli.
Ana sayfa projeleri API'den okur; admin panelinden proje eklenir, düzenlenir ve silinir.
Görseller Cloudinary'de, proje bilgileri MongoDB'de tutulur.

## Özellikler

- Proje yönetimi (ekleme, düzenleme, silme, listeleme)
- Projeye çoklu görsel yükleme ve tek tek görsel silme
- Proje silinince görsellerinin Cloudinary'den de silinmesi
- Mobil uyumlu ana sayfa ve admin paneli
- JWT oturumu (HTTP-only çerez), giriş deneme sınırı

## Gereksinimler

- Node.js 20 veya üzeri (Docker imajı Node 22 kullanır)
- MongoDB (yerel veya MongoDB Atlas)
- Cloudinary hesabı

## Kurulum

```bash
git clone https://github.com/sudekazan/erdalkazan_adminpaneli.git
cd erdalkazan_adminpaneli
npm install
cp .env.example .env   # sonra .env içindeki değerleri doldurun
npm run dev            # geliştirme (nodemon ile) - ya da: npm start
```

Ana sayfa: `http://localhost:3000` - Admin paneli: `http://localhost:3000/admin`

## Ortam değişkenleri

Tüm değişkenler açıklamalarıyla `.env.example` dosyasında.

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `MONGO_URI` | evet | MongoDB bağlantı adresi |
| `ADMIN_PASSWORD` | evet | Admin şifresi; düz metin veya bcrypt hash'i |
| `JWT_SECRET` | evet | Oturum imzalama anahtarı (uzun, rastgele) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | evet | Görsel yükleme |
| `NODE_ENV` | hayır | `production` ise oturum çerezi yalnızca HTTPS ile gönderilir |
| `TRUST_PROXY` | hayır | Ters proxy arkasında `1` (gerçek ziyaretçi IP'si için) |
| `PORT` | hayır | Varsayılan `3000` |

`ADMIN_PASSWORD` veya `JWT_SECRET` tanımlı değilse site çalışır ama admin girişi kapalı kalır.
Giriş kontrolü her ortamda geçerlidir; geliştirme modunda da şifreyle giriş yapılır.

Şifreyi hash olarak saklamak için:

```bash
node -e "console.log(require('bcryptjs').hashSync('sifreniz', 12))"
```

Çıkan değeri `ADMIN_PASSWORD` yapın. docker compose `.env` dosyasında hash içindeki her `$` işaretini `$$` olarak yazın.

## Görsel yükleme kuralları

- Desteklenen türler: JPG, PNG, WEBP
- Görsel başına en fazla 10 MB
- Bir kayıtta en fazla 10 yeni görsel (düzenlerken tekrar ekleyebilirsiniz)

Kurallar hem tarayıcıda hem sunucuda uygulanır. Kurala uymayan bir istekte, o istekte yüklenen görseller Cloudinary'den geri silinir.

## Güvenlik

- Admin sayfaları ve tüm yazma işlemleri geçerli oturum ister.
- Aynı yerden 5 hatalı şifre denemesinden sonra giriş 15 dakika kilitlenir.
- Proje verileri sayfalarda HTML olarak değil metin olarak gösterilir (XSS koruması).
- Site başka sitelerin içine gömülemez (X-Frame-Options); CORS kapalıdır.
- `npm audit` CI'da her çalıştırmada kontrol edilir.

## Testler

```bash
npm test
```

Testler MongoDB veya Cloudinary gerektirmez: veritabanı kayıtları ve Cloudinary çağrıları bellekte taklit edilir, geri kalan her şey (Express, rotalar, oturum, yükleme, Mongoose doğrulaması) gerçek çalışır.
`test/ui.test.js` gerçek tarayıcıda çalışır ve Playwright ister; Playwright kurulu değilse bu testler atlanır:

```bash
npm install --no-save playwright && npx playwright install chromium
```

## Yayına alma

`main` dalına her gönderimde GitHub Actions (`.github/workflows/sunucuya-yayinla.yml`):

1. Testleri ve bağımlılık taramasını çalıştırır.
2. Geçerse Docker imajını derleyip `ghcr.io/sudekazan/erdalkazan` olarak yükler.
3. Sunucuda `docker compose pull/up` ile servisi günceller.

Gereken GitHub secret'ları: `SERVER_IP`, `SSH_PRIVATE_KEY` ve önerilen `SSH_KNOWN_HOSTS` (`ssh-keyscan -H SUNUCU_IP` çıktısı).
`SSH_KNOWN_HOSTS` yoksa sunucu anahtarı doğrulanmadan kabul edilir.

Docker imajı `/healthz` uç noktasıyla sağlık kontrolü yapar (MongoDB bağlı değilse kapsayıcı "unhealthy" görünür).

## Komutlar

- `npm start`: Uygulamayı başlatır
- `npm run dev`: Değişikliklerde otomatik yeniden başlatır (nodemon)
- `npm test`: Testleri çalıştırır
