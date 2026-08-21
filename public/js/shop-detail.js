(function () {
  "use strict";

  var FAV_KEY = "zyyShopFavorites";

  var SPEC_OPTIONS = [
    { id: "s1", label: "500g 装", add: 0 },
    { id: "s2", label: "1kg 装", add: 22 },
    { id: "s3", label: "礼盒装", add: 45 },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function getQueryId() {
    var q = new URLSearchParams(window.location.search).get("id");
    return q ? String(q).trim() : "";
  }

  function readFavorites() {
    try {
      var a = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function writeFavorites(arr) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function setModalOpen(id, open) {
    var modal = $(id);
    if (!modal) return;
    modal.hidden = !open;
    var any = Array.prototype.some.call(document.querySelectorAll(".shop-modal"), function (el) {
      return !el.hidden;
    });
    document.body.classList.toggle("shop-modal-open", any);
  }

  function syncFavoriteButton(btn, productId, on) {
    if (!btn) return;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "已收藏（点击取消）" : "收藏";
  }

  function boot() {
    var root = $("productDetailRoot");
    var empty = $("productDetailEmpty");
    if (!root || !empty) return;

    var shop = window.ZYYShop;
    if (!shop || typeof shop.getProductById !== "function") {
      root.hidden = true;
      empty.hidden = false;
      var pe = empty.querySelector("p");
      if (pe) pe.textContent = "页面加载异常，请返回重试。";
      return;
    }

    var id = getQueryId();
    var prod = id ? shop.getProductById(id) : null;

    if (!prod) {
      root.hidden = true;
      empty.hidden = false;
      return;
    }

    root.hidden = false;
    empty.hidden = true;

    var selectedSpec = SPEC_OPTIONS[0];
    var productId = prod.id;

    function currentPrice() {
      return prod.price + selectedSpec.add;
    }

    function updatePriceUi() {
      var el = $("productDetailPrice");
      if (el) el.textContent = "¥" + currentPrice();
    }

    $("productDetailCrumb").textContent = prod.name;
    document.title = "智渝游 · " + prod.name;
    var img = $("productDetailImg");
    if (img) {
      img.src = prod.image;
      img.alt = prod.name;
    }
    $("productDetailTitle").textContent = prod.name;
    $("productDetailSub").textContent = prod.meta || "重庆优质农特产品，产地可追溯。";
    updatePriceUi();

    var specsRoot = $("productDetailSpecs");
    if (specsRoot) {
      specsRoot.innerHTML = SPEC_OPTIONS.map(function (opt, idx) {
        var active = idx === 0 ? " is-active" : "";
        return (
          '<button type="button" class="product-detail-spec' +
          active +
          '" role="radio" aria-checked="' +
          (idx === 0 ? "true" : "false") +
          '" data-spec-id="' +
          escapeHtml(opt.id) +
          '">' +
          escapeHtml(opt.label) +
          " · ¥" +
          (prod.price + opt.add) +
          "</button>"
        );
      }).join("");

      specsRoot.querySelectorAll(".product-detail-spec").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sid = btn.getAttribute("data-spec-id");
          var opt = SPEC_OPTIONS.find(function (o) {
            return o.id === sid;
          });
          if (!opt) return;
          selectedSpec = opt;
          specsRoot.querySelectorAll(".product-detail-spec").forEach(function (b) {
            var on = b.getAttribute("data-spec-id") === sid;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-checked", on ? "true" : "false");
          });
          updatePriceUi();
        });
      });
    }

    var rich = $("productDetailRich");
    if (rich) {
      rich.innerHTML =
        '<p class="product-detail-lead">' +
        escapeHtml(prod.meta) +
        "</p>" +
        '<figure class="product-detail-figure">' +
        '<img src="' +
        escapeHtml(prod.image) +
        '" alt="' +
        escapeHtml(prod.name) +
        '" loading="lazy" />' +
        "<figcaption>实物拍摄，因光线与批次差异，以收到商品为准。</figcaption>" +
        "</figure>" +
        "<p>本商品由平台合作农户/合作社供货，下单后 1–3 个工作日内安排发货（偏远地区可能顺延）。如对包装或品质有疑问，请先通过「联系商家」沟通。</p>";
    }

    var params = $("productDetailParams");
    if (params && prod.trace) {
      var t = prod.trace;
      params.innerHTML =
        "<dt>产地</dt><dd>重庆 · " +
        escapeHtml(t.origin) +
        "</dd>" +
        "<dt>采摘/生产</dt><dd>" +
        escapeHtml(t.harvestDate) +
        "</dd>" +
        "<dt>包装日期</dt><dd>" +
        escapeHtml(t.packDate) +
        "</dd>" +
        "<dt>溯源码</dt><dd>" +
        escapeHtml(t.traceCode) +
        "</dd>" +
        "<dt>商品编号</dt><dd>" +
        escapeHtml(prod.id) +
        "</dd>";
    }

    var favBtn = $("productFav");
    var favs = readFavorites();
    var isFav = favs.indexOf(productId) !== -1;
    syncFavoriteButton(favBtn, productId, isFav);

    if (favBtn) {
      favBtn.addEventListener("click", function () {
        var list = readFavorites();
        var i = list.indexOf(productId);
        if (i === -1) {
          list.push(productId);
          syncFavoriteButton(favBtn, productId, true);
        } else {
          list.splice(i, 1);
          syncFavoriteButton(favBtn, productId, false);
        }
        writeFavorites(list);
      });
    }

    var contactBtn = $("productContactBtn");
    if (contactBtn) {
      contactBtn.addEventListener("click", function () {
        setModalOpen("contactModal", true);
      });
    }
    var contactClose = $("contactModalClose");
    if (contactClose) {
      contactClose.addEventListener("click", function () {
        setModalOpen("contactModal", false);
      });
    }

    var traceBtn = $("productTraceBtn");
    if (traceBtn) {
      traceBtn.addEventListener("click", function () {
        if (shop.openTraceModal) shop.openTraceModal(prod);
      });
    }

    function addCurrentToCart() {
      shop.addToCart(prod, { specLabel: selectedSpec.label, price: currentPrice() });
    }

    var addCartBtn = $("productAddCart");
    if (addCartBtn) {
      addCartBtn.addEventListener("click", function () {
        addCurrentToCart();
      });
    }

    var buyBtn = $("productBuyNow");
    if (buyBtn) {
      buyBtn.addEventListener("click", function () {
        addCurrentToCart();
        if (shop.triggerCheckout) shop.triggerCheckout();
      });
    }

    var tabBtns = document.querySelectorAll(".product-detail-tab");
    var panelDetail = $("panelDetail");
    var panelParams = $("panelParams");
    tabBtns.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var pid = tab.getAttribute("data-panel");
        tabBtns.forEach(function (t) {
          var on = t.getAttribute("data-panel") === pid;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        if (panelDetail) {
          var showD = pid === "panelDetail";
          panelDetail.hidden = !showD;
          panelDetail.classList.toggle("is-active", showD);
        }
        if (panelParams) {
          var showP = pid === "panelParams";
          panelParams.hidden = !showP;
          panelParams.classList.toggle("is-active", showP);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
