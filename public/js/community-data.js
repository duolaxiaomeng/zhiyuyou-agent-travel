(function (global) {
  "use strict";

  /**
   * 精选帖（稳定 id，可配独立配图 assets/交流中心/）
   * 程序生成帖：每区县 6 条，配图从交流中心素材池散列取（精选去重 + 可选 COMMUNITY_EXTRA_POOL）。
   */
  var FEATURED_POSTS = [
    { id: "seed-01", destination: "合川", type: "风景图片", title: "涞滩古镇清晨光影", content: "早上 8 点前游客少，古街和城门逆光很好拍。", image: "assets/交流中心/涞滩古镇.jpeg", author: "渝中·小林", score: "4.8", likes: 1308, createdAt: "2026-04-01T10:00:00.000Z" },
    { id: "seed-02", destination: "武隆", type: "路线", title: "天生三桥一日路线", content: "游客中心-天龙桥-青龙桥-黑龙桥，全程约 4.5 小时。", image: "assets/交流中心/天生三桥.jpg", author: "南岸·阿杰", score: "4.7", likes: 642, createdAt: "2026-04-02T10:00:00.000Z" },
    { id: "seed-03", destination: "彭水", type: "美食餐厅", title: "阿依河码头旁苗家馆子", content: "酸汤鱼和腊肉炒饭很稳，晚餐建议提前排号。", image: "assets/交流中心/阿依河码头苗家馆子.jpg", author: "江北·米粒", score: "4.6", likes: 326, createdAt: "2026-04-03T10:00:00.000Z" },
    { id: "seed-04", destination: "涪陵", type: "酒店", title: "江景民宿入住体验", content: "靠近白鹤梁，夜景不错，适合两天慢游住一晚。", image: "assets/交流中心/江景民宿.png", author: "巴南·舟舟", score: "4.5", likes: 189, createdAt: "2026-04-04T10:00:00.000Z" },
    { id: "seed-05", destination: "黔江", type: "风景图片", title: "武陵山云海拍摄机位", content: "观景台往东 300 米机位最佳，建议带长焦。", image: "assets/交流中心/武陵山云海.jpg", author: "沙坪坝·清风", score: "4.9", likes: 2104, createdAt: "2026-04-05T10:00:00.000Z" },
    { id: "seed-06", destination: "万州", type: "酒店", title: "高笋塘商圈酒店推荐", content: "出行和吃饭都方便，适合中转住宿。", image: "assets/交流中心/高笋塘商圈酒店.jpg", author: "九龙坡·可可", score: "4.4", likes: 95, createdAt: "2026-04-06T10:00:00.000Z" },
    { id: "seed-07", destination: "合川", type: "美食餐厅", title: "古镇老火锅测评", content: "牛肉和毛肚都新鲜，锅底偏辣，记得点冰粉。", image: "assets/交流中心/古镇老火锅.jpg", author: "渝北·阿芒", score: "4.7", likes: 876, createdAt: "2026-04-07T10:00:00.000Z" },
    { id: "seed-08", destination: "武隆", type: "风景图片", title: "仙女山傍晚草场", content: "傍晚风大但光线柔和，手机也容易拍出层次。", image: "assets/交流中心/仙女山傍晚草场.jpg", author: "大渡口·小悠", score: "4.6", likes: 412, createdAt: "2026-04-08T10:00:00.000Z" },
    { id: "seed-09", destination: "江北", type: "美食餐厅", title: "观音桥夜宵一条街", content: "烧烤与小面并存，建议空胃前往。", image: "assets/交流中心/观音桥夜宵一条街.jpg", author: "南岸·阿满", score: "4.5", likes: 523, createdAt: "2026-04-09T10:00:00.000Z" },
    { id: "seed-10", destination: "渝中", type: "酒店", title: "解放碑步行圈住宿", content: "轻轨与夜景都方便，适合第一次来渝中。", image: "assets/交流中心/解放碑住宿.png", author: "渝中·小鹿", score: "4.6", likes: 678, createdAt: "2026-04-10T10:00:00.000Z" },
    { id: "seed-11", destination: "大足", type: "路线", title: "石刻景区半日走法", content: "先看千手观音再下行可减少爬坡。", image: "assets/交流中心/石刻景区.jpg", author: "永川·石头", score: "4.8", likes: 291, createdAt: "2026-04-11T10:00:00.000Z" },
    { id: "seed-12", destination: "巫山", type: "风景图片", title: "小三峡船游出片点", content: "船尾逆光位人少，注意防风与防晒。", image: "assets/交流中心/小三峡船游.jpg", author: "万州·青禾", score: "4.7", likes: 445, createdAt: "2026-04-12T10:00:00.000Z" },
    { id: "seed-13", destination: "南川", type: "风景图片", title: "金佛山索道上看云", content: "晨间雾气大时等风散再拍。", image: "assets/交流中心/金佛山索道上看云海.jpg", author: "江北·远川", score: "4.6", likes: 356, createdAt: "2026-04-13T10:00:00.000Z" },
    { id: "seed-14", destination: "江津", type: "美食餐厅", title: "江津酸菜鱼老店", content: "鱼片薄厚刚好，配米饭一绝。", image: "assets/交流中心/江津酸菜鱼.png", author: "巴南·老饕", score: "4.5", likes: 712, createdAt: "2026-04-14T10:00:00.000Z" },
    { id: "seed-15", destination: "长寿", type: "酒店", title: "菩提山附近温泉酒店", content: "泡完早休息，适合周末放空。", image: "assets/交流中心/菩提山温泉酒店.jpg", author: "长寿·浅浅", score: "4.4", likes: 203, createdAt: "2026-04-15T10:00:00.000Z" },
    { id: "seed-16", destination: "秀山", type: "风景图片", title: "洪安边城渡口晨雾", content: "清晨薄雾时江面层次最好，注意防滑。", image: "assets/交流中心/小三峡船游.jpg", author: "秀山·阿朵", score: "4.6", likes: 288, createdAt: "2026-04-16T10:00:00.000Z" },
    { id: "seed-17", destination: "梁平", type: "美食餐厅", title: "百里竹海农家腊味", content: "腊排骨与豆花饭搭配，适合全家。", image: "assets/交流中心/古镇老火锅.jpg", author: "梁平·竹音", score: "4.5", likes: 156, createdAt: "2026-04-17T10:00:00.000Z" },
    { id: "seed-18", destination: "垫江", type: "风景图片", title: "牡丹园花期踩点", content: "盛花期周末人多，建议工作日一早入园。", image: "assets/交流中心/仙女山傍晚草场.jpg", author: "垫江·小牡丹", score: "4.4", likes: 412, createdAt: "2026-04-18T10:00:00.000Z" },
    { id: "seed-19", destination: "忠县", type: "路线", title: "石宝寨半日紧凑走法", content: "先登寨楼再沿江步道返回，省体力。", image: "assets/交流中心/石刻景区.jpg", author: "忠县·江声", score: "4.7", likes: 198, createdAt: "2026-04-19T10:00:00.000Z" },
    { id: "seed-20", destination: "开州", type: "酒店", title: "汉丰湖周边住宿笔记", content: "湖景房选高层，早晚散步很舒服。", image: "assets/交流中心/江景民宿.png", author: "开州·湖语", score: "4.3", likes: 121, createdAt: "2026-04-20T10:00:00.000Z" },
    { id: "seed-21", destination: "荣昌", type: "美食餐厅", title: "安陶小镇旁卤鹅老店", content: "卤鹅半只足够三人，配泡菜解腻。", image: "assets/交流中心/江津酸菜鱼.png", author: "荣昌·陶陶", score: "4.6", likes: 534, createdAt: "2026-04-21T10:00:00.000Z" },
    { id: "seed-22", destination: "璧山", type: "风景图片", title: "秀湖公园骑行一圈", content: "租车点在南门，傍晚风凉记得带外套。", image: "assets/交流中心/金佛山索道上看云海.jpg", author: "璧山·青叶", score: "4.5", likes: 267, createdAt: "2026-04-22T10:00:00.000Z" },
    { id: "seed-23", destination: "潼南", type: "风景图片", title: "双江古镇老街光影", content: "下午斜阳打在石板路上很出片。", image: "assets/交流中心/涞滩古镇.jpeg", author: "潼南·双江", score: "4.5", likes: 189, createdAt: "2026-04-23T10:00:00.000Z" },
    { id: "seed-24", destination: "丰都", type: "路线", title: "名山与鬼城联游节奏", content: "上午名山、下午鬼城，中间留午休。", image: "assets/交流中心/天生三桥.jpg", author: "丰都·渡客", score: "4.4", likes: 305, createdAt: "2026-04-24T10:00:00.000Z" },
    { id: "seed-25", destination: "石柱", type: "酒店", title: "黄水森林木屋避暑", content: "七八月旺季提前两周订房更稳。", image: "assets/交流中心/高笋塘商圈酒店.jpg", author: "石柱·林栖", score: "4.5", likes: 441, createdAt: "2026-04-25T10:00:00.000Z" },
  ];

  /** 追加 assets/交流中心/ 下新图路径（字符串），与精选去重后一并进入生成帖配图池 */
  var COMMUNITY_EXTRA_POOL = [];

  /**
   * 其它区县 slug → 配图 URL 列表（按槽位顺序，覆盖全局散列池）。
   * 铜梁区单独用 TONGLIANG_COMMUNITY_CARDS，保证卡片标题/类型与图片文件名主题一致。
   */
  var DISTRICT_IMAGE_OVERRIDES = {};

  /** 铜梁：图片「铜梁·XXX.jpg」与卡片「铜梁 · XXX」一一对应（顺序与文件名后缀一致） */
  var TONGLIANG_COMMUNITY_CARDS = [
    {
      image: "assets/交流中心/铜梁·老城街巷光影.jpg",
      type: "风景图片",
      title: "{dest} · 老城街巷光影",
      content: "35mm 左右更舒展，别怼脸拍居民门口。",
    },
    {
      image: "assets/交流中心/铜梁·溯溪玩水安全提示.jpg",
      type: "路线",
      title: "{dest} · 溯溪玩水安全提示",
      content: "雨天涨水勿下河，防滑鞋与换洗衣物备齐。",
    },
    {
      image: "assets/交流中心/铜梁·雾凇随缘与路况.jpg",
      type: "风景图片",
      title: "{dest} · 雾凇随缘与路况",
      content: "低温结冰慢开，观景台别越护栏。",
    },
    {
      image: "assets/交流中心/铜梁·小面加蛋与青菜.jpg",
      type: "美食餐厅",
      title: "{dest} · 小面加蛋与青菜",
      content: "豌豆杂酱面易坨，上桌先拌开。",
    },
    {
      image: "assets/交流中心/铜梁·行李寄存与退房.jpg",
      type: "酒店",
      title: "{dest} · 行李寄存与退房",
      content: "延迟退房多半收费，寄存行李问清截止时间。",
    },
    {
      image: "assets/交流中心/铜梁·早餐油茶与小面.jpg",
      type: "美食餐厅",
      title: "{dest} · 早餐油茶与小面",
      content: "油茶配馓子趁热拌；小面默认偏辣可喊少辣。",
    },
  ];

  function communityImagePoolForGenerated() {
    var seen = {};
    var out = [];
    var i;
    var u;
    var p;
    for (i = 0; i < FEATURED_POSTS.length; i += 1) {
      p = FEATURED_POSTS[i];
      u = p && p.image ? String(p.image).trim() : "";
      if (u && !seen[u]) {
        seen[u] = 1;
        out.push(u);
      }
    }
    for (i = 0; i < COMMUNITY_EXTRA_POOL.length; i += 1) {
      u = String(COMMUNITY_EXTRA_POOL[i] || "").trim();
      if (u && !seen[u]) {
        seen[u] = 1;
        out.push(u);
      }
    }
    return out.length ? out : ["assets/hero/slide-01.png"];
  }

  /** 与站内 main.js 酒店/路线区县列表一致，用于批量生成交流帖 */
  var CHONGQING_DISTRICTS = [
    { value: "yuzhong", title: "渝中区" },
    { value: "dadukou", title: "大渡口区" },
    { value: "jiangbei", title: "江北区" },
    { value: "shapingba", title: "沙坪坝区" },
    { value: "jiulongpo", title: "九龙坡区" },
    { value: "nanan", title: "南岸区" },
    { value: "beibei", title: "北碚区" },
    { value: "qijiang", title: "綦江区" },
    { value: "dazu", title: "大足区" },
    { value: "yubei", title: "渝北区" },
    { value: "banan", title: "巴南区" },
    { value: "qianjiang", title: "黔江区" },
    { value: "changshou", title: "长寿区" },
    { value: "jiangjin", title: "江津区" },
    { value: "hechuan", title: "合川区" },
    { value: "yongchuan", title: "永川区" },
    { value: "nanchuan", title: "南川区" },
    { value: "bishan", title: "璧山区" },
    { value: "tongliang", title: "铜梁区" },
    { value: "tongnan", title: "潼南区" },
    { value: "rongchang", title: "荣昌区" },
    { value: "kaizhou", title: "开州区" },
    { value: "liangping", title: "梁平区" },
    { value: "wulong", title: "武隆区" },
    { value: "wanzhou", title: "万州区" },
    { value: "fuling", title: "涪陵区" },
    { value: "chengkou", title: "城口县" },
    { value: "fengdu", title: "丰都县" },
    { value: "dianjiang", title: "垫江县" },
    { value: "zhongxian", title: "忠县" },
    { value: "yunyang", title: "云阳县" },
    { value: "fengjie", title: "奉节县" },
    { value: "wushan", title: "巫山县" },
    { value: "wuxi", title: "巫溪县" },
    { value: "shizhu", title: "石柱土家族自治县" },
    { value: "xiushan", title: "秀山土家族苗族自治县" },
    { value: "youyang", title: "酉阳土家族苗族自治县" },
    { value: "pengshui", title: "彭水苗族土家族自治县" },
  ];

  var ADMIN_STRIP_ORDER = [
    "苗族土家族自治县",
    "土家族苗族自治县",
    "土家族自治县",
    "壮族瑶族自治县",
    "苗族自治县",
    "自治县",
    "区",
    "县",
    "市",
  ];

  function stripDistrictTitleToShort(fullTitle) {
    var orig = String(fullTitle || "").trim();
    if (!orig) return "";
    var s = orig;
    var guard = 0;
    while (guard < 10) {
      var cut = false;
      for (var i = 0; i < ADMIN_STRIP_ORDER.length; i += 1) {
        var suf = ADMIN_STRIP_ORDER[i];
        if (s.length >= suf.length && s.slice(-suf.length) === suf) {
          s = s.slice(0, -suf.length);
          cut = true;
          break;
        }
      }
      if (!cut) break;
      guard += 1;
    }
    /* 「忠县」等：去掉「县」后只剩一个字则保留全称，避免变成「忠」 */
    if (s.length < 2 && /县$/.test(orig)) {
      return orig;
    }
    return s || orig;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function hashStr(s) {
    var h = 0;
    var str = String(s || "");
    for (var i = 0; i < str.length; i += 1) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  /** 比赛演示：每区县少量生成帖即可撑满筛选，不必海量配图 */
  var POSTS_PER_DISTRICT = 6;

  /** 大模板池；生成时按区县与槽位散列取模，避免各区县同一套话术 */
  var SLOT_TEMPLATES = [
    { type: "风景图片", title: "{dest} · 江畔步道晨雾", content: "雨后石板略滑，早到易独占机位，长焦压层次更干净。" },
    { type: "风景图片", title: "{dest} · 城郊湿地水鸟季", content: "长焦蹲守别惊扰鸟类，逆光时注意水面反光。" },
    { type: "路线", title: "{dest} · 周末一日游紧凑动线", content: "上午主景、中午小馆、傍晚返程，午休别省。" },
    { type: "美食餐厅", title: "{dest} · 巷子里的小馆怎么选", content: "看本地人占比与翻台节奏，辣度先问再下单。" },
    { type: "酒店", title: "{dest} · 商圈周边住宿备忘", content: "优先近公交或好打车，大行李慎选纯步梯老楼。" },
    { type: "风景图片", title: "{dest} · 日落机位与风向", content: "查日落方位；云层厚时色彩有时更耐看。" },
    { type: "路线", title: "{dest} · 亲子半日轻松走法", content: "台阶多就拆两段走，水壶与小零食随身带。" },
    { type: "美食餐厅", title: "{dest} · 早餐油茶与小面", content: "油茶配馓子趁热拌；小面默认偏辣可喊少辣。" },
    { type: "酒店", title: "{dest} · 江景房值不值", content: "高层视野好风噪也大，睡眠浅可换内侧房。" },
    { type: "风景图片", title: "{dest} · 老城街巷光影", content: "35mm 左右更舒展，别怼脸拍居民门口。" },
    { type: "路线", title: "{dest} · 自驾停车与绕行", content: "节假日核心区车位紧，外围停车再步行接驳。" },
    { type: "美食餐厅", title: "{dest} · 夜宵烧烤怎么挑", content: "看食材新鲜与卫生，冰粉凉虾解辣很实在。" },
    { type: "风景图片", title: "{dest} · 雨后云海与温差", content: "清晨易起雾，保暖防滑别大意。" },
    { type: "路线", title: "{dest} · 摄影半日动线", content: "黄金时段留给主场景，中间段转场休息。" },
    { type: "酒店", title: "{dest} · 民宿入住检查项", content: "空调热水隔音先试；旺季提前沟通入住时段。" },
    { type: "风景图片", title: "{dest} · 城市阳台夜景", content: "三脚架别挡通道，慢门注意行人安全。" },
    { type: "路线", title: "{dest} · 轻轨沿线半日逛", content: "出站即景别贪多，留时间吃饭与返程。" },
    { type: "美食餐厅", title: "{dest} · 豆花饭与烧白", content: "豆花嫩度各家不同，蘸水咸淡先少蘸试味。" },
    { type: "酒店", title: "{dest} · 近医院/车站怎么住", content: "图方便选近点，浅睡眠慎选临街低层。" },
    { type: "风景图片", title: "{dest} · 半山观城台", content: "傍晚蓝调短，提前占点别插队。" },
    { type: "路线", title: "{dest} · 骑行绿道里程参考", content: "头盔必戴，补给点提前看好，雨天改室内。" },
    { type: "美食餐厅", title: "{dest} · 串串香数签技巧", content: "锅底别浪费，干碟油碟按口味减辣。" },
    { type: "酒店", title: "{dest} · 温泉私汤预约记", content: "私汤时段固定，迟到可能缩水，提前电话确认。" },
    { type: "风景图片", title: "{dest} · 竹海吸氧散步", content: "台阶湿滑穿抓地鞋，蚊虫季带喷雾。" },
    { type: "路线", title: "{dest} · 古镇邮戳与盖章线", content: "邮局与文创店营业时间不一，别卡关门点。" },
    { type: "美食餐厅", title: "{dest} · 烤鱼店活鱼现挑", content: "斤两算清再下锅，配菜别一次加太满。" },
    { type: "酒店", title: "{dest} · 亲子房加床政策", content: "加床尺寸与护栏问前台，婴儿床数量有限。" },
    { type: "风景图片", title: "{dest} · 江滩湿地候鸟", content: "长焦静音快门，勿投喂勿下滩惊扰。" },
    { type: "路线", title: "{dest} · 博物馆半日预约", content: "热门展常限流，身份证与预约码提前备好。" },
    { type: "美食餐厅", title: "{dest} · 蹄花汤暖胃笔记", content: "蘸水偏咸先少蘸，配泡菜解腻刚好。" },
    { type: "酒店", title: "{dest} · 行李寄存与退房", content: "延迟退房多半收费，寄存行李问清截止时间。" },
    { type: "风景图片", title: "{dest} · 索道排队与雾散", content: "雾大等风散再上，山顶温差带薄羽绒。" },
    { type: "路线", title: "{dest} · 溯溪玩水安全提示", content: "雨天涨水勿下河，防滑鞋与换洗衣物备齐。" },
    { type: "美食餐厅", title: "{dest} · 凉糕冰粉对比", content: "红糖浓度差很大，怕甜先喊少糖。" },
    { type: "酒店", title: "{dest} · 露营区接驳住宿", content: "营地到民宿车程问清，夜间山路慎开。" },
    { type: "风景图片", title: "{dest} · 茶园采茶体验季", content: "体验时段短，防晒帽与手指护具别省。" },
    { type: "路线", title: "{dest} · 漂流开漂与闭漂", content: "身高体重限制先看清，防水袋别省。" },
    { type: "美食餐厅", title: "{dest} · 江湖菜份量预警", content: "两人别点三硬菜，打包盒问清是否收费。" },
    { type: "酒店", title: "{dest} · 玻璃栈道周边住哪", content: "恐高慎选悬崖侧房型，心理建设比风景重要。" },
    { type: "风景图片", title: "{dest} · 早市烟火与光线", content: "摊主忙碌别挡道，短焦更抓氛围。" },
    { type: "路线", title: "{dest} · 图书馆讲座日", content: "活动公众号提前看，座位先到先得。" },
    { type: "美食餐厅", title: "{dest} · 抄手皮薄馅稳", content: "清汤红汤先试一口，花椒麻度各地不同。" },
    { type: "酒店", title: "{dest} · 老楼步梯行李方案", content: "三楼以上无电梯问能否协助，价先谈清。" },
    { type: "风景图片", title: "{dest} · 荷花池与长焦", content: "正午顶光硬，清晨侧光更柔和。" },
    { type: "路线", title: "{dest} · 红叶季错峰", content: "周末堵车上山早，工作日体验好很多。" },
    { type: "美食餐厅", title: "{dest} · 土菜馆腊肉与泡菜", content: "腊肉偏咸配米饭，泡菜解腻别空口吃太多。" },
    { type: "酒店", title: "{dest} · 星空拍摄月相提醒", content: "大月亮夜银河弱，农历初前后更出片。" },
    { type: "风景图片", title: "{dest} · 码头轮渡时刻备忘", content: "末班别踩点，江风大带外套。" },
    { type: "路线", title: "{dest} · 文创园与老厂区", content: "拍照别进施工区，咖啡小店消费再久坐。" },
    { type: "美食餐厅", title: "{dest} · 火锅微辣入门", content: "香油蒜泥降辣，毛肚七上八下别老了。" },
    { type: "酒店", title: "{dest} · 隔音耳塞必备场景", content: "临街低层、电梯旁房，前台要耳塞往往有。" },
    { type: "风景图片", title: "{dest} · 公园划船价目参考", content: "押金与超时费问清，救生衣必穿。" },
    { type: "路线", title: "{dest} · 放风筝草坪风向", content: "线别缠人，儿童风筝选软杆更安全。" },
    { type: "美食餐厅", title: "{dest} · 小面加蛋与青菜", content: "豌豆杂酱面易坨，上桌先拌开。" },
    { type: "酒店", title: "{dest} · 空调噪音实测", content: "入住先听外机位，不行尽早换房。" },
    { type: "风景图片", title: "{dest} · 雾凇随缘与路况", content: "低温结冰慢开，观景台别越护栏。" },
    { type: "路线", title: "{dest} · 登山杖与护膝", content: "下坡费膝，杖尖橡胶套别丢。" },
    { type: "美食餐厅", title: "{dest} · 烧烤素菜与卫生", content: "菌类烤透再吃，冰饮别过猛。" },
    { type: "酒店", title: "{dest} · 旺季加价规则", content: "平台与电话价可能不同，下单前对比。" },
    { type: "风景图片", title: "{dest} · 樱花银杏预判", content: "每年气候差大，关注本地花讯再订票。" },
    { type: "路线", title: "{dest} · 亲子动物园动线", content: "推车坡道问清，动物投喂区规则遵守。" },
    { type: "美食餐厅", title: "{dest} · 冰汤圆与醪糟", content: "醪糟开车别碰，甜度可先试。" },
    { type: "酒店", title: "{dest} · 洗衣烘干是否免费", content: "长住问洗衣房位置与开放时间。" },
    { type: "风景图片", title: "{dest} · 城市天际线蓝调", content: "蓝调窗口短，参数提前练好。" },
    { type: "路线", title: "{dest} · 手写地图问路礼貌", content: "老店指路多问几句，别只信一条短视频。" },
    { type: "美食餐厅", title: "{dest} · 酸菜鱼鱼片厚度", content: "太薄易碎太厚不入味，中厚度最稳。" },
    { type: "酒店", title: "{dest} · 电梯高峰与早餐", content: "早餐厅高峰错开半小时，体验差很多。" },
  ];

  function fillTpl(tpl, dest) {
    return String(tpl || "").replace(/\{dest\}/g, dest);
  }

  function buildGeneratedDistrictPosts() {
    var out = [];
    var imgPool = communityImagePoolForGenerated();
    var imgPoolLen = imgPool.length;
    var di;
    var slot;
    var dest;
    var slug;
    var id;
    var h;
    var likes;
    var scoreN;
    var day;
    var author;
    var imgIx;

    for (di = 0; di < CHONGQING_DISTRICTS.length; di += 1) {
      dest = stripDistrictTitleToShort(CHONGQING_DISTRICTS[di].title);
      slug = CHONGQING_DISTRICTS[di].value;
      for (slot = 0; slot < POSTS_PER_DISTRICT; slot += 1) {
        id = "gen-" + slug + "-" + pad2(slot + 1);
        var poolLen = SLOT_TEMPLATES.length;
        var ti = (di * 17 + slot * 23 + hashStr(slug)) % poolLen;
        if (ti < 0) ti += poolLen;
        var T;
        var imgUrl;
        if (slug === "tongliang" && TONGLIANG_COMMUNITY_CARDS[slot]) {
          T = TONGLIANG_COMMUNITY_CARDS[slot];
          imgUrl = T.image;
        } else {
          T = SLOT_TEMPLATES[ti];
          imgIx = (hashStr(id) + slot * 31 + di * 7) % imgPoolLen;
          if (imgIx < 0) imgIx += imgPoolLen;
          var ov = DISTRICT_IMAGE_OVERRIDES[slug];
          imgUrl =
            ov && ov.length ? ov[slot % ov.length] : imgPool[imgIx];
        }
        h = hashStr(id);
        likes = 40 + (h % 920);
        scoreN = 4.2 + ((h + slot) % 8) * 0.1;
        day = 1 + ((di * POSTS_PER_DISTRICT + slot) % 28);
        author = dest + "·旅友" + String((h % 8) + 1);
        out.push({
          id: id,
          destination: dest,
          type: T.type,
          title: fillTpl(T.title, dest),
          content: fillTpl(T.content, dest),
          image: imgUrl,
          author: author,
          score: scoreN.toFixed(1),
          likes: likes,
          createdAt: "2026-05-" + pad2(day) + "T" + pad2((h % 12) + 8) + ":" + pad2(h % 60) + ":00.000Z",
        });
      }
    }
    return out;
  }

  var GENERATED_DISTRICT_POSTS = buildGeneratedDistrictPosts();

  /** 对外统一列表：用户帖 + 精选 + 各区县模板帖（详情/列表均用此合并结果） */
  var SEED_POSTS = FEATURED_POSTS.concat(GENERATED_DISTRICT_POSTS);

  var STORAGE_KEY = "zyyCommunityPosts";

  /** 用户发帖来自服务端 /api/community/user-posts，由 ZYYUserData.refreshCommunityPosts 填充 */
  var userPostsCache = [];

  function setUserPostsCache(arr) {
    userPostsCache = Array.isArray(arr) ? arr.map(normalizeUserPost) : [];
  }

  function readUserPosts() {
    return userPostsCache.slice();
  }

  function normalizeUserPost(p) {
    var o = Object.assign({}, p);
    if (typeof o.likes !== "number" || isNaN(o.likes)) {
      o.likes = 0;
    }
    return o;
  }

  function getAllPosts() {
    return readUserPosts().map(normalizeUserPost).concat(SEED_POSTS);
  }

  function parseLikes(p) {
    var n = Number(p && p.likes);
    return isNaN(n) ? 0 : n;
  }

  /**
   * 与 community.js 中 padFeedList 逻辑一致，用于从 fk 恢复补位卡片数据
   */
  function reconstructPadPost(fk) {
    var m = /^pad-(\d+)-(\d+)$/.exec(String(fk || ""));
    if (!m) return null;
    var i = parseInt(m[2], 10);
    var pool = SEED_POSTS;
    if (!pool.length) return null;
    var pb = pool[i % pool.length];
    var c = Object.assign({}, pb);
    c.fillKey = fk;
    c.title = (pb.title || "分享") + " ·" + (Math.floor(i / pool.length) + 1);
    c.likes = Math.max(12, parseLikes(pb) - (i % 9));
    delete c.id;
    c.userPost = false;
    return c;
  }

  function normQuery(s) {
    if (s == null || s === "") return "";
    var t = String(s).trim().replace(/\u00a0/g, " ");
    try {
      t = decodeURIComponent(t);
    } catch (e) {}
    return t.trim();
  }

  function findPostForDetail(id, fk) {
    fk = normQuery(fk);
    id = normQuery(id);
    if (fk) {
      var byPad = reconstructPadPost(fk);
      if (byPad) return byPad;
    }
    if (id) {
      var userList = readUserPosts().map(normalizeUserPost);
      var mu = userList.find(function (p) {
        return p && p.id === id;
      });
      if (mu) return mu;
      var ms = SEED_POSTS.find(function (p) {
        return p && p.id === id;
      });
      if (ms) return Object.assign({}, ms);
    }
    return null;
  }

  var STORAGE_LIKED_KEYS = "zyyCommunityLikedKeys";
  var STORAGE_STAR_KEYS = "zyyCommunityStarredKeys";

  function readKeyArr(storageKey) {
    try {
      var a = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function writeKeyArr(storageKey, arr) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(arr));
    } catch (e) {}
  }

  function getLikedKeys() {
    return readKeyArr(STORAGE_LIKED_KEYS);
  }

  function getStarredKeys() {
    return readKeyArr(STORAGE_STAR_KEYS);
  }

  function setLikedKey(postKey, on) {
    if (!postKey) return;
    var list = readKeyArr(STORAGE_LIKED_KEYS);
    var i = list.indexOf(postKey);
    if (on && i === -1) list.unshift(postKey);
    if (!on && i !== -1) list.splice(i, 1);
    writeKeyArr(STORAGE_LIKED_KEYS, list);
  }

  function setStarredKey(postKey, on) {
    if (!postKey) return;
    var list = readKeyArr(STORAGE_STAR_KEYS);
    var i = list.indexOf(postKey);
    if (on && i === -1) list.unshift(postKey);
    if (!on && i !== -1) list.splice(i, 1);
    writeKeyArr(STORAGE_STAR_KEYS, list);
  }

  function resolvePostFromKey(key) {
    if (!key) return null;
    var k = String(key);
    if (/^pad-\d+-\d+$/.test(k)) return reconstructPadPost(k);
    var userList = readUserPosts().map(normalizeUserPost);
    var mu = userList.find(function (p) {
      return p && p.id === k;
    });
    if (mu) return mu;
    var ms = SEED_POSTS.find(function (p) {
      return p && p.id === k;
    });
    return ms ? Object.assign({}, ms) : null;
  }

  function postStorageKey(post) {
    if (post && post.fillKey) return post.fillKey;
    if (post && post.id) return post.id;
    return "";
  }

  global.ZYYCommunityData = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_POSTS: SEED_POSTS,
    FEATURED_POSTS: FEATURED_POSTS,
    GENERATED_DISTRICT_POSTS: GENERATED_DISTRICT_POSTS,
    setUserPostsCache: setUserPostsCache,
    readUserPosts: readUserPosts,
    normalizeUserPost: normalizeUserPost,
    getAllPosts: getAllPosts,
    reconstructPadPost: reconstructPadPost,
    findPostForDetail: findPostForDetail,
    postStorageKey: postStorageKey,
    parseLikes: parseLikes,
    getLikedKeys: getLikedKeys,
    getStarredKeys: getStarredKeys,
    setLikedKey: setLikedKey,
    setStarredKey: setStarredKey,
    resolvePostFromKey: resolvePostFromKey,
  };
})(window);
