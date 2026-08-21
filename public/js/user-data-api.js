(function (global) {
  "use strict";

  var A = global.ZYYAuth;
  if (!A || typeof A.authFetch !== "function") return;

  var IMPORT_FLAG = "zyyServerUserDataImported";

  function jsonOrEmpty(r) {
    return r.text().then(function (t) {
      try {
        return t ? JSON.parse(t) : {};
      } catch (e) {
        return {};
      }
    });
  }

  function refreshCommunityPosts() {
    return fetch(A.apiUrl("/api/community/user-posts"), { credentials: "same-origin" })
        .then(function (r) {
          return r.ok ? r.json() : { posts: [] };
        })
        .then(function (d) {
          var posts = d.posts || [];
          if (global.ZYYCommunityData && typeof global.ZYYCommunityData.setUserPostsCache === "function") {
            global.ZYYCommunityData.setUserPostsCache(posts);
          }
          try {
            global.dispatchEvent(new CustomEvent("zyy-community-posts-updated"));
          } catch (e) {}
          return posts;
        })
        .catch(function () {
          return [];
        });
  }

  function getCommunityPostById(id) {
    return fetch(
        A.apiUrl("/api/community/posts/" + encodeURIComponent(id)),
        { credentials: "same-origin" }
    ).then(function (r) {
      if (!r.ok) return null;
      return r.json().then(function (d) {
        return d.post || null;
      });
    });
  }

  function importLegacyOnce() {
    if (!A.getToken()) return Promise.resolve({ skipped: true });
    try {
      if (global.localStorage.getItem(IMPORT_FLAG) === "1") {
        return Promise.resolve({ skipped: true });
      }
    } catch (e) {
      return Promise.resolve({ skipped: true });
    }
    var payload = {};
    try {
      var cart = JSON.parse(global.localStorage.getItem("zyyCart") || "[]");
      if (Array.isArray(cart) && cart.length) payload.cart = cart;
    } catch (e) {}
    try {
      var orders = JSON.parse(global.localStorage.getItem("zyyOrders") || "[]");
      if (Array.isArray(orders) && orders.length) payload.orders = orders;
    } catch (e) {}
    try {
      var posts = JSON.parse(global.localStorage.getItem("zyyCommunityPosts") || "[]");
      if (Array.isArray(posts) && posts.length) payload.communityPosts = posts;
    } catch (e) {}
    try {
      var memAll = JSON.parse(global.localStorage.getItem("zyyMemberPerUser") || "{}");
      var u = A.getStoredUser();
      var ph = u && u.phone ? String(u.phone) : "";
      if (ph && memAll && typeof memAll === "object" && memAll[ph]) {
        payload.memberState = {
          arUsed: memAll[ph].arUsed,
          memberUntil: memAll[ph].memberUntil || null,
        };
      }
    } catch (e) {}
    try {
      var extra = JSON.parse(global.localStorage.getItem("zyyUserProfileExtra") || "{}");
      if (extra && typeof extra === "object" && !Array.isArray(extra) && Object.keys(extra).length) {
        payload.profileExtra = extra;
      }
    } catch (e) {}

    if (Object.keys(payload).length === 0) {
      try {
        global.localStorage.setItem(IMPORT_FLAG, "1");
      } catch (e2) {}
      return Promise.resolve({ skipped: true, empty: true });
    }

    return A.authFetch("/api/user/import-legacy", { method: "POST", body: payload })
        .then(function (r) {
          return jsonOrEmpty(r).then(function (data) {
            if (!r.ok) return { ok: false, error: data.error || r.status };
            try {
              if (payload.cart) global.localStorage.removeItem("zyyCart");
              if (payload.orders) global.localStorage.removeItem("zyyOrders");
              if (payload.communityPosts) global.localStorage.removeItem("zyyCommunityPosts");
              if (payload.memberState) global.localStorage.removeItem("zyyMemberPerUser");
              if (payload.profileExtra) global.localStorage.removeItem("zyyUserProfileExtra");
              global.localStorage.setItem(IMPORT_FLAG, "1");
            } catch (e3) {}
            return { ok: true, summary: data.summary };
          });
        });
  }

  function loadCart() {
    return A.authFetch("/api/user/cart")
        .then(function (r) {
          return r.ok ? r.json() : { items: [] };
        })
        .then(function (d) {
          return d.items || [];
        })
        .catch(function () {
          return [];
        });
  }

  var cartSaveTimer = null;
  function saveCartDebounced(items, ms) {
    ms = ms == null ? 400 : ms;
    if (cartSaveTimer) global.clearTimeout(cartSaveTimer);
    cartSaveTimer = global.setTimeout(function () {
      cartSaveTimer = null;
      A.authFetch("/api/user/cart", { method: "PUT", body: { items: items || [] } }).catch(function () {});
    }, ms);
  }

  function saveCartNow(items) {
    return A.authFetch("/api/user/cart", { method: "PUT", body: { items: items || [] } }).then(function (r) {
      return r.ok;
    });
  }

  function createOrder(order) {
    return A.authFetch("/api/user/orders", { method: "POST", body: order })
        .then(function (r) {
          return r.ok;
        })
        .catch(function () {
          return false;
        });
  }

  function loadAdminOrders() {
    return A.authFetch("/api/admin/orders")
        .then(function (r) {
          return r.ok ? r.json() : { orders: [] };
        })
        .then(function (d) {
          return d.orders || [];
        })
        .catch(function () {
          return [];
        });
  }

  function deleteAdminOrder(orderNo) {
    var no = String(orderNo || "").trim();
    if (!no) return Promise.resolve(false);
    return A.authFetch("/api/admin/orders/" + encodeURIComponent(no), { method: "DELETE" })
        .then(function (r) {
          return r.ok;
        })
        .catch(function () {
          return false;
        });
  }

  function shipAdminOrder(orderNo) {
    var no = String(orderNo || "").trim();
    if (!no) return Promise.resolve(false);
    return A.authFetch("/api/admin/orders/" + encodeURIComponent(no) + "/ship", { method: "POST", body: {} })
        .then(function (r) {
          return r.ok;
        })
        .catch(function () {
          return false;
        });
  }

  function loadOrders() {
    return A.authFetch("/api/user/orders")
        .then(function (r) {
          return r.ok ? r.json() : { orders: [] };
        })
        .then(function (d) {
          return d.orders || [];
        })
        .catch(function () {
          return [];
        });
  }

  function loadMemberState() {
    return A.authFetch("/api/user/member-state")
        .then(function (r) {
          return r.ok ? r.json() : { arUsed: 0, memberUntil: null };
        })
        .catch(function () {
          return { arUsed: 0, memberUntil: null };
        });
  }

  function postMemberPlan(planId) {
    return A.authFetch("/api/user/member-state/plan", { method: "POST", body: { planId: planId } }).then(
        function (r) {
          return r.ok ? r.json() : null;
        }
    );
  }

  function postMemberArUse() {
    return A.authFetch("/api/user/member-state/ar-use", { method: "POST", body: {} }).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  function loadProfileExtra() {
    return A.authFetch("/api/user/profile-extra")
        .then(function (r) {
          return r.ok ? r.json() : { extra: {} };
        })
        .then(function (d) {
          return d.extra && typeof d.extra === "object" ? d.extra : {};
        })
        .catch(function () {
          return {};
        });
  }

  function saveProfileExtra(extra) {
    return A.authFetch("/api/user/profile-extra", { method: "PUT", body: { extra: extra || {} } }).then(
        function (r) {
          return r.ok;
        }
    );
  }

  function createCommunityPost(body) {
    return A.authFetch("/api/community/posts", { method: "POST", body: body }).then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  function updateCommunityPost(id, body) {
    return A.authFetch("/api/community/posts/" + encodeURIComponent(id), { method: "PUT", body: body }).then(
        function (r) {
          return r.ok ? r.json() : null;
        }
    );
  }

  global.ZYYUserData = {
    refreshCommunityPosts: refreshCommunityPosts,
    getCommunityPostById: getCommunityPostById,
    importLegacyOnce: importLegacyOnce,
    loadCart: loadCart,
    saveCartDebounced: saveCartDebounced,
    saveCartNow: saveCartNow,
    createOrder: createOrder,
    loadAdminOrders: loadAdminOrders,
    deleteAdminOrder: deleteAdminOrder,
    shipAdminOrder: shipAdminOrder,
    loadOrders: loadOrders,
    loadMemberState: loadMemberState,
    postMemberPlan: postMemberPlan,
    postMemberArUse: postMemberArUse,
    loadProfileExtra: loadProfileExtra,
    saveProfileExtra: saveProfileExtra,
    createCommunityPost: createCommunityPost,
    updateCommunityPost: updateCommunityPost,
  };
})(typeof window !== "undefined" ? window : global);
