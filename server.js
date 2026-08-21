"use strict";

var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var express = require("express");
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var mysql = require("mysql2/promise");
var dns = require("dns");
var { Readable } = require("stream");

var dotenv = require("dotenv");
var envLocalPath = path.join(__dirname, ".env.local");
var envPath = path.join(__dirname, ".env");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

var PORT = parseInt(process.env.PORT || "3000", 10);
var JWT_SECRET = process.env.JWT_SECRET || "";
var ASSISTANT_UPSTREAM_URL =
    process.env.ASSISTANT_UPSTREAM_URL || process.env.AI_API_URL || "";
var ASSISTANT_UPSTREAM_KEY = process.env.ASSISTANT_UPSTREAM_KEY || "";
var DOUBAO_UPSTREAM_URL = process.env.DOUBAO_UPSTREAM_URL || ASSISTANT_UPSTREAM_URL || "";
var DOUBAO_UPSTREAM_KEY = process.env.DOUBAO_UPSTREAM_KEY || ASSISTANT_UPSTREAM_KEY || "";
var DOUBAO_MODEL = process.env.DOUBAO_MODEL || "";
var DEEPSEEK_UPSTREAM_URL = process.env.DEEPSEEK_UPSTREAM_URL || "";
var DEEPSEEK_UPSTREAM_KEY = process.env.DEEPSEEK_UPSTREAM_KEY || "";
var DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/** MySQL：用户账号（通过 .env / .env.local 配置，勿把密码写进代码仓库） */
var DB_HOST = process.env.DB_HOST || "127.0.0.1";
var DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
var DB_USER = process.env.DB_USER || "";
var DB_PASSWORD = process.env.DB_PASSWORD || "";
var DB_NAME = process.env.DB_NAME || "travel";

/** 管理员账号:在 .env.local 中配置 ADMIN_PHONE,该手机号登录后可查看全站订单;未配置则无人是管理员 */
var ADMIN_PHONE = process.env.ADMIN_PHONE || "";

var dbPool = null;

function getDbPool() {
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return dbPool;
}

/** 启动时建表；与原先 JSON 字段对应：username、phone、password_hash（bcrypt） */
async function ensureUsersTable() {
  var pool = getDbPool();
  await pool.execute(
      "CREATE TABLE IF NOT EXISTS users (" +
      "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
      "username VARCHAR(100) NOT NULL," +
      "phone CHAR(11) NOT NULL," +
      "password_hash VARCHAR(255) NOT NULL," +
      "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "PRIMARY KEY (id)," +
      "UNIQUE KEY uk_users_phone (phone)" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

/** 购物车、订单、社区帖、会员状态、资料扩展（按手机号关联 users） */
async function ensureUserDataTables() {
  var pool = getDbPool();
  await pool.execute(
      "CREATE TABLE IF NOT EXISTS user_carts (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "items_json LONGTEXT NOT NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await pool.execute(
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
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await pool.execute(
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
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await pool.execute(
      "CREATE TABLE IF NOT EXISTS user_member_state (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "ar_used INT UNSIGNED NOT NULL DEFAULT 0," +
      "member_until DATETIME NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
  await pool.execute(
      "CREATE TABLE IF NOT EXISTS user_profile_extra (" +
      "phone CHAR(11) NOT NULL PRIMARY KEY," +
      "extra_json LONGTEXT NOT NULL," +
      "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );
}

function rowToIso(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapCommunityRow(r) {
  return {
    id: r.id,
    destination: r.destination,
    type: r.type,
    title: r.title,
    content: r.content,
    image: r.image || "",
    author: r.author,
    authorPhone: r.phone,
    score: r.score,
    likes: Number(r.likes) || 0,
    userPost: !!r.user_post,
    createdAt: rowToIso(r.created_at),
    updatedAt: rowToIso(r.updated_at),
  };
}

function mapOrderRow(r) {
  var items;
  try {
    items = JSON.parse(r.items_json || "[]");
  } catch (e) {
    items = [];
  }
  return {
    orderNo: r.order_no,
    createdAt: rowToIso(r.created_at),
    status: r.status,
    items: items,
    count: r.item_count,
    total: Number(r.total),
  };
}

function mapAdminOrderRow(r) {
  var o = mapOrderRow(r);
  o.userPhone = String(r.phone || "");
  return o;
}

function adminMiddleware(req, res, next) {
  if (!ADMIN_PHONE || !req.user || String(req.user.phone || "") !== ADMIN_PHONE) {
    return res.status(403).json({ error: "需要管理员权限" });
  }
  next();
}

var app = express();
app.use(express.json({ limit: "15mb" }));

function signToken(user) {
  return jwt.sign(
      { sub: user.phone, username: user.username, phone: user.phone },
      JWT_SECRET,
      { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  var h = req.headers.authorization || "";
  var m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ error: "未提供令牌" });
  }
  try {
    var payload = jwt.verify(m[1], JWT_SECRET);
    req.user = { username: payload.username, phone: payload.phone };
    next();
  } catch (e) {
    return res.status(401).json({ error: "令牌无效或已过期" });
  }
}

app.post("/api/register", async function (req, res) {
  var username = (req.body && req.body.username && String(req.body.username).trim()) || "";
  var phone = (req.body && req.body.phone && String(req.body.phone).trim()) || "";
  var password = (req.body && req.body.password) || "";

  if (!username || !phone || !password) {
    return res.status(400).json({ error: "请填写昵称、手机号和密码" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "密码至少 6 位" });
  }
  if (!/^\d{11}$/.test(phone)) {
    return res.status(400).json({ error: "请输入 11 位手机号" });
  }

  var hash = bcrypt.hashSync(password, 10);
  var pool = getDbPool();
  try {
    await pool.execute(
        "INSERT INTO users (username, phone, password_hash) VALUES (?, ?, ?)",
        [username, phone, hash]
    );
  } catch (e) {
    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ error: "该手机号已注册" });
    }
    console.error(e);
    return res.status(500).json({
      error: "注册失败，请稍后重试",
      detail: String(e && e.message ? e.message : e),
    });
  }

  var user = { username: username, phone: phone };
  var token = signToken(user);
  res.json({
    token: token,
    user: { username: user.username, phone: user.phone },
  });
});

app.post("/api/login", async function (req, res) {
  var phone = (req.body && req.body.phone && String(req.body.phone).trim()) || "";
  var password = (req.body && req.body.password) || "";

  if (!phone || !password) {
    return res.status(400).json({ error: "请填写手机号和密码" });
  }

  var pool = getDbPool();
  var rows;
  try {
    var result = await pool.execute(
        "SELECT username, phone, password_hash AS passwordHash FROM users WHERE phone = ? LIMIT 1",
        [phone]
    );
    rows = result[0];
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "登录失败，请稍后重试",
      detail: String(e && e.message ? e.message : e),
    });
  }

  var found = rows[0];
  if (!found || !bcrypt.compareSync(password, found.passwordHash)) {
    return res.status(401).json({ error: "手机号或密码错误" });
  }

  var token = signToken(found);
  res.json({
    token: token,
    user: { username: found.username, phone: found.phone },
  });
});

app.get("/api/me", authMiddleware, async function (req, res) {
  var user = { username: req.user.username, phone: req.user.phone };
  if (ADMIN_PHONE && String(req.user.phone || "") === ADMIN_PHONE) {
    user.isAdmin = true;
  }
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT extra_json FROM user_profile_extra WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    if (result[0].length) {
      var ex = JSON.parse(result[0][0].extra_json || "{}");
      if (ex && typeof ex === "object" && !Array.isArray(ex)) {
        Object.assign(user, ex);
      }
    }
  } catch (e) {
    console.error("/api/me merge profile_extra", e);
  }
  res.json({ user: user });
});

app.get("/api/user/cart", authMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT items_json FROM user_carts WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    var rows = result[0];
    if (!rows.length) return res.json({ items: [] });
    var items;
    try {
      items = JSON.parse(rows[0].items_json || "[]");
    } catch (e) {
      items = [];
    }
    return res.json({ items: Array.isArray(items) ? items : [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取购物车失败" });
  }
});

app.put("/api/user/cart", authMiddleware, async function (req, res) {
  var items = req.body && req.body.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "items 须为数组" });
  }
  try {
    var pool = getDbPool();
    await pool.execute(
        "INSERT INTO user_carts (phone, items_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE items_json = VALUES(items_json)",
        [req.user.phone, JSON.stringify(items)]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "保存购物车失败" });
  }
});

