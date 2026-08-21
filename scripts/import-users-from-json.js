"use strict";
/**
 * 一次性：从备份 JSON 将账号写入 MySQL `users` 表（存在则按手机号更新昵称与密码哈希）。
 * 用法: node scripts/import-users-from-json.js [json路径]
 */
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

if (!process.argv[2]) {
  console.error("用法: node scripts/import-users-from-json.js <账号备份.json>");
  process.exit(1);
}
var jsonPath = path.resolve(process.cwd(), process.argv[2]);

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

var UPSERT_SQL =
    "INSERT INTO users (username, phone, password_hash) VALUES (?, ?, ?) " +
    "ON DUPLICATE KEY UPDATE username = VALUES(username), " +
    "password_hash = VALUES(password_hash)";

async function main() {
  if (!DB_USER) {
    console.error("未配置 DB_USER，请在 .env.local 中填写 MySQL。");
    process.exit(1);
  }
  if (!fs.existsSync(jsonPath)) {
    console.error("文件不存在:", jsonPath);
    process.exit(1);
  }
  var raw = fs.readFileSync(jsonPath, "utf8");
  var list = JSON.parse(raw);
  if (!Array.isArray(list)) {
    console.error("JSON 应为数组");
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
  await pool.execute(USERS_DDL);
  var ok = 0;
  var skip = 0;
  for (var i = 0; i < list.length; i++) {
    var u = list[i];
    var username = (u && u.username && String(u.username).trim()) || "";
    var phone = (u && u.phone && String(u.phone).trim()) || "";
    var passwordHash =
        (u && u.passwordHash && String(u.passwordHash).trim()) || "";
    if (!username || !/^\d{11}$/.test(phone) || !passwordHash) {
      console.warn("跳过无效行:", u);
      skip++;
      continue;
    }
    await pool.execute(UPSERT_SQL, [username, phone, passwordHash]);
    ok++;
  }
  await pool.end();
  console.log("已写入数据库 travel.users，处理成功 " + ok + " 条，跳过 " + skip + " 条。");
  console.log("数据源:", jsonPath);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
