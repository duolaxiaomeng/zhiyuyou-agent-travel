(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function readOrdersLocal() {
    try {
      var list = JSON.parse(localStorage.getItem("zyyOrders") || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function formatTime(iso) {
    if (!iso) return "--";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "--";
    return d.toLocaleString("zh-CN");
  }

  function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
  }

  function itemSummaryHtml(items) {
    var F = window.ZYYOrderItemsFormat;
    if (F && typeof F.formatPlainSummary === "function" && typeof F.escapeHtml === "function") {
      return F.escapeHtml(F.formatPlainSummary(items));
    }
    var first = items && items[0] ? items[0].name : "商品";
    var count = items ? items.length : 0;
    return escapeHtml(first + (count > 1 ? " 等" + count + "件" : ""));
  }

  function renderOrdersList(orders) {
    var root = $("ordersList");
    if (!root) return;
    if (!orders.length) {
      root.innerHTML = '<p class="orders-empty">暂无订单，去农产品直购页面挑选好物吧。</p>';
      return;
    }
    root.innerHTML = orders
        .map(function (o) {
          var goodsLine = itemSummaryHtml(o.items);
          var st = String(o.status || "待处理");
          var statusClass = "order-status";
          if (st === "已完成") statusClass += " order-status--completed";
          return (
            '<article class="order-card">' +
            '<div class="order-row"><strong>订单号</strong><span>' +
            escapeHtml(o.orderNo || "--") +
            "</span></div>" +
            '<div class="order-row order-row--goods"><strong>商品</strong><span class="order-goods-detail">' +
            goodsLine +
            "</span></div>" +
            '<div class="order-row"><strong>下单时间</strong><span>' +
            formatTime(o.createdAt) +
            "</span></div>" +
            '<div class="order-row"><strong>订单状态</strong><span class="' +
            statusClass +
            '">' +
            escapeHtml(st) +
            "</span></div>" +
            '<div class="order-row"><strong>订单金额</strong><span class="order-total">¥' +
            Number(o.total || 0).toFixed(2) +
            "</span></div>" +
            "</article>"
          );
        })
        .join("");
  }

  function renderOrders() {
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.loadOrders) {
      window.ZYYUserData
          .importLegacyOnce()
          .then(function () {
            return window.ZYYUserData.loadOrders();
          })
          .then(renderOrdersList)
          .catch(function () {
            renderOrdersList(readOrdersLocal());
          });
    } else {
      renderOrdersList(readOrdersLocal());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderOrders);
  } else {
    renderOrders();
  }
})();