app.get("/api/user/orders", authMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT order_no, items_json, item_count, total, status, created_at FROM orders WHERE phone = ? ORDER BY created_at DESC LIMIT 200",
        [req.user.phone]
    );
    return res.json({ orders: result[0].map(mapOrderRow) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取订单失败" });
  }
});

app.get("/api/admin/orders", authMiddleware, adminMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT phone, order_no, items_json, item_count, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 500"
    );
    return res.json({ orders: result[0].map(mapAdminOrderRow) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取订单失败" });
  }
});

app.delete("/api/admin/orders/:orderNo", authMiddleware, adminMiddleware, async function (req, res) {
  var orderNo = String(req.params.orderNo || "").trim();
  if (!orderNo) {
    return res.status(400).json({ error: "缺少订单号" });
  }
  try {
    var pool = getDbPool();
    var result = await pool.execute("DELETE FROM orders WHERE order_no = ? LIMIT 1", [orderNo]);
    var affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
    if (!affected) {
      return res.status(404).json({ error: "订单不存在" });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "删除失败" });
  }
});

/** 管理员发货：将订单状态更新为「已完成」 */
app.post("/api/admin/orders/:orderNo/ship", authMiddleware, adminMiddleware, async function (req, res) {
  var orderNo = String(req.params.orderNo || "").trim();
  if (!orderNo) {
    return res.status(400).json({ error: "缺少订单号" });
  }
  var doneStatus = "已完成";
  try {
    var pool = getDbPool();
    var result = await pool.execute("UPDATE orders SET status = ? WHERE order_no = ? LIMIT 1", [
      doneStatus,
      orderNo,
    ]);
    var affected = result[0] && typeof result[0].affectedRows === "number" ? result[0].affectedRows : 0;
    if (!affected) {
      return res.status(404).json({ error: "订单不存在" });
    }
    return res.json({ ok: true, status: doneStatus });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "更新失败" });
  }
});

app.post("/api/user/orders", authMiddleware, async function (req, res) {
  var b = req.body || {};
  var orderNo = String(b.orderNo || "").trim();
  var items = b.items;
  if (!orderNo || !Array.isArray(items)) {
    return res.status(400).json({ error: "缺少 orderNo 或 items" });
  }
  var total = Number(b.total);
  if (!isFinite(total)) {
    total = items.reduce(function (s, x) {
      return s + (Number(x && x.price) || 0);
    }, 0);
  }
  var count = typeof b.count === "number" && !isNaN(b.count) ? b.count : items.length;
  var status = String(b.status || "待发货").slice(0, 32);
  try {
    var pool = getDbPool();
    await pool.execute(
        "INSERT INTO orders (phone, order_no, items_json, item_count, total, status) VALUES (?, ?, ?, ?, ?, ?)",
        [req.user.phone, orderNo, JSON.stringify(items), count, total, status]
    );
    return res.json({ ok: true });
  } catch (e) {
    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ error: "订单号已存在" });
    }
    console.error(e);
    return res.status(500).json({ error: "创建订单失败" });
  }
});

app.get("/api/community/user-posts", async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT id, phone, author, destination, `type`, title, content, image, score, likes, user_post, created_at, updated_at FROM community_posts ORDER BY created_at DESC LIMIT 500"
    );
    return res.json({ posts: result[0].map(mapCommunityRow) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取社区帖子失败" });
  }
});

app.get("/api/community/posts/:id", async function (req, res) {
  var id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "缺少 id" });
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT id, phone, author, destination, `type`, title, content, image, score, likes, user_post, created_at, updated_at FROM community_posts WHERE id = ? LIMIT 1",
        [id]
    );
    if (!result[0].length) return res.status(404).json({ error: "未找到" });
    return res.json({ post: mapCommunityRow(result[0][0]) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "查询失败" });
  }
});

app.post("/api/community/posts", authMiddleware, async function (req, res) {
  var b = req.body || {};
  var id = String(b.id || "").trim() || "uc" + Date.now();
  var dest = String(b.destination || "").trim();
  var typ = String(b.type || "风景图片").slice(0, 64);
  var tit = String(b.title || "").trim();
  var content = String(b.content || "");
  var image = String(b.image || "").slice(0, 1024);
  var score = String(b.score || "5.0").slice(0, 16);
  var likes = Math.floor(Number(b.likes)) || 0;
  if (!dest || !tit) return res.status(400).json({ error: "缺少目的地或标题" });
  var author = String(b.author || req.user.username || "用户").slice(0, 100);
  try {
    var pool = getDbPool();
    await pool.execute(
        "INSERT INTO community_posts (id, phone, author, destination, `type`, title, content, image, score, likes, user_post) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [id, req.user.phone, author, dest, typ, tit, content, image, score, likes]
    );
    var r2 = await pool.execute(
        "SELECT id, phone, author, destination, `type`, title, content, image, score, likes, user_post, created_at, updated_at FROM community_posts WHERE id = ? LIMIT 1",
        [id]
    );
    return res.json({ ok: true, post: mapCommunityRow(r2[0][0]) });
  } catch (e) {
    if (e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062)) {
      return res.status(409).json({ error: "帖子 id 已存在" });
    }
    console.error(e);
    return res.status(500).json({ error: "发布失败" });
  }
});

app.put("/api/community/posts/:id", authMiddleware, async function (req, res) {
  var id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "缺少 id" });
  var b = req.body || {};
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT * FROM community_posts WHERE id = ? LIMIT 1",
        [id]
    );
    if (!result[0].length) return res.status(404).json({ error: "未找到" });
    var cur = result[0][0];
    if (String(cur.phone) !== req.user.phone) {
      return res.status(403).json({ error: "无权编辑" });
    }
    var dest = b.destination != null ? String(b.destination).trim() : cur.destination;
    var typ = b.type != null ? String(b.type).slice(0, 64) : cur.type;
    var tit = b.title != null ? String(b.title).trim() : cur.title;
    var content = b.content != null ? String(b.content) : cur.content;
    var image = b.image != null ? String(b.image).slice(0, 1024) : cur.image;
    var score = b.score != null ? String(b.score).slice(0, 16) : cur.score;
    await pool.execute(
        "UPDATE community_posts SET destination = ?, `type` = ?, title = ?, content = ?, image = ?, score = ? WHERE id = ? AND phone = ?",
        [dest, typ, tit, content, image, score, id, req.user.phone]
    );
    var r2 = await pool.execute(
        "SELECT id, phone, author, destination, `type`, title, content, image, score, likes, user_post, created_at, updated_at FROM community_posts WHERE id = ? LIMIT 1",
        [id]
    );
    return res.json({ ok: true, post: mapCommunityRow(r2[0][0]) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "保存失败" });
  }
});

