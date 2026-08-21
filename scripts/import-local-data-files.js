"use strict";
/**
 * 从 data/ 目录将本地 JSON 导入 MySQL，成功后删除已处理的源文件。
 *
 * 自动识别：
 *   - data/users.json
 *   - data/users.json.migrated.*.bak（及同类 users 备份）
 *   - data/community-posts.json（用户发帖数组，字段与前端 zyyCommunityPosts 一致）
 *   - data/user-data-bundle.json（按手机号分组的 cart / orders / memberState / profileExtra / communityPosts）
 *
 * 用法: node scripts/import-local-data-files.js
 * 仅删除：对应文件整文件导入过程未抛错且至少写入一条有效数据，或文件为空数组。
 */
var fs = require("fs");
var path = require("path");
var mysql = require("mysql2/promise");
var dotenv = require("dotenv");

var root = path.join(__dirname, "..");
var dataDir = path.join(root, "data");
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

var USERS_DDL =
    "CREATE TABLE IF NOT EXISTS users (" +
    "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
    "username VARCHAR(100) NOT NULL," +
    "phone CHAR(11) NOT NULL," +
    "password_hash VARCHAR(255) NOT NULL," +
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
    "PRIMARY KEY (id)," +
    "UNIQUE KEY uk_users_phone (phone)" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

var USER_DATA_DDLS = [
  "CREATE TABLE IF NOT EXISTS user_carts (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "items_json LONGTEXT NOT NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS orders (" +
      "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
      "phone CHAR(11) NOT NULL," +
      "order_no VARCHAR(48) NOT NULL," +
      "items_json LONGTEXT NOT NULL," +
      "item_count INT UNSIGNED NOT NULL DEFAULT 0," +
      "total DECIMAL(12,2) NOT NULL DEFAULT 0," +
      "status VARCHAR(32) NOT NULL DEFAULT '待发货'," +
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY uk_orders_no (order_no)," +
      "KEY idx_orders_phone_created (phone, created_at)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS community_posts (" +
      "id VARCHAR(64) NOT NULL PRIMARY KEY," +
      "phone CHAR(11) NOT NULL," +
      "author VARCHAR(100) NOT NULL," +
      "destination VARCHAR(120) NOT NULL," +
      "`type` VARCHAR(64) NOT NULL," +
      "title VARCHAR(512) NOT NULL," +
      "content MEDIUMTEXT NOT NULL," +
      "image VARCHAR(1024) NOT NULL DEFAULT ''," +
      "score VARCHAR(16) NOT NULL DEFAULT '5.0'," +
      "likes INT UNSIGNED NOT NULL DEFAULT 0," +
      "user_post TINYINT(1) NOT NULL DEFAULT 1," +
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
      "KEY idx_comm_phone (phone)," +
      "KEY idx_comm_created (created_at)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS user_member_state (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "ar_used INT UNSIGNED NOT NULL DEFAULT 0," +
      "member_until DATETIME NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
  "CREATE TABLE IF NOT EXISTS user_profile_extra (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "extra_json LONGTEXT NOT NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];

var UPSERT_USER_SQL =
    "INSERT INTO users (username, phone, password_hash) VALUES (?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE username = VALUES(username), password_hash = VALUES(password_hash)";

var UPSERT_COMMUNITY_SQL =
    "INSERT INTO community_posts (id, phone, author, destination, `type`, title, content, image, score, likes, user_post) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) " +
    "ON DUPLICATE KEY UPDATE destination=VALUES(destination), `type`=VALUES(`type`), title=VALUES(title), content=VALUES(content), image=VALUES(image), score=VALUES(score), likes=VALUES(likes), updated_at=CURRENT_TIMESTAMP";

async function ensureTables(pool) {
  await pool.execute(USERS_DDL);
  for (var i = 0; i < USER_DATA_DDLS.length; i++) {
    await pool.execute(USER_DATA_DDLS[i]);
  }
}

function isUsersBackupArray(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  var a = list[0];
  return a && typeof a === "object" && a.passwordHash && /^\d{11}$/.test(String(a.phone || ""));
}

function isCommunityPostsArray(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  var a = list[0];
  return (
      a &&
      typeof a === "object" &&
      !a.passwordHash &&
      (a.authorPhone || a.destination) &&
      a.title
  );
}

async function importUsersArray(pool, list) {
  var ok = 0;
  var skip = 0;
  for (var i = 0; i < list.length; i++) {
    var u = list[i];
    var username = (u && u.username && String(u.username).trim()) || "";
    var phone = (u && u.phone && String(u.phone).trim()) || "";
    var passwordHash = (u && u.passwordHash && String(u.passwordHash).trim()) || "";
    if (!username || !/^\d{11}$/.test(phone) || !passwordHash) {
      skip++;
      continue;
    }
    await pool.execute(UPSERT_USER_SQL, [username, phone, passwordHash]);
    ok++;
  }
  return { ok: ok, skip: skip };
}

async function importCommunityPostsArray(pool, list) {
  var ok = 0;
  var skip = 0;
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p || !p.id) {
      skip++;
      continue;
    }
    var phone = String(p.authorPhone || "").trim();
    if (!/^\d{11}$/.test(phone)) {
      skip++;
      continue;
    }
    try {
      await pool.execute(UPSERT_COMMUNITY_SQL, [
        String(p.id).slice(0, 64),
        phone,
        String(p.author || "用户").slice(0, 100),
        String(p.destination || "").slice(0, 120),
        String(p.type || "风景图片").slice(0, 64),
        String(p.title || "").slice(0, 512),
        String(p.content || ""),
        String(p.image || "").slice(0, 1024),
        String(p.score || "5.0").slice(0, 16),
        Math.floor(Number(p.likes)) || 0,
      ]);
      ok++;
    } catch (e) {
      skip++;
    }
  }
  return { ok: ok, skip: skip };
}

