(function () {
  "use strict";

  function getRedirectTarget() {
    var params = new URLSearchParams(window.location.search);
    var r = params.get("redirect");
    if (r && /^[a-zA-Z0-9._-]+\.html$/.test(r)) return r;
    return "/";
  }

  function apiJson(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (parseErr) {
            var hint =
              "接口未返回 JSON（常见原因：未用 Node 启动站点）。请在项目目录执行 npm start 或 node server.js，然后用浏览器打开 http://localhost:3000 下的页面再登录。";
            if (text.indexOf("<!DOCTYPE") !== -1 || text.indexOf("<!doctype") !== -1) {
              hint +=
                " 当前响应是网页而不是接口，多半说明 /api/login 没有由 server.js 提供。";
            }
            throw new Error(hint);
          }
        }
        if (!r.ok) {
          var err = new Error((data && data.error) || "请求失败");
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function saveSession(data) {
    if (window.ZYYAuth && typeof window.ZYYAuth.setSession === "function") {
      window.ZYYAuth.setSession(data.token, data.user);
    } else {
      localStorage.setItem("zyyToken", data.token);
      localStorage.setItem("zyyCurrentUser", JSON.stringify(data.user));
    }
    if (window.ZYYAuth && typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
      window.ZYYAuth.clearStaleProfileExtraIfNeeded();
    }
  }

  var registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var username = document.getElementById("regUsername").value.trim();
      var phone = document.getElementById("regPhone").value.trim();
      var password = document.getElementById("regPassword").value;
      var msg = document.getElementById("registerMsg");

      if (!username || !phone || !password) {
        msg.textContent = "请完整填写注册信息。";
        return;
      }
      if (password.length < 6) {
        msg.textContent = "密码至少 6 位。";
        return;
      }

      msg.textContent = "提交中…";
      apiJson("/api/register", { username: username, phone: phone, password: password })
        .then(function (data) {
          saveSession(data);
          msg.textContent = "注册成功，正在跳转…";
          setTimeout(function () {
            window.location.href = getRedirectTarget();
          }, 500);
        })
        .catch(function (err) {
          msg.textContent = err.message || "注册失败";
        });
    });
  }

  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = document.getElementById("loginPhone").value.trim();
      var password = document.getElementById("loginPassword").value;
      var msg = document.getElementById("loginMsg");

      if (!/^\d{11}$/.test(phone)) {
        msg.textContent = "请输入 11 位手机号。";
        return;
      }

      msg.textContent = "登录中…";
      if (!password) {
        msg.textContent = "请填写密码。";
        return;
      }

      apiJson("/api/login", { phone: phone, password: password })
        .then(function (data) {
          saveSession(data);
          msg.textContent = "登录成功，正在跳转…";
          setTimeout(function () {
            window.location.href = getRedirectTarget();
          }, 500);
        })
        .catch(function (err) {
          msg.textContent = err.message || "登录失败";
        });
    });
  }

  (function syncAuthLinks() {
    var qs = window.location.search;
    if (!qs) return;
    var lr = document.getElementById("linkToRegister");
    if (lr) lr.setAttribute("href", "register" + qs);
    var ll = document.getElementById("linkToLogin");
    if (ll) ll.setAttribute("href", "login" + qs);
  })();
})();
