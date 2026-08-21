(function () {
  "use strict";

  var HOTEL_LIST = {
    cq: [{ name: "洪崖洞步行圈民宿", stars: 3, img: "assets/首页酒店/洪崖洞民宿.webp" }],
    wl: [
      { name: "仙女山森林度假酒店", stars: 4, img: "assets/首页酒店/仙女山度假酒店.png" },
      { name: "天生三桥观景客栈", stars: 4, img: "assets/首页酒店/天生三桥观景客栈.jpg" },
      { name: "喀斯特温泉酒店", stars: 5, img: "assets/首页酒店/喀斯特温泉酒店.png" },
    ],
    se: [
      { name: "酉阳桃花源文化酒店", stars: 4, img: "assets/首页酒店/酉阳桃花源.jpg" },
      { name: "黔江峡谷花园酒店", stars: 3, img: "assets/首页酒店/花园酒店.jpg" },
      { name: "秀山边城驿站", stars: 3, img: "assets/首页轮播图/秀山・洪安边城拉拉渡：渝湘黔三省交界，《边城》原型地，拉拉渡横跨清水江，充满边城风情。.jpg" },
    ],
    sx: [
      { name: "三峡江景酒店（万州）", stars: 4, img: "assets/首页轮播图/巫溪兰英大峡谷：大巴山深处的壮美峡谷，深秋红叶漫山，峡谷江面如碧带蜿蜒。.jpg" },
      { name: "巫山小三峡游船主题酒店", stars: 4, img: "assets/首页酒店/巫山小三峡.webp" },
      { name: "云阳梯城观景酒店", stars: 3, img: "assets/首页酒店/云阳酒店.jpg" },
    ],
  };

  var SCENIC_LIST = [
    { name: "武隆·天生三桥", tag: "世界自然遗产", img: "assets/首页景区/天生三桥.jpg" },
    { name: "大足石刻", tag: "人文瑰宝", img: "assets/首页景区/大足石刻.jpg" },
    { name: "酉阳桃花源", tag: "世外桃源", img: "assets/首页景区/酉阳桃花源.jpg" },
    { name: "南川金佛山", tag: "世界遗产", img: "assets/首页景区/南川金佛山.jpg" },
    { name: "巫山小三峡", tag: "峡谷游船", img: "assets/首页景区/巫山小三峡.webp" },
  ];

  function $(sel) {
    return document.querySelector(sel);
  }

  /** 与当前页面同级的 api 路径，避免子目录部署或 pathname 非根时 fetch 打到错地址 */
  function siteApiHomeAssetImages(dir) {
    if (typeof window === "undefined" || !window.location) return "";
    if (window.location.protocol === "file:") return "";
    var p = window.location.pathname || "/";
    var i = p.lastIndexOf("/");
    var base = i >= 0 ? p.slice(0, i + 1) : "/";
    return base + "api/home-asset-images?dir=" + encodeURIComponent(dir);
  }

  /** 含中文、全角符号、空格的文件名在请求 URL 中需分段编码，否则易 404 */
  function encodeAssetPathForSrc(raw) {
    var s = String(raw || "")
      .replace(/\\/g, "/")
      .trim();
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf("assets/") !== 0) return s;
    var parts = s.split("/").filter(Boolean);
    if (!parts.length) return s;
    return parts
      .map(function (seg, idx) {
        return idx === 0 && seg === "assets" ? seg : encodeURIComponent(seg);
      })
      .join("/");
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function escapeAttr(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  /** 若仍使用旧目录「首页酒店和景区」，主路径 404 时自动回退 */
  function legacyMergedHotelScenicUrl(primary) {
    var u = String(primary || "");
    if (u.indexOf("assets/首页酒店/") === 0) {
      return "assets/首页酒店和景区/" + u.slice("assets/首页酒店/".length);
    }
    if (u.indexOf("assets/首页景区/") === 0) {
      return "assets/首页酒店和景区/" + u.slice("assets/首页景区/".length);
    }
    return "";
  }

  function homeRecImgAttrs(primary) {
    var src = escapeAttr(encodeAssetPathForSrc(primary));
    var fb = legacyMergedHotelScenicUrl(primary);
    if (!fb) return 'src="' + src + '"';
    return (
      'src="' +
      src +
      '" data-home-rec-fallback="' +
      escapeAttr(encodeAssetPathForSrc(fb)) +
      '" onerror="if(this.dataset.homeRecFb)return;this.dataset.homeRecFb=1;var u=this.getAttribute(\'data-home-rec-fallback\');if(u)this.src=u"'
    );
  }

  /** 由 Node 接口扫描 assets 后合并；失败时为 null，回退静态 HOTEL_LIST / SCENIC_LIST */
  var HOTEL_MERGED = null;
  var SCENIC_MERGED = null;

  function basenameNoExtFromUrl(url) {
    var tail = (String(url).split("/").pop() || "").replace(/\.(jpe?g|png|webp|gif)$/i, "");
    return tail || "推荐";
  }

  function hotelInferRegion(url) {
    var s = String(url || "").toLowerCase();
    var parts = String(url || "").split("/");
    var mid = parts.slice(2, Math.max(2, parts.length - 1)).join("/").toLowerCase();
    var blob = s + " " + mid;
    if (/\/wl\/|\/武隆\/|\b武隆\b|仙女山|天生三桥|喀斯特|龙水|玉屏/.test(blob)) return "wl";
    if (/\/sx\/|\/三峡\/|万州|奉节|巫山|巫溪|开州|梁平|城口|丰都|云阳|长寿|三峡|兰英|小三峡/.test(blob)) return "sx";
    if (/\/se\/|酉阳|秀山|彭水|黔江|石柱|边城|阿依河|濯水|土家|苗族/.test(blob)) return "se";
    if (/\/cq\/|解放碑|洪崖洞|两江|渝中|江北|南岸|大渡口|沙坪坝|九龙坡|北碚|山城|主城/.test(blob)) return "cq";
    return "cq";
  }

  function scenicBasenameKey(url) {
    return basenameNoExtFromUrl(url).toLowerCase();
  }

  function mergeUniqueUrls(arrays) {
    var out = [];
    arrays.forEach(function (list) {
      (list || []).forEach(function (u) {
        if (u && out.indexOf(u) === -1) out.push(u);
      });
    });
    return out;
  }

  function loadHomeRecFromServer() {
    if (typeof fetch === "undefined") {
      return Promise.resolve();
    }
    if (typeof window !== "undefined" && window.location && window.location.protocol === "file:") {
      try {
        console.warn(
          "智渝游：当前为本地文件打开方式，无法请求图片列表接口。请在含 package.json 的目录执行 npm start，用 http://localhost:端口 打开首页。"
        );
      } catch (e) {}
      return Promise.resolve();
    }
    function fetchDir(dir) {
      var u = siteApiHomeAssetImages(dir);
      if (!u) return Promise.resolve({ urls: [] });
      return fetch(u).then(function (r) {
        return r.ok ? r.json() : { urls: [] };
      });
    }
    return Promise.all([
      fetchDir("首页酒店"),
      fetchDir("首页酒店和景区"),
      fetchDir("首页景区"),
    ])
      .then(function (results) {
        /** 酒店推荐只合并「首页酒店」「首页酒店和景区」；轮播图多为景区素材，勿并入酒店区 */
        var hotelUrls = mergeUniqueUrls([results[0] && results[0].urls, results[1] && results[1].urls]);
        var regions = { cq: [], wl: [], se: [], sx: [] };
        ["cq", "wl", "se", "sx"].forEach(function (reg) {
          (HOTEL_LIST[reg] || []).forEach(function (h) {
            regions[reg].push({ name: h.name, stars: h.stars, img: h.img });
          });
        });
        var hotelImgSeen = {};
        ["cq", "wl", "se", "sx"].forEach(function (reg) {
          regions[reg].forEach(function (h) {
            hotelImgSeen[h.img] = 1;
          });
        });
        hotelUrls.forEach(function (url) {
          if (hotelImgSeen[url]) return;
          if (String(url).indexOf("assets/首页轮播图/") === 0) return;
          hotelImgSeen[url] = 1;
          var reg = hotelInferRegion(url);
          regions[reg].push({
            name: basenameNoExtFromUrl(url),
            stars: 4,
            img: url,
          });
        });
        HOTEL_MERGED = regions;

        var scenicUrls = mergeUniqueUrls([
          results[2] && results[2].urls,
          results[1] && results[1].urls,
        ]);
        var scenicOut = SCENIC_LIST.map(function (s) {
          return { name: s.name, tag: s.tag, img: s.img };
        });
        var seenBn = {};
        scenicOut.forEach(function (s) {
          seenBn[scenicBasenameKey(s.img)] = true;
        });
        scenicUrls.forEach(function (url) {
          var bn = scenicBasenameKey(url);
          if (seenBn[bn]) return;
          seenBn[bn] = true;
          scenicOut.push({
            name: basenameNoExtFromUrl(url),
            tag: "本地素材",
            img: url,
          });
        });
        SCENIC_MERGED = scenicOut;
      })
      .catch(function () {
        HOTEL_MERGED = null;
        SCENIC_MERGED = null;
      });
  }

  function formatDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parseDate(s) {
    var p = String(s || "").split("-");
    if (p.length !== 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  function nightsBetween(a, b) {
    if (!a || !b) return 1;
    var ms = b.getTime() - a.getTime();
    var n = Math.round(ms / (24 * 60 * 60 * 1000));
    return n < 1 ? 1 : n;
  }

  function starHtml(n) {
    var s = Math.min(5, Math.max(1, Math.round(n)));
    var out = "";
    for (var i = 0; i < s; i += 1) out += "★";
    for (var j = s; j < 5; j += 1) out += "☆";
    return '<span class="home-rec-stars" aria-label="' + s + ' 星级">' + out + "</span>";
  }

  function renderHotelCards(region) {
    var reg = region || "cq";
    var list;
    if (HOTEL_MERGED && HOTEL_MERGED[reg] && HOTEL_MERGED[reg].length) {
      list = HOTEL_MERGED[reg];
    } else {
      list = HOTEL_LIST[reg] || HOTEL_LIST.cq;
    }
    var track = $("#hotelRecTrack");
    if (!track) return;
    track.innerHTML = list
      .map(function (h) {
        return (
          '<article class="home-rec-card">' +
          '<div class="home-rec-card__media"><img ' +
          homeRecImgAttrs(h.img) +
          ' alt="" loading="lazy" /></div>' +
          '<div class="home-rec-card__body">' +
          '<h4 class="home-rec-card__title">' +
          h.name +
          "</h4>" +
          starHtml(h.stars) +
          "</div></article>"
        );
      })
      .join("");
  }

  function bindCarousel(viewportSel, prevSel, nextSel) {
    var vp = $(viewportSel);
    var prev = $(prevSel);
    var next = $(nextSel);
    if (!vp || !prev || !next) return;
    var step = function (dir) {
      var w = vp.clientWidth * 0.85;
      vp.scrollBy({ left: dir * w, behavior: "smooth" });
    };
    prev.addEventListener("click", function () {
      step(-1);
    });
    next.addEventListener("click", function () {
      step(1);
    });
  }

  function goPlanner(qs) {
    window.location.href = "planner" + (qs ? "?" + qs : "");
  }

  function initDates() {
    var cin = document.getElementById("hotelCheckin");
    var cout = document.getElementById("hotelCheckout");
    var nightsEl = document.getElementById("hotelNights");
    if (!cin || !cout) return;
    var t = new Date();
    var t1 = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    var t2 = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2);
    cin.value = formatDate(t1);
    cout.value = formatDate(t2);
    function updateNights() {
      if (!nightsEl) return;
      var a = parseDate(cin.value);
      var b = parseDate(cout.value);
      if (a && b && b <= a) {
        cout.value = formatDate(new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1));
        b = parseDate(cout.value);
      }
      nightsEl.textContent = nightsBetween(a, b || a) + " 晚";
    }
    updateNights();
    cin.addEventListener("change", updateNights);
    cout.addEventListener("change", updateNights);
  }

  function initServiceTabs() {
    var tabs = document.querySelectorAll(".home-booking-type");
    var hotelPanel = document.getElementById("homePanelHotel");
    var scenicPanel = document.getElementById("homePanelScenic");
    if (!tabs.length || !hotelPanel || !scenicPanel) return;
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panel = btn.getAttribute("data-panel");
        tabs.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        var showHotel = panel === "hotel";
        hotelPanel.hidden = !showHotel;
        scenicPanel.hidden = showHotel;
      });
    });
  }

  function initHotelSearch() {
    var btn = document.getElementById("hotelSearchBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var city = document.getElementById("hotelCity");
      var kw = document.getElementById("hotelKeyword");
      var cin = document.getElementById("hotelCheckin");
      var cout = document.getElementById("hotelCheckout");
      var rooms = document.getElementById("hotelRooms");
      var star = document.getElementById("hotelStar");

      var text = "";
      if (city && city.value) text += String(city.value);
      if (kw && kw.value) text += " " + String(kw.value);
      text = text.trim();
      if (!text) {
        alert("请输入目的地（城市/酒店名称），再点击搜索。");
        return;
      }

      var t = text.toLowerCase();

      function pickHotelRegion(input) {
        // 简化规则：通过关键字判断属于哪条区域线
        if (/(武隆|仙女山|天生三桥|龙水|玉屏)/.test(input)) return "wl";
        if (/(万州|奉节|巫山|巫溪|开州|梁平|城口|丰都|云阳|长寿)/.test(input)) return "sx";
        if (/(酉阳|秀山|彭水|黔江|石柱|土家|苗族)/.test(input)) return "se";
        return "cq";
      }

      function setActiveRegion(region) {
        var tabs = document.querySelectorAll(".home-rec-tab");
        var track = $("#hotelRecTrack");
        tabs.forEach(function (tab) {
          var on = tab.getAttribute("data-region") === region;
          tab.classList.toggle("is-active", on);
        });
        renderHotelCards(region);
        if (track) track.scrollLeft = 0;

        // 滚动到“酒店推荐”区域，避免用户不在可视范围内看不到结果
        try {
          var titles = document.querySelectorAll(".home-rec-block__title");
          var hotelTitle = Array.prototype.slice.call(titles).find(function (el) {
            return el && String(el.textContent || "").indexOf("酒店推荐") !== -1;
          });
          var block = hotelTitle && hotelTitle.closest ? hotelTitle.closest(".home-rec-block") : null;
          if (block && block.scrollIntoView) block.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) {}
      }

      var region = pickHotelRegion(text);
      setActiveRegion(region);
    });
  }

  function initScenicSearch() {
    var btn = document.getElementById("scenicSearchBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var dest = document.getElementById("scenicDest");
      var date = document.getElementById("scenicDate");
      var ticket = document.getElementById("scenicTicket");
      var num = document.getElementById("scenicNum");
      var q =
        "intent=scenic" +
        "&dest=" +
        encodeURIComponent((dest && dest.value) || "") +
        "&date=" +
        encodeURIComponent((date && date.value) || "") +
        "&ticket=" +
        encodeURIComponent((ticket && ticket.value) || "") +
        "&num=" +
        encodeURIComponent((num && num.value) || "");
      goPlanner(q);
    });
  }

  function initHotelRegionTabs() {
    var tabs = document.querySelectorAll(".home-rec-tab");
    var track = $("#hotelRecTrack");
    if (!tabs.length || !track) return;
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var region = tab.getAttribute("data-region");
        tabs.forEach(function (t) {
          t.classList.toggle("is-active", t === tab);
        });
        renderHotelCards(region || "cq");
        track.scrollLeft = 0;
      });
    });
  }

  function renderScenicCarousel() {
    var track = $("#scenicRecTrack");
    if (!track) return;
    var list = SCENIC_MERGED && SCENIC_MERGED.length ? SCENIC_MERGED : SCENIC_LIST;
    track.innerHTML = list.map(function (s) {
      return (
        '<article class="home-rec-card home-rec-card--scenic">' +
        '<div class="home-rec-card__media"><img ' +
        homeRecImgAttrs(s.img) +
        ' alt="" loading="lazy" /></div>' +
        '<div class="home-rec-card__body">' +
        '<span class="home-rec-card__tag">' +
        s.tag +
        "</span>" +
        '<h4 class="home-rec-card__title">' +
        s.name +
        "</h4>" +
        '<a class="home-rec-card__link" href="vr">查看导览</a>' +
        "</div></article>"
      );
    }).join("");
  }

  function boot() {
    initServiceTabs();
    initDates();
    initHotelSearch();
    initScenicSearch();
    initHotelRegionTabs();

    // 支持从搜索结果直接定位到“酒店推荐”区域（仅 URL 显式带 hotelRegion 时才滚动，避免打开首页就跳到底部）
    var params = new URLSearchParams(window.location.search);
    var scrollToHotelRec = params.has("hotelRegion");
    var hotelRegion = params.get("hotelRegion") || "cq";
    var validRegions = { cq: true, wl: true, se: true, sx: true };
    if (!validRegions[hotelRegion]) hotelRegion = "cq";

    // 同步激活样式
    var tabs = document.querySelectorAll(".home-rec-tab");
    tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-region") === hotelRegion);
    });

    function paintHomeRec() {
      renderHotelCards(hotelRegion);
      renderScenicCarousel();
      if (!scrollToHotelRec) return;
      try {
        var titles = document.querySelectorAll(".home-rec-block__title");
        var hotelTitle = Array.prototype.slice.call(titles).find(function (el) {
          return el && String(el.textContent || "").indexOf("酒店推荐") !== -1;
        });
        var block = hotelTitle && hotelTitle.closest ? hotelTitle.closest(".home-rec-block") : null;
        if (block && block.scrollIntoView) {
          block.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (e) {}
    }

    loadHomeRecFromServer().then(paintHomeRec, paintHomeRec);

    bindCarousel("#hotelRecViewport", "#hotelRecPrev", "#hotelRecNext");
    bindCarousel("#scenicRecViewport", "#scenicRecPrev", "#scenicRecNext");

    var scenicDate = document.getElementById("scenicDate");
    if (scenicDate && !scenicDate.value) {
      var t = new Date();
      scenicDate.value = formatDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 3));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