async function importBundle(pool, obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("bundle 须为按手机号索引的对象");
  }
  var total = { users: 0, posts: 0, carts: 0, orders: 0, member: 0, profile: 0 };
  var phones = Object.keys(obj);
  for (var i = 0; i < phones.length; i++) {
    var phone = phones[i].trim();
    if (!/^\d{11}$/.test(phone)) continue;
    var b = obj[phone];
    if (!b || typeof b !== "object") continue;

    if (Array.isArray(b.communityPosts) && b.communityPosts.length) {
      var r = await importCommunityPostsArray(
          pool,
          b.communityPosts.map(function (p) {
            return Object.assign({}, p, { authorPhone: p.authorPhone || phone });
          })
      );
      total.posts += r.ok;
    }
    if (Array.isArray(b.cart) && b.cart.length) {
      await pool.execute(
          "INSERT INTO user_carts (phone, items_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE items_json = VALUES(items_json)",
          [phone, JSON.stringify(b.cart)]
      );
      total.carts++;
    }
    if (Array.isArray(b.orders) && b.orders.length) {
      for (var j = 0; j < b.orders.length; j++) {
        var o = b.orders[j];
        if (!o || !o.orderNo || !Array.isArray(o.items)) continue;
        try {
          await pool.execute(
              "INSERT INTO orders (phone, order_no, items_json, item_count, total, status) VALUES (?, ?, ?, ?, ?, ?)",
              [
                phone,
                String(o.orderNo).slice(0, 48),
                JSON.stringify(o.items),
                typeof o.count === "number" ? o.count : o.items.length,
                Number(o.total) || 0,
                String(o.status || "待发货").slice(0, 32),
              ]
          );
          total.orders++;
        } catch (e) {
          if (!(e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062))) throw e;
        }
      }
    }
    if (b.memberState && typeof b.memberState === "object") {
      var arU =
          typeof b.memberState.arUsed === "number" && !isNaN(b.memberState.arUsed)
              ? Math.max(0, Math.floor(b.memberState.arUsed))
              : 0;
      var mu = b.memberState.memberUntil ? new Date(b.memberState.memberUntil) : null;
      var muSql = mu && !isNaN(mu.getTime()) ? mu : null;
      await pool.execute(
          "INSERT INTO user_member_state (phone, ar_used, member_until) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ar_used = GREATEST(ar_used, VALUES(ar_used)), member_until = CASE WHEN VALUES(member_until) IS NULL THEN member_until WHEN member_until IS NULL THEN VALUES(member_until) WHEN VALUES(member_until) > member_until THEN VALUES(member_until) ELSE member_until END",
          [phone, arU, muSql]
      );
      total.member++;
    }
    if (b.profileExtra && typeof b.profileExtra === "object" && !Array.isArray(b.profileExtra)) {
      await pool.execute(
          "INSERT INTO user_profile_extra (phone, extra_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE extra_json = VALUES(extra_json)",
          [phone, JSON.stringify(b.profileExtra)]
      );
      total.profile++;
    }
  }
  return total;
}

