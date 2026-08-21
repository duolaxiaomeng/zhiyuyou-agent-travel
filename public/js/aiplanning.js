(function () {
    "use strict";

    var state = {
        prefs: new Set(["culture", "photo"]),
        live: { traffic: 0.5, capLt: 0.6, capAy: 0.55, capTea: 0.45 },
        confidence: parseFloat(localStorage.getItem("aiRouteConfidence") || "0.78", 10) || 0.78,
        weatherCode: null,
        weatherTemp: null,
        weatherTempMin: null,
        weatherTempMax: null,
        uvIndex: null,
        airQuality: null,
        humidity: null,
        windLevel: null,
        weatherAnalysis: null,
        clothingAdvice: null
    };

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

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function loadCartProductIds() {
        var ids = new Set();
        if (!window.ZYYAuth || !window.ZYYAuth.getToken()) return ids;
        if (window.__zyyCartProductIds instanceof Set) {
            window.__zyyCartProductIds.forEach(function (id) {
                ids.add(String(id));
            });
        }
        return ids;
    }

    function renderLocalFarmRec() {
        var panel = $("localFarmPanel");
        var grid = $("localFarmGrid");
        if (!panel || !grid) return;

        panel.hidden = true;
        grid.innerHTML = "";

        var destId = $("filterDestination") ? $("filterDestination").value : "all";
        if (!destId || destId === "all") return;
        if (!window.ZYYShop || typeof window.ZYYShop.getProductsByDistrict !== "function") return;

        var label = getDestinationLabel(destId);
        var list = window.ZYYShop.getProductsByDistrict(label) || [];
        if (!list.length) return;

        var inCartIds = loadCartProductIds();
        var max = 6;
        var slice = list.slice(0, max);

        panel.hidden = false;

        grid.innerHTML = slice
            .map(function (p) {
                var pid = String(p.id || "");
                var name = escapeHtml(p.name || "");
                var meta = escapeHtml(p.meta || "");
                var bg = p.image || p.imageFallback || "assets/logo.jpg";
                bg = escapeHtml(bg);
                var price = Number(p.price);
                var priceText = isFinite(price) ? "¥" + price : "¥0";

                var already = inCartIds.has(pid);
                var btnLabel = already ? "已在购物车" : "加入购物车";
                var dis = already ? " disabled" : "";

                return (
                '<article class="farm-card local-farm-card">' +
                    '<a class="farm-card-media" href="shop-detail?id=' +
                    encodeURIComponent(pid) +
                    '" style="background-image:url(\'' +
                    bg +
                    '\')"></a>' +
                    '<div class="farm-card-body">' +
                    '<h3 class="farm-card-title"><a href="shop-detail?id=' +
                    encodeURIComponent(pid) +
                    '">' +
                    name +
                    "</a></h3>" +
                    '<p class="farm-card-meta">' +
                    meta +
                    "</p>" +
                    '<p class="farm-card-price">' +
                    priceText +
                    "</p>" +
                    '<div class="farm-card-actions">' +
                    '<button type="button" class="btn btn-primary btn-block local-farm-add" data-id="' +
                    escapeHtml(pid) +
                    '"' +
                    dis +
                    ">" +
                    btnLabel +
                    "</button>" +
                    "</div>" +
                    "</div>" +
                    "</article>"
                );
            })
            .join("");

        grid.querySelectorAll(".local-farm-add").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-id");
                if (!window.ZYYShop || typeof window.ZYYShop.getProductById !== "function") return;
                var prod = window.ZYYShop.getProductById(id);
                if (!prod) return;
                window.ZYYShop.addToCart(prod);
                renderLocalFarmRec();
            });
        });
    }

    function hideScenicBooking() {
        var panel = $("scenicBookingPanel");
        var list = $("scenicBookingList");
        if (panel) panel.hidden = true;
        if (list) list.innerHTML = "";
    }

    function renderScenicBookingLinks(links) {
        var panel = $("scenicBookingPanel");
        var list = $("scenicBookingList");
        if (!panel || !list) return;
        if (!Array.isArray(links) || !links.length) {
            panel.hidden = true;
            list.innerHTML = "";
            return;
        }
        list.innerHTML = links
            .map(function (item) {
                var name = escapeHtml(item.name || item.title || "景区");
                var district = escapeHtml(item.district || "");
                var sourceName = escapeHtml(item.sourceName || "官方资料");
                var note = escapeHtml(item.note || "请以官方入口展示的信息为准。");
                var url = escapeHtml(item.officialUrl || "#");
                var meta = [district, sourceName].filter(Boolean).join(" · ");
                return (
                    '<article class="scenic-booking-card">' +
                    '<div class="scenic-booking-card__main">' +
                    '<h5 class="scenic-booking-card__title">' +
                    name +
                    "</h5>" +
                    '<p class="scenic-booking-card__meta">' +
                    escapeHtml(meta) +
                    "</p>" +
                    '<p class="scenic-booking-card__meta">' +
                    note +
                    "</p>" +
                    "</div>" +
                    '<div class="scenic-booking-card__actions">' +
                    '<a class="btn btn-primary" href="' +
                    url +
                    '" target="_blank" rel="noopener noreferrer">打开购票/预约页</a>' +
                    "</div>" +
                    "</article>"
                );
            })
            .join("");
        panel.hidden = false;
    }

    function fetchScenicBookingLinks(routeText, destination, destinationId) {
        var panel = $("scenicBookingPanel");
        var list = $("scenicBookingList");
        if (!panel || !list || !routeText) return Promise.resolve();
        panel.hidden = false;
        list.innerHTML = '<p class="route-plan-placeholder">正在匹配景区预约入口...</p>';
        return fetch("/api/scenic-booking-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                routeText: String(routeText || "").slice(0, 12000),
                destination: destination || "",
                destinationId: destinationId || ""
            })
        })
            .then(function (r) {
                return r.json().then(function (data) {
                    if (!r.ok) throw new Error((data && data.error) || r.statusText || "查询失败");
                    return data;
                });
            })
            .then(function (data) {
                renderScenicBookingLinks(data && data.links);
            })
            .catch(function (e) {
                console.error("景区预约入口查询失败", e);
                panel.hidden = true;
                list.innerHTML = "";
            });
    }

    function jitterLive() {
        state.live.traffic = clamp(state.live.traffic + (Math.random() - 0.5) * 0.12, 0.15, 0.95);
        state.live.capLt = clamp(state.live.capLt + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
        state.live.capAy = clamp(state.live.capAy + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
        state.live.capTea = clamp(state.live.capTea + (Math.random() - 0.5) * 0.1, 0.2, 0.98);
    }

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
            "  \"temp_min\": 18,\n" +
            "  \"temp_max\": 22,\n" +
            "  \"uv_index\": \"中等/较强/很强\",\n" +
            "  \"air_quality\": \"优/良/轻度污染\",\n" +
            "  \"humidity\": \"65%\",\n" +
            "  \"wind\": \"2-3级\",\n" +
            "  \"analysis\": \"简短的当地天气分析建议（如：今天紫外线较强，适合户外活动）\",\n" +
            "  \"clothing\": \"简短的穿衣建议（如：建议穿短袖T恤，早晚加薄外套）\"\n" +
            "}";
        var payload = {
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
            extra_body: {
                enable_volc_websearch: true,
                volc_websearch_type: "web_summary"
            }
        };

        return fetch("/api/weather-assistant", {
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
                state.weatherTempMin = result.temp_min;
                state.weatherTempMax = result.temp_max;
                state.uvIndex = result.uv_index;
                state.airQuality = result.air_quality;
                state.humidity = result.humidity;
                state.windLevel = result.wind;
                state.weatherAnalysis = result.analysis;
                state.clothingAdvice = result.clothing;
                return result;
            })
            .catch(function (e) {
                console.error("AI 天气查询失败", e);
                state.weatherCode = "查询失败";
                state.weatherTemp = "--";
                state.weatherTempMin = null;
                state.weatherTempMax = null;
                state.uvIndex = null;
                state.airQuality = null;
                state.humidity = null;
                state.windLevel = null;
                state.weatherAnalysis = "无法获取建议";
                state.clothingAdvice = "无法获取建议";
                throw e;
            });
    }

    function tempRangeText() {
        var min = state.weatherTempMin;
        var max = state.weatherTempMax;
        if (min != null && max != null) return String(min) + "-" + String(max) + "°C";
        if (state.weatherTemp != null && state.weatherTemp !== "--") return String(state.weatherTemp) + "°C";
        return "--";
    }

    function weatherDetailText() {
        var detail = [];
        if (state.uvIndex) detail.push("紫外线：" + state.uvIndex);
        if (state.airQuality) detail.push("空气质量：" + state.airQuality);
        if (state.humidity) detail.push("湿度：" + state.humidity);
        if (state.windLevel) detail.push("风力：" + state.windLevel);
        return detail.length ? detail.join(" · ") : "等待查询";
    }

    function weatherText(code) {
        if (!code) return "等待查询";
        return code + " · " + tempRangeText();
    }

    function renderLive() {
        var wEl = $("liveWeather");
        var wSub = $("liveWeatherSub");
        var tEl = $("liveTraffic");
        var cEl = $("liveCapacity");
        var updated = $("liveUpdated");
        if (!wEl || !wSub || !tEl || !cEl || !updated) return;

        wEl.textContent = weatherText(state.weatherCode);
        wSub.textContent = state.weatherCode ? ("数据源：大模型联网查询 · " + weatherDetailText()) : "等待查询";
        tEl.textContent = state.weatherAnalysis || weatherDetailText() || "--";
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
        if ($("adjustLog")) $("adjustLog").hidden = true;
        if ($("adjustLogList")) $("adjustLogList").innerHTML = "";
        if ($("feedbackRow")) $("feedbackRow").hidden = false;
        if ($("feedbackScore")) {
            $("feedbackScore").textContent = "策略置信度：" + (conf * 100).toFixed(1) + "%（随反馈缓慢更新）";
        }
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
            !$("btnRefreshLive") ||
            !$("feedbackRow") ||
            !$("btnFeedbackGood") ||
            !$("btnFeedbackBad")
        ) {
            return;
        }

        initPrefs();

        // 让“实时态势 / 路线与动态调整结果”外框上限与“偏好选择”保持一致
        // 目的：避免三块框高度不同导致视觉错位；内容变长后在面板内部滚动。
        function syncPlannerPanelHeights() {
            var prefsEl = document.querySelector(".ai-panel--prefs");
            var liveEl = document.querySelector(".ai-panel--live");
            var outEl = document.querySelector(".ai-panel--out");
            if (!prefsEl || !liveEl || !outEl) return;

            var h = Math.round(prefsEl.getBoundingClientRect().height);
            if (!isFinite(h) || h <= 0) return;

            // 用固定 height 让“初始外框长度”保持一致；内容过长时由 overflow-y 接管滚动。
            liveEl.style.height = h + "px";
            outEl.style.height = h + "px";
            liveEl.style.overflowY = "auto";
            outEl.style.overflowY = "auto";
        }

        $("btnGenerateRoute").addEventListener("click", function () {
            var destinationId = $("filterDestination") ? $("filterDestination").value : "all";
            var destLabel = getDestinationLabel(destinationId);
            var startPoint = $("startPoint") ? $("startPoint").value.trim() : "";
            if (!startPoint) {
                alert("请先填写出发地（起点）再生成路线！");
                return;
            }
            var people = parseGroupSize();
            var dayCount = parseDayBudget();
            jitterLive();
            hideScenicBooking();
            $("rlMeterFill").style.width = "0%";
            $("adjustLog").hidden = true;

            var btn = $("btnGenerateRoute");
            btn.disabled = true;
            btn.textContent = "AI 正在深度规划中...";
            // 天气查询并行执行，不阻塞路线流式首包。
            fetchWeatherFromAI(destLabel)
                .then(function () {
                    renderLive();
                })
                .catch(function () {});

            var meter = $("rlMeter");
            var fill = $("rlMeterFill");
            var note = $("rlMeterNote");
            meter.hidden = false;
            fill.style.width = "20%";
            note.textContent = "正在构建请求上下文...";

            var prefMap = { family: "亲子", photo: "摄影", hike: "徒步", food: "美食", culture: "人文", summer: "避暑" };
            var prefText = Array.from(state.prefs).map(function (k) { return prefMap[k] || k; }).join("、") || "无特定偏好";
            var prompt =
                "你是重庆旅游规划专家。请直接输出 Markdown（不要 JSON、不要代码块）。\n" +
                "基于以下条件生成可执行路线：\n" +
                "- 出发地：" + startPoint + "\n" +
                "- 目的地：" + destLabel + "\n" +
                "- 天数：" + dayCount + "天\n" +
                "- 人数：" + people + "人\n" +
                "- 偏好：" + prefText + "\n" +
                "- 气温参考：" + (state.weatherTemp == null ? "--" : state.weatherTemp) + "°C\n" +
                "- 拥堵指数：" + state.live.traffic.toFixed(2) + "\n\n" +
                "请使用以下二级标题：\n" +
                "## 行程综述\n" +
                "## 逐日安排\n" +
                "## 动态调整与攻略说明";

            var payload = {
                model: "deepseek-chat",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 2500,
                stream: true,
                rag: {
                    destination: destLabel,
                    startPoint: startPoint,
                    days: dayCount,
                    people: people,
                    prefs: Array.from(state.prefs),
                    query: [destLabel, startPoint, prefText, dayCount + " days", people + " people"].join(" ")
                },
                extra_body: {
                    enable_volc_websearch: false
                }
            };

            fill.style.width = "40%";
            note.textContent = "正在连接大模型，准备流式输出…";

            fetch("/api/route-assistant", {
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
                    container.innerHTML = '<div class="route-plan-md" id="routeStreamMd" role="article" aria-live="polite"></div>';
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
                                var piece = data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
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
                    fetchScenicBookingLinks(reply, destLabel, destinationId);
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
                        planEl.innerHTML = '<p class="route-plan-placeholder">生成失败，请检查接口或稍后重试。</p>';
                    }
                    setTimeout(function () {
                        btn.disabled = false;
                        btn.textContent = "生成定制化路线";
                        fill.style.background = "";
                    }, 3000);
                });
        });

        $("btnRefreshLive").addEventListener("click", function () {
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
                renderLive();
                btn.disabled = false;
                btn.textContent = "刷新实时态势";
            }).catch(function () {
                btn.disabled = false;
                btn.textContent = "刷新失败，点击重试";
            });
        });

        $("btnFeedbackGood").addEventListener("click", function () {
            state.confidence = clamp(state.confidence + 0.02, 0.5, 0.99);
            localStorage.setItem("aiRouteConfidence", String(state.confidence));
            $("feedbackScore").textContent = "策略置信度：" + (state.confidence * 100).toFixed(1) + "%（正向反馈已记录）";
        });

        $("btnFeedbackBad").addEventListener("click", function () {
            state.confidence = clamp(state.confidence - 0.03, 0.5, 0.99);
            localStorage.setItem("aiRouteConfidence", String(state.confidence));
            $("feedbackScore").textContent = "策略置信度：" + (state.confidence * 100).toFixed(1) + "%（负向反馈已记录，演示）";
        });

        var initialWeatherSetup = function () {
            state.weatherCode = null;
            state.weatherTemp = null;
            state.weatherTempMin = null;
            state.weatherTempMax = null;
            state.uvIndex = null;
            state.airQuality = null;
            state.humidity = null;
            state.windLevel = null;
            state.weatherAnalysis = null;
            state.clothingAdvice = null;
            $("liveWeather").textContent = "等待选择目的地";
            $("liveWeatherSub").textContent = "请在左侧选择目的地";
            $("liveTraffic").textContent = "--";
            $("liveCapacity").textContent = "--";
            $("liveUpdated").textContent = "尚未加载";
        };
        initialWeatherSetup();
        requestAnimationFrame(syncPlannerPanelHeights);
        // 进一步确保在字体/布局微调后仍对齐
        window.setTimeout(function () {
            syncPlannerPanelHeights();
        }, 420);
        window.setTimeout(function () {
            syncPlannerPanelHeights();
        }, 900);
        window.addEventListener("resize", function () {
            if (!syncPlannerPanelHeights) return;
            if (syncPlannerPanelHeights._t) window.clearTimeout(syncPlannerPanelHeights._t);
            syncPlannerPanelHeights._t = window.setTimeout(function () {
                syncPlannerPanelHeights();
            }, 150);
        });
        renderLocalFarmRec();

        if ($("filterDestination")) {
            $("filterDestination").addEventListener("change", function () {
                var destinationId = this.value;
                if ($("routePlan")) {
                    $("routePlan").innerHTML =
                        '<p class="route-plan-placeholder">目的地已切换，请重新点击“生成定制化路线”。</p>';
                }
                if ($("feedbackRow")) $("feedbackRow").hidden = true;
                hideScenicBooking();
                if ($("adjustLog")) $("adjustLog").hidden = true;
                if ($("adjustLogList")) $("adjustLogList").innerHTML = "";
                if ($("rlMeter")) $("rlMeter").hidden = true;
                if ($("rlMeterFill")) $("rlMeterFill").style.width = "0%";
                if ($("rlMeterNote")) $("rlMeterNote").textContent = "";

                if (destinationId === "all") {
                    initialWeatherSetup();
                    renderLocalFarmRec();
                    return;
                }
                state.weatherCode = null;
                state.weatherTemp = null;
                state.weatherTempMin = null;
                state.weatherTempMax = null;
                state.uvIndex = null;
                state.airQuality = null;
                state.humidity = null;
                state.windLevel = null;
                state.weatherAnalysis = null;
                state.clothingAdvice = null;
                jitterLive();
                renderLive();
                $("liveWeatherSub").textContent = "请点击「刷新实时态势」加载联网天气";
                $("liveUpdated").textContent = "尚未加载 · 需手动刷新";
                renderLocalFarmRec();
            });

            // 支持从站内搜索/跳转携带目的地参数，自动定位并刷新展示
            try {
                var params = new URLSearchParams(window.location.search);
                var dest = params.get("destination");
                if (dest) {
                    var sel = $("filterDestination");
                    var ok = false;
                    for (var i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value === dest) {
                            ok = true;
                            break;
                        }
                    }
                    if (ok) {
                        sel.value = dest;
                        var evt = document.createEvent("HTMLEvents");
                        evt.initEvent("change", true, false);
                        sel.dispatchEvent(evt);
                    }
                }
            } catch (e) {}
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initAiPlanner);
    } else {
        initAiPlanner();
    }
})();
