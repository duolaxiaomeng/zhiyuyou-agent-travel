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

var BOOKING_LINKS = [
  {
    district: "武隆区",
    scenicName: "天生三桥",
    aliases: ["武隆喀斯特", "天坑三桥", "天生三桥", "仙女山", "龙水峡地缝"],
    bookingUrl: "https://m.tuniu.com/menpiao/685",
    platform: "途牛",
    bookingType: "ticket",
    sourceName: "途牛门票",
    sourceUrl: "https://m.tuniu.com/menpiao/685",
    note: "国内第三方票务预订页；下单前请核对日期、入园方式和退改规则。"
  },
  {
    district: "大足区",
    scenicName: "大足石刻",
    aliases: ["大足石刻", "宝顶山", "北山石刻"],
    bookingUrl: "https://www.tuniu.com/menpiao/658",
    platform: "途牛",
    bookingType: "ticket",
    sourceName: "途牛门票",
    sourceUrl: "https://www.tuniu.com/menpiao/658",
    note: "第三方门票预订页；也可按大足石刻官方说明通过官方微信或授权平台购票。"
  },
  {
    district: "南川区",
    scenicName: "金佛山",
    aliases: ["金佛山", "金佛山景区", "南川金佛山"],
    bookingUrl: "https://www.tuniu.com/menpiao/2984",
    platform: "途牛",
    bookingType: "ticket",
    sourceName: "途牛门票",
    sourceUrl: "https://www.tuniu.com/menpiao/2984",
    note: "第三方门票预订页；请以景区当天开放和索道运行公告为准。"
  },
  {
    district: "江津区",
    scenicName: "四面山",
    aliases: ["四面山", "江津四面山", "望乡台"],
    bookingUrl:
      "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Dts_sku%26from_index%3D1%26from_value%3D%25E9%2587%2591%25E7%25A7%258B%25E4%25B8%25AD%25E5%258E%259F%26dist_city%3D%25E9%25B9%25A4%25E5%25A3%2581&id=12351",
    platform: "去哪儿",
    bookingType: "ticket",
    sourceName: "去哪儿门票",
    sourceUrl:
      "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Dts_sku%26from_index%3D1%26from_value%3D%25E9%2587%2591%25E7%25A7%258B%25E4%25B8%25AD%25E5%258E%259F%26dist_city%3D%25E9%25B9%25A4%25E5%25A3%2581&id=12351",
    note: "第三方门票预订页；请核对入园时间段和是否需换票。"
  },
  {
    district: "云阳县",
    scenicName: "云阳龙缸",
    aliases: ["云阳龙缸", "龙缸", "云端廊桥", "张飞庙", "岐山草原"],
    bookingUrl: "https://www.cqyylg.com/service1.aspx?t=46",
    platform: "景区官网",
    bookingType: "official_ticket",
    sourceName: "重庆·云阳龙缸景区官网",
    sourceUrl: "https://www.cqyylg.com/service1.aspx?t=46",
    note: "景区官网门票预定页；请以页面实时票种、预约规则和公告为准。"
  },
  {
    district: "奉节县",
    scenicName: "白帝城·瞿塘峡",
    aliases: ["白帝城", "瞿塘峡", "白帝城·瞿塘峡", "三峡之巅", "夔门"],
    bookingUrl: "https://www.bdcqtx.com/",
    platform: "景区官网",
    bookingType: "official_ticket",
    sourceName: "奉节白帝城瞿塘峡5A景区官网",
    sourceUrl: "https://www.bdcqtx.com/",
    note: "景区官网含官方购票/门票预约入口；进入后选择对应票种。"
  },
  {
    district: "巫山县",
    scenicName: "巫山小三峡",
    aliases: ["巫山小三峡", "小小三峡", "双峡一峰", "巫峡"],
    bookingUrl: "https://m.dahepiao.com/jingqu/wsxsxdz/",
    platform: "大河票务",
    bookingType: "ticket",
    sourceName: "大河票务",
    sourceUrl: "https://m.dahepiao.com/jingqu/wsxsxdz/",
    note: "第三方门票预订页；船游项目通常需按预约规则登船。"
  },
  {
    district: "彭水苗族土家族自治县",
    scenicName: "阿依河",
    aliases: ["阿依河", "阿依河景区", "漂流", "竹筏"],
    bookingUrl: "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Dmps_search_suggest_s&id=9623",
    platform: "去哪儿",
    bookingType: "ticket",
    sourceName: "去哪儿门票",
    sourceUrl: "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Dmps_search_suggest_s&id=9623",
    note: "第三方门票预订页；漂流类项目请重点核对天气、开放状态和使用时间。"
  },
  {
    district: "黔江区",
    scenicName: "濯水景区-蒲花暗河",
    aliases: ["濯水", "濯水古镇", "蒲花暗河", "黔江城市大峡谷", "神龟峡"],
    bookingUrl: "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Das_recommend_sight&id=191924",
    platform: "去哪儿",
    bookingType: "ticket",
    sourceName: "去哪儿门票",
    sourceUrl: "https://touch.piao.qunar.com/touch/detail.htm?cat=from_area%3Das_recommend_sight&id=191924",
    note: "第三方门票预订页；古镇开放区和付费项目可能分开，请按实际票种选择。"
  },
  {
    district: "万盛经开区",
    scenicName: "黑山谷",
    aliases: ["黑山谷", "万盛黑山谷", "黑山谷景区"],
    bookingUrl: "https://www.cncn.com/piao/1552",
    platform: "欣欣旅游",
    bookingType: "ticket",
    sourceName: "欣欣旅游门票",
    sourceUrl: "https://www.cncn.com/piao/1552",
    note: "国内第三方门票预订页；请核对可预订日期、票种和退改规则。"
  },
  {
    district: "酉阳土家族苗族自治县",
    scenicName: "酉阳桃花源",
    aliases: ["酉阳桃花源", "桃花源", "龚滩古镇", "乌江画廊"],
    bookingUrl: "https://www.cncn.com/piao/1653",
    platform: "欣欣旅游",
    bookingType: "ticket",
    sourceName: "欣欣旅游门票",
    sourceUrl: "https://www.cncn.com/piao/1653",
    note: "第三方门票预订页；官方渠道通常也可通过“酉阳旅游”等公众号购票。"
  },
  {
    district: "涪陵区",
    scenicName: "武陵山大裂谷",
    aliases: ["武陵山大裂谷", "大裂谷", "816工程", "白鹤梁"],
    bookingUrl: "https://www.tuniu.com/menpiao/1831883",
    platform: "途牛",
    bookingType: "ticket",
    sourceName: "途牛门票",
    sourceUrl: "https://www.tuniu.com/menpiao/1831883",
    note: "国内第三方门票预订页；请进入后确认是否有当前可售票种。"
  }
];

