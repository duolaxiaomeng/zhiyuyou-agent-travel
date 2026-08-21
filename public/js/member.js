(function (global) {
  "use strict";

  var FREE_AR_TRIALS = 3;
  /** 当前登录用户在服务端的状态缓存 */
  var memCache = { arUsed: 0, memberUntil: null };

  function getPhone() {
    if (!global.ZYYAuth || typeof global.ZYYAuth.getStoredUser !== "function") return "";
    var u = global.ZYYAuth.getStoredUser();
    return u && u.phone ? String(u.phone).trim() : "";
  }

  function getStateForPhone(phone) {
    if (!phone || phone !== getPhone()) return { arUsed: 0, memberUntil: null };
    return {
      arUsed: typeof memCache.arUsed === "number" && !isNaN(memCache.arUsed) ? Math.max(0, memCache.arUsed) : 0,
      memberUntil: memCache.memberUntil || null,
    };
  }

  function parseUntil(iso) {
    if (!iso) return null;
    var t = new Date(iso).getTime();
    return isNaN(t) ? null : t;
  }

  function isMemberActiveForPhone(phone) {
    var t = parseUntil(getStateForPhone(phone).memberUntil);
    if (!t) return false;
    return Date.now() < t;
  }

  /**
   * @returns {{ ok: boolean, needLogin?: boolean, needMember?: boolean, remaining?: number, message: string }}
   */
  function canUseAr() {
    var phone = getPhone();
    if (!phone) {
      return { ok: false, needLogin: true, message: "请先登录后再使用 VR 导览。登录用户可免费体验 " + FREE_AR_TRIALS + " 次。" };
    }
    if (isMemberActiveForPhone(phone)) {
      return { ok: true, message: "会员权益：VR 导览不限次数（当前会员有效期内）。" };
    }
    var st = getStateForPhone(phone);
    var used = st.arUsed;
    if (used < FREE_AR_TRIALS) {
      return {
        ok: true,
        remaining: FREE_AR_TRIALS - used,
        message: "免费体验剩余 " + (FREE_AR_TRIALS - used) + " 次（共 " + FREE_AR_TRIALS + " 次）。",
      };
    }
    return {
      ok: false,
      needMember: true,
      message: "免费体验次数已用完，开通会员后可继续使用 VR 导览。",
    };
  }

  function notifyMemberUi() {
    try {
      global.dispatchEvent(new CustomEvent("zyy-member-state-updated"));
    } catch (e) {}
  }

  /** 每次成功加载景点模型记 1 次（会员不计次，服务端 IF 跳过） */
  function recordArUse() {
    var phone = getPhone();
    if (!phone) return;
    if (isMemberActiveForPhone(phone)) return;
    var UD = global.ZYYUserData;
    if (!UD || !UD.postMemberArUse) return;
    UD.postMemberArUse().then(function (d) {
      if (d && typeof d.arUsed === "number") memCache.arUsed = d.arUsed;
      if (d && d.memberUntil !== undefined) memCache.memberUntil = d.memberUntil;
      notifyMemberUi();
    });
  }

  function getMemberUntilIso(phone) {
    return getStateForPhone(phone || getPhone()).memberUntil;
  }

  function setMemberPlan(planId) {
    var phone = getPhone();
    if (!phone) return Promise.resolve({ ok: false, error: "请先登录" });
    var UD = global.ZYYUserData;
    if (!UD || !UD.postMemberPlan) {
      return Promise.resolve({ ok: false, error: "服务未就绪，请刷新页面" });
    }
    return UD.postMemberPlan(planId).then(function (data) {
      if (!data || !data.ok) return { ok: false, error: "开通失败，请重试" };
      memCache.memberUntil = data.memberUntil || null;
      notifyMemberUi();
      return { ok: true, until: memCache.memberUntil };
    });
  }

  function formatCnDate(iso) {
    var t = parseUntil(iso);
    if (!t) return "";
    var d = new Date(t);
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function getStatusSummary() {
    var phone = getPhone();
    if (!phone) {
      return { loggedIn: false, text: "未登录" };
    }
    if (isMemberActiveForPhone(phone)) {
      return {
        loggedIn: true,
        isMember: true,
        until: getMemberUntilIso(phone),
        untilText: formatCnDate(getMemberUntilIso(phone)),
        text: "会员有效期至 " + formatCnDate(getMemberUntilIso(phone)),
      };
    }
    var st = getStateForPhone(phone);
    var left = Math.max(0, FREE_AR_TRIALS - (st.arUsed || 0));
    return {
      loggedIn: true,
      isMember: false,
      arUsed: st.arUsed || 0,
      arRemaining: left,
      text: "VR 免费体验剩余 " + left + " / " + FREE_AR_TRIALS + " 次",
    };
  }

  function applyMemberPayload(d) {
    if (!d) return;
    memCache.arUsed = typeof d.arUsed === "number" && !isNaN(d.arUsed) ? d.arUsed : 0;
    memCache.memberUntil = d.memberUntil != null ? d.memberUntil : null;
  }

  function refreshMemberFromServer() {
    var UD = global.ZYYUserData;
    if (!getPhone() || !UD || !UD.loadMemberState) return Promise.resolve();
    return UD.loadMemberState().then(applyMemberPayload);
  }

  function kickSync() {
    if (!global.ZYYAuth || !global.ZYYAuth.getToken()) return;
    var UD = global.ZYYUserData;
    if (!UD || !UD.importLegacyOnce) {
      refreshMemberFromServer().then(notifyMemberUi).catch(function () {});
      return;
    }
    UD.importLegacyOnce()
        .then(function () {
          return refreshMemberFromServer();
        })
        .then(notifyMemberUi)
        .catch(function () {});
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", kickSync);
    } else {
      kickSync();
    }
  }

  global.ZYYMember = {
    FREE_AR_TRIALS: FREE_AR_TRIALS,
    canUseAr: canUseAr,
    recordArUse: recordArUse,
    isMemberActive: function () {
      return isMemberActiveForPhone(getPhone());
    },
    getStatusSummary: getStatusSummary,
    setMemberPlan: setMemberPlan,
    getPhone: getPhone,
    refreshMemberFromServer: refreshMemberFromServer,
  };
})(typeof window !== "undefined" ? window : global);
