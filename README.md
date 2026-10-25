# Roast & Co. — QR Menü ve Restoran Yönetim Arayüzü

Restoranlar için dijital menü, ürün ve kategori yönetimi, masa/sipariş takibi ve kasa ekranlarını bir araya getiren web arayüzü projesi.

> **Proje durumu:** Frontend prototipi. Yönetim ve garson ekranlarında örnek veriler tarayıcı depolamasında tutulur. Backend ve veritabanı henüz bu repoda bulunmuyor; kasa ekranındaki API bağlantıları backend geliştirmesi için hazırlanmıştır.

## İçindekiler

- [Özellikler](#özellikler)
- [Teknolojiler](#teknolojiler)
- [Yerelde çalıştırma](#yerelde-çalıştırma)
- [Proje yapısı](#proje-yapısı)
- [Veri saklama ve mevcut sınırlar](#veri-saklama-ve-mevcut-sınırlar)
- [Kasa için planlanan API sözleşmesi](#kasa-için-planlanan-api-sözleşmesi)
- [Sonraki geliştirme adımları](#sonraki-geliştirme-adımları)

## Özellikler

### Müşteri menüsü — `index.html`
- Mobil uyumlu dijital menü arayüzü.
- Kategori listesinde yatay kaydırma.
- Ürün arama ve kategori filtreleme.
- İşletme bilgileri ve iletişim bağlantıları için alanlar.

### Yönetim paneli — `admin.html`
- Ürün ve kategori yönetimi arayüzü.
- Masa ekleme, düzenleme ve silme.
- İşletme ve menü görünümünü özelleştirme alanları.
- Personel ve yetki yönetimi için arayüz.

### Garson paneli — `waiter.html`
- Masa listesini ve adisyon durumlarını görüntüleme.
- Masanın sipariş geçmişini inceleme.
- Ürünleri seçerek yeni sipariş turu oluşturma.
- Siparişi mutfağa gönderme akışını prototip olarak deneme.

### Kasa paneli — `cashier.html`
- Açık adisyonlar ve tüm masalar arasında filtreleme.
- Masanın siparişlerini ve ürün tutarlarını görüntüleme.
- Aynı üründen gelen adetleri ayrı satırlarda gösterme.
- Ürünleri kişi bazında seçip toplam tutarı dinamik hesaplama.
- Adisyonu kapatmadan önce onay isteme.

Kasa arayüzünde gösterilen örnek masa ve ürünler tanıtım/prototip amaçlıdır. Backend tamamlanmadan bu örnek işlemler veritabanında kalıcı kayıt oluşturmaz.

## Teknolojiler

- HTML5
- CSS3
- JavaScript (Vanilla JS)
- Bootstrap 5.3.8
- Bootstrap Icons 1.13.1
- Tarayıcı depolaması: prototip ekranlarında `localStorage`

Proje şu an statik frontend dosyalarından oluşur; Node.js sunucusu, veritabanı veya npm bağımlılık kurulumu gerektirmez.

## Yerelde çalıştırma

### Seçenek 1: VS Code Live Server

1. Repoyu bilgisayarına klonla:
   ```bash
   git clone https://github.com/Sedatiritas/restaurant-automation.git
   cd restaurant-automation
   ```
2. Klasörü VS Code ile aç.
3. **Live Server** eklentisiyle `index.html` dosyasını çalıştır.

Diğer ekranları doğrudan şu dosyalardan açabilirsin: `admin.html`, `waiter.html` ve `cashier.html`.

### Seçenek 2: Python ile statik sunucu

Proje kök klasöründe terminal açıp çalıştır:

```bash
py -m http.server 5500
```

Ardından tarayıcıda [http://localhost:5500/index.html](http://localhost:5500/index.html) adresini aç. Windows ortamında `py` komutu yoksa `python -m http.server 5500` komutunu deneyebilirsin.

> **Not:** Kasa ekranındaki gerçek API istekleri, ilgili backend uç noktaları yazılana kadar çalışmayacaktır. Backend bulunmadığında arayüz örnek görünümünü kullanır.

## Proje yapısı

```text
restaurant-automation/
├── index.html          # Müşteri dijital menüsü
├── admin.html          # Yönetim paneli
├── waiter.html         # Garson ve sipariş ekranı
├── cashier.html        # Kasa ve adisyon paylaşımı ekranı
├── css/
│   ├── style.css       # Müşteri menüsü stilleri
│   ├── admin.css       # Yönetim paneli stilleri
│   ├── waiter.css      # Garson paneli stilleri
│   └── cashier.css     # Kasa paneli stilleri
└── js/
    ├── script.js       # Müşteri menüsü davranışları
    ├── admin.js        # Yönetim paneli davranışları
    ├── waiter.js       # Garson ve sipariş akışı
    └── cashier.js      # Kasa ve adisyon hesaplamaları
```

## Veri saklama ve mevcut sınırlar

- Müşteri menüsü, yönetim ve garson prototipleri bazı ayarları, ürünleri, masaları ve siparişleri aynı tarayıcıdaki `localStorage` üzerinden paylaşır.
- `localStorage` verileri sunucuya gönderilmez; başka cihazlar veya tarayıcılarla otomatik senkronize olmaz.
- Personel/yetki ekranları şu anda gerçek kimlik doğrulama veya sunucu tarafı yetkilendirme yerine arayüz prototipidir.
- Üretim ortamında kullanmadan önce backend, veritabanı, kimlik doğrulama, rol bazlı sunucu yetkilendirmesi ve işletme bazlı veri izolasyonu eklenmelidir.

## Kasa için planlanan API sözleşmesi

Kasa arayüzü aşağıdaki uç noktaları bekleyecek şekilde hazırlanmıştır. **Bu uç noktaların backend uygulaması henüz repoda yoktur.**

| Yöntem | Uç nokta | Amaç |
| --- | --- | --- |
| `GET` | `/api/cashier/tables` | Masa listesini ve açık adisyon özetlerini getirir. |
| `GET` | `/api/cashier/tables/:id/bill` | Seçilen masanın sipariş turlarını ve toplamını getirir. |
| `POST` | `/api/cashier/tables/:id/close` | Masa adisyonunu sunucu tarafında kapatır. |

Masa listesi yanıtının `tables` dizisi; masa kimliği, adı, kişi kapasitesi, açık adisyon durumu, açık toplam ve sipariş turu sayısı gibi alanlar içerebilir. Adisyon yanıtında `table`, `orders` ve `total` alanları beklenir; her sipariş ürünü için ürün adı, birim fiyat ve miktar gerekir.

Backend geliştirilirken adisyon kapatma işlemi sunucu tarafında doğrulanmalı; kullanıcının rolü ve işletme kapsamı kontrol edilmeli; başarılı kapatma işlemi veritabanında kalıcı olarak kaydedilmelidir. Arayüzdeki ürün seçimleri yalnızca hangi tutarın kişi bazında hesaplandığını belirler; masanın tüm adisyonunu kapatma tutarını değiştirmez.

## Sonraki geliştirme adımları

- [ ] Backend ve veritabanı şemasını oluşturma.
- [ ] Ürün, kategori, masa, sipariş ve adisyon verilerini API üzerinden yönetme.
- [ ] Güvenli giriş, parola hashleme ve sunucu tarafı rol kontrolü ekleme.
- [ ] Kasa API uç noktalarını uygulama ve kapatma akışını kalıcı hâle getirme.
- [ ] Örnek/seed verilerini backend'e geçiş tamamlandığında ayırma veya kaldırma.
- [ ] Uçtan uca testler ve dağıtım yapılandırması ekleme.

---

**Geliştirme notu:** Bu repo bir arayüz prototipidir; gerçek müşteri, sipariş veya ödeme verilerini yönetmek için üretime hazır bir restoran otomasyonu olarak değerlendirilmemelidir.
