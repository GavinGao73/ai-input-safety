// =========================
// assets/engine.zh.js
// Content-strategy pack: zh (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// =========================

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
    },

    rules: {
      /* ===================== EMAIL ===================== */
      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      /* ===================== URL ===================== */
      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      /* ===================== SECRET (label-driven) ===================== */
      secret: {
        pattern: /((?:密码|口令|登录密码|支付密码|PIN|验证码|校验码|动态码|短信验证码|OTP|2FA)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern: /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|银行卡号|卡号|对公账户|對公賬戶)\s*[:：=]?\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern: /((?:开户银行|開戶銀行|银行|銀行|BIC|SWIFT)\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern: /((?:联系方式|联系电话|电话|手機|手机|联系人|聯繫方式|tel|telefon|phone|mobile|handy|kontakt)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:用户名|用\s*户\s*名|登录账号|登\s*录\s*账\s*号|账号名|账\s*号\s*名|账户名|帐户名|支付账号|支付账户|微信号|WeChat\s*ID|wxid)\s*[:：=]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== REF (label-driven) ===================== */
      ref_label: {
        pattern: /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== ADDRESS (CN partial) ===================== */
      address_cn: {
        pattern: /((?:地址|住址|办公地址|通信地址|收货地址|居住地址|单位地址)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      /* ===================== MONEY (ZH require currency indicator) ===================== */
      money: {
        pattern: /(?:((?:人民币|CNY|RMB)\s*)(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)(?:\s*元)?)|(?:([¥￥])\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?))|(?:(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)\s*元)/giu,
        tag: "MONEY"
      },

      /* ===================== COMPANY (ZH) ===================== */
      company: {
        pattern: /(?<name>[\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,60}?)(?<legal>集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)(?=$|[^\u4E00-\u9FFF])/gu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(先生|女士|小姐|太太|老师|同学|经理|主任|总监|博士|教授)\b/gu,
        tag: "TITLE"
      },

      /* ===================== HANDLE (generic) ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== REF (format-like) ===================== */
      ref: {
        pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
        tag: "REF"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
