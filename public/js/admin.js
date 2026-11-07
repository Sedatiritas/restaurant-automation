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
    products: [],
    categories: [],
    tables: [],
    staff: [],
    settings: {phone:"",email:"",address:"",instagram:"",whatsapp:"",description:"Kahve, tatlı ve güzel anlar."},
    appearance: {brandName:"roast & co.",tagline:"COFFEE · DESSERT · MOMENTS",eyebrow:"HER FİNCANDA MUTLULUK",headline:"Kendine güzel bir mola ver.",logo:"",cover:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=80",accent:"#b96e43",isOpen:true,googleReviewUrl:""}
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
  let selectedProductImageFile = null;
  let selectedProductImageData = "";

  const state = { products:[], categories:[], tables:[], tablesLoaded:false, tablesError:"", staff:[], settings:structuredClone(defaults.settings), settingsLoaded:false, settingsError:"", appearance:structuredClone(defaults.appearance), appearanceLoaded:false, view:"overview", productSearch:"", productCategory:"all", productStatus:"all", revenueMonth:currentMonthValue(new Date()), revenueData:null, revenueLoading:false, revenueError:"", revenueRequestId:0, categorySaving:false, categoryDraftIds:null, draggedCategoryId:null };
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
  function categoryOptions(selectedId) {
    return state.categories.map(function (cat) { return '<option value="' + escapeHtml(cat.id) + '" ' + (cat.id===selectedId?"selected":"") + '>' + escapeHtml(cat.name) + '</option>'; }).join("");
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
  function currentMonthValue(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }
  function revenueView() {
    const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(state.revenueMonth) ? state.revenueMonth : currentMonthValue(new Date());
    const report = state.revenueData && state.revenueData.month === selectedMonth ? state.revenueData : null;
    const summary = report && report.summary ? report.summary : { total: 0, cash: 0, card: 0, count: 0 };
    const days = report && Array.isArray(report.days) ? report.days : [];
    const cashPercent = Number(summary.total) > 0 ? Number(summary.cash) / Number(summary.total) * 100 : 0;
    const cardPercent = Number(summary.total) > 0 ? Number(summary.card) / Number(summary.total) * 100 : 0;
    const dailyRows = days.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (day) {
      const formattedDate = new Date(String(day.date) + "T12:00:00").toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", weekday: "short" });
      return '<tr><td><strong class="revenue-date">' + escapeHtml(formattedDate) + '</strong></td><td>' + Number(day.count || 0) + '</td><td class="price-cell">' + money(day.total) + '</td><td>' + money(day.cash) + '</td><td>' + money(day.card) + '</td></tr>';
    }).join("");

    const reportNote = state.revenueError
      ? '<div class="revenue-preview-note"><i class="bi bi-exclamation-circle"></i><span><strong>Ciro verileri alınamadı</strong> ' + escapeHtml(state.revenueError) + '</span><button class="btn btn-sm btn-outline-soft ms-auto" type="button" data-action="refresh-revenue">Tekrar dene</button></div>'
      : state.revenueLoading
        ? '<div class="revenue-preview-note"><i class="bi bi-arrow-repeat"></i><span><strong>Rapor güncelleniyor</strong> Veritabanındaki tahsilat kayıtları getiriliyor.</span></div>'
        : '<div class="revenue-preview-note"><i class="bi bi-info-circle"></i><span><strong>Canlı veritabanı raporu</strong> Kasiyerin kaydettiği nakit ve kart tahsilatları, ödeme alındığı anda bu rapora yansır. Açık adisyonlar ve henüz tahsil edilmemiş tutarlar ciroya dahil edilmez.</span></div>';

    const emptyMessage = state.revenueLoading
      ? "Tahsilat kayıtları yükleniyor..."
      : state.revenueError
        ? "Ciro verileri alınamadı. Yeniden deneyin."
        : "Bu ay henüz tahsilat kaydı bulunmuyor. Kasiyer ödeme aldığında kayıt burada görünecek.";

    return pageHeading("FİNANSAL RAPORLAMA", "Ciro Raporu", "Aylık toplam ciroyu, gün gün satışları ve ödeme türü dağılımını görüntüleyin.",
      '<div class="revenue-month-filter"><label for="revenueMonth">Rapor ayı</label><input class="form-control" id="revenueMonth" type="month" value="' + escapeHtml(selectedMonth) + '"></div>') +
      reportNote +
      '<section class="stats-grid revenue-stats">' +
      statCard("Aylık ciro", money(summary.total), "bi-graph-up-arrow", "green", "Seçilen ayda tahsil edilen tutar") +
      statCard("Tahsilat işlemi", String(Number(summary.count) || 0), "bi-receipt-cutoff", "", "Seçilen ay") +
      statCard("Nakit", money(summary.cash), "bi-cash-coin", "orange", cashPercent.toFixed(1) + "% of ciro") +
      statCard("Kart", money(summary.card), "bi-credit-card", "purple", cardPercent.toFixed(1) + "% of ciro") +
      '</section>' +
      '<section class="panel-card revenue-payment-card"><div class="panel-heading"><div><h3>Ödeme türü dağılımı</h3><p>Aylık tahsilatın nakit ve kart olarak yüzdesel dağılımı.</p></div><span class="status-pill status-live">' + (summary.total > 0 ? "100% dağılım" : "Henüz satış yok") + '</span></div>' +
      '<div class="revenue-payment-content"><div class="revenue-payment-bar" role="img" aria-label="Nakit yüzde ' + cashPercent.toFixed(1) + ', kart yüzde ' + cardPercent.toFixed(1) + '">' +
      '<span class="revenue-payment-cash" style="width:' + cashPercent.toFixed(2) + '%"></span><span class="revenue-payment-card-segment" style="width:' + cardPercent.toFixed(2) + '%"></span></div>' +
      '<div class="revenue-payment-legend"><div><span class="revenue-legend-dot cash"></span><span><strong>Nakit</strong><small>' + cashPercent.toFixed(1) + '%</small></span><b>' + money(summary.cash) + '</b></div>' +
      '<div><span class="revenue-legend-dot card"></span><span><strong>Kart</strong><small>' + cardPercent.toFixed(1) + '%</small></span><b>' + money(summary.card) + '</b></div></div></div></section>' +
      '<section class="panel-card revenue-daily-card"><div class="panel-heading"><div><h3>Günlük ciro dökümü</h3><p>Seçtiğiniz ayda tahsilat yapılan günler, en yeniden eskiye sıralanır.</p></div><span class="count-pill">' + days.length + ' gün</span></div>' +
      '<div class="table-responsive"><table class="table data-table align-middle revenue-table"><thead><tr><th>GÜN</th><th>TAHSİLAT</th><th>TOPLAM CİRO</th><th>NAKİT</th><th>KART</th></tr></thead><tbody>' +
      (dailyRows || '<tr><td colspan="5"><div class="empty-state"><i class="bi bi-bar-chart-line"></i><strong>' + (report ? "Bu ay için ciro kaydı yok" : "Ciro verileri bekleniyor") + '</strong><p>' + escapeHtml(emptyMessage) + '</p></div></td></tr>') +
      '</tbody></table></div></section>';
  }

  async function loadRevenue() {
    const month = state.revenueMonth;
    const requestId = ++state.revenueRequestId;
    state.revenueLoading = true;
    state.revenueError = "";
    if (state.view === "revenue") root.innerHTML = revenueView();

    try {
      const response = await fetch("/api/admin/revenue?month=" + encodeURIComponent(month), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      let result;
      try { result = await response.json(); }
      catch (_error) { throw new Error("Ciro raporu yanıtı okunamadı."); }
      if (!response.ok) throw new Error(result.error || "Ciro raporu yüklenemedi.");
      if (requestId !== state.revenueRequestId || month !== state.revenueMonth) return;
      state.revenueData = result;
    } catch (error) {
      if (requestId !== state.revenueRequestId) return;
      state.revenueError = error.message || "Ciro raporu yüklenirken bir hata oluştu.";
    } finally {
      if (requestId === state.revenueRequestId) {
        state.revenueLoading = false;
        if (state.view === "revenue") root.innerHTML = revenueView();
      }
    }
  }

  function connectRevenueEvents() {
    if (typeof window.EventSource !== "function") return;
    const events = new EventSource("/api/admin/revenue/events");
    events.addEventListener("admin_revenue_update", function (event) {
      let update;
      try { update = JSON.parse(event.data); }
      catch (_error) { return; }
      if (update && update.type === "payment_recorded" && state.view === "revenue") {
        loadRevenue();
      }
    });
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
      '<a href="#tables" class="quick-link" data-view="tables"><span class="quick-icon green"><i class="bi bi-grid-3x3-gap"></i></span><span><strong>Masa yönetimi</strong><small>Masa ekleyin veya kapasitesini düzenleyin</small></span></a></div></article>' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Ürünler</h3><p>Menüde kayıtlı son ürünler.</p></div><a href="#products" class="text-link" data-view="products">Tüm ürünler <i class="bi bi-arrow-right ms-1"></i></a></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>ÜRÜN</th><th>KATEGORİ</th><th>FİYAT</th><th>DURUM</th><th></th><th></th></tr></thead><tbody>' + productRows(state.products.slice(0,5)) + '</tbody></table></div></article>' +
      '</div><div class="dashboard-aside">' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Müşteri menüsü</h3><p>Menünüzü yeni sekmede kontrol edin.</p></div><span class="status-pill status-live">Önizleme</span></div><div class="appearance-preview mx-3 mb-3"><div class="preview-brand"><span class="brand-mark" style="width:35px;height:35px;flex-basis:35px;border-radius:10px"><i class="bi bi-cup-hot-fill"></i></span><span><strong>' + escapeHtml(state.appearance.brandName) + '</strong><small>' + escapeHtml(state.appearance.tagline) + '</small></span></div><div class="preview-cover" style="background-image:linear-gradient(100deg,#261e17d9,#261e1733),url(&quot;' + escapeHtml(state.appearance.cover) + '&quot;)"><span>' + escapeHtml(state.appearance.eyebrow) + '</span><strong>' + escapeHtml(state.appearance.headline).replace(/\\n/g,"<br>") + '</strong></div></div><div class="p-3 pt-0"><a href="/" target="_blank" rel="noopener noreferrer" class="btn btn-outline-soft w-100">Müşteri menüsünü aç <i class="bi bi-arrow-up-right ms-2"></i></a></div></article>' +
      '<article class="panel-card"><div class="panel-heading"><div><h3>Menü durumu</h3><p>Yönetim panelindeki kayıt özeti.</p></div></div><div class="px-3 pb-3"><div class="setting-row"><span><strong>Yayındaki ürünler</strong><small>Müşteri menüsünde görünür</small></span><strong>' + active + '</strong></div><div class="setting-row"><span><strong>Taslak / pasif ürünler</strong><small>Menüde gizli</small></span><strong>' + state.products.filter(function(p){return p.status==="hidden";}).length + '</strong></div><div class="setting-row"><span><strong>Personel hesabı</strong><small>Kayıtlı personel</small></span><strong>' + state.staff.length + '</strong></div></div></article>' +
      '</div></section>';
  }
  function productsView() {
    const filtered = state.products.filter(function(p) {
      const matchesSearch = (p.name + " " + p.description).toLocaleLowerCase("tr").includes(state.productSearch.toLocaleLowerCase("tr"));
      return matchesSearch && (state.productCategory==="all" || p.categoryId===state.productCategory) && (state.productStatus==="all" || p.status===state.productStatus);
    });
    return pageHeading("MENÜ İÇERİĞİ","Ürünler","Ürün ekleyin, fiyatları güncelleyin ve ürünlerin müşterilere görünürlüğünü yönetin.",'<button class="btn btn-primary-soft" data-action="add-product"><i class="bi bi-plus-lg me-2"></i>Yeni ürün</button>') +
      '<section class="panel-card"><div class="toolbar"><div class="toolbar-start"><label class="search-control"><i class="bi bi-search"></i><input id="productSearch" class="form-control" type="search" placeholder="Ürün ara..." value="' + escapeHtml(state.productSearch) + '" aria-label="Ürün ara"></label><select id="productCategoryFilter" class="form-select" aria-label="Kategori filtresi"><option value="all">Tüm kategoriler</option>' + state.categories.map(function(c){return '<option value="' + escapeHtml(c.id) + '" ' + (state.productCategory===c.id?"selected":"") + '>' + escapeHtml(c.name) + '</option>';}).join("") + '</select><select id="productStatusFilter" class="form-select" aria-label="Durum filtresi"><option value="all">Tüm durumlar</option><option value="active" ' + (state.productStatus==="active"?"selected":"") + '>Yayında</option><option value="out" ' + (state.productStatus==="out"?"selected":"") + '>Tükendi</option><option value="hidden" ' + (state.productStatus==="hidden"?"selected":"") + '>Taslak / gizli</option></select></div><div class="toolbar-end"><span class="text-muted small">' + filtered.length + ' ürün</span></div></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>ÜRÜN</th><th>KATEGORİ</th><th>FİYAT</th><th>DURUM</th><th>DÜZENLE</th><th>İŞLEMLER</th></tr></thead><tbody>' + productRows(filtered) + '</tbody></table></div></section>';
  }
  function categoriesView() {
    const categoriesById = new Map(state.categories.map(function (category) {
      return [String(category.id), category];
    }));
    const orderedIds = Array.isArray(state.categoryDraftIds)
      ? state.categoryDraftIds
      : state.categories.map(function (category) { return String(category.id); });
    const orderedCategories = orderedIds.map(function (id) { return categoriesById.get(String(id)); }).filter(Boolean);

    const categoryCards = orderedCategories.map(function (category, index) {
      const count = state.products.filter(function (product) {
        return product.categoryId === category.id;
      }).length;
      return '<article class="category-card" data-category-sort-item data-category-id="' + escapeHtml(category.id) + '">' +
        '<button type="button" class="btn btn-sm btn-outline-secondary flex-shrink-0" draggable="' + (state.categorySaving ? "false" : "true") + '" data-category-drag-handle aria-label="' + escapeHtml(category.name) + ' kategorisini sürükleyerek sırala" title="Sürükleyerek sırala"' + (state.categorySaving ? " disabled" : "") + '><i class="bi bi-grip-vertical"></i></button>' +
        '<span class="category-symbol"><i class="bi ' + escapeHtml(category.icon || "bi-collection") + '"></i></span>' +
        '<div class="category-info"><strong>' + escapeHtml(category.name) + '</strong><small>' + count + ' ürün · ' + escapeHtml(category.description || "Açıklama yok") + '</small><span class="badge text-bg-light border mt-2">Sıra ' + (index + 1) + '</span></div>' +
        '<div class="category-actions">' +
          '<button type="button" class="table-action" data-action="edit-category" data-id="' + escapeHtml(category.id) + '" aria-label="Kategoriyi düzenle"><i class="bi bi-pencil"></i></button>' +
          '<button type="button" class="table-action danger" data-action="delete-category" data-id="' + escapeHtml(category.id) + '" aria-label="Kategoriyi sil"><i class="bi bi-trash3"></i></button>' +
        '</div></article>';
    }).join("");

    const hasCategoryDraft = Array.isArray(state.categoryDraftIds);
    const orderSaveBar =
      '<div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mt-3 p-3 bg-white border rounded-3">' +
        '<div class="small ' + (hasCategoryDraft ? "text-primary" : "text-secondary") + '">' +
          (hasCategoryDraft
            ? '<i class="bi bi-info-circle me-2"></i>Kaydedilmemiş kategori sıralaması değişiklikleri var.'
            : '<i class="bi bi-grip-vertical me-2"></i>Sıralamayı değiştirmek için kategorileri sürükleyin.') +
        '</div>' +
        '<div class="d-flex justify-content-end gap-2">' +
          '<button type="button" class="btn btn-outline-secondary btn-sm px-3" data-action="cancel-category-order"' + (!hasCategoryDraft || state.categorySaving ? " disabled" : "") + '>Vazgeç</button>' +
          '<button type="button" class="btn btn-primary-soft btn-sm px-3" data-action="save-category-order"' + (!hasCategoryDraft || state.categorySaving ? " disabled" : "") + '>' +
            (state.categorySaving
              ? '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Kaydediliyor...'
              : '<i class="bi bi-check2 me-1"></i>Değişiklikleri Kaydet') +
          '</button>' +
        '</div></div>';

    return pageHeading("MENÜ İÇERİĞİ", "Kategoriler", "Kategori sırasını sürükle-bırak ile düzenleyin. Yeni sıralama, Değişiklikleri Kaydet düğmesine bastığınızda müşteri menüsüne ve garson ekranına uygulanır.", '<button class="btn btn-primary-soft" data-action="add-category"><i class="bi bi-plus-lg me-2"></i>Kategori ekle</button>') +
      (orderedCategories.length
        ? '<div class="list-group gap-2" data-category-sort-list>' + categoryCards + '</div>'
        : '<div class="panel-card p-4 text-center"><strong>Henüz kategori yok</strong><p class="text-muted mb-0 mt-1">Ürün eklemeden önce ilk menü kategorinizi oluşturun.</p></div>') +
      orderSaveBar;
  }
  function tablesView() {
    if (state.tablesError) {
      return pageHeading("OPERASYON","Masa Yönetimi","Masa listesi yüklenemedi.") +
        '<section class="panel-card p-4"><p class="mb-3">' + escapeHtml(state.tablesError) + '</p><button class="btn btn-primary-soft" type="button" data-action="refresh-tables">Tekrar dene</button></section>';
    }
    if (!state.tablesLoaded) {
      return pageHeading("OPERASYON","Masa Yönetimi","Kayıtlı masalar getiriliyor.") +
        '<section class="panel-card p-4 text-muted small"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Masalar yükleniyor...</section>';
    }
    const rows = state.tables.map(function(table) {
      return '<tr><td><div class="d-flex align-items-center gap-2"><span class="staff-avatar"><i class="bi bi-grid-1x2-fill"></i></span><strong class="text-dark">' + escapeHtml(table.name) + '</strong></div></td><td>' + Number(table.seats) + ' kişi</td><td><div class="table-actions"><button class="table-action" type="button" data-action="edit-table" data-id="' + escapeHtml(table.id) + '" aria-label="Masayı düzenle" title="Düzenle"><i class="bi bi-pencil"></i></button><button class="table-action danger" type="button" data-action="delete-table" data-id="' + escapeHtml(table.id) + '" aria-label="Masayı sil" title="Sil"><i class="bi bi-trash3"></i></button></div></td></tr>';
    }).join("");
    return pageHeading("OPERASYON","Masa Yönetimi","Garson ve kasa süreçlerinde kullanılacak masaları ve kişi kapasitelerini buradan tanımlayın.",'<button class="btn btn-primary-soft" type="button" data-action="add-table"><i class="bi bi-plus-lg me-2"></i>Masa ekle</button>') +
      '<section class="panel-card"><div class="panel-heading"><div><h3>Kayıtlı masalar</h3><p>Eklediğiniz masalar PostgreSQL veritabanında saklanır.</p></div><span class="status-pill status-live">' + state.tables.length + ' masa</span></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>MASA</th><th>KİŞİ KAPASİTESİ</th><th class="text-end">İŞLEMLER</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="3"><div class="empty-state"><i class="bi bi-grid-3x3-gap"></i><strong>Henüz masa yok</strong><p>İlk masanızı ekleyerek başlayın.</p></div></td></tr>') +
      '</tbody></table></div></section>';
  }
  function tableForm(table) {
    const t = table || {name:"",seats:4};
    openModal(table ? "Masayı düzenle" : "Yeni masa ekle",
      '<form id="tableForm"><input type="hidden" name="id" value="' + (table ? table.id : "") + '"><div class="mb-3"><label class="form-label" for="tableName">Masa adı / numarası *</label><input class="form-control" id="tableName" name="name" required maxlength="60" value="' + escapeHtml(t.name) + '" placeholder="Örn. Masa 13 veya Bahçe 1"></div><div class="mb-3"><label class="form-label" for="tableSeats">Kişi kapasitesi *</label><input class="form-control" id="tableSeats" name="seats" type="number" min="1" max="100" step="1" required value="' + escapeHtml(t.seats) + '"><div class="form-text">Bu masa için aynı anda kaç kişilik yer olduğunu belirtin.</div></div></form>',
      '<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="button" data-action="save-table">Kaydet</button>');
  }
  function appearanceView() {
    if (!state.appearanceLoaded) {
      return pageHeading("MENÜ TASARIMI","Menü Görünümü","Menü görünümü ayarları yükleniyor.") +
        '<section class="panel-card p-4 text-muted small"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Kaydedilmiş ayarlar getiriliyor...</section>';
    }
    const a=state.appearance;
    const isOpen=a.isOpen!==false;
    return pageHeading("MENÜ TASARIMI","Menü Görünümü","Müşteri menünüzün üst bölümünü ve işletme bilgilerini kolayca özelleştirin.") +
      `<div class="appearance-editor">
        <form id="appearanceForm" class="appearance-form">
          <input type="hidden" name="currentLogo" value="${escapeHtml(a.logo||"")}">
          <input type="hidden" name="currentCover" value="${escapeHtml(a.cover||"")}">
          <input type="hidden" name="removeLogo" value="false">
          <input type="hidden" name="removeCover" value="false">
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
            <div class="appearance-section-heading"><span class="appearance-section-icon"><i class="bi bi-google"></i></span><div><h3>Google yorum bağlantısı</h3><p>Müşterilerin menüden doğrudan Google yorum sayfanıza ulaşmasını sağlayın.</p></div></div>
            <div class="mb-3">
              <label class="form-label" for="googleReviewUrl">Google yorum bağlantısı</label>
              <input class="form-control" id="googleReviewUrl" name="googleReviewUrl" type="url" maxlength="1000" value="${escapeHtml(a.googleReviewUrl||"")}" placeholder="https://g.page/r/.../review">
              <div class="form-text">Google İşletme Profilinizdeki yorum paylaşım bağlantısını buraya yapıştırın. Alan boş bırakılırsa müşteri menüsünde yorum butonu gösterilmez.</div>
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
  function staffRoleLabel(role) {
    return ({ADMIN:"Yönetici",WAITER:"Garson",CASHIER:"Kasiyer"})[role] || role;
  }
  function staffView() {
    const currentUserId = document.querySelector(".admin-shell")?.dataset.currentUserId || "";
    const rows = state.staff.map(function (person) {
      const isSelf = person.id === currentUserId;
      const initials = person.username.slice(0, 2).toLocaleUpperCase("tr");
      return '<tr><td><div class="d-flex align-items-center gap-2"><span class="staff-avatar">' + escapeHtml(initials) + '</span><strong class="text-dark">' + escapeHtml(person.username) + (isSelf ? ' <small class="text-muted">(Siz)</small>' : '') + '</strong></div></td><td>' + escapeHtml(staffRoleLabel(person.role)) + '</td><td>' + statusLabel(person.isActive ? "active" : "inactive") + '</td><td><div class="table-actions"><button class="table-action" type="button" data-action="edit-staff" data-id="' + escapeHtml(person.id) + '" aria-label="Personeli düzenle" title="Düzenle"><i class="bi bi-pencil"></i></button><button class="table-action" type="button" data-action="toggle-staff" data-id="' + escapeHtml(person.id) + '" aria-label="Personel durumunu değiştir" title="' + (person.isActive ? "Hesabı pasifleştir" : "Hesabı etkinleştir") + '"' + (isSelf ? ' disabled title="Kendi hesabınızı buradan pasifleştiremezsiniz"' : '') + '><i class="bi bi-' + (person.isActive ? "person-dash" : "person-check") + '"></i></button><button class="table-action danger" type="button" data-action="delete-staff" data-id="' + escapeHtml(person.id) + '" aria-label="Personeli sil" title="Sil"' + (isSelf ? ' disabled title="Kendi hesabınızı buradan silemezsiniz"' : '') + '><i class="bi bi-trash3"></i></button></div></td></tr>';
    }).join("");

    return pageHeading("EKİP YÖNETİMİ","Personel ve Yetkiler","Personel hesaplarını, kullanıcı adlarını, rollerini ve erişim durumlarını yönetin.",'<button class="btn btn-primary-soft" type="button" data-action="add-staff"><i class="bi bi-person-plus me-2"></i>Personel ekle</button>') +
      '<section class="panel-card"><div class="panel-heading"><div><h3>Personel hesapları</h3><p>Buradaki değişiklikler doğrudan PostgreSQL veritabanına kaydedilir.</p></div><span class="status-pill status-live">' + state.staff.length + ' hesap</span></div><div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>KULLANICI ADI</th><th>ROL</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="4"><div class="empty-state"><i class="bi bi-people"></i><strong>Henüz personel hesabı yok</strong><p>İlk personel hesabınızı oluşturun.</p></div></td></tr>') +
      '</tbody></table></div></section>' +
      '<section class="panel-card mt-3"><div class="panel-heading"><div><h3>Rol açıklamaları</h3><p>Her hesap yalnızca kendisine tanımlanan yetki alanına erişir.</p></div></div><div class="px-3 pb-3"><div class="setting-row"><span><strong>Yönetici</strong><small>Yönetim paneli, personel ve işletme ayarları.</small></span><i class="bi bi-shield-lock fs-5 text-secondary"></i></div><div class="setting-row"><span><strong>Garson</strong><small>Menüdeki kategori ve ürünleri görüntüleme.</small></span><i class="bi bi-person fs-5 text-secondary"></i></div><div class="setting-row"><span><strong>Kasiyer</strong><small>Kasa ve ödeme ekranı.</small></span><i class="bi bi-cash-coin fs-5 text-secondary"></i></div></div></section>';
  }
  async function loadStaff() {
    const response = await fetch("/api/staff", { headers: { "Accept": "application/json" } });
    let result;
    try { result = await response.json(); } catch (error) { throw new Error("Oturum doğrulanamadı. Lütfen tekrar giriş yapın."); }
    if (!response.ok) throw new Error(result.error || "Personel listesi yüklenemedi.");
    state.staff = Array.isArray(result.users) ? result.users : [];
    if (state.view === "staff") root.innerHTML = staffView();
  }
  async function staffRequest(url, options) {
    const response = await fetch(url, Object.assign({
      headers: { "Content-Type": "application/json", "Accept": "application/json" }
    }, options || {}));

    if (response.redirected && new URL(response.url, window.location.origin).pathname === "/login") {
      throw new Error("Oturumunuz sona ermiş. Lütfen yeniden giriş yapıp işlemi tekrarlayın.");
    }
    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    let result;
    if (contentType.includes("application/json")) {
      try {
        result = await response.json();
      } catch (error) {
        throw new Error("Sunucu yanıtı okunamadı. Sayfayı yenileyip tekrar deneyin.");
      }
    } else {
      const responseText = await response.text();
      if (!response.ok) {
        const detail = responseText.replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 180);
        throw new Error(detail || "Sunucu isteği tamamlayamadı (HTTP " + response.status + ").");
      }
      throw new Error("Sunucu JSON yerine beklenmeyen bir yanıt döndürdü. Oturumu ve sunucu kayıtlarını kontrol edin.");
    }

    if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
    return result;
  }
  async function loadBusinessSettings() {
    const response = await fetch("/api/business-settings", { headers: { "Accept": "application/json" } });
    let result;
    try { result = await response.json(); }
    catch (error) { throw new Error("İşletme ayarları okunamadı."); }
    if (!response.ok) throw new Error(result.error || "İşletme ayarları yüklenemedi.");

    let settings = result.settings;
    if (!settings) {
      let legacy = null;
      try {
        const saved = localStorage.getItem("roastAdmin_settings");
        if (saved) legacy = JSON.parse(saved);
      } catch (error) {
        console.warn("Eski işletme ayarları okunamadı.");
      }

      const source = Object.assign({}, defaults.settings, legacy || {});
      const migrated = await staffRequest("/api/admin/business-settings", {
        method: "PUT",
        body: JSON.stringify({
          phone: String(source.phone || ""),
          email: String(source.email || ""),
          address: String(source.address || ""),
          description: String(source.description || ""),
          instagram: String(source.instagram || ""),
          whatsapp: String(source.whatsapp || "")
        })
      });
      settings = migrated.settings;
    }

    state.settings = Object.assign({}, defaults.settings, settings || {});
    state.settingsLoaded = true;
    state.settingsError = "";
    try { localStorage.removeItem("roastAdmin_settings"); } catch (error) {}
    if (state.view === "settings") render("settings", false);
    return state.settings;
  }

  async function loadAppearance() {
    const response = await fetch("/api/appearance", { headers: { "Accept": "application/json" } });
    let result;
    try { result = await response.json(); }
    catch (error) { throw new Error("Menü görünümü ayarları okunamadı."); }
    if (!response.ok) throw new Error(result.error || "Menü görünümü ayarları yüklenemedi.");

    let appearance = result.appearance;
    if (!appearance) {
      let legacy = null;
      try {
        const saved = localStorage.getItem("roastAdmin_appearance");
        if (saved) legacy = JSON.parse(saved);
      } catch (error) {
        console.warn("Eski menü görünümü ayarları okunamadı.");
      }

      const source = Object.assign({}, defaults.appearance, legacy || {});
      const payload = {
        brandName: String(source.brandName || defaults.appearance.brandName),
        tagline: String(source.tagline || ""),
        eyebrow: String(source.eyebrow || ""),
        headline: String(source.headline || ""),
        accent: /^#[0-9a-fA-F]{6}$/.test(source.accent || "") ? source.accent : defaults.appearance.accent,
        isOpen: source.isOpen !== false,
        googleReviewUrl: String(source.googleReviewUrl || ""),
        logoUrl: "",
        coverUrl: ""
      };

      if (typeof source.logo === "string" && source.logo.startsWith("data:image/")) {
        payload.logoImageData = source.logo;
      } else if (typeof source.logo === "string") {
        payload.logoUrl = source.logo;
      }

      if (typeof source.cover === "string" && source.cover.startsWith("data:image/")) {
        payload.coverImageData = source.cover;
      } else if (typeof source.cover === "string") {
        payload.coverUrl = source.cover;
      }

      const created = await staffRequest("/api/admin/appearance", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      appearance = created.appearance;
    }

    state.appearance = Object.assign({}, defaults.appearance, appearance || {});
    state.appearanceLoaded = true;
    try { localStorage.removeItem("roastAdmin_appearance"); } catch (error) {}
    if (state.view === "appearance") render("appearance", false);
    return state.appearance;
  }

  async function loadCatalog() {
    const response = await fetch("/api/catalog", { headers: { "Accept": "application/json" } });
    let result;
    try { result = await response.json(); }
    catch (error) { throw new Error("Katalog verileri okunamadı. Oturumunuzu kontrol edin."); }
    if (!response.ok) throw new Error(result.error || "Ürün ve kategori bilgileri yüklenemedi.");
    const previousDraftIds = Array.isArray(state.categoryDraftIds) ? state.categoryDraftIds : null;
    state.categories = Array.isArray(result.categories) ? result.categories : [];
    if (previousDraftIds) {
      const currentIds = new Set(state.categories.map(function (category) { return String(category.id); }));
      const retainedIds = previousDraftIds.filter(function (id) { return currentIds.has(String(id)); });
      const retainedSet = new Set(retainedIds.map(String));
      state.categoryDraftIds = retainedIds.concat(
        state.categories
          .map(function (category) { return String(category.id); })
          .filter(function (id) { return !retainedSet.has(id); })
      );
    }
    state.products = Array.isArray(result.products) ? result.products : [];
    if (["overview", "products", "categories"].includes(state.view) && viewRenderers[state.view]) {
      root.innerHTML = viewRenderers[state.view]();
    }
    return result;
  }
  function setCategoryDraftOrder(categoryIds) {
    if (state.categorySaving || categoryIds.length !== state.categories.length) return;

    const persistedIds = state.categories.map(function (category) { return String(category.id); });
    const nextIds = categoryIds.map(String);
    const currentIds = new Set(persistedIds);

    if (nextIds.length !== currentIds.size || nextIds.some(function (id) { return !currentIds.has(id); })) {
      return;
    }

    const unchanged = nextIds.every(function (id, index) {
      return id === persistedIds[index];
    });
    state.categoryDraftIds = unchanged ? null : nextIds;
    if (state.view === "categories") root.innerHTML = categoriesView();
  }

  async function saveCategoryOrder() {
    if (state.categorySaving || !Array.isArray(state.categoryDraftIds)) return;

    const categoryIds = state.categoryDraftIds.slice();
    if (categoryIds.length !== state.categories.length) {
      notify("Kategori listesi değişti. Sayfayı yenileyip tekrar deneyin.");
      return;
    }

    state.categorySaving = true;
    if (state.view === "categories") root.innerHTML = categoriesView();

    try {
      const result = await staffRequest("/api/catalog/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: categoryIds })
      });
      state.categories = Array.isArray(result.categories) ? result.categories : state.categories;
      state.categoryDraftIds = null;
      notify("Kategori sıralaması kaydedildi.");
    } catch (error) {
      notify(error.message || "Kategori sıralaması kaydedilemedi. Değişiklikler taslak olarak korundu.");
    } finally {
      state.categorySaving = false;
      if (state.view === "categories") root.innerHTML = categoriesView();
    }
  }

  function cancelCategoryOrder() {
    if (state.categorySaving || !Array.isArray(state.categoryDraftIds)) return;
    state.categoryDraftIds = null;
    state.draggedCategoryId = null;
    if (state.view === "categories") root.innerHTML = categoriesView();
  }

  async function loadTables() {
    const result = await staffRequest("/api/admin/tables");
    state.tables = Array.isArray(result.tables) ? result.tables : [];
    state.tablesLoaded = true;
    state.tablesError = "";
    if (state.view === "tables") root.innerHTML = tablesView();
    return result;
  }
  function settingsView() {
    if (!state.settingsLoaded) {
      const message = state.settingsError
        ? '<p class="mb-3">' + escapeHtml(state.settingsError) + '</p><button class="btn btn-primary-soft" type="button" data-action="refresh-business-settings">Tekrar dene</button>'
        : '<span class="spinner-border spinner-border-sm me-2" role="status"></span>İşletme ayarları yükleniyor...';
      return pageHeading("İŞLETME","İşletme Ayarları","İşletme bilgileri yükleniyor.") +
        '<section class="panel-card p-4 text-muted small">' + message + '</section>';
    }
    const s=state.settings;
    return pageHeading("İŞLETME","İşletme Ayarları","Yalnızca müşteri menüsünün alt bölümünde (footer) gösterilecek iletişim bilgilerini yönetin.") +
      '<div class="settings-grid"><section class="panel-card"><div class="panel-heading"><div><h3>Footer bilgileri</h3><p>İşletme adı Menü Görünümü bölümünden yönetilir. Buradaki bilgiler menünün en altında gösterilir.</p></div></div><form id="settingsForm" class="p-3 pt-0"><div class="mb-3"><label class="form-label" for="businessPhone">Telefon</label><input class="form-control" id="businessPhone" name="phone" type="tel" value="'+escapeHtml(s.phone)+'" placeholder="05xx xxx xx xx"></div><div class="mb-3"><label class="form-label" for="businessEmail">E-posta</label><input class="form-control" id="businessEmail" name="email" type="email" value="'+escapeHtml(s.email)+'" placeholder="info@isletme.com"></div><div class="mb-3"><label class="form-label" for="businessAddress">Adres</label><textarea class="form-control" id="businessAddress" name="address" rows="2" placeholder="İşletme adresi">'+escapeHtml(s.address)+'</textarea></div><div class="mb-3"><label class="form-label" for="businessDescription">Footer açıklaması</label><textarea class="form-control" id="businessDescription" name="description" rows="2" maxlength="250" placeholder="Kısa işletme açıklaması">'+escapeHtml(s.description)+'</textarea></div><button class="btn btn-primary-soft" type="submit"><i class="bi bi-check2 me-2"></i>Footer bilgilerini kaydet</button></form></section>' +
      '<section class="panel-card"><div class="panel-heading"><div><h3>Sosyal medya bağlantıları</h3><p>Footer bölümündeki Instagram ve WhatsApp bağlantıları.</p></div></div><form id="contactForm" class="p-3 pt-0"><div class="mb-3"><label class="form-label" for="instagramUrl">Instagram bağlantısı</label><input class="form-control" id="instagramUrl" name="instagram" type="url" value="'+escapeHtml(s.instagram)+'" placeholder="https://instagram.com/..."></div><div class="mb-3"><label class="form-label" for="whatsappUrl">WhatsApp bağlantısı</label><input class="form-control" id="whatsappUrl" name="whatsapp" type="url" value="'+escapeHtml(s.whatsapp)+'" placeholder="https://wa.me/90..."></div><button class="btn btn-primary-soft" type="submit"><i class="bi bi-check2 me-2"></i>Bağlantıları kaydet</button></form></section></div>';
  }
  const viewRenderers = {overview:overviewView,products:productsView,categories:categoriesView,tables:tablesView,appearance:appearanceView,staff:staffView,settings:settingsView,revenue:revenueView};
  const viewTitles = {overview:"Genel Bakış",products:"Ürünler",categories:"Kategoriler",tables:"Masa Yönetimi",appearance:"Menü Görünümü",staff:"Personel ve Yetkiler",settings:"İşletme Ayarları",revenue:"Ciro Raporu"};
  function render(view, updateHash) {
    state.view = viewRenderers[view] ? view : "overview";
    if (state.view === "staff") {
      root.innerHTML = pageHeading("EKİP YÖNETİMİ","Personel ve Yetkiler","Personel hesapları yükleniyor...") + '<section class="panel-card p-4 text-muted small"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Personel kayıtları getiriliyor...</section>';
      loadStaff().catch(function(error) {
        if (state.view === "staff") {
          root.innerHTML = pageHeading("EKİP YÖNETİMİ","Personel ve Yetkiler","Personel hesapları yüklenemedi.") + '<section class="panel-card p-4"><p class="mb-3">' + escapeHtml(error.message) + '</p><button class="btn btn-primary-soft" type="button" data-action="refresh-staff">Tekrar dene</button></section>';
        }
      });
    } else {
      root.innerHTML = viewRenderers[state.view]();
      if (state.view === "revenue") loadRevenue();
    }
    title.textContent = viewTitles[state.view];
    crumb.textContent = viewTitles[state.view].toLocaleUpperCase("tr");
    document.querySelectorAll(".admin-nav-link").forEach(function(link){link.classList.toggle("active",link.dataset.view===state.view);});
    if (updateHash !== false && window.location.hash !== "#"+state.view) history.replaceState(null,"","#"+state.view);
    const sidebar=document.getElementById("adminSidebar");
    if (sidebar && window.bootstrap && sidebar.classList.contains("show")) bootstrap.Offcanvas.getOrCreateInstance(sidebar).hide();
  }
  function openModal(titleText, body, footer) {
    modalContent.innerHTML='<div class="modal-header"><h2 class="modal-title">'+titleText+'</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button></div><div class="modal-body">'+body+'</div><div class="modal-footer">'+(footer||'<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button>')+'</div>';
    if(modal) modal.show();
  }
  async function submitProductForm(event) {
    event.preventDefault();
    event.stopPropagation();

    const form = event.currentTarget;
    const data = formObject(form);
    const id = String(data.id || "");
    const payload = {
      name: String(data.name || "").trim(),
      categoryId: String(data.categoryId || ""),
      price: String(data.price || ""),
      description: String(data.description || "").trim(),
      status: String(data.status || "active")
    };

    const file = form.querySelector('[name="imageFile"]')?.files?.[0] || selectedProductImageFile;
    if (file) {
      try {
        const imageData = selectedProductImageFile === file && selectedProductImageData
          ? selectedProductImageData
          : await imageFileToDataUrl(file, 900);
        if (imageData.length > 1_400_000) {
          notify("Görsel sıkıştırıldıktan sonra 1 MB sınırını aşıyor. Daha küçük bir görsel deneyin.");
          return;
        }
        payload.imageData = imageData;
      } catch (error) {
        notify("Görsel okunamadı. PNG, JPEG veya WebP dosyası deneyin.");
        return;
      }
    } else if (data.removeImage === "true") {
      payload.removeImage = true;
    }

    if (!payload.name || !payload.categoryId) {
      notify("Ürün adı ve kategori seçin.");
      return;
    }

    const saveButton = document.querySelector('button[form="productForm"][type="submit"]');
    if (saveButton) saveButton.disabled = true;
    try {
      await staffRequest(id ? "/api/catalog/products/" + encodeURIComponent(id) : "/api/catalog/products", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      selectedProductImageFile = null;
      selectedProductImageData = "";
      if (modal) modal.hide();
      await loadCatalog();
      if (state.view !== "products") render("products", false);
      notify(id ? "Ürün güncellendi." : "Yeni ürün oluşturuldu.");
    } catch (error) {
      notify(error.message);
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }

  function productForm(product) {
    selectedProductImageFile = null;
    selectedProductImageData = "";
    const p=product||{name:"",categoryId:state.categories[0]?state.categories[0].id:"",price:"",description:"",status:"active",image:""};
    const productAction=product?"/api/catalog/products/"+encodeURIComponent(p.id):"/api/catalog/products";
    openModal(product?"Ürünü düzenle":"Yeni ürün ekle",'<form id="productForm" method="post" action="'+productAction+'"><input type="hidden" name="id" value="'+(p.id||"")+'"><input type="hidden" name="removeImage" value="false"><div class="row g-3"><div class="col-md-7"><label class="form-label" for="productName">Ürün adı *</label><input class="form-control" id="productName" name="name" required maxlength="100" value="'+escapeHtml(p.name)+'"></div><div class="col-md-5"><label class="form-label" for="productPrice">Fiyat (TL) *</label><input class="form-control" id="productPrice" name="price" type="number" min="0" max="99999999.99" step="0.01" required value="'+escapeHtml(p.price)+'"></div><div class="col-md-6"><label class="form-label" for="productCategory">Kategori *</label><select class="form-select" id="productCategory" name="categoryId" required>'+categoryOptions(p.categoryId)+'</select></div><div class="col-md-6"><label class="form-label" for="productStatus">Yayın durumu</label><select class="form-select" id="productStatus" name="status"><option value="active" '+(p.status==="active"?"selected":"")+'>Yayında</option><option value="out" '+(p.status==="out"?"selected":"")+'>Tükendi</option><option value="hidden" '+(p.status==="hidden"?"selected":"")+'>Taslak / gizli</option></select></div><div class="col-12"><label class="form-label" for="productDescription">Açıklama</label><textarea class="form-control" id="productDescription" name="description" rows="3" maxlength="300">'+escapeHtml(p.description)+'</textarea></div><div class="col-12"><label class="form-label" for="productImageFile">Ürün görseli</label><input class="form-control" id="productImageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp"><div class="form-text">Görseller WebP biçiminde küçültülerek sunucuda saklanır. En fazla 1 MB.</div><div class="image-upload-preview mt-2" id="productImagePreview">'+(p.image?'<img src="'+escapeHtml(p.image)+'" alt="Mevcut ürün görseli">':'<span>Henüz görsel seçilmedi</span>')+'</div><button class="btn btn-sm btn-outline-soft mt-2" type="button" data-action="remove-product-image">Görseli kaldır</button></div></div></form>','<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="productForm">Kaydet</button>');
    const productFormElement = document.getElementById("productForm");
    if (productFormElement) productFormElement.addEventListener("submit", submitProductForm);
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
    const categoryAction=category?"/api/catalog/categories/"+encodeURIComponent(c.id):"/api/catalog/categories";
    openModal(category?"Kategoriyi düzenle":"Yeni kategori",'<form id="categoryForm" method="post" action="'+categoryAction+'"><input type="hidden" name="id" value="'+(c.id||"")+'"><div class="mb-3"><label class="form-label" for="categoryName">Kategori adı *</label><input class="form-control" id="categoryName" name="name" required maxlength="70" value="'+escapeHtml(c.name)+'"></div><div class="mb-3">'+categoryIconPicker(c.icon)+'</div><div class="mb-2"><label class="form-label" for="categoryDescription">Kısa açıklama</label><textarea class="form-control" id="categoryDescription" name="description" rows="2">'+escapeHtml(c.description)+'</textarea></div></form>','<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="categoryForm">Kaydet</button>');
  }
  function staffForm(person) {
    const currentUserId = document.querySelector(".admin-shell")?.dataset.currentUserId || "";
    const isSelf = Boolean(person && person.id === currentUserId);
    const s = person || { username: "", role: "WAITER", isActive: true };
    const roleOptions = '<option value="WAITER" ' + (s.role === "WAITER" ? "selected" : "") + '>Garson</option><option value="CASHIER" ' + (s.role === "CASHIER" ? "selected" : "") + '>Kasiyer</option><option value="ADMIN" ' + (s.role === "ADMIN" ? "selected" : "") + '>Yönetici</option>';
    const roleField = isSelf
      ? '<div class="mb-3"><label class="form-label">Rol</label><input class="form-control" value="Yönetici (kendi rolünüz değiştirilemez)" disabled></div>'
      : '<div class="mb-3"><label class="form-label" for="staffRole">Rol</label><select class="form-select" id="staffRole" name="role" required>' + roleOptions + '</select></div>';
    const staffAction = person ? "/api/staff/" + encodeURIComponent(s.id) : "/api/staff";
    openModal(person ? "Personel hesabını düzenle" : "Yeni personel hesabı", '<form id="staffForm" method="post" action="' + staffAction + '"><input type="hidden" name="id" value="' + (s.id || "") + '"><div class="mb-3"><label class="form-label" for="staffUsername">Kullanıcı adı *</label><input class="form-control" id="staffUsername" name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" autocomplete="off" value="' + escapeHtml(s.username) + '" placeholder="ornek.garson"></div>' + roleField + '<div class="mb-2"><label class="form-label" for="staffPassword">' + (person ? "Yeni parola (isteğe bağlı)" : "Parola *") + '</label><input class="form-control" id="staffPassword" name="password" type="password" ' + (person ? "" : "required") + ' minlength="12" maxlength="128" autocomplete="new-password" placeholder="' + (person ? "Değiştirmek istemiyorsanız boş bırakın" : "En az 12 karakter") + '"></div><div class="form-text">Parola en az 12 karakter olmalıdır. Hesap bilgileri veritabanında güvenli biçimde saklanır.</div></form>', '<button class="btn btn-outline-soft" type="button" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary-soft" type="submit" form="staffForm">Kaydet</button>');
  }
  function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
  async function saveTableForm(form, saveButton) {
    const data = formObject(form);
    const id = String(data.id || "");
    const name = String(data.name || "").trim();
    const seats = Number(data.seats);

    if (!name) {
      notify("Masa adı veya numarası girin.");
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 100) {
      notify("Kişi kapasitesi 1 ile 100 arasında tam sayı olmalıdır.");
      return;
    }

    if (saveButton) saveButton.disabled = true;
    try {
      const result = await staffRequest(
        id ? "/api/admin/tables/" + encodeURIComponent(id) : "/api/admin/tables",
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify({ name: name, seats: seats })
        }
      );

      if (!result || !result.table) {
        throw new Error("Sunucu masa kaydını doğrulayan bir yanıt göndermedi.");
      }

      const savedTable = result.table;
      if (id) {
        const index = state.tables.findIndex(function (table) { return String(table.id) === id; });
        if (index >= 0) state.tables[index] = savedTable;
        else state.tables.push(savedTable);
      } else {
        state.tables.push(savedTable);
      }

      state.tables.sort(function (a, b) {
        return Number(a.sortOrder) - Number(b.sortOrder) || String(a.name).localeCompare(String(b.name), "tr");
      });
      state.tablesLoaded = true;
      state.tablesError = "";

      if (modal) modal.hide();
      if (state.view === "tables") root.innerHTML = tablesView();
      notify(id ? "Masa bilgileri güncellendi." : "Yeni masa eklendi.");
    } catch (error) {
      notify(error.message || "Masa kaydedilemedi.");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  }
  function setView(view) { render(view); }
  root.addEventListener("dragstart", function (event) {
    const handle = event.target.closest("[data-category-drag-handle]");
    if (!handle || state.categorySaving) {
      if (handle) event.preventDefault();
      return;
    }
    const card = handle.closest("[data-category-sort-item]");
    if (!card) return;

    state.draggedCategoryId = card.dataset.categoryId || null;
    card.classList.add("opacity-50");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", state.draggedCategoryId || "");
    }
  });

  root.addEventListener("dragover", function (event) {
    if (!state.draggedCategoryId) return;
    const target = event.target.closest("[data-category-sort-item]");
    const list = root.querySelector("[data-category-sort-list]");
    if (!target || !list || target.parentElement !== list) return;

    const dragged = Array.from(list.querySelectorAll("[data-category-sort-item]")).find(function (card) {
      return card.dataset.categoryId === state.draggedCategoryId;
    });
    if (!dragged || dragged === target) return;

    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    list.insertBefore(dragged, insertAfter ? target.nextElementSibling : target);
  });

  root.addEventListener("drop", function (event) {
    if (!state.draggedCategoryId) return;
    const list = root.querySelector("[data-category-sort-list]");
    if (!list) {
      state.draggedCategoryId = null;
      return;
    }

    event.preventDefault();
    const categoryIds = Array.from(list.querySelectorAll("[data-category-sort-item]")).map(function (card) {
      return card.dataset.categoryId;
    }).filter(Boolean);
    state.draggedCategoryId = null;
    root.querySelectorAll("[data-category-sort-item]").forEach(function (card) {
      card.classList.remove("opacity-50");
    });
    setCategoryDraftOrder(categoryIds);
  });

  root.addEventListener("dragend", function (event) {
    const handle = event.target.closest("[data-category-drag-handle]");
    if (!handle) return;
    const card = handle.closest("[data-category-sort-item]");
    if (card) card.classList.remove("opacity-50");
    state.draggedCategoryId = null;
  });

  document.addEventListener("click",async function(event){
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
    const action=actionButton.dataset.action, rawId=actionButton.dataset.id;
    if(action==="navigate"){setView(actionButton.dataset.view);return;}
    if(action==="refresh-revenue"){loadRevenue();return;}
    if(action==="refresh-business-settings"){
      state.settingsLoaded=false;
      state.settingsError="";
      render("settings",false);
      loadBusinessSettings().catch(function(error){
        state.settingsError=error.message;
        state.settingsLoaded=false;
        if(state.view==="settings")render("settings",false);
      });
      return;
    }
    if(action==="remove-product-image"){selectedProductImageFile=null;selectedProductImageData="";const input=document.querySelector('#productForm [name="removeImage"]');if(input)input.value="true";const preview=document.getElementById("productImagePreview");if(preview)preview.innerHTML="<span>Henüz görsel seçilmedi</span>";const file=document.getElementById("productImageFile");if(file)file.value="";return;}
    if(action==="remove-logo"||action==="remove-cover"){
      const isLogo=action==="remove-logo";
      const key=isLogo?"currentLogo":"currentCover";
      const removeKey=isLogo?"removeLogo":"removeCover";
      const input=document.querySelector('#appearanceForm [name="'+key+'"]');
      const removeInput=document.querySelector('#appearanceForm [name="'+removeKey+'"]');
      if(input)input.value="";
      if(removeInput)removeInput.value="true";
      const preview=document.getElementById(isLogo?"logoPreview":"coverPreview");
      if(preview)preview.innerHTML="<span>Görsel seçilmedi</span>";
      const file=document.getElementById(isLogo?"logoFile":"coverFile");
      if(file)file.value="";
      return;
    }
    if(action==="add-product"){if(!state.categories.length){notify("Önce en az bir kategori oluşturun.");setView("categories");return;}productForm();return;}
    if(action==="edit-product"){productForm(state.products.find(function(p){return p.id===rawId;}));return;}
    if(action==="toggle-product"){
      const product=state.products.find(function(item){return item.id===rawId;});
      if(!product)return;
      const nextStatus=product.status==="active"?"hidden":"active";
      try{
        await staffRequest("/api/catalog/products/"+encodeURIComponent(rawId),{method:"PATCH",body:JSON.stringify({status:nextStatus})});
        await loadCatalog();
        notify("Ürün durumu güncellendi.");
      }catch(error){notify(error.message);}
      return;
    }
    if(action==="delete-product"){
      const product=state.products.find(function(item){return item.id===rawId;});
      if(product&&window.confirm('"'+product.name+'" ürününü silmek istiyor musunuz?')){
        try{
          await staffRequest("/api/catalog/products/"+encodeURIComponent(rawId),{method:"DELETE"});
          await loadCatalog();
          notify("Ürün silindi.");
        }catch(error){notify(error.message);}
      }
      return;
    }
    if(action==="save-category-order"){await saveCategoryOrder();return;}
    if(action==="cancel-category-order"){cancelCategoryOrder();return;}
    if(action==="add-category"){categoryForm();return;}
    if(action==="edit-category"){categoryForm(state.categories.find(function(category){return category.id===rawId;}));return;}
    if(action==="delete-category"){
      const category=state.categories.find(function(item){return item.id===rawId;});
      if(category&&window.confirm('"'+category.name+'" kategorisini silmek istiyor musunuz?')){
        try{
          await staffRequest("/api/catalog/categories/"+encodeURIComponent(rawId),{method:"DELETE"});
          await loadCatalog();
          notify("Kategori silindi.");
        }catch(error){notify(error.message);}
      }
      return;
    }
    if(action==="refresh-tables"){
      state.tablesLoaded=false;
      state.tablesError="";
      render("tables",false);
      loadTables().catch(function(error){
        state.tablesError=error.message;
        state.tablesLoaded=false;
        if(state.view==="tables")render("tables",false);
      });
      return;
    }
    if(action==="save-table"){
      const form=document.getElementById("tableForm");
      if(!form||!form.reportValidity())return;
      await saveTableForm(form,actionButton);
      return;
    }
    if(action==="add-table"){tableForm();return;}
    if(action==="edit-table"){tableForm(state.tables.find(function(table){return String(table.id)===String(actionButton.dataset.id);}));return;}
    if(action==="delete-table"){
      const table=state.tables.find(function(item){return String(item.id)===String(actionButton.dataset.id);});
      if(!table)return;
      if(window.confirm('"'+table.name+'" masasını silmek istiyor musunuz?')){
        try{
          await staffRequest("/api/admin/tables/"+encodeURIComponent(String(table.id)),{method:"DELETE"});
          await loadTables();
          notify("Masa silindi.");
        }catch(error){notify(error.message);}
      }
      return;
    }
    if(action==="add-staff"){staffForm();return;}
    if(action==="edit-staff"){staffForm(state.staff.find(function(person){return person.id===rawId;}));return;}
    if(action==="refresh-staff"){loadStaff().catch(function(error){notify(error.message);});return;}
    if(action==="toggle-staff"){
      const person=state.staff.find(function(item){return item.id===rawId;});
      if(!person)return;
      try{
        await staffRequest("/api/staff/"+encodeURIComponent(rawId),{method:"PATCH",body:JSON.stringify({isActive:!person.isActive})});
        await loadStaff();
        notify(person.isActive?"Personel hesabı pasifleştirildi.":"Personel hesabı etkinleştirildi.");
      }catch(error){notify(error.message);}
      return;
    }
    if(action==="delete-staff"){
      const person=state.staff.find(function(item){return item.id===rawId;});
      if(person&&window.confirm(person.username+" hesabını silmek istiyor musunuz? Bu işlem geri alınamaz.")){
        try{
          await staffRequest("/api/staff/"+encodeURIComponent(rawId),{method:"DELETE"});
          await loadStaff();
          notify("Personel hesabı silindi.");
        }catch(error){notify(error.message);}
      }
      return;
    }
    if(action==="logout"){return;}
  });
  document.addEventListener("submit",async function(event){
    const form=event.target;
    if(form.id==="categoryForm"){
      event.preventDefault();
      const data=formObject(form);
      const id=String(data.id||"");
      const payload={
        name:String(data.name||"").trim(),
        icon:String(data.icon||"bi-collection"),
        description:String(data.description||"").trim()
      };
      if(!payload.name){notify("Kategori adı girin.");return;}
      try{
        await staffRequest(id?"/api/catalog/categories/"+encodeURIComponent(id):"/api/catalog/categories",{
          method:id?"PATCH":"POST",
          body:JSON.stringify(payload)
        });
        if(modal)modal.hide();
        await loadCatalog();
        if(state.view!=="categories")render("categories",false);
        notify(id?"Kategori güncellendi.":"Yeni kategori oluşturuldu.");
      }catch(error){notify(error.message);}
      return;
    }
    if(form.id==="tableForm"){
      event.preventDefault();
      await saveTableForm(form, document.querySelector('[data-action="save-table"]'));
      return;
    }
    if(form.id==="staffForm"){
      event.preventDefault();
      const data=formObject(form);
      const id=data.id;
      const payload={username:String(data.username||"").trim(),password:String(data.password||"")};
      if(data.role)payload.role=data.role;
      if(!payload.password)delete payload.password;
      if(!payload.username){notify("Kullanıcı adı girin.");return;}
      if(!id&&!payload.password){notify("Yeni hesap için parola zorunludur.");return;}
      try{
        await staffRequest(id?"/api/staff/"+encodeURIComponent(id):"/api/staff",{
          method:id?"PATCH":"POST",
          body:JSON.stringify(payload)
        });
        if(modal)modal.hide();
        await loadStaff();
        notify(id?"Personel hesabı güncellendi.":"Yeni personel hesabı oluşturuldu.");
      }catch(error){notify(error.message);}
      return;
    }
    if(form.id==="appearanceForm"){
      event.preventDefault();
      const data=formObject(form);
      const payload={
        brandName:String(data.brandName||"").trim(),
        tagline:String(data.tagline||"").trim(),
        eyebrow:String(data.eyebrow||"").trim(),
        headline:String(data.headline||"").trim(),
        logoUrl:String(data.currentLogo||""),
        coverUrl:String(data.currentCover||""),
        removeLogo:data.removeLogo==="true",
        removeCover:data.removeCover==="true",
        accent:String(data.accent||defaults.appearance.accent),
        isOpen:form.querySelector("#isOpenToggle").checked,
        googleReviewUrl:String(data.googleReviewUrl||"").trim()
      };
      if(payload.googleReviewUrl){
        try{
          const parsedReviewUrl=new URL(payload.googleReviewUrl);
          if(!["http:","https:"].includes(parsedReviewUrl.protocol)){notify("Google yorum bağlantısı http veya https ile başlamalıdır.");return;}
        }catch(error){notify("Geçerli bir Google yorum bağlantısı girin.");return;}
      }
      try{
        const logoFile=form.querySelector('[name="logoFile"]')?.files?.[0];
        const coverFile=form.querySelector('[name="coverFile"]')?.files?.[0];
        if(logoFile)payload.logoImageData=await imageFileToDataUrl(logoFile,500);
        if(coverFile)payload.coverImageData=await imageFileToDataUrl(coverFile,1400);
        if((payload.logoImageData&&payload.logoImageData.length>1_400_000)||(payload.coverImageData&&payload.coverImageData.length>1_400_000)){
          notify("Görsel boyutu sınırı aşıyor. Daha küçük bir görsel seçin.");
          return;
        }
      }catch(error){
        notify("Görsel işlenemedi. Daha küçük veya farklı bir görsel seçin.");
        return;
      }

      const saveButton=form.querySelector('[type="submit"]');
      if(saveButton)saveButton.disabled=true;
      try{
        const result=await staffRequest("/api/admin/appearance",{
          method:"PUT",
          body:JSON.stringify(payload)
        });
        state.appearance=Object.assign({},defaults.appearance,result.appearance||{});
        state.appearanceLoaded=true;
        render("appearance",false);
        notify("Menü görünümü kaydedildi.");
      }catch(error){
        notify(error.message);
      }finally{
        if(saveButton)saveButton.disabled=false;
      }
      return;
    }
    if(form.id==="settingsForm"||form.id==="contactForm"){
      event.preventDefault();
      const data=formObject(form);
      const payload=Object.assign({},state.settings);
      Object.keys(data).forEach(function(key){payload[key]=String(data[key]||"").trim();});
      const saveButton=form.querySelector('[type="submit"]');
      if(saveButton)saveButton.disabled=true;
      try{
        const result=await staffRequest("/api/admin/business-settings",{
          method:"PUT",
          body:JSON.stringify(payload)
        });
        state.settings=Object.assign({},defaults.settings,result.settings||{});
        state.settingsLoaded=true;
        notify("İşletme bilgileri kaydedildi.");
      }catch(error){
        notify(error.message);
      }finally{
        if(saveButton)saveButton.disabled=false;
      }
      return;
    }
  });
  document.addEventListener("change",async function(event){
    const fileInput=event.target.closest('input[type="file"]');if(!fileInput||!fileInput.files||!fileInput.files[0])return;
    const previewId=fileInput.id==="productImageFile"?"productImagePreview":fileInput.id==="logoFile"?"logoPreview":"coverPreview";const preview=document.getElementById(previewId);if(!preview)return;
    if(fileInput.id==="logoFile"||fileInput.id==="coverFile"){
      const removeName=fileInput.id==="logoFile"?"removeLogo":"removeCover";
      const removeInput=document.querySelector('#appearanceForm [name="'+removeName+'"]');
      if(removeInput)removeInput.value="false";
    }
    if(fileInput.id==="productImageFile"){
      const file=fileInput.files[0];
      selectedProductImageFile=file;
      selectedProductImageData="";
      try{
        const imageData=await imageFileToDataUrl(file,900);
        if(document.getElementById("productImageFile")!==fileInput||fileInput.files[0]!==file)return;
        if(imageData.length>1_400_000){preview.innerHTML="<span>Görsel 1 MB sınırını aşıyor. Daha küçük bir görsel seçin.</span>";notify("Görsel sıkıştırıldıktan sonra 1 MB sınırını aşıyor. Daha küçük bir görsel deneyin.");return;}
        selectedProductImageData=imageData;
        preview.innerHTML='<img alt="Görsel önizlemesi" src="'+imageData+'">';
      }catch(error){
        if(document.getElementById("productImageFile")===fileInput){selectedProductImageData="";preview.innerHTML="<span>Görsel okunamadı.</span>";notify("Görsel okunamadı. PNG, JPEG veya WebP dosyası deneyin.");}
      }
      return;
    }
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
    if(event.target.id==="revenueMonth"){state.revenueMonth=event.target.value||currentMonthValue(new Date());state.revenueData=null;loadRevenue();}
  });
  document.getElementById("notificationButton").addEventListener("click",function(){notify("Şimdilik yeni bildiriminiz yok.");});
  window.addEventListener("hashchange",function(){const view=window.location.hash.replace("#","");if(viewRenderers[view]&&view!==state.view)render(view,false);});
  connectRevenueEvents();
  const initial=window.location.hash.replace("#","")||"overview";
  render(viewRenderers[initial]?initial:"overview",false);
  loadCatalog().catch(function(error){console.error("Katalog yüklenemedi.",error);notify(error.message);});
  loadTables().catch(function(error){
    console.error("Masalar yüklenemedi.",error);
    state.tablesError=error.message;
    state.tablesLoaded=false;
    if(state.view==="tables")render("tables",false);
  });
  loadBusinessSettings().catch(function(error){
    console.error("İşletme ayarları yüklenemedi.",error);
    state.settingsError=error.message;
    state.settingsLoaded=false;
    if(state.view==="settings")render("settings",false);
  });
  loadAppearance().catch(function(error){
    console.error("Menü görünümü yüklenemedi.",error);
    state.appearanceLoaded=true;
    if(state.view==="appearance")render("appearance",false);
    notify(error.message);
  });
});