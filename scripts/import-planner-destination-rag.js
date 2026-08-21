"use strict";

var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var mysql = require("mysql2/promise");
var dotenv = require("dotenv");

var root = path.join(__dirname, "..");
var envLocal = path.join(root, ".env.local");
var envFile = path.join(root, ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
else if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

var DB_HOST = process.env.DB_HOST || "127.0.0.1";
var DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
var DB_USER = process.env.DB_USER || "";
var DB_PASSWORD = process.env.DB_PASSWORD || "";
var DB_NAME = process.env.DB_NAME || "travel";

var EMBEDDING_MODEL = "local-hash-cjk-v1";
var EMBEDDING_DIM = 128;
var OFFICIAL_A_LIST_URL = "https://www.cq.gov.cn/zjcq/cycq/zmjd/zqajjq/";

var DESTINATIONS = [
  ["yuzhong", "渝中区", "洪崖洞民俗风貌区、解放碑步行街、朝天门来福士、十八梯传统风貌区、山城步道、湖广会馆、重庆中国三峡博物馆。适合城市首站、夜景摄影、轻量步行和巴渝历史文化体验。"],
  ["dadukou", "大渡口区", "重庆工业文化博览园、重庆工业博物馆、义渡古镇、金鳌山、建桥工业文化片区。适合工业遗产、亲子研学、城市更新和半日慢游。"],
  ["jiangbei", "江北区", "观音桥商圈、江北嘴、鸿恩寺森林公园、铁山坪森林公园、重庆科技馆。适合夜景、商圈美食、亲子科普和城市森林休闲。"],
  ["shapingba", "沙坪坝区", "磁器口古镇、歌乐山烈士陵园、白公馆、渣滓洞、重庆融创文旅城、三峡广场。适合红色文化、古镇小吃、亲子游乐和大学城周边休闲。"],
  ["jiulongpo", "九龙坡区", "重庆动物园、华岩旅游风景区、黄桷坪涂鸦艺术街、重庆建川博物馆聚落、九龙外滩。适合亲子动物科普、城市艺术、人文摄影和短途休闲。"],
  ["nanan", "南岸区", "南山一棵树、南滨路、弹子石老街、长嘉汇、重庆抗战遗址博物馆、加勒比海水世界。适合夜景、江岸步行、抗战文化和家庭休闲。"],
  ["beibei", "北碚区", "缙云山、北温泉、金刀峡、重庆自然博物馆、偏岩古镇。适合山地徒步、温泉、峡谷、自然科普和周末两日游。"],
  ["qijiang", "綦江区", "古剑山、东溪古镇、老瀛山、横山旅游度假区、綦江博物馆。适合避暑、古镇、人文地质、亲子研学和自驾周末游。"],
  ["dazu", "大足区", "大足石刻、宝顶山、北山石刻、龙水湖、香国公园。适合世界文化遗产、人文讲解、石窟艺术、亲子研学和一日到两日游。"],
  ["yubei", "渝北区", "重庆园博园、统景温泉、龙兴古镇、重庆中央公园、印盒李花生态旅游区。适合亲子公园、温泉、古镇、春季赏花和近郊休闲。"],
  ["banan", "巴南区", "丰盛古镇、南温泉、云篆山、天坪山、重庆汉海海洋公园。适合温泉、古镇、亲子海洋馆、近郊爬山和春季赏花。"],
  ["qianjiang", "黔江区", "濯水古镇、蒲花暗河、阿蓬江、风雨廊桥、小南海。适合渝东南民族文化、古镇夜景、暗河奇观和自驾串联游。"],
  ["changshou", "长寿区", "长寿湖、菩提古镇、菩提山、长寿慢城。适合湖泊度假、康养休闲、家庭轻旅行和低强度两日游。"],
  ["jiangjin", "江津区", "四面山、中山古镇、爱情天梯、聂荣臻元帅陈列馆、白沙古镇。适合瀑布森林、古镇、红色文化、自驾避暑和两日游。"],
  ["hechuan", "合川区", "钓鱼城、涞滩古镇、文峰古街、双龙湖。适合宋蒙战争历史、人文研学、古镇慢游和嘉陵江沿线休闲。"],
  ["yongchuan", "永川区", "乐和乐都、茶山竹海、松溉古镇、石笋山。适合亲子动物游乐、茶竹生态、古镇和周末度假。"],
  ["nanchuan", "南川区", "金佛山、神龙峡、山王坪、黎香湖。适合喀斯特山地、春季杜鹃、夏季避暑、秋季彩林、冬季赏雪和滑雪。"],
  ["bishan", "璧山区", "秀湖公园、枫香湖儿童公园、古道湾公园、璧山文庙、观音塘湿地。适合亲子公园、城市绿道、轻松散步和半日休闲。"],
  ["tongliang", "铜梁区", "安居古城、奇彩梦园、玄天湖、铜梁龙景区、黄桷门奇彩梦园。适合古城慢游、龙舞非遗、花海、湖畔休闲和亲子摄影。"],
  ["tongnan", "潼南区", "大佛寺、双江古镇、陈抟故里、崇龛油菜花、杨闇公故里。适合石刻古寺、古镇、春季花海、红色文化和自驾一日游。"],
  ["rongchang", "荣昌区", "万灵古镇、安陶小镇、夏布小镇、荣昌陶博物馆。适合非遗陶艺、夏布文化、古镇水乡、亲子手作和慢旅行。"],
  ["kaizhou", "开州区", "汉丰湖、刘伯承同志纪念馆、开州举子园、雪宝山、盛山植物园。适合湖城休闲、红色研学、人文科举文化和自然生态。"],
  ["liangping", "梁平区", "双桂堂、百里竹海、滑石古寨、双桂湖国家湿地公园、梁平柚海。适合佛教文化、竹海避暑、湿地观鸟、乡村休闲和亲子研学。"],
  ["wulong", "武隆区", "天生三桥、仙女山、芙蓉洞、龙水峡地缝、白马山。适合世界自然遗产、喀斯特地貌、草原避暑、洞穴奇观和两日以上深度游。"],
  ["wanzhou", "万州区", "万州大瀑布、三峡平湖、天生城、潭獐峡、凤凰花果山。适合瀑布、三峡库区江景、城市夜景和渝东北线路中转。"],
  ["fuling", "涪陵区", "武陵山大裂谷、816工程景区、白鹤梁水下博物馆、美心红酒小镇、大木花谷。适合地缝峡谷、国防工业遗址、长江水文文化和亲子游。"],
  ["chengkou", "城口县", "大巴山国家级自然保护区、亢谷景区、黄安坝、岚天乡。适合高山草场、森林避暑、秦巴生态、徒步和自驾慢游。"],
  ["fengdu", "丰都县", "丰都名山、南天湖、九重天、雪玉洞、双桂山。适合民俗传说、湖泊避暑、洞穴地貌、高空体验和两日游。"],
  ["dianjiang", "垫江县", "恺之峰牡丹园、牡丹樱花世界、三合湖湿地公园、乐天花谷。适合春季赏花、湿地休闲、亲子摄影和周边一日游。"],
  ["zhongxian", "忠县", "石宝寨、三峡橘乡、白公祠、烽烟三国实景演艺、皇华城考古遗址。适合长江人文、三峡库区、柑橘田园、夜间演艺和历史文化。"],
  ["yunyang", "云阳县", "云阳龙缸、云端廊桥、张飞庙、三峡梯城、岐山草原。适合天坑绝壁、玻璃廊桥、三国文化、山地摄影和两日游。"],
  ["fengjie", "奉节县", "白帝城·瞿塘峡、三峡之巅、夔州博物馆、天坑地缝、龙桥河。适合诗词文化、夔门摄影、三峡地貌和渝东北深度线。"],
  ["wushan", "巫山县", "巫山小三峡、小小三峡、神女景区、巫峡、下庄天路。适合船游峡谷、红叶摄影、三峡文化、山水观光和秋季主题游。"],
  ["wuxi", "巫溪县", "红池坝、宁厂古镇、兰英大峡谷、灵巫洞、荆竹峡。适合高山草场、千年盐业古镇、峡谷自驾、避暑和自然探险。"],
  ["shizhu", "石柱土家族自治县", "黄水国家森林公园、大风堡、千野草场、西沱古镇、冷水国际滑雪场。适合森林避暑、草场露营、土家文化、冬季冰雪和自驾度假。"],
  ["xiushan", "秀山土家族苗族自治县", "洪安边城、川河盖、凤凰山花灯民俗旅游区、钟灵湖。适合边城文化、土家苗族民俗、高山草场、花灯非遗和渝湘黔交界游。"],
  ["youyang", "酉阳土家族苗族自治县", "酉阳桃花源、龚滩古镇、乌江画廊、叠石花谷、花田梯田。适合桃源田园、古镇、乌江山水、民族文化和慢节奏深度游。"],
  ["pengshui", "彭水苗族土家族自治县", "阿依河、蚩尤九黎城、摩围山、乌江画廊、郁山古镇。适合漂流、苗族文化、森林避暑、乌江山水和夏季年轻人出游。"]
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
  String(text || "").toLowerCase().split(/[^a-z0-9]+/).forEach(function (x) {
    if (x) tokens.push(x);
  });
  return tokens;
}

function embed(text) {
  var vector = new Array(EMBEDDING_DIM).fill(0);
  tokenize(text).forEach(function (token) {
    var h = crypto.createHash("sha1").update(token).digest();
    vector[h.readUInt32BE(0) % EMBEDDING_DIM] += h[4] % 2 === 0 ? 1 : -1;
  });
  var norm = Math.sqrt(vector.reduce(function (sum, n) { return sum + n * n; }, 0));
  if (!norm) return vector;
  return vector.map(function (n) { return Number((n / norm).toFixed(6)); });
}

function chunkKey(destinationId, district) {
  return crypto.createHash("sha1").update(["planner_destination", destinationId, district].join("|")).digest("hex");
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
    "ON DUPLICATE KEY UPDATE source_type=VALUES(source_type), source_name=VALUES(source_name), source_url=VALUES(source_url), " +
    "district=VALUES(district), scenic_name=VALUES(scenic_name), level=VALUES(level), title=VALUES(title), content=VALUES(content), " +
    "tags_json=VALUES(tags_json), embedding_model=VALUES(embedding_model), embedding_dim=VALUES(embedding_dim), embedding_json=VALUES(embedding_json)";

  for (var i = 0; i < DESTINATIONS.length; i++) {
    var d = DESTINATIONS[i];
    var id = d[0];
    var district = d[1];
    var content = d[2];
    var title = district + "旅游目的地知识";
    var scenicName = district + "旅游目的地";
    var tags = [id, district, "planner目的地", "重庆区县", "旅游景区", "路线规划"];
    await pool.execute(sql, [
      chunkKey(id, district),
      "planner_destination",
      "重庆市人民政府网、市文化旅游委A级旅游景区名单及区县公开资料",
      OFFICIAL_A_LIST_URL,
      district,
      scenicName,
      "区县目的地",
      title,
      content,
      JSON.stringify(tags),
      EMBEDDING_MODEL,
      EMBEDDING_DIM,
      JSON.stringify(embed([district, scenicName, title, tags.join(" "), content].join("\n")))
    ]);
  }

  var countResult = await pool.execute("SELECT COUNT(*) AS count FROM rag_tourism_chunks WHERE source_type = 'planner_destination'");
  var sampleResult = await pool.execute(
    "SELECT district, scenic_name AS scenicName, title FROM rag_tourism_chunks WHERE source_type = 'planner_destination' ORDER BY district LIMIT 8"
  );
  await pool.end();

  console.log(JSON.stringify({
    ok: true,
    insertedOrUpdated: DESTINATIONS.length,
    plannerDestinationRows: countResult[0][0].count,
    sample: sampleResult[0]
  }, null, 2));
}

main().catch(function (e) {
  console.error(JSON.stringify({ ok: false, code: e.code || "", message: e.message || String(e) }, null, 2));
  process.exit(1);
});
