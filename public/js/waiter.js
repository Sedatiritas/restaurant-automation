document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const state = {
    categories: [],
    products: [],
    selectedCategory: "all",
    productQuery: ""
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function money(value) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function renderCategories() {
    const tabs = [
      '<button class="category-tab ' + (state.selectedCategory === "all" ? "active" : "") + '" type="button" data-category="all"><i class="bi bi-grid"></i><span>Tümü</span></button>'
    ];
    state.categories.forEach(function (category) {
      tabs.push(
        '<button class="category-tab ' + (state.selectedCategory === String(category.id) ? "active" : "") + '" type="button" data-category="' + escapeHtml(category.id) + '">' +
        '<i class="bi ' + escapeHtml(category.icon || "bi-collection") + '"></i><span>' + escapeHtml(category.name) + '</span></button>'
      );
    });
    $("#categoryTabs").innerHTML = tabs.join("");
  }

  function renderProducts() {
    const query = state.productQuery.trim().toLocaleLowerCase("tr-TR");
    const products = state.products.filter(function (product) {
      const matchesCategory = state.selectedCategory === "all" || String(product.categoryId) === state.selectedCategory;
      const searchable = (product.name + " " + (product.description || "") + " " + (product.categoryName || "")).toLocaleLowerCase("tr-TR");
      return matchesCategory && (!query || searchable.includes(query));
    });

    $("#productsResultCount").textContent = products.length + " ürün";
    $("#catalogEmpty").hidden = products.length > 0 || state.products.length > 0;
    $("#productGrid").innerHTML = products.map(function (product) {
      const image = product.image
        ? '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
        : '<i class="bi bi-cup-hot" aria-hidden="true"></i>';
      const stockLabel = product.isOutOfStock ? '<span class="product-stock-label">Tükendi</span>' : "";
      return '<article class="product-card' + (product.isOutOfStock ? ' is-out-of-stock' : '') + '">' +
        '<div class="product-card-image">' + image + '</div>' +
        '<div class="product-card-main">' +
          '<span class="product-card-name">' + escapeHtml(product.name) + '</span>' +
          '<span class="product-card-description">' + escapeHtml(product.description || product.categoryName || "Menü ürünü") + '</span>' +
          '<div class="product-card-bottom"><span class="product-price">' + escapeHtml(money(product.price)) + '</span>' + stockLabel + '</div>' +
        '</div>' +
      '</article>';
    }).join("");

    if (state.products.length > 0 && products.length === 0) {
      $("#catalogEmpty").hidden = false;
      $("#catalogEmpty").querySelector("strong").textContent = "Ürün bulunamadı";
      $("#catalogEmpty").querySelector("span").textContent = "Arama kelimesini veya kategoriyi değiştirin.";
    } else if (state.products.length === 0) {
      $("#catalogEmpty").hidden = false;
      $("#catalogEmpty").querySelector("strong").textContent = "Henüz gösterilecek ürün yok";
      $("#catalogEmpty").querySelector("span").textContent = "Yönetici ürün ve kategori eklediğinde burada görünecek.";
    } else {
      $("#catalogEmpty").hidden = true;
      $("#catalogEmpty").querySelector("strong").textContent = "Henüz gösterilecek ürün yok";
      $("#catalogEmpty").querySelector("span").textContent = "Yönetici ürün ve kategori eklediğinde burada görünecek.";
    }
  }

  function showLoadError(error) {
    $("#productsResultCount").textContent = "Menü yüklenemedi";
    $("#categoryTabs").innerHTML = "";
    $("#productGrid").innerHTML =
      '<div class="catalog-empty"><i class="bi bi-exclamation-circle"></i><strong>Menü bilgileri alınamadı</strong><span>' + escapeHtml(error.message) + '</span><button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="retryCatalogButton">Tekrar dene</button></div>';
    $("#catalogEmpty").hidden = true;
  }

  async function loadMenu() {
    $("#productsResultCount").textContent = "Menü yükleniyor...";
    const response = await fetch("/api/waiter/catalog", { headers: { "Accept": "application/json" }, cache: "no-store" });
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error("Sunucudan geçerli bir menü yanıtı alınamadı.");
    }
    if (!response.ok) throw new Error(result.error || "Menü bilgileri yüklenemedi.");

    state.categories = Array.isArray(result.categories) ? result.categories : [];
    state.products = Array.isArray(result.products) ? result.products : [];
    if (!state.categories.some(function (category) { return String(category.id) === state.selectedCategory; }) && state.selectedCategory !== "all") {
      state.selectedCategory = "all";
    }
    renderCategories();
    renderProducts();
  }

  async function loadAppearance() {
    try {
      const response = await fetch("/api/appearance", { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      const appearance = result.appearance;
      if (!appearance) return;
      if (appearance.brandName) $("#waiterBrandName").textContent = appearance.brandName;
      const isOpen = appearance.isOpen !== false;
      $("#serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
      $("#serviceStatus").classList.toggle("is-closed", !isOpen);
    } catch (error) {
      // The catalogue remains usable if appearance settings cannot be loaded.
    }
  }

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

  $("#productGrid").addEventListener("click", async function (event) {
    const button = event.target.closest("#retryCatalogButton");
    if (!button) return;
    button.disabled = true;
    try {
      await loadMenu();
    } catch (error) {
      showLoadError(error);
    }
  });

  loadMenu().catch(showLoadError);
  loadAppearance();
});
