(function () {
  "use strict";

  var ADMIN_PHONE = "12345678910";

  function $(id) {
    return document.getElementById(id);
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

  function escapeAttr(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
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
    var root = $("adminOrdersList");
    if (!root) return;
    if (!orders.length) {
      root.innerHTML = '<p class="orders-empty">暂无订单记录。</p>';
      return;
    }
    root.innerHTML = orders
        .map(function (o) {
          var userPhone = o.userPhone || "--";
          var goodsLine = itemSummaryHtml(o.items);
          var orderNo = o.orderNo || "";
          var st = String(o.status || "待发货");
          var statusClass = "order-status";
          if (st === "已完成") statusClass += " order-status--completed";
          var shipBtn =
              st === "已完成"
                  ? ""
                  : '<button type="button" class="btn btn-primary btn-sm admin-order-ship" data-order-no="' +
                    escapeAttr(orderNo) +
                    '">发货</button>';
          return (
            '<article class="order-card">' +
            '<div class="order-row"><strong>下单用户</strong><span>' +
            escapeHtml(userPhone) +
            "</span></div>" +
            '<div class="order-row"><strong>订单号</strong><span>' +
            escapeHtml(orderNo || "--") +
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
            escapeHtml(st || "待处理") +
            "</span></div>" +
            '<div class="order-row"><strong>订单金额</strong><span class="order-total">¥' +
            Number(o.total || 0).toFixed(2) +
            "</span></div>" +
            '<div class="order-row order-row--actions">' +
            shipBtn +
            '<button type="button" class="btn btn-ghost btn-sm admin-order-delete" data-order-no="' +
            escapeAttr(orderNo) +
            '">删除订单</button>' +
            "</div>" +
            "</article>"
          );
        })
        .join("");
  }

  function bindListActions() {
    var root = $("adminOrdersList");
    if (!root || root.getAttribute("data-zyy-admin-actions") === "1") return;
    root.setAttribute("data-zyy-admin-actions", "1");
    root.addEventListener("click", function (e) {
      var shipBtn = e.target && e.target.closest ? e.target.closest(".admin-order-ship") : null;
      if (shipBtn && root.contains(shipBtn)) {
        var orderNoShip = shipBtn.getAttribute("data-order-no");
        if (!orderNoShip) return;
        if (!window.ZYYUserData || typeof window.ZYYUserData.shipAdminOrder !== "function") return;
        shipBtn.disabled = true;
        window.ZYYUserData
            .shipAdminOrder(orderNoShip)
            .then(function (ok) {
              shipBtn.disabled = false;
              if (!ok) {
                window.alert("发货失败，请稍后重试。");
                return;
              }
              return window.ZYYUserData.loadAdminOrders();
            })
            .then(function (orders) {
              if (!Array.isArray(orders)) return;
              renderOrdersList(orders);
            });
        return;
      }

      var btn = e.target && e.target.closest ? e.target.closest(".admin-order-delete") : null;
      if (!btn || !root.contains(btn)) return;
      var orderNo = btn.getAttribute("data-order-no");
      if (!orderNo) return;
      if (!window.confirm("确定删除该订单？删除后不可恢复。")) return;
      if (!window.ZYYUserData || typeof window.ZYYUserData.deleteAdminOrder !== "function") return;
      btn.disabled = true;
      window.ZYYUserData
          .deleteAdminOrder(orderNo)
          .then(function (ok) {
            btn.disabled = false;
            if (!ok) {
              window.alert("删除失败，请稍后重试。");
              return;
            }
            return window.ZYYUserData.loadAdminOrders();
          })
          .then(function (orders) {
            if (!Array.isArray(orders)) return;
            renderOrdersList(orders);
          });
    });
  }

  function boot() {
    bindListActions();
    if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
      window.location.replace("login?redirect=" + encodeURIComponent("admin-orders"));
      return;
    }
    if (!window.ZYYUserData || typeof window.ZYYUserData.loadAdminOrders !== "function") {
      var el = $("adminOrdersList");
      if (el) el.innerHTML = '<p class="orders-empty">无法加载订单接口。</p>';
      return;
    }
    window.ZYYAuth
        .fetchMe()
        .then(function (data) {
          if (!data || !data.user) {
            window.location.replace("login?redirect=" + encodeURIComponent("admin-orders"));
            return;
          }
          try {
            localStorage.setItem("zyyCurrentUser", JSON.stringify(data.user));
          } catch (e) {}
          if (window.ZYYAuth && typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
            window.ZYYAuth.clearStaleProfileExtraIfNeeded(data.user);
          }
          if (typeof window.ZYYRefreshNavUser === "function") {
            window.ZYYRefreshNavUser();
          }
          if (String(data.user.phone || "") !== ADMIN_PHONE) {
            window.location.replace("/");
            return;
          }
          return window.ZYYUserData.loadAdminOrders();
        })
        .then(function (orders) {
          if (!Array.isArray(orders)) return;
          renderOrdersList(orders);
        })
        .catch(function () {
          window.location.replace("login?redirect=" + encodeURIComponent("admin-orders"));
        });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