app.get("/api/user/member-state", authMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT ar_used, member_until FROM user_member_state WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    if (!result[0].length) {
      return res.json({ arUsed: 0, memberUntil: null });
    }
    var r = result[0][0];
    return res.json({ arUsed: r.ar_used || 0, memberUntil: rowToIso(r.member_until) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取会员状态失败" });
  }
});

app.post("/api/user/member-state/plan", authMiddleware, async function (req, res) {
  var planId = req.body && req.body.planId;
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT ar_used, member_until FROM user_member_state WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    var arUsed = 0;
    if (result[0].length) arUsed = result[0][0].ar_used || 0;
    var existingMs = null;
    if (result[0].length && result[0][0].member_until) {
      existingMs = new Date(result[0][0].member_until).getTime();
    }
    var base = new Date();
    if (existingMs != null && !isNaN(existingMs) && existingMs > base.getTime()) {
      base = new Date(existingMs);
    }
    var end = new Date(base);
    if (planId === "month") {
      end.setMonth(end.getMonth() + 1);
    } else if (planId === "quarter") {
      end.setMonth(end.getMonth() + 3);
    } else if (planId === "year") {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      return res.status(400).json({ error: "无效套餐" });
    }
    await pool.execute(
        "INSERT INTO user_member_state (phone, ar_used, member_until) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE member_until = VALUES(member_until)",
        [req.user.phone, arUsed, end]
    );
    return res.json({ ok: true, memberUntil: end.toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "开通失败" });
  }
});

app.post("/api/user/member-state/ar-use", authMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT ar_used, member_until FROM user_member_state WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    var arUsed = 0;
    var memberUntil = null;
    if (result[0].length) {
      arUsed = result[0][0].ar_used || 0;
      memberUntil = result[0][0].member_until;
    }
    if (memberUntil && new Date(memberUntil).getTime() > Date.now()) {
      return res.json({ ok: true, arUsed: arUsed, memberUntil: rowToIso(memberUntil), skipped: true });
    }
    await pool.execute(
        "INSERT INTO user_member_state (phone, ar_used, member_until) VALUES (?, 1, NULL) ON DUPLICATE KEY UPDATE ar_used = IF(member_until IS NOT NULL AND member_until > NOW(), ar_used, ar_used + 1)",
        [req.user.phone]
    );
    var r2 = await pool.execute(
        "SELECT ar_used, member_until FROM user_member_state WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    var r = r2[0][0];
    return res.json({ ok: true, arUsed: r.ar_used || 0, memberUntil: rowToIso(r.member_until) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "记录失败" });
  }
});

app.get("/api/user/profile-extra", authMiddleware, async function (req, res) {
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT extra_json FROM user_profile_extra WHERE phone = ? LIMIT 1",
        [req.user.phone]
    );
    if (!result[0].length) return res.json({ extra: {} });
    try {
      return res.json({ extra: JSON.parse(result[0][0].extra_json || "{}") });
    } catch (e) {
      return res.json({ extra: {} });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "读取资料失败" });
  }
});

app.put("/api/user/profile-extra", authMiddleware, async function (req, res) {
  var ex = req.body && req.body.extra;
  if (!ex || typeof ex !== "object" || Array.isArray(ex)) {
    return res.status(400).json({ error: "extra 须为对象" });
  }
  try {
    var pool = getDbPool();
    await pool.execute(
        "INSERT INTO user_profile_extra (phone, extra_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE extra_json = VALUES(extra_json)",
        [req.user.phone, JSON.stringify(ex)]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "保存资料失败" });
  }
});

/**
 * 将浏览器 localStorage 中的旧数据一次性写入当前登录账号（需登录）。
 * 成功后客户端应清除对应 localStorage 键并设置 zyyServerUserDataImported=1。
 */
app.post("/api/user/import-legacy", authMiddleware, async function (req, res) {
  var phone = req.user.phone;
  var b = req.body || {};
  var pool = getDbPool();
  var summary = { cart: false, orders: 0, posts: 0, member: false, profile: false };
  try {
    if (b.cart && Array.isArray(b.cart) && b.cart.length) {
      await pool.execute(
          "INSERT INTO user_carts (phone, items_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE items_json = VALUES(items_json)",
          [phone, JSON.stringify(b.cart)]
      );
      summary.cart = true;
    }
    if (b.orders && Array.isArray(b.orders)) {
      for (var i = 0; i < b.orders.length; i++) {
        var o = b.orders[i];
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
          summary.orders++;
        } catch (e) {
          if (!(e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062))) throw e;
        }
      }
    }
    if (b.communityPosts && Array.isArray(b.communityPosts)) {
      for (var j = 0; j < b.communityPosts.length; j++) {
        var p = b.communityPosts[j];
        if (!p || String(p.authorPhone || "") !== phone || !p.id) continue;
        try {
          await pool.execute(
              "INSERT INTO community_posts (id, phone, author, destination, `type`, title, content, image, score, likes, user_post) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE destination=VALUES(destination), `type`=VALUES(`type`), title=VALUES(title), content=VALUES(content), image=VALUES(image), score=VALUES(score), likes=VALUES(likes), updated_at=CURRENT_TIMESTAMP",
              [
                String(p.id).slice(0, 64),
                phone,
                String(p.author || req.user.username || "用户").slice(0, 100),
                String(p.destination || "").slice(0, 120),
                String(p.type || "风景图片").slice(0, 64),
                String(p.title || "").slice(0, 512),
                String(p.content || ""),
                String(p.image || "").slice(0, 1024),
                String(p.score || "5.0").slice(0, 16),
                Math.floor(Number(p.likes)) || 0,
              ]
          );
          summary.posts++;
        } catch (e) {
          console.error("import post", e);
        }
      }
    }
    if (b.memberState && typeof b.memberState === "object") {
      var ms = b.memberState;
      var arU = typeof ms.arUsed === "number" && !isNaN(ms.arUsed) ? Math.max(0, Math.floor(ms.arUsed)) : 0;
      var mu = ms.memberUntil ? new Date(ms.memberUntil) : null;
      var muSql = mu && !isNaN(mu.getTime()) ? mu : null;
      await pool.execute(
          "INSERT INTO user_member_state (phone, ar_used, member_until) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ar_used = GREATEST(ar_used, VALUES(ar_used)), member_until = CASE WHEN VALUES(member_until) IS NULL THEN member_until WHEN member_until IS NULL THEN VALUES(member_until) WHEN VALUES(member_until) > member_until THEN VALUES(member_until) ELSE member_until END",
          [phone, arU, muSql]
      );
      summary.member = true;
    }
    if (b.profileExtra && typeof b.profileExtra === "object" && !Array.isArray(b.profileExtra)) {
      await pool.execute(
          "INSERT INTO user_profile_extra (phone, extra_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE extra_json = VALUES(extra_json)",
          [phone, JSON.stringify(b.profileExtra)]
      );
      summary.profile = true;
    }
    return res.json({ ok: true, summary: summary });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "导入失败", detail: String(e && e.message ? e.message : e) });
  }
});

var RAG_EMBEDDING_DIM = 128;
var RAG_MAX_CONTEXT_CHUNKS = parseInt(process.env.RAG_MAX_CONTEXT_CHUNKS || "5", 10);

