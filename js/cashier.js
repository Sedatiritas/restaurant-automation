document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";
  const previewTables = [
    { id: "preview-1", name: "Masa 01", seats: 4, hasOpenBill: true, openTotal: 660, openOrderCount: 2 },
    { id: "preview-2", name: "Masa 02", seats: 2, hasOpenBill: true, openTotal: 285, openOrderCount: 1 },
    { id: "preview-3", name: "Masa 03", seats: 4, hasOpenBill: false, openTotal: 0, openOrderCount: 0 },
    { id: "preview-garden", name: "Bahçe 01", seats: 6, hasOpenBill: false, openTotal: 0, openOrderCount: 0 }
  ];
  const previewBills = {
    "preview-1": {
      table: previewTables[0], total: 660, orders: [
        { roundNumber: 1, sentAt: "2026-10-25T14:05:00+03:00", items: [
          { name: "Cappuccino", price: 125, quantity: 2 },
          { name: "San Sebastian", price: 170, quantity: 1 }
        ]},
        { roundNumber: 2, sentAt: "2026-10-25T14:17:00+03:00", items: [
          { name: "Iced Latte", price: 140, quantity: 1 },
          { name: "Americano", price: 100, quantity: 1 }
        ]}
      ]
    },
    "preview-2": {
      table: previewTables[1], total: 285, orders: [
        { roundNumber: 1, sentAt: "2026-10-25T14:11:00+03:00", items: [
          { name: "Cappuccino", price: 125, quantity: 1 },
          { name: "Çilekli Cheesecake", price: 160, quantity: 1 }
        ]}
      ]
    }
  };
  const state = { tables: [], selectedTableId: null, bill: null, query: "", loading: false };
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
      return !query || tableSearchText(table).includes(query);
    });
  }
  function renderTables() {
    const tables = visibleTables();
    $("#tableResultCount").textContent = tables.length + " masa";
    if (!tables.length) {
      $("#billTableList").innerHTML = '<div class="list-placeholder"><span class="placeholder-icon"><i class="bi bi-grid-1x2"></i></span><strong>' +
        (state.tables.length ? "Masa bulunamadı" : "Masalar yüklenemedi") +
        '</strong><span>' + (state.tables.length ? "Arama kelimesini değiştirebilirsin." : "Masa bilgileri backend bağlantısıyla burada listelenecek.") + '</span></div>';
      return;
    }
    $("#billTableList").innerHTML = tables.map(function (table) {
      const selected = String(table.id) === String(state.selectedTableId);
      const open = tableHasOpenBill(table);
      const detail = Number(table.openOrderCount || table.roundCount || 0) + " sipariş";
      return '<button type="button" class="bill-table-card ' + (selected ? "active" : "") + '" data-table-id="' + escapeHtml(table.id) + '">' +
        '<span class="bill-table-card-main"><span class="bill-table-icon"><i class="bi bi-grid-1x2-fill"></i></span><span class="bill-table-info"><strong>' + escapeHtml(table.name) + '</strong><small>' +
        (Number(table.seats) || 0) + ' kişilik masa · ' + (open ? detail : "Henüz sipariş yok") + '</small></span></span>' +
        '<span class="bill-table-end"><strong>' + escapeHtml(money(table.openTotal)) + '</strong><small>' + (open ? "Toplam" : "Boş") + '</small></span></button>';
    }).join("");
  }
  function billRounds() {
    return state.bill && Array.isArray(state.bill.orders) ? state.bill.orders : [];
  }
  function billLines() {
    let total = 0;
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
        return '<div class="order-round-item"><span class="order-round-item-info"><strong>' + escapeHtml(item.name) + '</strong><small>' + escapeHtml(money(unitPrice)) + ' / adet × ' + qty + '</small></span><strong class="order-round-item-total">' + escapeHtml(money(unitPrice * qty)) + '</strong></div>';
      }).join("");
      return '<article class="order-round"><div class="order-round-head"><strong>Sipariş turu #' + escapeHtml(order.roundNumber || index + 1) + '</strong><span>' + escapeHtml(dateText) + '</span></div>' +
        productMarkup + '<div class="order-round-total"><span>Tur toplamı</span><strong>' + escapeHtml(money(roundTotal)) + '</strong></div></article>';
    }).join("");
    if (state.bill && state.bill.total != null) total = Number(state.bill.total) || 0;
    return { markup: markup, total: total };
  }
  function renderBill() {
    const bill = state.bill;
    if (!bill) {
      const selectedTable = state.tables.find(function (table) { return String(table.id) === String(state.selectedTableId); });
      $("#selectedTableName").textContent = selectedTable ? selectedTable.name : "Masa seçilmedi";
      $("#selectedTableMeta").textContent = selectedTable
        ? (Number(selectedTable.seats) || 0) + " kişilik masa"
        : "Bir masa seçerek ürünleri ve fiyatları görüntüle.";
      $("#selectedBillStatus").textContent = selectedTable ? "Sipariş yok" : "Masa seçilmedi";
      $("#selectedBillStatus").className = "bill-status";
      $("#billDetailBody").innerHTML = selectedTable
        ? '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Henüz sipariş yok</strong><span>Bu masaya ürün eklendiğinde adetler ve fiyatlar burada listelenir.</span></div>'
        : '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bir masa seç</strong><span>Seçtiğin masanın ürünleri, adetleri ve fiyatları burada görünecek.</span></div>';
      $("#billTotal").textContent = money(0);
      return;
    }
    const table = bill.table || {};
    const rounds = billRounds();
    const lines = billLines();
    $("#selectedTableName").textContent = table.name || "Masa " + state.selectedTableId;
    $("#selectedTableMeta").textContent = (Number(table.seats) || 0) + " kişilik masa · " + rounds.length + " sipariş turu";
    $("#selectedBillStatus").textContent = rounds.length ? "Sipariş var" : "Sipariş yok";
    $("#selectedBillStatus").className = "bill-status " + (rounds.length ? "is-open" : "");
    $("#billDetailBody").innerHTML = lines.markup || '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bu masada açık sipariş yok</strong><span>Başka bir masa seçebilirsin.</span></div>';
    $("#billTotal").textContent = money(lines.total);
  }
  async function loadTables(preferredId) {
    state.loading = true;
    setConnection("connecting", "Bağlanıyor");
    $("#refreshButton").disabled = true;
    try {
      const payload = await api("/api/cashier/tables");
      state.tables = Array.isArray(payload.tables) ? payload.tables : [];
      const preferred = preferredId != null ? preferredId : state.selectedTableId;
      const stillExists = preferred != null && state.tables.some(function (table) { return String(table.id) === String(preferred) && tableHasOpenBill(table); });
      if (stillExists) state.selectedTableId = preferred;
      else {
        const firstOpen = state.tables.find(tableHasOpenBill);
        state.selectedTableId = firstOpen ? firstOpen.id : null;
      }
      renderTables();
      setConnection("connected", "Sunucuya bağlı");
      notice.hidden = true;
      if (state.selectedTableId != null) await loadBill(state.selectedTableId);
      else { state.bill = null; renderBill(); }
    } catch (error) {
      setConnection("error", "Bağlantı yok");
      notice.hidden = false;
      state.tables = [];
      state.bill = null;
      renderTables();
      renderBill();
    } finally {
      state.loading = false;
      $("#refreshButton").disabled = false;
      renderTables();
      renderBill();
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
      if (error.status !== 404) notify("Adisyon verileri alınamadı.");
    } finally {
      state.loading = false;
      renderTables();
      renderBill();
    }
  }
  $("#billTableList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-table-id]");
    if (!button) return;
    if (previewMode) {
      state.selectedTableId = button.dataset.tableId;
      state.bill = previewBills[state.selectedTableId] || null;
      renderTables();
      renderBill();
      return;
    }
    loadBill(button.dataset.tableId);
  });
  $("#tableSearch").addEventListener("input", function (event) { state.query = event.target.value; renderTables(); });
  $("#refreshButton").addEventListener("click", function () {
    if (previewMode) {
      window.location.href = window.location.pathname;
      return;
    }
    loadTables(state.selectedTableId);
  });

  if (previewMode) {
    state.tables = previewTables;
    state.selectedTableId = previewTables[0].id;
    state.bill = previewBills[state.selectedTableId];
    notice.hidden = true;
    setConnection("preview", "Tanıtım önizlemesi");
    $("#refreshButton").innerHTML = '<i class="bi bi-arrow-up-right"></i><span>Canlı ekran</span>';
    renderTables();
    renderBill();
  } else {
    loadTables();
  }
});