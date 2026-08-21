"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var mysql = require("mysql2/promise");
var dotenv = require("dotenv");

var root = path.join(__dirname, "..");
var envLocal = path.join(root, ".env.local");
var envFile = path.join(root, ".env");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

var DB_HOST = process.env.DB_HOST || "127.0.0.1";
var DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
var DB_USER = process.env.DB_USER || "";
var DB_PASSWORD = process.env.DB_PASSWORD || "";
var DB_NAME = process.env.DB_NAME || "travel";

var EMBEDDING_MODEL = "local-hash-cjk-v1";
var EMBEDDING_DIM = 128;

var TOURISM_CHUNKS = [
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/",
    district: "重庆市",
    scenicName: "重庆国家AAAAA级景区总览",
    level: "5A",
    title: "重庆国家5A级景区名单",
    tags: ["重庆", "5A", "景区总览", "路线规划"],
    content:
      "重庆市人民政府网“国家AAAAA级景区”栏目列出重庆核心5A级旅游资源，包括大足石刻、巫山小三峡—小小三峡、武隆喀斯特旅游区、酉阳桃花源、万盛黑山谷、南川金佛山、江津四面山、云阳龙缸、彭水阿依河、黔江濯水、奉节白帝城·瞿塘峡、涪陵武陵山大裂谷等。用于AI路线规划时，可作为跨区县主题线路的基础候选池。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744569.html",
    district: "大足区",
    scenicName: "大足石刻景区",
    level: "5A",
    title: "大足石刻：世界文化遗产与石窟艺术",
    tags: ["大足", "石刻", "世界文化遗产", "人文", "亲子研学"],
    content:
      "大足石刻是重庆大足区境内石刻造像的总称，是重庆具有国际影响力的文化旅游品牌。景区以宝顶山、北山等石刻为核心，呈现公元9至13世纪中国石窟艺术和民间宗教信仰的发展变化，适合人文历史、艺术审美、亲子研学和慢节奏半日到一日游。路线规划中应预留讲解时间，避免只做打卡式停留。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744559.html",
    district: "巫山县",
    scenicName: "巫山小三峡—小小三峡",
    level: "5A",
    title: "巫山小三峡：船游峡谷与巴人遗迹",
    tags: ["巫山", "小三峡", "船游", "峡谷", "自然", "人文"],
    content:
      "巫山小三峡由大宁河下游的龙门峡、巴雾峡、滴翠峡组成，全长约50公里；小小三峡为大宁河支流马渡河下游峡谷。游小三峡以坐船观景为主，常见峡谷、飞瀑、悬岩古洞、巴人悬棺和古寨等自然与历史景观。AI安排行程时应考虑船游耗时，适合三峡线、摄影线、自然峡谷线。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744551.html",
    district: "武隆区",
    scenicName: "武隆喀斯特旅游区",
    level: "5A",
    title: "武隆喀斯特：天生三桥、仙女山、芙蓉洞",
    tags: ["武隆", "天生三桥", "仙女山", "芙蓉洞", "喀斯特", "避暑"],
    content:
      "武隆喀斯特旅游区包含天生三桥、仙女山、芙蓉洞等核心资源。仙女山位于武陵山脉，海拔较高，拥有森林和天然草原，夏季清凉，适合避暑、亲子、摄影；芙蓉洞为大型石灰岩洞穴，洞内景观丰富；天生三桥突出喀斯特天坑、天桥和峡谷景观。规划路线时建议按地理距离组合，避免一天内过多往返。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市武隆区人民政府",
    sourceUrl: "https://cqwl.gov.cn/bmjz_sites/bm/wlw/zwxx_98939/jqjd/jdjd_1/202109/t20210909_9677832.html",
    district: "武隆区",
    scenicName: "武隆全域旅游景点",
    level: "5A/度假区",
    title: "武隆全域旅游资源组合",
    tags: ["武隆", "全域旅游", "仙女山", "白马山", "懒坝", "归原小镇"],
    content:
      "武隆区旅游资源富集，除仙女山国家森林公园、天生三桥、龙水峡地缝、芙蓉洞、芙蓉江外，还包括白马山天尺情缘、懒坝国际艺术度假区、归原小镇等。做AI路线时，可把武隆拆成自然奇观、草原避暑、艺术度假、亲子休闲几类，按游客偏好选择而不是简单堆景点。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744543.html",
    district: "酉阳土家族苗族自治县",
    scenicName: "酉阳桃花源景区",
    level: "5A",
    title: "酉阳桃花源：田园、溶洞与土家苗族文化",
    tags: ["酉阳", "桃花源", "土家族", "苗族", "民俗", "田园"],
    content:
      "酉阳桃花源位于武陵山区腹地，集岩溶地质奇观、秦晋农耕文化、土家民俗文化和自然生态于一体。景区由古桃源、太古洞、酉州古城、桃花源森林公园、桃源广场、风情小镇等组成。适合民俗文化、慢游、摄影和避开主城人流的乡村休闲线路。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744528.html",
    district: "万盛经开区",
    scenicName: "万盛黑山谷景区",
    level: "5A",
    title: "黑山谷：峡谷、瀑布与森林氧吧",
    tags: ["万盛", "黑山谷", "峡谷", "瀑布", "森林", "养生"],
    content:
      "黑山谷位于万盛经开区黑山镇，景区全长约13公里，以峡谷、瀑布、浮桥、渝黔大裂谷和森林生态著称。景区森林覆盖率高，空气清洁，适合夏季避暑、轻徒步、亲近自然和养生休闲。AI规划时应提醒穿舒适鞋，雨季关注栈道和峡谷游览安全。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744521.html",
    district: "南川区",
    scenicName: "南川金佛山景区",
    level: "5A",
    title: "金佛山：喀斯特桌山、避暑与冰雪",
    tags: ["南川", "金佛山", "喀斯特", "避暑", "赏雪", "杜鹃"],
    content:
      "金佛山是世界自然遗产、国家5A级旅游景区，具有喀斯特桌山地貌，最高峰海拔2238米。春季可赏高山杜鹃，夏季适合清凉避暑，秋季可看层林和方竹笋美食，冬季适合赏雪、雾凇、冰瀑和滑雪。AI路线可按季节生成不同主题，不宜用同一套模板全年套用。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744513.html",
    district: "江津区",
    scenicName: "江津四面山景区",
    level: "5A",
    title: "四面山：瀑布、丹霞赤壁与爱情文化",
    tags: ["江津", "四面山", "瀑布", "丹霞", "自驾", "避暑"],
    content:
      "四面山位于江津区南部，距重庆主城区约1.5小时车程。景区包括望乡台、土地岩、龙潭湖、洪海、珍珠湖等核心景点，以奇山、异水、红石、厚文为特色，森林覆盖率高，拥有高山瀑布群和丹霞地貌。适合自驾、避暑、摄影和两日休闲度假。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744487.html",
    district: "云阳县",
    scenicName: "云阳龙缸景区",
    level: "5A",
    title: "云阳龙缸：天坑、云端廊桥与绝壁栈道",
    tags: ["云阳", "龙缸", "天坑", "玻璃廊桥", "栈道", "刺激体验"],
    content:
      "云阳龙缸景区位于云阳县东南清水土家族乡境内，核心看点包括龙缸天坑、云端廊桥、绝壁栈道、大安洞、岐山草原、石笋河和清水湖。龙缸天坑深度大，云端廊桥悬挑于高海拔悬崖，适合喜欢喀斯特奇观、摄影和刺激体验的游客。老人、儿童和恐高游客应降低强度。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744472.html",
    district: "彭水苗族土家族自治县",
    scenicName: "彭水阿依河景区",
    level: "5A",
    title: "阿依河：峡谷观光、竹筏与漂流体验",
    tags: ["彭水", "阿依河", "漂流", "竹筏", "苗族", "水上运动"],
    content:
      "阿依河景区位于彭水苗族土家族自治县，融山、水、林、泉、峡于一体，包含峡谷观光、步游、竹筏、漂流、户外体验和民族风情休闲度假等项目。适合夏季水上运动、民俗体验和年轻游客结伴出行。AI规划时应根据季节、天气和游客体力决定是否安排漂流。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744449.html",
    district: "黔江区",
    scenicName: "黔江濯水景区",
    level: "5A",
    title: "濯水景区：古镇、蒲花暗河与风雨廊桥",
    tags: ["黔江", "濯水古镇", "蒲花暗河", "风雨廊桥", "民族文化"],
    content:
      "濯水景区位于黔江区濯水镇，由濯水古镇、蒲花河休闲农业体验园和蒲花暗河三部分组成。濯水古镇保留较完整街巷格局，蒲花暗河有自然奇观，阿蓬江上有全长658米的风雨廊桥。适合古镇慢游、民族文化、夜景和渝东南线路串联。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202312/t20231226_12744583.html",
    district: "奉节县",
    scenicName: "白帝城·瞿塘峡景区",
    level: "5A",
    title: "白帝城·瞿塘峡：诗城、夔门与三峡入口",
    tags: ["奉节", "白帝城", "瞿塘峡", "夔门", "三峡", "诗词文化"],
    content:
      "白帝城·瞿塘峡景区位于奉节县瞿塘峡口长江北岸，主要由白帝城、瞿塘峡两大景区组成，是饱览长江三峡壮丽之美的起点。白帝城有深厚诗词文化和三国历史，瞿塘峡以雄、奇、险、峻著称，夔门是第五套10元人民币背景图案。适合三峡文化线、摄影线和历史人文线。"
  },
  {
    sourceType: "official_government",
    sourceName: "重庆市人民政府网",
    sourceUrl: "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqaaaaajjq/202506/t20250612_14707684.html",
    district: "涪陵区",
    scenicName: "武陵山大裂谷",
    level: "5A",
    title: "武陵山大裂谷：地缝、索道与森林峡谷",
    tags: ["涪陵", "武陵山大裂谷", "地缝", "索道", "峡谷", "摄影"],
    content:
      "武陵山大裂谷位于涪陵区武陵山乡，距涪陵城东南约45公里。景区以山峰、台地、沟谷和地缝景观为特色，谷底至山巅落差高，峡谷悬崖、地缝奇观和索道游览适合摄影、轻探险和自然研学。规划时应注意山地景区步行量，给老人儿童预留缓冲。"
  }
];

