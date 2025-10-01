# Erdal Kazan - Admin Panel

Bu proje, Erdal Kazan'ın kişisel web sitesi için yönetim panelidir. Bu panel üzerinden projeleri yönetebilir, yeni projeler ekleyebilir, düzenleyebilir ve silebilirsiniz.

## Özellikler

- Proje yönetimi (Ekleme, Düzenleme, Silme, Listeleme)
- Çoklu görsel yükleme desteği
- Responsive tasarım
- Güvenli kimlik doğrulama
- MongoDB veritabanı entegrasyonu

## Gereksinimler

- Node.js (v14 veya üzeri)
- MongoDB (yerel veya MongoDB Atlas)
- npm veya yarn

## Kurulum

1. Projeyi klonlayın:
   ```bash
   git clone https://github.com/sudekazan/erdalkazan.git
   cd erdalkazan
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. `.env` dosyasını oluşturun ve gerekli ortam değişkenlerini ayarlayın:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/erdalkazan
   ADMIN_PASSWORD=guvenli_sifre
   JWT_SECRET=guvenli_jwt_anahtari
   NODE_ENV=development
   ```

4. MongoDB bağlantısını sağlayın:
   - Yerel bir MongoDB örneği çalıştırın veya
   - MongoDB Atlas kullanıyorsanız, bağlantı dizenizi `MONGO_URI` değişkenine ekleyin

5. Uygulamayı başlatın:
   ```bash
   # Geliştirme modunda başlat
   npm run dev
   
   # Veya üretim modunda başlat
   npm start
   ```

6. Tarayıcıda şu adresi açın:
   ```
   http://localhost:3000/admin
   ```

## Kullanım

### Admin Paneline Giriş
1. Tarayıcınızı açın ve `http://localhost:3000/admin` adresine gidin
2. `.env` dosyasında belirttiğiniz şifreyi kullanarak giriş yapın

### Yeni Proje Ekleme
1. Ana sayfadan "Yeni Proje" butonuna tıklayın
2. Gerekli alanları doldurun
3. İlgili görselleri yükleyin
4. "Kaydet" butonuna tıklayın

### Proje Düzenleme
1. Düzenlemek istediğiniz projenin yanındaki "Düzenle" butonuna tıklayın
2. İstediğiniz değişiklikleri yapın
3. "Değişiklikleri Kaydet" butonuna tıklayın

### Proje Silme
1. Silmek istediğiniz projenin yanındaki "Sil" butonuna tıklayın
2. Açılan onay kutusunda "Sil" butonuna tıklayın

## Görsel Yükleme
- Her projeye en fazla 10 adet görsel yükleyebilirsiniz
- Desteklenen dosya türleri: JPG, PNG, GIF
- Maksimum dosya boyutu: 10MB
- Toplam maksimum boyut: 50MB

## Güvenlik
- Tüm admin rotaları kimlik doğrulama gerektirir
- Şifreler güvenli bir şekilde hash'lenmiştir
- JWT tabanlı kimlik doğrulama kullanılmaktadır
- HTTP-only çerezler kullanılarak güvenli oturum yönetimi sağlanmaktadır

## Geliştirme

### Ortam Değişkenleri
- `PORT`: Uygulamanın çalışacağı port (varsayılan: 3000)
- `MONGO_URI`: MongoDB bağlantı dizesi
- `ADMIN_PASSWORD`: Admin paneli şifresi
- `JWT_SECRET`: JWT imzalama için kullanılacak gizli anahtar
- `NODE_ENV`: Uygulama ortamı (development/production)

### Komutlar
- `npm start`: Uygulamayı üretim modunda başlatır
- `npm run dev`: Uygulamayı geliştirme modunda başlatır (nodemon ile)
- `npm test`: Testleri çalıştırır

## Lisans
Bu proje MIT lisansı altında lisanslanmıştır. Daha fazla bilgi için `LICENSE` dosyasına bakın.
