document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
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
  const state = {
    categories: readArray("roastAdmin_categories", fallbackCategories),
    products: readArray("roastAdmin_products", fallbackProducts),
    orders: readArray("roastWaiter_orders", []),
    selectedTableId: 1,
    selectedCategory: "all",
    productQuery: "",
    tableQuery: ""
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
      return true;
    } catch (error) {
      notify("Sipariş tarayıcıya kaydedilemedi. Depolama alanını kontrol edin.");
      return false;
    }
  }
  function activeOrderForTable(tableId) {
    return state.orders
      .filter(function (order) { return String(order.tableId) === String(tableId) && order.status !== "closed"; })
      .sort(function (a, b) { return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0); })[0] || null;
  }
  function currentOrder() {
    return activeOrderForTable(state.selectedTableId);
  }
  function orderTotal(order) {
    return (order && Array.isArray(order.items) ? order.items : []).reduce(function (sum, item) {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
  }
  function orderCount(order) {
    return (order && Array.isArray(order.items) ? order.items : []).reduce(function (sum, item) {
      return sum + (Number(item.quantity) || 0);
    }, 0);
  }
  function hasPendingItems(order) {
    return Boolean(order && order.items && order.items.some(function (item) {
      return (Number(item.quantity) || 0) > (Number(item.sentQuantity) || 0);
    }));
  }
  function getCategoryIcon(category) {
    const found = state.categories.find(function (item) { return item.name === category; });
    return found && found.icon ? found.icon : (String(category || "").toLocaleLowerCase("tr").includes("tatlı") ? "bi-cake2" : "bi-cup-hot");
  }
  function getProductIcon(product) {
    const category = String(product.category || "").toLocaleLowerCase("tr");
    if (category.includes("tatlı") || category.includes("pasta")) return "bi-cake2";
    if (category.includes("çay")) return "bi-cup";
    if (category.includes("soğuk") || category.includes("içecek")) return "bi-cup-straw";
    return "bi-cup-hot";
  }
  function renderHeader() {
    const appearance = readObject("roastAdmin_appearance", { brandName: "roast & co.", isOpen: true });
    $("#waiterBrandName").textContent = appearance.brandName || "roast & co.";
    const status = $("#serviceStatus");
    const isOpen = appearance.isOpen !== false;
    status.classList.toggle("is-closed", !isOpen);
    $("#serviceStatusText").textContent = isOpen ? "Servis açık" : "Servis kapalı";
    $("#currentDate").textContent = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  }
  function renderTables() {
    const query = state.tableQuery.toLocaleLowerCase("tr").trim();
    const visible = tables.filter(function (table) { return table.name.toLocaleLowerCase("tr").includes(query); });
    $("#tableCount").textContent = tables.length;
    const activeTables = tables.filter(function (table) { return Boolean(activeOrderForTable(table.id)); }).length;
    $("#activeTableCount").textContent = activeTables + " masa";
    $("#tablesGrid").innerHTML = visible.map(function (table) {
      const order = activeOrderForTable(table.id);
      const isSelected = String(table.id) === String(state.selectedTableId);
      const isOccupied = Boolean(order);
      const stateText = isOccupied ? (hasPendingItems(order) ? "Yeni ürün var" : "Adisyon açık") : "Boş masa";
      return '<button class="table-tile ' + (isSelected ? "selected " : "") + (isOccupied ? "occupied" : "") + '" type="button" data-table-id="' + table.id + '" aria-pressed="' + isSelected + '">' +
        '<span class="table-tile-top"><span class="table-number">' + escapeHtml(table.name) + '</span><i class="bi bi-people table-people" aria-hidden="true"></i></span>' +
        '<span class="table-tile-bottom">' + (isOccupied ? '<strong>' + escapeHtml(money(orderTotal(order))) + '</strong>' : escapeHtml(table.seats + " kişilik")) + '</span>' +
        '<span class="table-state ' + (isOccupied ? "occupied" : "") + '"><i class="mini-dot"></i>' + stateText + '</span></button>';
    }).join("");
    if (!visible.length) $("#tablesGrid").innerHTML = '<div class="catalog-empty"><strong>Masa bulunamadı</strong><span>Farklı bir masa adı ara.</span></div>';
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
      return '<article class="product-card">' +
        '<div class="product-card-image">' + image + '</div>' +
        '<div class="product-card-main"><span class="product-card-name">' + escapeHtml(product.name) + '</span>' +
        '<span class="product-card-description">' + escapeHtml(product.description || product.category || "Menü ürünü") + '</span>' +
        '<div class="product-card-bottom"><span class="product-price">' + escapeHtml(money(product.price)) + '</span>' +
        '<button type="button" class="add-product-button" data-add-product="' + escapeHtml(product.id) + '" aria-label="' + escapeHtml(product.name) + ' ürününü ekle" title="Siparişe ekle"><i class="bi bi-plus-lg"></i></button></div></div></article>';
    }).join("");
  }
  function renderOrder() {
    const table = tables.find(function (item) { return String(item.id) === String(state.selectedTableId); }) || tables[0];
    const order = currentOrder();
    const items = order && Array.isArray(order.items) ? order.items : [];
    $("#orderTableTitle").textContent = table.name;
    $("#catalogHint").textContent = table.name + " için ürün seç. Ürünler sipariş listesine eklenir.";
    $("#orderTime").textContent = order ? new Date(order.createdAt || Date.now()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) + " başlangıç" : "Henüz başlamadı";
    const pending = hasPendingItems(order);
    $("#mobileOrderItemCount").textContent = orderCount(order);
    $("#mobileOrderDockTotal").textContent = money(orderTotal(order));
    $("#mobileOrderDockLabel").textContent = items.length ? table.name + " · " + orderCount(order) + " ürün" : "Sipariş oluştur";
    $("#mobileOrderDockSubtext").textContent = items.length
      ? (pending ? "Yeni ürünler gönderilmeyi bekliyor" : "Adisyon açık · Siparişe bak")
      : "Ürün eklemek için dokun";
    const status = $("#orderStatus");
    status.classList.toggle("sent", Boolean(order && !pending && items.length));
    status.classList.toggle("draft", !order || pending);
    status.textContent = !order ? "Yeni sipariş" : (pending ? "Gönderilmeyi bekliyor" : "Mutfağa iletildi");
    $("#orderItems").innerHTML = items.map(function (item, index) {
      const quantity = Number(item.quantity) || 0;
      const sentQuantity = Number(item.sentQuantity) || 0;
      const canDecrease = quantity > sentQuantity;
      const itemStatus = quantity <= sentQuantity ? '<span class="order-item-unit"><i class="bi bi-check2-circle me-1"></i>Mutfağa iletildi</span>' : '<span class="order-item-unit"><i class="bi bi-clock me-1"></i>Yeni eklenen</span>';
      return '<div class="order-item"><div><span class="order-item-title">' + escapeHtml(item.name) + '</span>' +
        '<span class="order-item-unit">' + escapeHtml(money(item.price)) + ' / adet</span>' + itemStatus +
        '<div class="quantity-control"><button type="button" data-quantity-action="minus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini azalt" ' + (canDecrease ? "" : "disabled") + '><i class="bi bi-dash"></i></button><span>' + quantity + '</span><button type="button" data-quantity-action="plus" data-item-index="' + index + '" aria-label="' + escapeHtml(item.name) + ' adedini artır"><i class="bi bi-plus"></i></button></div></div>' +
        '<strong class="order-item-total">' + escapeHtml(money((Number(item.price) || 0) * quantity)) + '</strong></div>';
    }).join("");
    const empty = items.length === 0;
    $("#orderEmpty").hidden = !empty;
    $("#orderItems").hidden = empty;
    $("#orderItemCount").textContent = orderCount(order);
    $("#orderSubtotal").textContent = money(orderTotal(order));
    $("#orderTotal").textContent = money(orderTotal(order));
    $("#sendOrderButton").disabled = !pending;
    $("#sendOrderButton").innerHTML = pending
      ? '<i class="bi bi-send-fill"></i><span>Siparişi mutfağa gönder</span>'
      : '<i class="bi bi-check2-circle"></i><span>' + (order && items.length ? "Sipariş mutfağa gönderildi" : "Siparişi mutfağa gönder") + '</span>';
    $("#clearOrderButton").disabled = !order || !items.length || items.some(function (item) { return (Number(item.sentQuantity) || 0) > 0; });
  }
  function renderAll() {
    if (state.selectedCategory !== "all" && !state.categories.some(function (category) { return category.name === state.selectedCategory; })) state.selectedCategory = "all";
    renderHeader();
    renderTables();
    renderCategories();
    renderProducts();
    renderOrder();
    updateMobileOrderVisibility();
  }
  function updateMobileOrderVisibility() {
    const panel = $("#orderPanel");
    if (!panel || !window.matchMedia("(max-width: 767.98px)").matches) {
      document.body.classList.remove("mobile-order-visible");
      return;
    }
    const rect = panel.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight * 0.72 && rect.bottom > 120;
    document.body.classList.toggle("mobile-order-visible", isVisible);
  }

  function ensureCurrentOrder() {
    let order = currentOrder();
    if (!order) {
      const now = new Date().toISOString();
      order = { id: Date.now(), tableId: state.selectedTableId, tableName: "Masa " + state.selectedTableId, items: [], status: "draft", createdAt: now, updatedAt: now };
      state.orders.push(order);
    }
    return order;
  }
  function addProduct(productId) {
    const product = state.products.find(function (item) { return String(item.id) === String(productId); });
    if (!product || product.status !== "active") return;
    const order = ensureCurrentOrder();
    const found = order.items.find(function (item) { return String(item.productId) === String(product.id); });
    if (found) found.quantity = (Number(found.quantity) || 0) + 1;
    else order.items.push({ productId: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1, sentQuantity: 0 });
    order.status = "draft";
    order.updatedAt = new Date().toISOString();
    if (!saveOrders()) return;
    renderAll();
  }
  function changeQuantity(index, action) {
    const order = currentOrder();
    if (!order || !order.items[index]) return;
    const item = order.items[index];
    const quantity = Number(item.quantity) || 0;
    const sentQuantity = Number(item.sentQuantity) || 0;
    if (action === "plus") item.quantity = quantity + 1;
    if (action === "minus" && quantity > sentQuantity) item.quantity = quantity - 1;
    order.items = order.items.filter(function (entry) { return Number(entry.quantity) > 0; });
    order.status = hasPendingItems(order) ? "draft" : "sent";
    order.updatedAt = new Date().toISOString();
    if (!order.items.length) state.orders = state.orders.filter(function (entry) { return entry.id !== order.id; });
    if (!saveOrders()) return;
    renderAll();
  }

  $("#mobileOrderDockButton").addEventListener("click", function () {
    const panel = $("#orderPanel");
    if (panel) {
      panel.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
      window.setTimeout(updateMobileOrderVisibility, 250);
    }
  });
  window.addEventListener("scroll", updateMobileOrderVisibility, { passive: true });
  window.addEventListener("resize", updateMobileOrderVisibility);
  $("#tablesGrid").addEventListener("click", function (event) {
    const tile = event.target.closest("[data-table-id]");
    if (!tile) return;
    state.selectedTableId = Number(tile.dataset.tableId);
    renderAll();
  });
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
  $("#orderItems").addEventListener("click", function (event) {
    const button = event.target.closest("[data-quantity-action]");
    if (button && !button.disabled) changeQuantity(Number(button.dataset.itemIndex), button.dataset.quantityAction);
  });
  $("#productSearch").addEventListener("input", function (event) {
    state.productQuery = event.target.value;
    renderProducts();
  });
  $("#tableSearch").addEventListener("input", function (event) {
    state.tableQuery = event.target.value;
    renderTables();
  });
  $("#sendOrderButton").addEventListener("click", function () {
    const order = currentOrder();
    if (!order || !hasPendingItems(order)) return;
    order.items.forEach(function (item) { item.sentQuantity = Number(item.quantity) || 0; });
    order.status = "sent";
    order.updatedAt = new Date().toISOString();
    if (!saveOrders()) return;
    renderAll();
    notify("Sipariş " + order.tableName + " için mutfağa gönderildi.");
  });
  $("#clearOrderButton").addEventListener("click", function () {
    const order = currentOrder();
    if (!order || order.items.some(function (item) { return (Number(item.sentQuantity) || 0) > 0; })) return;
    state.orders = state.orders.filter(function (entry) { return entry.id !== order.id; });
    if (!saveOrders()) return;
    renderAll();
    notify("Taslak sipariş temizlendi.");
  });
  window.addEventListener("storage", function (event) {
    if (event.key === "roastAdmin_products" || event.key === "roastAdmin_categories" || event.key === "roastAdmin_appearance" || event.key === "roastWaiter_orders") {
      state.products = readArray("roastAdmin_products", fallbackProducts);
      state.categories = readArray("roastAdmin_categories", fallbackCategories);
      state.orders = readArray("roastWaiter_orders", []);
      renderAll();
    }
  });
  renderAll();
});