function tokenizeRagText(text) {
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

function ragHashToken(token) {
  var hash = crypto.createHash("sha1").update(token).digest();
  return {
    index: hash.readUInt32BE(0) % RAG_EMBEDDING_DIM,
    sign: hash[4] % 2 === 0 ? 1 : -1,
  };
}

function embedRagText(text) {
  var vector = new Array(RAG_EMBEDDING_DIM).fill(0);
  tokenizeRagText(text).forEach(function (token) {
    var h = ragHashToken(token);
    vector[h.index] += h.sign;
  });
  var norm = Math.sqrt(
      vector.reduce(function (sum, n) {
        return sum + n * n;
      }, 0)
  );
  if (!norm) return vector;
  return vector.map(function (n) {
    return n / norm;
  });
}

function cosineScore(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  var len = Math.min(a.length, b.length);
  var score = 0;
  for (var i = 0; i < len; i++) score += (Number(a[i]) || 0) * (Number(b[i]) || 0);
  return score;
}

function parseJsonArray(s) {
  try {
    var v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function buildRouteRagQuery(body) {
  var rag = body && body.rag && typeof body.rag === "object" ? body.rag : {};
  var parts = [];
  if (rag.destination) parts.push(String(rag.destination));
  if (rag.startPoint) parts.push(String(rag.startPoint));
  if (Array.isArray(rag.prefs)) parts.push(rag.prefs.join(" "));
  if (rag.query) parts.push(String(rag.query));
  if (body && Array.isArray(body.messages)) {
    body.messages.forEach(function (m) {
      if (m && m.role === "user" && m.content) parts.push(String(m.content));
    });
  }
  return parts.join("\n").slice(0, 6000);
}

function boostRagScore(row, query) {
  var q = String(query || "");
  var score = 0;
  if (row.district && q.indexOf(row.district) !== -1) score += 0.25;
  if (row.scenicName && q.indexOf(row.scenicName) !== -1) score += 0.3;
  var shortDistrict = String(row.district || "").replace(/(土家族|苗族|自治县|经开区|区|县|市)$/g, "");
  if (shortDistrict && q.indexOf(shortDistrict) !== -1) score += 0.18;
  var tags = parseJsonArray(row.tagsJson);
  tags.forEach(function (tag) {
    if (tag && q.indexOf(String(tag)) !== -1) score += 0.05;
  });
  return score;
}

async function retrieveRouteRagChunks(body) {
  if (process.env.RAG_ENABLED === "0") return [];
  var query = buildRouteRagQuery(body);
  if (!query.trim()) return [];
  try {
    var pool = getDbPool();
    var result = await pool.execute(
        "SELECT district, scenic_name AS scenicName, level, title, content, tags_json AS tagsJson, source_name AS sourceName, source_url AS sourceUrl, embedding_json AS embeddingJson FROM rag_tourism_chunks LIMIT 500"
    );
    var queryVector = embedRagText(query);
    return result[0]
        .map(function (row) {
          var vector = parseJsonArray(row.embeddingJson);
          row._score = cosineScore(queryVector, vector) + boostRagScore(row, query);
          return row;
        })
        .sort(function (a, b) {
          return b._score - a._score;
        })
        .slice(0, Math.max(1, RAG_MAX_CONTEXT_CHUNKS));
  } catch (e) {
    console.error("route rag retrieval failed", e);
    return [];
  }
}

function buildRagSystemPrompt(chunks) {
  if (!chunks || !chunks.length) return "";
  var lines = [
    "You are a Chongqing tourism route-planning assistant using a server-side RAG knowledge base.",
    "Use the following retrieved tourism knowledge as the preferred factual basis. If a fact is not present here, avoid inventing exact prices, opening hours, train numbers, or ticket policies.",
    "When useful, mention the knowledge source name briefly in Chinese, but keep the final route natural and concise.",
    "",
    "Retrieved Chongqing tourism knowledge:"
  ];
  chunks.forEach(function (row, idx) {
    lines.push(
        String(idx + 1) +
        ". [" +
        (row.district || "重庆") +
        " / " +
        (row.scenicName || row.title || "景区") +
        "] " +
        (row.title || "") +
        " - " +
        String(row.content || "").replace(/\s+/g, " ").slice(0, 700) +
        " Source: " +
        (row.sourceName || "") +
        " " +
        (row.sourceUrl || "")
    );
  });
  return lines.join("\n");
}

async function augmentRouteAssistantBodyWithRag(body) {
  var cloned = Object.assign({}, body || {});
  var messages = Array.isArray(cloned.messages) ? cloned.messages.slice() : [];
  var chunks = await retrieveRouteRagChunks(cloned);
  var ragPrompt = buildRagSystemPrompt(chunks);
  delete cloned.rag;
  if (ragPrompt) {
    messages.unshift({ role: "system", content: ragPrompt });
    cloned.messages = messages;
  }
  return cloned;
}

function normalizeScenicName(name) {
  return String(name || "")
      .replace(/(国家AAAAA级|AAAAA级|国家级|景区|旅游区|风景区|旅游目的地|目的地)$/g, "")
      .trim();
}

function bookingMatchScore(row, query) {
  var q = String(query || "");
  var scenicName = String(row.scenicName || "");
  var scenicShort = normalizeScenicName(scenicName);
  var title = String(row.title || "");
  var district = String(row.district || "");
  var content = String(row.content || "");
  var score = 0;
  if (scenicName && q.indexOf(scenicName) !== -1) score += 1.2;
  if (scenicShort && q.indexOf(scenicShort) !== -1) score += 0.9;
  if (title && q.indexOf(title) !== -1) score += 0.45;
  if (district && q.indexOf(district) !== -1) score += 0.35;
  var shortDistrict = district.replace(/(土家族|苗族|自治县|经开区|区|县|市)$/g, "");
  if (shortDistrict && q.indexOf(shortDistrict) !== -1) score += 0.2;
  parseJsonArray(row.tagsJson).forEach(function (tag) {
    if (tag && q.indexOf(String(tag)) !== -1) score += 0.08;
  });
  content.split(/[、，。；;,.]/).forEach(function (part) {
    var token = String(part || "").trim();
    if (token.length >= 3 && token.length <= 18 && q.indexOf(token) !== -1) score += 0.42;
  });
  if (row.sourceType === "official_government") score += 0.18;
  if (row.sourceType === "planner_destination") score -= 0.05;
  return score;
}

function loadDistrictBookingLinks() {
  var fp = path.join(__dirname, "data", "district-booking-links.json");
  try {
    var rows = JSON.parse(fs.readFileSync(fp, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error("load district booking links failed", e);
    return [];
  }
}

async function getScenicBookingLinks(body) {
  var routeText = String((body && body.routeText) || "").slice(0, 12000);
  var destination = String((body && body.destination) || "");
  var destinationId = String((body && body.destinationId) || "");
  var rows = loadDistrictBookingLinks();
  var match = rows.find(function (row) {
    return (
        (destinationId && String(row.destinationId || "") === destinationId) ||
        (destination && String(row.district || "") === destination)
    );
  });
  if (!match || !String(match.bookingUrl || "").trim()) return [];
  return [
    {
      name: match.district,
      district: match.district,
      title: match.district + "预约/购票入口",
      officialUrl: match.bookingUrl,
      sourceName: match.platform || "预约/购票入口",
      note: match.note || "请以页面实时展示的票种、价格和入园规则为准。",
    },
  ];
}

function proxyAssistantRequest(res, body, upstreamUrl, upstreamKey) {
  var headers = { "Content-Type": "application/json" };
  if (upstreamKey) {
    headers["Authorization"] = "Bearer " + upstreamKey;
  }
  fetch(upstreamUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  })
      .then(function (upstreamRes) {
        if (body.stream) {
          res.status(upstreamRes.status);
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          Readable.fromWeb(upstreamRes.body).pipe(res);
          return { isStream: true };
        }
        return upstreamRes.text().then(function (text) {
          return { upstreamRes: upstreamRes, text: text };
        });
      })
      .then(function (o) {
        if (o.isStream) return;
        var upstreamRes = o.upstreamRes;
        var text = o.text;
        var ct = upstreamRes.headers.get("content-type") || "";
        if (ct.indexOf("application/json") !== -1) {
          try {
            var json = JSON.parse(text);
            return res.status(upstreamRes.status).json(json);
          } catch (e) {
            return res.status(upstreamRes.status).json({
              error: "上游返回非 JSON",
              raw: text,
            });
          }
        }
        return res.status(upstreamRes.status).json({ reply: text, raw: true });
      })
      .catch(function (e) {
        return res.status(502).json({
          error: "无法连接上游",
          detail: String(e && e.message ? e.message : e),
        });
      });
}

app.post("/api/assistant", function (req, res) {
  var upstreamUrl = DEEPSEEK_UPSTREAM_URL || ASSISTANT_UPSTREAM_URL;
  var upstreamKey = DEEPSEEK_UPSTREAM_KEY || ASSISTANT_UPSTREAM_KEY;
  if (!upstreamUrl) {
    return res.status(503).json({
      error: "未配置 DEEPSEEK_UPSTREAM_URL（或 ASSISTANT_UPSTREAM_URL）",
    });
  }
  var body = req.body || {};
  if (!body.model) body.model = DEEPSEEK_MODEL || DOUBAO_MODEL || "deepseek-chat";
  return proxyAssistantRequest(res, body, upstreamUrl, upstreamKey);
});

app.get("/api/assistant", function (req, res) {
  return res.status(200).json({
    ok: true,
    message: "该接口仅支持 POST。请以 JSON 请求体调用 /api/assistant。",
  });
});

app.post("/api/weather-assistant", function (req, res) {
  if (!DOUBAO_UPSTREAM_URL) {
    return res.status(503).json({ error: "未配置 DOUBAO_UPSTREAM_URL" });
  }
  var body = req.body || {};
  if (DOUBAO_MODEL) body.model = DOUBAO_MODEL;
  return proxyAssistantRequest(res, body, DOUBAO_UPSTREAM_URL, DOUBAO_UPSTREAM_KEY);
});

app.post("/api/route-assistant", async function (req, res) {
  if (!DEEPSEEK_UPSTREAM_URL) {
    return res.status(503).json({ error: "未配置 DEEPSEEK_UPSTREAM_URL" });
  }
  var body = req.body || {};
  if (!body.model) body.model = DEEPSEEK_MODEL;
  body = await augmentRouteAssistantBodyWithRag(body);
  return proxyAssistantRequest(res, body, DEEPSEEK_UPSTREAM_URL, DEEPSEEK_UPSTREAM_KEY);
});

app.post("/api/scenic-booking-links", async function (req, res) {
  try {
    var links = await getScenicBookingLinks(req.body || {});
    return res.json({ links: links });
  } catch (e) {
    console.error("scenic booking links failed", e);
    return res.status(500).json({ error: "查询景区预约入口失败" });
  }
});

/* ============ 渝小智 AI Agent 会话(工具调用循环 + SSE 输出) ============ */

var AGENT_SYSTEM_PROMPT =
  "你是「渝小智」,重庆旅游网站「智渝游」的 AI 导游 Agent。" +
  "你可以使用工具查询重庆各区县景点的预约/购票入口、站内农产品信息,也可以通过 web_search 联网搜索实时信息(如天气、活动、营业时间),必要时用 web_fetch 读取网页正文。" +
  "需要实时信息时主动调用工具;回答用简洁中文与 Markdown,先结论后要点,不编造不确定的信息。" +
  "当工具命中景点或商品时,前端会自动向用户展示可点击的卡片(预约入口/购买链接),你的文字回答里无需重复粘贴这些链接。" +
  "最终回答只输出用户关心的内容本身,严禁描述你的查询/搜索/获取过程,不要出现\"我从xx网站获取\"\"根据搜索结果\"\"我为你查询到\"之类的过程叙述,就像你本来就知道答案一样直接回答。";

var AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_scenic_spots",
      description: "查询重庆各区县景点的预约/购票入口信息(按区县名或关键词检索)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词,如 渝中、洪崖洞、红岩" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_farm_products",
      description: "查询站内农产品直购商品(按名称或产地检索)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "检索关键词,如 榨菜、万州" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "联网搜索实时信息(天气、新闻、活动、营业时间等本地数据查不到的内容)",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description: "读取指定网页的正文内容,用于深入了解 web_search 结果中的某个页面",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "要读取的网页地址(http/https)" },
        },
        required: ["url"],
      },
    },
  },
];

