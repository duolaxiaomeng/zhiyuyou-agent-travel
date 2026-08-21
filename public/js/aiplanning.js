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

    function setEmptyHint(id, show) {
        var el = $(id);
        if (el) el.hidden = !show;
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
        if (!destId || destId === "all") {
            setEmptyHint("localFarmEmpty", true);
            return;
        }
        if (!window.ZYYShop || typeof window.ZYYShop.getProductsByDistrict !== "function") {
            setEmptyHint("localFarmEmpty", true);
            return;
        }

        var label = getDestinationLabel(destId);
        var list = window.ZYYShop.getProductsByDistrict(label) || [];
        if (!list.length) {
            setEmptyHint("localFarmEmpty", true);
            return;
        }

        var inCartIds = loadCartProductIds();
        var max = 6;
        var slice = list.slice(0, max);

        panel.hidden = false;
        setEmptyHint("localFarmEmpty", false);

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
        setEmptyHint("scenicBookingEmpty", true);
    }

    function renderScenicBookingLinks(links) {
        var panel = $("scenicBookingPanel");
        var list = $("scenicBookingList");
        if (!panel || !list) return;
        if (!Array.isArray(links) || !links.length) {
            panel.hidden = true;
            list.innerHTML = "";
            setEmptyHint("scenicBookingEmpty", true);
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
        setEmptyHint("scenicBookingEmpty", false);
    }

    function fetchScenicBookingLinks(routeText, destination, destinationId) {
        var panel = $("scenicBookingPanel");
        var list = $("scenicBookingList");
        if (!panel || !list || !routeText) return Promise.resolve();
        panel.hidden = false;
        setEmptyHint("scenicBookingEmpty", false);
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
                setEmptyHint("scenicBookingEmpty", true);
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

    /* ================= 腾讯地图 GL(全屏沉浸式底图) ================= */

    var tmap = {
        map: null,
        ready: false,
        key: "",
        infoWindow: null,
        multiMarker: null,
        polylines: [],
        stops: [] // 最近一次生成的节点(含坐标)
    };

    var DAY_COLORS = ["#2f7d5c", "#35709e", "#c07a1e", "#5b54b8", "#b83a5e", "#0e8a8a", "#7a5cc0"];

    function dayColor(dayIdx) {
        return DAY_COLORS[dayIdx % DAY_COLORS.length];
    }

    function showMapFallback() {
        var fb = $("plannerMapFallback");
        if (fb) fb.hidden = false;
        tmap.ready = false;
        tmap.map = null;
    }

    function loadScriptOnce(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error("script load failed: " + src)); };
            document.head.appendChild(s);
        });
    }

    function initTMap() {
        var mapEl = $("plannerMap");
        if (!mapEl) return;
        fetch("/api/public-config")
            .then(function (r) { return r.json(); })
            .then(function (cfg) {
                var key = cfg && cfg.tencentMapKey ? String(cfg.tencentMapKey).trim() : "";
                if (!key) {
                    showMapFallback();
                    return null;
                }
                tmap.key = key;
                // 腾讯 GL 不需要安全密钥,直接带 key 加载即可
                return loadScriptOnce(
                    "https://map.qq.com/api/gljs?v=1.exp&key=" + encodeURIComponent(key)
                ).then(function () {
                    // gljs 只是个加载器,真正的 TMap.Map 异步注入,需要轮询等待
                    return new Promise(function (resolve, reject) {
                        var waited = 0;
                        var timer = setInterval(function () {
                            if (window.TMap && window.TMap.Map) {
                                clearInterval(timer);
                                resolve();
                            } else if ((waited += 200) >= 8000) {
                                clearInterval(timer);
                                reject(new Error("TMap 库加载超时"));
                            }
                        }, 200);
                    });
                }).then(function () {
                    try {
                        tmap.map = new TMap.Map(mapEl, {
                            // 注意:腾讯 LatLng 参数顺序是 (lat, lng),与高德相反
                            center: new TMap.LatLng(29.563, 106.5516),
                            zoom: 10,
                            viewMode: "2D"
                        });
                        tmap.ready = true;
                    } catch (e) {
                        console.error("腾讯地图初始化失败", e);
                        showMapFallback();
                    }
                });
            })
            .catch(function (e) {
                console.error("地图配置加载失败", e);
                showMapFallback();
            });
    }

    function clearMapOverlays() {
        if (tmap.multiMarker) {
            try { tmap.multiMarker.setMap(null); } catch (e) {}
            tmap.multiMarker = null;
        }
        tmap.polylines.forEach(function (pl) {
            try { pl.setMap(null); } catch (e) {}
        });
        tmap.polylines = [];
        tmap.stops = [];
        if (tmap.infoWindow) {
            try { tmap.infoWindow.close(); } catch (e) {}
        }
    }

    function focusStopOnMap(stop) {
        if (!tmap.ready || !stop) return;
        if (!stop.coord) {
            // 没解析到坐标:给出可见反馈而不是静默无反应
            var sheet = $("pv2Sheet");
            var el = sheet && sheet.querySelector('.pv2-stop[data-gidx="' + (tmap.stops || []).indexOf(stop) + '"]');
            if (el) {
                el.classList.add("pv2-stop-miss");
                setTimeout(function () { el.classList.remove("pv2-stop-miss"); }, 1800);
            }
            return;
        }
        try {
            var center = new TMap.LatLng(stop.coord.lat, stop.coord.lng);
            tmap.map.easeTo({ center: center, zoom: 15 }, { duration: 800 });
            var html =
                '<div class="pv2-iw"><b>' + escapeHtml(stop.name) + "</b>" +
                '<p class="sub">' +
                escapeHtml([stop.time, stop.tag, stop.dur ? "停留 " + stop.dur : ""].filter(Boolean).join(" · ")) +
                (stop.desc ? "<br>" + escapeHtml(stop.desc) : "") +
                "</p></div>";
            if (!tmap.infoWindow) {
                // 腾讯 InfoWindow 构造时就必须有合法 position,所以懒创建
                tmap.infoWindow = new TMap.InfoWindow({
                    map: tmap.map,
                    position: center,
                    offset: { x: 0, y: -18 }
                });
            }
            tmap.infoWindow.setPosition(center);
            tmap.infoWindow.setContent(html);
            tmap.infoWindow.open();
        } catch (e) {
            console.warn("地图定位失败", e);
        }
    }

    /* ---- 地理编码:内置常见景点坐标字典优先,查不到再走 WebService JSONP ---- */

    // 常见景点坐标(腾讯/国测局 GCJ-02 系下的近似值;键为名称关键字,坐标为 lat, lng)
    var SPOT_DICT = [
        { keys: ["解放碑"], lat: 29.5570, lng: 106.5769 },
        { keys: ["洪崖洞"], lat: 29.5634, lng: 106.5785 },
        { keys: ["磁器口"], lat: 29.5800, lng: 106.4490 },
        { keys: ["长江索道"], lat: 29.5565, lng: 106.5880 },
        { keys: ["南山一棵树", "一棵树"], lat: 29.5210, lng: 106.5830 },
        { keys: ["天生三桥"], lat: 29.3160, lng: 107.7880 },
        { keys: ["仙女山"], lat: 29.4480, lng: 107.6590 },
        { keys: ["李子坝"], lat: 29.5520, lng: 106.5350 },
        { keys: ["朝天门"], lat: 29.5667, lng: 106.5833 },
        { keys: ["大足石刻"], lat: 29.7010, lng: 105.7190 },
        { keys: ["十八梯"], lat: 29.5531, lng: 106.5694 },
        { keys: ["山城步道", "第三步道"], lat: 29.5550, lng: 106.5630 },
        { keys: ["湖广会馆"], lat: 29.5683, lng: 106.5831 },
        { keys: ["三峡博物馆", "中国三峡博物馆"], lat: 29.5626, lng: 106.5512 },
        { keys: ["八一路", "八一好吃街"], lat: 29.5565, lng: 106.5750 },
        { keys: ["观音桥"], lat: 29.5750, lng: 106.5330 },
        { keys: ["千厮门大桥"], lat: 29.5660, lng: 106.5810 },
        { keys: ["鹅岭"], lat: 29.5530, lng: 106.5290 },
        { keys: ["白公馆"], lat: 29.5880, lng: 106.4250 },
        { keys: ["渣滓洞"], lat: 29.5900, lng: 106.4280 },
        { keys: ["缙云山"], lat: 29.8350, lng: 106.3950 },
        { keys: ["金佛山"], lat: 29.0500, lng: 107.1000 },
        { keys: ["龚滩古镇"], lat: 28.9530, lng: 108.3950 },
        { keys: ["酉阳桃花源", "桃花源"], lat: 28.8450, lng: 108.7680 }
    ];

    function lookupSpotDict(name) {
        if (!name) return null;
        for (var i = 0; i < SPOT_DICT.length; i++) {
            var ks = SPOT_DICT[i].keys;
            for (var j = 0; j < ks.length; j++) {
                if (name.indexOf(ks[j]) >= 0) {
                    return { lat: SPOT_DICT[i].lat, lng: SPOT_DICT[i].lng };
                }
            }
        }
        return null;
    }

    // 走服务端代理(带持久缓存),不再浏览器直连 WebService,避免重复消耗每日配额
    function serverPlaceSearch(keyword) {
        return fetch("/api/geo-search?keyword=" + encodeURIComponent(keyword))
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (data && data.coord && isFinite(data.coord.lat) && isFinite(data.coord.lng)) {
                    return { lat: Number(data.coord.lat), lng: Number(data.coord.lng) };
                }
                return null;
            })
            .catch(function () { return null; });
    }

    function geocodeStop(stop) {
        var hit = lookupSpotDict(stop.name);
        if (hit) return Promise.resolve(hit);
        return serverPlaceSearch(stop.name);
    }

    // 逐个解析节点坐标(JSONP 请求 200ms 间隔防限流,失败的跳过),再画 marker 与虚线
    function plotDaysOnMap(days) {
        if (!tmap.ready || !window.TMap) return;
        clearMapOverlays();
        var stops = [];
        days.forEach(function (day, di) {
            day.stops.forEach(function (stop) {
                stops.push(stop);
                stop._dayIdx = di;
            });
        });
        tmap.stops = stops;

        var queue = stops.slice();
        function step() {
            if (!queue.length) {
                finishPlot(days);
                return;
            }
            var stop = queue.shift();
            var dictHit = lookupSpotDict(stop.name);
            geocodeStop(stop).then(function (coord) {
                if (coord) stop.coord = coord;
                // 字典命中的不占用接口配额,立即处理下一个
                setTimeout(step, dictHit ? 0 : 200);
            });
        }
        step();
    }

    /* ---- 编号圆点 marker:canvas 生成按天配色的圆形数字图标 ---- */

    var markerStyleCache = {};

    function getMarkerStyle(dayIdx, num) {
        var id = "pv2d" + dayIdx + "n" + num;
        if (markerStyleCache[id]) return { id: id, style: markerStyleCache[id] };
        var size = 56; // 2 倍尺寸保证清晰
        var cv = document.createElement("canvas");
        cv.width = size;
        cv.height = size;
        var ctx = cv.getContext("2d");
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
        ctx.fillStyle = dayColor(dayIdx);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), size / 2, size / 2 + 1);
        var style = new TMap.MarkerStyle({
            width: 28,
            height: 28,
            src: cv.toDataURL("image/png"),
            anchor: { x: 14, y: 14 }
        });
        markerStyleCache[id] = style;
        return { id: id, style: style };
    }

    function finishPlot(days) {
        if (!tmap.ready) return;
        var styles = {};
        var geometries = [];
        var bounds = new TMap.LatLngBounds();
        var hasPt = false;
        var gidx = 0;
        days.forEach(function (day, di) {
            var color = dayColor(di);
            var paths = [];
            day.stops.forEach(function (stop) {
                gidx++;
                if (!stop.coord) return;
                var pos = new TMap.LatLng(stop.coord.lat, stop.coord.lng);
                paths.push(pos);
                bounds.extend(pos);
                hasPt = true;
                var ms = getMarkerStyle(di, gidx);
                styles[ms.id] = ms.style;
                geometries.push({
                    id: ms.id + "_" + gidx,
                    styleId: ms.id,
                    position: pos,
                    properties: { gidx: gidx - 1 }
                });
            });
            if (paths.length >= 2) {
                var pl = new TMap.MultiPolyline({
                    map: tmap.map,
                    styles: {
                        day: new TMap.PolylineStyle({
                            color: color,
                            width: 4,
                            borderWidth: 0,
                            lineCap: "round",
                            dashArray: [6, 8]
                        })
                    },
                    geometries: [{ id: "pv2day_" + di, styleId: "day", paths: paths }]
                });
                tmap.polylines.push(pl);
            }
        });
        if (geometries.length) {
            tmap.multiMarker = new TMap.MultiMarker({
                map: tmap.map,
                styles: styles,
                geometries: geometries
            });
            tmap.multiMarker.on("click", function (evt) {
                var g = evt && evt.geometry;
                if (g && g.properties && typeof g.properties.gidx === "number") {
                    var stop = tmap.stops[g.properties.gidx];
                    if (stop) {
                        focusStopOnMap(stop);
                        revealStopInSheet(g.properties.gidx);
                    }
                }
            });
        }
        if (hasPt) {
            try {
                tmap.map.fitBounds(bounds, { padding: { top: 90, bottom: 300, left: 300, right: 60 } });
            } catch (e) {
                try { tmap.map.fitBounds(bounds); } catch (e2) {}
            }
        }
    }

    /* ================= 路线 Markdown → 按天卡片解析 ================= */

    var CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

    var DAY_HEAD_RE = /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:第\s*([0-9一二三四五六七八九十]{1,3})\s*天|Day\s*([0-9]{1,2}))/i;

    function parseDayHead(line) {
        var m = line.match(DAY_HEAD_RE);
        if (!m) return null;
        // 排除「## 逐日安排」之类不含数字的标题:正则本身已要求数字/中文数字
        var num = m[1] ? (CN_NUM[m[1]] || parseInt(m[1], 10)) : parseInt(m[2], 10);
        if (!num || isNaN(num)) return null;
        var rest = line.slice(m[0].length)
            .replace(/\*\*/g, "")
            .replace(/^[\s:：\-—·、.]+/, "")
            .replace(/[\s\-—*.]+$/, "")
            .trim();
        return { num: num, title: rest };
    }

    function guessTag(line) {
        if (/夜景|夜色|夜游/.test(line)) return "夜景";
        if (/火锅|小吃|美食|餐|吃|烧烤|夜市|茶(馆|楼)/.test(line)) return "美食";
        if (/徒步|登山|步道|爬山/.test(line)) return "徒步";
        if (/亲子|乐园|儿童|小朋友/.test(line)) return "亲子";
        if (/摄影|拍照|打卡|机位|观景台/.test(line)) return "摄影";
        if (/古镇|博物|人文|历史|寺庙|文化|旧址|老街|非遗/.test(line)) return "人文";
        if (/山|湖|公园|森林|草原|瀑布|峡谷|江|河|自然|湿地|花海/.test(line)) return "自然";
        return "";
    }

    function parseStopLine(line) {
        var raw = line.trim();
        if (!raw) return null;
        var isListItem = /^([-*•+]|\d{1,2}[.、)）])\s+/.test(raw);
        var timeM = raw.match(/([01]?\d|2[0-3])[:：][0-5]\d/);
        if (!isListItem && !timeM) return null;

        var name = null;
        var boldM = raw.match(/\*\*([^*<>]{1,30})\*\*/);
        if (boldM && !/^(第.{1,4}天|Day\s*\d|行程|攻略|提示|注意|交通|住宿|预算|费用|来源|参考|资料)/i.test(boldM[1].trim())) {
            name = boldM[1].trim();
        } else if (timeM) {
            var rest = raw.slice(raw.indexOf(timeM[0]) + timeM[0].length)
                .replace(/^[\s:：\-—、.~～]+/, "");
            var nm = rest.match(/^[^，,。.:：;；\s(（【\[][^，,。:：;；(（【\[]*/);
            if (nm) name = nm[0].trim();
        }
        // 加粗词里混了时间(如「**09:00 解放碑**」)时把时间剥掉
        if (name) {
            var nameTimeM = name.match(/([01]?\d|2[0-3])[:：][0-5]\d/);
            if (nameTimeM) {
                name = name.replace(nameTimeM[0], "").replace(/^[\s:：\-—、.~～]+|[\s:：\-—、.~～]+$/g, "").trim();
            }
        }
        if (!name || name.length < 2 || name.length > 30) return null;
        if (/^(第.{1,4}天|Day\s*\d)/i.test(name)) return null;

        var desc = raw
            .replace(/^([-*•+]|\d{1,2}[.、)）])\s+/, "")
            .replace(/\*\*([^*]*)\*\*/g, "$1");
        if (timeM) desc = desc.replace(timeM[0], "");
        desc = desc.replace(name, "").replace(/^[\s:：\-—、.|·~～(（)）,，。]+/, "").trim();
        if (desc.length > 120) desc = desc.slice(0, 120) + "…";

        var durM = raw.match(/(?:停留|游览|游玩|参观|用时|约|耗时)\s*([0-9.]+\s*(?:小时|分钟|h|min))/i);
        if (!durM) durM = raw.match(/([0-9.]+\s*(?:小时|分钟))(?![0-9])/);
        return {
            time: timeM ? timeM[0] : "",
            name: name,
            desc: desc,
            dur: durM ? durM[1].replace(/\s+/g, "") : "",
            tag: guessTag(raw)
        };
    }

    // 把整段路线 markdown 切成「天」,尽力提取节点;解析不出节点的天保留原文
    function parseRouteDays(md) {
        var days = [];
        var current = null;
        var lines = String(md || "").split(/\r?\n/);
        lines.forEach(function (line) {
            var head = parseDayHead(line);
            if (head) {
                current = { num: head.num, title: head.title, stops: [], rawLines: [] };
                days.push(current);
                return;
            }
            if (!current) return;
            // 遇到非「天」的一二级标题(如 知识来源/动态调整说明),当天段落结束,不再解析节点
            if (/^\s*#{1,2}\s+/.test(line)) {
                current = null;
                return;
            }
            var stop = parseStopLine(line);
            if (stop) {
                // 同名去重(同一天内)
                var dup = current.stops.some(function (s) { return s.name === stop.name; });
                if (!dup) current.stops.push(stop);
            }
            if (line.trim()) current.rawLines.push(line);
        });
        days.forEach(function (d) {
            d.raw = d.rawLines.join("\n").trim();
        });
        return days;
    }

    /* ================= 底部按天卡片 + 左侧总览 ================= */

    function renderDayCards(days) {
        var sheet = $("pv2Sheet");
        if (!sheet) return;
        var gidx = 0;
        sheet.innerHTML = days
            .map(function (day, di) {
                var head =
                    '<div class="pv2-daycard-hd"><span class="dn">DAY ' + day.num + "</span>" +
                    '<span class="t">' + escapeHtml(day.title || ("第 " + day.num + " 天")) + "</span>" +
                    '<button type="button" class="pv2-fold" aria-label="折叠/展开当天卡片">▾</button></div>';
                var body;
                if (day.stops.length) {
                    body = '<div class="pv2-daycard-bd">' + day.stops
                        .map(function (stop) {
                            gidx++;
                            var meta = "";
                            if (stop.tag) meta += '<span class="pv2-tag ' + escapeHtml(stop.tag) + '">' + escapeHtml(stop.tag) + "</span>";
                            if (stop.dur) meta += '<span class="pv2-dur">⏱ ' + escapeHtml(stop.dur) + "</span>";
                            return (
                                '<div class="pv2-stop" data-gidx="' + (gidx - 1) + '">' +
                                '<span class="time">' + escapeHtml(stop.time || "--") + "</span>" +
                                '<span class="idx" style="background:' + dayColor(di) + '">' + gidx + "</span>" +
                                "<div>" +
                                '<div class="n">' + escapeHtml(stop.name) + "</div>" +
                                (stop.desc ? '<div class="d">' + escapeHtml(stop.desc) + "</div>" : "") +
                                (meta ? '<div class="meta">' + meta + "</div>" : "") +
                                "</div></div>"
                            );
                        })
                        .join("") + "</div>";
                } else {
                    // 解析不出节点:把当天原始 markdown 渲染进卡片,不允许空白
                    var rawHtml;
                    var rawMd = day.raw || "（该天内容为空）";
                    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
                        try {
                            rawHtml = DOMPurify.sanitize(marked.parse(rawMd, { breaks: true }));
                        } catch (e) {
                            rawHtml = escapeHtml(rawMd);
                        }
                    } else {
                        rawHtml = escapeHtml(rawMd);
                    }
                    body = '<div class="pv2-daycard-raw">' + rawHtml + "</div>";
                }
                return '<div class="pv2-daycard">' + head + body + "</div>";
            })
            .join("");
        sheet.classList.add("show");
    }

    function hideDayCards() {
        var sheet = $("pv2Sheet");
        if (!sheet) return;
        sheet.classList.remove("show");
        sheet.innerHTML = "";
    }

    function updateOverview(days, destLabel) {
        var stops = 0;
        (days || []).forEach(function (d) { stops += d.stops.length; });
        if ($("ovDays")) $("ovDays").textContent = days && days.length ? String(days.length) : "-";
        if ($("ovStops")) $("ovStops").textContent = stops ? String(stops) : "-";
        if ($("ovDest") && destLabel) $("ovDest").textContent = destLabel;
    }

    /* 点击地图标记 → 展开对应卡片、滚动到对应节点并高亮 */
    function revealStopInSheet(gidx) {
        var sheet = $("pv2Sheet");
        if (!sheet || !sheet.classList.contains("show")) return;
        var stopEl = sheet.querySelector('.pv2-stop[data-gidx="' + gidx + '"]');
        if (!stopEl) return;
        var card = stopEl.closest(".pv2-daycard");
        if (card && card.classList.contains("folded")) card.classList.remove("folded");
        if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        setTimeout(function () {
            stopEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 250);
        stopEl.classList.add("pv2-stop-hl");
        setTimeout(function () { stopEl.classList.remove("pv2-stop-hl"); }, 1800);
    }

    /* 点击 DAY 卡片 → 地图飞到当天所有节点的范围 */
    function flyToDayCard(cardEl) {
        if (!tmap.ready) return;
        var stops = cardEl.querySelectorAll(".pv2-stop[data-gidx]");
        var bounds = new TMap.LatLngBounds();
        var n = 0, last = null;
        stops.forEach(function (el) {
            var s = tmap.stops && tmap.stops[parseInt(el.getAttribute("data-gidx"), 10)];
            if (s && s.coord) {
                last = new TMap.LatLng(s.coord.lat, s.coord.lng);
                bounds.extend(last);
                n++;
            }
        });
        if (!n) return;
        try {
            if (n === 1) {
                tmap.map.easeTo({ center: last, zoom: 14 }, { duration: 800 });
            } else {
                tmap.map.fitBounds(bounds, { padding: { top: 90, bottom: 300, left: 300, right: 60 } });
            }
        } catch (e) {}
    }

    function initSheetClick() {
        var sheet = $("pv2Sheet");
        if (!sheet) return;
        sheet.addEventListener("click", function (e) {
            var foldBtn = e.target && e.target.closest ? e.target.closest(".pv2-fold") : null;
            if (foldBtn) {
                var card = foldBtn.closest(".pv2-daycard");
                if (card) card.classList.toggle("folded");
                return;
            }
            var el = e.target && e.target.closest ? e.target.closest(".pv2-stop") : null;
            if (el) {
                var gidx = parseInt(el.getAttribute("data-gidx"), 10);
                var stop = tmap.stops && tmap.stops[gidx];
                if (stop) focusStopOnMap(stop);
                return;
            }
            // 点卡片其它区域(如标题栏):地图飞到当天范围
            var card = e.target && e.target.closest ? e.target.closest(".pv2-daycard") : null;
            if (card) flyToDayCard(card);
        });
    }

    function openRouteSection() {
        var sec = $("pv2SecRoute");
        if (sec && !sec.open) sec.open = true;
    }

    /* ================= 主流程 ================= */

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
        initTMap();
        initSheetClick();

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
            hideDayCards();
            clearMapOverlays();
            updateOverview(null, destLabel);
            openRouteSection();
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
                    // 输出完成后收起进度条
                    setTimeout(function () { meter.hidden = true; }, 600);
                    showRouteFeedbackAfterStream();
                    fetchScenicBookingLinks(reply, destLabel, destinationId);
                    var days = parseRouteDays(reply);
                    if (days.length) {
                        renderDayCards(days);
                        updateOverview(days, destLabel);
                        plotDaysOnMap(days);
                    }
                    btn.disabled = false;
                    btn.textContent = "AI规划路线";
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
                        btn.textContent = "AI规划路线";
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
            $("liveWeatherSub").textContent = "请在顶部条件栏选择目的地";
            $("liveTraffic").textContent = "--";
            $("liveCapacity").textContent = "--";
            $("liveUpdated").textContent = "尚未加载";
        };
        initialWeatherSetup();
        renderLocalFarmRec();

        if ($("filterDestination")) {
            $("filterDestination").addEventListener("change", function () {
                var destinationId = this.value;
                if ($("routePlan")) {
                    $("routePlan").innerHTML =
                        '<p class="route-plan-placeholder">目的地已切换，请重新点击「AI规划路线」。</p>';
                }
                if ($("feedbackRow")) $("feedbackRow").hidden = true;
                hideScenicBooking();
                hideDayCards();
                clearMapOverlays();
                updateOverview(null, getDestinationLabel(destinationId));
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
