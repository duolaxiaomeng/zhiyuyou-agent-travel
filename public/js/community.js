(function () {
  "use strict";

  var CD = window.ZYYCommunityData;
  if (!CD) return;

  var CAT_TYPES = [
    { value: "全部", label: "全部", icon: "✨" },
    { value: "风景图片", label: "风景", icon: "🏞" },
    { value: "路线", label: "路线", icon: "🗺" },
    { value: "美食餐厅", label: "美食", icon: "🍜" },
    { value: "酒店", label: "酒店", icon: "🏨" },
  ];

  var STORAGE_KEY = CD.STORAGE_KEY;
  /** 交流区列表每页卡片数 */
  var PAGE_SIZE = 24;

  var filterState = {
    destination: "全部",
    type: "全部",
    sort: "time-desc",
    keyword: "",
  };

  /** 当前页码（筛选/排序/搜索变化时重置为 1） */
  var feedPage = 1;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** 去掉常见行政区划后缀，便于「万州区」匹配数据里的「万州」 */
  var ADMIN_SUFFIXES = [
    "土家族苗族自治县",
    "苗族土家族自治县",
    "土家族自治县",
    "壮族瑶族自治县",
    "苗族自治县",
    "自治县",
    "自治州",
    "特别行政区",
    "新区",
    "区",
    "县",
    "市",
  ];

  function stripOneAdminSuffix(t) {
    if (!t) return t;
    for (var i = 0; i < ADMIN_SUFFIXES.length; i += 1) {
      var suf = ADMIN_SUFFIXES[i];
      if (t.length >= suf.length && t.slice(-suf.length) === suf) {
        return t.slice(0, -suf.length);
      }
    }
    return t;
  }

  function normalizePlaceToken(s) {
    var t = String(s || "").trim();
    var guard = 0;
    while (guard < 6) {
      var next = stripOneAdminSuffix(t);
      if (next === t) break;
      t = next;
      guard += 1;
    }
    return t;
  }

  function unique(arr) {
    return Array.from(new Set(arr));
  }

  function readUserPosts() {
    return CD.readUserPosts();
  }

  function normalizeUserPost(p) {
    return CD.normalizeUserPost(p);
  }

  function getAllPosts() {
    return CD.getAllPosts();
  }

  function getCurrentPhone() {
    if (window.ZYYAuth && typeof window.ZYYAuth.getStoredUser === "function") {
      var u = window.ZYYAuth.getStoredUser();
      return u && u.phone ? String(u.phone) : "";
    }
    return "";
  }

  function parseScore(p) {
    var n = parseFloat(p.score, 10);
    return isNaN(n) ? 0 : n;
  }

  function parseTime(p) {
    var t = p.updatedAt || p.createdAt;
    if (!t) return 0;
    var ms = new Date(t).getTime();
    return isNaN(ms) ? 0 : ms;
  }

  function parseLikes(p) {
    return CD.parseLikes(p);
  }

  function detailHref(p) {
    if (p.fillKey) return "community-detail?fk=" + encodeURIComponent(p.fillKey);
    if (p.id) return "community-detail?id=" + encodeURIComponent(p.id);
    return "community-detail";
  }

  function matchesKeyword(p, kw) {
    if (!kw) return true;
    var k = kw.toLowerCase().trim();
    var blob = [p.destination, p.type, p.title, p.content, p.author].join(" ").toLowerCase();
    if (blob.indexOf(k) !== -1) return true;
    /* 例如搜「万州区」「江北区」时，正文里多为「万州」「江北」 */
    var kCompact = normalizePlaceToken(k).toLowerCase();
    if (kCompact && kCompact !== k && blob.indexOf(kCompact) !== -1) return true;
    return false;
  }

  function sortPosts(list) {
    var sort = filterState.sort;
    var out = list.slice();
    if (sort === "likes-desc") {
      out.sort(function (a, b) {
        return parseLikes(b) - parseLikes(a);
      });
    } else if (sort === "score-desc") {
      out.sort(function (a, b) {
        return parseScore(b) - parseScore(a);
      });
    } else if (sort === "score-asc") {
      out.sort(function (a, b) {
        return parseScore(a) - parseScore(b);
      });
    } else if (sort === "time-desc") {
      out.sort(function (a, b) {
        return parseTime(b) - parseTime(a);
      });
    }
    return out;
  }

  function filterPosts(list) {
    return list.filter(function (p) {
      var dest = p.destination || "";
      var sel = filterState.destination;
      var okDest =
        sel === "全部" ||
        dest === sel ||
        normalizePlaceToken(dest) === normalizePlaceToken(sel);
      var okType =
        filterState.type === "全部"
          ? true
          : p.type === filterState.type;
      return okDest && okType && matchesKeyword(p, filterState.keyword.trim());
    });
  }

  function renderDestFilters() {
    var root = $("communityDestFilters");
    if (!root) return;
    var dests = unique(
      getAllPosts()
        .map(function (p) {
          return p.destination;
        })
        .filter(function (d) {
          return d != null && String(d).trim() !== "";
        })
    );
    var items = ["全部"].concat(dests.sort());
    root.innerHTML = items
      .map(function (d) {
        var active = filterState.destination === d;
        return (
          '<button type="button" class="community-chip' +
          (active ? " is-active" : "") +
          '" data-filter="dest" data-value="' +
          escapeHtml(d) +
          '">' +
          escapeHtml(d) +
          "</button>"
        );
      })
      .join("");
  }

  function renderCatGrid() {
    var root = $("communityCatGrid");
    if (!root) return;
    root.innerHTML = CAT_TYPES.map(function (c) {
      var active = filterState.type === c.value;
      return (
        '<button type="button" class="community-cat-item' +
        (active ? " is-active" : "") +
        '" data-filter="type" data-value="' +
        c.value +
        '"><span class="community-cat-icon">' +
        c.icon +
        '</span><span class="community-cat-label">' +
        c.label +
        "</span></button>"
      );
    }).join("");
  }

  function syncSortSelect() {
    var sel = $("communitySort");
    if (sel) sel.value = filterState.sort;
  }

  function renderSearchInput() {
    var inp = $("communitySearch");
    if (!inp) return;
    inp.value = filterState.keyword;
  }

  function renderLoginHint() {
    var el = $("communityLoginHint");
    if (!el) return;
    var phone = getCurrentPhone();
    if (phone) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = '登录后可发布：<a href="login?redirect=' + encodeURIComponent("community-publish") + '">去登录</a>';
  }

  function authorInitial(name) {
    var n = String(name || "游").trim();
    return n.charAt(0) || "游";
  }

  function formatLikes(n) {
    n = Math.round(Number(n)) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    return String(n);
  }

  function cardHtml(p, canEdit, idx) {
    var titleEsc = escapeHtml(p.title);
    var authorName = escapeHtml(p.author || "用户");
    var likes = formatLikes(parseLikes(p));
    var destTag = escapeHtml(p.destination || "");
    var edit =
      canEdit && p.id && !p.fillKey
        ? '<a class="community-card__edit" href="community-publish?edit=' + encodeURIComponent(p.id) + '">编辑</a>'
        : "";
    var imgExtra = "";
    var v = typeof idx === "number" ? idx % 3 : 0;
    if (v === 1) imgExtra = " community-card__img--tall";
    else if (v === 2) imgExtra = " community-card__img--mid";
    return (
      '<article class="community-card community-card--dp">' +
      '<a class="community-card__link" href="' +
      escapeHtml(detailHref(p)) +
      '">' +
      '<div class="community-card__media">' +
      '<img class="community-card__img' + imgExtra + '" src="' +
      escapeHtml(p.image || "assets/hero/slide-01.png") +
      '" alt="' +
      titleEsc +
      '" loading="lazy" />' +
      '<span class="community-card__badge">' +
      destTag +
      "</span>" +
      "</div>" +
      '<div class="community-card__body">' +
      '<h3 class="community-card__title">' +
      titleEsc +
      "</h3>" +
      '<div class="community-card__footer">' +
      '<span class="community-card__user">' +
      '<span class="community-card__avatar">' +
      authorInitial(p.author) +
      "</span>" +
      '<span class="community-card__name">' +
      authorName +
      "</span></span>" +
      '<span class="community-card__likes" title="点赞"><span aria-hidden="true">♥</span> ' +
      likes +
      "</span></div></div></a>" +
      edit +
      "</article>"
    );
  }

  function renderPaginationNav(total) {
    var nav = $("communityPagination");
    if (!nav) return;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (feedPage > totalPages) feedPage = totalPages;
    if (feedPage < 1) feedPage = 1;
    if (total <= PAGE_SIZE) {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }
    nav.hidden = false;
    var prevDis = feedPage <= 1 ? " disabled" : "";
    var nextDis = feedPage >= totalPages ? " disabled" : "";
    nav.innerHTML =
      '<div class="community-pagination-inner">' +
      '<button type="button" class="btn btn-ghost btn-sm community-page-btn" data-feed-page="prev"' +
      prevDis +
      ">上一页</button>" +
      '<span class="community-pagination-meta">共 ' +
      total +
      " 条</span>" +
      '<span class="community-pagination-jump">' +
      '<label class="community-pagination-jump-label" for="communityPageInput">前往第</label>' +
      '<input type="number" id="communityPageInput" class="community-page-input" name="communityPage" min="1" max="' +
      totalPages +
      '" value="' +
      feedPage +
      '" inputmode="numeric" autocomplete="off" aria-label="页码" />' +
      '<span class="community-pagination-jump-total">页（共 ' +
      totalPages +
      " 页）</span>" +
      '<button type="button" class="btn btn-ghost btn-sm community-page-btn" data-feed-page="go">跳转</button>' +
      "</span>" +
      '<button type="button" class="btn btn-ghost btn-sm community-page-btn" data-feed-page="next"' +
      nextDis +
      ">下一页</button>" +
      "</div>";
  }

  function feedListTotal() {
    return sortPosts(filterPosts(getAllPosts())).length;
  }

  function scrollFeedIntoView() {
    var f = $("communityFeed");
    if (f) f.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyPageFromInputOrNav(act) {
    var total = feedListTotal();
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (act === "prev") {
      if (feedPage > 1) feedPage -= 1;
    } else if (act === "next") {
      if (feedPage < totalPages) feedPage += 1;
    } else if (act === "go") {
      var inp = $("communityPageInput");
      var n = inp ? parseInt(inp.value, 10) : NaN;
      if (!isNaN(n)) {
        feedPage = Math.max(1, Math.min(totalPages, n));
      }
    }
    renderFeed();
    scrollFeedIntoView();
  }

  function renderFeed() {
    var root = $("communityFeed");
    if (!root) return;
    var phone = getCurrentPhone();
    var list = sortPosts(filterPosts(getAllPosts()));
    var pag = $("communityPagination");
    if (!list.length) {
      root.innerHTML =
        '<p class="community-empty">当前筛选或搜索下没有帖子。可将区县、分类改为「全部」并清空搜索框；或前往 <a href="community-publish">发布一条</a> 补充内容。</p>';
      if (pag) {
        pag.hidden = true;
        pag.innerHTML = "";
      }
      return;
    }
    var total = list.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (feedPage > totalPages) feedPage = totalPages;
    if (feedPage < 1) feedPage = 1;
    var start = (feedPage - 1) * PAGE_SIZE;
    var pageList = list.slice(start, start + PAGE_SIZE);
    root.innerHTML = pageList
      .map(function (p, idx) {
        var canEdit = !!(p.userPost && phone && p.authorPhone && p.authorPhone === phone && !p.fillKey);
        return cardHtml(p, canEdit, start + idx);
      })
      .join("");
    renderPaginationNav(total);
  }

  function setActiveChips(containerSel, filterName, value) {
    var root = $(containerSel);
    if (!root) return;
    root.querySelectorAll('.community-chip[data-filter="' + filterName + '"]').forEach(function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-value") === value);
    });
  }

  function setActiveCats(value) {
    var root = $("communityCatGrid");
    if (!root) return;
    root.querySelectorAll(".community-cat-item").forEach(function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-value") === value);
    });
  }

  function bindEvents() {
    var destRoot = $("communityDestFilters");
    if (destRoot) {
      destRoot.addEventListener("click", function (e) {
        var btn = e.target.closest(".community-chip[data-filter='dest']");
        if (!btn) return;
        filterState.destination = btn.getAttribute("data-value") || "全部";
        /* 避免「分类」与「区县」同时收窄导致大量空列表：点区县时只看该区县全部类型 */
        if (filterState.destination !== "全部") {
          filterState.type = "全部";
          setActiveCats("全部");
        }
        setActiveChips("communityDestFilters", "dest", filterState.destination);
        feedPage = 1;
        renderFeed();
      });
    }

    var catRoot = $("communityCatGrid");
    if (catRoot) {
      catRoot.addEventListener("click", function (e) {
        var btn = e.target.closest(".community-cat-item[data-filter='type']");
        if (!btn) return;
        filterState.type = btn.getAttribute("data-value") || "全部";
        setActiveCats(filterState.type);
        feedPage = 1;
        renderFeed();
      });
    }

    var sortSel = $("communitySort");
    if (sortSel) {
      sortSel.addEventListener("change", function () {
        filterState.sort = sortSel.value || "time-desc";
        feedPage = 1;
        renderFeed();
      });
    }

    var searchInp = $("communitySearch");
    if (searchInp) {
      var t = null;
      searchInp.addEventListener("input", function () {
        filterState.keyword = searchInp.value || "";
        if (t) window.clearTimeout(t);
        t = window.setTimeout(function () {
          feedPage = 1;
          renderFeed();
        }, 200);
      });
      searchInp.addEventListener("search", function () {
        filterState.keyword = searchInp.value || "";
        feedPage = 1;
        renderFeed();
      });
    }

    var pagNav = $("communityPagination");
    if (pagNav) {
      pagNav.addEventListener("click", function (e) {
        var btn = e.target.closest(".community-page-btn[data-feed-page]");
        if (!btn || btn.disabled) return;
        var act = btn.getAttribute("data-feed-page");
        if (act === "prev" || act === "next" || act === "go") {
          applyPageFromInputOrNav(act);
        }
      });
      pagNav.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        if (!e.target || e.target.id !== "communityPageInput") return;
        e.preventDefault();
        applyPageFromInputOrNav("go");
      });
    }
  }

  function boot() {
    function runAfterPosts() {
      renderCatGrid();
      renderDestFilters();
      renderSearchInput();
      syncSortSelect();
      renderLoginHint();
      renderFeed();
      bindEvents();

      if (window.ZYYAuth && typeof window.ZYYAuth.fetchMe === "function") {
        var token = window.ZYYAuth.getToken && window.ZYYAuth.getToken();
        if (token && !getCurrentPhone()) {
          window.ZYYAuth
              .fetchMe()
              .then(function (data) {
                if (data && data.user) {
                  try {
                    localStorage.setItem("zyyCurrentUser", JSON.stringify(data.user));
                  } catch (e) {}
                  if (window.ZYYAuth && typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
                    window.ZYYAuth.clearStaleProfileExtraIfNeeded(data.user);
                  }
                }
                renderLoginHint();
                renderFeed();
              })
              .catch(function () {});
        }
      }
    }

    if (window.ZYYUserData && typeof window.ZYYUserData.refreshCommunityPosts === "function") {
      window.ZYYUserData.refreshCommunityPosts().then(runAfterPosts).catch(runAfterPosts);
    } else {
      runAfterPosts();
    }
  }

  window.addEventListener("zyy-community-posts-updated", function () {
    renderDestFilters();
    feedPage = 1;
    renderFeed();
  });

  var resizeTimer = null;
  function onResizeFeed() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      if ($("communityFeed")) renderFeed();
    }, 280);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("resize", onResizeFeed);
})();
