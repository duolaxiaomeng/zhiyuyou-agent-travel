(function () {
  "use strict";

  var TOKEN_KEY = "zyyToken";
  var pageName = window.location.pathname.split("/").pop() || "planner";
  var redirectTarget = "login?redirect=" + encodeURIComponent(pageName);

  function fail() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("zyyCurrentUser");
    } catch (e) {}
    window.location.replace(redirectTarget);
  }

  var token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    token = null;
  }

  if (!token) {
    window.location.replace(redirectTarget);
    return;
  }

  document.documentElement.classList.add("auth-guard-pending");

  fetch("/api/me", {
    headers: { Authorization: "Bearer " + token },
    credentials: "same-origin",
  })
    .then(function (r) {
      if (!r.ok) throw new Error("unauthorized");
      return r.text().then(function (text) {
        try {
          return text ? JSON.parse(text) : null;
        } catch (e) {
          throw new Error("unauthorized");
        }
      });
    })
    .then(function (data) {
      if (data && data.user) {
        try {
          var prev = null;
          try {
            prev = JSON.parse(localStorage.getItem("zyyCurrentUser") || "null");
          } catch (e2) {
            prev = null;
          }
          var merged =
              prev && typeof prev === "object"
                  ? Object.assign({}, prev, data.user)
                  : data.user;
          localStorage.setItem("zyyCurrentUser", JSON.stringify(merged));
          if (window.ZYYAuth && typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
            window.ZYYAuth.clearStaleProfileExtraIfNeeded();
          }
        } catch (e) {}
      }
      document.documentElement.classList.remove("auth-guard-pending");
    })
    .catch(function () {
      fail();
    });
})();