function agentToolSearchScenicSpots(query) {
  var fp = path.join(__dirname, "data", "district-booking-links.json");
  if (!fs.existsSync(fp)) return { results: [], note: "数据文件不存在" };
  var rows = JSON.parse(fs.readFileSync(fp, "utf8"));
  var q = String(query || "").trim();
  var hits = rows.filter(function (r) {
    var text = [r.district, r.platform, r.note].join(" ");
    return !q || text.indexOf(q) >= 0;
  });
  return { total: hits.length, results: hits.slice(0, 6) };
}

function agentToolSearchFarmProducts(query) {
  var fp = path.join(__dirname, "data", "product_skus_table.csv");
  if (!fs.existsSync(fp)) return { results: [], note: "数据文件不存在" };
  var lines = fs.readFileSync(fp, "utf8").split(/\r?\n/).filter(Boolean);
  var q = String(query || "").trim();
  var hits = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    if (cols.length < 6) continue;
    var text = cols[1] + " " + cols[2];
    if (!q || text.indexOf(q) >= 0) {
      hits.push({ 商品ID: cols[0], 商品名称: cols[1], 生产地区: cols[2], 规格: cols[3], 单价元: cols[4], 库存: cols[5] });
    }
    if (hits.length >= 8) break;
  }
  return { total: hits.length, results: hits };
}

