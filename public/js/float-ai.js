(function () {
  "use strict";

  if (document.getElementById("zyyAiAssistant")) return;

  var wrap = document.createElement("div");
  wrap.className = "zyy-ai-wrap";
  wrap.id = "zyyAiAssistant";
  wrap.innerHTML =
    '<button type="button" class="zyy-ai-pet" id="zyyAiPet" aria-expanded="false" aria-controls="zyyAiPanel" style="background:transparent;border:none;padding:0;cursor:grab;display:block;line-height:0;">' +
    '<img class="zyy-ai-pet-img" src="assets/ai\u5f62\u8c61.png" alt="\u5c0f\u667a" draggable="false" />' +
    "</button>" +
    '<section class="zyy-ai-panel" id="zyyAiPanel" aria-label="\u60ac\u6d6eAI\u52a9\u624b" hidden>' +
    '<header class="zyy-ai-head"><h2>\u5c0f\u667a AI \u52a9\u624b</h2><div><button type="button" id="zyyAiFull" aria-label="\u6253\u5f00\u6e1d\u5c0f\u667a\u5168\u5c4f\u4f1a\u8bdd" title="\u5168\u5c4f\u4f1a\u8bdd">\u26f6</button><button type="button" id="zyyAiReset" aria-label="\u91cd\u7f6e\u5bf9\u8bdd">\u91cd\u7f6e</button><button type="button" id="zyyAiClose" aria-label="\u5173\u95ed">\u00d7</button></div></header>' +
    '<div class="zyy-ai-msgs" id="zyyAiMsgs"></div>' +
    '<form class="zyy-ai-form" id="zyyAiForm"><input id="zyyAiInput" type="text" placeholder="\u6bd4\u5982\uff1a\u4e24\u5929\u4eb2\u5b50\u8def\u7ebf\u600e\u4e48\u5b89\u6392\uff1f" /><button type="submit" id="zyyAiSend">\u53d1\u9001</button></form>' +
    "</section>";

  document.body.appendChild(wrap);

  var fab = document.getElementById("zyyAiPet");
  var panel = document.getElementById("zyyAiPanel");
  var closeBtn = document.getElementById("zyyAiClose");
  var resetBtn = document.getElementById("zyyAiReset");
  var fullBtn = document.getElementById("zyyAiFull");
  var msgs = document.getElementById("zyyAiMsgs");
  var form = document.getElementById("zyyAiForm");
  var input = document.getElementById("zyyAiInput");
  var sendBtn = document.getElementById("zyyAiSend");
  var systemPrompt = "";
  var defaultPrompt =
    "使用简洁中文与 Markdown 输出；总计≤6行，能列表不用长段；每行≤30字；先结论，再要点，必要时给一步操作；必要时用**加粗**。";
  fetch("prompts/assistant.md")
    .then(function (r) {
      if (!r.ok) return "";
      return r.text();
    })
    .then(function (t) {
      systemPrompt = (t || "").trim() || defaultPrompt;
    })
    .catch(function () {
      systemPrompt = defaultPrompt;
    });
  var dialogState = {
    turns: [],
    profile: {
      days: null,
      people: null,
      prefs: new Set(),
      destination: "",
    },
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderMarkdown(src) {
    var t = escapeHtml(src || "");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    var lines = t.split(/\r?\n/);
    var out = [];
    var inList = false;
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (/^-\s+/.test(line)) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push("<li>" + line.replace(/^-+\s+/, "") + "</li>");
      } else if (line) {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push("<p>" + line + "</p>");
      }
    }
    if (inList) out.push("</ul>");
    return out.join("");
  }

  function addStreamMsg() {
    var item = document.createElement("div");
    item.className = "zyy-ai-msg zyy-ai-msg--bot";
    var content = document.createElement("div");
    item.appendChild(content);
    msgs.appendChild(item);
    msgs.scrollTop = msgs.scrollHeight;
    var buf = "";
    return {
      append: function (t) {
        buf += t || "";
        content.innerHTML = renderMarkdown(buf);
        msgs.scrollTop = msgs.scrollHeight;
      },
      set: function (t) {
        buf = t || "";
        content.innerHTML = renderMarkdown(buf);
        msgs.scrollTop = msgs.scrollHeight;
      },
      finalize: function () {
        return buf;
      }
    };
  }

  function addMsg(text, role) {
    var item = document.createElement("div");
    item.className = "zyy-ai-msg zyy-ai-msg--" + role;
    if (role === "bot") {
      item.innerHTML = renderMarkdown(text);
    } else {
      item.textContent = text;
    }
    msgs.appendChild(item);
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* 与渝小智全屏页(/chat)共用同一份会话存储:桌宠对话同步进固定的「桌宠小智」会话 */
  var PET_SESSION_ID = "zyy_pet_session";
  var petStorePhone = null;

  function petStoreKey(cb) {
    if (petStorePhone) return cb("zyy_chat_sessions_" + petStorePhone);
    if (!window.ZYYAuth || !ZYYAuth.getToken()) return cb(null);
    ZYYAuth.fetchMe().then(function (data) {
      var phone = data && data.user && data.user.phone;
      if (phone) petStorePhone = phone;
      cb(phone ? "zyy_chat_sessions_" + phone : null);
    }).catch(function () { cb(null); });
  }

  function syncPetTurn(role, text) {
    if (!text) return;
    petStoreKey(function (key) {
      if (!key) return;
      var sessions = [];
      try { sessions = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
      if (!Array.isArray(sessions)) sessions = [];
      var s = null;
      for (var i = 0; i < sessions.length; i++) {
        if (sessions[i].id === PET_SESSION_ID) { s = sessions[i]; break; }
      }
      if (!s) {
        s = { id: PET_SESSION_ID, title: "桌宠小智", updatedAt: 0, messages: [] };
        sessions.unshift(s);
      }
      s.messages.push({ role: role === "bot" ? "assistant" : "user", content: text });
      if (s.messages.length > 80) s.messages = s.messages.slice(-80);
      s.updatedAt = Date.now();
      sessions.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      try { localStorage.setItem(key, JSON.stringify(sessions.slice(0, 50))); } catch (e) {}
    });
  }

  function clearPetSession() {
    petStoreKey(function (key) {
      if (!key) return;
      var sessions = [];
      try { sessions = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
      if (!Array.isArray(sessions)) sessions = [];
      sessions = sessions.filter(function (s) { return s.id !== PET_SESSION_ID; });
      try { localStorage.setItem(key, JSON.stringify(sessions)); } catch (e) {}
    });
  }

  function rememberTurn(role, text) {
    dialogState.turns.push({ role: role, text: text, ts: Date.now() });
    if (dialogState.turns.length > 12) {
      dialogState.turns = dialogState.turns.slice(dialogState.turns.length - 12);
    }
  }

  function updateProfileFromQuery(text) {
    var t = text || "";
    var daysMatch = t.match(/(\d+)\s*天/);
    if (daysMatch) {
      var days = parseInt(daysMatch[1], 10);
      if (!isNaN(days) && days > 0 && days <= 15) dialogState.profile.days = days;
    }
    var peopleMatch = t.match(/(\d+)\s*(人|位)/);
    if (peopleMatch) {
      var people = parseInt(peopleMatch[1], 10);
      if (!isNaN(people) && people > 0 && people <= 99) dialogState.profile.people = people;
    }

    var prefDict = [
      { key: "亲子", re: /亲子|孩子|娃/ },
      { key: "摄影", re: /摄影|拍照|出片/ },
      { key: "徒步", re: /徒步|爬山|户外/ },
      { key: "美食", re: /美食|吃|餐|火锅/ },
      { key: "人文", re: /人文|历史|古镇|文化/ },
      { key: "避暑", re: /避暑|凉快|清凉/ },
    ];
    prefDict.forEach(function (p) {
      if (p.re.test(t)) dialogState.profile.prefs.add(p.key);
    });

    var regions = [
      "渝中区","大渡口区","江北区","沙坪坝区","九龙坡区","南岸区","北碚区","綦江区","大足区",
      "渝北区","巴南区","黔江区","长寿区","江津区","合川区","永川区","南川区","璧山区","铜梁区",
      "潼南区","荣昌区","开州区","梁平区","武隆区","万州区","涪陵区","城口县","丰都县","垫江县",
      "忠县","云阳县","奉节县","巫山县","巫溪县","石柱土家族自治县","秀山土家族苗族自治县",
      "酉阳土家族苗族自治县","彭水苗族土家族自治县"
    ];
    for (var i = 0; i < regions.length; i += 1) {
      if (t.indexOf(regions[i]) !== -1) {
        dialogState.profile.destination = regions[i];
        break;
      }
    }
  }

  function profileHint() {
    var p = dialogState.profile;
    var parts = [];
    if (p.days) parts.push(p.days + "天");
    if (p.people) parts.push(p.people + "人");
    if (p.destination) parts.push("目的地" + p.destination);
    if (p.prefs.size) parts.push("偏好" + Array.from(p.prefs).join("、"));
    return parts.length ? "（已记录：" + parts.join("，") + "）" : "";
  }

  function localReply(q) {
    var t = (q || "").trim();
    updateProfileFromQuery(t);
    var hint = profileHint();
    if (!t) return "\u91cd\u5e86\u51fa\u884c\u5efa\u8bae\uff1a\u4f18\u5148\u5728\u8def\u7ebf\u9875\u9009\u5b9a\u5929\u6570\u3001\u4eba\u6570\u548c\u76ee\u7684\u5730\uff0c\u518d\u4e00\u952e\u751f\u6210\u884c\u7a0b\u3002" + hint;
    if (/\u4eb2\u5b50|\u5b69\u5b50|\u5a03/.test(t)) {
      return "\u4eb2\u5b50\u51fa\u884c\u53ef\u4f18\u5148\u9009\u62e9\u5408\u5ddd\u3001\u5317\u789a\u3001\u6b66\u9686\u7b49\u65b9\u5411\uff0c\u8282\u594f\u66f4\u8212\u7f13\u3002\u53ef\u5728\u8def\u7ebf\u89c4\u5212\u9875\u52fe\u9009\u201c\u4eb2\u5b50\u201d\u5feb\u901f\u751f\u6210\u3002" + hint;
    }
    if (/\u6444\u5f71|\u62cd\u7167|\u51fa\u7247/.test(t)) {
      return "\u6444\u5f71\u5efa\u8bae\u5173\u6ce8\u6e1d\u4e2d\u591c\u666f\u3001\u6b66\u9686\u5730\u8c8c\u3001\u5deb\u5c71\u5ce1\u8c37\u65b9\u5411\uff0c\u5e76\u5c3d\u91cf\u5728\u65e9\u665a\u5149\u7ebf\u65f6\u6bb5\u5230\u8fbe\u89c2\u666f\u70b9\u3002" + hint;
    }
    if (/\u533a|\u53bf|\u76ee\u7684\u5730/.test(t)) {
      return "\u8def\u7ebf\u89c4\u5212\u9875\u7684\u201c\u76ee\u7684\u5730\u7b5b\u9009\u201d\u5df2\u5305\u542b\u91cd\u5e86\u5168\u90e8\u533a\u53bf\uff0c\u53ef\u76f4\u63a5\u6307\u5b9a\u76ee\u7684\u5730\u518d\u751f\u6210\u884c\u7a0b\u3002" + hint;
    }
    if (/\u6a21\u578b|3d|AR|VR|\u5bfc\u89c8/.test(t)) {
      return "VR \u9875\u652f\u6301\u6309\u666f\u70b9\u9009\u62e9 3D \u6a21\u578b\uff0c\u70b9\u51fb\u201c\u67e5\u770b\u8be5\u666f\u70b9\u6a21\u578b\u201d\u5373\u53ef\u9884\u89c8\u5e76\u67e5\u770b\u6545\u4e8b\u89e3\u8bf4\u3002" + hint;
    }
    if (/\u7f8e\u98df|\u7279\u4ea7|\u76f4\u8d2d|\u4e70/.test(t)) {
      return "\u53ef\u5728\u201c\u519c\u4ea7\u54c1\u76f4\u8d2d\u201d\u9875\u9762\u9009\u8d2d\u91cd\u5e86\u4e61\u9547\u7279\u4ea7\uff0c\u652f\u6301\u52a0\u5165\u8d2d\u7269\u8f66\u6f14\u793a\u6d41\u7a0b\u3002" + hint;
    }
    if (/\u600e\u4e48\u5b89\u6392|\u8def\u7ebf|\u884c\u7a0b|\u89c4\u5212/.test(t)) {
      var p = dialogState.profile;
      var base = "\u53ef\u6309\u201c\u4e0a\u5348\u8f7b\u89c2\u5149 + \u4e0b\u5348\u91cd\u4f53\u9a8c + \u665a\u4e0a\u4f11\u95f2\u201d\u8fd9\u79cd\u7ed3\u6784\u89c4\u5212\u3002";
      if (p.days) base = "\u4f60\u8fd9\u6b21 " + p.days + "\u5929\u884c\u7a0b\u53ef\u8003\u8651\u201c1 \u4e2a\u6838\u5fc3\u533a\u53bf + 1 \u4e2a\u90ca\u91ce\u8282\u70b9/\u5929\u201d\uff0c\u907f\u514d\u8fc7\u5ea6\u8d76\u8def\u3002";
      return base + "\u5efa\u8bae\u5728 AI \u8def\u7ebf\u89c4\u5212\u9875\u9009\u62e9\u76ee\u7684\u5730\u548c\u504f\u597d\u540e\u751f\u6210\u8be6\u7ec6\u65f6\u95f4\u8f74\u3002" + hint;
    }
    return "\u5efa\u8bae\u4f18\u5148\u9009\u5b9a\u4e00\u4e2a\u76ee\u7684\u533a\u53bf\uff0c\u518d\u6309\u201c\u4e0a\u5348\u89c2\u5149-\u4e0b\u5348\u4f53\u9a8c-\u665a\u95f4\u4f11\u95f2\u201d\u7684\u8282\u594f\u5b89\u6392\u3002VR \u9875\u53ef\u5148\u770b\u666f\u70b9 3D \u6a21\u578b\uff0c\u8def\u7ebf\u9875\u518d\u751f\u6210\u5b8c\u6574\u65f6\u95f4\u8f74\u3002" + hint;
  }

  function ensureWrapPosition() {
    wrap.style.position = "fixed";
    wrap.style.zIndex = "9999";
    var posRaw = null;
    try {
      posRaw = localStorage.getItem("zyyAiPos");
    } catch (_) {}
    if (posRaw) {
      try {
        var p = JSON.parse(posRaw);
        if (typeof p.left === "number" && typeof p.top === "number") {
          var padding = 8;
          var maxL = Math.max(padding, window.innerWidth - wrap.offsetWidth - padding);
          var maxT = Math.max(padding, window.innerHeight - wrap.offsetHeight - padding);
          var left = Math.min(Math.max(p.left, padding), maxL);
          var top = Math.min(Math.max(p.top, padding), maxT);
          wrap.style.left = left + "px";
          wrap.style.top = top + "px";
          wrap.style.right = "auto";
          wrap.style.bottom = "auto";
          return;
        }
      } catch (_) {}
    }
    wrap.style.right = "20px";
    wrap.style.bottom = "20px";
  }

  function clampWrapInViewport() {
    var padding = 8;
    var rect = wrap.getBoundingClientRect();
    var maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
    var maxTop = Math.max(padding, window.innerHeight - rect.height - padding);
    var nextLeft = rect.left;
    var nextTop = rect.top;

    if (nextLeft < padding) nextLeft = padding;
    if (nextTop < padding) nextTop = padding;
    if (nextLeft > maxLeft) nextLeft = maxLeft;
    if (nextTop > maxTop) nextTop = maxTop;

    wrap.style.left = nextLeft + "px";
    wrap.style.top = nextTop + "px";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
  }

  function setLoading(loading) {
    input.disabled = loading;
    sendBtn.disabled = loading;
    if (resetBtn) resetBtn.disabled = loading;
    sendBtn.textContent = loading ? "\u2026" : "\u53d1\u9001";
  }

  function openPanel(open) {
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    if (open) {
      clampWrapInViewport();
      window.requestAnimationFrame(clampWrapInViewport);
      input.focus();
    }
  }

  function clearDialogState() {
    dialogState.turns = [];
    dialogState.profile.days = null;
    dialogState.profile.people = null;
    dialogState.profile.destination = "";
    dialogState.profile.prefs.clear();
  }

  function initDrag() {
    ensureWrapPosition();
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    var lastDragTime = 0;
    function point(e) {
      var t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }
    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }
    function onDown(e) {
      var p = point(e);
      var rect = wrap.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = p.x;
      startY = p.y;
      startLeft = rect.left;
      startTop = rect.top;
      fab.style.cursor = "grabbing";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var p = point(e);
      var nx = startLeft + (p.x - startX);
      var ny = startTop + (p.y - startY);
      var padding = 0;
      nx = clamp(nx, padding, Math.max(padding, window.innerWidth - wrap.offsetWidth - padding));
      ny = clamp(ny, padding, Math.max(padding, window.innerHeight - wrap.offsetHeight - padding));
      wrap.style.left = nx + "px";
      wrap.style.top = ny + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
      moved = true;
      e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      fab.style.cursor = "grab";
      if (moved) lastDragTime = Date.now();
      try {
        var pos = {
          left: parseFloat(wrap.style.left) || 0,
          top: parseFloat(wrap.style.top) || 0,
        };
        localStorage.setItem("zyyAiPos", JSON.stringify(pos));
      } catch (_) {}
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    }
    fab.addEventListener("mousedown", onDown);
    fab.addEventListener("touchstart", onDown, { passive: false });
    fab.addEventListener("click", function (ev) {
      if (Date.now() - lastDragTime < 150) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }, true);
  }

  function initPanelDrag() {
    var dragging = false;
    var moved = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    function point(e) {
      var t = e.touches && e.touches[0] ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    }
    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }
    function onDown(e) {
      if (e.target && (e.target.id === "zyyAiClose" || e.target.id === "zyyAiReset" || e.target.closest && e.target.closest("button"))) return;
      if (panel.hidden) return;
      var p = point(e);
      var rect = wrap.getBoundingClientRect();
      dragging = true;
      moved = false;
      startX = p.x;
      startY = p.y;
      startLeft = rect.left;
      startTop = rect.top;
      wrap.style.position = "fixed";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var p = point(e);
      var nx = startLeft + (p.x - startX);
      var ny = startTop + (p.y - startY);
      var pad = 0;
      var w = wrap.offsetWidth;
      var h = wrap.offsetHeight;
      nx = clamp(nx, pad, Math.max(pad, window.innerWidth - w - pad));
      ny = clamp(ny, pad, Math.max(pad, window.innerHeight - h - pad));
      wrap.style.left = nx + "px";
      wrap.style.top = ny + "px";
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
      moved = true;
      e.preventDefault();
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      try {
        var pos = {
          left: parseFloat(wrap.style.left) || 0,
          top: parseFloat(wrap.style.top) || 0
        };
        localStorage.setItem("zyyAiPos", JSON.stringify(pos));
      } catch (_) {}
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    }
    var head = panel.querySelector(".zyy-ai-head");
    if (head) {
      head.style.cursor = "move";
      head.addEventListener("mousedown", onDown);
      head.addEventListener("touchstart", onDown, { passive: false });
    }
  }

  function streamRequest(q, messages, onAppend, onDone, onReset) {
    /* 接入渝小智 Agent(/api/agent-chat):推理过程实时显示,正文流式输出 */
    if (!window.ZYYAuth || !ZYYAuth.getToken()) {
      onAppend("请先在右上角登录,登录后我就能陪你聊天了;也可以点头部 ⛶ 打开渝小智全屏会话。");
      onDone();
      return;
    }
    var cardLines = [];
    var roundHasAnswer = false; // 本轮是否已开始输出正文(正文出现则清掉推理文字)
    var streamedAnswer = false; // 是否已有正文流出
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (cardLines.length) onAppend("\n\n" + cardLines.join("\n"));
      if (!streamedAnswer && !cardLines.length) onAppend("这个问题我暂时没答上来,换个问法试试?");
      onDone();
    }
    function handleEvent(ev) {
      if (ev.type === "thinking") {
        if (ev.answer) {
          if (!roundHasAnswer) {
            roundHasAnswer = true;
            if (onReset) onReset(); // 清掉本轮推理文字,只留正文
          }
          streamedAnswer = true;
          onAppend(ev.content);
        } else if (!roundHasAnswer) {
          onAppend(ev.content); // 推理过程先展示,正文出现时会被清掉
        }
      } else if (ev.type === "clear_thinking") {
        roundHasAnswer = false;
        if (onReset) onReset(); // 中间轮(要调工具)的内容全部清掉
      } else if (ev.type === "card" && Array.isArray(ev.items)) {
        ev.items.forEach(function (it) {
          if (ev.cardType === "scenic" && it.bookingUrl) {
            cardLines.push("- [📍 " + (it.district || "景点") + " 预约/购票入口](" + it.bookingUrl + ")");
          } else if (ev.cardType === "product" && it.id) {
            cardLines.push("- [🛒 " + (it.name || "商品") + (it.price ? " ¥" + it.price : "") + "](shop-detail?id=" + encodeURIComponent(it.id) + ")");
          }
        });
      } else if (ev.type === "error") {
        onAppend((streamedAnswer ? "\n\n" : "") + "出错了:" + ev.message);
        streamedAnswer = true;
      }
    }
    ZYYAuth.authFetch("/api/agent-chat", {
      method: "POST",
      body: { messages: messages }
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (j) {
            throw new Error((j && j.error) || ("请求失败(" + r.status + ")"));
          }, function () {
            throw new Error("请求失败(" + r.status + ")");
          });
        }
        var reader = r.body.getReader();
        var decoder = new TextDecoder("utf-8");
        var buf = "";
        function pump() {
          reader.read().then(function (res) {
            if (res.done) { finish(); return; }
            buf += decoder.decode(res.value, { stream: true });
            var parts = buf.split("\n\n");
            buf = parts.pop();
            parts.forEach(function (p) {
              p.split("\n").forEach(function (line) {
                if (line.indexOf("data: ") === 0) {
                  var payload = line.slice(6);
                  if (payload === "[DONE]") return;
                  try { handleEvent(JSON.parse(payload)); } catch (_) { /* 忽略坏帧 */ }
                }
              });
            });
            pump();
          }).catch(function () { finish(); });
        }
        pump();
      })
      .catch(function (err) {
        onAppend("暂时无法连接 AI 服务。" + (err && err.message ? "\n" + err.message : ""));
        onDone();
      });
  }

  initDrag();
  initPanelDrag();

  fab.addEventListener("click", function () {
    var nowOpen = panel.hidden;
    openPanel(nowOpen);
    if (nowOpen && msgs.children.length === 0) {
      var greet =
        "\u4f60\u597d\uff0c\u6211\u662f\u6e1d\u5c0f\u667a\u3002\u53ef\u4ee5\u95ee\u6211\u91cd\u5e86\u666f\u70b9\u9884\u7ea6\u3001\u519c\u4ea7\u54c1\u76f4\u8d2d\uff0c\u6216\u8005\u8ba9\u6211\u5e2e\u4f60\u89c4\u5212\u884c\u7a0b\u3002";
      addMsg(greet, "bot");
      rememberTurn("bot", greet);
    }
  });

  closeBtn.addEventListener("click", function () {
    openPanel(false);
  });

  if (fullBtn) {
    fullBtn.addEventListener("click", function () {
      window.location.href = "/chat";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      clearDialogState();
      clearPetSession();
      msgs.innerHTML = "";
      var tip = "\u8bb0\u5fc6\u5df2\u91cd\u7f6e\u3002\u4f60\u53ef\u4ee5\u91cd\u65b0\u544a\u8bc9\u6211\u51fa\u884c\u5929\u6570\u3001\u4eba\u6570\u548c\u76ee\u7684\u5730\u3002";
      addMsg(tip, "bot");
      rememberTurn("bot", tip);
      input.focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = (input.value || "").trim();
    if (!q) return;
    input.value = "";
    addMsg(q, "user");
    setLoading(true);
    var messages = [];
    var sys = (systemPrompt || defaultPrompt).trim();
    if (sys) messages.push({ role: "system", content: sys });
    for (var i = 0; i < dialogState.turns.length; i += 1) {
      var t = dialogState.turns[i];
      var role = t.role === "user" ? "user" : "assistant";
      messages.push({ role: role, content: t.text });
    }
    messages.push({ role: "user", content: q });
    rememberTurn("user", q);
    syncPetTurn("user", q);
    var stream = addStreamMsg();
    streamRequest(q, messages, function (chunk) {
      stream.append(chunk);
    }, function () {
      var final = stream.finalize();
      rememberTurn("bot", final || "");
      syncPetTurn("bot", final || "");
      setLoading(false);
    }, function () {
      stream.set("");
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) openPanel(false);
  });

  window.addEventListener("resize", function () {
    clampWrapInViewport();
  });
})();

(function () {
  "use strict";

  if (document.getElementById("zyyBackTop")) return;

  var btn = document.createElement("button");
  btn.type = "button";
  btn.id = "zyyBackTop";
  btn.className = "zyy-back-top";
  btn.setAttribute("aria-label", "回顶部");
  btn.innerHTML =
    '<span class="zyy-back-top__icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="22" height="22" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M6 6h12"/>' +
    '<path d="M12 20V10M7 15l5-5 5 5"/>' +
    "</svg></span>" +
    '<span class="zyy-back-top__text">回顶部</span>';

  document.body.appendChild(btn);

  var revealY = 320;
  var scrollTimer = null;

  function syncVisibility() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var show = y >= revealY;
    btn.classList.toggle("is-visible", show);
    btn.setAttribute("aria-hidden", show ? "false" : "true");
  }

  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener(
    "scroll",
    function () {
      if (scrollTimer) window.cancelAnimationFrame(scrollTimer);
      scrollTimer = window.requestAnimationFrame(syncVisibility);
    },
    { passive: true }
  );

  syncVisibility();
})();
