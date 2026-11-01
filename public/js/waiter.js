document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const state = {
    tables: [], categories: [], products: [],
    selectedTableId: null, selectedCategory: "all",
    tableQuery: "", productQuery: "", screen: "tables",
    tableError: "", menuError: ""
  };

  const toastElement = $("#waiterToast");
  const toastMessage = $("#waiterToastMessage");
  const toast = window.bootstrap && toastElement
    ? bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 2800 })
    : null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function money(value) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency", currency: "TRY", maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  async function requestJson(path) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Accept": "application/json" }
    });
    if (response.redirected && new URL(response.url, window.location.origin).pathname === "/login") {
      throw new Error("Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.");
    }
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Sunucudan geçerli bir yanıt alınamadı. Sayfayı yenileyip tekrar deneyin.");
    }
    if (!response.ok) throw new Error((result && (result.error || result.message)) || "İstek tamamlanamadı.");
    return result || {};
  }

  function selectedTable() {
    return state.tables.find(function (table) {
      return String(table.id) === String(state.selectedTableId);
    }) || null;
  }

  function showScreen(screen) {
    state.screen = screen;
    $("#tablesView").hidden = screen !== "tables";
    $("#tableDetailsView").hidden = screen !== "details";
    if (screen === "tables") {
      $("#viewEyebrow").textContent = "SALON YÖNETİMİ";
      $("#viewTitle").textContent = "Masalarım";
      $("#viewDescription").textContent = "Çalışacağınız masayı seçin; menü kategorileri ve ürünleri görüntüleyin.";
    } else {
      const table = selectedTable();
      $("#viewEyebrow").textContent = "MASA VE MENÜ";
      $("#viewTitle").textContent = table ? table.name : "Masa seçimi";
      $("#viewDescription").textContent = table
        ? "Seçilen masanın menü kategorilerini ve güncel ürünlerini görüntülüyorsunuz."
        : "Menüyü görüntülemek için bir masa seçin.";
    }
  }

  function renderTableSummary() {
    $("#activeTableCount").textContent = state.tables.length + " masa";
    $("#allTableCount").textContent = String(state.tables.length);
  }

  function renderTables() {
    const grid = $("#tablesGrid");
    renderTableSummary();

    if (state.tableError) {
      grid.innerHTML = '<div class="empty-history"><strong>Masalar yüklenemedi</strong><span>' +
        escapeHtml(state.tableError) +
        '</span><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="retryTablesButton">Tekrar dene</button></div>';
      return;
    }

    const query = state.tableQuery.trim().toLocaleLowerCase("tr-TR");
    const tables = state.tables.filter(function (table) {
      return !query || String(table.name).toLocaleLowerCase("tr-TR").includes(query);
    });

    if (!tables.length) {
      grid.innerHTML = state.tables.length
        ? '<div class="empty-history"><strong>Masa bulunamadı</strong><span>Arama kelimesini değiştirin.</span></div>'
        : '<div class="empty-history"><strong>Henüz masa eklenmemiş</strong><span>Yönetici, Masa Yönetimi bölümünden masa eklediğinde burada görünecek.</span></div>';
      return;
    }

    grid.innerHTML = tables.map(function (table) {
      const selected = String(table.id) === String(state.selectedTableId);
      return '<button class="table-card' + (selected ? ' is-active' : '') + '" type="button" data-table-id="' + escapeHtml(table.id) + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
        '<span class="table-card-top"><span class="table-card-title">' +
          '<span class="table-card-icon"><i class="bi bi-grid-1x2-fill"></i></span>' +
          '<span><strong class="table-card-name">' + escapeHtml(table.name) + '</strong><span class="table-card-seats">' + Number(table.seats) + ' kişilik masa</span></span>' +
        '</span>' +
        (selected ? '<span class="table-state-pill is-active"><span class="status-dot"></span>Seçili</span>' : '') +
        '</span><span class="table-card-bottom">' +
          '<span class="table-card-total"><span>Kapasite</span><strong>' + Number(table.seats) + ' kişi</strong></span>' +
          '<span class="table-card-last"><span>İşlem</span><strong>' + (selected ? "Seçili masa" : "Menüyü görüntüle") + '</strong></span>' +
        '</span></button>';
    }).join("");
  }

  function renderSelectedTable() {
    const table = selectedTable();
    if (!table) {
      state.selectedTableId = null;
      showScreen("tables");
      return;
    }
    $("#detailsTableName").textContent = table.name;
    $("#detailsTableMeta").textContent = Number(table.seats) + " kişilik masa";
    $("#detailsTableStatus").textContent = "Masa seçildi";
    showScreen("details");
    renderCategories();
    renderProducts();
  }

  function renderCategories() {
    const tabs = [
      '<button class="category-tab ' + (state.selectedCategory === "all" ? "active" : '') + '" type="button" data-category="all"><i class="bi bi-grid"></i><span>Tümü</span></button>'
    ];
    state.categories.forEach(function (category) {
      tabs.push('<button class="category-tab ' +
        (state.selectedCategory === String(category.id) ? "active" : '') +
        '" type="button" data-category="' + escapeHtml(category.id) + '">' +
        '<i class="bi ' + escapeHtml(category.icon || "bi-collection") + '"></i><span>' +
        escapeHtml(category.name) + '</span></button>');
    });
    $("#categoryTabs").innerHTML = tabs.join("");
  }

  function renderProducts() {
    const query = state.productQuery.trim().toLocaleLowerCase("tr-TR");
    const products = state.products.filter(function (product) {
      const matchesCategory = state.selectedCategory === "all" ||
        String(product.categoryId) === state.selectedCategory;
      const searchable = (product.name + " " + (product.description || "") + " " +
        (product.categoryName || "")).toLocaleLowerCase("tr-TR");
      return matchesCategory && (!query || searchable.includes(query));
    });

    $("#productsResultCount").textContent = products.length + " ürün";
    $("#productGrid").innerHTML = products.map(function (product) {
      const image = product.image
        ? '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
        : '<i class="bi bi-cup-hot" aria-hidden="true"></i>';
      const stockLabel = product.isOutOfStock
        ? '<span class="product-stock-label">Tükendi</span>' : "";
      return '<article class="product-card' + (product.isOutOfStock ? " is-out-of-stock" : "") + '">' +
        '<div class="product-card-image">' + image + '</div>' +
        '<div class="product-card-main"><span class="product-card-name">' + escapeHtml(product.name) + '</span>' +
        '<span class="product-card-description">' + escapeHtml(product.description || product.categoryName || "Menü ürünü") + '</span>' +
        '<div class="product-card-bottom"><span class="product-price">' + escapeHtml(money(product.price)) +
        '</span>' + stockLabel + '</div></div></article>';
    }).join("");

    const empty = $("#catalogEmpty");
    if (state.menuError) {
      empty.hidden = false;
      empty.innerHTML = '<i class="bi bi-exclamation-circle"></i><strong>Menü yüklenemedi</strong><span>' +
        escapeHtml(state.menuError) +
        '</span><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="retryMenuButton">Tekrar dene</button>';
    } else if (products.length === 0) {
      empty.hidden = false;
      empty.innerHTML = state.products.length
        ? '<i class="bi bi-search"></i><strong>Ürün bulunamadı</strong><span>Arama kelimesini veya kategoriyi değiştirin.</span>'
        : '<i class="bi bi-cup-hot"></i><strong>Henüz gösterilecek ürün yok</strong><span>Yönetici ürün ve kategori eklediğinde burada görünecek.</span>';
    } else {
      empty.hidden = true;
      empty.innerHTML = "";
    }
  }

  async function loadTables() {
    state.tableError = "";
    renderTables();
    try {
      const result = await requestJson("/api/waiter/tables");
      state.tables = Array.isArray(result.tables) ? result.tables : [];
      if (!state.tables.some(function (table) {
        return String(table.id) === String(state.selectedTableId);
      })) state.selectedTableId = null;
      renderTables();
      if (state.screen === "details") renderSelectedTable();
    } catch (error) {
      state.tableError = error.message;
      renderTables();
    }
  }

  async function loadMenu() {
    state.menuError = "";
    $("#productsResultCount").textContent = "Menü yükleniyor...";
    try {
      const result = await requestJson("/api/waiter/catalog");
      state.categories = Array.isArray(result.categories) ? result.categories : [];
      state.products = Array.isArray(result.products) ? result.products : [];
      if (state.selectedCategory !== "all" && !state.categories.some(function (category) {
        return String(category.id) === state.selectedCategory;
      })) state.selectedCategory = "all";
      renderCategories();
      renderProducts();
    } catch (error) {
      state.menuError = error.message;
      $("#categoryTabs").innerHTML = "";
      renderProducts();
    }
  }

  async function loadAppearance() {
    try {
      const result = await requestJson("/api/appearance");
      const appearance = result.appearance;
      if (!appearance) return;
      if (appearance.brandName) $("#waiterBrandName").textContent = appearance.brandName;
      const isOpen = appearance.isOpen !== false;
      $("#serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
      $("#serviceStatus").classList.toggle("is-closed", !isOpen);
    } catch (error) {
      // Masa ve menü ekranları görünüm ayarları yüklenemese de kullanılabilir.
    }
  }

  $("#tablesGrid").addEventListener("click", function (event) {
    const retryButton = event.target.closest("#retryTablesButton");
    if (retryButton) {
      retryButton.disabled = true;
      loadTables();
      return;
    }
    const button = event.target.closest("[data-table-id]");
    if (!button) return;
    state.selectedTableId = button.dataset.tableId;
    renderTables();
    renderSelectedTable();
  });

  $("#tableSearch").addEventListener("input", function (event) {
    state.tableQuery = event.target.value;
    renderTables();
  });

  $("#backToTablesButton").addEventListener("click", function () {
    showScreen("tables");
    renderTables();
  });

  $("#categoryTabs").addEventListener("click", function (event) {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.selectedCategory = button.dataset.category;
    renderCategories();
    renderProducts();
  });

  $("#productSearch").addEventListener("input", function (event) {
    state.productQuery = event.target.value;
    renderProducts();
  });

  $("#productGrid").addEventListener("click", function (event) {
    const button = event.target.closest("#retryMenuButton");
    if (button) {
      button.disabled = true;
      loadMenu();
    }
  });

  showScreen("tables");
  renderTables();
  loadTables();
  loadMenu();
  loadAppearance();
});