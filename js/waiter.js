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

  const fallbackTables = Array.from({ length: 12 }, function (_, index) {
    return { id: index + 1, name: "Masa " + (index + 1), seats: [2, 4, 4, 2, 4, 6, 2, 4, 4, 2, 6, 4][index] };
  });
  let tables = readArray("roastAdmin_tables", fallbackTables);

  // Older releases stored unsent selections as drafts. Keep only products that were sent.
  function migrateLegacyOrders(rawOrders) {
    const migrated = [];
    rawOrders.forEach(function (oldOrder, index) {
      if (!oldOrder || !Array.isArray(oldOrder.items)) return;
      const items = oldOrder.items.map(function (item) {
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const isWholeOrderSent = oldOrder.status === "sent" || oldOrder.status === "closed";
        const sentQuantity = isWholeOrderSent ? quantity : Math.min(quantity, Math.max(0, Number(item.sentQuantity) || 0));
        if (!sentQuantity) return null;
        return Object.assign({}, item, { quantity: sentQuantity, sentQuantity: sentQuantity });
      }).filter(Boolean);
      if (!items.length) return;
      const tableId = Number(oldOrder.tableId) || 1;
      migrated.push({
        id: "legacy-" + String(oldOrder.id || index) + "-sent",
        legacyOrderId: oldOrder.id || null,
        tableId: tableId,
        tableName: oldOrder.tableName || ("Masa " + tableId),
        items: items,
        status: oldOrder.status === "closed" ? "closed" : "sent",
        createdAt: oldOrder.createdAt || oldOrder.updatedAt || new Date().toISOString(),
        sentAt: oldOrder.sentAt || oldOrder.updatedAt || oldOrder.createdAt || new Date().toISOString(),
        updatedAt: oldOrder.updatedAt || oldOrder.sentAt || oldOrder.createdAt || new Date().toISOString(),
        closedAt: oldOrder.status === "closed" ? (oldOrder.closedAt || oldOrder.updatedAt || null) : null
      });
    });
    assignRoundNumbers(migrated);
    return migrated;
  }
  function assignRoundNumbers(orders) {
    const counts = {};
    orders.sort(function (a, b) {
      return new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0);
    }).forEach(function (order) {
      counts[order.tableId] = (counts[order.tableId] || 0) + 1;
      order.roundNumber = counts[order.tableId];
    });
    return orders;
  }
  function loadOrders() {
    const raw = readArray("roastWaiter_orders", []);
    let schemaVersion = 1;
    try { schemaVersion = Number(localStorage.getItem("roastWaiter_schemaVersion")) || 1; } catch (error) { schemaVersion = 1; }
    let orders;
    if (schemaVersion < 3) {
      orders = migrateLegacyOrders(raw);
      try {
        localStorage.setItem("roastWaiter_orders", JSON.stringify(orders));
        localStorage.setItem("roastWaiter_schemaVersion", "3");
      } catch (error) {
        // Keep the migrated sent orders available in memory if storage is unavailable.
      }
      return orders;
    }
    orders = raw.filter(function (order) {
      return order && Array.isArray(order.items) && order.tableId != null && (order.status === "sent" || order.status === "closed");
    }).map(function (order) {
      return Object.assign({}, order, {
        items: order.items.map(function (item) {
          const quantity = Math.max(0, Number(item.quantity) || 0);
          return Object.assign({}, item, { quantity: quantity, sentQuantity: quantity });
        })
      });
    });
    // Remove any stale draft data left in localStorage by a previous build.
    if (orders.length !== raw.length) {
      try { localStorage.setItem("roastWaiter_orders", JSON.stringify(orders)); } catch (error) {}
    }
    return assignRoundNumbers(orders);
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
    view: "tables",
    currentOrderEntry: null
  };

  const toastElement = $("#waiterToast");
  const toastMessage = $("#waiterToastMessage");
  const toast = window.bootstrap && toastElement ? bootstrap.Toast.getOrCreateInstance(toastElement, { delay: 2400 }) : null;

  function notify(message) {
    if (!toast || !toastMessage) { window.alert(message); return; }
    toastMessage.textContent = message;
    toast.show();
  }
  function saveOrders() {
    try {
      localStorage.setItem("roastWaiter_orders", JSON.stringify(state.orders));
      localStorage.setItem("roastWaiter_schemaVersion", "3");
      return true;
    } catch (error) {
      notify("Sipariş kaydedilemedi. Tarayıcı depolama alanını kontrol edin.");
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
    return roundsForTable(tableId).filter(function (order) { return order.status !== "closed"; });
  }
  function currentOrderEntry() {
    return state.currentOrderEntry && String(state.currentOrderEntry.tableId) === String(state.selectedTableId)
      ? state.currentOrderEntry
      : null;
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
  function nextRoundNumber(tableId) {
    return roundsForTable(tableId).reduce(function (max, order) {
      return Math.max(max, Number(order.roundNumber) || 0);
    }, 0) + 1;
  }
  function latestActivity(tableId) {
    const rounds = roundsForTable(tableId).filter(function (round) { return round.items && round.items.length; });
    rounds.sort(function (a, b) {
      return new Date(b.updatedAt || b.sentAt || b.createdAt || 0) - new Date(a.updatedAt || a.sentAt || a.createdAt || 0);
    });
    return rounds[0] || null;
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
  function makeId() {
    return "order-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  function renderHeader() {
    const appearance = readObject("roastAdmin_appearance", { brandName: "roast & co.", isOpen: true });
    $("#waiterBrandName").textContent = appearance.brandName || "roast & co.";
    const status = $("#serviceStatus");
    const isOpen = appearance.isOpen !== false;
    status.classList.toggle("is-closed", !isOpen);
    $("#serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
    $("#activeTableCount").textContent = tables.filter(function (table) { return openRounds(table.id).length > 0; }).length + " masa";
    const table = tableFor(state.selectedTableId);
    const titleMap = {
      tables: ["SALON YÖNETİMİ", "Masalarım", "Masa durumlarını, açık hesapları ve son siparişleri görüntüle."],
      details: ["MASA / ADİSYON", table.name, "Önceki siparişleri incele veya bu masaya yeni sipariş ekle."],
      "new-order": ["YENİ SİPARİŞ", table.name + " için sipariş", "Ürünleri seç, kontrol et ve mutfağa gönder."]
    };
    const viewText = titleMap[state.view] || titleMap.tables;
    $("#viewEyebrow").textContent = viewText[0];
    $("#viewTitle").textContent = viewText[1];
    $("#viewDescription").textContent = viewText[2];
    document.title = (state.view === "tables" ? "Masalarım" : state.view === "details" ? table.name + " | Adisyon" : "Yeni sipariş") + " | Roast & Co.";
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
      return '<button class="table-card ' + (isActive ? "is-active" : "") + '" type="button" data-table-id="' + table.id + '">' +
        '<span class="table-card-top"><span class="table-card-title"><span class="table-card-icon"><i class="bi bi-grid-1x2-fill"></i></span><span><strong class="table-card-name">' + escapeHtml(table.name) + '</strong><span class="table-card-seats">' + table.seats + ' kişilik masa</span></span></span>' +
        '<span class="table-state-pill ' + (isActive ? "is-active" : "") + '"><i class="status-dot"></i>' + (isActive ? "Adisyon açık" : "Boş") + '</span></span>' +
        '<span class="table-card-bottom"><span class="table-card-total"><span>' + (isActive ? "Mevcut hesap" : "Hesap toplamı") + '</span><strong>' + escapeHtml(money(activeTotal)) + '</strong></span>' +
        '<span class="table-card-last"><span>Son hareket</span><strong>' + (last ? escapeHtml(formatTime(last.updatedAt || last.sentAt || last.createdAt)) : "Henüz yok") + '</strong><span class="round-count">' + history.length + ' gönderilmiş sipariş</span></span></span></button>';
    }).join("");
    if (!visible.length) {
      $("#tablesGrid").innerHTML = '<div class="empty-history"><strong>Masa bulunamadı</strong><span>Aramayı veya filtreyi değiştirebilirsin.</span></div>';
    }
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
      return '<article class="history-card"><div class="history-card-head"><div><h3>' + title + '</h3><p>' + escapeHtml(when) + '</p><span class="history-status"><i class="bi ' + (closed ? "bi-check-circle-fill" : "bi-send-check-fill") + '"></i>' + (closed ? "Hesap kapatılmış" : "Mutfağa gönderildi") + '</span></div><span class="history-card-time">' + escapeHtml(formatTime(order.sentAt || order.updatedAt)) + '</span></div>' +
        '<div class="history-item-list">' + itemsHtml + '</div><div class="history-card-total"><span>Sipariş toplamı</span><strong>' + escapeHtml(money(orderTotal(order))) + '</strong></div></article>';
    }).join("");
  }

  function renderTableDetails() {
    const table = tableFor(state.selectedTableId);
    const rounds = openRounds(table.id);
    const history = historicalRounds(table.id);
    $("#detailsTableName").textContent = table.name;
    $("#detailsTableMeta").textContent = table.seats + " kişilik masa";
    $("#detailsGrandTotal").textContent = money(roundsTotal(rounds));
    $("#detailsItemCount").textContent = roundsCount(rounds) + " adet";
    $("#detailsRoundCount").textContent = history.length;
    const badge = $("#detailsTableStatus");
    const hasAccount = rounds.length > 0;
    badge.classList.toggle("is-active", hasAccount);
    badge.innerHTML = '<span class="status-dot"></span>' + (hasAccount ? "Adisyon açık" : "Henüz adisyon yok");
    $("#startNewOrderButton").innerHTML = '<i class="bi bi-plus-lg"></i> Yeni sipariş ekle';
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

  function renderSelectedOrder() {
    const order = currentOrderEntry();
    const items = order && Array.isArray(order.items) ? order.items : [];
    $("#draftItemCount").textContent = items.length ? orderCount(order) + " ürün seçildi" : "Henüz ürün seçilmedi";
    $("#draftTotal").textContent = money(orderTotal(order));
    $("#draftOrderEmpty").hidden = items.length > 0;
    $("#draftOrderItems").innerHTML = items.map(function (item, index) {
      return '<div class="draft-order-row"><div class="draft-order-main"><strong class="draft-order-name">' + escapeHtml(item.name) + '</strong><span class="draft-order-unit">' + escapeHtml(money(item.price)) + ' / adet</span></div>' +
        '<div class="draft-order-controls"><div class="quantity-control"><button type="button" data-quantity-action="minus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini azalt" ' + (Number(item.quantity) <= 1 ? "disabled" : "") + '><i class="bi bi-dash"></i></button><span>' + (Number(item.quantity) || 0) + '</span><button type="button" data-quantity-action="plus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini artır"><i class="bi bi-plus"></i></button></div><button type="button" class="remove-order-item" data-remove-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' ürününü siparişten sil" title="Ürünü kaldır"><i class="bi bi-trash3"></i></button></div>' +
        '<strong class="draft-order-line-total">' + escapeHtml(money((Number(item.price) || 0) * (Number(item.quantity) || 0))) + '</strong></div>';
    }).join("");
    $("#sendOrderCount").textContent = orderCount(order) + " ürün";
    $("#sendOrderTotal").textContent = money(orderTotal(order));
    $("#sendOrderButton").disabled = !items.length;
    $("#newOrderTableName").textContent = tableFor(state.selectedTableId).name;
    $("#newOrderRoundLabel").textContent = "Sipariş #" + (order ? order.roundNumber : nextRoundNumber(state.selectedTableId));
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
    renderSelectedOrder();
    $$(".filter-pill").forEach(function (button) {
      button.classList.toggle("active", button.dataset.tableFilter === state.tableFilter);
    });
  }
  function setView(view, shouldScroll) {
    if (state.view === "new-order" && view !== "new-order") {
      // Unsent selections exist only in memory. Leaving the screen discards them.
      state.currentOrderEntry = null;
    }
    state.view = view;
    renderAll();
    if (shouldScroll !== false) window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function beginNewOrder() {
    if (state.selectedTableId == null) return;
    const table = tableFor(state.selectedTableId);
    state.currentOrderEntry = {
      id: makeId(),
      tableId: table.id,
      tableName: table.name,
      roundNumber: nextRoundNumber(table.id),
      items: [],
      status: "unsent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.productQuery = "";
    state.selectedCategory = "all";
    $("#productSearch").value = "";
    $("#draftSummaryAccordion").open = true;
    setView("new-order");
  }
  function addProduct(productId) {
    const product = state.products.find(function (item) { return String(item.id) === String(productId); });
    if (!product || product.status !== "active" || state.view !== "new-order") return;
    const order = currentOrderEntry();
    if (!order) return;
    const found = order.items.find(function (item) { return String(item.productId) === String(product.id); });
    if (found) found.quantity = (Number(found.quantity) || 0) + 1;
    else order.items.push({ productId: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1 });
    order.updatedAt = new Date().toISOString();
    renderSelectedOrder();
    renderTableCards();
  }
  function changeSelectedQuantity(index, action) {
    const order = currentOrderEntry();
    if (!order || !order.items[index]) return;
    const item = order.items[index];
    const quantity = Number(item.quantity) || 0;
    if (action === "plus") item.quantity = quantity + 1;
    if (action === "minus" && quantity > 1) item.quantity = quantity - 1;
    order.updatedAt = new Date().toISOString();
    renderAll();
  }
  function removeSelectedItem(index) {
    const order = currentOrderEntry();
    if (!order || !order.items[index]) return;
    const removedName = order.items[index].name;
    order.items.splice(index, 1);
    order.updatedAt = new Date().toISOString();
    renderAll();
    notify(removedName + " siparişten kaldırıldı.");
  }
  function sendCurrentOrder() {
    const pending = currentOrderEntry();
    if (!pending || !pending.items.length) return;
    const now = new Date().toISOString();
    const sentOrder = Object.assign({}, pending, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
      items: pending.items.map(function (item) {
        return Object.assign({}, item, { sentQuantity: Number(item.quantity) || 0 });
      })
    });
    state.orders.push(sentOrder);
    assignRoundNumbers(state.orders.filter(function (order) { return String(order.tableId) === String(sentOrder.tableId); }));
    if (!saveOrders()) {
      state.orders = state.orders.filter(function (order) { return order.id !== sentOrder.id; });
      return;
    }
    state.currentOrderEntry = null;
    setView("details");
    notify("Sipariş " + sentOrder.tableName + " mutfağa gönderildi.");
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
    const removeButton = event.target.closest("[data-remove-item-index]");
    if (removeButton) {
      removeSelectedItem(Number(removeButton.dataset.removeItemIndex));
      return;
    }
    const quantityButton = event.target.closest("[data-quantity-action]");
    if (quantityButton && !quantityButton.disabled) changeSelectedQuantity(Number(quantityButton.dataset.itemIndex), quantityButton.dataset.quantityAction);
  });
  $("#productSearch").addEventListener("input", function (event) {
    state.productQuery = event.target.value;
    renderProducts();
  });
  $("#sendOrderButton").addEventListener("click", sendCurrentOrder);
  window.addEventListener("storage", function (event) {
    if (event.key === "roastAdmin_products" || event.key === "roastAdmin_categories" || event.key === "roastAdmin_tables" || event.key === "roastAdmin_appearance" || event.key === "roastWaiter_orders" || event.key === "roastWaiter_schemaVersion") {
      state.products = readArray("roastAdmin_products", fallbackProducts);
      state.categories = readArray("roastAdmin_categories", fallbackCategories);
      if (event.key === "roastAdmin_tables") {
        tables = readArray("roastAdmin_tables", fallbackTables);
        if (state.selectedTableId != null && !tables.some(function (table) { return String(table.id) === String(state.selectedTableId); })) {
          state.selectedTableId = null;
          state.currentOrderEntry = null;
          state.view = "tables";
        }
      }
      state.orders = loadOrders();
      renderAll();
    }
  });

  renderAll();
});