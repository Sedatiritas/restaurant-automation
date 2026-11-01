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
  auth/         # Personel rol seçimi ve giriş ekranı
  partials/     # Ortak EJS head ve script şablonları

src/
  controllers/  # Sayfa ve kimlik doğrulama controller'ları
  middlewares/  # Rol ve oturum kontrolü
  routes/       # Sayfa ve kimlik doğrulama route'ları
  lib/          # Prisma istemcisi ve imzalı oturum yardımcıları
  app.ts        # Express uygulama yapılandırması
  server.ts     # Yerel geliştirme sunucusu

prisma/         # Prisma şeması ve migration dosyaları
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

4. `.env` dosyasında PostgreSQL bağlantısını ve en az 32 karakterli rastgele `SESSION_SECRET` değerini ayarla. PowerShell'de secret üretmek için:

   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   ```

5. Prisma Client'ı oluştur ve veritabanı tablolarını uygula:

   ```powershell
   npm run db:generate
   npm run db:migrate -- --name init
   ```

6. Geliştirme sunucusunu başlat:

   ```powershell
   npm run dev
   ```

7. Tarayıcıdan ekranları aç:

   - Müşteri menüsü: http://localhost:3000/
   - Personel girişi: http://localhost:3000/login
   - Yönetim paneli: http://localhost:3000/admin
   - Garson: http://localhost:3000/waiter
   - Kasa: http://localhost:3000/cashier

> Yönetim, kasiyer ve garson ekranları giriş gerektirir. Girişte rol seçilir; rol, e-posta ve parola veritabanındaki kullanıcı hesabıyla doğrulanır. İlk kullanıcı hesabı henüz otomatik oluşturulmaz; migration sonrasında başlangıç yönetici hesabı eklenmelidir. Parolalar Argon2 ile doğrulanır, oturum çerezi HttpOnly ve SameSite=Strict olarak ayarlanır. Oturum süresi 8 saattir.
