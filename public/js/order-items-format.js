(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
  }

  /**
   * 将订单行项目按商品 id（无 id 则按名称）合并数量；
   * 单行若含 quantity / qty 且为有效正整数则计入，否则按 1 件计。
   */
  function aggregateOrderItems(items) {
    if (!Array.isArray(items) || !items.length) return [];
    var byKey = {};
    items.forEach(function (it) {
      if (!it || typeof it !== "object") return;
      var id = it.id != null ? String(it.id).trim() : "";
      var name = it.name != null ? String(it.name).trim() : "";
      if (!name) name = "商品";
      var rawQ = it.quantity != null ? it.quantity : it.qty;
      var q = Math.floor(Number(rawQ));
      if (!isFinite(q) || q < 1) q = 1;
      var key = id || name;
      if (!byKey[key]) byKey[key] = { name: name, qty: 0 };
      byKey[key].name = name;
      byKey[key].qty += q;
    });
    return Object.keys(byKey).map(function (k) {
      return byKey[k];
    });
  }

  /** 纯文本摘要，如：鱼泉榨菜 2件 土沱麻饼 4件 */
  function formatPlainSummary(items) {
    var rows = aggregateOrderItems(items);
    if (!rows.length) return "—";
    return rows
        .map(function (r) {
          return r.name + " " + r.qty + "件";
        })
        .join(" ");
  }

  global.ZYYOrderItemsFormat = {
    escapeHtml: escapeHtml,
    aggregateOrderItems: aggregateOrderItems,
    formatPlainSummary: formatPlainSummary,
  };
})(typeof window !== "undefined" ? window : global);