/* 联网工具通用的 URL 安全校验:仅 http/https,域名解析后不得指向内网 */
async function validatePublicHttpUrl(urlString) {
  var u;
  try {
    u = new URL(urlString);
  } catch (e) {
    return { error: "URL 无效" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { error: "仅支持 http/https 链接" };
  }
  var host = u.hostname.toLowerCase();
  if (isPrivateIp(host)) {
    return { error: "不允许访问内网地址" };
  }
  try {
    var looked = await dns.promises.lookup(host);
    if (isPrivateIp(looked.address)) {
      return { error: "不允许访问内网地址" };
    }
  } catch (e) {
    return { error: "域名无法解析" };
  }
  return { url: u };
}

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/* 联网搜索:必应国内版为主(国内网络可达),DuckDuckGo 兜底 */
var SEARCH_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function searchViaBing(q) {
  var resp = await fetch("https://cn.bing.com/search?q=" + encodeURIComponent(q), {
    headers: { "User-Agent": SEARCH_UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return [];
  var html = await resp.text();
  var results = [];
  var blockRe = /<li class="b_algo"[\s\S]*?<\/li>/g;
  var bm;
  while ((bm = blockRe.exec(html)) && results.length < 5) {
    var a = bm[0].match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    var p = bm[0].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({
      title: stripHtmlToText(a[2]).slice(0, 120),
      url: a[1],
      snippet: p ? stripHtmlToText(p[1]).slice(0, 300) : "",
    });
  }
  return results;
}

async function searchViaDuckDuckGo(q) {
  var resp = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), {
    headers: { "User-Agent": SEARCH_UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return [];
  var html = await resp.text();
  var results = [];
  var itemRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  var m;
  while ((m = itemRe.exec(html)) && results.length < 5) {
    var href = m[1];
    var uddg = href.match(/uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    var after = html.slice(m.index, m.index + 3000);
    var snip = after.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    results.push({
      title: stripHtmlToText(m[2]).slice(0, 120),
      url: href,
      snippet: snip ? stripHtmlToText(snip[1]).slice(0, 300) : "",
    });
  }
  return results;
}

async function agentToolWebSearch(query) {
  var q = String(query || "").trim();
  if (!q) return { results: [] };
  var results = [];
  try {
    results = await searchViaBing(q);
  } catch (e) { /* 必应不可用时尝试兜底 */ }
  if (!results.length) {
    try {
      results = await searchViaDuckDuckGo(q);
    } catch (e) { /* 兜底也失败则返回空 */ }
  }
  if (!results.length) return { query: q, results: [], note: "搜索暂时不可用,请稍后重试" };
  return { query: q, results: results };
}

/* 读取网页正文(截断 3000 字) */
async function agentToolWebFetch(url) {
  var checked = await validatePublicHttpUrl(String(url || ""));
  if (checked.error) return { error: checked.error };
  var resp = await fetch(checked.url.href, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!resp.ok) return { error: "页面读取失败(HTTP " + resp.status + ")" };
  var html = (await resp.text()).slice(0, 500000);
  return { url: checked.url.href, content: stripHtmlToText(html).slice(0, 3000) };
}

async function runAgentTool(name, args) {
  try {
    if (name === "search_scenic_spots") return agentToolSearchScenicSpots(args && args.query);
    if (name === "search_farm_products") return agentToolSearchFarmProducts(args && args.query);
    if (name === "web_search") return await agentToolWebSearch(args && args.query);
    if (name === "web_fetch") return await agentToolWebFetch(args && args.url);
    return { error: "未知工具: " + name };
  } catch (e) {
    return { error: "工具执行失败: " + String(e && e.message ? e.message : e) };
  }
}

/* 工具命中后生成给前端渲染的行动卡片(景点预约入口 / 商品购买链接) */
var farmImageDir = path.join(__dirname, "public", "assets", "区县特产图片");
var farmImageFilesCache = null;
function agentFindFarmImage(productName) {
  if (!productName) return "";
  try {
    if (!farmImageFilesCache) {
      farmImageFilesCache = fs.existsSync(farmImageDir) ? fs.readdirSync(farmImageDir) : [];
    }
    var hit = farmImageFilesCache.find(function (f) {
      var base = f.replace(/\.(png|jpe?g|webp|gif)$/i, "");
      return base.indexOf(productName) >= 0 || productName.indexOf(base.split(/[:：]/).pop().replace(/[（(].*$/, "").trim()) >= 0;
    });
    return hit ? "assets/区县特产图片/" + encodeURIComponent(hit) : "";
  } catch (e) {
    return "";
  }
}

function agentBuildCard(toolName, toolResult) {
  if (!toolResult || !Array.isArray(toolResult.results) || !toolResult.results.length) return null;
  if (toolName === "search_scenic_spots") {
    return {
      type: "card",
      cardType: "scenic",
      items: toolResult.results.slice(0, 4).map(function (r) {
        return { district: r.district || "", platform: r.platform || "", note: r.note || "", bookingUrl: r.bookingUrl || "" };
      }),
    };
  }
  if (toolName === "search_farm_products") {
    var seen = new Set();
    var items = [];
    toolResult.results.forEach(function (r) {
      var id = r["商品ID"] || "";
      if (!id || seen.has(id)) return;
      seen.add(id);
      items.push({
        id: id,
        name: r["商品名称"] || "",
        region: r["生产地区"] || "",
        spec: r["规格"] || "",
        price: r["单价元"] || "",
        image: agentFindFarmImage(r["商品名称"] || ""),
      });
    });
    return items.length ? { type: "card", cardType: "product", items: items.slice(0, 8) } : null;
  }
  return null;
}

/* DeepSeek V4 偶发把 DSML 工具调用文本泄漏到 content(上游已知问题),兜底解析为真实工具调用 */
function parseDsmlToolCalls(dsml) {
  var calls = [];
  var invokeRe = /<[｜|]+DSML[｜|]+invoke name="([^"]+)"\s*>([\s\S]*?)<\/[｜|]+DSML[｜|]+invoke>/g;
  var paramRe = /<[｜|]+DSML[｜|]+parameter name="([^"]+)"[^>]*>([\s\S]*?)<\/[｜|]+DSML[｜|]+parameter>/g;
  var m;
  var i = 0;
  while ((m = invokeRe.exec(dsml))) {
    var args = {};
    var pm;
    paramRe.lastIndex = 0;
    while ((pm = paramRe.exec(m[2]))) {
      args[pm[1]] = pm[2].trim();
    }
    // 兼容 "arguments" 单参数包裹 JSON 的情况
    var keys = Object.keys(args);
    if (keys.length === 1 && keys[0] === "arguments") {
      try {
        var inner = JSON.parse(args.arguments);
        if (inner && typeof inner === "object") args = inner;
      } catch (e) { /* 非 JSON 按原样 */ }
    }
    calls.push({ id: "dsml_call_" + i, name: m[1], arguments: JSON.stringify(args) });
    i++;
  }
  return calls;
}

/* 判断文本尾部是否可能是 DSML 起始标记的不完整前缀;返回需要扣住不发的长度 */
var DSML_MARKER_STARTS = [
  "<｜DSML｜tool_calls", "<｜DSML｜invoke",
  "<|DSML|tool_calls", "<|DSML|invoke",
  "<｜｜DSML｜｜tool_calls", "<｜｜DSML｜｜invoke",
  "<||DSML||tool_calls", "<||DSML||invoke",
];
function dsmlHoldLen(text) {
  var idx = text.lastIndexOf("<");
  if (idx < 0) return 0;
  var cand = text.slice(idx);
  for (var i = 0; i < DSML_MARKER_STARTS.length; i++) {
    if (DSML_MARKER_STARTS[i].indexOf(cand) === 0 && cand.length < DSML_MARKER_STARTS[i].length) {
      return cand.length;
    }
  }
  return 0;
}

/* SSRF 防护:已知服务商白名单 + 自定义地址仅允许公网 https */
var AGENT_ALLOWED_HOSTS = new Set(["api.deepseek.com", "api.xiaomimimo.com", "token-plan-cn.xiaomimimo.com"]);

function isPrivateIp(ip) {
  var v4 = ip;
  var mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) v4 = mapped[1];
  var m = v4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    var a = +m[1], b = +m[2];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a >= 224
    );
  }
  return v4 === "::1" || /^f[cd]/i.test(v4) || /^fe80/i.test(v4);
}

