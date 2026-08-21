(function () {
  "use strict";

  var ORDERS_STORAGE_KEY = "zyyOrders";

  function $(id) {
    return document.getElementById(id);
  }

  function sanitizeCartItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(function (x, idx) {
        if (!x || typeof x !== "object") return null;
        var price = Number(x.price);
        var id = x.id != null ? String(x.id) : "";
        var name = x.name != null ? String(x.name) : "";
        var uid = x.uid != null ? String(x.uid) : id + "-" + idx;
        var image = x.image != null ? String(x.image) : "";
        if (!id || !name || !isFinite(price) || !uid) return null;
        return { uid: uid, id: id, name: name, price: price, image: image };
      })
      .filter(Boolean);
  }

  function saveCart(cart) {
    cart = cart || [];
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.saveCartDebounced) {
      window.ZYYUserData.saveCartDebounced(cart);
    }
  }

  function loginRedirectForCartPage() {
    return "login?redirect=" + encodeURIComponent("cart-detail");
  }

  function saveOrder(order) {
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.createOrder) {
      return window.ZYYUserData.createOrder(order);
    }
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(ORDERS_STORAGE_KEY) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    list.unshift(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
    return Promise.resolve(true);
  }

  function openModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("shop-modal-open");
  }

  function closeModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.hidden = true;
    var hasOpen = Array.prototype.some.call(document.querySelectorAll(".shop-modal"), function (el) {
      return el && !el.hidden;
    });
    if (!hasOpen) document.body.classList.remove("shop-modal-open");
  }

  var state = {
    cart: [],
    selectedUids: new Set(),
    pendingItems: [],
    pendingOrderNo: "",
    selectionInitialized: false,
  };

  var cartEmptyEl = $("cartDetailEmpty");
  var cartPanelEl = $("cartDetailPanel");
  var cartItemsListEl = $("cartItemsList");
  var cartSelectAllEl = $("cartSelectAll");
  var cartSelectedCountEl = $("cartSelectedCount");
  var cartSelectedTotalEl = $("cartSelectedTotal");
  var cartRemoveSelectedBtn = $("cartRemoveSelected");
  var cartClearAllBtn = $("cartClearAll");
  var cartPaySelectedBtn = $("cartPaySelected");

  var payModalOrderInfo = $("payOrderInfo");
  var payAmountEl = $("payAmount");
  var payConfirmBtn = $("payConfirm");

  function formatMoney(n) {
    var x = Number(n) || 0;
    return x.toFixed(2);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getSelectedItems() {
    return state.cart.filter(function (i) {
      return state.selectedUids.has(i.uid);
    });
  }

  function syncSelectedToUI() {
    var selectedItems = getSelectedItems();
    var count = selectedItems.length;
    var total = selectedItems.reduce(function (s, i) {
      return s + i.price;
    }, 0);

    cartSelectedCountEl && (cartSelectedCountEl.textContent = String(count));
    cartSelectedTotalEl && (cartSelectedTotalEl.textContent = formatMoney(total));

    if (cartPaySelectedBtn) cartPaySelectedBtn.disabled = count === 0;
    if (cartSelectAllEl) {
      cartSelectAllEl.checked = count > 0 && count === state.cart.length;
    }
  }

  function renderList() {
    if (!cartItemsListEl) return;

    // 首次进入页面时默认全选；后续如果用户清空选择，则保持“未选择”状态。
    if (!state.selectionInitialized && state.cart.length) {
      state.cart.forEach(function (i) {
        state.selectedUids.add(i.uid);
      });
    } else if (state.selectedUids.size) {
      // 移除商品/刷新后，只保留仍存在的 uid
      var next = new Set();
      state.cart.forEach(function (i) {
        if (state.selectedUids.has(i.uid)) next.add(i.uid);
      });
      state.selectedUids = next;
    }
    state.selectionInitialized = true;

    var hasCart = state.cart.length > 0;
    if (!hasCart) {
      if (cartEmptyEl) {
        if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
          cartEmptyEl.innerHTML =
              '<p>请先登录后使用购物车（不再保存在本机）。</p>' +
              '<p><a class="btn btn-primary btn-sm" href="' +
              loginRedirectForCartPage() +
              '">去登录</a> ' +
              '<a class="btn btn-ghost btn-sm" href="shop">去选购</a></p>';
        } else {
          cartEmptyEl.innerHTML =
              '<p>购物车为空。</p><a class="btn btn-primary btn-sm" href="shop">去选购</a>';
        }
        cartEmptyEl.hidden = false;
      }
      if (cartPanelEl) cartPanelEl.hidden = true;
      cartItemsListEl.innerHTML = "";
      syncSelectedToUI();
      return;
    }

    if (cartEmptyEl) cartEmptyEl.hidden = true;
    if (cartPanelEl) cartPanelEl.hidden = false;

    cartItemsListEl.innerHTML = state.cart
      .map(function (item) {
        var checked = state.selectedUids.has(item.uid) ? "checked" : "";
        var img = item.image;
        if ((!img || img === "") && window.ZYYShop && typeof window.ZYYShop.getProductById === "function") {
          var prod = window.ZYYShop.getProductById(item.id);
          if (prod && prod.image) img = prod.image;
        }
        if (!img) img = "assets/logo.jpg";
        var safeImg = String(img).replace(/'/g, "%27");
        return (
          '<article class="cart-item-card" data-uid="' +
          item.uid +
          '">' +
          '<label class="cart-item-checkWrap" aria-label="选择商品">' +
          '<input type="checkbox" class="cart-item-check" data-uid="' +
          item.uid +
          '" ' +
          checked +
          " />" +
          "</label>" +
          '<div class="cart-item-media" style="background-image:url(\'' +
          safeImg +
          '\')"></div>' +
          '<div class="cart-item-body">' +
          '<div class="cart-item-topRow">' +
          '<div class="cart-item-title">' +
          escapeHtml(item.name) +
          "</div>" +
          '<button type="button" class="btn btn-ghost btn-sm cart-item-remove" data-uid="' +
          item.uid +
          '">移除</button>' +
          "</div>" +
          '<div class="cart-item-price">¥' + formatMoney(item.price) + "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");

    Array.prototype.forEach.call(document.querySelectorAll(".cart-item-check"), function (cb) {
      cb.addEventListener("change", function (e) {
        var uid = e.target && e.target.getAttribute ? e.target.getAttribute("data-uid") : "";
        var on = !!e.target.checked;
        if (!uid) return;
        if (on) state.selectedUids.add(uid);
        else state.selectedUids.delete(uid);
        syncSelectedToUI();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll(".cart-item-remove"), function (btn) {
      btn.addEventListener("click", function () {
        var uid = btn.getAttribute("data-uid");
        if (!uid) return;
        state.cart = state.cart.filter(function (i) {
          return i.uid !== uid;
        });
        state.selectedUids.delete(uid);
        saveCart(state.cart);
        renderList();
      });
    });
  }

  function removeSelected() {
    var selectedItems = getSelectedItems();
    if (!selectedItems.length) return;
    var selectedUids = new Set(selectedItems.map(function (i) { return i.uid; }));
    state.cart = state.cart.filter(function (i) {
      return !selectedUids.has(i.uid);
    });
    state.selectedUids = new Set();
    saveCart(state.cart);
    renderList();
  }

  function clearCart() {
    if (!state.cart.length) return;
    if (!window.confirm("确认清空购物车吗？")) return;
    state.cart = [];
    state.selectedUids = new Set();
    saveCart(state.cart);
    renderList();
  }

  function selectAll(on) {
    state.selectedUids = new Set();
    if (on) state.cart.forEach(function (i) { state.selectedUids.add(i.uid); });
    syncSelectedToUI();
    renderList();
  }

  function showPayModalForSelected() {
    if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
      window.alert("请先登录后再支付。");
      window.location.href = loginRedirectForCartPage();
      return;
    }
    var items = getSelectedItems();
    if (!items.length) {
      window.alert("请先选择要支付的商品。");
      return;
    }
    var total = items.reduce(function (s, i) { return s + i.price; }, 0);
    var orderNo = "NY" + String(Date.now()).slice(-8);
    var top = items[0];

    state.pendingItems = items.slice();
    state.pendingOrderNo = orderNo;

    if (payAmountEl) payAmountEl.textContent = "¥" + formatMoney(total);
    if (payModalOrderInfo) {
      payModalOrderInfo.innerHTML =
        "<p>订单号：" + orderNo + "</p>" +
        "<p>商品：" + top.name + (items.length > 1 ? " 等" + items.length + "件" : " x1") + "</p>";
    }

    openModal("payModal");
  }

  function showPaySuccessModal() {
    var remain = 3;
    var countdownEl = $("paySuccessCountdown");
    var successModal = $("paySuccessModal");
    if (successModal) successModal.hidden = false;
    if (countdownEl) countdownEl.textContent = remain + " 秒后自动关闭";

    var timer = window.setInterval(function () {
      remain -= 1;
      if (countdownEl) countdownEl.textContent = remain + " 秒后自动关闭";
      if (remain <= 0) {
        window.clearInterval(timer);
        closeModal("paySuccessModal");
      }
    }, 1000);
  }

  // 事件绑定（延后到 DOMReady，避免元素不存在）
  function bindEvents() {
    if (cartSelectAllEl) {
      cartSelectAllEl.addEventListener("change", function (e) {
        selectAll(!!e.target.checked);
      });
    }

    if (cartRemoveSelectedBtn) {
      cartRemoveSelectedBtn.addEventListener("click", function () {
        removeSelected();
      });
    }

    if (cartClearAllBtn) {
      cartClearAllBtn.addEventListener("click", function () {
        clearCart();
      });
    }

    if (cartPaySelectedBtn) {
      cartPaySelectedBtn.addEventListener("click", function () {
        showPayModalForSelected();
      });
    }

    if (payConfirmBtn) {
      payConfirmBtn.addEventListener("click", function () {
        if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
          window.alert("请先登录后再支付。");
          window.location.href = loginRedirectForCartPage();
          return;
        }
        if (!state.pendingItems || !state.pendingItems.length) return;

        var total = state.pendingItems.reduce(function (s, i) { return s + i.price; }, 0);
        var order = {
          orderNo: state.pendingOrderNo || ("NY" + String(Date.now()).slice(-8)),
          createdAt: new Date().toISOString(),
          status: "待发货",
          items: state.pendingItems.slice(),
          count: state.pendingItems.length,
          total: total,
        };

        payConfirmBtn.disabled = true;
        saveOrder(order).then(function (ok) {
          payConfirmBtn.disabled = false;
          if (!ok) {
            window.alert("订单未能写入数据库，请检查网络或稍后再试。购物车已保留。");
            return;
          }
          closeModal("payModal");

          state.cart = [];
          state.selectedUids = new Set();
          state.pendingItems = [];
          saveCart(state.cart);
          if (window.ZYYUserData && window.ZYYUserData.saveCartNow) {
            window.ZYYUserData.saveCartNow([]);
          }

          renderList();
          showPaySuccessModal();
        });
      });
    }

    document.querySelectorAll(".shop-modal-mask").forEach(function (mask) {
      mask.addEventListener("click", function () {
        var id = mask.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });

    var payCancelBtn = $("payCancel");
    if (payCancelBtn) {
      payCancelBtn.addEventListener("click", function () {
        closeModal("payModal");
      });
    }
  }

  function boot() {
    bindEvents();
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.loadCart) {
      window.ZYYUserData
          .importLegacyOnce()
          .then(function () {
            return window.ZYYUserData.loadCart();
          })
          .then(function (items) {
            state.cart = sanitizeCartItems(items);
            renderList();
            syncSelectedToUI();
          })
          .catch(function () {
            state.cart = [];
            renderList();
            syncSelectedToUI();
          });
    } else {
      try {
        localStorage.removeItem("zyyCart");
      } catch (e0) {}
      state.cart = [];
      renderList();
      syncSelectedToUI();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