function keyOf(item) {
  return crypto.createHash("sha1").update([item.district, item.scenicName, item.bookingUrl].join("|")).digest("hex");
}

async function ensureTable(pool) {
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS scenic_booking_links (" +
      "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
      "booking_key CHAR(40) NOT NULL," +
      "district VARCHAR(120) NOT NULL," +
      "scenic_name VARCHAR(180) NOT NULL," +
      "aliases_json TEXT NOT NULL," +
      "booking_url VARCHAR(1200) NOT NULL," +
      "platform VARCHAR(120) NOT NULL," +
      "booking_type VARCHAR(64) NOT NULL," +
      "source_name VARCHAR(255) NOT NULL," +
      "source_url VARCHAR(1200) NOT NULL," +
      "note VARCHAR(512) NOT NULL DEFAULT ''," +
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY uk_scenic_booking_key (booking_key)," +
      "KEY idx_scenic_booking_district (district)," +
      "KEY idx_scenic_booking_name (scenic_name)" +
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
    "INSERT INTO scenic_booking_links " +
    "(booking_key, district, scenic_name, aliases_json, booking_url, platform, booking_type, source_name, source_url, note) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE district=VALUES(district), scenic_name=VALUES(scenic_name), aliases_json=VALUES(aliases_json), " +
    "booking_url=VALUES(booking_url), platform=VALUES(platform), booking_type=VALUES(booking_type), source_name=VALUES(source_name), " +
    "source_url=VALUES(source_url), note=VALUES(note)";
  for (var i = 0; i < BOOKING_LINKS.length; i++) {
    var item = BOOKING_LINKS[i];
    await pool.execute(sql, [
      keyOf(item),
      item.district,
      item.scenicName,
      JSON.stringify(item.aliases),
      item.bookingUrl,
      item.platform,
      item.bookingType,
      item.sourceName,
      item.sourceUrl,
      item.note
    ]);
  }
  var countResult = await pool.execute("SELECT COUNT(*) AS count FROM scenic_booking_links");
  await pool.end();
  console.log(JSON.stringify({ ok: true, insertedOrUpdated: BOOKING_LINKS.length, totalRows: countResult[0][0].count }, null, 2));
}

main().catch(function (e) {
  console.error(JSON.stringify({ ok: false, code: e.code || "", message: e.message || String(e) }, null, 2));
  process.exit(1);
});
