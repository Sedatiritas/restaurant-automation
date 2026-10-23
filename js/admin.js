document.addEventListener("DOMContentLoaded", function () {
  const root = document.getElementById("viewRoot");
  const title = document.getElementById("pageTitle");
  const crumb = document.getElementById("breadcrumbCurrent");
  const toastEl = document.getElementById("adminToast");
  const toastMessage = document.getElementById("adminToastMessage");
  const toast = window.bootstrap ? bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2600 }) : null;
  const modalEl = document.getElementById("appModal");
  const modal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
  const modalContent = document.getElementById("modalContent");

  const defaults = {
    products: [
      {id:1,name:"Cappuccino",category:"Kahveler",price:125,description:"Espresso, süt ve yumuşak süt köpüğü.",status:"active",image:"https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=120&q=75"},
      {id:2,name:"Çilekli Cheesecake",category:"Tatlılar",price:165,description:"Kremamsı cheesecake ve çilek sosu.",status:"active",image:"https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=120&q=75"},
      {id:3,name:"Iced Latte",category:"Soğuk içecekler",price:140,description:"Soğuk süt, espresso ve buz.",status:"out",image:"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=120&q=75"},
      {id:4,name:"Flat White",category:"Kahveler",price:130,description:"Yoğun espresso ve ince süt köpüğü.",status:"active",image:""},
      {id:5,name:"Americano",category:"Kahveler",price:100,description:"Espresso ve sıcak su.",status:"active",image:""},
      {id:6,name:"Limonlu Cheesecake",category:"Tatlılar",price:155,description:"Limon aromalı hafif cheesecake.",status:"hidden",image:""},
      {id:7,name:"Matcha Latte",category:"Soğuk içecekler",price:150,description:"Matcha ve süt ile hazırlanır.",status:"active",image:""},
      {id:8,name:"Filtre Kahve",category:"Kahveler",price:95,description:"Günün seçili çekirdekleriyle.",status:"active",image:""},
      {id:9,name:"San Sebastian",category:"Tatlılar",price:170,description:"Dışı karamelize, içi yumuşak.",status:"active",image:""},
      {id:10,name:"Çay",category:"Çaylar",price:45,description:"Demlikte taze siyah çay.",status:"active",image:""}
    ],
    categories: [
      {id:1,name:"Kahveler",icon:"bi-cup-hot",description:"Sıcak kahve çeşitleri"},
      {id:2,name:"Soğuk içecekler",icon:"bi-cup-straw",description:"Soğuk kahve ve içecekler"},
      {id:3,name:"Tatlılar",icon:"bi-cake2",description:"Günlük tatlı çeşitleri"},
      {id:4,name:"Çaylar",icon:"bi-cup",description:"Sıcak çaylar"},
      {id:5,name:"Atıştırmalıklar",icon:"bi-egg-fried",description:"Hafif atıştırmalıklar"},
      {id:6,name:"Smoothie",icon:"bi-droplet",description:"Meyveli smoothie çeşitleri"},
      {id:7,name:"Fresh içecekler",icon:"bi-sun",description:"Taze meyve içecekleri"},
      {id:8,name:"Kahvaltı",icon:"bi-egg",description:"Kahvaltı seçenekleri"}
    ],
    staff: [
      {id:1,name:"Ayşe Yılmaz",email:"ayse@example.com",role:"Garson",status:"active"},
      {id:2,name:"Mehmet Demir",email:"mehmet@example.com",role:"Kasiyer",status:"active"},
      {id:3,name:"Zeynep Kaya",email:"zeynep@example.com",role:"Garson",status:"inactive"}
    ],
    settings: {businessName:"Roast & Co.",phone:"",email:"",address:"",instagram:"",whatsapp:"",description:"Kahve, tatlı ve güzel anlar."},
    appearance: {brandName:"roast & co.",tagline:"COFFEE · DESSERT · MOMENTS",eyebrow:"HER FİNCANDA MUTLULUK",headline:"Kendine güzel bir mola ver.",logo:"",cover:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80",accent:"#b96e43",isOpen:true,locationLabel:"Bizi ziyaret et",locationText:"Şehrin kalbinde",hoursLabel:"Çalışma saatleri",hoursText:"09.00 – 23.00"}
  };
  function imageFileToDataUrl(file,maxSize) {
    return new Promise(function(resolve,reject){
      if(!file.type.startsWith("image/")){reject(new Error("not-image"));return;}
      const reader=new FileReader();reader.onerror=reject;reader.onload=function(){
        const image=new Image();image.onerror=reject;image.onload=function(){
          const scale=Math.min(1,maxSize/Math.max(image.width,image.height));
          const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
          canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/webp",0.82));
        };image.src=reader.result;
      };reader.readAsDataURL(file);
    });
  }
  function load(key) {
    try { const saved = localStorage.getItem("roastAdmin_" + key); return saved ? JSON.parse(saved) : structuredClone(defaults[key]); }
    catch (e) { return JSON.parse(JSON.stringify(defaults[key])); }
  }
  const state = { products:load("products"), categories:load("categories"), staff:load("staff"), settings:load("settings"), appearance:load("appearance"), view:"overview", productSearch:"", productCategory:"all", productStatus:"all" };
  function save(key) { try { localStorage.setItem("roastAdmin_" + key, JSON.stringify(state[key])); return true; } catch (e) { notify("Tarayıcı depolama alanı doldu. Daha küçük görseller seçin."); return false; } }
  function notify(message) {
    if (!toast || !toastMessage) { window.alert(message); return; }
    toastMessage.textContent = message;
    toast.show();
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char];
    });
  }
  function money(value) { return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(Number(value)||0); }
  function categoryOptions(selected) {
    return state.categories.map(function (cat) { return '<option value="' + escapeHtml(cat.name) + '" ' + (cat.name===selected?"selected":"") + '>' + escapeHtml(cat.name) + '</option>'; }).join("");
  }
  function statusLabel(status) {
    if (status==="active") return '<span class="status-pill status-live">Yayında</span>';
    if (status==="out") return '<span class="status-pill status-out">Tükendi</span>';
    if (status==="inactive") return '<span class="status-pill status-hidden">Pasif</span>';
    return '<span class="status-pill status-hidden">Taslak</span>';
  }
  function productThumb(product) {
    return product.image ? '<span class="product-thumb"><img src="' + escapeHtml(product.image) + '" alt="" loading="lazy"></span>' : '<span class="product-thumb"><i class="bi bi-cup-hot"></i></span>';
  }
  function pageHeading(eyebrow, heading, description, button) {
    return '<div class="page-heading"><div><span class="eyebrow">' + eyebrow + '</span><h2>' + heading + '</h2><p>' + description + '</p></div>' + (button||"") + '</div>';
  }
  function statCard(label, value, icon, tone, foot) {
    return '<article class="stat-card"><div class="stat-top"><span>' + label + '</span><span class="stat-icon ' + (tone||"") + '"><i class="bi ' + icon + '"></i></span></div><div class="stat-number">' + value + '</div><div class="stat-foot">' + foot + '</div></article>';
  }
  function productRows(products) {
    if (!products.length) return '<tr><td colspan="6"><div class="empty-state"><i class="bi bi-search"></i><strong>Ürün bulunamadı</strong><p>Arama veya filtre seçimini değiştirin.</p></div></td></tr>';
    return products.map(function (p) {
      return '<tr><td><div class="product-cell">' + productThumb(p) + '<span><strong>' + escapeHtml(p.name) + '</strong><small>' + escapeHtml(p.description||"Açıklama eklenmemiş") + '</small></span></div></td><td>' + escapeHtml(p.category) + '</td><td class="price-cell">' + money(p.price) + '</td><td>' + statusLabel(p.status) + '</td><td><button class="table-action" type="button" data-action="edit-product" data-id="' + p.id + '" aria-label="Ürünü düzenle"><i class="bi bi-pencil"></i></button></td><td><div class="table-actions"><button class="table-action" type="button" data-action="toggle-product" data-id="' + p.id + '" title="Yayın durumunu değiştir"><i class="bi bi-' + (p.status==="active"?"eye-slash":"eye") + '"></i></button><button class="table-action danger" type="button" data-action="delete-product" data-id="' + p.id + '" title="Ürünü sil"><i class="bi bi-trash3"></i></button></div></td></tr>';
    }).join("");
  }
  function overviewView() {
    const active = state.products.filter(function(p){return p.status==="active";}).length;
    const out = state.products.filter(function(p){return p.status==="out";}).length;
    return '<section class="welcome-banner"><div class="welcome-copy"><span class="eyebrow" style="color:#e5b994">İŞLETMENİZİN DİJİTAL MENÜSÜ</span><h2>Gününüz güzel geçsin.</h2><p>Ürünlerinizi, kategorilerinizi ve müşteri menünüzün görünümünü tek yerden yönetin.</p><button class="btn btn-primary-soft" data-action="navigate" data-view="products">Ürünleri yönet <i class="bi bi-arrow-right ms-2"></i></button></div><div class="welcome-art" aria-hidden="true"><span class="art-ring"></span><span class="art-cup"><i class="bi bi-cup-hot-fill"></i></span></div></section>' +
      '<section class="stats-grid">' +
      statCard("Toplam ürün",state.products.length,"bi-box-seam","","Menüde kayıtlı ürün") +
      statCard("Yayında",active,"bi-eye","green","Müşterilerin görebildiği ürünler") +
      statCard("Kategoriler",state.categories.length,"bi-collection","purple","Menü grupları") +
      statCard("Tükendi",out,"bi-exclamation-circle","orange","Stok durumu işaretli ürünler") + '</section>' +
      '<section class="dashboard-grid"><div class="dashboard-main">' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Hızlı işlemler</h3><p>Menü yönetiminde sık kullandığınız işlemler.</p></div></div><div class="quick-grid">' +
      '<a href="#products" class="quick-link" data-view="products"><span class="quick-icon"><i class="bi bi-plus-lg"></i></span><span><strong>Ürün ekle veya düzenle</strong><small>Fiyat, açıklama ve yayın durumu</small></span></a>' +
      '<a href="#categories" class="quick-link" data-view="categories"><span class="quick-icon"><i class="bi bi-collection"></i></span><span><strong>Kategorileri düzenle</strong><small>Menü gruplarını yönetin</small></span></a>' +
      '<a href="#appearance" class="quick-link" data-view="appearance"><span class="quick-icon purple"><i class="bi bi-palette2"></i></span><span><strong>Menü tasarımını düzenle</strong><small>Marka, kapak ve renkler</small></span></a>' +
      '<a href="#qr" class="quick-link" data-view="qr"><span class="quick-icon green"><i class="bi bi-qr-code"></i></span><span><strong>QR kodunu hazırla</strong><small>Menü bağlantısını paylaşın</small></span></a></div></article>' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Ürünler</h3><p>Menüde kayıtlı son ürünler.</p></div><a href="#products" class="text-link" data-view="products">Tüm ürünler <i class="bi bi-arrow-right ms-1"></i></a></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>ÜRÜN</th><th>KATEGORİ</th><th>FİYAT</th><th>DURUM</th><th></th><th></th></tr></thead><tbody>' + productRows(state.products.slice(0,5)) + '</tbody></table></div></article>' +
      '</div><div class="dashboard-aside">' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Müşteri menüsü</h3><p>Menünüzü yeni sekmede kontrol edin.</p></div><span class="status-pill status-live">Önizleme</span></div><div class="appearance-preview mx-3 mb-3"><div class="preview-brand"><span class="brand-mark" style="width:35px;height:35px;flex-basis:35px;border-radius:10px"><i class="bi bi-cup-hot-fill"></i></span><span><strong>' + escapeHtml(state.appearance.brandName) + '</strong><small>' + escapeHtml(state.appearance.tagline) + '</small></span></div><div class="preview-cover" style="background-image:linear-gradient(100deg,#261e17d9,#261e1733),url(&quot;' + escapeHtml(state.appearance.cover) + '&quot;)"><span>' + escapeHtml(state.appearance.eyebrow) + '</span><strong>' + escapeHtml(state.appearance.headline).replace(/\\n/g,"<br>") + '</strong></div></div><div class="p-3 pt-0"><a href="index.html" target="_blank" rel="noopener noreferrer" class="btn btn-outline-soft w-100">Müşteri menüsünü aç <i class="bi bi-arrow-up-right ms-2"></i></a></div></article>' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Menü durumu</h3><p>Yönetim panelindeki kayıt özeti.</p></div></div><div class="px-3 pb-3"><div class="setting-row"><span><strong>Yayındaki ürünler</strong><small>Müşteri menüsünde görünür</small></span><strong>' + active + '</strong></div><div class="setting-row"><span><strong>Taslak / pasif ürünler</strong><small>Menüde gizli</small></span><strong>' + state.products.filter(function(p){return p.status==="hidden";}).length + '</strong></div><div class="setting-row"><span><strong>Personel hesabı</strong><small>Kayıtlı personel</small></span><strong>' + state.staff.length + '</strong></div></div></article>' +
      '</div></section>';
  }
  function productsView() {
    const filtered = state.products.filter(function(p) {
      const matchesSearch = (p.name + " " + p.description).toLocaleLowerCase("tr").includes(state.productSearch.toLocaleLowerCase("tr"));
      return matchesSearch && (state.productCategory==="all" || p.category===state.productCategory) && (state.productStatus==="all" || p.status===state.productStatus);
    });
    return pageHeading("MENÜ İÇERİĞİ","Ürünler","Ürün ekleyin, fiyatları güncelleyin ve ürünlerin müşterilere görünürlüğünü yönetin.",'<button class="btn btn-primary-soft" data-action="add-product"><i class="bi bi-plus-lg me-2"></i>Yeni ürün</button>') +
      '<section class="panel-card"><div class="toolbar"><div class="toolbar-start"><label class="search-control"><i class="bi bi-search"></i><input id="productSearch" class="form-control" type="search" placeholder="Ürün ara..." value="' + escapeHtml(state.productSearch) + '" aria-label="Ürün ara"></label><select id="productCategoryFilter" class="form-select" aria-label="Kategori filtresi"><option value="all">Tüm kategoriler</option>' + state.categories.map(function(c){return '<option value="' + escapeHtml(c.name) + '" ' + (state.productCategory===c.name?"selected":"") + '>' + escapeHtml(c.name) + '</option>';}).join("") + '</select><select id="productStatusFilter" class="form-select" aria-label="Durum filtresi"><option value="all">Tüm durumlar</option><option value="active" ' + (state.productStatus==="active"?"selected":"") + '>Yayında</option><option value="out" ' + (state.productStatus==="out"?"selected":"") + '>Tükendi</option><option value="hidden" ' + (state.productStatus==="hidden"?"selected":"") + '>Taslak / gizli</option></select></div><div class="toolbar-end"><span class="text-muted small">' + filtered.length + ' ürün</span></div></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>ÜRÜN</th><th>KATEGORİ</th><th>FİYAT</th><th>DURUM</th><th>DÜZENLE</th><th>İŞLEMLER</th></tr></thead><tbody>' + productRows(filtered) + '</tbody></table></div></section>';
  }
  function categoriesView() {
    return pageHeading("MENÜ İÇERİĞİ","Kategoriler","Müşteri menüsündeki ürün gruplarını oluşturun ve düzenleyin.",'<button class="btn btn-primary-soft" data-action="add-category"><i class="bi bi-plus-lg me-2"></i>Kategori ekle</button>') +
      '<div class="category-grid">' + state.categories.map(function(c){
        const count=state.products.filter(function(p){return p.category===c.name;}).length;
        return '<article class="category-card"><span class="category-symbol"><i class="bi ' + escapeHtml(c.icon||"bi-collection") + '"></i></span><div class="category-info"><strong>' + escapeHtml(c.name) + '</strong><small>' + count + ' ürün · ' + escapeHtml(c.description||"Açıklama yok") + '</small></div><div class="category-actions"><button class="table-action" data-action="edit-category" data-id="' + c.id + '" aria-label="Kategoriyi düzenle"><i class="bi bi-pencil"></i></button><button class="table-action danger" data-action="delete-category" data-id="' + c.id + '" aria-label="Kategoriyi sil"><i class="bi bi-trash3"></i></button></div></article>';
      }).join("") + '</div>';
  }
  function appearanceView() {
    const a=state.appearance;
    const isOpen=a.isOpen!==false;
    return pageHeading("MENÜ TASARIMI","Menü Görünümü","Müşteri menünüzün üst bölümünü ve işletme bilgilerini kolayca özelleştirin.") +
      `<div class="appearance-editor">
        <form id="appearanceForm" class="appearance-form">
          <input type="hidden" name="currentLogo" value="${escapeHtml(a.logo||"")}">
          <input type="hidden" name="currentCover" value="${escapeHtml(a.cover||"")}">
          <section class="appearance-section">
            <div class="appearance-section-heading"><span class="appearance-section-icon"><i class="bi bi-shop"></i></span><div><h3>İşletme durumu</h3><p>Menüde işletmenizin açık veya kapalı olduğunu gösterin.</p></div></div>
            <div class="business-status-control ${isOpen?"is-open":"is-closed"}">
              <div><strong id="businessStatusTitle">${isOpen?"İşletme açık":"İşletme kapalı"}</strong><small id="businessStatusHelp">${isOpen?"Müşteriler menüde Açığız bilgisini görecek.":"Müşteriler menüde Kapalıyız bilgisini kırmızı renkte görecek."}</small></div>
              <div class="form-check form-switch status-switch"><input class="form-check-input" type="checkbox" role="switch" id="isOpenToggle" name="isOpen" value="true" ${isOpen?"checked":""}><label class="form-check-label" for="isOpenToggle">Açığız</label></div>
            </div>
          </section>
          <section class="appearance-section">
            <div class="appearance-section-heading"><span class="appearance-section-icon"><i class="bi bi-type"></i></span><div><h3>Marka ve logo</h3><p>İşletmenizin adını, kısa sloganını ve logosunu ekleyin.</p></div></div>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="brandName">İşletme adı</label><input class="form-control" id="brandName" name="brandName" required maxlength="60" value="${escapeHtml(a.brandName)}"></div>
              <div class="col-md-6"><label class="form-label" for="tagline">Kısa slogan</label><input class="form-control" id="tagline" name="tagline" maxlength="100" value="${escapeHtml(a.tagline)}" placeholder="Örn. Kahve · Tatlı · Mutluluk"></div>
              <div class="col-12"><label class="form-label" for="logoFile">Logo görseli</label><input class="form-control" id="logoFile" name="logoFile" type="file" accept="image/*"><div class="form-text">Bilgisayarınızdan PNG, JPG veya WebP seçebilirsiniz.</div><div class="image-upload-preview mt-2" id="logoPreview">${a.logo?`<img src="${escapeHtml(a.logo)}" alt="Logo önizlemesi">`:"<span>Henüz logo seçilmedi</span>"}</div><button class="btn btn-sm btn-outline-soft mt-2" type="button" data-action="remove-logo"><i class="bi bi-trash3 me-1"></i>Logoyu kaldır</button></div>
            </div>
          </section>
          <section class="appearance-section">
            <div class="appearance-section-heading"><span class="appearance-section-icon"><i class="bi bi-geo-alt"></i></span><div><h3>Ziyaret ve çalışma saatleri</h3><p>Müşterilerin işletmenizi bulmasına yardımcı olacak bilgileri girin.</p></div></div>
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label" for="locationLabel">Konum başlığı</label><input class="form-control" id="locationLabel" name="locationLabel" maxlength="60" value="${escapeHtml(a.locationLabel||"Bizi ziyaret et")}"></div>
              <div class="col-md-6"><label class="form-label" for="locationText">Konum bilgisi</label><input class="form-control" id="locationText" name="locationText" maxlength="100" value="${escapeHtml(a.locationText||"Şehrin kalbinde")}" placeholder="Örn. Adana, Seyhan"></div>
              <div class="col-md-6"><label class="form-label" for="hoursLabel">Saatler başlığı</label><input class="form-control" id="hoursLabel" name="hoursLabel" maxlength="60" value="${escapeHtml(a.hoursLabel||"Çalışma saatleri")}"></div>
              <div class="col-md-6"><label class="form-label" for="hoursText">Çalışma saatleri</label><input class="form-control" id="hoursText" name="hoursText" maxlength="80" value="${escapeHtml(a.hoursText||"09.00 – 23.00")}" placeholder="Örn. Her gün 09.00 – 23.00"></div>
            </div>
          </section>
          <section class="appearance-section">
            <div class="appearance-section-heading"><span class="appearance-section-icon"><i class="bi bi-image"></i></span><div><h3>Kapak alanı</h3><p>Müşteri menüsünün üst kısmındaki görseli ve karşılama yazısını düzenleyin.</p></div></div>
            <div class="row g-3">
              <div class="col-12"><label class="form-label" for="coverFile">Kapak görseli</label><input class="form-control" id="coverFile" name="coverFile" type="file" accept="image/*"><div class="form-text">Geniş yatay görseller en iyi sonucu verir. Görsel otomatik olarak küçültülür.</div><div class="image-upload-preview cover-upload-preview mt-2" id="coverPreview">${a.cover?`<img src="${escapeHtml(a.cover)}" alt="Kapak görseli önizlemesi">`:"<span>Henüz kapak görseli seçilmedi</span>"}</div><button class="btn btn-sm btn-outline-soft mt-2" type="button" data-action="remove-cover"><i class="bi bi-trash3 me-1"></i>Kapak görselini kaldır</button></div>
              <div class="col-md-6"><label class="form-label" for="appearanceEyebrow">Kısa üst yazı</label><input class="form-control" id="appearanceEyebrow" name="eyebrow" maxlength="80" value="${escapeHtml(a.eyebrow)}" placeholder="Örn. HER FİNCANDA MUTLULUK"></div>
              <div class="col-md-6"><label class="form-label" for="appearanceHeadline">Ana başlık</label><textarea class="form-control" id="appearanceHeadline" name="headline" rows="2" maxlength="140" placeholder="Müşterilerin göreceği karşılama yazısı">${escapeHtml(a.headline)}</textarea></div>
              <div class="col-md-6"><label class="form-label" for="accentColor">Tema rengi</label><div class="theme-color-field"><input class="form-control form-control-color" id="accentColor" name="accent" type="color" value="${escapeHtml(a.accent||"#b96e43")}"><span>Buton ve vurgularda kullanılacak renk</span></div></div>
            </div>
          </section>
          <div class="appearance-savebar"><span><i class="bi bi-info-circle me-1"></i>Değişiklikler kaydedildikten sonra müşteri menüsüne uygulanır.</span><button class="btn btn-primary-soft" type="submit"><i class="bi bi-check2 me-2"></i>Değişiklikleri kaydet</button></div>
        </form>
      </div>`;
  }
  function staffView() {
    return pageHeading("EKİP YÖNETİMİ","Personel ve Yetkiler","Personel hesaplarını, görev rollerini ve hesap durumlarını yönetin.",'<button class="btn btn-primary-soft" data-action="add-staff"><i class="bi bi-person-plus me-2"></i>Personel ekle</button>') +
      '<section class="panel-card"><div class="panel-heading"><div><h3>Personel listesi</h3><p>Bu ekran demo personel kayıtlarını tarayıcıda saklar.</p></div><span class="status-pill status-live">' + state.staff.length + ' hesap</span></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>PERSONEL</th><th>E-POSTA</th><th>ROL</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead><tbody>' +
      (state.staff.length?state.staff.map(function(s){const initials=s.name.split(" ").map(function(x){return x[0]||"";}).slice(0,2).join("").toUpperCase();return '<tr><td><div class="d-flex align-items-center gap-2"><span class="staff-avatar">'+escapeHtml(initials)+'</span><strong class="text-dark">'+escapeHtml(s.name)+'</strong></div></td><td>'+escapeHtml(s.email)+'</td><td>'+escapeHtml(s.role)+'</td><td>'+statusLabel(s.status==="active"?"active":"inactive")+'</td><td><div class="table-actions"><button class="table-action" data-action="edit-staff" data-id="'+s.id+'" aria-label="Personeli düzenle"><i class="bi bi-pencil"></i></button><button class="table-action" data-action="toggle-staff" data-id="'+s.id+'" aria-label="Personel durumunu değiştir"><i class="bi bi-person-check"></i></button><button class="table-action danger" data-action="delete-staff" data-id="'+s.id+'" aria-label="Personeli sil"><i class="bi bi-trash3"></i></button></div></td></tr>';}).join(""):'<tr><td colspan="5"><div class="empty-state"><i class="bi bi-people"></i><strong>Henüz personel yok</strong><p>İlk personel hesabınızı ekleyin.</p></div></td></tr>') +
      '</tbody></table></div></section><section class="panel-card mt-3"><div class="panel-heading"><div><h3>Rol açıklamaları</h3><p>Roller arayüzde gösterim amaçlıdır; gerçek erişim kontrolü sunucu tarafında kurulmalıdır.</p></div></div><div class="px-3 pb-3"><div class="setting-row"><span><strong>Yönetici</strong><small>Ürün, kategori, personel ve işletme ayarlarını yönetir.</small></span><i class="bi bi-shield-lock fs-5 text-secondary"></i></div><div class="setting-row"><span><strong>Garson</strong><small>İleride masa ve sipariş ekranlarına erişir.</small></span><i class="bi bi-person fs-5 text-secondary"></i></div><div class="setting-row"><span><strong>Kasiyer</strong><small>İleride adisyon ve ödeme ekranlarına erişir.</small></span><i class="bi bi-cash-coin fs-5 text-secondary"></i></div></div></section>';
  }
  function settingsView() {
    const s=state.settings;
    return pageHeading("İŞLETME","İşletme Ayarları","Yalnızca müşteri menüsünün alt bölümünde (footer) gösterilecek iletişim bilgilerini yönetin.") +
      '<div class="settings-grid"><section class="panel-card"><div class="panel-heading"><div><h3>Footer bilgileri</h3><p>İşletme adı Menü Görünümü bölümünden yönetilir. Buradaki bilgiler menünün en altında gösterilir.</p></div></div><form id="settingsForm" class="p-3 pt-0"><div class="mb-3"><label class="form-label" for="businessPhone">Telefon</label><input class="form-control" id="businessPhone" name="phone" type="tel" value="'+escapeHtml(s.phone)+'" placeholder="05xx xxx xx xx"></div><div class="mb-3"><label class="form-label" for="businessEmail">E-posta</label><input class="form-control" id="businessEmail" name="email" type="email" value="'+escapeHtml(s.email)+'" placeholder="info@isletme.com"></div><div class="mb-3"><label class="form-label" for="businessAddress">Adres</label><textarea class="form-control" id="businessAddress" name="address" rows="2" placeholder="İşletme adresi">'+escapeHtml(s.address)+'</textarea></div><div class="mb-3"><label class="form-label" for="businessDescription">Footer açıklaması</label><textarea class="form-control" id="businessDescription" name="description" rows="2" maxlength="250" placeholder="Kısa işletme açıklaması">'+escapeHtml(s.description)+'</textarea></div><button class="btn btn-primary-soft" type="submit"><i class="bi bi-check2 me-2"></i>Footer bilgilerini kaydet</button></form></section>' +
      '<section class="panel-card"><div class="panel-heading"><div><h3>Sosyal medya bağlantıları</h3><p>Footer bölümündeki Instagram ve WhatsApp bağlantıları.</p></div></div><form id="contactForm" class="p-3 pt-0"><div class="mb-3"><label class="form-label" for="instagramUrl">Instagram bağlantısı</label><input class="form-control" id="instagramUrl" name="instagram" type="url" value="'+escapeHtml(s.instagram)+'" placeholder="https://instagram.com/..."></div><div class="mb-3"><label class="form-label" for="whatsappUrl">WhatsApp bağlantısı</label><input class="form-control" id="whatsappUrl" name="whatsapp" type="url" value="'+escapeHtml(s.whatsapp)+'" placeholder="https://wa.me/90..."></div><button class="btn btn-primary-soft" type="submit"><i class="bi bi-check2 me-2"></i>Bağlantıları kaydet</button></form></section></div>';
  }
  const viewRenderers = {overview:overviewView,products:productsView,categories:categoriesView,appearance:appearanceView,staff:staffView,settings:settingsView};
  const viewTitles = {overview:"Genel Bakış",products:"Ürünler",categories:"Kategoriler",appearance:"Menü Görünümü",staff:"Personel ve Yetkiler",settings:"İşletme Ayarları"};
  function render(view, updateHash) {
    state.view = viewRenderers[view] ? view : "overview";
    root.innerHTML = viewRenderers[state.view]();
    title.textContent = viewTitles[state.view];
    crumb.textContent = viewTitles[state.view].toLocaleUpperCase("tr");
    document.querySelectorAll(".admin-nav-link").forEach(function(link){link.classList.toggle("active",link.dataset.view===state.view);});
    document.getElementById("navProductCount").textContent = state.products.length;
    if (updateHash !== false && window.location.hash !== "#"+state.view) history.replaceState(null,"","#"+state.view);
    const sidebar=document.getElementById("adminSidebar");
    if (sidebar && window.bootstrap && sidebar.classList.contains("show")) bootstrap.Offcanvas.getOrCreateInstance(sidebar).hide();
  }
  function openModal(titleText, body, footer) {
    modalContent.innerHTML='<div class="modal-header"><h2 class="modal-title">'+titleText+'</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button></div><div class="modal-body">'+body+'</div><div class="modal-footer">'+(footer||'<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button>')+'</div>';
    if(modal) modal.show();
  }
  function productForm(product) {
    const p=product||{name:"",category:state.categories[0]?state.categories[0].name:"",price:"",description:"",status:"active",image:""};
    openModal(product?"Ürünü düzenle":"Yeni ürün ekle",'<form id="productForm"><input type="hidden" name="id" value="'+(p.id||"")+'"><input type="hidden" name="currentImage" value="'+escapeHtml(p.image||"")+'"><div class="row g-3"><div class="col-md-7"><label class="form-label" for="productName">Ürün adı *</label><input class="form-control" id="productName" name="name" required maxlength="100" value="'+escapeHtml(p.name)+'"></div><div class="col-md-5"><label class="form-label" for="productPrice">Fiyat (TL) *</label><input class="form-control" id="productPrice" name="price" type="number" min="0" step="0.01" required value="'+escapeHtml(p.price)+'"></div><div class="col-md-6"><label class="form-label" for="productCategory">Kategori *</label><select class="form-select" id="productCategory" name="category" required>'+categoryOptions(p.category)+'</select></div><div class="col-md-6"><label class="form-label" for="productStatus">Yayın durumu</label><select class="form-select" id="productStatus" name="status"><option value="active" '+(p.status==="active"?"selected":"")+'>Yayında</option><option value="out" '+(p.status==="out"?"selected":"")+'>Tükendi</option><option value="hidden" '+(p.status==="hidden"?"selected":"")+'>Taslak / gizli</option></select></div><div class="col-12"><label class="form-label" for="productDescription">Açıklama</label><textarea class="form-control" id="productDescription" name="description" rows="3" maxlength="300">'+escapeHtml(p.description)+'</textarea></div><div class="col-12"><label class="form-label" for="productImageFile">Ürün görseli</label><input class="form-control" id="productImageFile" name="imageFile" type="file" accept="image/*"><div class="form-text">Bilgisayarınızdan görsel seçin; görsel boyutu otomatik küçültülür.</div><div class="image-upload-preview mt-2" id="productImagePreview">'+(p.image?'<img src="'+escapeHtml(p.image)+'" alt="Mevcut ürün görseli">':'<span>Henüz görsel seçilmedi</span>')+'</div><button class="btn btn-sm btn-outline-soft mt-2" type="button" data-action="remove-product-image">Görseli kaldır</button></div></div></form>','<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="productForm">Kaydet</button>');
  }
  const categoryIconOptions = [
    ["bi-cup-hot","Sıcak kahve"],["bi-cup-straw","Soğuk içecek"],["bi-cup","Çay / fincan"],["bi-cake2","Pasta ve tatlı"],
    ["bi-cookie","Kurabiye"],["bi-egg-fried","Atıştırmalık"],["bi-egg","Kahvaltı"],["bi-droplet","Smoothie"],
    ["bi-sun","Taze / ferah"],["bi-snow","Soğuk ürün"],["bi-cup-fill","İçecek"],["bi-basket2","Sepet / yiyecek"],
    ["bi-basket2","Fırın ürünleri"],["bi-snow","Dondurma"],["bi-apple","Meyve"],["bi-heart","Favoriler"],
    ["bi-star","Öne çıkanlar"],["bi-lightning","Enerji içeceği"],["bi-flower1","Bitkisel"],["bi-collection","Genel kategori"],
    ["bi-shop","Mağaza"],["bi-fire","Izgara / sıcak"],["bi-gift","Kampanya"],["bi-tags","Diğer ürünler"]
  ];
  function categoryIconPicker(selected) {
    const current = selected || "bi-collection";
    return '<input type="hidden" id="categoryIcon" name="icon" value="'+escapeHtml(current)+'">'+
      '<label class="form-label" for="categoryIconSearch">Kategori ikonu seçin</label>'+
      '<input class="form-control mb-2" id="categoryIconSearch" type="search" placeholder="İkon ara..." aria-label="İkon ara">'+
      '<div class="icon-picker-grid" id="categoryIconGrid">'+categoryIconOptions.map(function(item){
        return '<button type="button" class="icon-choice '+(item[0]===current?'active':'')+'" data-icon-choice="'+item[0]+'" data-icon-label="'+escapeHtml(item[1].toLocaleLowerCase("tr"))+'"><i class="bi '+item[0]+'"></i><span>'+item[1]+'</span></button>';
      }).join("")+'</div><div class="form-text mt-2" id="selectedIconLabel">Seçili ikon: '+escapeHtml(current)+'</div>';
  }
  function categoryForm(category) {
    const c=category||{name:"",icon:"bi-collection",description:""};
    openModal(category?"Kategoriyi düzenle":"Yeni kategori",'<form id="categoryForm"><input type="hidden" name="id" value="'+(c.id||"")+'"><div class="mb-3"><label class="form-label" for="categoryName">Kategori adı *</label><input class="form-control" id="categoryName" name="name" required maxlength="70" value="'+escapeHtml(c.name)+'"></div><div class="mb-3">'+categoryIconPicker(c.icon)+'</div><div class="mb-2"><label class="form-label" for="categoryDescription">Kısa açıklama</label><textarea class="form-control" id="categoryDescription" name="description" rows="2">'+escapeHtml(c.description)+'</textarea></div></form>','<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="categoryForm">Kaydet</button>');
  }
  function staffForm(person) {
    const s=person||{name:"",email:"",role:"Garson",status:"active"};
    openModal(person?"Personeli düzenle":"Personel ekle",'<form id="staffForm"><input type="hidden" name="id" value="'+(s.id||"")+'"><div class="mb-3"><label class="form-label" for="staffName">Ad soyad *</label><input class="form-control" id="staffName" name="name" required maxlength="100" value="'+escapeHtml(s.name)+'"></div><div class="mb-3"><label class="form-label" for="staffEmail">E-posta *</label><input class="form-control" id="staffEmail" name="email" type="email" required value="'+escapeHtml(s.email)+'"></div><div class="mb-3"><label class="form-label" for="staffRole">Rol</label><select class="form-select" id="staffRole" name="role"><option '+(s.role==="Garson"?"selected":"")+' value="Garson">Garson</option><option '+(s.role==="Kasiyer"?"selected":"")+' value="Kasiyer">Kasiyer</option><option '+(s.role==="Yönetici"?"selected":"")+' value="Yönetici">Yönetici</option></select></div><div class="alert alert-warning py-2 mb-0" style="font-size:10px">Bu demo formu şifre veya gerçek kullanıcı hesabı oluşturmaz. Güvenli giriş sistemi backend aşamasında yapılmalıdır.</div></form>','<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="staffForm">Kaydet</button>');
  }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  function setView(view) { render(view); }
  document.addEventListener("click",function(event){
    const iconChoice=event.target.closest("[data-icon-choice]");
    if(iconChoice){
      const hidden=document.getElementById("categoryIcon");
      if(hidden)hidden.value=iconChoice.dataset.iconChoice;
      document.querySelectorAll(".icon-choice").forEach(function(button){button.classList.toggle("active",button===iconChoice);});
      const label=document.getElementById("selectedIconLabel");
      if(label)label.textContent="Seçili ikon: "+iconChoice.dataset.iconChoice;
      return;
    }
    const viewLink=event.target.closest("[data-view]");
    if(viewLink){event.preventDefault();setView(viewLink.dataset.view);return;}
    const actionButton=event.target.closest("[data-action]");
    if(!actionButton)return;
    const action=actionButton.dataset.action, id=Number(actionButton.dataset.id);
    if(action==="navigate"){setView(actionButton.dataset.view);return;}
    if(action==="remove-product-image"){const input=document.querySelector('#productForm [name="currentImage"]');if(input)input.value="";const preview=document.getElementById("productImagePreview");if(preview)preview.innerHTML="<span>Henüz görsel seçilmedi</span>";const file=document.getElementById("productImageFile");if(file)file.value="";return;}
    if(action==="remove-logo"||action==="remove-cover"){const key=action==="remove-logo"?"currentLogo":"currentCover";const input=document.querySelector('#appearanceForm [name="'+key+'"]');if(input)input.value="";const preview=document.getElementById(action==="remove-logo"?"logoPreview":"coverPreview");if(preview)preview.innerHTML="<span>Görsel seçilmedi</span>";const file=document.getElementById(action==="remove-logo"?"logoFile":"coverFile");if(file)file.value="";return;}
    if(action==="add-product"){if(!state.categories.length){notify("Önce en az bir kategori oluşturun.");setView("categories");return;}productForm();return;}
    if(action==="edit-product"){productForm(state.products.find(function(p){return p.id===id;}));return;}
    if(action==="toggle-product"){const p=state.products.find(function(x){return x.id===id;});if(p){p.status=p.status==="active"?"hidden":"active";save("products");render("products",false);notify("Ürün durumu güncellendi.");}return;}
    if(action==="delete-product"){const p=state.products.find(function(x){return x.id===id;});if(p&&window.confirm('"'+p.name+'" ürününü silmek istiyor musunuz?')){state.products=state.products.filter(function(x){return x.id!==id;});save("products");render(state.view,false);notify("Ürün silindi.");}return;}
    if(action==="add-category"){categoryForm();return;}
    if(action==="edit-category"){categoryForm(state.categories.find(function(c){return c.id===id;}));return;}
    if(action==="delete-category"){const c=state.categories.find(function(x){return x.id===id;});if(!c)return;const used=state.products.some(function(p){return p.category===c.name;});if(used){notify("Bu kategoride ürün var. Silmeden önce ürünleri başka kategoriye taşıyın.");return;}if(window.confirm('"'+c.name+'" kategorisini silmek istiyor musunuz?')){state.categories=state.categories.filter(function(x){return x.id!==id;});save("categories");render("categories",false);notify("Kategori silindi.");}return;}
    if(action==="add-staff"){staffForm();return;}
    if(action==="edit-staff"){staffForm(state.staff.find(function(s){return s.id===id;}));return;}
    if(action==="toggle-staff"){const s=state.staff.find(function(x){return x.id===id;});if(s){s.status=s.status==="active"?"inactive":"active";save("staff");render("staff",false);notify("Personel durumu güncellendi.");}return;}
    if(action==="delete-staff"){const s=state.staff.find(function(x){return x.id===id;});if(s&&window.confirm(s.name+" personel kaydını silmek istiyor musunuz?")){state.staff=state.staff.filter(function(x){return x.id!==id;});save("staff");render("staff",false);notify("Personel kaydı silindi.");}return;}
    if(action==="logout"){if(window.confirm("Demo yönetici oturumundan çıkmak istiyor musunuz?")){render("overview",false);notify("Demo oturumu kapatıldı.");}return;}
  });
  document.addEventListener("submit",async function(event){
    const form=event.target;
    if(form.id==="productForm"){
      event.preventDefault();const data=formObject(form);const id=Number(data.id);let image=data.currentImage||"";const file=form.querySelector('[name="imageFile"]')?.files?.[0];if(file){try{image=await imageFileToDataUrl(file,900);}catch(error){notify("Görsel okunamadı. Başka bir dosya deneyin.");return;}}
      const product={id:id||Date.now(),name:data.name.trim(),category:data.category,price:Number(data.price),description:data.description.trim(),status:data.status,image:image};
      if(!product.name||!Number.isFinite(product.price)||product.price<0){notify("Ürün adı ve geçerli bir fiyat girin.");return;}
      if(id){state.products=state.products.map(function(p){return p.id===id?product:p;});}else{state.products.unshift(product);}
      if(!save("products"))return;if(modal)modal.hide();render("products",false);notify(id?"Ürün güncellendi.":"Yeni ürün eklendi.");return;
    }
    if(form.id==="categoryForm"){
      event.preventDefault();const data=formObject(form);const id=Number(data.id);const name=data.name.trim();
      if(!name){notify("Kategori adı girin.");return;}
      if(state.categories.some(function(c){return c.name.toLocaleLowerCase("tr")===name.toLocaleLowerCase("tr")&&c.id!==id;})){notify("Bu isimde bir kategori zaten var.");return;}
      const category={id:id||Date.now(),name:name,icon:data.icon.trim()||"bi-collection",description:data.description.trim()};
      if(id){const old=state.categories.find(function(c){return c.id===id;});state.categories=state.categories.map(function(c){return c.id===id?category:c;});if(old&&old.name!==name){state.products.forEach(function(p){if(p.category===old.name)p.category=name;});save("products");}}else{state.categories.push(category);}
      save("categories");if(modal)modal.hide();render("categories",false);notify(id?"Kategori güncellendi.":"Kategori oluşturuldu.");return;
    }
    if(form.id==="staffForm"){
      event.preventDefault();const data=formObject(form);const id=Number(data.id);const person={id:id||Date.now(),name:data.name.trim(),email:data.email.trim(),role:data.role,status:(id&&state.staff.find(function(s){return s.id===id;})||{}).status||"active"};
      if(state.staff.some(function(s){return s.email.toLowerCase()===person.email.toLowerCase()&&s.id!==id;})){notify("Bu e-posta adresi personel listesinde kayıtlı.");return;}
      if(id){state.staff=state.staff.map(function(s){return s.id===id?person:s;});}else{state.staff.push(person);}
      save("staff");if(modal)modal.hide();render("staff",false);notify(id?"Personel güncellendi.":"Personel kaydı eklendi.");return;
    }
    if(form.id==="appearanceForm"){
      event.preventDefault();const data=formObject(form);let logo=data.currentLogo||"",cover=data.currentCover||"";
      try{const logoFile=form.querySelector('[name="logoFile"]')?.files?.[0];const coverFile=form.querySelector('[name="coverFile"]')?.files?.[0];if(logoFile)logo=await imageFileToDataUrl(logoFile,500);if(coverFile)cover=await imageFileToDataUrl(coverFile,1400);}catch(error){notify("Görsel işlenemedi. Daha küçük veya farklı bir görsel seçin.");return;}
      state.appearance={brandName:data.brandName.trim(),tagline:data.tagline.trim(),eyebrow:data.eyebrow.trim(),headline:data.headline.trim(),cover:cover,logo:logo,accent:data.accent,isOpen:form.querySelector("#isOpenToggle").checked,locationLabel:data.locationLabel.trim(),locationText:data.locationText.trim(),hoursLabel:data.hoursLabel.trim(),hoursText:data.hoursText.trim()};
      if(!save("appearance"))return;render("appearance",false);notify("Header ve slider ayarları kaydedildi.");return;
    }
    if(form.id==="settingsForm"||form.id==="contactForm"){
      event.preventDefault();const data=formObject(form);Object.keys(data).forEach(function(key){state.settings[key]=data[key].trim();});save("settings");notify("İşletme bilgileri kaydedildi.");return;
    }
  });
  document.addEventListener("change",function(event){
    const fileInput=event.target.closest('input[type="file"]');if(!fileInput||!fileInput.files||!fileInput.files[0])return;
    const previewId=fileInput.id==="productImageFile"?"productImagePreview":fileInput.id==="logoFile"?"logoPreview":"coverPreview";const preview=document.getElementById(previewId);if(!preview)return;
    const reader=new FileReader();reader.onload=function(){preview.innerHTML='<img alt="Görsel önizlemesi" src="'+reader.result+'">';};reader.readAsDataURL(fileInput.files[0]);
  });
  document.addEventListener("input",function(event){
    if(event.target.id==="categoryIconSearch"){const query=event.target.value.toLocaleLowerCase("tr");document.querySelectorAll(".icon-choice").forEach(function(button){button.hidden=!(button.dataset.iconLabel.includes(query)||button.dataset.iconChoice.includes(query));});}
    if(event.target.id==="productSearch"){state.productSearch=event.target.value;const cursor=event.target.selectionStart;render("products",false);const input=document.getElementById("productSearch");input.focus();input.setSelectionRange(cursor,cursor);}
  });
  document.addEventListener("change",function(event){
    if(event.target.id==="isOpenToggle"){
      const isOpen=event.target.checked;const control=event.target.closest(".business-status-control");
      if(control){control.classList.toggle("is-open",isOpen);control.classList.toggle("is-closed",!isOpen);}
      const heading=document.getElementById("businessStatusTitle");const help=document.getElementById("businessStatusHelp");const label=event.target.closest(".status-switch")?.querySelector(".form-check-label");
      if(heading)heading.textContent=isOpen?"İşletme açık":"İşletme kapalı";
      if(help)help.textContent=isOpen?"Müşteriler menüde Açığız bilgisini görecek.":"Müşteriler menüde Kapalıyız bilgisini kırmızı renkte görecek.";
      if(label)label.textContent=isOpen?"Açığız":"Kapalıyız";
    }
    if(event.target.id==="productCategoryFilter"){state.productCategory=event.target.value;render("products",false);}
    if(event.target.id==="productStatusFilter"){state.productStatus=event.target.value;render("products",false);}
  });
  document.getElementById("notificationButton").addEventListener("click",function(){notify("Şimdilik yeni bildiriminiz yok.");});
  window.addEventListener("hashchange",function(){const view=window.location.hash.replace("#","");if(viewRenderers[view]&&view!==state.view)render(view,false);});
  const initial=window.location.hash.replace("#","")||"overview";
  render(viewRenderers[initial]?initial:"overview",false);
});