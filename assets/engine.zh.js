// =========================
// assets/engine.zh.js
// Content-strategy pack: zh (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting / address partial formatting
// =========================

(function () {
  "use strict";

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

      if (
        /(申请编号|参考编号|办公地址|通信地址|联系人|手机号|银行卡号|开户地址|密码|验证码|登录账号|微信号|开户银行|对公账户|收款账号)/.test(
          s
        )
      ) {
        return "zh";
      }
      return "";
    },

    // ✅ language-specific execution order (tuned independently)
    priority: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "handle_label",
      "ref_label",
      "money",
      "phone",
      "company",
      "address_cn",
      "handle",
      "ref",
      "title",
      "number"
    ],

    // ✅ language-specific always-on (beyond core base)
    alwaysOn: ["handle_label", "ref_label", "address_cn"],

    // ✅ phone FP guard (zh): prevent long numeric IDs/refs being treated as phone
    phoneGuard: function ({ label, value, match }) {
      const digits = String(value || "").replace(/\D+/g, "");
      if (digits.length >= 16) return false;
      return true;
    },

    // ✅ address_cn_partial formatting (zh-only)
    formatAddressCnPartial: function ({ label, val, placeholder }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;
      if (reRoadNo.test(val)) {
        const v2 = String(val || "").replace(reRoadNo, (m2, a, b) => `${a}${placeholder("ADDRESS")}`);
        return `${label}${v2}`;
      }
      return `${label}${placeholder("ADDRESS")}`;
    },

    // ✅ highlight helper for pdf overlay (zh-only)
    highlightAddressCnPartial: function ({ label, val, S1, S2 }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;
      const v = String(val || "");
      if (reRoadNo.test(v)) {
        const markedVal = v.replace(reRoadNo, (mm, a, b) => `${a}${S1}${b}${S2}`);
        return `${label}${markedVal}`;
      }
      return `${label}${S1}${v}${S2}`;
    },

    // ✅ company formatting strategy (zh-only): keep partial industry tail + legal suffix
    // Signature aligned with core call-site: ({ raw, name, legal, punct, coreStr, placeholder })
    formatCompany: function ({ raw, name, legal, punct, coreStr, placeholder }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");

      // if no legal, just mask whole company token
      if (!rawLegal) return `${placeholder("COMPANY")}${rawPunct}`;

      const INDUSTRY = [
        "网络科技",
        "科技",
        "数据服务",
        "品牌管理",
        "创新股份",
        "创新",
        "信息技术",
        "技术",
        "咨询",
        "服务",
        "贸易",
        "传媒",
        "物流",
        "电子",
        "软件",
        "金融",
        "投资",
        "实业",
        "工程",
        "建筑",
        "教育",
        "医疗",
        "广告",
        "文化",
        "餐饮",
        "供应链",
        "电商",
        "互联网"
      ];

      let keep = "";
      for (const kw of INDUSTRY) {
        const i = rawName.lastIndexOf(kw);
        if (i >= 0 && i >= Math.max(0, rawName.length - 10)) {
          keep = rawName.slice(i);
          break;
        }
      }

      if (!keep && rawName.length > 4) keep = rawName.slice(-4);

      return `${placeholder("COMPANY")}${keep}${rawLegal}${rawPunct}`;
    },

    // ✅ company highlight for pdf overlay (zh-only)
    // Signature aligned with core call-site: ({ match, name, legal, punct, S1, S2 })
    highlightCompany: function ({ match, name, legal, punct, S1, S2 }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${S1}${rawName}${S2}${rawLegal}${rawPunct}`;
      // fallback: highlight whole token if no legal captured
      const m = String(match || rawName || "");
      return `${S1}${m}${S2}${rawPunct}`;
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
        // ✅ minimal FP cut: remove "联系人/kontakt" from label list (it caused accidental non-phone spans)
        pattern: /((?:联系方式|联系电话|电话|手機|手机|tel|telefon|phone|mobile|handy)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
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
        // ✅ add EUR formats + USD/$ formats (keep original RMB/¥/元 support intact)
        pattern:
          /(?:((?:人民币|CNY|RMB)\s*)(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)(?:\s*元)?)|(?:([¥￥])\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?))|(?:(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)\s*元)|(?:\b(?:USD)\b\s*\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*€)|(?:€\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/giu,
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
