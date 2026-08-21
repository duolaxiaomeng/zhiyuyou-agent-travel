(function () {
  "use strict";

  var CD = window.ZYYCommunityData;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
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

  function parseParams() {
    var q = new URLSearchParams(window.location.search);
    return {
      id: q.get("id") || "",
      fk: q.get("fk") || "",
    };
  }

  function storageKey(postKey, suffix) {
    return "zyyDetail" + suffix + ":" + postKey;
  }

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null || raw === "") return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function defaultStarCount(likes) {
    var n = Math.round(Number(likes)) || 0;
    return Math.max(12, Math.round(n * 0.38));
  }

  function defaultCommentSeed(post) {
    var dest = post.destination || "重庆";
    return [
      {
        id: "c-seed-1",
        author: "路过网友",
        text: "正好打算去 " + dest + "，收藏了～",
        at: "2026-02-10",
        loc: "重庆",
        likes: 3,
        replies: [],
      },
      {
        id: "c-seed-2",
        author: "本地人",
        text: "图拍得真实，节假日人会多一些，建议错峰。",
        at: "2026-02-11",
        loc: dest,
        likes: 5,
        replies: [
          {
            id: "r1",
            author: post.author || "作者",
            isAuthor: true,
            text: "同意，早上体验更好。",
            at: "2026-02-11",
          },
        ],
      },
    ];
  }

  function loadComments(postKey) {
    var key = storageKey(postKey, "Comments");
    var raw = localStorage.getItem(key);
    if (raw == null) return null;
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveComments(postKey, list) {
    saveJson(storageKey(postKey, "Comments"), list);
  }

  function loadUiState(postKey) {
    var d = {
      likes: null,
      stars: null,
      liked: false,
      starred: false,
      following: false,
    };
    var o = loadJson(storageKey(postKey, "Ui"), {});
    if (!o || typeof o !== "object") return d;
    return Object.assign({}, d, o);
  }

  function saveUiState(postKey, st) {
    saveJson(storageKey(postKey, "Ui"), st);
  }

  function getMyAuthorName() {
    if (window.ZYYAuth && typeof window.ZYYAuth.getStoredUser === "function") {
      var u = window.ZYYAuth.getStoredUser();
      if (u && u.username) return String(u.username).slice(0, 16);
    }
    return "游客";
  }

  function getMyAvatarUrl() {
    if (window.ZYYAuth && typeof window.ZYYAuth.getStoredUser === "function") {
      var u = window.ZYYAuth.getStoredUser();
      if (u && u.avatar && String(u.avatar).trim()) return String(u.avatar).trim();
    }
    if (window.ZYYProfileExtraCache && window.ZYYProfileExtraCache.avatar) {
      return String(window.ZYYProfileExtraCache.avatar).trim();
    }
    try {
      var extra = JSON.parse(localStorage.getItem("zyyUserProfileExtra") || "{}");
      if (extra && extra.avatar && String(extra.avatar).trim()) return String(extra.avatar).trim();
    } catch (e) {}
    return "";
  }

  /** 评论者头像：优先已存图链；否则当前用户且资料有头像则显示 */
  function commentAvatarHtml(author, savedAvatarUrl) {
    var myName = getMyAuthorName();
    var myUrl = getMyAvatarUrl();
    var url = savedAvatarUrl || (author === myName && myUrl ? myUrl : "");
    var inner = url
      ? '<img class="cdetail-c-ava-img" src="' + escapeHtml(url) + '" alt="" />'
      : escapeHtml(authorInitial(author));
    var picClass = url ? " cdetail-c-ava--pic" : "";
    return '<span class="cdetail-c-ava' + picClass + '">' + inner + "</span>";
  }

  function paintMeAvatar(el) {
    if (!el) return;
    var url = getMyAvatarUrl();
    var name = getMyAuthorName();
    var src = url ? url : "assets/profile-default-avatar.png";
    el.innerHTML =
      '<img class="cdetail-me-avatar-img" src="' + escapeHtml(src) + '" alt="" loading="lazy" />';
    el.classList.add("cdetail-me-avatar--pic");
    var im = el.querySelector("img");
    if (im) {
      im.addEventListener(
        "error",
        function onMeAvatarErr() {
          im.removeEventListener("error", onMeAvatarErr);
          el.classList.remove("cdetail-me-avatar--pic");
          el.textContent = authorInitial(name);
        },
        { once: true }
      );
    }
  }

  function renderComments(container, list, postAuthor) {
    container.innerHTML = list
      .map(function (c) {
        var sub = (c.replies || [])
          .map(function (r) {
            var tag =
              r.isAuthor || r.author === postAuthor
                ? '<span class="cdetail-reply-tag">作者</span>'
                : "";
            return (
              '<li class="cdetail-reply">' +
              commentAvatarHtml(r.author, r.authorAvatar) +
              '<div class="cdetail-reply-body">' +
              '<span class="cdetail-c-name">' +
              tag +
              escapeHtml(r.author) +
              "</span>" +
              '<p class="cdetail-c-text">' +
              escapeHtml(r.text) +
              "</p>" +
              '<span class="cdetail-c-meta">' +
              escapeHtml(r.at || "") +
              "</span>" +
              "</div></li>"
            );
          })
          .join("");
        return (
          '<li class="cdetail-c-item">' +
          commentAvatarHtml(c.author, c.authorAvatar) +
          '<div class="cdetail-c-main">' +
          '<span class="cdetail-c-name">' +
          escapeHtml(c.author) +
          "</span>" +
          '<p class="cdetail-c-text">' +
          escapeHtml(c.text) +
          "</p>" +
          '<div class="cdetail-c-foot">' +
          '<span class="cdetail-c-meta">' +
          escapeHtml(c.at || "") +
          " " +
          escapeHtml(c.loc || "") +
          "</span>" +
          '<span class="cdetail-c-reply">回复</span>' +
          '<span class="cdetail-c-like">♥ ' +
          (c.likes || 0) +
          "</span>" +
          "</div>" +
          (sub ? '<ul class="cdetail-reply-list">' + sub + "</ul>" : "") +
          "</div></li>"
        );
      })
      .join("");
  }

  function startDetail(post) {
    $("cdetailApp").hidden = false;
    var postKey = CD.postStorageKey(post);

    var title = post.title || "分享";
    var img = post.image || "assets/hero/slide-01.png";

    $("cdetailTitle").textContent = title;
    document.title = "智渝游 · " + title;
    $("cdetailImg").src = img;
    $("cdetailImg").alt = title;
    $("cdetailText").textContent = post.content || "";
    $("cdetailAuthor").textContent = post.author || "用户";
    $("cdetailAvatar").textContent = authorInitial(post.author);

    var hash = "#" + (post.type || "分享").replace(/\s/g, "") + " #" + (post.destination || "") + "打卡";
    $("cdetailHash").textContent = hash;

    var poi =
      "地点 " + (post.destination || "") + " · " + (post.type || "") + " · 智渝游精选笔记";
    $("cdetailPoiText").textContent = poi;
    $("cdetailGuessText").textContent = "猜你想搜 " + (post.destination || "") + " " + (post.title || "").slice(0, 8);

    var cr = post.createdAt ? new Date(post.createdAt) : new Date();
    var mon = String(cr.getMonth() + 1).padStart(2, "0");
    var day = String(cr.getDate()).padStart(2, "0");
    $("cdetailDateLoc").textContent = mon + "-" + day + " · " + (post.destination || "重庆");

    var ui = loadUiState(postKey);
    if (typeof ui.following !== "boolean") ui.following = false;

    if (CD.getLikedKeys().indexOf(postKey) !== -1) ui.liked = true;
    if (CD.getStarredKeys().indexOf(postKey) !== -1) ui.starred = true;

    var baseLikes = CD.parseLikes(post);
    var baseStars = defaultStarCount(baseLikes);
    var likeNum = ui.likes != null ? ui.likes : baseLikes;
    var starNum = ui.stars != null ? ui.stars : baseStars;

    $("cdetailLikeNum").textContent = formatLikes(likeNum);
    $("cdetailStarNum").textContent = formatLikes(starNum);

    var comments = loadComments(postKey);
    if (comments === null) {
      comments = defaultCommentSeed(post);
      saveComments(postKey, comments);
    }
    var commentCount = comments.length;
    comments.forEach(function (c) {
      commentCount += (c.replies || []).length;
    });

    function syncCommentTotal() {
      $("cdetailCommentTotal").textContent = String(commentCount);
      $("cdetailCommentNum").textContent = String(commentCount);
    }
    syncCommentTotal();
    renderComments($("cdetailCommentList"), comments, post.author);

    $("cdetailLike").classList.toggle("is-on", !!ui.liked);
    $("cdetailLike").setAttribute("aria-pressed", ui.liked ? "true" : "false");
    $("cdetailStar").classList.toggle("is-on", !!ui.starred);
    $("cdetailStar").setAttribute("aria-pressed", ui.starred ? "true" : "false");

    var followBtn = $("cdetailFollow");
    function syncFollow() {
      followBtn.textContent = ui.following ? "已关注" : "立即关注";
      followBtn.classList.toggle("is-on", ui.following);
    }
    syncFollow();

    followBtn.addEventListener("click", function () {
      ui.following = !ui.following;
      saveUiState(postKey, ui);
      syncFollow();
    });

    $("cdetailShare").addEventListener("click", function () {
      var url = window.location.href;
      if (navigator.share) {
        navigator
          .share({ title: title, text: post.content || title, url: url })
          .catch(function () {
            copyUrl(url);
          });
      } else {
        copyUrl(url);
      }
    });

    function copyUrl(url) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(function () {});
      }
      alert("链接已复制，可粘贴分享给好友。");
    }

    $("cdetailNope").addEventListener("click", function () {
      alert("已记录偏好，将减少类似推荐。");
    });

    function addCommentFromInput(text) {
      text = String(text || "").trim();
      if (!text) return;
      var av = getMyAvatarUrl();
      var item = {
        id: "c-" + Date.now(),
        author: getMyAuthorName(),
        authorAvatar: av || undefined,
        text: text,
        at: new Date().toISOString().slice(5, 10),
        loc: post.destination || "",
        likes: 0,
        replies: [],
      };
      comments.unshift(item);
      commentCount += 1;
      saveComments(postKey, comments);
      syncCommentTotal();
      renderComments($("cdetailCommentList"), comments, post.author);
    }

    function wireInput(el) {
      if (!el) return;
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addCommentFromInput(el.value);
          el.value = "";
        }
      });
    }
    wireInput($("cdetailQuickInput"));
    wireInput($("cdetailBarInput"));

    paintMeAvatar($("cdetailMeAvatar"));
    $("cdetailCommentJump").addEventListener("click", function () {
      $("cdetailQuickInput").focus();
      $("cdetailCommentHead").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    $("cdetailLike").addEventListener("click", function () {
      ui.liked = !ui.liked;
      likeNum += ui.liked ? 1 : -1;
      if (likeNum < 0) likeNum = 0;
      ui.likes = likeNum;
      saveUiState(postKey, ui);
      CD.setLikedKey(postKey, ui.liked);
      $("cdetailLikeNum").textContent = formatLikes(likeNum);
      $("cdetailLike").classList.toggle("is-on", ui.liked);
      $("cdetailLike").setAttribute("aria-pressed", ui.liked ? "true" : "false");
    });

    $("cdetailStar").addEventListener("click", function () {
      ui.starred = !ui.starred;
      starNum += ui.starred ? 1 : -1;
      if (starNum < 0) starNum = 0;
      ui.stars = starNum;
      saveUiState(postKey, ui);
      CD.setStarredKey(postKey, ui.starred);
      $("cdetailStarNum").textContent = formatLikes(starNum);
      $("cdetailStar").classList.toggle("is-on", ui.starred);
      $("cdetailStar").setAttribute("aria-pressed", ui.starred ? "true" : "false");
    });
  }

  function boot() {
    if (!CD) {
      window.location.replace("guide");
      return;
    }
    var params = parseParams();
    var post = CD.findPostForDetail(params.id, params.fk);
    if (post) {
      startDetail(post);
      return;
    }
    if (params.id && window.ZYYUserData && typeof window.ZYYUserData.getCommunityPostById === "function") {
      window.ZYYUserData.getCommunityPostById(params.id).then(function (p) {
        if (!p) {
          window.location.replace("guide");
          return;
        }
        if (CD.setUserPostsCache) {
          var cur = CD.readUserPosts();
          var merged = cur.slice();
          var ix = merged.findIndex(function (x) {
            return x && x.id === p.id;
          });
          if (ix >= 0) merged[ix] = p;
          else merged.unshift(p);
          CD.setUserPostsCache(merged);
        }
        startDetail(p);
      });
      return;
    }
    window.location.replace("guide");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
