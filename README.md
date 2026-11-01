# Roast & Co. — QR Menü

Restoranlar için geliştirilen web tabanlı QR menü ve sipariş yönetimi uygulaması.

Uygulamada müşteri menüsü, restoran yönetim paneli, garson ekranı ve kasa ekranı bulunur. Sayfalar Express üzerinden EJS şablonlarıyla sunulur; mevcut HTML arayüzleri korunarak sunucu taraflı sayfa yapısına taşınmıştır.

## Teknolojiler

- Node.js 24
- Express 5
- TypeScript
- EJS
- PostgreSQL
- Prisma 7
- HTML, CSS, Vanilla JavaScript
- Bootstrap 5.3.8

## Proje yapısı

```text
public/
  css/          # Tarayıcıya sunulan CSS dosyaları
  js/           # Tarayıcıya sunulan JavaScript dosyaları

views/
  menu/         # Müşteri QR menüsü
  admin/        # Restoran yönetim paneli
  waiter/       # Garson ekranı
  cashier/      # Kasa ekranı
  partials/     # Ortak EJS head ve script şablonları

src/
  controllers/  # Sayfa controller'ları
  middlewares/  # Express middleware'leri
  routes/       # Express route tanımları
  app.ts        # Express uygulama yapılandırması
  server.ts     # Yerel geliştirme sunucusu

prisma/         # Prisma şeması ve migration dosyaları (sonraki aşama)
```

## Yerel geliştirme

1. Node.js 24 kurulu olmalı.
2. Proje klasöründe bağımlılıkları yükle:

   ```powershell
   npm install
   ```

3. Gerekli ortam değişkenleri için örnek dosyayı kopyala:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Geliştirme sunucusunu başlat:

   ```powershell
   npm run dev
   ```

5. Tarayıcıdan ekranları aç:

   - Müşteri menüsü: http://localhost:3000/
   - Yönetim paneli: http://localhost:3000/admin
   - Garson: http://localhost:3000/waiter
   - Kasa: http://localhost:3000/cashier

> PostgreSQL ve Prisma bağlantısı henüz yapılandırılmadı. Bu aşamada EJS sayfaları Express üzerinden sunulur; veritabanı entegrasyonu sonraki geliştirme adımıdır.
