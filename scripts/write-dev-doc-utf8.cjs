"use strict";
var fs = require("fs");
var path = require("path");
var doc = require("./dev_document_utf8_source.js");
var out = path.join(__dirname, "..", "data", "3 （初版）软件应用与开发类作品设计和开发文档.txt");
fs.writeFileSync(out, "\uFEFF" + doc, { encoding: "utf8" });
console.log("OK:", out, "bytes:", Buffer.byteLength("\uFEFF" + doc, "utf8"));
