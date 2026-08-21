(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRows(rows) {
    var body = document.getElementById("bookingLinksBody");
    if (!body) return;
    if (!Array.isArray(rows) || !rows.length) {
      body.innerHTML = '<tr><td colspan="5">暂无配置。</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map(function (row) {
        var url = String(row.bookingUrl || "").trim();
        var urlHtml = url
          ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + "</a>"
          : '<span class="booking-config-empty">待填写</span>';
        return (
          "<tr>" +
          "<td><code>" +
          escapeHtml(row.destinationId) +
          "</code></td>" +
          "<td>" +
          escapeHtml(row.district) +
          "</td>" +
          "<td>" +
          escapeHtml(row.platform || "-") +
          "</td>" +
          "<td>" +
          urlHtml +
          "</td>" +
          "<td>" +
          escapeHtml(row.note || "") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  fetch("data/district-booking-links.json", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(renderRows)
    .catch(function () {
      var body = document.getElementById("bookingLinksBody");
      if (body) body.innerHTML = '<tr><td colspan="5">读取配置失败，请检查 JSON 格式。</td></tr>';
    });
})();
