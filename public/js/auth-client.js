(function (global) {
  "use strict";

  var TOKEN_KEY = "zyyToken";
  var USER_KEY = "zyyCurrentUser";
  /** 与 profile.js、main.js 一致；按手机号区分账号，勿与其它键混用 */
  var PROFILE_EXTRA_KEY = "zyyUserProfileExtra";

  /**
   * 判断本地扩展资料是否属于当前登录用户。
   * 同机切换账号时，上一份账号的 extra 仍留在 localStorage，会导致个人主页/导航栏串号。
   */
  function profileExtraBelongsToUser(user, extra) {
    if (!user || !user.phone) return true;
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return true;
    var ep = String(extra.phone || "").trim();
    if (!ep) return true;
    return String(user.phone).trim() === ep;
  }

  /**
   * 若本地 zyyUserProfileExtra 中的 phone 与当前登录用户不一致，则清除，避免串号。
   * @param {object} [optionalUser] 若尚未写入 localStorage（如 fetchMe 首次恢复会话），可传入接口返回的 user
   */
  function clearStaleProfileExtraIfNeeded(optionalUser) {
    var user = optionalUser && optionalUser.phone ? optionalUser : getStoredUser();
    if (!user || !user.phone) return;
    var up = String(user.phone).trim();
    try {
      var raw = localStorage.getItem(PROFILE_EXTRA_KEY);
      var extra = raw ? JSON.parse(raw) : {};
      if (!extra || typeof extra !== "object" || Array.isArray(extra)) return;
      var ep = String(extra.phone || "").trim();
      if (ep && ep !== up) {
        localStorage.removeItem(PROFILE_EXTRA_KEY);
        if (global.ZYYProfileExtraCache && typeof global.ZYYProfileExtraCache === "object") {
          global.ZYYProfileExtraCache = {};
        }
      }
    } catch (e) {}
  }

  function apiUrl(path) {
    if (path.charAt(0) !== "/") path = "/" + path;
    return path;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setSession(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getStoredUser() {
    var raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function fetchMe() {
    var token = getToken();
    if (!token) return Promise.resolve(null);
    return fetch(apiUrl("/api/me"), {
      headers: { Authorization: "Bearer " + token },
      credentials: "same-origin",
    }).then(function (r) {
      if (!r.ok) {
        clearSession();
        return null;
      }
      return r.text().then(function (text) {
        try {
          return text ? JSON.parse(text) : null;
        } catch (e) {
          clearSession();
          return null;
        }
      });
    });
  }

  function authFetch(path, init) {
    init = init || {};
    init.headers = init.headers || {};
    var t = getToken();
    if (t) init.headers["Authorization"] = "Bearer " + t;
    if (init.body && typeof init.body === "object" && !(init.body instanceof FormData)) {
      if (!init.headers["Content-Type"]) init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(init.body);
    }
    init.credentials = init.credentials || "same-origin";
    return fetch(apiUrl(path), init);
  }

  global.ZYYAuth = {
    TOKEN_KEY: TOKEN_KEY,
    USER_KEY: USER_KEY,
    PROFILE_EXTRA_KEY: PROFILE_EXTRA_KEY,
    apiUrl: apiUrl,
    getToken: getToken,
    setSession: setSession,
    clearSession: clearSession,
    getStoredUser: getStoredUser,
    fetchMe: fetchMe,
    authFetch: authFetch,
    profileExtraBelongsToUser: profileExtraBelongsToUser,
    clearStaleProfileExtraIfNeeded: clearStaleProfileExtraIfNeeded,
  };
})(typeof window !== "undefined" ? window : global);
