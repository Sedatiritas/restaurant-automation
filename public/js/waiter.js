document.addEventListener("DOMContentLoaded", function () {
  const byId = function (id) { return document.getElementById(id); };
  const state = {
    tables: [],
    categories: [],
    products: [],
    selectedTableId: null,
    selectedCategory: "all",
    tableQuery: "",
    tableFilter: "all",
    productQuery: "",
    screen: "tables",
    tableError: "",
    menuError: "",
    sendingOrder: false,
    draftItems: []
  };

  const toastElement = byId("waiterToast");
  const toastMessage = byId("waiterToastMessage");
  const toast = window.bootstrap && toastElement
    ? window.bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 2800 })
    : null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function money(value) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function showToast(message) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.show();
  }

  function formatActivityTime(value) {
    if (!value) return "Henüz yok";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Henüz yok";

    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  async function requestJson(path) {
    const response = await fetch(path, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (response.redirected) {
      const finalPath = new URL(response.url, window.location.origin).pathname;
      if (finalPath === "/login") {
        throw new Error("Oturumunuz sona ermiş. Lütfen yeniden giriş yapın.");
      }
    }

    let result;
    try {
      result = await response.json();
    } catch (_error) {
      throw new Error("Sunucudan geçerli bir yanıt alınamadı. Sayfayı yenileyip tekrar deneyin.");
    }

    if (!response.ok) {
      throw new Error((result && (result.error || result.message)) || "İstek tamamlanamadı.");
    }

    return result || {};
  }

  function selectedTable() {
    return state.tables.find(function (table) {
      return String(table.id) === String(state.selectedTableId);
    }) || null;
  }

  function showScreen(screen) {
    state.screen = screen;
    byId("tablesView").hidden = screen !== "tables";
    byId("tableDetailsView").hidden = screen !== "details";
    byId("newOrderView").hidden = screen !== "order";

    if (screen === "tables") {
      byId("viewEyebrow").textContent = "SALON YÖNETİMİ";
      byId("viewTitle").textContent = "Masalarım";
      byId("viewDescription").textContent = "Masa durumlarını, açık hesapları ve son siparişleri görüntüle.";
      return;
    }

    const table = selectedTable();
    if (screen === "details") {
      byId("viewEyebrow").textContent = "MASA DETAYI";
      byId("viewTitle").textContent = table ? table.name : "Masa seçimi";
      byId("viewDescription").textContent = table
        ? "Seçilen masanın bilgilerini ve menü kataloğunu görüntülüyorsunuz."
        : "Menüyü görüntülemek için bir masa seçin.";
      return;
    }

    byId("viewEyebrow").textContent = "YENİ SİPARİŞ";
    byId("viewTitle").textContent = table ? table.name + " için sipariş" : "Yeni sipariş";
    byId("viewDescription").textContent = "Ürünleri seç, kontrol et ve mutfağa gönder.";
  }

  function renderTableSummary() {
    const activeCount = state.tables.filter(function (table) {
      return table.billStatus === "OPEN";
    }).length;

    byId("activeTableCount").textContent = activeCount + " masa";
    byId("allTableCount").textContent = String(state.tables.length);
    byId("occupiedTableCount").textContent = String(activeCount);
  }

  function renderTables() {
    const grid = byId("tablesGrid");
    renderTableSummary();

    if (state.tableError) {
      grid.innerHTML =
        '<div class="empty-history">' +
          '<span class="empty-history-icon"><i class="bi bi-exclamation-circle"></i></span>' +
          '<strong>Masalar yüklenemedi</strong>' +
          '<span>' + escapeHtml(state.tableError) + '</span>' +
          '<button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="retryTablesButton">Tekrar dene</button>' +
        '</div>';
      return;
    }

    const query = state.tableQuery.trim().toLocaleLowerCase("tr-TR");
    const tables = state.tables.filter(function (table) {
      const matchesQuery = !query || String(table.name || "").toLocaleLowerCase("tr-TR").includes(query);
      const matchesStatus = state.tableFilter === "all" || table.billStatus === "OPEN";
      return matchesQuery && matchesStatus;
    });

    if (!tables.length) {
      if (state.tableFilter === "active" && state.tables.length) {
        grid.innerHTML = '<div class="empty-history"><strong>Açık adisyonlu masa bulunmuyor</strong><span>Şu anda açık hesabı olan bir masa yok.</span></div>';
      } else {
        grid.innerHTML = state.tables.length
          ? '<div class="empty-history"><strong>Masa bulunamadı</strong><span>Arama kelimesini değiştirin.</span></div>'
          : '<div class="empty-history"><strong>Henüz masa eklenmemiş</strong><span>Yönetici, Masa Yönetimi bölümünden masa eklediğinde burada görünecek.</span></div>';
      }
      return;
    }

    grid.innerHTML = tables.map(function (table) {
      const selected = String(table.id) === String(state.selectedTableId);
      const seats = Number(table.seats) || 0;
      const hasOpenBill = table.billStatus === "OPEN";
      const billTotal = money(table.currentBillTotal);
      const lastActivity = formatActivityTime(table.lastActivityAt);
      const sentOrderCount = Number(table.sentOrderCount) || 0;

      return (
        '<button class="table-card' + (selected ? " is-active" : "") +
          (hasOpenBill ? " has-open-bill" : "") + '" type="button" data-table-id="' +
          escapeHtml(table.id) + '" aria-pressed="' + (selected ? "true" : "false") + '">' +
          '<span class="table-card-top">' +
            '<span class="table-card-title">' +
              '<span class="table-card-icon"><i class="bi bi-grid-1x2-fill"></i></span>' +
              '<span><strong class="table-card-name">' + escapeHtml(table.name) + '</strong>' +
              '<span class="table-card-seats">' + seats + ' kişilik masa</span></span>' +
            '</span>' +
            '<span class="table-state-pill ' + (hasOpenBill ? "is-open" : "is-empty") + '">' +
              '<span class="status-dot"></span>' + (hasOpenBill ? "Adisyon açık" : "Boş") +
            '</span>' +
          '</span>' +
          '<span class="table-card-bottom">' +
            '<span class="table-card-total"><span>' +
              (hasOpenBill ? "Mevcut hesap" : "Hesap toplamı") +
            '</span><strong>' + escapeHtml(billTotal) + '</strong></span>' +
            '<span class="table-card-last"><span>Son hareket</span><strong>' +
              escapeHtml(lastActivity) + '</strong><small>' + sentOrderCount +
              ' gönderilmiş sipariş</small></span>' +
          '</span>' +
        '</button>'
      );
    }).join("");
  }

  function renderTableDetails() {
    const table = selectedTable();
    if (!table) {
      state.selectedTableId = null;
      showScreen("tables");
      renderTables();
      return;
    }

    const orders = Array.isArray(table.sentOrders) ? table.sentOrders : [];
    const isOpen = table.billStatus === "OPEN";

    byId("detailsTableName").textContent = table.name;
    byId("detailsTableMeta").textContent = (Number(table.seats) || 0) + " kişilik masa";
    byId("detailsTableStatus").textContent = isOpen ? "Adisyon açık" : "Boş";
    byId("detailsGrandTotal").textContent = money(table.currentBillTotal || 0);
    byId("detailsItemCount").textContent = (Number(table.itemCount) || 0) + " adet";
    byId("detailsRoundCount").textContent = orders.length ? orders.length + " tur" : "Henüz yok";
    byId("historyCount").textContent = orders.length ? orders.length + " tur" : "Henüz yok";
    byId("tableDetailsView").querySelector(".table-open-badge").classList.toggle("is-active", isOpen);

    byId("orderHistory").innerHTML = orders.map(function (order) {
      const sentAt = order.sentAt
        ? new Date(order.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const items = Array.isArray(order.items) ? order.items : [];
      const total = items.reduce(function (sum, item) {
        return sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
      }, 0);
      return '<article class="history-card">' +
        '<div class="history-card-head"><div><h3>Sipariş turu #' + escapeHtml(order.roundNumber) +
        '</h3><p>Mutfağa gönderildi</p></div><span class="history-card-time">' + escapeHtml(sentAt) +
        '</span></div><div class="history-item-list">' +
        items.map(function (item) {
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          return '<div class="history-item"><div class="history-item-info"><strong>' +
            escapeHtml(item.name) + '</strong><span>' + quantity + ' adet · ' +
            escapeHtml(money(price)) + '</span></div><strong class="history-item-price">' +
            escapeHtml(money(price * quantity)) + '</strong></div>';
        }).join("") +
        '</div><div class="history-card-total"><span>Sipariş toplamı</span><strong>' +
        escapeHtml(money(total)) + '</strong></div></article>';
    }).join("");
    byId("historyEmpty").hidden = orders.length > 0;
    showScreen("details");
  }

  function renderCategories() {
    const tabs = [
      '<button class="category-tab' + (state.selectedCategory === "all" ? " active" : "") +
      '" type="button" data-category="all"><i class="bi bi-grid"></i><span>Tümü</span></button>'
    ];

    state.categories.forEach(function (category) {
      const categoryId = String(category.id);
      tabs.push(
        '<button class="category-tab' +
          (state.selectedCategory === categoryId ? " active" : "") +
          '" type="button" data-category="' + escapeHtml(categoryId) + '">' +
          '<i class="bi ' + escapeHtml(category.icon || "bi-collection") + '"></i>' +
          '<span>' + escapeHtml(category.name) + '</span>' +
        '</button>'
      );
    });

    byId("categoryTabs").innerHTML = tabs.join("");
  }

  function safeImageUrl(value) {
    const url = String(value || "");
    if (/^\/uploads\/[a-zA-Z0-9/_\-.]+$/.test(url)) return url;
    if (/^https:\/\/[^\s"'<>]+$/i.test(url)) return url;
    return "";
  }

  function renderProducts() {
    const query = state.productQuery.trim().toLocaleLowerCase("tr-TR");
    const products = state.products.filter(function (product) {
      const matchesCategory = state.selectedCategory === "all" ||
        String(product.categoryId) === state.selectedCategory;
      const searchable = (
        String(product.name || "") + " " +
        String(product.description || "") + " " +
        String(product.categoryName || "")
      ).toLocaleLowerCase("tr-TR");
      return matchesCategory && (!query || searchable.includes(query));
    });

    byId("productsResultCount").textContent = products.length + " ürün";
    byId("productGrid").innerHTML = products.map(function (product) {
      const imageUrl = safeImageUrl(product.image);
      const image = imageUrl
        ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
        : '<i class="bi bi-cup-hot" aria-hidden="true"></i>';
      const outOfStock = product.isOutOfStock === true;
      const action = outOfStock
        ? '<span class="product-stock-label">Tükendi</span>'
        : '<button class="add-product-button" type="button" data-add-product-id="' +
          escapeHtml(product.id) + '" aria-label="' + escapeHtml(product.name) +
          ' ürününü siparişe ekle"><i class="bi bi-plus-lg"></i></button>';

      return (
        '<article class="product-card' + (outOfStock ? " is-out-of-stock" : "") + '">' +
          '<div class="product-card-image">' + image + '</div>' +
          '<div class="product-card-main">' +
            '<span class="product-card-name">' + escapeHtml(product.name) + '</span>' +
            '<span class="product-card-description">' +
              escapeHtml(product.description || product.categoryName || "Menü ürünü") +
            '</span>' +
            '<div class="product-card-bottom">' +
              '<span class="product-price">' + escapeHtml(money(product.price)) + '</span>' +
              action +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");

    const empty = byId("catalogEmpty");
    if (state.menuError) {
      empty.hidden = false;
      empty.innerHTML =
        '<i class="bi bi-exclamation-circle"></i>' +
        '<strong>Menü yüklenemedi</strong>' +
        '<span>' + escapeHtml(state.menuError) + '</span>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="retryMenuButton">Tekrar dene</button>';
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

  function draftSummary() {
    return state.draftItems.reduce(function (summary, item) {
      summary.quantity += item.quantity;
      summary.total += Number(item.price) * item.quantity;
      return summary;
    }, { quantity: 0, total: 0 });
  }

  function renderDraft() {
    const list = byId("draftOrderItems");
    const empty = byId("draftOrderEmpty");
    const summary = draftSummary();

    byId("draftItemCount").textContent = summary.quantity
      ? summary.quantity + " adet ürün"
      : "Henüz ürün seçilmedi";
    byId("draftTotal").textContent = money(summary.total);
    byId("sendOrderCount").textContent = summary.quantity + " ürün";
    byId("sendOrderTotal").textContent = money(summary.total);
    byId("sendOrderButton").disabled = summary.quantity === 0 || state.sendingOrder;

    empty.hidden = summary.quantity > 0;
    list.innerHTML = state.draftItems.map(function (item) {
      const lineTotal = Number(item.price) * item.quantity;
      return (
        '<div class="draft-order-row">' +
          '<div class="draft-order-main">' +
            '<div class="draft-order-name">' + escapeHtml(item.name) + '</div>' +
            '<span class="draft-order-unit">' + escapeHtml(money(item.price)) + ' / adet</span>' +
          '</div>' +
          '<div class="draft-order-controls">' +
            '<div class="quantity-control">' +
              '<button type="button" data-draft-action="minus" data-product-id="' + escapeHtml(item.id) +
                '" aria-label="Bir azalt">−</button>' +
              '<span>' + item.quantity + '</span>' +
              '<button type="button" data-draft-action="plus" data-product-id="' + escapeHtml(item.id) +
                '" aria-label="Bir artır">+</button>' +
            '</div>' +
            '<button class="remove-order-item" type="button" data-draft-action="remove" data-product-id="' +
              escapeHtml(item.id) + '" aria-label="Ürünü önizlemeden kaldır"><i class="bi bi-trash3"></i></button>' +
          '</div>' +
          '<span class="draft-order-line-total">' + escapeHtml(money(lineTotal)) + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function addDraftProduct(productId) {
    const product = state.products.find(function (item) {
      return String(item.id) === String(productId);
    });
    if (!product || product.isOutOfStock) return;

    const existing = state.draftItems.find(function (item) {
      return String(item.id) === String(product.id);
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      state.draftItems.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        quantity: 1
      });
    }

    renderDraft();
    showToast(product.name + " siparişe eklendi.");
  }

  function updateDraftItem(productId, action) {
    const item = state.draftItems.find(function (draftItem) {
      return String(draftItem.id) === String(productId);
    });
    if (!item) return;

    if (action === "plus") item.quantity += 1;
    if (action === "minus") item.quantity -= 1;
    if (action === "remove" || item.quantity <= 0) {
      state.draftItems = state.draftItems.filter(function (draftItem) {
        return String(draftItem.id) !== String(productId);
      });
    }

    renderDraft();
  }

  async function sendOrder() {
    const table = selectedTable();
    if (!table) {
      showScreen("tables");
      return;
    }
    if (!state.draftItems.length || state.sendingOrder) return;

    state.sendingOrder = true;
    renderDraft();
    const button = byId("sendOrderButton");
    const originalMarkup = button.innerHTML;
    button.innerHTML = '<i class="bi bi-arrow-repeat"></i> Gönderiliyor...';

    try {
      const response = await fetch("/api/waiter/tables/" + encodeURIComponent(table.id) + "/orders", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: state.draftItems.map(function (item) {
            return { productId: item.id, quantity: item.quantity };
          })
        })
      });
      const payload = await response.json().catch(function () { return null; });
      if (!response.ok) {
        throw new Error(payload && (payload.message || payload.error)
          ? (payload.message || payload.error)
          : "Sipariş kaydedilemedi.");
      }

      state.draftItems = [];
      if (payload.order && payload.order.roundNumber) {
        byId("newOrderRoundLabel").textContent = "Tur #" + payload.order.roundNumber;
      }
      renderDraft();
      await loadTables();
      state.selectedTableId = null;
      showScreen("tables");
      renderTables();
      showToast(table.name + " için sipariş mutfağa gönderildi.");
    } catch (error) {
      showToast(error.message || "Sipariş gönderilirken hata oluştu.");
    } finally {
      state.sendingOrder = false;
      button.innerHTML = originalMarkup;
      renderDraft();
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
      })) {
        state.selectedTableId = null;
        if (state.screen !== "tables") showScreen("tables");
      }

      renderTables();
      if (state.screen === "details" || state.screen === "order") {
        if (!selectedTable()) {
          showScreen("tables");
        } else if (state.screen === "details") {
          renderTableDetails();
        } else {
          byId("newOrderTableName").textContent = selectedTable().name + " için sipariş";
        }
      }
    } catch (error) {
      state.tableError = error.message || "Masa listesi alınamadı.";
      renderTables();
    }
  }

  async function loadMenu() {
    state.menuError = "";
    byId("productsResultCount").textContent = "Menü yükleniyor...";

    try {
      const result = await requestJson("/api/waiter/catalog");
      state.categories = Array.isArray(result.categories) ? result.categories : [];
      state.products = Array.isArray(result.products) ? result.products : [];

      if (state.selectedCategory !== "all" && !state.categories.some(function (category) {
        return String(category.id) === state.selectedCategory;
      })) {
        state.selectedCategory = "all";
      }

      renderCategories();
      renderProducts();
      renderDraft();
    } catch (error) {
      state.menuError = error.message || "Menü kataloğu alınamadı.";
      state.categories = [];
      state.products = [];
      byId("categoryTabs").innerHTML = "";
      renderProducts();
      renderDraft();
    }
  }

  async function loadAppearance() {
    try {
      const result = await requestJson("/api/appearance");
      const appearance = result.appearance;
      if (!appearance) return;

      if (appearance.brandName) {
        byId("waiterBrandName").textContent = appearance.brandName;
      }

      const isOpen = appearance.isOpen !== false;
      byId("serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
      byId("serviceStatus").classList.toggle("is-closed", !isOpen);
    } catch (_error) {
      // Appearance settings are optional; table and catalog data remain usable.
    }
  }

  function connectRealtimeUpdates() {
    if (typeof window.EventSource !== "function") return;

    const events = new EventSource("/api/waiter/events");
    events.addEventListener("waiter_update", function (event) {
      let update;
      try {
        update = JSON.parse(event.data);
      } catch (_error) {
        return;
      }

      if (!update || (update.type !== "bill_closed" && update.type !== "payment_recorded")) {
        return;
      }

      loadTables();
    });
  }

  byId("tablesGrid").addEventListener("click", function (event) {
    const retryButton = event.target.closest("#retryTablesButton");
    if (retryButton) {
      retryButton.disabled = true;
      loadTables();
      return;
    }

    const tableButton = event.target.closest("[data-table-id]");
    if (!tableButton) return;

    state.selectedTableId = tableButton.dataset.tableId;
    state.draftItems = [];
    renderDraft();
    renderTables();
    renderTableDetails();
  });

  document.querySelector(".filter-pills").addEventListener("click", function (event) {
    const button = event.target.closest("[data-table-filter]");
    if (!button) return;

    state.tableFilter = button.dataset.tableFilter === "active" ? "active" : "all";
    document.querySelectorAll("[data-table-filter]").forEach(function (filterButton) {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    renderTables();
  });

    byId("tableSearch").addEventListener("input", function (event) {
    state.tableQuery = event.target.value;
    renderTables();
  });

  byId("backToTablesButton").addEventListener("click", function () {
    showScreen("tables");
    renderTables();
  });

  byId("startNewOrderButton").addEventListener("click", function () {
    const table = selectedTable();
    if (!table) {
      showScreen("tables");
      return;
    }
    byId("newOrderTableName").textContent = table.name + " için sipariş";
    byId("newOrderRoundLabel").textContent = "Tur #" + (Number(table.sentOrderCount) + 1);
    byId("newOrderBackLabel").textContent = "Masa detayına dön";
    showScreen("order");
    renderCategories();
    renderProducts();
    renderDraft();
  });

  byId("backToDetailsButton").addEventListener("click", function () {
    renderTableDetails();
  });

  byId("categoryTabs").addEventListener("click", function (event) {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.selectedCategory = button.dataset.category || "all";
    renderCategories();
    renderProducts();
  });

  byId("productSearch").addEventListener("input", function (event) {
    state.productQuery = event.target.value;
    renderProducts();
  });

  byId("productGrid").addEventListener("click", function (event) {
    const button = event.target.closest("[data-add-product-id]");
    if (!button) return;
    addDraftProduct(button.dataset.addProductId);
  });

  byId("draftOrderItems").addEventListener("click", function (event) {
    const button = event.target.closest("[data-draft-action]");
    if (!button) return;
    updateDraftItem(button.dataset.productId, button.dataset.draftAction);
  });

  byId("sendOrderButton").addEventListener("click", sendOrder);

  byId("catalogEmpty").addEventListener("click", function (event) {
    const button = event.target.closest("#retryMenuButton");
    if (!button) return;
    button.disabled = true;
    loadMenu();
  });

  showScreen("tables");
  renderTables();
  renderDraft();
  connectRealtimeUpdates();
  Promise.all([loadTables(), loadMenu(), loadAppearance()]);
});
