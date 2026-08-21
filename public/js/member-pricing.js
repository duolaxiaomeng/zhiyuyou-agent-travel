(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function boot() {
    var hint = $("memberPricingLoginHint");
    var msg = $("memberPricingMsg");
    var grid = $("memberPricingGrid");
    var M = window.ZYYMember;

    if (!M) {
      if (msg) msg.textContent = "会员模块未加载。";
      return;
    }

    var phone = M.getPhone && M.getPhone();
    if (!phone) {
      if (hint) {
        hint.innerHTML =
          '请先 <a href="login?redirect=' +
          encodeURIComponent("member-pricing") +
          '">登录</a> 后再开通会员。';
      }
      if (grid) {
        grid.querySelectorAll(".member-plan__btn").forEach(function (btn) {
          btn.disabled = true;
        });
      }
      return;
    }

    if (hint) {
      hint.textContent = "当前账号：" + phone + "，选择套餐后点击「立即开通」。";
    }

    grid.querySelectorAll(".member-plan__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var plan = btn.getAttribute("data-plan");
        if (!plan || !M.setMemberPlan) return;
        if (!window.confirm("确认开通所选套餐？")) return;
        var ret = M.setMemberPlan(plan);
        function onResult(r) {
          if (r && r.ok) {
            var sum = M.getStatusSummary();
            if (msg) {
              msg.textContent =
                  "开通成功！会员有效期至 " +
                  (sum.untilText || "") +
                  "。可前往 VR 导览无限次体验。";
            }
          } else {
            if (msg) msg.textContent = (r && r.error) || "开通失败，请重试。";
          }
        }
        if (ret && typeof ret.then === "function") {
          ret.then(onResult).catch(function () {
            if (msg) msg.textContent = "开通失败，请重试。";
          });
        } else {
          onResult(ret);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
