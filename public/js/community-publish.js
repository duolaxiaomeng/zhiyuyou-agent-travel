(function () {
  "use strict";

  var DEFAULT_IMAGE = "assets/hero/slide-01.png";

  function $(id) {
    return document.getElementById(id);
  }

  function getUser() {
    if (window.ZYYAuth && typeof window.ZYYAuth.getStoredUser === "function") {
      return window.ZYYAuth.getStoredUser();
    }
    return null;
  }

  function readPostsForPhone(phone) {
    if (!window.ZYYCommunityData || typeof window.ZYYCommunityData.readUserPosts !== "function") {
      return [];
    }
    return window.ZYYCommunityData.readUserPosts().filter(function (p) {
      return p && String(p.authorPhone || "") === String(phone || "");
    });
  }

  function scoreToString(n) {
    if (n === "" || n === null || typeof n === "undefined" || isNaN(n)) return "5.0";
    var x = Math.max(1, Math.min(5, Number(n)));
    return x.toFixed(1);
  }

  function renderMyPosts(phone) {
    var container = $("myPostsSection");
    var listEl = $("myPostsList");
    if (!listEl || !phone) return;
    var posts = readPostsForPhone(phone);
    if (!posts.length) {
      listEl.innerHTML =
          '<p class="publish-my-empty">暂无你账号下的已发布内容。填写上方表单即可发布；也可先去 <a class="nav-auth-link" href="guide">交流中心</a> 浏览他人帖子找灵感。</p>';
      if (container) container.hidden = false;
      return;
    }
    posts.sort(function (a, b) {
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });
    listEl.innerHTML = posts
        .map(function (p) {
          return (
            '<article class="publish-my-item">' +
            "<h4>" +
            p.title +
            "</h4>" +
            '<p class="publish-my-meta">' +
            p.destination +
            " · " +
            p.type +
            " · 评分 " +
            p.score +
            "</p>" +
            '<a class="nav-auth-link" href="community-publish?edit=' + encodeURIComponent(p.id) + '#publishForm">编辑</a>' +
            "</article>"
          );
        })
        .join("");
    if (container) container.hidden = false;
  }

  function fillForm(p) {
    $("pubDestination").value = p.destination || "";
    $("pubType").value = p.type || "风景图片";
    $("pubTitle").value = p.title || "";
    $("pubContent").value = p.content || "";
    $("pubImage").value = p.image && p.image !== DEFAULT_IMAGE ? p.image : "";
    var sc = parseFloat(p.score, 10);
    $("pubScore").value = !isNaN(sc) ? sc : "";
  }

  function refreshListFromServer(phone, cb) {
    if (!window.ZYYUserData || typeof window.ZYYUserData.refreshCommunityPosts !== "function") {
      if (cb) cb();
      return;
    }
    window.ZYYUserData.refreshCommunityPosts().then(function () {
      renderMyPosts(phone);
      if (cb) cb();
    });
  }

  function runPublishUi(user) {
    var params = new URLSearchParams(window.location.search);
    var editingId = params.get("edit");
    var titleEl = $("publishPageTitle");
    var submitBtn = $("pubSubmit");
    var msg = $("publishMsg");

    if (window.location.hash === "#my-posts" || window.location.hash === "#publishForm") {
      var sec = $("myPostsSection");
      var form = $("publishForm");
      if (window.location.hash === "#my-posts" && sec) {
        sec.scrollIntoView({ behavior: "smooth" });
      }
      if (window.location.hash === "#publishForm" && form) {
        form.scrollIntoView({ behavior: "smooth" });
      }
    }

    refreshListFromServer(user.phone, function () {
      if (editingId) {
        var posts = readPostsForPhone(user.phone);
        var found = posts.find(function (p) {
          return p.id === editingId;
        });
        if (!found) {
          if (msg) msg.textContent = "未找到内容，或你没有权限编辑。";
          if (titleEl) titleEl.textContent = "发布分享";
          return;
        }
        fillForm(found);
        if (titleEl) titleEl.textContent = "编辑分享";
        if (submitBtn) submitBtn.textContent = "保存修改";
      }
    });

    $("publishForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (msg) msg.textContent = "";

      var dest = $("pubDestination").value.trim();
      var typ = $("pubType").value;
      var tit = $("pubTitle").value.trim();
      var body = $("pubContent").value.trim();
      var img = ($("pubImage").value || "").trim();
      var scoreRaw = $("pubScore").value;
      var scoreNum = scoreRaw === "" ? 5 : parseFloat(scoreRaw, 10);

      if (!dest || !tit || !body) {
        if (msg) msg.textContent = "请填写目的地、标题与正文。";
        return;
      }
      if (scoreRaw !== "" && (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5)) {
        if (msg) msg.textContent = "评分请在 1～5 之间。";
        return;
      }

      var imageUrl = img || DEFAULT_IMAGE;
      var now = new Date().toISOString();
      var UD = window.ZYYUserData;

      if (!UD || !UD.createCommunityPost) {
        if (msg) msg.textContent = "页面未加载数据模块，请刷新重试。";
        return;
      }

      if (editingId) {
        var posts0 = readPostsForPhone(user.phone);
        var found0 = posts0.find(function (p) {
          return p.id === editingId;
        });
        if (!found0) {
          if (msg) msg.textContent = "保存失败：无权操作。";
          return;
        }
        UD.updateCommunityPost(editingId, {
          destination: dest,
          type: typ,
          title: tit,
          content: body,
          image: imageUrl,
          score: scoreToString(scoreNum),
        }).then(function (data) {
          if (!data || !data.ok) {
            if (msg) msg.textContent = "保存失败，请检查网络或重新登录。";
            return;
          }
          if (msg) msg.textContent = "已保存。";
          refreshListFromServer(user.phone);
        });
        return;
      }

      var post = {
        id: "uc" + Date.now(),
        destination: dest,
        type: typ,
        title: tit,
        content: body,
        image: imageUrl,
        author: user.username || "用户",
        authorPhone: user.phone,
        score: scoreToString(scoreNum),
        likes: Math.floor(50 + Math.random() * 250),
        createdAt: now,
        updatedAt: now,
        userPost: true,
      };
      UD.createCommunityPost(post).then(function (data) {
        if (!data || !data.ok) {
          if (msg) msg.textContent = "发布失败，请检查网络或重新登录。";
          return;
        }
        if (msg) msg.textContent = "发布成功。";
        $("pubTitle").value = "";
        $("pubContent").value = "";
        $("pubImage").value = "";
        $("pubScore").value = "";
        refreshListFromServer(user.phone);
      });
    });
  }

  function boot() {
    var tries = (boot._tries = (boot._tries || 0) + 1);
    var user = getUser();
    var hasToken = window.ZYYAuth && typeof window.ZYYAuth.getToken === "function" && window.ZYYAuth.getToken();
    if ((!user || !user.phone) && hasToken && tries < 40) {
      setTimeout(boot, 120);
      return;
    }
    if (!user || !user.phone) return;
    runPublishUi(user);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
