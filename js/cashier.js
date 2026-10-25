document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const state = { tables: [], selectedTableId: null, bill: null, filter: "open", query: "", loading: false, apiLoaded: false, demoSelectedId: "2" };

  const demoBills = {
    "1": { name: "Masa 01", seats: 2, total: 320, orders: [{ roundNumber: 1, sentAt: "14:10", items: [
      { name: "Latte", price: 130, quantity: 1 }, { name: "Türk Kahvesi", price: 90, quantity: 1 }, { name: "Cheesecake", price: 100, quantity: 1 }
    ]}]},
    "2": { name: "Masa 02", seats: 4, total: 545, orders: [{ roundNumber: 1, sentAt: "14:26", items: [
      { name: "Latte", price: 130, quantity: 2 }, { name: "Americano", price: 100, quantity: 1 }, { name: "San Sebastian", price: 185, quantity: 1 }
    ]}]},
    "3": { name: "Masa 03", seats: 4, total: 760, orders: [{ roundNumber: 1, sentAt: "14:32", items: [
      { name: "Cappuccino", price: 140, quantity: 2 }, { name: "Mocha", price: 150, quantity: 2 }, { name: "Brownie", price: 90, quantity: 2 }
    ]}]}
  };
  const notice = $("#apiNotice");
  const connectionStatus = $("#connectionStatus");
  const toastEl = $("#cashierToast");
  const toastMessage = $("#cashierToastMessage");
  const toast = window.bootstrap && toastEl ? bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2800 }) : null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
  function money(value) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(Number(value) || 0);
  }
  function notify(message) {
    if (!toast || !toastMessage) { window.alert(message); return; }
    toastMessage.textContent = message;
    toast.show();
  }
  function setConnection(status, label) {
    connectionStatus.classList.toggle("is-connected", status === "connected");
    connectionStatus.classList.toggle("is-error", status === "error");
    connectionStatus.classList.toggle("is-preview", status === "preview");
    connectionStatus.querySelector("span:last-child").textContent = label;
  }
  async function api(path) {
    const response = await fetch(path, {
      method: "GET",
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    const payload = await response.json().catch(function () { return null; });
    if (!response.ok) {
      const message = payload && payload.message ? payload.message : "İstek başarısız oldu (" + response.status + ").";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }
  function tableHasOpenBill(table) {
    return table.hasOpenBill === true || Number(table.openTotal) > 0 || Number(table.openOrderCount) > 0;
  }
  function tableSearchText(table) {
    return (String(table.name || "") + " " + String(table.id || "")).toLocaleLowerCase("tr");
  }
  function visibleTables() {
    const query = state.query.toLocaleLowerCase("tr").trim();
    return state.tables.filter(function (table) {
      if (state.filter === "open" && !tableHasOpenBill(table)) return false;
      return !query || tableSearchText(table).includes(query);
    });
  }
  function renderMetrics() {
    const openTables = state.tables.filter(tableHasOpenBill);
    const total = openTables.reduce(function (sum, table) { return sum + (Number(table.openTotal) || 0); }, 0);
    $("#openBillCount").textContent = openTables.length;
    $("#openTableCount").textContent = openTables.length;
    $("#openBillTotal").textContent = money(total);
  }
  function renderTables() {
    const tables = visibleTables();
    $("#tableResultCount").textContent = tables.length + " masa";
    if (!tables.length) {
      $("#billTableList").innerHTML = '<div class="list-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>' +
        (state.tables.length ? "Uygun masa bulunamadı" : "Açık adisyon yok") +
        '</strong><span>' + (state.tables.length ? "Arama veya filtreyi değiştirebilirsin." : "Açık hesap oluştuğunda masalar burada listelenecek.") + '</span></div>';
      return;
    }
    $("#billTableList").innerHTML = tables.map(function (table) {
      const selected = String(table.id) === String(state.selectedTableId);
      const open = tableHasOpenBill(table);
      const detail = Number(table.openOrderCount || table.roundCount || 0) + " sipariş turu";
      return '<button type="button" class="bill-table-card ' + (selected ? "active" : "") + '" data-table-id="' + escapeHtml(table.id) + '"' +
        (open ? "" : ' disabled aria-label="' + escapeHtml(table.name) + ', açık hesap yok"') + '>' +
        '<span class="bill-table-card-main"><span class="bill-table-icon"><i class="bi bi-grid-1x2-fill"></i></span><span class="bill-table-info"><strong>' + escapeHtml(table.name) + '</strong><small>' +
        (Number(table.seats) || 0) + ' kişilik masa · ' + (open ? detail : "Hesap kapalı") + '</small></span></span>' +
        '<span class="bill-table-end"><strong>' + escapeHtml(money(table.openTotal)) + '</strong><small>Toplam</small></span></button>';
    }).join("");
  }
  function billRounds() {
    return state.bill && Array.isArray(state.bill.orders) ? state.bill.orders : [];
  }
  function billLines() {
    let total = 0;
    let itemIndex = 0;
    const rounds = billRounds();
    const markup = rounds.map(function (order, index) {
      const items = Array.isArray(order.items) ? order.items : [];
      const roundTotal = items.reduce(function (sum, item) {
        return sum + (Number(item.price != null ? item.price : item.unitPrice) || 0) * (Number(item.quantity) || 0);
      }, 0);
      total += roundTotal;
      const dateText = order.sentAt ? new Date(order.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
      const productMarkup = items.map(function (item) {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.price != null ? item.price : item.unitPrice) || 0;
        const lineTotal = unitPrice * qty;
        const checkboxId = "bill-item-" + (++itemIndex);
        return '<label class="order-round-item is-selected" for="' + checkboxId + '"><input class="bill-item-checkbox" id="' + checkboxId + '" type="checkbox" checked data-line-total="' + lineTotal + '"><span class="order-product-details"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(money(unitPrice)) + ' × ' + qty + '</small></span><strong class="order-line-total">' + escapeHtml(money(lineTotal)) + '</strong></label>';
      }).join("");
      return '<article class="order-round"><div class="order-round-head"><strong>Sipariş turu #' + escapeHtml(order.roundNumber || index + 1) + '</strong><span>' + escapeHtml(dateText) + '</span></div>' +
        productMarkup + '<div class="order-round-total"><span>Seçili ürünler</span><strong>' + escapeHtml(money(roundTotal)) + '</strong></div></article>';
    }).join("");
    return { markup: markup, total: total };
  }
  function renderBill() {
    const bill = state.bill;
    if (!bill) {
      $("#selectedTableName").textContent = "Masa seçilmedi";
      $("#selectedTableMeta").textContent = "Ürünler ve tutarlar burada görünecek.";
      $("#selectedBillStatus").textContent = "Bekliyor";
      $("#selectedBillStatus").className = "bill-status";
      $("#billDetailBody").innerHTML = '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bir masa seç</strong><span>Seçtiğin masanın ürünleri ve tutarları burada görüntülenecek.</span></div>';
      $("#billTotal").textContent = money(0);
      return;
    }
    const table = bill.table || {};
    const rounds = billRounds();
    const lines = billLines();
    $("#selectedTableName").textContent = table.name || "Masa " + state.selectedTableId;
    $("#selectedTableMeta").textContent = (Number(table.seats) || 0) + " kişilik masa · " + rounds.length + " sipariş turu";
    $("#selectedBillStatus").textContent = rounds.length ? "Adisyon açık" : "Açık sipariş yok";
    $("#selectedBillStatus").className = "bill-status " + (rounds.length ? "is-open" : "");
    $("#billDetailBody").innerHTML = lines.markup || '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bu masada açık sipariş yok</strong><span>Başka bir masa seçebilirsin.</span></div>';
    $("#billTotal").textContent = money(lines.total);
    updateSelectedTotals();
  }
  function updateSelectedTotals() {
    const checkboxes = $("#billDetailBody .bill-item-checkbox");
    if (!checkboxes.length) return;
    let selectedTotal = 0;
    $("#billDetailBody .order-round").forEach(function (round) {
      let roundTotal = 0;
      round.querySelectorAll(".bill-item-checkbox").forEach(function (checkbox) {
        const lineTotal = Number(checkbox.dataset.lineTotal) || 0;
        const selected = checkbox.checked;
        if (selected) {
          selectedTotal += lineTotal;
          roundTotal += lineTotal;
        }
        const row = checkbox.closest(".order-round-item");
        if (row) row.classList.toggle("is-selected", selected);
      });
      const roundTotalElement = round.querySelector(".order-round-total strong");
      if (roundTotalElement) roundTotalElement.textContent = money(roundTotal);
    });
    $("#billTotal").textContent = money(selectedTotal);
  }
  function renderDemoTables() {
    const query = state.query.toLocaleLowerCase("tr").trim();
    let visibleCount = 0;
    $(".demo-table-card").forEach(function (card) {
      const isOpen = card.dataset.demoOpen === "true";
      const isVisibleByFilter = state.filter === "all" || isOpen;
      const matchesSearch = !query || card.textContent.toLocaleLowerCase("tr").includes(query);
      card.hidden = !(isVisibleByFilter && matchesSearch);
      const selected = card.dataset.demoTableId === state.demoSelectedId;
      card.classList.toggle("active", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
      if (!card.hidden) visibleCount += 1;
    });
    $("#tableResultCount").textContent = visibleCount + " masa";
  }
  function renderDemoBill(tableId) {
    const table = demoBills[String(tableId)];
    if (!table) return;
    $("#selectedTableName").textContent = table.name;
    $("#selectedTableMeta").textContent = table.seats + " kişilik masa · " + table.orders.length + " sipariş turu";
    $("#selectedBillStatus").textContent = "Adisyon açık";
    $("#selectedBillStatus").className = "bill-status is-open";
    $("#billDetailBody").innerHTML = table.orders.map(function (order, orderIndex) {
      const dateText = order.sentAt || "";
      const products = order.items.map(function (item, itemIndex) {
        const lineTotal = Number(item.price) * Number(item.quantity);
        const checkboxId = "demo-item-" + tableId + "-" + orderIndex + "-" + itemIndex;
        return '<label class="order-round-item is-selected" for="' + checkboxId + '"><input class="bill-item-checkbox" id="' + checkboxId + '" type="checkbox" checked data-line-total="' + lineTotal + '"><span class="order-product-details"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(money(item.price)) + ' × ' + Number(item.quantity) + '</small></span><strong class="order-line-total">' + escapeHtml(money(lineTotal)) + '</strong></label>';
      }).join("");
      return '<article class="order-round"><div class="order-round-head"><strong>Sipariş turu #' + escapeHtml(order.roundNumber || orderIndex + 1) + '</strong><span>' + escapeHtml(dateText) + '</span></div>' + products + '<div class="order-round-total"><span>Seçili ürünler</span><strong>' + escapeHtml(money(table.total)) + '</strong></div></article>';
    }).join("");
    $("#billTotal").textContent = money(table.total);
    updateSelectedTotals();
  }
  async function loadTables(preferredId) {
    state.loading = true;
    setConnection("connecting", "Bağlanıyor");
    $("#refreshButton").disabled = true;
    try {
      const payload = await api("/api/cashier/tables");
      state.apiLoaded = true;
      state.tables = Array.isArray(payload.tables) ? payload.tables : [];
      const preferred = preferredId != null ? preferredId : state.selectedTableId;
      const stillExists = preferred != null && state.tables.some(function (table) { return String(table.id) === String(preferred) && tableHasOpenBill(table); });
      if (stillExists) state.selectedTableId = preferred;
      else {
        const firstOpen = state.tables.find(tableHasOpenBill);
        state.selectedTableId = firstOpen ? firstOpen.id : null;
      }
      renderMetrics();
      renderTables();
      setConnection("connected", "Sunucuya bağlı");
      notice.hidden = true;
      if (state.selectedTableId != null) await loadBill(state.selectedTableId);
      else { state.bill = null; renderBill(); }
    } catch (error) {
      if (!state.apiLoaded) {
        // API henüz hazır değilken tasarım için eklenen örnek masaları etkileşimli göster.
        setConnection("preview", "Örnek görünüm");
        notice.hidden = true;
        renderDemoTables();
        renderDemoBill(state.demoSelectedId);
      } else {
        setConnection("error", "Bağlantı yok");
        notice.hidden = false;
      }
    } finally {
      state.loading = false;
      $("#refreshButton").disabled = false;
      if (state.apiLoaded) {
        renderTables();
        renderBill();
      }
    }
  }
  async function loadBill(tableId) {
    state.selectedTableId = tableId;
    state.loading = true;
    renderTables();
    $("#billDetailBody").innerHTML = '<div class="list-placeholder"><span class="placeholder-icon"><i class="bi bi-arrow-repeat"></i></span><strong>Adisyon yükleniyor</strong><span>Siparişler sunucudan alınıyor.</span></div>';
    try {
      state.bill = await api("/api/cashier/tables/" + encodeURIComponent(tableId) + "/bill");
      renderBill();
    } catch (error) {
      state.bill = null;
      renderBill();
      notify(error.status === 404 ? "Bu masa için açık adisyon bulunamadı." : "Adisyon verileri alınamadı.");
    } finally {
      state.loading = false;
      renderTables();
      renderBill();
    }
  }
  $("#billTableList").addEventListener("click", function (event) {
    const demoButton = event.target.closest("[data-demo-table-id]");
    if (demoButton && !state.apiLoaded) {
      if (demoButton.dataset.demoOpen === "true") {
        state.demoSelectedId = demoButton.dataset.demoTableId;
        renderDemoTables();
        renderDemoBill(state.demoSelectedId);
      }
      return;
    }
    const button = event.target.closest("[data-table-id]");
    if (button && state.apiLoaded) loadBill(button.dataset.tableId);
  });
  $("#billDetailBody").addEventListener("change", function (event) {
    if (event.target.matches(".bill-item-checkbox")) updateSelectedTotals();
  });
  $("#tableSearch").addEventListener("input", function (event) {
    state.query = event.target.value;
    if (state.apiLoaded) renderTables();
    else renderDemoTables();
  });
  $(".filter-pill").forEach(function (button) {
    button.addEventListener("click", function () {
      state.filter = button.dataset.filter;
      $(".filter-pill").forEach(function (pill) { pill.classList.toggle("active", pill === button); });
      if (state.apiLoaded) renderTables();
      else renderDemoTables();
    });
  });
  $("#refreshButton").addEventListener("click", function () { loadTables(state.selectedTableId); });

  loadTables();
});