document.addEventListener("DOMContentLoaded", function () {
  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const state = {
    tables: [],
    selectedTableId: null,
    bill: null,
    filter: "open",
    query: "",
    apiLoaded: false,
    loading: false
  };

  const notice = $("#apiNotice");
  const connectionStatus = $("#connectionStatus");
  const toastEl = $("#cashierToast");
  const toastMessage = $("#cashierToastMessage");
  const toast = window.bootstrap && toastEl
    ? window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2800 })
    : null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
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

  function notify(message) {
    if (!toast || !toastMessage) {
      window.alert(message);
      return;
    }
    toastMessage.textContent = message;
    toast.show();
  }

  function setConnection(status, label) {
    connectionStatus.classList.toggle("is-connected", status === "connected");
    connectionStatus.classList.toggle("is-error", status === "error");
    connectionStatus.classList.remove("is-preview");
    const text = connectionStatus.querySelector("span:last-child");
    if (text) text.textContent = label;
  }

  function selectedPaymentMethod() {
    const selected = document.querySelector('input[name="paymentMethod"]:checked');
    return selected && selected.value === "card" ? "card" : "cash";
  }

  function paymentMethodLabel(method) {
    return method === "card" ? "Kart" : "Nakit";
  }

  async function api(path, options) {
    const requestOptions = Object.assign({
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" }
    }, options || {});
    if (requestOptions.body) {
      requestOptions.headers = Object.assign({}, requestOptions.headers, {
        "Content-Type": "application/json"
      });
    }

    const response = await fetch(path, requestOptions);
    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      throw new Error("Sunucudan geçerli bir yanıt alınamadı.");
    }

    if (!response.ok) {
      const message = payload && (payload.message || payload.error)
        ? (payload.message || payload.error)
        : "İstek başarısız oldu (" + response.status + ").";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload || {};
  }

  function tableHasOpenBill(table) {
    if (!table) return false;
    if (typeof table.hasOpenBill === "boolean") return table.hasOpenBill;
    return table.billStatus === "OPEN";
  }

  function visibleTables() {
    const query = state.query.toLocaleLowerCase("tr").trim();
    return state.tables.filter(function (table) {
      if (state.filter === "open" && !tableHasOpenBill(table)) return false;
      const text = (String(table.name || "") + " " + String(table.id || "")).toLocaleLowerCase("tr");
      return !query || text.includes(query);
    });
  }

  function renderMetrics() {
    const openTables = state.tables.filter(tableHasOpenBill);
    const total = openTables.reduce(function (sum, table) {
      return sum + (Number(table.openTotal) || 0);
    }, 0);
    $("#openBillCount").textContent = String(openTables.length);
    $("#openTableCount").textContent = String(openTables.length);
    $("#openBillTotal").textContent = money(total);
  }

  function renderTables() {
    const tables = visibleTables();
    $("#tableResultCount").textContent = tables.length + " masa";

    if (!tables.length) {
      const hasAnyTables = state.tables.length > 0;
      $("#billTableList").innerHTML =
        '<div class="list-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span><strong>' +
        (hasAnyTables
          ? (state.filter === "open" ? "Açık adisyon yok" : "Uygun masa bulunamadı")
          : "Masa bulunamadı") +
        '</strong><span>' +
        (hasAnyTables
          ? (state.filter === "open" ? "Garson siparişi gönderdiğinde açık adisyonlar burada görünecek." : "Arama kelimesini değiştirebilirsin.")
          : "Önce yönetim panelinden masa ekleyin.") +
        '</span></div>';
      return;
    }

    $("#billTableList").innerHTML = tables.map(function (table) {
      const open = tableHasOpenBill(table);
      const selected = String(table.id) === String(state.selectedTableId);
      const detail = Number(table.openOrderCount || table.sentOrderCount || 0) + " sipariş turu";
      const total = open ? money(table.openTotal) : "₺0,00";
      const status = open
        ? (Number(table.openTotal) <= 0.001 ? "Tahsil edildi" : "Adisyon açık")
        : "Boş";
      return (
        '<button type="button" class="bill-table-card' + (selected ? " active" : "") +
          '" data-table-id="' + escapeHtml(table.id) + '"' +
          (open ? "" : ' disabled aria-label="' + escapeHtml(table.name) + ', açık adisyon yok"') + '>' +
          '<span class="bill-table-card-main">' +
            '<span class="bill-table-icon"><i class="bi bi-grid-1x2-fill"></i></span>' +
            '<span class="bill-table-info"><strong>' + escapeHtml(table.name) + '</strong>' +
            '<small>' + Number(table.seats || 0) + ' kişilik masa · ' + (open ? detail : "Hesap kapalı") + '</small></span>' +
          '</span>' +
          '<span class="bill-table-end"><strong>' + escapeHtml(total) + '</strong>' +
          '<small>' + status + '</small></span>' +
        '</button>'
      );
    }).join("");
  }

  function billRounds() {
    return state.bill && Array.isArray(state.bill.orders) ? state.bill.orders : [];
  }

  function unitPaymentRecord(item, unitIndex) {
    const records = Array.isArray(item.unitPayments) ? item.unitPayments : [];
    return records.find(function (record) {
      return Number(record.unitIndex) === unitIndex + 1;
    }) || null;
  }

  function paymentOverview(orders) {
    const summary = { total: 0, paid: 0, remaining: 0, unitCount: 0, paidUnitCount: 0 };
    (Array.isArray(orders) ? orders : []).forEach(function (order) {
      (Array.isArray(order.items) ? order.items : []).forEach(function (item) {
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
        const price = Number(item.price != null ? item.price : item.unitPrice) || 0;
        for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
          summary.total += price;
          summary.unitCount += 1;
          if (unitPaymentRecord(item, unitIndex)) {
            summary.paid += price;
            summary.paidUnitCount += 1;
          }
        }
      });
    });
    summary.total = Number(summary.total.toFixed(2));
    summary.paid = Number(summary.paid.toFixed(2));
    summary.remaining = Number(Math.max(0, summary.total - summary.paid).toFixed(2));
    return summary;
  }

  function makeUnitKey(order, item, unitIndex) {
    return "order-" + String(order.id) + "-item-" + String(item.id) + "-unit-" + (unitIndex + 1);
  }

  function renderProductRow(item, controlId, order, unitIndex, tableId) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    const price = Number(item.price != null ? item.price : item.unitPrice) || 0;
    const name = escapeHtml(item.name);
    if (quantity <= 0) return "";

    return Array.from({ length: quantity }, function (_unused, index) {
      const checkboxId = controlId + "-unit-" + (index + 1);
      const payment = unitPaymentRecord(item, index);
      const paid = Boolean(payment);
      const methodLabel = payment && payment.paymentMethod
        ? " · " + paymentMethodLabel(payment.paymentMethod)
        : "";
      const badge = paid
        ? '<span class="unit-payment-status">Ödendi' + escapeHtml(methodLabel) + '</span>'
        : "";
      return (
        '<label class="order-round-item ' + (paid ? "is-paid" : "is-selected") + '" for="' + checkboxId + '">' +
          '<input class="bill-item-checkbox" id="' + checkboxId + '" type="checkbox"' +
            (paid ? ' disabled data-paid="true"' : ' checked data-paid="false"') +
            ' data-line-total="' + price + '" data-unit-key="' + escapeHtml(makeUnitKey(order, item, index)) +
            '" data-table-id="' + escapeHtml(tableId) + '" data-order-id="' + escapeHtml(order.id) +
            '" data-item-id="' + escapeHtml(item.id) + '" data-unit-index="' + (index + 1) +
            '" data-product-name="' + name + '" aria-label="' + name + " " + (index + 1) +
            '. adet ' + (paid ? "ödendi" : "tahsilata ekle") + '">' +
          '<span class="order-product-details"><strong>' + name + '</strong><small>' +
            (index + 1) + " / " + quantity + ' adet · ' + escapeHtml(money(price)) +
          '</small></span>' +
          badge + '<strong class="order-line-total">' + escapeHtml(money(price)) + '</strong>' +
        '</label>'
      );
    }).join("");
  }

  function billLines() {
    let rowIndex = 0;
    const tableId = state.bill && state.bill.table ? state.bill.table.id : state.selectedTableId;
    return billRounds().map(function (order, orderIndex) {
      const items = Array.isArray(order.items) ? order.items : [];
      const time = order.sentAt
        ? new Date(order.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        : "";
      const products = items.map(function (item) {
        const controlId = "bill-item-" + (++rowIndex);
        return renderProductRow(item, controlId, order, 0, tableId);
      }).join("");

      return (
        '<article class="order-round">' +
          '<div class="order-round-head"><strong>Sipariş turu #' +
            escapeHtml(order.roundNumber || orderIndex + 1) +
          '</strong><span>' + escapeHtml(time) + '</span></div>' +
          products +
          '<div class="order-round-total"><span>Seçilenleri tahsil et</span><strong>' +
            escapeHtml(money(0)) +
          '</strong></div>' +
        '</article>'
      );
    }).join("");
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
    $("#collectSelectedButton").disabled = !(selectedTotal > 0) ||
      (!state.bill || state.selectedTableId == null || state.loading);
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
        if (selected) {
          selectedTotal += price;
          roundTotal += price;
        }
      });
      const roundSum = round.querySelector(".order-round-total strong");
      if (roundSum) roundSum.textContent = money(roundTotal);
    });
    $("#billTotal").textContent = money(selectedTotal);
    refreshCollectButton(selectedTotal);
    return selectedTotal;
  }

  function selectedUnitsFromUI() {
    return $$("#billDetailBody .bill-item-checkbox:checked:not(:disabled)").map(function (checkbox) {
      return {
        orderId: checkbox.dataset.orderId,
        itemId: checkbox.dataset.itemId,
        unitIndex: Number(checkbox.dataset.unitIndex) || 1,
        amount: Number(checkbox.dataset.lineTotal) || 0,
        productName: checkbox.dataset.productName || "Ürün"
      };
    });
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
      $("#billDetailBody").innerHTML =
        '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span>' +
        '<strong>Açık adisyon seçilmedi</strong><span>Açık adisyonu olan bir masa seçtiğinde ürünleri burada göreceksin.</span></div>';
      updatePaymentSummary({ total: 0, paid: 0, remaining: 0 }, true);
      $("#billTotal").textContent = money(0);
      return;
    }

    const table = bill.table || {};
    const rounds = billRounds();
    const summary = paymentOverview(rounds);
    $("#selectedTableName").textContent = table.name || "Masa";
    $("#selectedTableMeta").textContent =
      (Number(table.seats) || 0) + " kişilik masa · " + rounds.length + " sipariş turu";
    $("#selectedBillStatus").textContent = summary.remaining <= 0.001
      ? "Tahsil edildi · Adisyon açık"
      : "Adisyon açık";
    $("#selectedBillStatus").className = "bill-status " +
      (summary.remaining <= 0.001 ? "is-paid-status" : "is-open");
    $("#billDetailBody").innerHTML = billLines() ||
      '<div class="detail-placeholder"><span class="placeholder-icon"><i class="bi bi-receipt"></i></span>' +
      '<strong>Bu masada sipariş bulunamadı</strong><span>Yeni sipariş gönderildiğinde burada görünecek.</span></div>';
    updatePaymentSummary(summary, false);
    $("#billTotal").textContent = money(0);
    updateSelectedTotals();
  }

  async function loadBill(tableId) {
    state.selectedTableId = tableId;
    state.bill = null;
    state.loading = true;
    renderTables();
    $("#billDetailBody").innerHTML =
      '<div class="list-placeholder"><span class="placeholder-icon"><i class="bi bi-arrow-repeat"></i></span>' +
      '<strong>Adisyon yükleniyor</strong><span>Siparişler sunucudan alınıyor.</span></div>';

    try {
      state.bill = await api(
        "/api/cashier/tables/" + encodeURIComponent(tableId) + "/bill"
      );
      renderBill();
    } catch (error) {
      state.bill = null;
      renderBill();
      notify(error.message || "Adisyon verileri alınamadı.");
    } finally {
      state.loading = false;
      renderTables();
      renderBill();
    }
  }

  async function loadTables(preferredId) {
    state.loading = true;
    setConnection("connecting", "Bağlanıyor");
    $("#refreshButton").disabled = true;
    try {
      const payload = await api("/api/cashier/tables");
      if (!payload || !Array.isArray(payload.tables)) {
        throw new Error("Kasa API'si geçerli bir masa listesi döndürmedi.");
      }
      state.apiLoaded = true;
      state.tables = payload.tables;
      const preferred = preferredId != null ? preferredId : state.selectedTableId;
      const preferredIsOpen = preferred != null && state.tables.some(function (table) {
        return String(table.id) === String(preferred) && tableHasOpenBill(table);
      });
      if (preferredIsOpen) {
        state.selectedTableId = preferred;
      } else {
        const firstOpen = state.tables.find(tableHasOpenBill);
        state.selectedTableId = firstOpen ? firstOpen.id : null;
      }

      renderMetrics();
      renderTables();
      setConnection("connected", "Sunucuya bağlı");
      notice.hidden = true;

      if (state.selectedTableId != null) {
        await loadBill(state.selectedTableId);
      } else {
        state.bill = null;
        renderBill();
      }
    } catch (error) {
      setConnection("error", "Bağlantı yok");
      notice.hidden = false;
      notice.querySelector("strong").textContent = "Kasa servisine bağlanılamadı.";
      notice.querySelector("span").textContent = error.message || "Sunucu bağlantısını kontrol edin.";
      state.tables = [];
      state.bill = null;
      state.selectedTableId = null;
      renderMetrics();
      renderTables();
      renderBill();
    } finally {
      state.loading = false;
      $("#refreshButton").disabled = false;
      renderTables();
      renderBill();
    }
  }

  async function collectSelected() {
    if (!state.bill || state.selectedTableId == null) {
      notify("Önce açık adisyonu olan bir masa seç.");
      return;
    }
    const units = selectedUnitsFromUI();
    if (!units.length) {
      notify("Önce tahsil edilecek, ödenmemiş ürünleri seç.");
      return;
    }

    const total = units.reduce(function (sum, unit) {
      return sum + unit.amount;
    }, 0);
    if (!(total > 0)) {
      notify("Seçilen ürünler için geçerli bir tahsilat tutarı bulunamadı.");
      return;
    }

    const method = selectedPaymentMethod();
    const tableName = $("#selectedTableName").textContent.trim();
    if (!window.confirm(
      tableName + " için " + money(total) + " tutarındaki " + units.length +
      " ürün adedini " + paymentMethodLabel(method) + " olarak tahsil etmek istiyor musun?"
    )) return;

    const button = $("#collectSelectedButton");
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Tahsilat kaydediliyor...</span>';

    try {
      await api("/api/cashier/tables/" + encodeURIComponent(state.selectedTableId) + "/collect", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: method,
          items: units.map(function (unit) {
            return {
              orderId: unit.orderId,
              itemId: unit.itemId,
              unitIndex: unit.unitIndex
            };
          })
        })
      });
      await loadTables(state.selectedTableId);
      notify(money(total) + " tutarındaki tahsilat kaydedildi.");
    } catch (error) {
      notify(error.message || "Tahsilat sırasında hata oluştu.");
    } finally {
      button.innerHTML = originalMarkup;
      if (state.bill) updateSelectedTotals();
      else button.disabled = true;
    }
  }

  async function closeBill() {
    if (!state.bill || state.selectedTableId == null) {
      notify("Önce açık adisyonu olan bir masa seç.");
      return;
    }
    const summary = paymentOverview(billRounds());
    if (summary.remaining > 0.001) {
      notify("Adisyon kapatılamaz. Önce kalan " + money(summary.remaining) + " tutarındaki ürünleri tahsil et.");
      return;
    }

    const tableName = $("#selectedTableName").textContent.trim();
    if (!window.confirm("Tüm ürünler tahsil edildi. " + tableName + " adisyonunu kapatmak istiyor musun?")) return;

    const button = $("#closeBillButton");
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Adisyon kapatılıyor...</span>';

    try {
      await api("/api/cashier/tables/" + encodeURIComponent(state.selectedTableId) + "/close", {
        method: "POST",
        body: JSON.stringify({})
      });
      state.selectedTableId = null;
      state.bill = null;
      await loadTables(null);
      notify("Adisyon kapatıldı.");
    } catch (error) {
      notify(error.message || "Adisyon kapatılırken bir hata oluştu.");
    } finally {
      button.innerHTML = originalMarkup;
      if (state.bill) {
        button.disabled = paymentOverview(billRounds()).remaining > 0.001;
      } else {
        button.disabled = true;
      }
    }
  }

  $("#billTableList").addEventListener("click", function (event) {
    const button = event.target.closest("[data-table-id]");
    if (button && !button.disabled) loadBill(button.dataset.tableId);
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
    renderTables();
  });

  $$(".filter-pill").forEach(function (button) {
    button.addEventListener("click", function () {
      state.filter = button.dataset.filter === "all" ? "all" : "open";
      $$(".filter-pill").forEach(function (pill) {
        pill.classList.toggle("active", pill === button);
      });
      renderTables();
    });
  });

  $("#refreshButton").addEventListener("click", function () {
    loadTables(state.selectedTableId);
  });
  $("#collectSelectedButton").addEventListener("click", collectSelected);
  $("#closeBillButton").addEventListener("click", closeBill);

  loadTables();
});