function tokenize(text) {
  var clean = String(text || "").toLowerCase().replace(/\s+/g, "");
  var tokens = [];
  for (var i = 0; i < clean.length; i++) {
    var ch = clean.charAt(i);
    if (/[\u4e00-\u9fff]/.test(ch)) tokens.push(ch);
    if (i + 1 < clean.length) {
      var bi = clean.slice(i, i + 2);
      if (/[\u4e00-\u9fff]/.test(bi.charAt(0)) && /[\u4e00-\u9fff]/.test(bi.charAt(1))) tokens.push(bi);
    }
  }
  String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .forEach(function (x) {
      if (x) tokens.push(x);
    });
  return tokens;
}

function hashToken(token) {
  var h = crypto.createHash("sha1").update(token).digest();
  return {
    index: h.readUInt32BE(0) % EMBEDDING_DIM,
    sign: h[4] % 2 === 0 ? 1 : -1
  };
}

function embed(text) {
  var vector = new Array(EMBEDDING_DIM).fill(0);
  tokenize(text).forEach(function (token) {
    var h = hashToken(token);
    vector[h.index] += h.sign;
  });
  var norm = Math.sqrt(
    vector.reduce(function (sum, n) {
      return sum + n * n;
    }, 0)
  );
  if (!norm) return vector;
  return vector.map(function (n) {
    return Number((n / norm).toFixed(6));
  });
}

