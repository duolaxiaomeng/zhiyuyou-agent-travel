(function () {
  "use strict";

  var PREF_KEYS = ["family", "photo", "hike", "food", "culture", "summer"];

  var state = {
    prefs: new Set(["culture", "photo"]),
    live: { traffic: 0.5, capLt: 0.6, capAy: 0.55, capTea: 0.45 },
    confidence: parseFloat(localStorage.getItem("aiRouteConfidence") || "0.78", 10) || 0.78,
    weatherCode: null,
    weatherTemp: null,
    cart: [],
  };

  function sanitizeCartItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(function (x, idx) {
        if (!x || typeof x !== "object") return null;
        var price = Number(x.price);
        var id = x.id != null ? String(x.id) : "";
        var name = x.name != null ? String(x.name) : "";
        var uid = x.uid != null ? String(x.uid) : id + "-" + idx;
        var image = x.image != null ? String(x.image) : "";
        if (!id || !name || !isFinite(price)) return null;
        return { uid: uid, id: id, name: name, price: price, image: image };
      })
      .filter(Boolean);
  }

  function saveCartToStorage(cart) {
    cart = cart || [];
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.saveCartDebounced) {
      window.ZYYUserData.saveCartDebounced(cart);
    }
  }

  function publishCartProductIdsForPlanner() {
    if (typeof window === "undefined") return;
    var ids = new Set();
    state.cart.forEach(function (it) {
      if (it && it.id != null) ids.add(String(it.id));
    });
    window.__zyyCartProductIds = ids;
  }

  function syncCartFromStorage() {
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.loadCart) {
      window.ZYYUserData
          .importLegacyOnce()
          .then(function () {
            return window.ZYYUserData.loadCart();
          })
          .then(function (items) {
            state.cart = sanitizeCartItems(items);
            publishCartProductIdsForPlanner();
            updateCartBar();
          })
          .catch(function () {
            state.cart = [];
            publishCartProductIdsForPlanner();
            updateCartBar();
          });
      return;
    }
    try {
      localStorage.removeItem("zyyCart");
    } catch (e0) {}
    state.cart = [];
    publishCartProductIdsForPlanner();
    updateCartBar();
  }

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function parseGroupSize() {
    var el = $("groupSize");
    var raw = el ? parseInt(String(el.value), 10) : 2;
    if (isNaN(raw) || raw < 1) return 1;
    return Math.min(raw, 99);
  }

  function parseDayBudget() {
    var el = $("dayBudget");
    var raw = el ? parseInt(String(el.value), 10) : 2;
    if (isNaN(raw) || raw < 1) return 1;
    return Math.min(raw, 7);
  }

  function getDestinationLabel(destinationId) {
    var sel = $("filterDestination");
    if (!sel) return "重庆";
    var opt = sel.querySelector('option[value="' + destinationId + '"]');
    return opt && opt.textContent ? opt.textContent : "重庆";
  }

  function jitterLive() {
    state.live.traffic = clamp(state.live.traffic + (Math.random() - 0.5) * 0.12, 0.15, 0.95);
    state.live.capLt = clamp(state.live.capLt + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
    state.live.capAy = clamp(state.live.capAy + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
    state.live.capTea = clamp(state.live.capTea + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
  }

  function trafficLabel(v) {
    if (v < 0.35) return "畅通 · " + Math.round(v * 100);
    if (v < 0.6) return "轻度拥堵 · " + Math.round(v * 100);
    if (v < 0.8) return "中度拥堵 · " + Math.round(v * 100);
    return "严重拥堵 · " + Math.round(v * 100);
  }

  function capLabel(v) {
    if (v < 0.45) return "舒适 · " + Math.round(v * 100) + "%";
    if (v < 0.7) return "适中 · " + Math.round(v * 100) + "%";
    return "接近上限 · " + Math.round(v * 100) + "%";
  }

  /** 从模型正文中截取第一个 {...}，避免 JSON 后紧跟说明文字导致 parse 失败 */
  function extractFirstJsonObject(s) {
    var start = s.indexOf("{");
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var q = "";
    for (var i = start; i < s.length; i++) {
      var c = s.charAt(i);
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === "\\") {
          esc = true;
          continue;
        }
        if (c === q) {
          inStr = false;
          continue;
        }
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = true;
        q = c;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  function parseWeatherReplyContent(reply) {
    if (!reply || typeof reply !== "string") return null;
    var cleaned = reply.replace(/```json/gi, "").replace(/```/gi, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e1) {
      var slice = extractFirstJsonObject(cleaned);
      if (slice) {
        try {
          return JSON.parse(slice);
        } catch (e2) {}
      }
    }
    return null;
  }

  function fetchWeatherFromAI(destName) {
    if (!destName || destName === "智能推荐（全区域候选）") {
      destName = "重庆市";
    }
    var prompt = "请联网查询【" + destName + "】当前的实时天气。必须且只能返回合法的JSON对象，结构如下：\n" +
                 "{\n" +
                 "  \"weather\": \"晴/多云/雨等\",\n" +
                 "  \"temperature\": 25,\n" +
                 "  \"analysis\": \"简短的当地天气分析建议（如：今天紫外线较强，适合户外活动）\",\n" +
                 "  \"clothing\": \"简短的穿衣建议（如：建议穿短袖T恤，早晚加薄外套）\"\n" +
                 "}";
    var payload = {
      model: "Doubao-Seed-2.0-lite",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      extra_body: {
        enable_volc_websearch: true,
        volc_websearch_type: "web_summary"
      }
    };

    return fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var msg = (data && data.error) || r.statusText || "请求失败";
          throw new Error(msg);
        }
        return data;
      });
    })
    .then(function (data) {
      var choice = data.choices && data.choices[0];
      var reply = choice && choice.message && choice.message.content;
      var result = parseWeatherReplyContent(reply);
      if (!result) {
        throw new Error("无法解析天气 JSON");
      }
      state.weatherCode = result.weather;
      state.weatherTemp = result.temperature;
      state.weatherAnalysis = result.analysis;
      state.clothingAdvice = result.clothing;
      return result;
    })
    .catch(function(e) {
      console.error("AI 天气查询失败", e);
      state.weatherCode = "查询失败";
      state.weatherTemp = "--";
      state.weatherAnalysis = "无法获取建议";
      state.clothingAdvice = "无法获取建议";
      throw e;
    });
  }

  function weatherText(code, scenario) {
    if (scenario === "rain") return "暴雨预警 · 不建议亲水与山脊徒步";
    if (!code) return "等待查询";
    return code + " · " + state.weatherTemp + "°C";
  }

  function renderLive(scenario) {
    var wEl = $("liveWeather");
    var wSub = $("liveWeatherSub");
    var tEl = $("liveTraffic");
    var cEl = $("liveCapacity");
    var cSub = $("liveCapacitySub");
    var updated = $("liveUpdated");

    wEl.textContent = weatherText(state.weatherCode, scenario);
    wSub.textContent = state.weatherCode ? "数据源：大模型联网查询" : "等待查询";

    tEl.textContent = state.weatherAnalysis || "--";
    cEl.textContent = state.clothingAdvice || "--";

    updated.textContent = "上次更新：" + new Date().toLocaleString("zh-CN");
  }

  function renderStreamingMarkdown(el, md) {
    if (!el) return;
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      try {
        el.innerHTML = DOMPurify.sanitize(marked.parse(md, { breaks: true }));
        return;
      } catch (e) {
        console.warn("Markdown 渲染失败，回退为纯文本", e);
      }
    }
    el.textContent = md;
  }

  function showRouteFeedbackAfterStream() {
    var conf = state.confidence;
    $("adjustLog").hidden = true;
    if ($("adjustLogList")) $("adjustLogList").innerHTML = "";
    $("feedbackRow").hidden = false;
    $("feedbackScore").textContent = "策略置信度：" + (conf * 100).toFixed(1) + "%（随反馈缓慢更新）";
  }

  function initPrefs() {
    var root = $("prefChips");
    if (!root) return;
    root.querySelectorAll(".pref-chip").forEach(function (btn) {
      var key = btn.getAttribute("data-pref");
      if (state.prefs.has(key)) btn.classList.add("is-selected");
      btn.addEventListener("click", function () {
        if (state.prefs.has(key)) {
          state.prefs.delete(key);
          btn.classList.remove("is-selected");
        } else {
          state.prefs.add(key);
          btn.classList.add("is-selected");
        }
      });
    });
  }

  function initAiPlanner() {
    if (
      !$("btnGenerateRoute") ||
      !$("scenarioSim") ||
      !$("btnRefreshLive") ||
      !$("feedbackRow") ||
      !$("btnFeedbackGood") ||
      !$("btnFeedbackBad")
    ) {
      return;
    }

    initPrefs();

    $("btnGenerateRoute").addEventListener("click", function () {
      var scenario = $("scenarioSim").value;
      var destinationId = $("filterDestination") ? $("filterDestination").value : "all";
      var destLabel = getDestinationLabel(destinationId);
      var startPoint = $("startPoint") && $("startPoint").value.trim() !== "" ? $("startPoint").value.trim() : "当前位置";
      var people = parseGroupSize();
      var dayCount = parseDayBudget();
      jitterLive();
      $("rlMeterFill").style.width = "0%";
      $("adjustLog").hidden = true;

      var btn = $("btnGenerateRoute");
      btn.disabled = true;
      btn.textContent = "AI 正在深度规划中...";

      fetchWeatherFromAI(destLabel)
      .catch(function () {
        /* fetchWeatherFromAI 已写入失败态；仍继续生成路线，气温等用占位 */
      })
      .then(function () {
        renderLive(scenario);

        var meter = $("rlMeter");
        var fill = $("rlMeterFill");
        var note = $("rlMeterNote");
        meter.hidden = false;
        fill.style.width = "20%";
        note.textContent = "正在构建请求上下文...";

        var prefMap = {family:"亲子",photo:"摄影",hike:"徒步",food:"美食",culture:"人文",summer:"避暑"};
        var prefText = Array.from(state.prefs).map(function(k){ return prefMap[k] || k; }).join("、") || "无特定偏好";
        var scenarioText = scenario === "rain" ? "暴雨" : scenario === "crowd" ? "大客流" : "正常";

        var prompt =
          "你是重庆旅游规划专家。请根据下列条件，**直接用 Markdown 正文输出**（不要使用 JSON，不要用 ``` 代码围栏包裹全文）：\n\n" +
          "**输入条件**\n" +
          "- 出发地：" + startPoint + "\n" +
          "- 目的地：" + destLabel + "\n" +
          "- 出行天数：" + dayCount + " 天\n" +
          "- 出行人数：" + people + " 人\n" +
          "- 偏好：" + prefText + "\n" +
          "- 突发情景：" + scenarioText + "\n" +
          "- 当地气温参考：" + state.weatherTemp + "°C\n" +
          "- 拥堵指数（越高越堵）：" + state.live.traffic.toFixed(2) + "\n\n" +
          "**请按以下标题结构书写（二级 `##` 标题），内容尽量具体可执行：**\n" +
          "## 行程综述\n" +
          "一段摘要，并给出 **AI 综合匹配度**（用百分比自述即可）。\n\n" +
          "## 逐日安排\n" +
          "按天、按上/下午列出节点（景点、交通方式、餐饮与耗时提示），用有序或无序列表。\n\n" +
          "## 动态调整与攻略说明\n" +
          "针对当前 **" + scenarioText + "** 情景的替代方案或顺序调整；结合 **" + prefText + "** 与天气/路况的注意事项与贴士。\n\n" +
          "全文使用规范 Markdown（标题、列表、加粗），语气专业、简洁。";

        var payload = {
          model: "Doubao-Seed-2.0-lite",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          stream: true,
          extra_body: {
            enable_volc_websearch: true,
            volc_websearch_type: "web_summary"
          }
        };

        fill.style.width = "40%";
        note.textContent = "正在连接大模型，准备流式输出…";

        fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        .then(async function (r) {
          if (!r.ok) {
            var text = await r.text();
            throw new Error("HTTP error " + r.status + ": " + text);
          }

          var reader = r.body.getReader();
          var decoder = new TextDecoder("utf-8");
          var fullText = "";
          var sseBuf = "";
          var mdRaf = 0;
          var gotDelta = false;

          var container = $("routePlan");
          container.innerHTML =
            '<div class="route-plan-md" id="routeStreamMd" role="article" aria-live="polite"></div>';
          var streamBox = $("routeStreamMd");

          function scheduleMdRender() {
            if (mdRaf) return;
            mdRaf = requestAnimationFrame(function () {
              mdRaf = 0;
              renderStreamingMarkdown(streamBox, fullText);
            });
          }

          while (true) {
            var read = await reader.read();
            var done = read.done;
            var value = read.value;
            if (done) break;
            sseBuf += decoder.decode(value, { stream: true });
            var parts = sseBuf.split("\n");
            sseBuf = parts.pop() || "";
            for (var i = 0; i < parts.length; i++) {
              var line = parts[i].trim();
              if (line.indexOf("data:") !== 0 || line === "data: [DONE]") continue;
              var jsonStr = line.indexOf("data: ") === 0 ? line.slice(6).trim() : line.slice(5).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                var data = JSON.parse(jsonStr);
                var piece =
                  data.choices &&
                  data.choices[0] &&
                  data.choices[0].delta &&
                  data.choices[0].delta.content;
                if (piece) {
                  if (!gotDelta) {
                    gotDelta = true;
                    fill.style.width = "55%";
                    note.textContent = "正在流式生成 Markdown 路线…";
                  }
                  fullText += piece;
                  scheduleMdRender();
                }
              } catch (e) {}
            }
          }

          var tail = sseBuf.trim();
          if (tail.indexOf("data:") === 0 && tail !== "data: [DONE]") {
            try {
              var js = tail.slice(6).trim();
              if (js !== "[DONE]") {
                var d = JSON.parse(js);
                var pc = d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content;
                if (pc) fullText += pc;
              }
            } catch (e2) {}
          }

          var cleaned = fullText.trim();
          if (/^```(?:markdown|md)?\s*/i.test(cleaned)) {
            cleaned = cleaned.replace(/^```(?:markdown|md)?\s*/i, "");
            cleaned = cleaned.replace(/\s*```\s*$/, "");
          }
          renderStreamingMarkdown(streamBox, cleaned.trim());
          return cleaned;
        })
        .then(function (reply) {
          fill.style.width = "100%";
          if (!reply || !String(reply).trim()) {
            note.textContent = "未收到有效内容，请重试。";
            throw new Error("空响应");
          }
          note.textContent = "流式输出完成";
          showRouteFeedbackAfterStream();
          btn.disabled = false;
          btn.textContent = "生成定制化路线";
        })
        .catch(function (e) {
          console.error("AI 规划请求出错：", e);
          note.textContent = "AI 请求失败：" + (e.message || "请检查网络或重试。");
          fill.style.width = "100%";
          fill.style.background = "#ef4444";
          var planEl = $("routePlan");
          if (planEl && (!planEl.textContent || planEl.textContent.length < 8)) {
            planEl.innerHTML =
              '<p class="route-plan-placeholder">生成失败，请检查接口或稍后重试。</p>';
          }
          setTimeout(function () {
            btn.disabled = false;
            btn.textContent = "生成定制化路线";
            fill.style.background = "";
          }, 3000);
        });
      });
    });

    $("btnRefreshLive").addEventListener("click", function () {
      var scenario = $("scenarioSim").value;
      var destinationId = $("filterDestination") ? $("filterDestination").value : "all";
      var destLabel = getDestinationLabel(destinationId);
      if (destinationId === "all") {
        alert("请先选择具体的目的地！");
        return;
      }
      jitterLive();
      var btn = $("btnRefreshLive");
      btn.disabled = true;
      btn.textContent = "正在联网查询...";
      $("liveUpdated").textContent = "加载中...";
      fetchWeatherFromAI(destLabel).then(function () {
        renderLive(scenario);
        btn.disabled = false;
        btn.textContent = "刷新实时态势";
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = "刷新失败，点击重试";
      });
    });

    $("btnFeedbackGood").addEventListener("click", function () {
      state.confidence = clamp(state.confidence + 0.02, 0.5, 0.99);
      localStorage.setItem("aiRouteConfidence", String(state.confidence));
      $("feedbackScore").textContent =
        "策略置信度：" + (state.confidence * 100).toFixed(1) + "%（正向反馈已记录）";
    });

    $("btnFeedbackBad").addEventListener("click", function () {
      state.confidence = clamp(state.confidence - 0.03, 0.5, 0.99);
      localStorage.setItem("aiRouteConfidence", String(state.confidence));
      $("feedbackScore").textContent =
        "策略置信度：" + (state.confidence * 100).toFixed(1) + "%（负向反馈已记录）";
    });

    var initialWeatherSetup = function() {
      state.weatherCode = null;
      state.weatherTemp = null;
      state.weatherAnalysis = null;
      state.clothingAdvice = null;
      $("liveWeather").textContent = "等待选择目的地";
      $("liveWeatherSub").textContent = "请在左侧选择目的地";
      $("liveTraffic").textContent = "--";
      $("liveCapacity").textContent = "--";
      $("liveUpdated").textContent = "尚未加载";
    };
    initialWeatherSetup();

    if ($("filterDestination")) {
      $("filterDestination").addEventListener("change", function () {
        var scenario = $("scenarioSim").value;
        var destinationId = this.value;
        if (destinationId === "all") {
          initialWeatherSetup();
          return;
        }
        state.weatherCode = null;
        state.weatherTemp = null;
        state.weatherAnalysis = null;
        state.clothingAdvice = null;
        jitterLive();
        renderLive(scenario);
        $("liveWeatherSub").textContent = "请点击「刷新实时态势」加载联网天气";
        $("liveUpdated").textContent = "尚未加载 · 需手动刷新";
      });
    }
  }

  function initAr() {
    var btn = $("btnArPreview");
    var select = $("arSpotSelect");
    var model = $("heritageModel");
    var hint = $("arLoadHint");
    var story = $("arStory");
    var title = $("arStoryTitle");
    var body = $("arStoryBody");
    var memberBar = $("arMemberBar");
    if (!btn || !select || !model || !story || !title || !body) return;

    function refreshMemberBar() {
      if (!memberBar || !window.ZYYMember || typeof window.ZYYMember.getStatusSummary !== "function") return;
      var s = window.ZYYMember.getStatusSummary();
      if (!s.loggedIn) {
        memberBar.innerHTML =
          '<span class="ar-member-bar__text">未登录：无法使用 VR 体验。</span><a class="btn btn-primary btn-sm" href="login?redirect=' +
          encodeURIComponent("vr") +
          '">去登录</a>';
        memberBar.hidden = false;
        return;
      }
      if (s.isMember) {
        memberBar.innerHTML =
          '<span class="ar-member-bar__text">会员已开通，有效期至 <strong>' +
          (s.untilText || "") +
          "</strong>，VR 导览不限次数。</span>";
      } else {
        memberBar.innerHTML =
          '<span class="ar-member-bar__text">' +
          (s.text || "") +
          ' · 开通会员可无限使用。</span><a class="btn btn-ghost btn-sm" href="member-pricing">会员充值</a>';
      }
      memberBar.hidden = false;
    }

    refreshMemberBar();

    var SPOTS = {
      ciqikou: {
        title: "磁器口古镇 · 3D 导览",
        body: "磁器口保留了传统巴渝街巷肌理，因嘉陵江水运而兴。你可在模型中观察沿街建筑的层叠关系，并结合讲解了解古镇商业与民俗的演变脉络。",
        modelSrc: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
      },
      hongyadong: {
        title: "洪崖洞 · 吊脚楼群导览",
        body: "洪崖洞依山就势形成多层立体空间，夜间灯光与崖壁结构极具辨识度。建议从底层到高层观察模型，理解山地城市立体交通与建筑布局。",
        modelSrc: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
      },
      dazu: {
        title: "大足石刻 · 石窟艺术导览",
        body: "大足石刻是中国晚期石窟艺术代表，题材丰富、叙事完整。通过 3D 模型可近距离查看龛像细节，理解其宗教、艺术与世俗生活题材融合特征。",
        modelSrc: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb",
      },
      wulong: {
        title: "武隆天生三桥 · 地质奇观导览",
        body: "武隆天生三桥由喀斯特地貌长期演化形成，桥、谷、洞组合显著。模型视角可帮助理解桥拱尺度与谷底空间层次，便于规划观景动线。",
        modelSrc: "https://modelviewer.dev/shared-assets/models/ShopifyModels/Chair.glb",
      },
      wanzhou: {
        title: "万州青龙瀑布 · 山水景观导览",
        body: "青龙瀑布以落差与峡谷景观见长，丰水期观赏性更强。可先在模型中预览观瀑平台相对位置，再结合天气与客流安排实际游览时段。",
        modelSrc: "https://modelviewer.dev/shared-assets/models/ShopifyModels/Sneaker.glb",
      },
    };

    function renderSpot(spotKey) {
      var spot = SPOTS[spotKey] || SPOTS.ciqikou;
      if (hint) hint.textContent = "模型加载中，请稍候...";
      btn.disabled = true;
      model.setAttribute("src", spot.modelSrc);
      model.setAttribute("alt", spot.title);
      title.textContent = spot.title;
      body.textContent = spot.body;
      story.hidden = false;

      var onLoad = function () {
        btn.disabled = false;
        if (hint) hint.textContent = "模型加载完成，可拖拽旋转查看细节。";
        model.removeEventListener("load", onLoad);
        model.removeEventListener("error", onError);
      };
      var onError = function () {
        btn.disabled = false;
        if (hint) hint.textContent = "模型加载失败，请稍后重试或切换网络。";
        model.removeEventListener("load", onLoad);
        model.removeEventListener("error", onError);
      };
      model.addEventListener("load", onLoad);
      model.addEventListener("error", onError);
    }

    btn.addEventListener("click", function () {
      var M = window.ZYYMember;
      if (M && typeof M.canUseAr === "function") {
        var gate = M.canUseAr();
        if (!gate.ok) {
          if (hint) hint.textContent = gate.message || "暂时无法加载。";
          if (gate.needLogin) {
            window.location.href = "login?redirect=" + encodeURIComponent("vr");
            return;
          }
          if (gate.needMember) {
            if (window.confirm(gate.message + "\n\n是否前往会员充值页面？")) {
              window.location.href = "member-pricing";
            }
            return;
          }
          return;
        }
        M.recordArUse();
        refreshMemberBar();
      }
      renderSpot(select.value);
    });

    if (hint) hint.textContent = "点击“查看该景点模型”后再加载 3D，可提升页面打开速度。";
  }

  var FARM_IMAGE_FILES = [
    "万州区：鱼泉榨菜（全国知名的酱腌菜）.jpg",
    "两江新区：土沱麻饼（传统糕点，原渝北  江北名产）.jpeg",
    "丰都县：丰都麻辣鸡（地方特色凉菜，麻辣鲜香）.jpg",
    "九龙坡区：白市驿板鸭（传统腊味）.png",
    "云阳县：云阳红橙（果肉橙红，甜度高）.jpg",
    "北碚区：缙云毛峰（产自缙云山的优质绿茶）.jpg",
    "南岸区：南山腊梅（观赏 + 香料，南岸地标）.jpg",
    "南川区：南川金佛玉翠茶（产自金佛山的优质绿茶）.jpg",
    "合川区：合川桃片（传统糕点点心）.jpg",
    "垫江县：垫江白柚（汁多味甜，地方名柚）.jpg",
    "城口县：城口老腊肉（山地土猪腌制，烟熏风味）.jpg",
    "大渡口区：九叶青花椒（调味香料名产.jpg",
    "大足区：大足冬菜（腌制蔬菜，风味浓郁）.jpg",
    "奉节县：奉节脐橙（国家地理标志，酸甜适中）.jpg",
    "巫山县：巫山脆李（脆甜爽口，重庆夏季名果）.jpg",
    "巫溪县：巫溪老鹰茶（传统野生茶饮，消暑解腻）.jpg",
    "巴南区：五布柚（巴南传统名柚，汁多味甜）.jpg",
    "开州区：开州冰薄月饼（中秋传统薄皮月饼）.jpg",
    "彭水苗族土家族自治县：彭水苗家晶丝苕粉（红薯精制，口感爽滑）.jpg",
    "忠县：忠县豆腐乳（传统发酵豆制品，佐餐佳品）.jpg",
    "梁平区：梁平柚（果实硕大，果肉清香）.jpg",
    "永川区：永川秀芽（针形绿茶，重庆名茶）.jpg",
    "江津区：江津花椒（也称九叶青，麻辣火锅核心原料）.jpg",
    "沙坪坝区：磁器口陈麻花（古镇特色零食）.jpg",
    "涪陵区：涪陵榨菜 重庆最具代表性的特产之一.jpg",
    "渝中区：山城小汤圆（渝中传统小吃，市井名片）.jpg",
    "潼南区：潼南柠檬（全国重要柠檬产地，皮薄汁足）.jpg",
    "璧山区：璧山儿菜（秋冬特色蔬菜，清甜无渣）.jpg",
    "石柱土家族自治县：石柱莼菜（水生蔬菜，国家地理标志）.jpg",
    "秀山土家族苗族自治县：秀山金银花（药用花卉，品质优良）.jpg",
    "荣昌区：荣昌猪（全国三大优良地方猪种之一）.png",
    "酉阳土家族苗族自治县：酉阳茶油（山茶籽压榨，健康食用油）.png",
    "铜梁区：铜梁莲藕 肉质肥厚，适合炖汤 、凉拌.jpg",
    "长寿区：长寿沙田柚（果肉清甜化渣）.jpg",
    "黔江区：珍珠兰茶（地方特色茶饮）.jpg",
  ];

  function parseFarmFile(fileName, idx) {
    var base = fileName.replace(/\.(png|jpe?g|webp|gif)$/i, "");
    var split = base.split(/[:：]/);
    var left = split[0] || "";
    var right = split.slice(1).join("：") || base;
    var normalized = (right || base).replace(/\s+/g, " ").trim();
    var m = normalized.match(/^(.*?)(?:[（(](.*)[）)])?$/);
    var name = m && m[1] ? m[1].trim() : normalized;
    var intro = m && m[2] ? m[2].trim() : (left ? left + "区县特产" : "区县特色农产品");
    var district = left.replace(/[，,].*$/, "").trim() || "重庆";
    var harvestDay = 10 + (idx % 16);
    var packDay = harvestDay + 1;
    return {
      id: "fp" + (idx + 1),
      name: name || base,
      meta: intro,
      price: 29 + (idx % 9) * 8,
      image: "assets/区县特产图片/" + encodeURIComponent(fileName),
      imageFallback: "assets/logo.jpg",
      district: district,
      trace: {
        product: name || base,
        origin: district,
        harvestDate: "2026-04-" + String(harvestDay).padStart(2, "0"),
        packDate: "2026-04-" + String(packDay).padStart(2, "0"),
        traceCode: district.slice(0, 2).toUpperCase() + "-2026-" + String(idx + 1).padStart(4, "0"),
      },
    };
  }

  var FARM_PRODUCTS = FARM_IMAGE_FILES.map(parseFarmFile);

  function renderFarm() {
    var grid = $("farmGrid");
    if (!grid) return;
    var PAGE_SIZE = 9;
    var totalPages = Math.max(1, Math.ceil(FARM_PRODUCTS.length / PAGE_SIZE));
    var page = 1;

    var pager = $("farmPager");
    if (!pager) {
      pager = document.createElement("div");
      pager.id = "farmPager";
      pager.className = "feedback-btns";
      grid.parentNode.appendChild(pager);
    }

    function renderPage(nextPage) {
      page = Math.max(1, Math.min(totalPages, nextPage));
      grid.innerHTML = "";
      var start = (page - 1) * PAGE_SIZE;
      var list = FARM_PRODUCTS.slice(start, start + PAGE_SIZE);

      list.forEach(function (p) {
        var card = document.createElement("article");
        card.className = "farm-card";
        card.innerHTML =
          '<a class="farm-card-media" href="shop-detail?id=' +
          encodeURIComponent(p.id) +
          '" style="background-image:url(\'' +
          p.image +
          '\'),url(\'' +
          p.imageFallback +
          '\')"></a>' +
          '<div class="farm-card-body">' +
          '<h3 class="farm-card-title"><a href="shop-detail?id=' +
          encodeURIComponent(p.id) +
          '">' +
          p.name +
          "</a></h3>" +
          '<p class="farm-card-meta">' +
          p.meta +
          "</p>" +
          '<p class="farm-card-price">¥' +
          p.price +
          "</p>" +
          '<div class="farm-card-actions">' +
          '<button type="button" class="btn btn-ghost btn-block btn-sm farm-trace" data-id="' +
          p.id +
          '">溯源证书</button>' +
          '<button type="button" class="btn btn-primary btn-block btn-sm farm-add" data-id="' +
          p.id +
          '">加入购物车</button>' +
          "</div></div>";
        grid.appendChild(card);
      });

      pager.innerHTML =
        '<button type="button" class="btn btn-ghost btn-sm" id="farmPrev"' +
        (page <= 1 ? " disabled" : "") +
        ">上一页</button>" +
        '<span class="farm-pager-text">第 ' +
        page +
        " / " +
        totalPages +
        " 页</span>" +
        '<button type="button" class="btn btn-ghost btn-sm" id="farmNext"' +
        (page >= totalPages ? " disabled" : "") +
        ">下一页</button>";

      var prev = $("farmPrev");
      var next = $("farmNext");
      if (prev) prev.addEventListener("click", function () { renderPage(page - 1); });
      if (next) next.addEventListener("click", function () { renderPage(page + 1); });

      grid.querySelectorAll(".farm-trace").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          var prod = FARM_PRODUCTS.find(function (x) {
            return x.id === id;
          });
          if (!prod) return;
          openTraceModal(prod);
        });
      });

      grid.querySelectorAll(".farm-add").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-id");
          var prod = FARM_PRODUCTS.find(function (x) {
            return x.id === id;
          });
          if (!prod) return;
          addProductToCart(prod);
        });
      });
    }

    renderPage(1);
  }

  function openModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("shop-modal-open");
  }

  function closeModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.hidden = true;
    var hasOpen = Array.prototype.some.call(document.querySelectorAll(".shop-modal"), function (el) {
      return !el.hidden;
    });
    if (!hasOpen) document.body.classList.remove("shop-modal-open");
  }

  function openTraceModal(prod) {
    var list = $("traceList");
    if (!list || !prod || !prod.trace) return;
    var t = prod.trace;
    list.innerHTML =
      "<dt>产品名称</dt><dd>" + t.product + "</dd>" +
      "<dt>产地溯源</dt><dd>重庆" + t.origin + "</dd>" +
      "<dt>采摘/生产日期</dt><dd>" + t.harvestDate + "</dd>" +
      "<dt>包装日期</dt><dd>" + t.packDate + "</dd>" +
      "<dt>溯源码</dt><dd>" + t.traceCode + "</dd>" +
      "<dt>溯源证书编号</dt><dd>ZYY-" + String(458000 + parseInt(prod.id.slice(2), 10)) + "</dd>";
    openModal("traceModal");
  }

  function updateCartBar() {
    var bar = $("cartBar");
    var text = $("cartBarText");
    var checkout = $("cartCheckout");
    if (!bar || !text || !checkout) return;
    var n = state.cart.length;
    if (n === 0) {
      bar.hidden = true;
      document.body.classList.remove("has-cart-bar");
      publishCartProductIdsForPlanner();
      return;
    }
    bar.hidden = false;
    document.body.classList.add("has-cart-bar");
    var total = state.cart.reduce(function (s, i) {
      return s + i.price;
    }, 0);
    text.textContent = "已选 " + n + " 件 · 合计 ¥" + total;
    checkout.disabled = false;
    publishCartProductIdsForPlanner();
  }

  function loginRedirectForCart() {
    var name = (window.location.pathname || "").split("/").pop() || "shop";
    return "login?redirect=" + encodeURIComponent(name + (window.location.search || ""));
  }

  /** @param {{ specLabel?: string, price?: number }} [opts] */
  function addProductToCart(prod, opts) {
    if (!prod) return;
    if (!window.ZYYAuth || !window.ZYYAuth.getToken() || !window.ZYYUserData) {
      window.alert("请先登录后再将商品加入购物车。");
      window.location.href = loginRedirectForCart();
      return;
    }
    opts = opts || {};
    var price = typeof opts.price === "number" && !isNaN(opts.price) ? opts.price : prod.price;
    var name = prod.name;
    if (opts.specLabel) {
      name = name + "（" + opts.specLabel + "）";
    }
    var uid = "c" + String(Date.now()) + "-" + String(Math.random()).slice(2);
    state.cart.push({
      uid: uid,
      id: prod.id,
      name: name,
      price: price,
      image: prod.image || "",
    });
    saveCartToStorage(state.cart);
    updateCartBar();
  }

  if (typeof window !== "undefined") {
    window.ZYYShop = {
      getProductById: function (id) {
        return FARM_PRODUCTS.find(function (p) {
          return p.id === id;
        });
      },
      getProductsByDistrict: function (districtName) {
        if (!districtName) return [];
        return FARM_PRODUCTS.filter(function (p) {
          return p.district === districtName;
        }).slice();
      },
      addToCart: addProductToCart,
      openTraceModal: openTraceModal,
      triggerCheckout: function () {
        var checkout = $("cartCheckout");
        if (checkout && !checkout.disabled) checkout.click();
      },
    };
  }

  function saveOrder(order) {
    if (window.ZYYAuth && window.ZYYAuth.getToken() && window.ZYYUserData && window.ZYYUserData.createOrder) {
      window.ZYYUserData.createOrder(order);
      return;
    }
    var key = "zyyOrders";
    var list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    list.unshift(order);
    localStorage.setItem(key, JSON.stringify(list));
  }

  function initCart() {
    var checkout = $("cartCheckout");
    if (!checkout) return;
    checkout.addEventListener("click", function () {
      if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
        window.alert("请先登录后再结算购物车。");
        window.location.href = loginRedirectForCart();
        return;
      }
      var n = state.cart.length;
      if (!n) return;
      var total = state.cart.reduce(function (s, i) { return s + i.price; }, 0);
      var orderNo = "NY" + String(Date.now()).slice(-8);
      var top = state.cart[0];
      var info = $("payOrderInfo");
      var amount = $("payAmount");
      if (amount) amount.textContent = "¥" + total.toFixed(2);
      if (info) {
        info.innerHTML =
          "<p>订单号：" + orderNo + "</p>" +
          "<p>商品：" + top.name + (n > 1 ? " 等" + n + "件" : " x1") + "</p>";
      }
      checkout.setAttribute("data-order-no", orderNo);
      openModal("payModal");
    });
  }

  function initShopModals() {
    // 购物车管理页也复用了支付弹窗 DOM，如果再绑定一次会造成重复下单/重复清空。
    // 因此仅在购物车/商品详情页面（存在 cartCheckout）启用弹窗绑定。
    if ($("cartDetailPanel")) return;
    var successTimer = null;
    var successTick = null;
    var payCancel = $("payCancel");
    var payConfirm = $("payConfirm");
    var traceClose = $("traceClose");
    var successCountdown = $("paySuccessCountdown");

    function showPaySuccessModal() {
      var remain = 3;
      if (successTick) window.clearInterval(successTick);
      if (successTimer) window.clearTimeout(successTimer);
      if (successCountdown) successCountdown.textContent = remain + " 秒后自动关闭";
      openModal("paySuccessModal");
      successTick = window.setInterval(function () {
        remain -= 1;
        if (remain <= 0) {
          window.clearInterval(successTick);
          successTick = null;
          return;
        }
        if (successCountdown) successCountdown.textContent = remain + " 秒后自动关闭";
      }, 1000);
      successTimer = window.setTimeout(function () {
        closeModal("paySuccessModal");
        successTimer = null;
      }, 3000);
    }

    if (payCancel) payCancel.addEventListener("click", function () { closeModal("payModal"); });
    if (traceClose) traceClose.addEventListener("click", function () { closeModal("traceModal"); });
    if (payConfirm) {
      payConfirm.addEventListener("click", function () {
        if (!window.ZYYAuth || !window.ZYYAuth.getToken()) {
          window.alert("请先登录后再完成支付。");
          window.location.href = loginRedirectForCart();
          return;
        }
        var orderNo = ($("cartCheckout") && $("cartCheckout").getAttribute("data-order-no")) || ("NY" + String(Date.now()).slice(-8));
        var total = state.cart.reduce(function (s, i) { return s + i.price; }, 0);
        var order = {
          orderNo: orderNo,
          createdAt: new Date().toISOString(),
          status: "待发货",
          items: state.cart.slice(),
          count: state.cart.length,
          total: total,
        };
        saveOrder(order);
        closeModal("payModal");
        state.cart = [];
        saveCartToStorage(state.cart);
        if (window.ZYYUserData && window.ZYYUserData.saveCartNow) {
          window.ZYYUserData.saveCartNow([]);
        }
        updateCartBar();
        showPaySuccessModal();
      });
    }
    document.querySelectorAll(".shop-modal-mask").forEach(function (mask) {
      mask.addEventListener("click", function () {
        var id = mask.getAttribute("data-close");
        if (id) closeModal(id);
      });
    });
  }

  function assistantReply(q) {
    var t = q.trim();
    if (!t) return "请描述您的出行天数、同行人与偏好，我可建议路线结构。";
    if (/亲子|孩子|娃/.test(t)) return "亲子建议优先「定心茶园线」或「涞滩人文线」：节奏慢、研学点多。可在智能路线区勾选「亲子」后生成行程。";
    if (/摄影|拍照|出片/.test(t)) return "摄影可向武陵山脊线与涞滩清晨倾斜；注意天气与拥堵态势，系统会插入黄金时段。";
    if (/徒步|爬山|户外/.test(t)) return "徒步偏好与「武陵山脊线」匹配度最高；若遇暴雨预警，请查看动态调整是否改为半室内节点。";
    if (/天气|下雨|暴雨/.test(t)) return "实时天气已接 Open-Meteo。可刷新实时态势后查看最新建议。";
    if (/买|购|农产品|特产|直购/.test(t)) return "乡愁直购区已上架多款渝味特产，加入购物车后可在底部条结算。";
    if (/AR|VR|导航|模型|3D|典故/.test(t)) return "VR 区支持按景点选择 3D 模型并查看对应解说内容，无需扫描即可预览文化点位。";
    if (/路线|攻略|行程|规划/.test(t)) return "打开上方「智能路线」板块，选择偏好后点「生成定制化路线」。系统会展示完整路线与攻略说明。";
    return "我已记录：「" + t + "」。建议结合智能路线生成结果与实时态势一起查看；如需人工客服可留邮箱在页尾。";
  }

  function initAssistant() {
    var fab = $("assistantFab");
    var panel = $("assistantPanel");
    var close = $("assistantClose");
    var form = $("assistantForm");
    var input = $("assistantInput");
    var msgs = $("assistantMessages");

    if (!fab || !panel) return;

    function addMsg(text, role) {
      var div = document.createElement("div");
      div.className = "assistant-msg assistant-msg--" + role;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function setOpen(open) {
      fab.setAttribute("aria-expanded", open ? "true" : "false");
      panel.hidden = !open;
      if (open) {
        input.focus();
        if (msgs.children.length === 0) {
          addMsg(
            "您好，我是巴渝乡镇文旅助手。可问我路线、天气、VR 导览或乡愁直购，也可指定天数与偏好。",
            "bot"
          );
        }
      }
    }

    fab.addEventListener("click", function () {
      setOpen(panel.hidden);
    });
    close.addEventListener("click", function () {
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value;
      input.value = "";
      if (!q.trim()) return;
      addMsg(q, "user");
      setTimeout(function () {
        addMsg(assistantReply(q), "bot");
      }, 400);
    });
  }

  /** 规划页「目的地」选项多：窄屏下用多行列表 + 滚动，避免系统弹出层只有两三行高 */
  var plannerDestSelectResizeBound = false;

  function applyMobileLongSelectListbox() {
    var sel = document.getElementById("filterDestination");
    if (!sel || !sel.options || sel.options.length < 12) return;
    var narrow = window.matchMedia("(max-width: 1023px)").matches;
    if (narrow) {
      var rows = Math.min(10, sel.options.length);
      sel.size = rows;
      sel.classList.add("field-select--scroll-listbox");
    } else {
      sel.removeAttribute("size");
      sel.classList.remove("field-select--scroll-listbox");
    }
  }

  function bindPlannerDestinationSelectLayout() {
    if (plannerDestSelectResizeBound) return;
    if (!document.getElementById("filterDestination")) return;
    plannerDestSelectResizeBound = true;
    applyMobileLongSelectListbox();
    var t = null;
    window.addEventListener("resize", function () {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(applyMobileLongSelectListbox, 200);
    });
  }

  function boot() {
    initAiPlanner();
    bindPlannerDestinationSelectLayout();
    initAr();
    renderFarm();
    syncCartFromStorage();
    initCart();
    initShopModals();
    initAssistant();
  }


  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
