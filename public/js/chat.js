/* 渝小智 AI 会话页:Agent 对话;模型配置存服务端,设置面板仅管理员可见 */
(function () {
  "use strict";

  var msgsBox = document.getElementById("chatMsgs");
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("chatSend");
  var newBtn = document.getElementById("chatNew");
  var sessionListEl = document.getElementById("chatSessionList");
  var micBtn = document.getElementById("chatMic");
  var fab = document.getElementById("chatSettingsFab");
  var mask = document.getElementById("chatSettingsMask");
  var closeBtn = document.getElementById("chatSettingsClose");
  var saveBtn = document.getElementById("chatSettingsSave");
  var setProvider = document.getElementById("setProvider");
  var setApiKey = document.getElementById("setApiKey");
  var setModel = document.getElementById("setModel");
  var setModelCustom = document.getElementById("setModelCustom");
  var setBaseURL = document.getElementById("setBaseURL");

  /* 与本地 cc-switch 的服务商目录一致:选定服务商后自动带出 Base URL 与模型列表 */
  var PROVIDER_PRESETS = {
    deepseek: {
      baseURL: "https://api.deepseek.com/v1",
      models: [
        { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
        { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
        { id: "deepseek-chat", name: "DeepSeek Chat(旧版)" },
      ],
    },
    xiaomi: {
      baseURL: "https://token-plan-cn.xiaomimimo.com/v1",
      models: [
        { id: "mimo-v2.5-pro", name: "MiMo v2.5 Pro" },
        { id: "mimo-v2.5", name: "MiMo v2.5" },
      ],
    },
    custom: { baseURL: "", models: [] },
  };

  var history = []; // { role: "user"|"assistant", content: string } —— 始终指向当前会话的 messages 数组
  var isAdmin = false;

  /* ---------- 会话历史(浏览器本地存储,按登录用户手机号隔离) ---------- */
  var WELCOME_MSG = "你好,我是渝小智。可以问我重庆景点预约、农产品直购,或者让我帮你规划行程。";
  var storeKey = "zyy_chat_sessions_anon";
  var sessions = [];
  var currentId = null;

  function loadSessions() {
    try { sessions = JSON.parse(localStorage.getItem(storeKey)) || []; }
    catch (e) { sessions = []; }
    if (!Array.isArray(sessions)) sessions = [];
  }

  function saveSessions() {
    try { localStorage.setItem(storeKey, JSON.stringify(sessions.slice(0, 50))); } catch (e) { /* 存储满则忽略 */ }
  }

  function currentSession() {
    for (var i = 0; i < sessions.length; i++) if (sessions[i].id === currentId) return sessions[i];
    return null;
  }

  function renderMessages() {
    msgsBox.innerHTML = "";
    if (!history.length) addMsg(WELCOME_MSG, "bot");
    history.forEach(function (m) {
      var b = addMsg(m.content, m.role === "user" ? "user" : "bot");
      if (Array.isArray(m.cards)) {
        m.cards.forEach(function (c) { renderAgentCards(b, c); });
      }
    });
  }

  function renderSessionList() {
    sessionListEl.innerHTML = "";
    sessions.forEach(function (s) {
      var li = document.createElement("li");
      li.className = "chat-session" + (s.id === currentId ? " is-active" : "");
      var title = document.createElement("span");
      title.className = "chat-session-title";
      title.textContent = s.title;
      title.addEventListener("click", function () { switchSession(s.id); });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "chat-session-del";
      del.textContent = "×";
      del.setAttribute("aria-label", "删除会话");
      del.addEventListener("click", function (e) { e.stopPropagation(); deleteSession(s.id); });
      li.appendChild(title);
      li.appendChild(del);
      li.addEventListener("click", function () { switchSession(s.id); });
      sessionListEl.appendChild(li);
    });
  }

  function newSession() {
    var s = {
      id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: "新会话",
      updatedAt: Date.now(),
      messages: [],
    };
    sessions.unshift(s);
    currentId = s.id;
    history = s.messages;
    saveSessions();
    renderSessionList();
    renderMessages();
    input.focus();
  }

  function switchSession(id) {
    if (id === currentId) return;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) {
        currentId = id;
        history = sessions[i].messages;
        break;
      }
    }
    renderSessionList();
    renderMessages();
  }

  function deleteSession(id) {
    sessions = sessions.filter(function (s) { return s.id !== id; });
    saveSessions();
    if (id === currentId) {
      if (sessions.length) { currentId = null; switchSession(sessions[0].id); }
      else newSession();
    } else {
      renderSessionList();
    }
  }

  /* 消息有更新后:自动命名、排序、持久化 */
  function touchSession(firstUserText) {
    var s = currentSession();
    if (!s) return;
    if (firstUserText && s.title === "新会话") {
      s.title = firstUserText.slice(0, 18) || "新会话";
    }
    s.updatedAt = Date.now();
    sessions.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    saveSessions();
    renderSessionList();
  }

  function initSessions() {
    function boot() {
      loadSessions();
      if (!sessions.length) newSession();
      else {
        currentId = sessions[0].id;
        history = sessions[0].messages;
        renderSessionList();
        renderMessages();
      }
    }
    if (window.ZYYAuth && ZYYAuth.getToken()) {
      ZYYAuth.fetchMe()
        .then(function (data) {
          var phone = data && data.user && data.user.phone;
          if (phone) storeKey = "zyy_chat_sessions_" + phone;
        })
        .catch(function () { /* 网络异常按匿名处理 */ })
        .then(boot);
    } else {
      boot();
    }
  }

  /* ---------- 登录与管理员状态 ---------- */
  function detectAdmin() {
    if (!window.ZYYAuth || !ZYYAuth.getToken()) return;
    // fetchMe 直接返回解析后的 JSON(或 null),不是 Response 对象
    ZYYAuth.fetchMe()
      .then(function (data) {
        if (data && data.user && data.user.isAdmin) {
          isAdmin = true;
          fab.hidden = false;
        }
      })
      .catch(function () { /* 网络异常时保持隐藏 */ });
  }

  /* ---------- 简易 Markdown 渲染(与 float-ai.js 同款) ---------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderMarkdown(src) {
    var t = escapeHtml(src || "");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    var lines = t.split(/\r?\n/);
    var out = [];
    var inList = false;
    var inTable = false;
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      var isTableRow = /^\|.*\|$/.test(line);
      var isTableSep = /^\|[\s:|-]+\|$/.test(line);
      if (isTableRow && !isTableSep) {
        if (inList) { out.push("</ul>"); inList = false; }
        if (!inTable) { out.push('<table class="chat-table">'); inTable = true; }
        var cells = line.slice(1, -1).split("|");
        out.push("<tr>" + cells.map(function (c) { return "<td>" + c.trim() + "</td>"; }).join("") + "</tr>");
      } else {
        if (inTable) { out.push("</table>"); inTable = false; }
        if (/^-\s+/.test(line)) {
          if (!inList) { out.push("<ul>"); inList = true; }
          out.push("<li>" + line.replace(/^-+\s+/, "") + "</li>");
        } else if (/^#{1,4}\s+/.test(line)) {
          if (inList) { out.push("</ul>"); inList = false; }
          out.push("<p><strong>" + line.replace(/^#{1,4}\s+/, "") + "</strong></p>");
        } else if (line) {
          if (inList) { out.push("</ul>"); inList = false; }
          out.push("<p>" + line + "</p>");
        }
      }
    }
    if (inList) out.push("</ul>");
    if (inTable) out.push("</table>");
    return out.join("");
  }

  function scrollBottom() {
    msgsBox.scrollTop = msgsBox.scrollHeight;
  }

  function addMsg(text, role) {
    var item = document.createElement("div");
    item.className = "chat-msg chat-msg--" + role;
    var bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    if (role === "bot") bubble.innerHTML = renderMarkdown(text);
    else bubble.textContent = text;
    item.appendChild(bubble);
    msgsBox.appendChild(item);
    scrollBottom();
    return bubble;
  }

  /* 行动卡片渲染:挂在回答气泡所在的 .chat-msg 里,跟在正文下方(会话恢复时复用) */
  function renderAgentCards(bubble, ev) {
    if (!bubble || !Array.isArray(ev.items) || !ev.items.length) return;
    var wrap = document.createElement("div");
    wrap.className = "agent-cards";
    ev.items.forEach(function (it) {
      var card = document.createElement("div");
      card.className = "agent-card agent-card--" + ev.cardType;

      if (ev.cardType === "product" && it.image) {
        var img = document.createElement("img");
        img.className = "agent-card-img";
        img.src = it.image;
        img.alt = it.name || "商品图";
        img.loading = "lazy";
        img.onerror = function () { img.remove(); };
        card.appendChild(img);
      }

      var title = document.createElement("div");
      title.className = "agent-card-title";
      var meta = document.createElement("div");
      meta.className = "agent-card-meta";
      var btn = document.createElement("a");
      btn.className = "agent-card-btn";
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";

      if (ev.cardType === "scenic") {
        title.textContent = "📍 " + (it.district || "景点") + (it.platform ? " · " + it.platform : "");
        meta.textContent = it.note || "";
        btn.textContent = "预约 / 购票入口 →";
        btn.href = it.bookingUrl || "";
        if (!it.bookingUrl) btn = null;
      } else if (ev.cardType === "product") {
        title.textContent = "🛒 " + (it.name || "商品");
        meta.textContent = [it.region, it.spec, it.price ? "¥" + it.price : ""].filter(Boolean).join(" · ");
        btn.textContent = "去购买 →";
        btn.href = "shop-detail?id=" + encodeURIComponent(it.id || "");
        if (!it.id) btn = null;
      } else {
        return;
      }

      card.appendChild(title);
      if (meta.textContent) card.appendChild(meta);
      if (btn) card.appendChild(btn);
      wrap.appendChild(card);
    });
    if (wrap.children.length) {
      // 同一回答的多张卡片归入同一个竖排容器(在气泡右侧竖排、超高可滑动)
      var msgItem = bubble.parentElement;
      var col = msgItem.querySelector(".agent-cards-col");
      if (!col) {
        col = document.createElement("div");
        col.className = "agent-cards-col";
        msgItem.appendChild(col);
      }
      col.appendChild(wrap);
      scrollBottom();
    }
  }

  function addToolTag(name, parent, beforeEl) {
    var tag = document.createElement("div");
    tag.className = "chat-tool-tag";
    var label = name === "search_scenic_spots" ? "查询景点预约入口" :
      name === "search_farm_products" ? "查询农产品" :
      name === "web_search" ? "联网搜索" :
      name === "web_fetch" ? "读取网页" : ("调用工具 " + name);
    tag.textContent = "⚙ " + label + "…";
    if (parent) parent.insertBefore(tag, beforeEl || null);
    else msgsBox.appendChild(tag);
    scrollBottom();
    return tag;
  }

  /* ---------- 设置面板(仅管理员) ---------- */
  function guessProvider(baseURL) {
    for (var key in PROVIDER_PRESETS) {
      if (key !== "custom" && PROVIDER_PRESETS[key].baseURL === baseURL) return key;
    }
    return baseURL ? "custom" : "deepseek";
  }

  /* 按服务商填充模型下拉;自定义服务商时切换为手动输入 */
  function populateModels(providerKey, selectedId) {
    var preset = PROVIDER_PRESETS[providerKey] || PROVIDER_PRESETS.custom;
    var isCustom = providerKey === "custom";
    setModel.hidden = isCustom;
    setModelCustom.hidden = !isCustom;
    setModel.innerHTML = "";
    preset.models.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name + " (" + m.id + ")";
      setModel.appendChild(opt);
    });
    if (selectedId && !preset.models.some(function (m) { return m.id === selectedId; })) {
      var extra = document.createElement("option");
      extra.value = selectedId;
      extra.textContent = selectedId;
      setModel.appendChild(extra);
    }
    if (selectedId) setModel.value = selectedId;
  }

  async function loadSettings() {
    try {
      var resp = await ZYYAuth.authFetch("/api/admin/agent-config");
      if (!resp.ok) return;
      var cfg = await resp.json();
      var provider = guessProvider(cfg.baseURL || "");
      setProvider.value = provider;
      setApiKey.value = cfg.apiKey || "";
      setBaseURL.value = cfg.baseURL || PROVIDER_PRESETS[provider].baseURL;
      populateModels(provider, cfg.model || "");
      if (provider === "custom") setModelCustom.value = cfg.model || "";
    } catch (e) { /* 读取失败保持现状 */ }
  }

  async function saveSettings() {
    saveBtn.disabled = true;
    var model = setProvider.value === "custom" ? setModelCustom.value.trim() : setModel.value;
    try {
      var resp = await ZYYAuth.authFetch("/api/admin/agent-config", {
        method: "POST",
        body: {
          baseURL: setBaseURL.value.trim(),
          apiKey: setApiKey.value.trim(),
          model: model,
        },
      });
      var data = null;
      try { data = await resp.json(); } catch (e) { /* 非 JSON */ }
      if (!resp.ok) {
        alert((data && data.error) || "保存失败,请稍后重试");
        return;
      }
      mask.hidden = true;
    } catch (e) {
      alert("保存失败:网络异常");
    } finally {
      saveBtn.disabled = false;
    }
  }

  setProvider.addEventListener("change", function () {
    var preset = PROVIDER_PRESETS[setProvider.value] || PROVIDER_PRESETS.custom;
    setBaseURL.value = preset.baseURL;
    populateModels(setProvider.value, "");
  });

  fab.addEventListener("click", function () {
    if (!isAdmin) return;
    loadSettings();
    mask.hidden = false;
  });
  closeBtn.addEventListener("click", function () { mask.hidden = true; });
  mask.addEventListener("click", function (e) { if (e.target === mask) mask.hidden = true; });
  saveBtn.addEventListener("click", saveSettings);

  newBtn.addEventListener("click", function () {
    if (sending) return;
    newSession();
  });

  /* ---------- 语音输入(浏览器 Web Speech API,无需服务端) ---------- */
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec && micBtn) {
    micBtn.hidden = false;
    var rec = new SpeechRec();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    var voiceBase = "";
    rec.onresult = function (e) {
      var txt = "";
      for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      input.value = voiceBase + txt;
    };
    rec.onend = function () { micBtn.classList.remove("is-recording"); };
    rec.onerror = function () { micBtn.classList.remove("is-recording"); };
    micBtn.addEventListener("click", function () {
      if (micBtn.classList.contains("is-recording")) { rec.stop(); return; }
      voiceBase = input.value;
      try {
        rec.start();
        micBtn.classList.add("is-recording");
      } catch (e) { /* 重复启动忽略 */ }
    });
  }

  /* ---------- 发送与 SSE 解析 ---------- */
  var sending = false;

  function parseSseChunk(buffer, onEvent) {
    // 按空行切分 SSE 事件,返回未完成的尾部
    var parts = buffer.split("\n\n");
    var rest = parts.pop();
    for (var i = 0; i < parts.length; i++) {
      var lines = parts[i].split("\n");
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j];
        if (line.indexOf("data: ") === 0) {
          var payload = line.slice(6);
          if (payload === "[DONE]") { onEvent({ type: "done" }); }
          else {
            try { onEvent(JSON.parse(payload)); } catch (e) { /* 忽略坏帧 */ }
          }
        }
      }
    }
    return rest;
  }

  async function send(text) {
    if (!window.ZYYAuth || !ZYYAuth.getToken()) {
      addMsg("请先在右上角登录后再使用渝小智。", "bot");
      return;
    }
    history.push({ role: "user", content: text });
    touchSession(text);
    addMsg(text, "user");
    input.value = "";
    sending = true;
    sendBtn.disabled = true;

    var botBubble = null;
    var botText = "";
    var pendingCards = [];
    var answerCards = []; // 本次回答的卡片数据,随消息一起存入会话历史
    /* 思考区:月相动画 + 过程文字/工具标签,最终回答出现时被移除 */
    var thinkingBox = null;
    var thinkingTextEl = null;
    var thinkingText = "";
    var answerDraft = ""; // 仅累计带 answer 标记的正文,commit 时转正

    function ensureThinkingBox() {
      if (thinkingBox) return thinkingBox;
      thinkingBox = document.createElement("div");
      thinkingBox.className = "chat-thinking";
      var head = document.createElement("div");
      head.className = "chat-thinking-head";
      head.textContent = "正在深度思考…";
      thinkingTextEl = document.createElement("div");
      thinkingTextEl.className = "chat-thinking-text";
      thinkingBox.appendChild(head);
      thinkingBox.appendChild(thinkingTextEl);
      msgsBox.appendChild(thinkingBox);
      scrollBottom();
      return thinkingBox;
    }

    function removeThinkingBox() {
      if (thinkingBox) { thinkingBox.remove(); thinkingBox = null; thinkingTextEl = null; }
    }

    function ensureBotBubble() {
      if (!botBubble) {
        removeThinkingBox();
        botBubble = addMsg("", "bot");
        pendingCards.forEach(function (c) { renderAgentCards(botBubble, c); });
        pendingCards = [];
      }
      return botBubble;
    }

    try {
      var resp = await ZYYAuth.authFetch("/api/agent-chat", {
        method: "POST",
        body: { messages: history },
      });

      var ct = resp.headers.get("content-type") || "";
      if (!resp.ok || ct.indexOf("text/event-stream") === -1) {
        var errJson = null;
        try { errJson = await resp.json(); } catch (e) { /* 非 JSON */ }
        if (resp.status === 401) throw new Error("登录已过期,请重新登录");
        throw new Error((errJson && errJson.error) || ("请求失败: HTTP " + resp.status));
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder("utf-8");
      var buffer = "";
      var currentToolTag = null;

      for (;;) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        buffer = parseSseChunk(buffer, function (ev) {
          if (ev.type === "tool_start") {
            currentToolTag = addToolTag(ev.name, ensureThinkingBox(), thinkingTextEl);
          } else if (ev.type === "tool_done") {
            if (currentToolTag) {
              currentToolTag.textContent = currentToolTag.textContent.replace(/…$/, " ✓");
              currentToolTag = null;
            }
          } else if (ev.type === "card") {
            answerCards.push(ev);
            if (botBubble) renderAgentCards(botBubble, ev);
            else pendingCards.push(ev);
          } else if (ev.type === "thinking") {
            thinkingText += ev.content;
            if (ev.answer) answerDraft += ev.content;
            ensureThinkingBox();
            if (thinkingTextEl) thinkingTextEl.textContent = thinkingText;
            scrollBottom();
          } else if (ev.type === "clear_thinking") {
            removeThinkingBox();
            thinkingText = "";
            answerDraft = "";
          } else if (ev.type === "commit_answer") {
            botText = answerDraft;
            answerDraft = "";
            thinkingText = "";
            if (botText || pendingCards.length) {
              ensureBotBubble().innerHTML = renderMarkdown(botText);
              scrollBottom();
            } else {
              removeThinkingBox();
            }
          } else if (ev.type === "error") {
            removeThinkingBox();
            botText += (botText ? "\n\n" : "") + "出错了:" + ev.message;
            ensureBotBubble().innerHTML = renderMarkdown(botText);
            scrollBottom();
          }
        });
      }
    } catch (e) {
      removeThinkingBox();
      botText = "出错了:" + String(e && e.message ? e.message : e);
      ensureBotBubble().innerHTML = renderMarkdown(botText);
    }

    if (botText) {
      var assistantMsg = { role: "assistant", content: botText };
      if (answerCards.length) assistantMsg.cards = answerCards;
      history.push(assistantMsg);
    }
    else if (pendingCards.length) ensureBotBubble(); // 无文字但有卡片时也要把卡片展示出来
    else {
      removeThinkingBox();
      botBubble && botBubble.parentElement && botBubble.parentElement.remove();
    }
    touchSession(null);
    sending = false;
    sendBtn.disabled = false;
    input.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    var text = input.value.trim();
    if (!text) return;
    send(text);
  });

  detectAdmin();
  populateModels(setProvider.value || "deepseek", "");
  initSessions();
})();
