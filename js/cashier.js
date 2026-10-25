document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  function loadDemoState() {
    try {
      const saved = JSON.parse(localStorage.getItem("roastCashier_demoState") || "{}");
      return {
        paidUnits: saved && saved.paidUnits && typeof saved.paidUnits === "object" ? saved.paidUnits : {},
        closedTableIds: Array.isArray(saved && saved.closedTableIds) ? saved.closedTableIds.map(String) : []
      };
    } catch (error) {
      return { paidUnits: {}, closedTableIds: [] };
    }
  }
  const savedDemoState = loadDemoState();
  const state = {
    tables: [], selectedTableId: null, bill: null, filter: "open", query: "",
    loading: false, apiLoaded: false, demoSelectedId: "2",
    demoPaidUnits: savedDemoState.paidUnits,
    demoClosedIds: new Set(savedDemoState.closedTableIds)
  };

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
  if (state.demoClosedIds.has(String(state.demoSelectedId))) {
    state.demoSelectedId = Object.keys(demoBills).find(function (id) { return !state.demoClosedIds.has(String(id)); }) || null;
  }
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
  function selectedPaymentMethod() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    return selected && selected.value === "card" ? "card" : "cash";
  }
  function paymentMethodLabel(method) { return method === "card" ? "Kart" : "Nakit"; }
  function saveDemoState() {
    try {
      localStorage.setItem("roastCashier_demoState", JSON.stringify({
        paidUnits: state.demoPaidUnits, closedTableIds: Array.from(state.demoClosedIds)
      }));
      return true;
    } catch (error) { return false; }
  }
  function saveDemoCollection(tableId, tableName, units, method, total) {
    const oldSalesRaw = localStorage.getItem("roastCashier_sales");
    const oldStateRaw = localStorage.getItem("roastCashier_demoState");
    const before = JSON.parse(JSON.stringify(state.demoPaidUnits));
    const now = new Date();
    const paymentId = "demo-payment-" + now.getTime() + "-" + Math.random().toString(36).slice(2, 7);
    try {
      const saved = oldSalesRaw ? JSON.parse(oldSalesRaw) : [];
      const sales = Array.isArray(saved) ? saved : [];
      const tablePayments = Object.assign({}, state.demoPaidUnits[String(tableId)] || {});
      units.forEach(function (unit) {
        if (tablePayments[unit.unitKey]) throw new Error("Bu ürün adedi daha önce tahsil edilmiş.");
        tablePayments[unit.unitKey] = { paymentId: paymentId, paymentMethod: method, amount: unit.amount, paidAt: now.toISOString(), productName: unit.productName };
      });
      state.demoPaidUnits[String(tableId)] = tablePayments;
      sales.push({
        id: paymentId, tableId: String(tableId), tableName: tableName, amount: total, paymentMethod: method,
        date: now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"),
        closedAt: now.toISOString(),
        items: units.map(function (unit) { return { unitKey: unit.unitKey, itemId: unit.itemId, orderId: unit.orderId, unitIndex: unit.unitIndex, name: unit.productName, amount: unit.amount }; }),
        source: "preview"
      });
      localStorage.setItem("roastCashier_sales", JSON.stringify(sales));
      if (!saveDemoState()) throw new Error("Tahsilat durumu tarayıcıya kaydedilemedi.");
      return true;
    } catch (error) {
      state.demoPaidUnits = before;
      try {
        if (oldSalesRaw === null) localStorage.removeItem("roastCashier_sales"); else localStorage.setItem("roastCashier_sales", oldSalesRaw);
        if (oldStateRaw === null) localStorage.removeItem("roastCashier_demoState"); else localStorage.setItem("roastCashier_demoState", oldStateRaw);
      } catch (rollbackError) {}
      notify(error.message || "Tahsilat kaydedilemedi.");
      return false;
    }
  }
  function makeUnitKey(order, item, orderIndex, itemIndex, unitIndex) {
    const orderKey = order && order.id != null ? order.id : (order && order.orderId != null ? order.orderId : (order && order.roundNumber != null ? "round-" + order.roundNumber : "round-" + orderIndex));
    const itemKey = item && item.id != null ? item.id : (item && item.itemId != null ? item.itemId : (item && item.productId != null ? item.productId : "item-" + itemIndex));
    return "order-" + String(orderKey) + "-item-" + String(itemKey) + "-unit-" + (unitIndex + 1);
  }
  function unitPaymentRecord(tableId, order, item, orderIndex, itemIndex, unitIndex, unitKey) {
    if (!state.apiLoaded) return (state.demoPaidUnits[String(tableId)] || {})[unitKey] || null;
    const records = Array.isArray(item.unitPayments) ? item.unitPayments : (Array.isArray(item.paidUnits) ? item.paidUnits : []);
    const record = records.find(function (entry) {
      if (entry && typeof entry === "object") return Number(entry.unitIndex) === unitIndex + 1;
      return Number(entry) === unitIndex + 1;
    });
    if (record) return typeof record === "object" ? record : { paymentMethod: item.paymentMethod || "" };
    if (Number(item.paidQuantity) > unitIndex || item.paid === true) return { paymentMethod: item.paymentMethod || "", paidAt: item.paidAt || "" };
    return null;
  }
  function paymentOverview(orders, tableId) {
    const summary = { total: 0, paid: 0, remaining: 0, unitCount: 0, paidUnitCount: 0 };
    (Array.isArray(orders) ? orders : []).forEach(function (order, orderIndex) {
      (Array.isArray(order.items) ? order.items : []).forEach(function (item, itemIndex) {
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
        const price = Number(item.price != null ? item.price : item.unitPrice) || 0;
        for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
          const key = makeUnitKey(order, item, orderIndex, itemIndex, unitIndex);
          summary.total += price;
          summary.unitCount += 1;
          if (unitPaymentRecord(tableId, order, item, orderIndex, itemIndex, unitIndex, key)) {
            summary.paid += price;
            summary.paidUnitCount += 1;
          }
        }
      });
    });
    summary.remaining = Math.max(0, summary.total - summary.paid);
    return summary;
  }
  function selectedUnitsFromUI() {
    return $$("#billDetailBody .bill-item-checkbox:checked:not(:disabled)").map(function (checkbox) {
      return {
        unitKey: checkbox.dataset.unitKey, tableId: checkbox.dataset.tableId,
        orderId: checkbox.dataset.orderId || "", itemId: checkbox.dataset.itemId || "",
        unitIndex: Number(checkbox.dataset.unitIndex) || 1,
        productName: checkbox.dataset.productName || "Ürün",
        amount: Number(checkbox.dataset.lineTotal) || 0
      };
    });
  }
  function updatePaymentSummary(summary, closed) {
    $("#billGrandTotal").textContent = money(summary.total);
    $("#paidTotal").textContent = money(summary.paid);
    $("#remainingTotal").textContent = money(summary.remaining);
    $("#closeBillButton").disabled = Boolean(closed || summary.remaining > 0.001);
    $("#closeBillNote").textContent = summary.remaining > 0.001
      ? money(summary.remaining) + " tutarında ödenmemiş ürün var. Tahsilat yapmadan adisyonu kapatamazsın."
      : "Tüm ürünler tahsil edildi. Adisyonu kapatmak için aşağıdaki butona bas.";
  }
  function refreshCollectButton(selectedTotal) {
    const button = $("#collectSelectedButton");
    if (button) button.disabled = !(selectedTotal > 0) || (!state.apiLoaded && (!state.demoSelectedId || state.demoClosedIds.has(String(state.demoSelectedId)))) || (state.apiLoaded && (!state.bill || state.selectedTableId == null));
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
    if (!table) return false;

    // When the API explicitly tells us the bill is open/closed, trust that value over any stale total.
    if (typeof table.hasOpenBill === "boolean") return table.hasOpenBill;
    if (typeof table.isOpen === "boolean") return table.isOpen;

    const status = String(table.billStatus || table.accountStatus || table.status || "")
      .trim()
      .toLocaleLowerCase("tr");
    if (["closed", "kapalı", "kapali", "empty", "boş", "bos", "paid", "ödendi", "odendi"].includes(status)) return false;
    if (["open", "açık", "acik", "active", "pending", "confirmed"].includes(status)) return true;

    if (table.openOrderCount != null) return Number(table.openOrderCount) > 0;
    if (table.roundCount != null) return Number(table.roundCount) > 0;
    return Number(table.openTotal) > 0;
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
        '<span class="bill-table-end"><strong>' + escapeHtml(open ? money(table.openTotal) : "—") + '</strong><small>' + (open ? "Açık adisyon" : "Kapalı masa") + '</small></span></button>';
    }).join("");
  }
  function billRounds() {
    return state.bill && Array.isArray(state.bill.orders) ? state.bill.orders : [];
  }
  function renderProductRow(item, controlId, context) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const price = Number(item.price != null ? item.price : item.unitPrice) || 0;
    const name = escapeHtml(item.name);
    if (quantity <= 0) return "";
    return Array.from({ length: quantity }, function (_, index) {
      const checkboxId = controlId + "-unit-" + (index + 1);
      const key = makeUnitKey(context.order, item, context.orderIndex, context.itemIndex, index);
      const payment = unitPaymentRecord(context.tableId, context.order, item, context.orderIndex, context.itemIndex, index, key);
      const paid = Boolean(payment);
      const methodLabel = payment && payment.paymentMethod ? " · " + paymentMethodLabel(payment.paymentMethod) : "";
      const badge = paid ? '<span class="unit-payment-status">Ödendi' + escapeHtml(methodLabel) + '</span>' : "";
      const orderId = context.order && context.order.id != null ? context.order.id : (context.order && context.order.orderId != null ? context.order.orderId : "");
      const itemId = item.id != null ? item.id : (item.itemId != null ? item.itemId : (item.productId != null ? item.productId : ""));
      return '<label class="order-round-item ' + (paid ? "is-paid" : "") + '" for="' + checkboxId + '">' +
        '<input class="bill-item-checkbox" id="' + checkboxId + '" type="checkbox"' + (paid ? ' disabled data-paid="true"' : ' data-paid="false"') +
        ' data-line-total="' + price + '" data-unit-key="' + escapeHtml(key) + '" data-table-id="' + escapeHtml(context.tableId) + '"' +
        ' data-order-id="' + escapeHtml(orderId) + '" data-item-id="' + escapeHtml(itemId) + '" data-unit-index="' + (index + 1) + '" data-product-name="' + name + '"' +
        ' aria-label="' + name + ' ' + (index + 1) + '. adet ' + (paid ? "ödendi" : "tahsilata ekle") + '">' +
        '<span class="order-product-details"><strong>' + name + '</strong><small>' + (index + 1) + " / " + quantity + ' adet · ' + escapeHtml(money(price)) + '</small></span>' +
        badge + '<strong class="order-line-total">' + escapeHtml(money(price)) + '</strong></label>';
    }).join("");
  }
  function billLines() {
    let rowIndex = 0;
    const tableId = state.bill && state.bill.table && state.bill.table.id != null ? state.bill.table.id : state.selectedTableId;
    return {
      markup: billRounds().map(function (order, orderIndex) {
        const items = Array.isArray(order.items) ? order.items : [];
        const time = order.sentAt ? new Date(order.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
        const products = items.map(function (item, itemIndex) {
          const controlId = "bill-item-" + (++rowIndex);
          return renderProductRow(item, controlId, { tableId: tableId, order: order, orderIndex: orderIndex, itemIndex: itemIndex });
        }).join("");
        return '<article class="order-round"><div class="order-round-head"><strong>Sipariş turu #' + escapeHtml(order.roundNumber || orderIndex + 1) + '</strong><span>' + escapeHtml(time) + '</span></div>' +
          products + '<div class="order-round-total"><span>Seçilenleri tahsil et</span><strong>' + escapeHtml(money(0)) + '</strong></div></article>';
      }).join("")
    };
  }
  function renderBill() {
    const bill = state.bill;
    if (!bill) {
      $("#closeBillButton").disabled = true;
      $("#collectSelectedButton").disabled = true;
      $("#selectedTableName").textContent = "Masa seçilmedi";
      $("#selectedTableMeta").textContent = "Ürünler ve tutarlar burada görünecek.";
      $("#selectedBillStatus").textContent = "Bekliyor";
      $("#selectedBillStatus").className = "bill-status";
      $("#billDetailBody").innerHTML = '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bir masa seç</strong><span>Seçtiğin masanın ürünleri ve tutarları burada görüntülenecek.</span></div>';
      updatePaymentSummary({ total: 0, paid: 0, remaining: 0 }, true);
      $("#billTotal").textContent = money(0);
      return;
    }
    const table = bill.table || {};
    const rounds = billRounds();
    const lines = billLines();
    const summary = paymentOverview(rounds, table.id != null ? table.id : state.selectedTableId);
    $("#selectedTableName").textContent = table.name || "Masa " + state.selectedTableId;
    $("#selectedTableMeta").textContent = (Number(table.seats) || 0) + " kişilik masa · " + rounds.length + " sipariş turu";
    $("#selectedBillStatus").textContent = summary.remaining <= 0.001 ? "Tahsil edildi · Adisyon açık" : "Adisyon açık";
    $("#selectedBillStatus").className = "bill-status " + (summary.remaining <= 0.001 ? "is-paid-status" : "is-open");
    $("#billDetailBody").innerHTML = lines.markup || '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Bu masada açık sipariş yok</strong><span>Başka bir masa seçebilirsin.</span></div>';
    updatePaymentSummary(summary, false);
    $("#billTotal").textContent = money(0);
    updateSelectedTotals();
  }
  function updateSelectedTotals() {
    let selectedTotal = 0;
    $$("#billDetailBody .order-round").forEach(function (round) {
      let roundTotal = 0;
      round.querySelectorAll(".order-round-item").forEach(function (row) {
        const checkbox = row.querySelector(".bill-item-checkbox");
        if (!checkbox) return;
        const price = Number(checkbox.dataset.lineTotal) || 0;
        const paid = checkbox.dataset.paid === "true";
        const selected = !paid && checkbox.checked;
        if (paid) checkbox.checked = false;
        const priceNode = row.querySelector(".order-line-total");
        if (priceNode) priceNode.textContent = money(price);
        row.classList.toggle("is-selected", selected);
        row.classList.toggle("is-paid", paid);
        if (selected) { selectedTotal += price; roundTotal += price; }
      });
      const roundSum = round.querySelector(".order-round-total strong");
      if (roundSum) roundSum.textContent = money(roundTotal);
    });
    $("#billTotal").textContent = money(selectedTotal);
    refreshCollectButton(selectedTotal);
    return selectedTotal;
  }
  function renderDemoTables() {
    const query = state.query.toLocaleLowerCase("tr").trim();
    let visibleCount = 0;
    $$(".demo-table-card").forEach(function (card) {
      const tableId = String(card.dataset.demoTableId);
      const closed = state.demoClosedIds.has(tableId);
      if (closed) card.dataset.demoOpen = "false";
      const hasOpenBill = card.dataset.demoOpen === "true" && !closed;
      const visibleByTab = state.filter === "all" || hasOpenBill;
      const matchesSearch = !query || card.textContent.toLocaleLowerCase("tr").includes(query);
      const demoBill = demoBills[tableId];
      if (closed) {
        const info = card.querySelector(".bill-table-info small");
        const amount = card.querySelector(".bill-table-end strong");
        const status = card.querySelector(".bill-table-end small");
        if (info) info.textContent = info.textContent.replace(/ · .+$/, " · Kapalı masa");
        if (amount) amount.textContent = "—";
        if (status) status.textContent = "Kapalı masa";
      } else if (demoBill) {
        const summary = paymentOverview(demoBill.orders, tableId);
        const info = card.querySelector(".bill-table-info small");
        const amount = card.querySelector(".bill-table-end strong");
        const status = card.querySelector(".bill-table-end small");
        if (info) info.textContent = demoBill.seats + " kişilik masa · " + (summary.remaining <= 0.001 ? "Tahsil edildi, kapatılmayı bekliyor" : summary.paid > 0 ? money(summary.paid) + " tahsil edildi" : "Adisyon açık");
        if (amount) amount.textContent = money(summary.remaining);
        if (status) status.textContent = summary.remaining <= 0.001 ? "Kapatılmayı bekliyor" : (tableId === String(state.demoSelectedId) ? "Seçili masa" : "Adisyon açık");
      } else if (!hasOpenBill) {
        const info = card.querySelector(".bill-table-info small");
        const amount = card.querySelector(".bill-table-end strong");
        const status = card.querySelector(".bill-table-end small");
        if (info) info.textContent = info.textContent.replace(/ · .+$/, " · Boş");
        if (amount) amount.textContent = "—";
        if (status) status.textContent = "Boş masa";
      }
      card.hidden = !(visibleByTab && matchesSearch);
      card.disabled = !hasOpenBill;
      const selected = tableId === String(state.demoSelectedId);
      card.classList.toggle("active", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
      if (!card.hidden) visibleCount += 1;
    });
    $("#tableResultCount").textContent = visibleCount + " masa";
  }
  function clearDemoBill() {
    $("#selectedTableName").textContent = "Masa seçilmedi";
    $("#selectedTableMeta").textContent = "Açık adisyonu olan bir masa seç.";
    $("#selectedBillStatus").textContent = "Bekliyor";
    $("#selectedBillStatus").className = "bill-status";
    $("#billDetailBody").innerHTML = '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>Açık adisyon seçilmedi</strong><span>Açık adisyonlar sekmesinden başka bir masa seçebilirsin.</span></div>';
    $("#billTotal").textContent = money(0);
    updatePaymentSummary({ total: 0, paid: 0, remaining: 0 }, true);
    $("#collectSelectedButton").disabled = true;
  }
  function renderDemoBill(tableId) {
    const table = demoBills[String(tableId)];
    if (!table || state.demoClosedIds.has(String(tableId))) { clearDemoBill(); return; }
    $("#selectedTableName").textContent = table.name;
    $("#selectedTableMeta").textContent = table.seats + " kişilik masa · " + table.orders.length + " sipariş turu";
    const summary = paymentOverview(table.orders, tableId);
    $("#selectedBillStatus").textContent = summary.remaining <= 0.001 ? "Tahsil edildi · Adisyon açık" : "Adisyon açık";
    $("#selectedBillStatus").className = "bill-status " + (summary.remaining <= 0.001 ? "is-paid-status" : "is-open");
    $("#billDetailBody").innerHTML = table.orders.map(function (order, orderIndex) {
      const products = order.items.map(function (item, itemIndex) {
        const controlId = "demo-item-" + tableId + "-" + orderIndex + "-" + itemIndex;
        return renderProductRow(item, controlId, { tableId: tableId, order: order, orderIndex: orderIndex, itemIndex: itemIndex });
      }).join("");
      return '<article class="order-round"><div class="order-round-head"><strong>Sipariş turu #' + escapeHtml(order.roundNumber || orderIndex + 1) + '</strong><span>' + escapeHtml(order.sentAt || "") + '</span></div>' + products + '<div class="order-round-total"><span>Seçilenleri tahsil et</span><strong>' + escapeHtml(money(0)) + '</strong></div></article>';
    }).join("");
    updatePaymentSummary(summary, false);
    $("#billTotal").textContent = money(0);
    updateSelectedTotals();
  }
  async function collectSelected() {
    const tableId = state.apiLoaded ? state.selectedTableId : state.demoSelectedId;
    const demoBill = !state.apiLoaded ? demoBills[String(tableId)] : null;
    if (tableId == null || (state.apiLoaded ? !state.bill : !demoBill)) { notify("Önce açık adisyonu olan bir masa seç."); return; }
    const units = selectedUnitsFromUI();
    if (!units.length) { notify("Önce tahsil edilecek, ödenmemiş ürünleri seç."); return; }
    const total = units.reduce(function (sum, unit) { return sum + unit.amount; }, 0);
    if (!(total > 0)) { notify("Seçilen ürünler için geçerli bir tahsilat tutarı bulunamadı."); return; }
    const method = selectedPaymentMethod();
    const tableName = state.apiLoaded ? $("#selectedTableName").textContent.trim() : demoBill.name;
    if (!window.confirm(tableName + " için " + money(total) + " tutarındaki " + units.length + " ürün adedini " + paymentMethodLabel(method) + " olarak tahsil etmek istiyor musun?")) return;
    const button = $("#collectSelectedButton");
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Tahsilat kaydediliyor...</span>';
    try {
      if (!state.apiLoaded) {
        if (!saveDemoCollection(tableId, tableName, units, method, total)) return;
        renderDemoBill(tableId);
        renderDemoTables();
        notify(money(total) + " " + paymentMethodLabel(method).toLocaleLowerCase("tr") + " olarak tahsil edildi. Ürünler listede kaldı ve tekrar seçilemez.");
        return;
      }
      const response = await fetch("/api/cashier/tables/" + encodeURIComponent(tableId) + "/collect", {
        method: "POST", credentials: "same-origin",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: method, items: units.map(function (unit) {
          return { orderId: unit.orderId, itemId: unit.itemId, unitIndex: unit.unitIndex, amount: unit.amount };
        }) })
      });
      const payload = await response.json().catch(function () { return null; });
      if (!response.ok) throw new Error(payload && payload.message ? payload.message : "Tahsilat kaydedilemedi. Sunucuda tahsilat API'si bulunmuyor veya istek başarısız oldu.");
      await loadTables(tableId);
      notify(money(total) + " tutarındaki tahsilat kaydedildi.");
    } catch (error) {
      notify(error.message || "Tahsilat sırasında hata oluştu; ürünler ödenmiş olarak işaretlenmedi.");
    } finally {
      button.innerHTML = originalMarkup;
      if (state.apiLoaded) updateSelectedTotals();
      else if (state.demoSelectedId) updateSelectedTotals();
      else button.disabled = true;
    }
  }
  async function closeBill() {
    const tableId = state.apiLoaded ? state.selectedTableId : state.demoSelectedId;
    const demoBill = !state.apiLoaded ? demoBills[String(tableId)] : null;
    if (tableId == null || (state.apiLoaded ? !state.bill : !demoBill)) { notify("Önce açık adisyonu olan bir masa seç."); return; }
    const summary = paymentOverview(state.apiLoaded ? billRounds() : demoBill.orders, tableId);
    if (summary.remaining > 0.001) {
      notify("Adisyon kapatılamaz. Önce kalan " + money(summary.remaining) + " tutarındaki ürünleri tahsil et.");
      return;
    }
    const tableName = state.apiLoaded ? $("#selectedTableName").textContent.trim() : demoBill.name;
    if (!window.confirm("Tüm ürünler tahsil edildi. " + tableName + " adisyonunu kapatmak istiyor musun? Bu işlem yeni bir ciro kaydı oluşturmaz.")) return;
    const button = $("#closeBillButton");
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Adisyon kapatılıyor...</span>';
    try {
      if (!state.apiLoaded) {
        state.demoClosedIds.add(String(tableId));
        if (!saveDemoState()) {
          state.demoClosedIds.delete(String(tableId));
          notify("Adisyon kapatılamadı; masa durumu tarayıcıya kaydedilemedi.");
          return;
        }
        const card = $('#billTableList [data-demo-table-id="' + String(tableId) + '"]');
        if (card) { card.dataset.demoOpen = "false"; card.disabled = true; }
        state.demoSelectedId = null;
        renderDemoTables();
        clearDemoBill();
        notify("Adisyon kapatıldı. Tahsilatlar ciroya daha önce kaydedildi.");
        return;
      }
      const response = await fetch("/api/cashier/tables/" + encodeURIComponent(tableId) + "/close", {
        method: "POST", credentials: "same-origin",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const payload = await response.json().catch(function () { return null; });
      if (!response.ok) throw new Error(payload && payload.message ? payload.message : "Adisyon kapatılamadı.");
      state.selectedTableId = null;
      state.bill = null;
      await loadTables(null);
      notify("Adisyon kapatıldı. Yeni ciro kaydı oluşturulmadı.");
    } catch (error) {
      notify(error.message || "Adisyon kapatılırken bir hata oluştu.");
    } finally {
      button.innerHTML = originalMarkup;
      if (state.apiLoaded) button.disabled = !state.bill || paymentOverview(billRounds(), state.selectedTableId).remaining > 0.001;
      else button.disabled = !state.demoSelectedId || state.demoClosedIds.has(String(state.demoSelectedId)) || (demoBills[String(state.demoSelectedId)] && paymentOverview(demoBills[String(state.demoSelectedId)].orders, state.demoSelectedId).remaining > 0.001);
    }
  }
  async function loadTables(preferredId) {
    state.loading = true;
    setConnection("connecting", "Bağlanıyor");
    $("#refreshButton").disabled = true;
    try {
      const payload = await api("/api/cashier/tables");
      // HTTP 200 tek başına API'nin hazır olduğunu göstermez. Boş/HTML yanıtı
      // gelirse örnek masa arayüzüne düşüp masa filtrelerini çalışır tut.
      if (!payload || !Array.isArray(payload.tables)) {
        throw new Error("Kasa API'si geçerli bir masa listesi döndürmedi.");
      }
      state.apiLoaded = true;
      state.tables = payload.tables;
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
  $$('input[name="paymentMethod"]').forEach(function (input) {
    input.addEventListener("change", function () {
      $$(".payment-method-option").forEach(function (option) {
        const radio = option.querySelector('input[name="paymentMethod"]');
        option.classList.toggle("is-selected", Boolean(radio && radio.checked));
      });
    });
  });
  $("#tableSearch").addEventListener("input", function (event) {
    state.query = event.target.value;
    if (state.apiLoaded) renderTables();
    else renderDemoTables();
  });
  $$(".filter-pill").forEach(function (button) {
    button.addEventListener("click", function () {
      state.filter = button.dataset.filter;
      $$(".filter-pill").forEach(function (pill) { pill.classList.toggle("active", pill === button); });
      if (state.apiLoaded) renderTables();
      else renderDemoTables();
    });
  });
  $("#refreshButton").addEventListener("click", function () { loadTables(state.selectedTableId); });
  $("#collectSelectedButton").addEventListener("click", collectSelected);
  $("#closeBillButton").addEventListener("click", closeBill);

  loadTables();
});