async function resolveAgentUpstream(baseURL) {
  var u;
  try {
    u = new URL(baseURL);
  } catch (e) {
    return { error: "Base URL 无效" };
  }
  var host = u.hostname.toLowerCase();
  if (!AGENT_ALLOWED_HOSTS.has(host)) {
    if (u.protocol !== "https:") {
      return { error: "自定义接口仅允许 https" };
    }
    if (isPrivateIp(host)) {
      return { error: "不允许访问内网地址" };
    }
    try {
      var looked = await dns.promises.lookup(host);
      if (isPrivateIp(looked.address)) {
        return { error: "不允许访问内网地址" };
      }
    } catch (e) {
      return { error: "Base URL 域名无法解析" };
    }
  }
  var url = /\/chat\/completions\/?$/i.test(baseURL)
    ? baseURL
    : baseURL.replace(/\/+$/, "") + "/chat/completions";
  return { url: url };
}

function agentSseSend(res, obj) {
  res.write("data: " + JSON.stringify(obj) + "\n\n");
}

/* Agent 上游配置存服务端 data/(不暴露到公网),仅管理员可读写 */
var AGENT_CONFIG_FILE = path.join(__dirname, "data", "agent-config.json");

function loadAgentConfig() {
  try {
    var c = JSON.parse(fs.readFileSync(AGENT_CONFIG_FILE, "utf8"));
    if (c && typeof c === "object" && !Array.isArray(c)) return c;
  } catch (e) { /* 文件不存在或损坏时按未配置处理 */ }
  return {};
}

function saveAgentConfig(cfg) {
  fs.writeFileSync(AGENT_CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

app.get("/api/admin/agent-config", authMiddleware, adminMiddleware, function (req, res) {
  var c = loadAgentConfig();
  res.json({
    baseURL: String(c.baseURL || ""),
    apiKey: String(c.apiKey || ""),
    model: String(c.model || ""),
  });
});

app.post("/api/admin/agent-config", authMiddleware, adminMiddleware, async function (req, res) {
  var b = req.body || {};
  var baseURL = String(b.baseURL || "").trim();
  var apiKey = String(b.apiKey || "").trim();
  var model = String(b.model || "").trim();
  if (baseURL) {
    if (!/^https?:\/\//i.test(baseURL)) {
      return res.status(400).json({ error: "Base URL 仅支持 http(s)" });
    }
    var resolved = await resolveAgentUpstream(baseURL);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
  }
  saveAgentConfig({ baseURL: baseURL, apiKey: apiKey, model: model });
  res.json({ ok: true });
});

app.post("/api/agent-chat", authMiddleware, async function (req, res) {
  var body = req.body || {};
  // 上游配置只认服务端存储/环境变量,不接受客户端传入,防止 Key 泄露与 SSRF
  var saved = loadAgentConfig();
  var baseURL = String(saved.baseURL || "").trim();
  var apiKey = String(saved.apiKey || "").trim();
  var model = String(saved.model || "").trim();

  var upstreamUrl;
  if (baseURL) {
    if (!/^https?:\/\//i.test(baseURL)) {
      return res.status(400).json({ error: "Base URL 仅支持 http(s)" });
    }
    var resolved = await resolveAgentUpstream(baseURL);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    upstreamUrl = resolved.url;
  } else {
    upstreamUrl = DEEPSEEK_UPSTREAM_URL || ASSISTANT_UPSTREAM_URL;
    if (!apiKey) apiKey = DEEPSEEK_UPSTREAM_KEY || ASSISTANT_UPSTREAM_KEY;
    if (!model) model = DEEPSEEK_MODEL || "deepseek-chat";
  }
  if (!upstreamUrl) {
    return res.status(503).json({ error: "AI 会话未配置模型接口,请联系管理员在设置中配置" });
  }
  if (!model) model = "deepseek-chat";

  var userMessages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  userMessages = userMessages.filter(function (m) {
    return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
  }).map(function (m) {
    return { role: m.role, content: m.content.slice(0, 4000) };
  });
  if (!userMessages.length) {
    return res.status(400).json({ error: "messages 不能为空" });
  }

  var messages = [{ role: "system", content: AGENT_SYSTEM_PROMPT }].concat(userMessages);

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  var headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = "Bearer " + apiKey;

  try {
    // Agent 循环(harness 模式):上游流式输出,思考过程实时转发;若拼装出 tool_calls 则执行工具并续写
    // 最多 5 轮工具调用;第 6 轮不再提供工具,强制模型基于已有信息给出最终回答
    var finalContent = "";
    var sentCards = new Set(); // 同一请求内相同卡片只推一次,避免重复渲染
    for (var iter = 0; iter < 6; iter++) {
      var noMoreTools = iter === 5;
      var reqBody = { model: model, messages: messages, stream: true };
      if (!noMoreTools) reqBody.tools = AGENT_TOOLS;
      var upstreamRes = await fetch(upstreamUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(reqBody),
      });
      if (!upstreamRes.ok) {
        await upstreamRes.text(); // 消费响应体,但不把上游错误原文回传给前端
        console.error("agent-chat upstream error", upstreamRes.status);
        agentSseSend(res, { type: "error", message: "模型接口返回错误(HTTP " + upstreamRes.status + "),请检查 API Key 与模型配置" });
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      // 逐行读取上游 SSE:content 增量即时转发,tool_calls 分片按 index 拼装
      var roundContent = "";
      var toolCallsAcc = [];
      var sseBuf = "";
      var dsmlBuf = "";      // 收集泄漏到 content 的 DSML 工具调用文本
      var dsmlMode = false;
      var pendingPlain = ""; // 待确认的普通文本(尾部可能是不完整的 DSML 起始标记)
      var sseDecoder = new TextDecoder("utf-8");
      for await (var rawChunk of upstreamRes.body) {
        sseBuf += sseDecoder.decode(rawChunk, { stream: true });
        var lines = sseBuf.split("\n");
        sseBuf = lines.pop(); // 最后一段可能不完整,留到下次拼接
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li].trim();
          if (line.indexOf("data:") !== 0) continue;
          var payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          var evJson;
          try { evJson = JSON.parse(payload); } catch (e) { continue; }
          var delta = evJson.choices && evJson.choices[0] && evJson.choices[0].delta;
          if (!delta) continue;
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content) {
            // 模型的真实思考过程(deepseek 风格,过程态展示)
            agentSseSend(res, { type: "thinking", content: delta.reasoning_content });
          }
          if (typeof delta.content === "string" && delta.content) {
            if (dsmlMode) {
              dsmlBuf += delta.content;
            } else {
              pendingPlain += delta.content;
              // 检测 DSML 起始标记(可能缺 tool_calls 外层,直接以 invoke 开头)
              var dsmlIdx = pendingPlain.search(/<[｜|]+DSML[｜|]+(?:tool_calls|invoke)/);
              if (dsmlIdx >= 0) {
                var plain = pendingPlain.slice(0, dsmlIdx);
                if (plain) {
                  roundContent += plain;
                  agentSseSend(res, { type: "thinking", content: plain, answer: true });
                }
                dsmlBuf = pendingPlain.slice(dsmlIdx);
                dsmlMode = true;
                pendingPlain = "";
              } else {
                var emitLen = pendingPlain.length - dsmlHoldLen(pendingPlain);
                if (emitLen > 0) {
                  var out = pendingPlain.slice(0, emitLen);
                  roundContent += out;
                  // answer:true 标记这是正文(区别于 reasoning 思考),本轮是否最终回答要等流结束才知道
                  agentSseSend(res, { type: "thinking", content: out, answer: true });
                  pendingPlain = pendingPlain.slice(emitLen);
                }
              }
            }
          }
          if (Array.isArray(delta.tool_calls)) {
            delta.tool_calls.forEach(function (tc) {
              var idx = typeof tc.index === "number" ? tc.index : 0;
              if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: "", name: "", arguments: "" };
              if (tc.id) toolCallsAcc[idx].id += tc.id;
              if (tc.function) {
                if (tc.function.name) toolCallsAcc[idx].name += tc.function.name;
                if (tc.function.arguments) toolCallsAcc[idx].arguments += tc.function.arguments;
              }
            });
          }
        }
      }

      // 流结束:处理 DSML 泄漏(解析为结构化工具调用)或把扣住的普通文本发完
      if (dsmlMode) {
        var dsmlCalls = parseDsmlToolCalls(dsmlBuf);
        for (var di = 0; di < dsmlCalls.length; di++) {
          toolCallsAcc.push(dsmlCalls[di]);
        }
      } else if (pendingPlain) {
        roundContent += pendingPlain;
        agentSseSend(res, { type: "thinking", content: pendingPlain, answer: true });
        pendingPlain = "";
      }

      var roundCalls = toolCallsAcc.filter(Boolean);
      if (!roundCalls.length || noMoreTools) {
        finalContent = roundContent;
        agentSseSend(res, { type: "commit_answer" }); // 无工具调用:本轮思考内容转正为最终回答
        break;
      }
      agentSseSend(res, { type: "clear_thinking" }); // 有工具调用:本轮只是中间思考,清掉

      messages.push({
        role: "assistant",
        content: roundContent || null,
        tool_calls: roundCalls.map(function (tc) {
          return { id: tc.id, type: "function", function: { name: tc.name, arguments: tc.arguments } };
        }),
      });

      for (var ci = 0; ci < roundCalls.length; ci++) {
        var call = roundCalls[ci];
        var fname = call.name;
        agentSseSend(res, { type: "tool_start", name: fname });
        var fargs = {};
        try {
          fargs = JSON.parse(call.arguments || "{}");
        } catch (e) { /* 参数解析失败按空参数处理 */ }
        var toolResult = await runAgentTool(fname, fargs);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult).slice(0, 4000),
        });
        agentSseSend(res, { type: "tool_done", name: fname });
        var card = agentBuildCard(fname, toolResult);
        if (card) {
          var cardKey = JSON.stringify(card);
          if (!sentCards.has(cardKey)) {
            sentCards.add(cardKey);
            agentSseSend(res, card);
          }
        }
      }
    }

    res.write("data: [DONE]\n\n");
    return res.end();
  } catch (e) {
    console.error("agent-chat upstream connect failed", e && e.message ? e.message : e);
    agentSseSend(res, { type: "error", message: "无法连接模型接口,请稍后重试" });
    res.write("data: [DONE]\n\n");
    return res.end();
  }
});

