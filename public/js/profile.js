(function () {
  "use strict";

  var USER_KEY = "zyyCurrentUser";
  var PROFILE_EXTRA_KEY = "zyyUserProfileExtra";
  window.ZYYProfileExtraCache = window.ZYYProfileExtraCache || {};
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var AVATAR_MAX = 512;
  var COVER_MAX_W = 1600;
  var COVER_MAX_H = 900;
  var FOOTPRINT_KEY = "zyyVisitedDistricts";
  /** 无自定义头像或头像加载失败时使用（与全站 Logo 一致） */
  var DEFAULT_PROFILE_AVATAR = "assets/profile-default-avatar.png";

  var form = document.getElementById("profileForm");
  if (!form) return;

  if (window.ZYYAuth && typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
    window.ZYYAuth.clearStaleProfileExtraIfNeeded();
  }

  var msg = document.getElementById("profileMsg");
  var resetBtn = document.getElementById("profileReset");
  var previewName = document.getElementById("profileNamePreview");
  var previewBio = document.getElementById("profileBioPreview");
  var previewAvatar = document.getElementById("profileAvatarImg");
  var previewAvatarFallback = document.getElementById("profileAvatarFallback");
  var previewCover = document.getElementById("profileCoverImg");
  var previewCoverWrap = document.getElementById("profileCover");
  var previewAvatarWrap = document.getElementById("profileAvatar");
  var profileLightbox = document.getElementById("profileImageLightbox");
  var profileLightboxImg = document.getElementById("profileLightboxImg");
  var profileLightboxCaption = document.getElementById("profileLightboxCaption");
  var profileLightboxClose = document.getElementById("profileLightboxClose");
  var profileLightboxScrim = document.getElementById("profileLightboxScrim");

  var inputUsername = document.getElementById("profileUsername");
  var inputPhone = document.getElementById("profilePhone");
  var inputEmail = document.getElementById("profileEmail");
  var inputBio = document.getElementById("profileBio");
  var inputAvatarFile = document.getElementById("profileAvatarFile");
  var inputCoverFile = document.getElementById("profileCoverFile");
  var btnAvatarClear = document.getElementById("profileAvatarClear");
  var btnCoverClear = document.getElementById("profileCoverClear");

  /** @type {string} */
  var avatarData = "";
  /** @type {string} */
  var coverData = "";

  var footprintMap = document.getElementById("footprintMap");
  var footprintMapViewport = document.getElementById("footprintMapViewport");
  var footprintMode = document.getElementById("footprintMode");
  var footprintResetView = document.getElementById("footprintResetView");
  var footprintCount = document.getElementById("footprintCount");
  var footprintClear = document.getElementById("footprintClear");
  var NAME_TO_ID = {
    "万州区": "wanzhou",
    "涪陵区": "fuling",
    "渝中区": "yuzhong",
    "大渡口区": "dadukou",
    "江北区": "jiangbei",
    "沙坪坝区": "shapingba",
    "九龙坡区": "jiulongpo",
    "南岸区": "nanan",
    "北碚区": "beibei",
    "綦江区": "qijiang",
    "大足区": "dazu",
    "渝北区": "yubei",
    "巴南区": "banan",
    "黔江区": "qianjiang",
    "长寿区": "changshou",
    "江津区": "jiangjin",
    "合川区": "hechuan",
    "永川区": "yongchuan",
    "南川区": "nanchuan",
    "璧山区": "bishan",
    "铜梁区": "tongliang",
    "潼南区": "tongnan",
    "荣昌区": "rongchang",
    "开州区": "kaizhou",
    "梁平区": "liangping",
    "武隆区": "wulong",
    "城口县": "chengkou",
    "丰都县": "fengdu",
    "垫江县": "dianjiang",
    "忠县": "zhongxian",
    "云阳县": "yunyang",
    "奉节县": "fengjie",
    "巫山县": "wushan",
    "巫溪县": "wuxi",
    "石柱土家族自治县": "shizhu",
    "秀山土家族苗族自治县": "xiushan",
    "酉阳土家族苗族自治县": "youyang",
    "彭水苗族土家族自治县": "pengshui"
  };
  var DISTRICT_TOTAL = Object.keys(NAME_TO_ID).length;

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function getExtra() {
    if (window.ZYYProfileExtraCache && Object.keys(window.ZYYProfileExtraCache).length) {
      return Object.assign({}, window.ZYYProfileExtraCache);
    }
    try {
      return JSON.parse(localStorage.getItem(PROFILE_EXTRA_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  /** 写入本地缓存；若已登录则同步到服务端，返回 Promise（resolve 为 true 表示成功或无需同步） */
  function setExtra(data) {
    data = data || {};
    window.ZYYProfileExtraCache = Object.assign({}, data);
    try {
      localStorage.setItem(PROFILE_EXTRA_KEY, JSON.stringify(window.ZYYProfileExtraCache));
    } catch (e) {}
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.saveProfileExtra) {
      return window.ZYYUserData.saveProfileExtra(window.ZYYProfileExtraCache);
    }
    return Promise.resolve(true);
  }

  function getVisitedSet() {
    try {
      var list = JSON.parse(localStorage.getItem(FOOTPRINT_KEY) || "[]");
      return new Set(Array.isArray(list) ? list : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveVisitedSet(set) {
    localStorage.setItem(FOOTPRINT_KEY, JSON.stringify(Array.from(set)));
  }

  function renderFootprintCount(set) {
    if (!footprintCount) return;
    footprintCount.textContent = "已点亮 " + set.size + " / " + DISTRICT_TOTAL;
  }

  function normalizeName(name) {
    return String(name || "").replace(/\s+/g, "");
  }

  function pickPolygons(geometry) {
    if (!geometry || !geometry.type || !geometry.coordinates) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates];
    if (geometry.type === "MultiPolygon") return geometry.coordinates;
    return [];
  }

  function projectPoint(lon, lat, box) {
    var width = 760;
    var height = 460;
    var pad = 16;
    var sx = (width - pad * 2) / (box.maxLon - box.minLon || 1);
    var sy = (height - pad * 2) / (box.maxLat - box.minLat || 1);
    var s = Math.min(sx, sy);
    return {
      x: pad + (lon - box.minLon) * s,
      y: height - pad - (lat - box.minLat) * s,
    };
  }

  function getBounds(features) {
    var box = { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity };
    features.forEach(function (f) {
      pickPolygons(f.geometry).forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (pt) {
            var lon = pt[0];
            var lat = pt[1];
            if (lon < box.minLon) box.minLon = lon;
            if (lon > box.maxLon) box.maxLon = lon;
            if (lat < box.minLat) box.minLat = lat;
            if (lat > box.maxLat) box.maxLat = lat;
          });
        });
      });
    });
    return box;
  }

  function ringPath(ring, box) {
    if (!ring || !ring.length) return "";
    var p0 = projectPoint(ring[0][0], ring[0][1], box);
    var d = "M" + p0.x.toFixed(2) + " " + p0.y.toFixed(2);
    for (var i = 1; i < ring.length; i += 1) {
      var p = projectPoint(ring[i][0], ring[i][1], box);
      d += " L" + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    return d + " Z";
  }

  function shortLabel(name) {
    return normalizeName(name)
      .replace("土家族苗族自治县", "")
      .replace("苗族土家族自治县", "")
      .replace("土家族自治县", "")
      .replace("区", "")
      .replace("县", "");
  }

  function buildMapSvg(features, visited) {
    var box = getBounds(features);
    var html = '<svg class="cq-map" viewBox="0 0 760 460" role="img" aria-label="重庆真实区县边界地图">';
    html += '<g id="cqMapGroup" transform="translate(0,0) scale(1)">';
    features.forEach(function (f) {
      var name = normalizeName(f.properties && f.properties.name);
      var id = NAME_TO_ID[name];
      if (!id) return;
      var on = visited.has(id) ? " is-on" : "";
      var lit = visited.has(id) ? " is-lit" : "";
      var polys = pickPolygons(f.geometry);
      html += '<g class="footprint-district' + lit + '" data-id="' + id + '">';
      polys.forEach(function (poly) {
        var d = "";
        poly.forEach(function (ring) {
          d += ringPath(ring, box) + " ";
        });
        html += '<path class="cq-region' + on + '" data-id="' + id + '" d="' + d.trim() + '"><title>' + name + '</title></path>';
      });
      var c = f.properties && f.properties.center;
      if (c && c.length === 2) {
        var cp = projectPoint(c[0], c[1], box);
        html += '<text class="cq-label" x="' + cp.x.toFixed(1) + '" y="' + cp.y.toFixed(1) + '" text-anchor="middle">' + shortLabel(name) + "</text>";
      }
      html += "</g>";
    });
    html += "</g></svg>";
    return html;
  }

  function applyFootprintMode() {
    if (!footprintMap || !footprintMode) return;
    if (footprintMode.value === "visited") {
      footprintMap.classList.add("footprint-map--visited-only");
    } else {
      footprintMap.classList.remove("footprint-map--visited-only");
    }
  }

  function initFootprintMap() {
    if (!footprintMap) return;
    var visited = getVisitedSet();

    var mapState = { scale: 1, tx: 0, ty: 0 };
    var drag = { active: false, sx: 0, sy: 0, stx: 0, sty: 0, moved: false };
    var suppressRegionClick = false;

    function applyMapTransform() {
      var g = document.getElementById("cqMapGroup");
      if (!g) return;
      g.setAttribute(
        "transform",
        "translate(" + mapState.tx + "," + mapState.ty + ") scale(" + mapState.scale + ")"
      );
    }

    function resetMapView() {
      mapState.scale = 1;
      mapState.tx = 0;
      mapState.ty = 0;
      applyMapTransform();
    }

    function svgPointFromEvent(svg, evt) {
      var pt = svg.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function bindMapInteractions(svg) {
      if (!footprintMapViewport) return;

      footprintMapViewport.addEventListener(
        "wheel",
        function (e) {
          if (!footprintMapViewport.contains(e.target)) return;
          e.preventDefault();
          var dir = e.deltaY > 0 ? -1 : 1;
          var factor = dir > 0 ? 1.12 : 1 / 1.12;
          var s0 = mapState.scale;
          var s1 = Math.min(8, Math.max(0.35, s0 * factor));
          if (Math.abs(s1 - s0) < 1e-6) return;
          var pt = svgPointFromEvent(svg, e);
          var mx = pt.x;
          var my = pt.y;
          mapState.tx = mx - (s1 / s0) * (mx - mapState.tx);
          mapState.ty = my - (s1 / s0) * (my - mapState.ty);
          mapState.scale = s1;
          applyMapTransform();
        },
        { passive: false }
      );

      footprintMapViewport.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        if (!e.shiftKey) return;
        drag.active = true;
        drag.moved = false;
        drag.sx = e.clientX;
        drag.sy = e.clientY;
        drag.stx = mapState.tx;
        drag.sty = mapState.ty;
        footprintMapViewport.classList.add("is-dragging");
      });

      window.addEventListener("mousemove", function (e) {
        if (!drag.active) return;
        var dx = e.clientX - drag.sx;
        var dy = e.clientY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        mapState.tx = drag.stx + dx;
        mapState.ty = drag.sty + dy;
        applyMapTransform();
      });

      window.addEventListener("mouseup", function () {
        if (!drag.active) return;
        var didMove = drag.moved;
        drag.active = false;
        footprintMapViewport.classList.remove("is-dragging");
        if (didMove) suppressRegionClick = true;
      });

      footprintMapViewport.addEventListener("dblclick", function (e) {
        if (e.target.closest && e.target.closest(".cq-region")) return;
        if (!footprintMapViewport.contains(e.target)) return;
        e.preventDefault();
        resetMapView();
      });
    }

    function syncDistrictLit(id, isLit) {
      footprintMap.querySelectorAll('.footprint-district[data-id="' + id + '"]').forEach(function (g) {
        g.classList.toggle("is-lit", isLit);
      });
    }

    fetch("assets/chongqing.geojson")
      .then(function (r) { return r.json(); })
      .then(function (geo) {
        var features = (geo && geo.features) || [];
        footprintMap.innerHTML = buildMapSvg(features, visited);
        renderFootprintCount(visited);
        applyFootprintMode();

        var svg = footprintMap.querySelector("svg.cq-map");
        if (svg) bindMapInteractions(svg);

        if (footprintResetView) {
          footprintResetView.addEventListener("click", resetMapView);
        }

        footprintMap.addEventListener("click", function (e) {
          if (suppressRegionClick) {
            suppressRegionClick = false;
            return;
          }
          var region = e.target.closest(".cq-region");
          if (!region) return;
          var id = region.getAttribute("data-id");
          if (!id) return;
          if (visited.has(id)) visited.delete(id);
          else visited.add(id);
          var on = visited.has(id);
          footprintMap.querySelectorAll('.cq-region[data-id="' + id + '"]').forEach(function (el) {
            el.classList.toggle("is-on", on);
          });
          syncDistrictLit(id, on);
          saveVisitedSet(visited);
          renderFootprintCount(visited);
        });
      })
      .catch(function () {
        footprintMap.innerHTML = '<p class="footprint-tip footprint-tip--soft">地图数据暂不可用，请稍后刷新。</p>';
      });

    if (footprintMode) {
      footprintMode.addEventListener("change", applyFootprintMode);
    }

    if (footprintClear) {
      footprintClear.addEventListener("click", function () {
        visited.clear();
        footprintMap.querySelectorAll(".cq-region.is-on").forEach(function (el) {
          el.classList.remove("is-on");
        });
        footprintMap.querySelectorAll(".footprint-district.is-lit").forEach(function (el) {
          el.classList.remove("is-lit");
        });
        saveVisitedSet(visited);
        renderFootprintCount(visited);
      });
    }
  }

  function safeText(v) {
    return String(v || "").trim();
  }

  function currentData() {
    var user = getStoredUser() || {};
    var extra = getExtra();
    if (window.ZYYAuth && typeof window.ZYYAuth.profileExtraBelongsToUser === "function") {
      if (!window.ZYYAuth.profileExtraBelongsToUser(user, extra)) {
        extra = {};
      }
    }
    return {
      username: safeText(extra.username || user.username || ""),
      phone: safeText(user.phone || extra.phone || ""),
      email: safeText(extra.email || user.email || ""),
      bio: safeText(extra.bio || user.bio || ""),
      avatar: safeText(extra.avatar || user.avatar || ""),
      cover: safeText(extra.cover || user.cover || ""),
    };
  }

  function paintPreview(data) {
    previewName.textContent = data.username || "游客";
    previewBio.textContent = data.bio || "还没有填写个人简介。";

    function showAvatarLetter() {
      previewAvatar.hidden = true;
      previewAvatar.removeAttribute("src");
      previewAvatarFallback.hidden = false;
      previewAvatarFallback.textContent = (previewName.textContent || "游").slice(0, 1);
    }

    if (!previewAvatar._zyyErrBound) {
      previewAvatar._zyyErrBound = true;
      previewAvatar.addEventListener("error", function () {
        showAvatarLetter();
      });
    }

    var av = safeText(data.avatar);
    if (av) {
      previewAvatar.src = av;
      previewAvatar.hidden = false;
      previewAvatarFallback.hidden = true;
    } else {
      previewAvatar.src = DEFAULT_PROFILE_AVATAR;
      previewAvatar.hidden = false;
      previewAvatarFallback.hidden = true;
    }

    if (previewCoverWrap) {
      previewCover.onerror = function () {
        previewCover.hidden = true;
        previewCover.removeAttribute("src");
      };
    }

    if (safeText(data.cover)) {
      previewCover.src = data.cover;
      previewCover.hidden = false;
    } else {
      previewCover.hidden = true;
      previewCover.removeAttribute("src");
    }

    var canZoomAvatar = !previewAvatar.hidden && !!previewAvatar.getAttribute("src");
    var canZoomCover = !previewCover.hidden && !!previewCover.getAttribute("src");
    if (previewAvatarWrap) {
      previewAvatarWrap.classList.toggle("is-click-zoom", canZoomAvatar);
      if (canZoomAvatar) previewAvatarWrap.setAttribute("aria-label", "头像，点击查看原图");
      else previewAvatarWrap.removeAttribute("aria-label");
    }
    if (previewCoverWrap) {
      previewCoverWrap.classList.toggle("is-click-zoom", canZoomCover);
      if (canZoomCover) previewCoverWrap.setAttribute("aria-label", "顶部配图，点击查看原图");
      else previewCoverWrap.removeAttribute("aria-label");
    }
  }

  function profileLightboxOnEsc(e) {
    if (e.key === "Escape") closeProfileImageLightbox();
  }

  function openProfileImageLightbox(src, caption) {
    if (!profileLightbox || !profileLightboxImg || !src) return;
    profileLightboxImg.src = src;
    profileLightboxImg.alt = caption || "大图预览";
    if (profileLightboxCaption) profileLightboxCaption.textContent = caption || "";
    profileLightbox.hidden = false;
    document.body.style.overflow = "hidden";
    document.removeEventListener("keydown", profileLightboxOnEsc);
    document.addEventListener("keydown", profileLightboxOnEsc);
    if (profileLightboxClose) profileLightboxClose.focus();
  }

  function closeProfileImageLightbox() {
    if (!profileLightbox || !profileLightboxImg) return;
    profileLightbox.hidden = true;
    profileLightboxImg.removeAttribute("src");
    if (profileLightboxCaption) profileLightboxCaption.textContent = "";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", profileLightboxOnEsc);
  }

  function initProfileImageLightbox() {
    if (!profileLightbox || !previewAvatarWrap || !previewCoverWrap) return;
    if (profileLightbox._zyyBound) return;
    profileLightbox._zyyBound = true;

    previewAvatarWrap.addEventListener("click", function (e) {
      if (previewAvatar.hidden || !previewAvatar.getAttribute("src")) return;
      e.preventDefault();
      openProfileImageLightbox(previewAvatar.currentSrc || previewAvatar.src, "头像 · 原图预览");
    });
    previewCoverWrap.addEventListener("click", function (e) {
      if (previewCover.hidden || !previewCover.getAttribute("src")) return;
      e.preventDefault();
      openProfileImageLightbox(previewCover.currentSrc || previewCover.src, "顶部配图 · 原图预览");
    });
    if (profileLightboxClose) profileLightboxClose.addEventListener("click", closeProfileImageLightbox);
    if (profileLightboxScrim) profileLightboxScrim.addEventListener("click", closeProfileImageLightbox);
  }

  /**
   * @param {File} file
   * @param {number} maxW
   * @param {number} maxH
   * @param {number} quality
   * @returns {Promise<string>}
   */
  function compressImageToJpegDataUrl(file, maxW, maxH, quality) {
    return new Promise(function (resolve, reject) {
      var isImageMime = !file.type || file.type.indexOf("image") === 0;
      var isImageExt = /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name);
      if (!isImageMime && !isImageExt) {
        reject(new Error("请选择图片文件。"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var url = reader.result;
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var ratio = Math.min(maxW / w, maxH / h, 1);
          var cw = Math.max(1, Math.round(w * ratio));
          var ch = Math.max(1, Math.round(h * ratio));
          var canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("无法处理图片。"));
            return;
          }
          ctx.drawImage(img, 0, 0, cw, ch);
          try {
            var out = canvas.toDataURL("image/jpeg", quality);
            resolve(out);
          } catch (e) {
            reject(new Error("图片无法导出（可能受浏览器安全策略限制）。"));
          }
        };
        img.onerror = function () {
          reject(new Error("无法读取图片，请换一张试试。"));
        };
        img.src = url;
      };
      reader.onerror = function () {
        reject(new Error("读取文件失败。"));
      };
      reader.readAsDataURL(file);
    });
  }

  function fillForm(data) {
    avatarData = data.avatar || "";
    coverData = data.cover || "";
    inputUsername.value = data.username;
    inputPhone.value = data.phone;
    inputEmail.value = data.email;
    inputBio.value = data.bio;
    if (inputAvatarFile) inputAvatarFile.value = "";
    if (inputCoverFile) inputCoverFile.value = "";
    paintPreview({
      username: data.username,
      bio: data.bio,
      avatar: avatarData,
      cover: coverData,
    });
  }

  function bindLivePreview() {
    [inputUsername, inputPhone, inputEmail, inputBio].forEach(function (el) {
      el.addEventListener("input", function () {
        paintPreview({
          username: safeText(inputUsername.value),
          bio: safeText(inputBio.value),
          avatar: avatarData,
          cover: coverData,
        });
      });
    });
  }

  function saveData(data) {
    var user = getStoredUser() || {};
    user.username = data.username || user.username || "游客";
    user.phone = data.phone;
    user.email = data.email;
    user.bio = data.bio;
    user.avatar = data.avatar;
    user.cover = data.cover;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return setExtra(data);
  }

  function handleAvatarFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      msg.textContent = "头像文件过大，请选择 5MB 以内的图片。";
      return;
    }
    msg.textContent = "正在处理头像…";
    compressImageToJpegDataUrl(file, AVATAR_MAX, AVATAR_MAX, 0.82)
      .then(function (dataUrl) {
        avatarData = dataUrl;
        msg.textContent = "";
        paintPreview({
          username: safeText(inputUsername.value),
          bio: safeText(inputBio.value),
          avatar: avatarData,
          cover: coverData,
        });
      })
      .catch(function (err) {
        msg.textContent = err.message || "头像处理失败。";
      });
  }

  function handleCoverFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      msg.textContent = "配图文件过大，请选择 5MB 以内的图片。";
      return;
    }
    msg.textContent = "正在处理配图…";
    compressImageToJpegDataUrl(file, COVER_MAX_W, COVER_MAX_H, 0.75)
      .then(function (dataUrl) {
        coverData = dataUrl;
        msg.textContent = "";
        paintPreview({
          username: safeText(inputUsername.value),
          bio: safeText(inputBio.value),
          avatar: avatarData,
          cover: coverData,
        });
      })
      .catch(function (err) {
        msg.textContent = err.message || "配图处理失败。";
      });
  }

  if (inputAvatarFile) {
    inputAvatarFile.addEventListener("change", function () {
      var f = inputAvatarFile.files && inputAvatarFile.files[0];
      handleAvatarFile(f);
    });
  }
  if (inputCoverFile) {
    inputCoverFile.addEventListener("change", function () {
      var f = inputCoverFile.files && inputCoverFile.files[0];
      handleCoverFile(f);
    });
  }
  if (btnAvatarClear) {
    btnAvatarClear.addEventListener("click", function () {
      avatarData = "";
      if (inputAvatarFile) inputAvatarFile.value = "";
      paintPreview({
        username: safeText(inputUsername.value),
        bio: safeText(inputBio.value),
        avatar: "",
        cover: coverData,
      });
      msg.textContent = "已移除头像预览，保存后生效。";
    });
  }
  if (btnCoverClear) {
    btnCoverClear.addEventListener("click", function () {
      coverData = "";
      if (inputCoverFile) inputCoverFile.value = "";
      paintPreview({
        username: safeText(inputUsername.value),
        bio: safeText(inputBio.value),
        avatar: avatarData,
        cover: "",
      });
      msg.textContent = "已移除配图预览，保存后生效。";
    });
  }

  initProfileImageLightbox();
  initFootprintMap();
  fillForm(currentData());
  bindLivePreview();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      username: safeText(inputUsername.value),
      phone: safeText(inputPhone.value),
      email: safeText(inputEmail.value),
      bio: safeText(inputBio.value),
      avatar: avatarData,
      cover: coverData,
    };
    if (!data.username) {
      msg.textContent = "用户名不能为空。";
      return;
    }
    try {
      var test = JSON.stringify({ u: getStoredUser(), extra: data });
      if (test.length > 4.5 * 1024 * 1024) {
        msg.textContent = "资料体积过大，请换较小的图片或缩短简介后重试。";
        return;
      }
    } catch (err) {
      msg.textContent = "无法保存，请减小图片尺寸后重试。";
      return;
    }
    saveData(data)
      .then(function (syncOk) {
        if (syncOk === false) {
          msg.textContent = "已保存在本机，但同步到服务器失败，请检查网络或重新登录后再试。";
          return;
        }
        msg.textContent = "保存成功，导航栏和主页信息已更新。";
        paintPreview(data);
        if (typeof window.ZYYRefreshNavUser === "function") {
          window.ZYYRefreshNavUser();
        }
      })
      .catch(function () {
        msg.textContent = "已保存在本机，但同步到服务器失败，请检查网络或重新登录后再试。";
        paintPreview(data);
        if (typeof window.ZYYRefreshNavUser === "function") {
          window.ZYYRefreshNavUser();
        }
      });
  });

  resetBtn.addEventListener("click", function () {
    window.ZYYProfileExtraCache = {};
    setExtra({});
    var user = getStoredUser() || {};
    user.avatar = "";
    user.cover = "";
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    avatarData = "";
    coverData = "";
    if (inputAvatarFile) inputAvatarFile.value = "";
    if (inputCoverFile) inputCoverFile.value = "";
    fillForm(currentData());
    msg.textContent = "已清除头像与顶部配图，其他资料保留；可继续修改后保存。";
    if (typeof window.ZYYRefreshNavUser === "function") {
      window.ZYYRefreshNavUser();
    }
  });

  function escapeHtmlMini(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function renderProfileMember() {
    var el = document.getElementById("profileMemberInfo");
    if (!el) return;
    if (!window.ZYYMember) {
      el.innerHTML = '<p class="profile-member-line">无法加载会员模块。</p>';
      return;
    }
    var s = window.ZYYMember.getStatusSummary();
    if (!s.loggedIn) {
      el.innerHTML = '<p class="profile-member-line">请先在顶部登录后查看 VR 体验次数与会员状态。</p>';
      return;
    }
    if (s.isMember) {
      el.innerHTML =
        '<p class="profile-member-line">当前为 <strong>会员</strong>，有效期至 ' +
        escapeHtmlMini(s.untilText || "") +
        "。</p>" +
        '<p class="profile-member-line profile-member-line--muted">VR 导览在有效期内不限次数。</p>';
    } else {
      el.innerHTML =
        '<p class="profile-member-line">' +
        escapeHtmlMini(s.text || "") +
        "</p>" +
        '<p class="profile-member-line profile-member-line--muted">免费试用用完后，请前往「会员充值详情」开通；开通后无限次使用 VR。</p>';
    }
  }

  function renderCommunityLists() {
    var CD = window.ZYYCommunityData;
    var g1 = document.getElementById("profileLikedGrid");
    var g2 = document.getElementById("profileStarGrid");
    if (!CD || !g1 || !g2) return;

    function cardHref(p) {
      if (!p) return "#";
      if (p.fillKey) return "community-detail?fk=" + encodeURIComponent(p.fillKey);
      if (p.id) return "community-detail?id=" + encodeURIComponent(p.id);
      return "guide";
    }

    function cardHtml(p) {
      if (!p) return "";
      var href = cardHref(p);
      var title = escapeHtmlMini(p.title || "无标题");
      var img = escapeHtmlMini(p.image || "assets/hero/slide-01.png");
      var dest = escapeHtmlMini(p.destination || "");
      var likes = typeof p.likes === "number" && !isNaN(p.likes) ? p.likes : 0;
      return (
        '<a class="profile-post-card" href="' +
        escapeHtmlMini(href) +
        '">' +
        '<div class="profile-post-card__img"><img src="' +
        img +
        '" alt="" loading="lazy" /></div>' +
        '<div class="profile-post-card__body">' +
        '<span class="profile-post-card__badge">' +
        dest +
        "</span>" +
        '<span class="profile-post-card__title">' +
        title +
        "</span>" +
        '<span class="profile-post-card__meta">♥ ' +
        likes +
        "</span>" +
        "</div></a>"
      );
    }

    function fill(grid, keys) {
      if (!keys || !keys.length) {
        grid.innerHTML =
          '<p class="profile-saved-empty">这里只显示你点过「喜欢」或「收藏」的帖子。可先前往 <a class="nav-auth-link" href="guide">交流中心</a> 浏览，在帖子详情页操作后即可出现在此。</p>';
        return;
      }
      var parts = [];
      for (var i = 0; i < keys.length; i += 1) {
        var p = CD.resolvePostFromKey(keys[i]);
        var h = cardHtml(p);
        if (h) parts.push(h);
      }
      grid.innerHTML = parts.length
        ? '<div class="profile-post-grid-inner">' + parts.join("") + "</div>"
        : '<p class="profile-saved-empty">记录可能已失效。请回到 <a class="nav-auth-link" href="guide">交流中心</a> 重新浏览并收藏。</p>';
    }

    fill(g1, CD.getLikedKeys());
    fill(g2, CD.getStarredKeys());
  }

  function bindSavedTabs() {
    var tablist = document.querySelector(".profile-saved-tabs");
    if (!tablist) return;
    var tabs = tablist.querySelectorAll(".profile-saved-tab[data-tab]");
    var panelLiked = document.getElementById("profilePanelLiked");
    var panelStar = document.getElementById("profilePanelStar");
    function activate(which) {
      var isLiked = which === "liked";
      tabs.forEach(function (btn) {
        var on = btn.getAttribute("data-tab") === which;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (panelLiked) {
        panelLiked.toggleAttribute("hidden", !isLiked);
      }
      if (panelStar) {
        panelStar.toggleAttribute("hidden", isLiked);
      }
    }
    tablist.addEventListener("click", function (e) {
      var btn = e.target.closest(".profile-saved-tab[data-tab]");
      if (!btn) return;
      activate(btn.getAttribute("data-tab") || "liked");
    });
  }

  function refreshCommunityThenLists() {
    if (window.ZYYUserData && typeof window.ZYYUserData.refreshCommunityPosts === "function") {
      window.ZYYUserData.refreshCommunityPosts().then(function () {
        renderCommunityLists();
      });
    } else {
      renderCommunityLists();
    }
  }

  renderProfileMember();
  refreshCommunityThenLists();
  bindSavedTabs();
  window.addEventListener("pageshow", function () {
    renderProfileMember();
    refreshCommunityThenLists();
  });
  window.addEventListener("storage", function (e) {
    if (e.key === "zyyCommunityLikedKeys" || e.key === "zyyCommunityStarredKeys") {
      renderCommunityLists();
    }
    if (e.key === "zyyMemberPerUser") {
      renderProfileMember();
    }
  });
  window.addEventListener("zyy-member-state-updated", function () {
    renderProfileMember();
  });

  function hydrateProfileFromServer() {
    if (!window.ZYYAuth || !window.ZYYAuth.getToken() || !window.ZYYUserData) return;
    window.ZYYUserData
        .importLegacyOnce()
        .then(function () {
          return window.ZYYUserData.loadProfileExtra();
        })
        .then(function (extra) {
          if (typeof window.ZYYAuth.clearStaleProfileExtraIfNeeded === "function") {
            window.ZYYAuth.clearStaleProfileExtraIfNeeded();
          }
          var serverEx = extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {};
          var localEx = {};
          try {
            localEx = JSON.parse(localStorage.getItem(PROFILE_EXTRA_KEY) || "{}");
          } catch (e) {}
          window.ZYYProfileExtraCache = Object.assign({}, localEx, serverEx);
          try {
            localStorage.setItem(PROFILE_EXTRA_KEY, JSON.stringify(window.ZYYProfileExtraCache));
          } catch (e2) {}
          fillForm(currentData());
          paintPreview({
            username: safeText(inputUsername.value),
            bio: safeText(inputBio.value),
            avatar: avatarData,
            cover: coverData,
          });
        })
        .catch(function () {});
  }
  hydrateProfileFromServer();
})();