function chunkKey(item) {
  return crypto
    .createHash("sha1")
    .update([item.sourceUrl, item.district, item.scenicName, item.title].join("|"))
    .digest("hex");
}

async function ensureTable(pool) {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS rag_tourism_chunks (" +
      "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
      "chunk_key CHAR(40) NOT NULL," +
      "source_type VARCHAR(64) NOT NULL," +
      "source_name VARCHAR(255) NOT NULL," +
      "source_url VARCHAR(1024) NOT NULL," +
      "district VARCHAR(120) NOT NULL," +
      "scenic_name VARCHAR(180) NOT NULL," +
      "level VARCHAR(32) NOT NULL DEFAULT ''," +
      "title VARCHAR(255) NOT NULL," +
      "content MEDIUMTEXT NOT NULL," +
      "tags_json TEXT NOT NULL," +
      "embedding_model VARCHAR(80) NOT NULL," +
      "embedding_dim INT UNSIGNED NOT NULL," +
      "embedding_json MEDIUMTEXT NOT NULL," +
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY uk_rag_tourism_chunk_key (chunk_key)," +
      "KEY idx_rag_tourism_district (district)," +
      "KEY idx_rag_tourism_scenic (scenic_name)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

async function main() {
  if (!DB_USER) throw new Error("Missing DB_USER in .env.local or .env");
  var pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 4
  });

  await ensureTable(pool);

  var sql =
    "INSERT INTO rag_tourism_chunks " +
    "(chunk_key, source_type, source_name, source_url, district, scenic_name, level, title, content, tags_json, embedding_model, embedding_dim, embedding_json) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE " +
    "source_type=VALUES(source_type), source_name=VALUES(source_name), source_url=VALUES(source_url), district=VALUES(district), " +
    "scenic_name=VALUES(scenic_name), level=VALUES(level), title=VALUES(title), content=VALUES(content), tags_json=VALUES(tags_json), " +
    "embedding_model=VALUES(embedding_model), embedding_dim=VALUES(embedding_dim), embedding_json=VALUES(embedding_json)";

  for (var i = 0; i < TOURISM_CHUNKS.length; i++) {
    var item = TOURISM_CHUNKS[i];
    var vectorText = [item.district, item.scenicName, item.level, item.title, item.tags.join(" "), item.content].join("\n");
    await pool.execute(sql, [
      chunkKey(item),
      item.sourceType,
      item.sourceName,
      item.sourceUrl,
      item.district,
      item.scenicName,
      item.level || "",
      item.title,
      item.content,
      JSON.stringify(item.tags),
      EMBEDDING_MODEL,
      EMBEDDING_DIM,
      JSON.stringify(embed(vectorText))
    ]);
  }

  var countResult = await pool.execute("SELECT COUNT(*) AS count FROM rag_tourism_chunks");
  var sampleResult = await pool.execute(
    "SELECT district, scenic_name AS scenicName, title FROM rag_tourism_chunks ORDER BY id DESC LIMIT 5"
  );
  await pool.end();

  console.log(
    JSON.stringify(
      {
        ok: true,
        insertedOrUpdated: TOURISM_CHUNKS.length,
        totalRows: countResult[0][0].count,
        sample: sampleResult[0]
      },
      null,
      2
    )
  );
}

main().catch(function (e) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: e.code || "",
        message: e.message || String(e)
      },
      null,
      2
    )
  );
  process.exit(1);
});
