(function () {
  var shell = document.getElementById("weatherPoster");
  if (!shell) return;

  var districtEl = document.getElementById("weatherDistrict");
  var badgeEl = document.getElementById("weatherTypeBadge");
  var tempEl = document.getElementById("weatherTemp");
  var adviceEl = document.getElementById("weatherAdvice");
  var spotsEl = document.getElementById("weatherSpots");
  var tipEl = document.getElementById("weatherTip");
  var scenicImgEl = document.getElementById("weatherScenicImg");
  var prevBtn = document.getElementById("weatherPrev");
  var nextBtn = document.getElementById("weatherNext");
  var dotsEl = document.getElementById("weatherDots");

  function siteApiHomeAssetImages(dir) {
    if (typeof window === "undefined" || !window.location) return "";
    if (window.location.protocol === "file:") return "";
    var p = window.location.pathname || "/";
    var i = p.lastIndexOf("/");
    var base = i >= 0 ? p.slice(0, i + 1) : "/";
    return base + "api/home-asset-images?dir=" + encodeURIComponent(dir);
  }

  var districtCoords = {
    "合川区": { lat: 29.99, lon: 106.27 },
    "酉阳县": { lat: 28.839, lon: 108.767 },
    "巫山县": { lat: 31.042, lon: 109.878 },
    "秀山县": { lat: 28.447, lon: 108.988 },
    "彭水县": { lat: 29.294, lon: 108.166 },
    "石柱县": { lat: 30.0, lon: 108.114 },
    "巫溪县": { lat: 31.397, lon: 109.628 },
    "城口县": { lat: 31.947, lon: 108.664 },
    "丰都县": { lat: 29.863, lon: 107.732 },
    "南川区": { lat: 29.157, lon: 107.099 },
  };

  function uniquePushUrl(arr, u) {
    if (u && arr.indexOf(u) === -1) arr.push(u);
  }

  function weatherLabelInFilename(mode) {
    if (mode === "rain") return "雨天";
    if (mode === "cloudy") return "阴天";
    return "晴天";
  }

  /** 文件名里与 Open-Meteo 模式对应的天气词（适配「地区+天气」命名） */
  function fileMatchesWeatherMode(fnLower, mode) {
    if (mode === "rain") {
      if (fnLower.indexOf("雨天") >= 0 || fnLower.indexOf("下雨") >= 0 || fnLower.indexOf("降雨") >= 0) {
        return true;
      }
      if (fnLower.indexOf("雨") >= 0 && fnLower.indexOf("雪") < 0) return true;
      return false;
    }
    if (mode === "cloudy") {
      if (fnLower.indexOf("阴天") >= 0 || fnLower.indexOf("多云") >= 0) return true;
      if (fnLower.indexOf("阴") >= 0 && fnLower.indexOf("晴天") < 0) return true;
      return false;
    }
    if (fnLower.indexOf("晴天") >= 0) return true;
    if (fnLower.indexOf("晴") >= 0 && fnLower.indexOf("阴") < 0) return true;
    return false;
  }

  /** 与文件名比对的区县关键词：全称优先，再去掉区/县/市等后缀 */
  function districtKeysForMatch(item) {
    var d = String(item.district || "").trim();
    var keys = [];
    if (d) keys.push(d);
    var short = d.replace(/(土家族自治县|苗族土家族自治县|自治县|自治州|区|县|市)$/g, "");
    if (short && keys.indexOf(short) === -1) keys.push(short);
    keys.sort(function (a, b) {
      return b.length - a.length;
    });
    return keys.map(function (k) {
      return k.toLowerCase();
    });
  }

  function fileBaseLower(url) {
    return ((String(url).split("/").pop()) || "").toLowerCase();
  }

  function fileMatchesDistrict(fnLower, keysLower) {
    var i;
    for (i = 0; i < keysLower.length; i += 1) {
      if (keysLower[i] && fnLower.indexOf(keysLower[i]) >= 0) return true;
    }
    return false;
  }

  /**
   * 在当前天气文件夹内，按「地区名 + 天气」选图；不再依赖 weatherCardStem 或固定示例文件名。
   */
  function pickWeatherDiskImage(item, mode, files) {
    if (!files || !files.length) return null;
    var keys = districtKeysForMatch(item);
    var i;
    var f;
    var fn;
    for (i = 0; i < files.length; i += 1) {
      f = files[i];
      fn = fileBaseLower(f);
      if (fileMatchesWeatherMode(fn, mode) && fileMatchesDistrict(fn, keys)) return f;
    }
    for (i = 0; i < files.length; i += 1) {
      f = files[i];
      fn = fileBaseLower(f);
      if (fileMatchesDistrict(fn, keys)) return f;
    }
    var withWeather = files.filter(function (url) {
      return fileMatchesWeatherMode(fileBaseLower(url), mode);
    });
    if (withWeather.length) {
      var idx = districtSeed.findIndex(function (x) {
        return x.district === item.district;
      });
      return withWeather[(idx >= 0 ? idx : 0) % withWeather.length];
    }
    var idx2 = districtSeed.findIndex(function (x) {
      return x.district === item.district;
    });
    return files[(idx2 >= 0 ? idx2 : 0) % files.length];
  }

  /** 供 img 逐级 onerror：优先同区县同天气，再同区县，再同天气，最后文件夹内任意图 */
  function buildWeatherImageCandidates(item, mode, files) {
    var out = [];
    var keys = districtKeysForMatch(item);
    var primary = pickWeatherDiskImage(item, mode, files);
    if (primary) uniquePushUrl(out, primary);
    (files || []).forEach(function (f) {
      var fn = fileBaseLower(f);
      if (fileMatchesWeatherMode(fn, mode) && fileMatchesDistrict(fn, keys)) uniquePushUrl(out, f);
    });
    (files || []).forEach(function (f) {
      var fn = fileBaseLower(f);
      if (fileMatchesDistrict(fn, keys)) uniquePushUrl(out, f);
    });
    (files || []).forEach(function (f) {
      var fn = fileBaseLower(f);
      if (fileMatchesWeatherMode(fn, mode)) uniquePushUrl(out, f);
    });
    (files || []).forEach(function (f) {
      uniquePushUrl(out, f);
    });
    uniquePushUrl(out, "assets/hero/slide-01.png");
    return out;
  }

  /** 服务端扫描 assets 后缓存，用于把磁盘上的任意命名图匹配到区县 */
  var weatherFilesCache = { sunny: [], cloudy: [], rain: [] };

  function weatherDirParam(mode) {
    if (mode === "rain") return "天气卡片雨天";
    if (mode === "cloudy") return "天气卡片阴天";
    return "天气卡片晴天";
  }

  function loadWeatherFolder(mode) {
    if (weatherFilesCache[mode] && weatherFilesCache[mode].length) {
      return Promise.resolve(weatherFilesCache[mode]);
    }
    if (typeof fetch === "undefined") {
      weatherFilesCache[mode] = [];
      return Promise.resolve([]);
    }
    var apiUrl = siteApiHomeAssetImages(weatherDirParam(mode));
    if (!apiUrl) {
      weatherFilesCache[mode] = [];
      return Promise.resolve([]);
    }
    return fetch(apiUrl)
      .then(function (r) {
        return r.ok ? r.json() : { urls: [] };
      })
      .then(function (d) {
        weatherFilesCache[mode] = (d && d.urls) || [];
        return weatherFilesCache[mode];
      })
      .catch(function () {
        weatherFilesCache[mode] = [];
        return [];
      });
  }

  function prefetchAllWeatherFolders() {
    return Promise.all([
      loadWeatherFolder("sunny"),
      loadWeatherFolder("cloudy"),
      loadWeatherFolder("rain"),
    ]);
  }

  var districtSeed = [
    {
      district: "合川区",
      adviceSunny: "晴天三江汇流视野通透，钓鱼城与滨江步道更适合串联游览。",
      adviceRain: "雨天古镇石板与江雾氛围更浓，建议以涞滩、文峰古街等人文点位为主。",
      adviceCloudy: "阴天适合钓鱼城历史线 + 江城慢游，光线柔和、步行更舒适。",
      tipSunny: "出行建议：江岸与城墙区域风感明显，注意防晒与补水。",
      tipRain: "出行建议：石板路与台阶湿滑，备伞穿防滑鞋。",
      tipCloudy: "出行建议：可上午钓鱼城、下午涞滩或古街，节奏更从容。",
      spots: [
        {
          name: "钓鱼城景区",
          reasonSunny: "晴天城墙与江面层次清晰，适合历史探访与远眺三江。",
          reasonRain: "雨雾中古城轮廓更有历史厚重感，适合短时停留与讲解线。",
          reasonCloudy: "阴天参观体感舒适，适合家庭与文化深度游。",
        },
        {
          name: "涞滩古镇",
          reasonSunny: "晴天街巷与寨墙光影分明，适合人文拍摄与慢逛。",
          reasonRain: "烟雨古镇氛围强，注意石板防滑，适合半日文化体验。",
          reasonCloudy: "阴天游客相对较少，更适合静心看古建细节。",
        },
      ],
    },
    {
      district: "酉阳县",
      adviceSunny: "晴天适合古镇街巷漫游和山地眺望。",
      adviceRain: "雨雾提升桃花源意境，适合慢节奏步行和文化体验。",
      adviceCloudy: "阴天适合文化线打卡，体感更舒适。",
      tipSunny: "出行建议：午后较热，建议带遮阳用品。",
      tipRain: "出行建议：石板路湿滑，建议穿防滑鞋。",
      tipCloudy: "出行建议：可安排半日古镇 + 半日山景。",
      spots: [
        {
          name: "酉阳桃花源",
          reasonSunny: "晴天洞天光影层次清晰，适合亲子游。",
          reasonRain: "雨天烟雨氛围更浓，洞天与古镇连片观感更佳。",
          reasonCloudy: "阴天步行舒适，文化体验节奏更从容。",
        },
        {
          name: "龚滩古镇",
          reasonSunny: "晴天江岸建筑色彩更鲜明，适合人文拍摄。",
          reasonRain: "乌江雨景层次更丰富，适合静态观景与轻徒步。",
          reasonCloudy: "阴天街巷不拥挤，适合深度慢游。",
        },
      ],
    },
    {
      district: "巫山县",
      adviceSunny: "晴天江峡线视野开阔，适合游船+观景台组合。",
      adviceRain: "雨天峡谷云雾更重，适合短线观景停留。",
      adviceCloudy: "云层条件下适合江岸漫游，视觉柔和且不易暴晒。",
      tipSunny: "出行建议：游船时段建议避开正午。",
      tipRain: "出行建议：雨天注意码头与栈道湿滑。",
      tipCloudy: "出行建议：早晚江风偏凉，备薄外套。",
      spots: [
        {
          name: "小三峡",
          reasonSunny: "晴天水色通透，适合游船观峡。",
          reasonRain: "雨雾中的峡谷层次更明显，景观更有氛围。",
          reasonCloudy: "阴天水面反光柔和，游船观峡谷更舒适。",
        },
        {
          name: "文峰景区",
          reasonSunny: "晴天远眺江峡全景更开阔。",
          reasonRain: "雨后山体云雾缭绕，更有意境。",
          reasonCloudy: "云层背景下山体线条更突出，适合观景打卡。",
        },
      ],
    },
    {
      district: "秀山县",
      adviceSunny: "晴天适合边城古渡+草场双点组合游。",
      adviceRain: "边城雨景有氛围，适合以文化街巷与轻轨迹游为主。",
      adviceCloudy: "阴天适合在古镇与草场间做慢节奏切换。",
      tipSunny: "出行建议：建议上午草场、下午古镇。",
      tipRain: "出行建议：建议携带折叠伞和速干外套。",
      tipCloudy: "出行建议：尽量避开晚间山区道路。",
      spots: [
        {
          name: "洪安边城",
          reasonSunny: "晴天更适合古渡与河岸建筑拍照。",
          reasonRain: "雨雾中的拉拉渡和江岸建筑更有边城故事感。",
          reasonCloudy: "阴天游客密度低，适合静态观景。",
        },
        {
          name: "川河盖草场",
          reasonSunny: "晴天草场地貌完整，适合徒步和打卡。",
          reasonRain: "雨后云海概率更高，适合短时观景停留。",
          reasonCloudy: "阴天光线柔和，草场层次更细腻。",
        },
      ],
    },
    {
      district: "彭水县",
      adviceSunny: "晴天适合九黎城和乌江画廊组合游，景观和文化都更完整。",
      adviceRain: "雨天建议以九黎城文化体验为主，减少长时户外。",
      adviceCloudy: "阴天适合人文+江景串联游，步行体感更好。",
      tipSunny: "出行建议：午后温度较高，错峰出行体验更好。",
      tipRain: "出行建议：雨天优先安排室内展陈与文化场馆。",
      tipCloudy: "出行建议：建议半日人文、半日江景线路。",
      spots: [
        {
          name: "蚩尤九黎城",
          reasonSunny: "晴天色彩饱和度高，苗族建筑群拍照表现更好。",
          reasonRain: "雨天更适合深度参观建筑与民俗展演。",
          reasonCloudy: "阴天光线均匀，建筑细节更好出片。",
        },
        {
          name: "阿依河景区",
          reasonSunny: "河谷水体通透度高，漂流和步道体验更佳。",
          reasonRain: "雨季水位变化大，建议以观景为主。",
          reasonCloudy: "阴天体感更舒适，适合长时步行。",
        },
      ],
    },
    {
      district: "石柱县",
      adviceSunny: "晴天适合森林氧吧慢游与高地观景。",
      adviceRain: "雨天建议缩短徒步距离，优先核心观景点。",
      adviceCloudy: "阴天适合森林慢游和土家文化体验，体感舒适且不晒。",
      tipSunny: "出行建议：建议准备防晒帽和轻便水壶。",
      tipRain: "出行建议：山区雨后道路湿滑，请放慢节奏。",
      tipCloudy: "出行建议：高海拔区域风大，请带防风外套。",
      spots: [
        {
          name: "黄水国家森林公园",
          reasonSunny: "晴天林地通透，适合亲子自然教育。",
          reasonRain: "雨后森林湿润，适合短时康养步道。",
          reasonCloudy: "阴天负氧离子体感强，适合康养式慢行。",
        },
        {
          name: "大风堡景区",
          reasonSunny: "晴天可远眺连绵山脊，景观开阔。",
          reasonRain: "雨后云海更容易出现，适合观景停留。",
          reasonCloudy: "云雾条件下峡谷与林海层次更明显。",
        },
      ],
    },
    {
      district: "巫溪县",
      adviceSunny: "晴天适合高山峡谷线，远眺视野更开阔。",
      adviceRain: "雨天建议改为短线观景，避免长距离穿越。",
      adviceCloudy: "阴天适合草甸慢游，整体体感舒适。",
      tipSunny: "出行建议：景区跨度较大，建议提前规划交通。",
      tipRain: "出行建议：山区降雨变化快，建议带雨具。",
      tipCloudy: "出行建议：建议增加补给停留点。",
      spots: [
        {
          name: "兰英大峡谷",
          reasonSunny: "阳光条件下峡谷色彩对比明显，适合航拍视角。",
          reasonRain: "雨后峡谷云雾层叠，适合定点观景。",
          reasonCloudy: "阴天光线均匀，适合人像与风光结合拍摄。",
        },
        {
          name: "红池坝景区",
          reasonSunny: "晴天高山草甸观景效果好，适合全天候慢游。",
          reasonRain: "雨季建议缩短徒步并预留返程时间。",
          reasonCloudy: "阴天适合轻强度漫游和打卡。",
        },
      ],
    },
    {
      district: "城口县",
      adviceSunny: "晴天适合高山林地路线，建议安排半日徒步。",
      adviceRain: "雨天适合以森林康养和短线观景为主，节奏放缓更舒服。",
      adviceCloudy: "阴天适合山谷慢游，适配家庭客群。",
      tipSunny: "出行建议：山区日照强，注意补水。",
      tipRain: "出行建议：山区弯道多，建议白天行车。",
      tipCloudy: "出行建议：可优先安排森林步道。",
      spots: [
        {
          name: "亢谷景区",
          reasonSunny: "晴天溪谷色彩通透，适合野趣打卡。",
          reasonRain: "雨后林木湿润，溪谷景观更有层次感。",
          reasonCloudy: "阴天适合低强度步道体验。",
        },
        {
          name: "九重山国家森林公园",
          reasonSunny: "晴天山脊线更清晰，适合观景拍摄。",
          reasonRain: "云雾天气更有原始森林氛围，适合轻徒步。",
          reasonCloudy: "阴天环境静谧，适合慢游康养。",
        },
      ],
    },
    {
      district: "丰都县",
      adviceSunny: "晴天适合山城文化线与江景观景台组合游。",
      adviceRain: "雨天建议优先洞穴与文化场馆，减少室外暴露时间。",
      adviceCloudy: "阴天适合文化景观打卡与室外轻步行，体感温和。",
      tipSunny: "出行建议：建议上午名山、下午洞穴线。",
      tipRain: "出行建议：雨天注意台阶防滑。",
      tipCloudy: "出行建议：景点台阶较多，穿舒适步行鞋。",
      spots: [
        {
          name: "丰都名山景区",
          reasonSunny: "晴天视野好，适合古建与江景同框拍摄。",
          reasonRain: "雨天可缩短外线，保留核心文化点位。",
          reasonCloudy: "阴天时人像与古建拍摄更柔和，适合深度参观。",
        },
        {
          name: "雪玉洞景区",
          reasonSunny: "夏日晴天可作为避暑点位，体感舒适。",
          reasonRain: "室内溶洞不受天气影响，雨天稳定可游览。",
          reasonCloudy: "室内溶洞不受阴天影响，全年可稳定游览。",
        },
      ],
    },
    {
      district: "南川区",
      adviceSunny: "晴天金佛山山脊与杜鹃带层次清晰，适合索道观景与高山徒步。",
      adviceRain: "雨后云雾缠绕山腰，适合短线观景与室内展馆穿插游览。",
      adviceCloudy: "阴天体感凉爽，适合森林步道与索道慢游。",
      tipSunny: "出行建议：海拔落差大，注意防晒与补水。",
      tipRain: "出行建议：栈道湿滑，备防滑鞋与雨具。",
      tipCloudy: "出行建议：山顶风大，备薄外套。",
      spots: [
        {
          name: "金佛山景区",
          reasonSunny: "晴天喀斯特台地与杜鹃花海对比鲜明，适合全景拍摄。",
          reasonRain: "雨雾中金佛山更有水墨意境，适合定点观景。",
          reasonCloudy: "阴天光线柔和，索道与步道游览更舒适。",
        },
        {
          name: "天星温泉小镇",
          reasonSunny: "晴天适合温泉与山地组合慢度假。",
          reasonRain: "雨天优先温泉与室内休闲，减少户外暴露。",
          reasonCloudy: "阴天泡汤体感舒适，适合家庭放松。",
        },
      ],
    },
  ];

  var currentIndex = 0;
  var timer = null;
  /** 与 districtSeed 下标对齐：各区县独立的气温区间与天气模式（Open-Meteo 按区县坐标拉取） */
  var districtForecastCache = [];

  function weatherClass(mode) {
    if (mode === "rain") return "weather--rain";
    if (mode === "cloudy") return "weather--cloudy";
    return "weather--sunny";
  }

  function getReasonByMode(spot, mode) {
    if (mode === "rain") return spot.reasonRain;
    if (mode === "cloudy") return spot.reasonCloudy;
    return spot.reasonSunny;
  }

  function getAdviceByMode(item, mode) {
    if (mode === "rain") return item.adviceRain;
    if (mode === "cloudy") return item.adviceCloudy;
    return item.adviceSunny;
  }

  function getTipByMode(item, mode) {
    if (mode === "rain") return item.tipRain;
    if (mode === "cloudy") return item.tipCloudy;
    return item.tipSunny;
  }

  function labelByMode(mode) {
    if (mode === "rain") return "雨天推荐";
    if (mode === "cloudy") return "阴天推荐";
    return "晴天推荐";
  }

  function pickDistrictFromLocation(lat, lon) {
    var best = districtSeed[0];
    var bestDist = Infinity;
    districtSeed.forEach(function (item) {
      var p = districtCoords[item.district];
      if (!p) return;
      var dLat = p.lat - lat;
      var dLon = p.lon - lon;
      var distance = dLat * dLat + dLon * dLon;
      if (distance < bestDist) {
        bestDist = distance;
        best = item;
      }
    });
    return best;
  }

  function attachImageFallbacks() {
    if (!scenicImgEl) return;
    scenicImgEl.addEventListener("error", function () {
      if (scenicImgEl.dataset.wcDead === "1") return;
      var raw = scenicImgEl.getAttribute("data-wc-candidates") || "";
      var parts = raw ? raw.split("|") : [];
      var ix = parseInt(scenicImgEl.getAttribute("data-wc-ix") || "0", 10);
      var next = ix + 1;
      if (next < parts.length) {
        scenicImgEl.setAttribute("data-wc-ix", String(next));
        scenicImgEl.src = parts[next];
        return;
      }
      scenicImgEl.dataset.wcDead = "1";
      scenicImgEl.removeAttribute("src");
      scenicImgEl.classList.add("is-missing");
      if (scenicImgEl.parentElement) scenicImgEl.parentElement.classList.add("is-missing");
    });
  }

  function forecastForIndex(index) {
    var fc = districtForecastCache[index];
    if (fc && fc.weatherMode) return fc;
    return { weatherMode: "sunny", tempRange: "--" };
  }

  function render(index) {
    var item = districtSeed[index];
    var fc = forecastForIndex(index);
    var mode = fc.weatherMode;
    districtEl.textContent = item.district;
    badgeEl.textContent = labelByMode(mode);
    tempEl.textContent = fc.tempRange;
    adviceEl.textContent = getAdviceByMode(item, mode);
    tipEl.textContent = getTipByMode(item, mode);

    shell.classList.remove("weather--sunny", "weather--rain", "weather--cloudy");
    shell.classList.add(weatherClass(mode));

    var topSpot = item.spots[0];
    spotsEl.innerHTML =
      '<li><strong>推荐景区：' + topSpot.name + "</strong><span>" + getReasonByMode(topSpot, mode) + "</span></li>";

    if (scenicImgEl) {
      scenicImgEl.dataset.wcDead = "";
      var files = weatherFilesCache[mode] || [];
      var wcList = buildWeatherImageCandidates(item, mode, files);
      scenicImgEl.setAttribute("data-wc-candidates", wcList.join("|"));
      scenicImgEl.setAttribute("data-wc-ix", "0");
      scenicImgEl.src = wcList[0];
      scenicImgEl.classList.remove("is-missing");
      if (scenicImgEl.parentElement) scenicImgEl.parentElement.classList.remove("is-missing");
      scenicImgEl.alt = labelByMode(mode) + "主题配图 · " + item.district;
    }

    var dots = dotsEl.querySelectorAll(".weather-poster__dot");
    dots.forEach(function (dot, dotIndex) {
      var active = dotIndex === index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });

    var lureLine = document.getElementById("weatherLureDistrictLine");
    if (lureLine) {
      lureLine.textContent =
        "「" + item.district + "」山水与人文交织，下一趟小长假的出发地，不妨就从这里写起。";
    }
  }

  function goTo(index) {
    currentIndex = (index + districtSeed.length) % districtSeed.length;
    render(currentIndex);
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      goTo(currentIndex + 1);
    }, 4300);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  districtSeed.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "weather-poster__dot" + (i === 0 ? " is-active" : "");
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", "第 " + (i + 1) + " 个区县");
    dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
    dot.addEventListener("click", function () {
      goTo(i);
      start();
    });
    dotsEl.appendChild(dot);
  });

  prevBtn.addEventListener("click", function () {
    goTo(currentIndex - 1);
    start();
  });

  nextBtn.addEventListener("click", function () {
    goTo(currentIndex + 1);
    start();
  });

  shell.addEventListener("mouseenter", stop);
  shell.addEventListener("mouseleave", start);

  function weatherModeFromCode(code) {
    var rainyCodes = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
    if (rainyCodes.indexOf(code) !== -1) return "rain";
    if (code === 0 || code === 1) return "sunny";
    return "cloudy";
  }

  function parseForecastFromJson(data) {
    var mode = "sunny";
    var tempRange = "--";
    if (!data) return { weatherMode: mode, tempRange: tempRange };
    if (data.current && data.current.weather_code != null) {
      mode = weatherModeFromCode(Number(data.current.weather_code));
    }
    var max = data.daily && data.daily.temperature_2m_max ? data.daily.temperature_2m_max[0] : null;
    var min = data.daily && data.daily.temperature_2m_min ? data.daily.temperature_2m_min[0] : null;
    var minN = Number(min);
    var maxN = Number(max);
    if (Number.isFinite(minN) && Number.isFinite(maxN)) {
      tempRange = Math.round(minN) + "°C - " + Math.round(maxN) + "°C";
    }
    return { weatherMode: mode, tempRange: tempRange };
  }

  function openMeteoForecastUrl(lat, lon) {
    return (
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(lat) +
      "&longitude=" +
      encodeURIComponent(lon) +
      "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai"
    );
  }

  function loadForecastAt(lat, lon) {
    if (typeof fetch === "undefined") return Promise.reject();
    return fetch(openMeteoForecastUrl(lat, lon)).then(function (res) {
      return res.ok ? res.json() : Promise.reject();
    });
  }

  /** 拉取并写入指定区县的预报缓存；若当前正在展示该区县则刷新界面 */
  function fetchForecastForDistrictIndex(index) {
    var item = districtSeed[index];
    if (!item) return Promise.resolve();
    var p = districtCoords[item.district];
    if (!p) return Promise.resolve();
    return loadForecastAt(p.lat, p.lon)
      .then(function (data) {
        districtForecastCache[index] = parseForecastFromJson(data);
        if (index === currentIndex) render(currentIndex);
      })
      .catch(function () {
        if (!districtForecastCache[index]) {
          districtForecastCache[index] = { weatherMode: "sunny", tempRange: "--" };
        }
        if (index === currentIndex) render(currentIndex);
      });
  }

  /** 仅用于把轮播起点切到离用户最近的区县；温度仍以各区县自身坐标为准 */
  function applyLiveWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        var nearest = pickDistrictFromLocation(lat, lon);
        var idx = districtSeed.findIndex(function (d) {
          return d.district === nearest.district;
        });
        var useIdx = idx >= 0 ? idx : 0;
        goTo(useIdx);
        start();
      },
      function () {},
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  }

  prefetchAllWeatherFolders().then(function () {
    attachImageFallbacks();
    districtForecastCache = districtSeed.map(function () {
      return null;
    });
    render(0);
    districtSeed.forEach(function (_, i) {
      fetchForecastForDistrictIndex(i);
    });
    applyLiveWeather();
    start();
  });
})();