var ASSETS_ROOT = path.join(__dirname, "public", "assets");
var HOME_ASSET_DIRS = new Set([
  "首页酒店",
  "首页景区",
  "首页酒店和景区",
  "首页轮播图",
  "天气卡片晴天",
  "天气卡片阴天",
  "天气卡片雨天",
]);

function isImageFilename(name) {
  return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name);
}

/** 列出目录下所有图片（含子文件夹），返回以 assets/ 开头的 URL 路径（正斜杠） */
function listImageUrlsUnderAssetsDir(dirKey) {
  var out = [];
  var rootAbs = path.join(ASSETS_ROOT, dirKey);
  var rootResolved = path.resolve(rootAbs);
  var assetsResolved = path.resolve(ASSETS_ROOT);
  /** Windows 上盘符大小写不一致时 startsWith 会误判，改用 path.relative */
  var relToAssets = path.relative(assetsResolved, rootResolved);
  if (
    relToAssets.startsWith("..") ||
    path.isAbsolute(relToAssets) ||
    (relToAssets !== "" && relToAssets.split(path.sep)[0] === "..")
  ) {
    return out;
  }
  if (!fs.existsSync(rootAbs)) {
    return out;
  }
  function walk(absDir, relSegs) {
    var entries = fs.readdirSync(absDir, { withFileTypes: true });
    entries.forEach(function (e) {
      if (e.name === "." || e.name === "..") return;
      var abs = path.join(absDir, e.name);
      var nextSegs = relSegs.concat([e.name]);
      if (e.isDirectory()) {
        walk(abs, nextSegs);
      } else if (e.isFile() && isImageFilename(e.name)) {
        out.push("assets/" + nextSegs.join("/").split(path.sep).join("/"));
      }
    });
  }
  walk(rootAbs, [dirKey]);
  out.sort();
  return out;
}

/**
 * GET /api/home-asset-images?dir=首页酒店
 * 仅允许白名单内的单层目录名，防止路径穿越。
 */
app.get("/api/home-asset-images", function (req, res) {
  var dirKey = String(req.query.dir || "").trim().replace(/\\/g, "/");
  if (!dirKey || dirKey.indexOf("/") >= 0 || dirKey.indexOf("..") >= 0) {
    return res.status(400).json({ error: "参数 dir 无效" });
  }
  if (!HOME_ASSET_DIRS.has(dirKey)) {
    return res.status(400).json({ error: "目录不在允许列表" });
  }
  try {
    return res.json({ urls: listImageUrlsUnderAssetsDir(dirKey) });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

/* 简洁 URL:/vr 直达 public/vr.html;旧 /vr.html 带查询参数 301 跳转到新地址 */
app.get("/:page.html", function (req, res, next) {
  var page = req.params.page;
  if (!/^[a-z0-9-]+$/i.test(page)) return next();
  var qs = req.originalUrl.indexOf("?") >= 0 ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  res.redirect(301, "/" + page + qs);
});
app.get("/:page", function (req, res, next) {
  var page = req.params.page;
  if (!/^[a-z0-9-]+$/i.test(page)) return next();
  var fp = path.join(__dirname, "public", page + ".html");
  if (fs.existsSync(fp)) return res.sendFile(fp);
  next();
});

/* 仅暴露 public/ 下的前端资源,server.js、scripts/、data/ 等不再可通过 HTTP 下载 */
app.use(express.static(path.join(__dirname, "public")));

/* 前端需要读取的景点预约入口数据(仅这一个文件,data/ 目录整体不暴露) */
app.get("/data/district-booking-links.json", function (req, res) {
  res.sendFile(path.join(__dirname, "data", "district-booking-links.json"));
});

app.use(function (req, res) {
  if (req.path.indexOf("/api") === 0) {
    return res.status(404).json({ error: "接口不存在" });
  }
  res.status(404).send("Not found");
});

async function startServer() {
  if (!DB_USER) {
    console.error("未配置 DB_USER，请在 .env.local 中设置 MySQL 连接信息。");
    process.exit(1);
  }
  if (!JWT_SECRET) {
    console.error("未配置 JWT_SECRET，请在 .env.local 中设置随机密钥。");
    process.exit(1);
  }
  if (!ADMIN_PHONE) {
    console.warn("提示: 未配置 ADMIN_PHONE, 管理员接口当前无人可用。");
  }
  try {
    await ensureUsersTable();
    await ensureUserDataTables();
  } catch (e) {
    console.error("MySQL 连接或建表失败:", e && e.message ? e.message : e);
    process.exit(1);
  }
  app.listen(PORT, function () {
    console.log("智渝游服务已启动: http://localhost:" + PORT);
    console.log("用户数据已使用 MySQL 数据库: " + DB_NAME + " @ " + DB_HOST);
    console.log("请通过上述地址访问站点（勿直接用 file:// 打开 HTML，否则无法调用登录接口）。");
  });
}

startServer();
