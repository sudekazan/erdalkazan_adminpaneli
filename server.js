require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erdalkazan';

// The public site works without these, but the admin panel and image
// uploads do not, so say so loudly at startup.
const missing = ['ADMIN_PASSWORD', 'JWT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  .filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.warn(`UYARI: Şu ortam değişkenleri tanımlı değil: ${missing.join(', ')}. Admin girişi veya görsel yükleme çalışmayacak.`);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB bağlantısı kuruldu');
    const server = app.listen(PORT, () => {
      console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
    });

    // docker stop / systemd send SIGTERM: finish open requests, then exit.
    const shutdown = (signal) => {
      console.log(`${signal} alındı, sunucu kapatılıyor...`);
      server.close(() => {
        mongoose.disconnect().finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('MongoDB bağlantı hatası:', err);
    process.exit(1);
  });