function listDataJsonCandidates() {
  if (!fs.existsSync(dataDir)) return [];
  var names = fs.readdirSync(dataDir);
  var out = [];
  names.forEach(function (name) {
    if (!/\.(json|bak)$/i.test(name)) return;
    var full = path.join(dataDir, name);
    if (!fs.statSync(full).isFile()) return;
    if (name === "users.json") out.push({ path: full, kind: "auto" });
    else if (name === "community-posts.json") out.push({ path: full, kind: "community" });
    else if (name === "user-data-bundle.json") out.push({ path: full, kind: "bundle" });
    else if (/^users\.json\.migrated\.\d+\.bak$/i.test(name) || /^users\.json\./i.test(name)) {
      out.push({ path: full, kind: "auto" });
    }
  });
  return out;
}

async function processFile(pool, filePath) {
  var base = path.basename(filePath);
  var raw = fs.readFileSync(filePath, "utf8");
  var parsed = JSON.parse(raw);
  var result = { file: base, wrote: false, detail: "" };

  if (filePath.endsWith("user-data-bundle.json") || base === "user-data-bundle.json") {
    var t = await importBundle(pool, parsed);
    result.wrote = Object.keys(t).some(function (k) {
      return t[k] > 0;
    });
    result.detail = JSON.stringify(t);
    return result;
  }

  if (base === "community-posts.json") {
    if (!Array.isArray(parsed)) throw new Error("community-posts.json 须为数组");
    var cr = await importCommunityPostsArray(pool, parsed);
    result.wrote = cr.ok > 0 || parsed.length === 0;
    result.detail = "posts ok=" + cr.ok + " skip=" + cr.skip;
    return result;
  }

  if (!Array.isArray(parsed)) {
    result.detail = "跳过：根类型不是数组";
    return result;
  }

  if (isUsersBackupArray(parsed)) {
    var ur = await importUsersArray(pool, parsed);
    result.wrote = ur.ok > 0 || parsed.length === 0;
    result.detail = "users ok=" + ur.ok + " skip=" + ur.skip;
    return result;
  }

  if (isCommunityPostsArray(parsed)) {
    var cr2 = await importCommunityPostsArray(pool, parsed);
    result.wrote = cr2.ok > 0 || parsed.length === 0;
    result.detail = "posts(ok) ok=" + cr2.ok + " skip=" + cr2.skip;
    return result;
  }

  result.detail = "跳过：无法识别数组类型（需用户备份或社区帖数组）";
  return result;
}

async function main() {
  if (!DB_USER) {
    console.error("未配置 DB_USER，请在 .env.local 中填写 MySQL。");
    process.exit(1);
  }
  var pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  await ensureTables(pool);

  var files = listDataJsonCandidates();
  if (!files.length) {
    console.log("data/ 下未发现可导入的 .json / .bak 文件（users.json、users.json.migrated.*.bak、community-posts.json、user-data-bundle.json）。");
    await pool.end();
    return;
  }

  var deleted = [];
  var kept = [];

  for (var i = 0; i < files.length; i++) {
    var fp = files[i].path;
    var base = path.basename(fp);
    try {
      var r = await processFile(pool, fp);
      console.log("[" + base + "] " + r.detail);
      if (r.wrote) {
        fs.unlinkSync(fp);
        deleted.push(base);
        console.log("  已删除源文件: data/" + base);
      } else {
        kept.push(base + " (" + r.detail + ")");
      }
    } catch (e) {
      console.error("[" + base + "] 失败:", e && e.message ? e.message : e);
      kept.push(base + " (失败)");
    }
  }

  await pool.end();
  console.log("完成。已删除:", deleted.length ? deleted.join(", ") : "无");
  if (kept.length) console.log("未删除:", kept.join(" | "));
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
