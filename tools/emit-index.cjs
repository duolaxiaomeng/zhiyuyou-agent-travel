"use strict";
var fs = require("fs");
var path = require("path");

// All non-ASCII as \uXXXX so this file stays ASCII-only for reliable tooling.
var html =
  '<!DOCTYPE html>\n' +
  '<html lang="zh-CN">\n' +
  '<head>\n' +
  '  <meta charset="UTF-8" />\n' +
  '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n' +
  '  <meta name="description" content="\u667a\u6e1d\u6e38 - \u91cd\u5e86\u4e61\u9547\u6587\u65c5\u667a\u6167\u670d\u52a1\u5e73\u53f0" />\n' +
  '  <title>\u667a\u6e1d\u6e38 \u00b7 \u9996\u9875</title>\n' +
  '  <link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
  '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
  '  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet" />\n' +
  '  <link rel="stylesheet" href="css/main.css" />\n' +
  '</head>\n' +
  '<body>\n' +
  '  <a class="skip-link" href="#main">\u8df3\u5230\u4e3b\u8981\u5185\u5bb9</a>\n' +
  '  <header class="site-header">\n' +
  '    <div class="header-inner">\n' +
  '      <a class="logo" href="index.html" aria-label="\u667a\u6e1d\u6e38\u9996\u9875">\n' +
  '        <span class="logo-mark" aria-hidden="true">\u667a</span>\n' +
  '        <span class="logo-text">\u667a\u6e1d\u6e38</span>\n' +
  '      </a>\n' +
  '      <button type="button" class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="siteNav" aria-label="\u6253\u5f00\u83dc\u5355">\n' +
  '        <span class="nav-toggle-bar"></span>\n' +
  '        <span class="nav-toggle-bar"></span>\n' +
  '        <span class="nav-toggle-bar"></span>\n' +
  '      </button>\n' +
  '      <nav class="site-nav" id="siteNav" aria-label="\u4e3b\u5bfc\u822a">\n' +
  '        <ul class="nav-list">\n' +
  '          <li><a data-page="index.html" href="index.html">\u9996\u9875</a></li>\n' +
  '          <li><a data-page="planner.html" href="planner.html">AI\u8def\u7ebf\u89c4\u5212</a></li>\n' +
  '          <li><a data-page="ar.html" href="ar.html">AR\u5bfc\u89c8</a></li>\n' +
  '          <li><a data-page="shop.html" href="shop.html">\u519c\u4ea7\u54c1\u76f4\u8d2d</a></li>\n' +
  '          <li><a data-page="guide.html" href="guide.html">\u653b\u7565\u4e2d\u5fc3</a></li>\n' +
  '        </ul>\n' +
  '        <div class="nav-user" id="navUser"></div>\n' +
  '      </nav>\n' +
  '    </div>\n' +
  '  </header>\n' +
  '\n' +
  '  <main id="main">\n' +
  '    <section class="hero hero--carousel" aria-roledescription="\u7126\u70b9\u8f6e\u64ad">\n' +
  '      <div class="hero-carousel" id="heroCarousel" role="region" aria-label="\u9996\u9875\u56fe\u7247\u8f6e\u64ad" aria-live="polite">\n' +
  '        <!-- \u8f6e\u64ad\u56fe\u4e3a\u672c\u673a\u300c\u56fe\u7247\u300d\u76ee\u5f55\u5185\u6309\u4fee\u6539\u65f6\u95f4\u6700\u65b0\u7684 6 \u5f20\uff0c\u5df2\u590d\u5236\u5230 assets/hero/slide-01\uff5e06.png -->\n' +
  '        <div class="hero-slides">\n' +
  '          <article class="hero-slide is-active" data-slide="0" aria-hidden="false">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-01.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 1 \u5f20" width="1920" height="1080" loading="eager" fetchpriority="high" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">\u91cd\u5e86 \u00b7 \u4e61\u9547\u6587\u65c5\u5e73\u53f0</p>\n' +
  '                <h1 id="hero-title" class="hero-title">\u667a\u6e1d\u6e38</h1>\n' +
  '                <p class="hero-lead">\u5c71\u6c34\u6c5f\u57ce\u4e3a\u5e55\uff0c\u4e32\u8054 AI \u667a\u6167\u884c\u7a0b\u3001AR \u6c89\u6d78\u8bb2\u89e3\u4e0e\u4e61\u6101\u597d\u7269\uff0c\u4e00\u90e8\u624b\u673a\u901b\u904d\u5df4\u6e1d\u4e61\u9547\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="planner.html">\u4f53\u9a8c AI \u8def\u7ebf</a>\n' +
  '                  <a class="btn btn-ghost" href="register.html">\u6ce8\u518c\u8d26\u53f7</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '\n' +
  '          <article class="hero-slide" data-slide="1" aria-hidden="true">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-02.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 2 \u5f20" width="1920" height="1080" loading="lazy" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">\u53e4\u9547\u4eba\u6587</p>\n' +
  '                <h2 class="hero-title hero-title--sub">\u77f3\u677f\u5df7\u91cc\u7684\u6162\u65f6\u5149</h2>\n' +
  '                <p class="hero-lead">\u9752\u74e6\u540a\u811a\u3001\u620f\u53f0\u8336\u9986\uff0c\u5728\u6d9e\u6ee9\u4e0e\u6e4f\u6c34\u8bfb\u61c2\u5df4\u6e1d\u5546\u8d38\u4e0e\u6c11\u4fd7\u8bb0\u5fc6\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="guide.html">\u770b\u653b\u7565\u7cbe\u9009</a>\n' +
  '                  <a class="btn btn-ghost" href="planner.html">\u751f\u6210\u8def\u7ebf</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '\n' +
  '          <article class="hero-slide" data-slide="2" aria-hidden="true">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-03.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 3 \u5f20" width="1920" height="1080" loading="lazy" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">AI \u52a8\u6001\u8def\u7ebf</p>\n' +
  '                <h2 class="hero-title hero-title--sub">\u504f\u597d\u9a71\u52a8\uff0c\u5b9e\u65f6\u7ea0\u504f</h2>\n' +
  '                <p class="hero-lead">\u7ed3\u5408\u5929\u6c14\u3001\u62e5\u5835\u4e0e\u666f\u533a\u627f\u8f7d\uff0c\u4eb2\u5b50\u3001\u6444\u5f71\u3001\u5f92\u6b65\u4e00\u952e\u5339\u914d\uff0c\u66b4\u96e8\u5927\u5ba2\u6d41\u4e5f\u80fd\u91cd\u6392\u53ef\u73a9\u6027\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="planner.html">\u53bb\u89c4\u5212\u884c\u7a0b</a>\n' +
  '                  <a class="btn btn-ghost" href="guide.html">\u4e3b\u9898\u8def\u7ebf\u793a\u4f8b</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '\n' +
  '          <article class="hero-slide" data-slide="3" aria-hidden="true">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-04.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 4 \u5f20" width="1920" height="1080" loading="lazy" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">AR \u6c89\u6d78\u5bfc\u89c8</p>\n' +
  '                <h2 class="hero-title hero-title--sub">\u8bc6\u666f\u3001\u8bfb\u53f2\u3001\u53ef\u65cb\u8f6c</h2>\n' +
  '                <p class="hero-lead">\u9ad8\u7cbe\u5ea6\u6a21\u578b\u9884\u89c8\u53e0\u52a0\u5178\u6545\u89e3\u8bf4\uff0c\u8ba9\u5efa\u7b51\u4e0e\u975e\u9057\u4ece\u300c\u770b\u4e00\u773c\u300d\u53d8\u6210\u300c\u8bfb\u5f97\u61c2\u300d\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="ar.html">\u6253\u5f00 AR \u5bfc\u89c8</a>\n' +
  '                  <a class="btn btn-ghost" href="guide.html">\u6587\u5316\u4f53\u9a8c</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '\n' +
  '          <article class="hero-slide" data-slide="4" aria-hidden="true">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-05.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 5 \u5f20" width="1920" height="1080" loading="lazy" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">\u4e61\u6101\u76f4\u8d2d</p>\n' +
  '                <h2 class="hero-title hero-title--sub">\u4ea7\u5730\u597d\u5473\uff0c\u4e00\u952e\u5230\u5bb6</h2>\n' +
  '                <p class="hero-lead">\u69a8\u83dc\u3001\u8702\u871c\u3001\u65b9\u7af9\u7b0d\u2026\u2026\u91cd\u5e86\u4e61\u9547\u519c\u7279\u4ea7\u54c1\u76f4\u8d2d\u6f14\u793a\uff0c\u628a\u65c5\u9014\u4f59\u6e29\u7559\u5728\u9910\u684c\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="shop.html">\u901b\u4e61\u6101\u76f4\u8d2d</a>\n' +
  '                  <a class="btn btn-ghost" href="register.html">\u6ce8\u518c\u9009\u8d2d</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '\n' +
  '          <article class="hero-slide" data-slide="5" aria-hidden="true">\n' +
  '            <div class="hero-slide-media">\n' +
  '              <img src="assets/hero/slide-06.png" alt="\u76f8\u518c\u7cbe\u9009\u7b2c 6 \u5f20" width="1920" height="1080" loading="lazy" decoding="async" />\n' +
  '            </div>\n' +
  '            <div class="hero-slide-panel">\n' +
  '              <div class="hero-slide-inner">\n' +
  '                <p class="hero-eyebrow">\u5f71\u50cf\u4e0e\u56de\u5fc6</p>\n' +
  '                <h2 class="hero-title hero-title--sub">\u6bcf\u4e00\u7a0b\u90fd\u503c\u5f97\u88ab\u8bb0\u4f4f</h2>\n' +
  '                <p class="hero-lead">\u628a\u8def\u4e0a\u7684\u5149\u5f71\u6536\u8fdb\u667a\u6e1d\u6e38\uff0c\u4e0b\u6b21\u51fa\u53d1\u65f6\uff0c\u8ba9 AI \u4e0e AR \u5e26\u4f60\u89e3\u9501\u66f4\u591a\u5df4\u6e1d\u4e61\u9547\u6545\u4e8b\u3002</p>\n' +
  '                <div class="hero-actions">\n' +
  '                  <a class="btn btn-primary" href="guide.html">\u6d4f\u89c8\u653b\u7565\u4e2d\u5fc3</a>\n' +
  '                  <a class="btn btn-ghost" href="planner.html">\u89c4\u5212\u4e0b\u4e00\u7a0b</a>\n' +
  '                </div>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          </article>\n' +
  '        </div>\n' +
  '\n' +
  '        <div class="hero-carousel-controls" aria-hidden="false">\n' +
  '          <button type="button" class="hero-carousel-btn hero-carousel-btn--prev" aria-label="\u4e0a\u4e00\u5f20">\u2039</button>\n' +
  '          <button type="button" class="hero-carousel-btn hero-carousel-btn--next" aria-label="\u4e0b\u4e00\u5f20">\u203a</button>\n' +
  '          <div class="hero-dots" role="tablist" aria-label="\u9009\u62e9\u8f6e\u64ad\u56fe\u7247">\n' +
  '            <button type="button" class="hero-dot is-active" role="tab" aria-selected="true" aria-label="\u7b2c 1 \u5f20"></button>\n' +
  '            <button type="button" class="hero-dot" role="tab" aria-selected="false" aria-label="\u7b2c 2 \u5f20"></button>\n' +
  '            <button type="button" class="hero-dot" role="tab" aria-selected="false" aria-label="\u7b2c 3 \u5f20"></button>\n' +
  '            <button type="button" class="hero-dot" role="tab" aria-selected="false" aria-label="\u7b2c 4 \u5f20"></button>\n' +
  '            <button type="button" class="hero-dot" role="tab" aria-selected="false" aria-label="\u7b2c 5 \u5f20"></button>\n' +
  '            <button type="button" class="hero-dot" role="tab" aria-selected="false" aria-label="\u7b2c 6 \u5f20"></button>\n' +
  '          </div>\n' +
  '        </div>\n' +
  '      </div>\n' +
  '\n' +
  '      <div class="hero-stats-wrap">\n' +
  '        <div class="hero-stats" role="list">\n' +
  '          <div class="stat" role="listitem"><span class="stat-num">120+</span><span class="stat-label">\u7279\u8272\u4e61\u9547</span></div>\n' +
  '          <div class="stat" role="listitem"><span class="stat-num">24h</span><span class="stat-label">\u52a8\u6001\u6001\u52bf\u66f4\u65b0</span></div>\n' +
  '          <div class="stat" role="listitem"><span class="stat-num">AR</span><span class="stat-label">\u6c89\u6d78\u5bfc\u89c8</span></div>\n' +
  '        </div>\n' +
  '      </div>\n' +
  '    </section>\n' +
  '\n' +
  '    <section class="section">\n' +
  '      <div class="container">\n' +
  '        <header class="section-head">\n' +
  '          <h2 class="section-title">\u6838\u5fc3\u529f\u80fd\u5df2\u62c6\u5206\u72ec\u7acb\u9875\u9762</h2>\n' +
  '          <p class="section-desc">\u901a\u8fc7\u5bfc\u822a\u680f\u8df3\u8f6c\u5230\u4e13\u95e8\u9875\u9762\uff0c\u7ed3\u6784\u66f4\u6e05\u6670\u3002\u767b\u5f55\u4e0e\u6ce8\u518c\u5df2\u5bf9\u63a5 Node \u63a5\u53e3\uff08\u672c\u5730\u6f14\u793a\uff09\u3002</p>\n' +
  '        </header>\n' +
  '        <div class="feature-links">\n' +
  '          <a class="feature-link-card" href="planner.html"><strong>AI\u52a8\u6001\u8def\u7ebf\u89c4\u5212</strong><p>\u9700\u767b\u5f55\u540e\u8bbf\u95ee\uff0c\u542b\u504f\u597d\u4e0e\u5b9e\u65f6\u6001\u52bf\u6f14\u793a\u3002</p></a>\n' +
  '          <a class="feature-link-card" href="ar.html"><strong>AR\u5bfc\u822a\u4e0e\u6c89\u6d78\u5f0f\u4f53\u9a8c</strong><p>3D\u6a21\u578b\u9884\u89c8\u4e0e\u8bc6\u666f\u6545\u4e8b\u53e0\u52a0\u3002</p></a>\n' +
  '          <a class="feature-link-card" href="shop.html"><strong>\u519c\u4ea7\u54c1\u76f4\u8d2d</strong><p>\u4e61\u9547\u519c\u7279\u4ea7\u54c1\u76f4\u8d2d\uff0c\u6f14\u793a\u8d2d\u7269\u8f66\u3002</p></a>\n' +
  '        </div>\n' +
  '      </div>\n' +
  '    </section>\n' +
  '  </main>\n' +
  '\n' +
  '  <footer class="site-footer">\n' +
  '    <div class="container footer-inner">\n' +
  '      <p class="footer-brand">\u667a\u6e1d\u6e38</p>\n' +
  '      <p class="footer-note">\u8bf7\u4f7f\u7528 Node \u670d\u52a1\u8bbf\u95ee\u672c\u7ad9\uff1bAI \u52a9\u624b\u56de\u590d\u7531\u670d\u52a1\u7aef\u8f6c\u53d1\u81f3\u4f60\u914d\u7f6e\u7684\u6a21\u578b\u63a5\u53e3\u3002</p>\n' +
  '      <p class="footer-copy">\u00a9 2026</p>\n' +
  '    </div>\n' +
  '  </footer>\n' +
  '\n' +
  '  <script src="js/auth-client.js"></script>\n' +
  '  <script src="js/main.js" defer></script>\n' +
  '  <script src="js/hero-carousel.js" defer></script>\n' +
  '  <script src="js/float-ai.js" defer></script>\n' +
  '</body>\n' +
  '</html>\n';

var out = path.join(__dirname, "..", "index.html");
fs.writeFileSync(out, html, "utf8");
console.log("Wrote", out);
