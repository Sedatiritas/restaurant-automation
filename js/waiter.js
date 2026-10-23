document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const money = function (amount) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(amount) || 0);
  };
  const escapeHtml = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  };
  const fallbackCategories = [
    { id: 1, name: "Kahveler", icon: "bi-cup-hot" },
    { id: 2, name: "Soğuk içecekler", icon: "bi-cup-straw" },
    { id: 3, name: "Tatlılar", icon: "bi-cake2" },
    { id: 4, name: "Çaylar", icon: "bi-cup" },
    { id: 5, name: "Atıştırmalıklar", icon: "bi-egg-fried" }
  ];
  const fallbackProducts = [
    { id: 1, name: "Cappuccino", category: "Kahveler", price: 125, description: "Espresso, süt ve yumuşak süt köpüğü.", status: "active", image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=180&q=75" },
    { id: 2, name: "Flat White", category: "Kahveler", price: 130, description: "Yoğun espresso ve ince süt köpüğü.", status: "active", image: "" },
    { id: 3, name: "Americano", category: "Kahveler", price: 100, description: "Espresso ve sıcak su.", status: "active", image: "" },
    { id: 4, name: "Iced Latte", category: "Soğuk içecekler", price: 140, description: "Soğuk süt, espresso ve buz.", status: "active", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=180&q=75" },
    { id: 5, name: "Matcha Latte", category: "Soğuk içecekler", price: 150, description: "Matcha ve süt ile hazırlanır.", status: "active", image: "" },
    { id: 6, name: "Çilekli Cheesecake", category: "Tatlılar", price: 165, description: "Kremamsı cheesecake ve çilek sosu.", status: "active", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=180&q=75" },
    { id: 7, name: "San Sebastian", category: "Tatlılar", price: 170, description: "Dışı karamelize, içi yumuşak.", status: "active", image: "" },
    { id: 8, name: "Çay", category: "Çaylar", price: 45, description: "Demlikte taze siyah çay.", status: "active", image: "" }
  ];
  function readArray(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return JSON.parse(JSON.stringify(fallback));
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : JSON.parse(JSON.stringify(fallback));
    } catch (error) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }
  function readObject(key, fallback) {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;
      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }
  const tables = Array.from({ length: 12 }, function (_, index) {
    return { id: index + 1, name: "Masa " + (index + 1), seats: [2, 4, 4, 2, 4, 6, 2, 4, 4, 2, 6, 4][index] };
  });
  function legacyOrdersToRounds(rawOrders) {
    const result = [];
    rawOrders.forEach(function (oldOrder, orderIndex) {
      if (!oldOrder || !Array.isArray(oldOrder.items)) return;
      const tableId = Number(oldOrder.tableId) || 1;
      const tableName = oldOrder.tableName || ("Masa " + tableId);
      const oldStatus = oldOrder.status || "draft";
      const sentItems = [];
      const pendingItems = [];
      oldOrder.items.forEach(function (item) {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (!quantity) return;
        const rawSentQuantity = item.sentQuantity;
        const sentQuantity = (oldStatus === "sent" || oldStatus === "closed")
          ? quantity
          : Math.min(quantity, Math.max(0, Number(rawSentQuantity) || 0));
        const pendingQuantity = Math.max(0, quantity - sentQuantity);
        if (sentQuantity > 0) {
          sentItems.push(Object.assign({}, item, { quantity: sentQuantity, sentQuantity: sentQuantity }));
        }
        if (pendingQuantity > 0) {
          pendingItems.push(Object.assign({}, item, { quantity: pendingQuantity, sentQuantity: 0 }));
        }
      });
      const base = {
        tableId: tableId,
        tableName: tableName,
        createdAt: oldOrder.createdAt || oldOrder.updatedAt || new Date().toISOString(),
        updatedAt: oldOrder.updatedAt || oldOrder.createdAt || new Date().toISOString(),
        legacyOrderId: oldOrder.id || ("legacy-" + orderIndex)
      };
      if (sentItems.length) {
        result.push(Object.assign({}, base, {
          id: String(oldOrder.id || ("legacy-" + orderIndex)) + "-sent",
          items: sentItems,
          status: oldStatus === "closed" ? "closed" : "sent",
          sentAt: oldOrder.sentAt || oldOrder.updatedAt || oldOrder.createdAt || new Date().toISOString(),
          closedAt: oldStatus === "closed" ? (oldOrder.closedAt || oldOrder.updatedAt) : null
        }));
      }
      if (pendingItems.length) {
        result.push(Object.assign({}, base, {
          id: String(oldOrder.id || ("legacy-" + orderIndex)) + "-draft",
          items: pendingItems,
          status: "draft",
          sentAt: null,
          closedAt: null
        }));
      }
      if (!sentItems.length && !pendingItems.length && oldStatus === "closed") {
        result.push(Object.assign({}, base, {
          id: String(oldOrder.id || ("legacy-" + orderIndex)),
          items: [],
          status: "closed",
          sentAt: oldOrder.updatedAt || oldOrder.createdAt || null,
          closedAt: oldOrder.closedAt || oldOrder.updatedAt || null
        }));
      }
    });
    const perTableCount = {};
    result.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }).forEach(function (order) {
      perTableCount[order.tableId] = (perTableCount[order.tableId] || 0) + 1;
      order.roundNumber = perTableCount[order.tableId];
    });
    return result;
  }
  function loadOrders() {
    const raw = readArray("roastWaiter_orders", []);
    let version = 1;
    try { version = Number(localStorage.getItem("roastWaiter_schemaVersion")) || 1; } catch (error) { version = 1; }
    if (version < 2) {
      const migrated = legacyOrdersToRounds(raw);
      try {
        localStorage.setItem("roastWaiter_orders", JSON.stringify(migrated));
        localStorage.setItem("roastWaiter_schemaVersion", "2");
      } catch (error) {
        // Continue in memory if browser storage is unavailable.
      }
      return migrated;
    }
    return raw.filter(function (order) {
      return order && Array.isArray(order.items) && order.tableId != null;
    }).map(function (order) {
      const status = ["draft", "sent", "closed"].includes(order.status) ? order.status : "draft";
      return Object.assign({}, order, { status: status, items: order.items.map(function (item) {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        return Object.assign({}, item, {
          quantity: quantity,
          sentQuantity: status === "sent" || status === "closed" ? quantity : Math.min(quantity, Math.max(0, Number(item.sentQuantity) || 0))
        });
      }) });
    });
  }
  const state = {
    categories: readArray("roastAdmin_categories", fallbackCategories),
    products: readArray("roastAdmin_products", fallbackProducts),
    orders: loadOrders(),
    selectedTableId: null,
    selectedCategory: "all",
    productQuery: "",
    tableQuery: "",
    tableFilter: "all",
    view: "tables"
  };
  const toastElement = $("#waiterToast");
  const toastMessage = $("#waiterToastMessage");
  const toast = window.bootstrap && toastElement ? bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 2600 }) : null;

  function notify(message) {
    if (!toast || !toastMessage) { window.alert(message); return; }
    toastMessage.textContent = message;
    toast.show();
  }
  function saveOrders() {
    try {
      localStorage.setItem("roastWaiter_orders", JSON.stringify(state.orders));
      localStorage.setItem("roastWaiter_schemaVersion", "2");
      return true;
    } catch (error) {
      notify("Sipariş tarayıcıya kaydedilemedi. Depolama alanını kontrol edin.");
      return false;
    }
  }
  function tableFor(tableId) {
    return tables.find(function (table) { return String(table.id) === String(tableId); }) || tables[0];
  }
  function roundsForTable(tableId) {
    return state.orders.filter(function (order) { return String(order.tableId) === String(tableId); });
  }
  function historicalRounds(tableId) {
    return roundsForTable(tableId).filter(function (order) {
      return (order.status === "sent" || order.status === "closed") && order.items && order.items.length > 0;
    }).sort(function (a, b) {
      return new Date(b.sentAt || b.updatedAt || b.createdAt || 0) - new Date(a.sentAt || a.updatedAt || a.createdAt || 0);
    });
  }
  function openRounds(tableId) {
    return roundsForTable(tableId).filter(function (order) {
      return order.status !== "closed" && (order.status === "sent" || (order.status === "draft" && order.items.length > 0));
    });
  }
  function draftForTable(tableId) {
    return roundsForTable(tableId).filter(function (order) { return order.status === "draft"; })
      .sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); })[0] || null;
  }
  function currentDraft() {
    return draftForTable(state.selectedTableId);
  }
  function orderTotal(order) {
    return (order && Array.isArray(order.items) ? order.items : []).reduce(function (sum, item) {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
  }
  function roundsTotal(rounds) {
    return rounds.reduce(function (sum, order) { return sum + orderTotal(order); }, 0);
  }
  function orderCount(order) {
    return (order && Array.isArray(order.items) ? order.items : []).reduce(function (sum, item) {
      return sum + (Number(item.quantity) || 0);
    }, 0);
  }
  function roundsCount(rounds) {
    return rounds.reduce(function (sum, order) { return sum + orderCount(order); }, 0);
  }
  function getCategoryIcon(category) {
    const found = state.categories.find(function (item) { return item.name === category; });
    return found && found.icon ? found.icon : "bi-collection";
  }
  function getProductIcon(product) {
    const category = String(product.category || "").toLocaleLowerCase("tr");
    if (category.includes("tatlı") || category.includes("pasta")) return "bi-cake2";
    if (category.includes("çay")) return "bi-cup";
    if (category.includes("soğuk") || category.includes("içecek")) return "bi-cup-straw";
    return "bi-cup-hot";
  }
  function formatTime(dateValue) {
    if (!dateValue) return "Saat bilinmiyor";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Saat bilinmiyor";
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  function formatDateTime(dateValue) {
    if (!dateValue) return "Tarih bilinmiyor";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Tarih bilinmiyor";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) + " · " + formatTime(dateValue);
  }
  function latestActivity(tableId) {
    const rounds = roundsForTable(tableId).filter(function (round) { return round.items && round.items.length; });
    rounds.sort(function (a, b) {
      return new Date(b.updatedAt || b.sentAt || b.createdAt || 0) - new Date(a.updatedAt || a.sentAt || a.createdAt || 0);
    });
    return rounds[0] || null;
  }
  function nextRoundNumber(tableId) {
    return roundsForTable(tableId).reduce(function (max, order) {
      return Math.max(max, Number(order.roundNumber) || 0);
    }, 0) + 1;
  }
  function ensureDraftForTable(tableId) {
    let draft = draftForTable(tableId);
    if (draft) return draft;
    const table = tableFor(tableId);
    const now = new Date().toISOString();
    draft = {
      id: "round-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      tableId: table.id,
      tableName: table.name,
      roundNumber: nextRoundNumber(table.id),
      items: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      closedAt: null
    };
    state.orders.push(draft);
    return draft;
  }
  function renderHeader() {
    const appearance = readObject("roastAdmin_appearance", { brandName: "roast & co.", isOpen: true });
    $("#waiterBrandName").textContent = appearance.brandName || "roast & co.";
    const status = $("#serviceStatus");
    const isOpen = appearance.isOpen !== false;
    status.classList.toggle("is-closed", !isOpen);
    $("#serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
    $("#activeTableCount").textContent = tables.filter(function (table) { return openRounds(table.id).length > 0; }).length + " masa";
    const titleMap = {
      tables: ["SALON YÖNETİMİ", "Masalarım", "Masa durumlarını, açık hesapları ve son siparişleri görüntüle."],
      details: ["MASA / ADİSYON", tableFor(state.selectedTableId).name, "Önceki siparişleri incele veya bu masaya yeni sipariş ekle."],
      "new-order": ["YENİ SİPARİŞ", "Sipariş oluştur", tableFor(state.selectedTableId).name + " için yeni sipariş turu."]
    };
    const viewText = titleMap[state.view] || titleMap.tables;
    $("#viewEyebrow").textContent = viewText[0];
    $("#viewTitle").textContent = viewText[1];
    $("#viewDescription").textContent = viewText[2];
    document.title = (state.view === "tables" ? "Masalarım" : state.view === "details" ? tableFor(state.selectedTableId).name + " | Adisyon" : "Yeni sipariş") + " | Roast & Co.";
  }
  function renderTableCards() {
    const query = state.tableQuery.toLocaleLowerCase("tr").trim();
    const visible = tables.filter(function (table) {
      if (!table.name.toLocaleLowerCase("tr").includes(query)) return false;
      if (state.tableFilter === "active") return openRounds(table.id).length > 0;
      return true;
    });
    $("#allTableCount").textContent = tables.length;
    $("#occupiedTableCount").textContent = tables.filter(function (table) { return openRounds(table.id).length > 0; }).length;
    $("#tablesGrid").innerHTML = visible.map(function (table) {
      const rounds = openRounds(table.id);
      const history = historicalRounds(table.id);
      const activeTotal = roundsTotal(rounds);
      const isActive = rounds.length > 0;
      const last = latestActivity(table.id);
      const roundCount = history.length + (draftForTable(table.id) && draftForTable(table.id).items.length ? 1 : 0);
      return '<button class="table-card ' + (isActive ? "is-active" : "") + '" type="button" data-table-id="' + table.id + '">' +
        '<span class="table-card-top"><span class="table-card-title"><span class="table-card-icon"><i class="bi bi-grid-1x2-fill"></i></span><span><strong class="table-card-name">' + escapeHtml(table.name) + '</strong><span class="table-card-seats">' + table.seats + ' kişilik masa</span></span></span>' +
        '<span class="table-state-pill ' + (isActive ? "is-active" : "") + '"><i class="status-dot"></i>' + (isActive ? "Adisyon açık" : "Boş") + '</span></span>' +
        '<span class="table-card-bottom"><span class="table-card-total"><span>' + (isActive ? "Mevcut hesap" : "Hesap toplamı") + '</span><strong>' + escapeHtml(money(activeTotal)) + '</strong></span>' +
        '<span class="table-card-last"><span>Son hareket</span><strong>' + (last ? escapeHtml(formatTime(last.updatedAt || last.sentAt || last.createdAt)) : "Henüz yok") + '</strong><span class="round-count">' + roundCount + ' sipariş turu</span></span></span></button>';
    }).join("");
    if (!visible.length) {
      $("#tablesGrid").innerHTML = '<div class="empty-history"><strong>Masa bulunamadı</strong><span>Aramayı veya filtreyi değiştirebilirsin.</span></div>';
    }
  }
  function renderDraftPreview() {
    const draft = currentDraft();
    const card = $("#currentDraftCard");
    const exists = Boolean(draft && draft.items.length);
    card.hidden = !exists;
    if (!exists) return;
    $("#draftPreviewItems").innerHTML = draft.items.map(function (item) {
      return '<div class="draft-preview-row"><span><strong class="draft-preview-name">' + escapeHtml(item.name) + '</strong><span class="draft-preview-qty">' + Number(item.quantity) + ' adet</span></span><strong class="draft-preview-price">' + escapeHtml(money((Number(item.price) || 0) * (Number(item.quantity) || 0))) + '</strong></div>';
    }).join("");
    $("#draftPreviewCount").textContent = orderCount(draft) + " ürün";
    $("#draftPreviewTotal").textContent = money(orderTotal(draft));
  }
  function renderHistory() {
    const rounds = historicalRounds(state.selectedTableId);
    $("#historyCount").textContent = rounds.length + " sipariş";
    $("#historyEmpty").hidden = rounds.length > 0;
    $("#orderHistory").innerHTML = rounds.map(function (order) {
      const closed = order.status === "closed";
      const title = "Sipariş turu #" + (Number(order.roundNumber) || 1);
      const when = formatDateTime(order.sentAt || order.updatedAt || order.createdAt);
      const itemsHtml = order.items.map(function (item) {
        return '<div class="history-item"><div class="history-item-info"><strong>' + escapeHtml(item.name) + ' × ' + (Number(item.quantity) || 0) + '</strong><span>' + escapeHtml(money(item.price)) + ' / adet</span></div><strong class="history-item-price">' + escapeHtml(money((Number(item.price) || 0) * (Number(item.quantity) || 0))) + '</strong></div>';
      }).join("");
      return '<article class="history-card"><div class="history-card-head"><div><h3>' + title + '</h3><p>' + escapeHtml(when) + '</p><span class="history-status"><i class="bi ' + (closed ? "bi-check-circle-fill" : "bi-send-check-fill") + '"></i>' + (closed ? "Hesap kapatılmış" : "Mutfağa iletildi") + '</span></div><span class="history-card-time">' + escapeHtml(formatTime(order.sentAt || order.updatedAt)) + '</span></div>' +
        '<div class="history-item-list">' + itemsHtml + '</div><div class="history-card-total"><span>Sipariş toplamı</span><strong>' + escapeHtml(money(orderTotal(order))) + '</strong></div></article>';
    }).join("");
  }
  function renderTableDetails() {
    const table = tableFor(state.selectedTableId);
    const rounds = openRounds(table.id);
    const history = historicalRounds(table.id);
    const draft = currentDraft();
    $("#detailsTableName").textContent = table.name;
    $("#detailsTableMeta").textContent = table.seats + " kişilik masa";
    $("#detailsGrandTotal").textContent = money(roundsTotal(rounds));
    $("#detailsItemCount").textContent = roundsCount(rounds) + " adet";
    $("#detailsRoundCount").textContent = history.length + (draft && draft.items.length ? 1 : 0);
    const badge = $("#detailsTableStatus");
    const hasAccount = rounds.length > 0;
    badge.classList.toggle("is-active", hasAccount);
    badge.innerHTML = '<span class="status-dot"></span>' + (hasAccount ? "Adisyon açık" : "Henüz adisyon yok");
    $("#startNewOrderButton").innerHTML = '<i class="bi bi-plus-lg"></i> ' + (draft && draft.items.length ? "Taslağa devam et" : "Yeni sipariş ekle");
    renderDraftPreview();
    renderHistory();
  }
  function renderCategories() {
    const buttons = [{ id: "all", name: "Tüm ürünler", icon: "bi-grid" }].concat(state.categories);
    $("#categoryTabs").innerHTML = buttons.map(function (category) {
      const key = category.id === "all" ? "all" : category.name;
      const selected = key === state.selectedCategory;
      return '<button type="button" class="category-tab ' + (selected ? "active" : "") + '" data-category="' + escapeHtml(key) + '" aria-pressed="' + selected + '"><i class="bi ' + escapeHtml(category.icon || "bi-collection") + '"></i><span>' + escapeHtml(category.name) + '</span></button>';
    }).join("");
  }
  function filteredProducts() {
    const query = state.productQuery.toLocaleLowerCase("tr").trim();
    return state.products.filter(function (product) {
      if (product.status && product.status !== "active") return false;
      const matchesCategory = state.selectedCategory === "all" || product.category === state.selectedCategory;
      const matchesQuery = !query || (String(product.name || "") + " " + String(product.description || "") + " " + String(product.category || "")).toLocaleLowerCase("tr").includes(query);
      return matchesCategory && matchesQuery;
    });
  }
  function renderProducts() {
    const products = filteredProducts();
    $("#productsResultCount").textContent = products.length + " ürün";
    $("#catalogEmpty").hidden = products.length !== 0;
    $("#productGrid").hidden = products.length === 0;
    $("#productGrid").innerHTML = products.map(function (product) {
      const image = product.image ? '<img src="' + escapeHtml(product.image) + '" alt="" loading="lazy">' : '<i class="bi ' + getProductIcon(product) + '" aria-hidden="true"></i>';
      return '<article class="product-card"><div class="product-card-image">' + image + '</div>' +
        '<div class="product-card-main"><span class="product-card-name">' + escapeHtml(product.name) + '</span><span class="product-card-description">' + escapeHtml(product.description || product.category || "Menü ürünü") + '</span>' +
        '<div class="product-card-bottom"><span class="product-price">' + escapeHtml(money(product.price)) + '</span><button type="button" class="add-product-button" data-add-product="' + escapeHtml(product.id) + '" aria-label="' + escapeHtml(product.name) + ' ürününü siparişe ekle" title="Siparişe ekle"><i class="bi bi-plus-lg"></i></button></div></div></article>';
    }).join("");
  }
  function renderDraftOrder() {
    const draft = currentDraft();
    const items = draft && Array.isArray(draft.items) ? draft.items : [];
    $("#draftItemCount").textContent = orderCount(draft) + " ürün";
    $("#draftOrderEmpty").hidden = items.length > 0;
    $("#draftOrderItems").innerHTML = items.map(function (item, index) {
      return '<div class="draft-order-row"><div class="draft-order-main"><strong class="draft-order-name">' + escapeHtml(item.name) + '</strong><span class="draft-order-unit">' + escapeHtml(money(item.price)) + ' / adet</span></div>' +
        '<div class="quantity-control"><button type="button" data-quantity-action="minus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini azalt" ' + (Number(item.quantity) <= 1 ? "disabled" : "") + '><i class="bi bi-dash"></i></button><span>' + (Number(item.quantity) || 0) + '</span><button type="button" data-quantity-action="plus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini artır"><i class="bi bi-plus"></i></button></div>' +
        '<strong class="draft-order-line-total">' + escapeHtml(money((Number(item.price) || 0) * (Number(item.quantity) || 0))) + '</strong></div>';
    }).join("");
    $("#draftTotal").textContent = money(orderTotal(draft));
    $("#sendOrderCount").textContent = orderCount(draft) + " ürün";
    $("#sendOrderTotal").textContent = money(orderTotal(draft));
    $("#sendOrderButton").disabled = !items.length;
    $("#clearDraftButton").disabled = !items.length;
    $("#newOrderTableName").textContent = tableFor(state.selectedTableId).name;
    $("#newOrderRoundLabel").textContent = "Sipariş turu #" + (draft ? draft.roundNumber : nextRoundNumber(state.selectedTableId));
  }
  function renderViewVisibility() {
    $("#tablesView").hidden = state.view !== "tables";
    $("#tableDetailsView").hidden = state.view !== "details";
    $("#newOrderView").hidden = state.view !== "new-order";
  }
  function renderAll() {
    if (state.selectedCategory !== "all" && !state.categories.some(function (category) { return category.name === state.selectedCategory; })) state.selectedCategory = "all";
    renderHeader();
    renderViewVisibility();
    renderTableCards();
    if (state.selectedTableId != null) renderTableDetails();
    renderCategories();
    renderProducts();
    renderDraftOrder();
    $$(".filter-pill").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tableFilter === state.tableFilter);
    });
  }
  function setView(view, shouldScroll) {
    state.view = view;
    renderAll();
    if (shouldScroll !== false) window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function beginNewOrder() {
    if (state.selectedTableId == null) return;
    let draft = draftForTable(state.selectedTableId);
    if (!draft) {
      draft = ensureDraftForTable(state.selectedTableId);
      if (!saveOrders()) return;
    }
    state.productQuery = "";
    $("#productSearch").value = "";
    setView("new-order");
  }
  function addProduct(productId) {
    const product = state.products.find(function (item) { return String(item.id) === String(productId); });
    if (!product || product.status !== "active") return;
    const draft = ensureDraftForTable(state.selectedTableId);
    const found = draft.items.find(function (item) { return String(item.productId) === String(product.id); });
    if (found) found.quantity = (Number(found.quantity) || 0) + 1;
    else draft.items.push({ productId: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1, sentQuantity: 0 });
    draft.updatedAt = new Date().toISOString();
    if (!saveOrders()) return;
    renderAll();
  }
  function changeDraftQuantity(index, action) {
    const draft = currentDraft();
    if (!draft || !draft.items[index]) return;
    const item = draft.items[index];
    const quantity = Number(item.quantity) || 0;
    if (action === "plus") item.quantity = quantity + 1;
    if (action === "minus" && quantity > 1) item.quantity = quantity - 1;
    draft.updatedAt = new Date().toISOString();
    if (!saveOrders()) return;
    renderAll();
  }
  function clearDraft() {
    const draft = currentDraft();
    if (!draft || !draft.items.length) return;
    if (!window.confirm("Bu sipariş taslağındaki tüm ürünleri silmek istiyor musun?")) return;
    state.orders = state.orders.filter(function (order) { return order.id !== draft.id; });
    if (!saveOrders()) return;
    renderAll();
    notify("Sipariş taslağı temizlendi.");
  }
  function sendCurrentDraft() {
    const draft = currentDraft();
    if (!draft || !draft.items.length) return;
    const now = new Date().toISOString();
    draft.items.forEach(function (item) { item.sentQuantity = Number(item.quantity) || 0; });
    draft.status = "sent";
    draft.sentAt = now;
    draft.updatedAt = now;
    draft.tableName = tableFor(state.selectedTableId).name;
    if (!saveOrders()) return;
    setView("details");
    notify("Sipariş " + draft.tableName + " için kaydedildi ve mutfağa gönderildi.");
  }

  $("#tablesGrid").addEventListener("click", function (event) {
    const card = event.target.closest("[data-table-id]");
    if (!card) return;
    state.selectedTableId = Number(card.dataset.tableId);
    setView("details");
  });
  $$(".filter-pill").forEach(function (button) {
    button.addEventListener("click", function () {
      state.tableFilter = button.dataset.tableFilter;
      renderTableCards();
      $$(".filter-pill").forEach(function (pill) { pill.classList.toggle("active", pill === button); });
    });
  });
  $("#tableSearch").addEventListener("input", function (event) {
    state.tableQuery = event.target.value;
    renderTableCards();
  });
  $("#backToTablesButton").addEventListener("click", function () { setView("tables"); });
  $("#startNewOrderButton").addEventListener("click", beginNewOrder);
  $("#backToDetailsButton").addEventListener("click", function () { setView("details"); });
  $("#clearDraftButton").addEventListener("click", clearDraft);
  $("#categoryTabs").addEventListener("click", function (event) {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.selectedCategory = button.dataset.category;
    renderCategories();
    renderProducts();
  });
  $("#productGrid").addEventListener("click", function (event) {
    const button = event.target.closest("[data-add-product]");
    if (button) addProduct(button.dataset.addProduct);
  });
  $("#draftOrderItems").addEventListener("click", function (event) {
    const button = event.target.closest("[data-quantity-action]");
    if (button && !button.disabled) changeDraftQuantity(Number(button.dataset.itemIndex), button.dataset.quantityAction);
  });
  $("#productSearch").addEventListener("input", function (event) {
    state.productQuery = event.target.value;
    renderProducts();
  });
  $("#sendOrderButton").addEventListener("click", sendCurrentDraft);
  window.addEventListener("storage", function (event) {
    if (event.key === "roastAdmin_products" || event.key === "roastAdmin_categories" || event.key === "roastAdmin_appearance" || event.key === "roastWaiter_orders" || event.key === "roastWaiter_schemaVersion") {
      state.products = readArray("roastAdmin_products", fallbackProducts);
      state.categories = readArray("roastAdmin_categories", fallbackCategories);
      state.orders = loadOrders();
      renderAll();
    }
  });
  renderAll();
});