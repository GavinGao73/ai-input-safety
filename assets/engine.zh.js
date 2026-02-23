// assets/engine.zh.js
// Content-strategy pack: zh (NOT UI language)

(function () {
  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});

  PACKS.zh = {
    lang: "zh",

    placeholders: {
      PHONE: "【电话】",
      EMAIL: "【邮箱】",
      URL: "【网址】",
      SECRET: "【敏感】",
      ACCOUNT: "【账号】",
      ADDRESS: "【地址】",
      HANDLE: "【账号名】",
      REF: "【编号】",
      TITLE: "【称谓】",
      NUMBER: "【数字】",
      MONEY: "【金额】",
      COMPANY: "【公司】",
      TERM: "【遮盖】"
    },

    // One-shot detect hints (content strategy only)
    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      const total = Math.max(1, s.length);
      if (han / total > 0.05) return "zh";

      if (/(申请编号|参考编号|办公地址|通信地址|联系人|手机号|银行卡号|开户地址|密码|验证码|登录账号|微信号|开户银行|对公账户|收款账号)/.test(s)) {
        return "zh";
      }
      return "";
    }
  };
})();
