// =========================
// assets/rules.js v2.2 — LANG-AWARE (contentLang) + stable fallback
// - RULES_COMMON: truly cross-language stable patterns
// - RULES_BY_LANG: language-specific label dictionaries / address patterns
// - RULES_BY_KEY: backward-compatible DEFAULT (common + zh) ONLY
//   (prevents en/de overwriting zh keys in old builds)
// =========================

(function () {
  "use strict";

  // =========================
  // COMMON (shared across languages)
  // =========================
  const RULES_COMMON = {
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

    /* ===================== HANDLE ===================== */
    handle: {
      pattern: /@[A-Za-z0-9_]{2,32}\b/g,
      tag: "HANDLE"
    },

    /* ===================== REF (format-like) ===================== */
    ref: {
      pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
      tag: "REF"
    },

    /* ===================== MONEY (explicit currency only, low FP) ===================== */
    money: {
      pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥])\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?/giu,
      tag: "MONEY"
    },

    /* ===================== NUMBER fallback ===================== */
    number: {
      pattern: /\b\d[\d\s-]{6,28}\d\b/g,
      tag: "NUMBER"
    }
  };

  // =========================
  // LANGUAGE-SPECIFIC RULES
  // =========================
  const RULES_BY_LANG = {
    zh: {
      /* SECRET (label-driven) */
      secret: {
        pattern: /((?:密码|口令|登录密码|支付密码|PIN|验证码|校验码|动态码|短信验证码|OTP|2FA)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ACCOUNT (label-driven) */
      account: {
        pattern: /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|银行卡号|卡号|对公账户|對公賬戶)\s*[:：=]?\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* BANK (label-driven) */
      bank: {
        pattern: /((?:开户银行|開戶銀行|银行|銀行|BIC|SWIFT)\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ✅ PHONE (label-driven only + allow intl prefix)
         - Fix: avoid masking refs like CN-2026-xxxx / ORD-xxxx / wxid_xxxx
         - Two branches:
           A) labeled phone: (label)(value)
           B) explicit intl prefix phone: +xx... or 00xx...
      */
      phone: {
        pattern: /((?:联系方式|联系电话|电话|手機|手机|联系人|聯繫方式|tel|telefon|phone|mobile|handy|kontakt)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* HANDLE label-driven */
      handle_label: {
        pattern: /((?:用户名|用\s*户\s*名|登录账号|登\s*录\s*账\s*号|账号名|账\s*号\s*名|账户名|帐户名|支付账号|支付账户|微信号|WeChat\s*ID|wxid)\s*[:：=]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* REF label-driven */
      ref_label: {
        pattern: /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* CN address (partial masking in engine) */
      address_cn: {
        pattern: /((?:地址|住址|办公地址|通信地址|收货地址|居住地址|单位地址)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      /* ✅ MONEY (ZH)
         - cover "人民币 128,500.00 元" / "CNY 128,500.00" / "￥128,500.00"
      */
      money: {
        pattern: /((?:人民币|CNY|RMB)\s*)?([¥￥]?\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)\s*(?:元|rmb|cny)?/giu,
        tag: "MONEY"
      },

      /* ✅ COMPANY (ZH) — capture name + legal suffix (named groups)
         - matches: 上海赛行网络科技有限公司 / 赛行（上海）网络科技有限公司 / 北京星舟科技有限公司
      */
      company: {
        pattern: /(?<name>[\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,60}?)(?<legal>集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)\b/gu,
        tag: "COMPANY",
        mode: "company"
      },

      title: {
        pattern: /\b(先生|女士|小姐|太太|老师|同学|经理|主任|总监|博士|教授)\b/gu,
        tag: "TITLE"
      }
    },

    de: {
      secret: {
        pattern: /((?:Passwort|PIN|OTP|2FA|Sicherheitscode|verification\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern: /((?:Kontonummer|Account(?:\s*Number)?|IBAN|Steuer(?:\s*ID|nummer)?|USt-?IdNr\.?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      phone: {
        pattern: /((?:tel|telefon|handy|kontakt|phone|mobile|whatsapp|telegram|signal)\s*[:：=]?\s*)?((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      address_de_street: {
        pattern: /((?:Adresse|Address|Straße|Strasse)\s*[:：=]?\s*)?([\p{L}0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC)\b/gi,
        tag: "COMPANY",
        mode: "company"
      },

      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/gi,
        tag: "TITLE"
      }
    },

    en: {
      secret: {
        pattern: /((?:password|passcode|PIN|verification\s*code|security\s*code|one[-\s]?time\s*code|OTP|2FA|CVV|CVC)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern: /((?:account(?:\s*number)?|card\s*number|credit\s*card|debit\s*card|iban|tax\s*(?:id|number)|vat\s*(?:id|number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:iban|bic|swift|swift\s*code|routing\s*number|sort\s*code|bank\s*(?:account|details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      phone: {
        pattern: /((?:phone|mobile|contact|tel|whatsapp|telegram|signal)\s*[:：=]?\s*)?((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      address_de_street: {
        pattern: /((?:Address|Shipping\s*Address|Billing\s*Address|Street)\s*[:：=]?\s*)?([A-Za-z0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/g,
        tag: "ADDRESS",
        mode: "prefix"
      },

      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(LLC|Ltd\.?|Inc\.?)\b/g,
        tag: "COMPANY",
        mode: "company"
      },

      ref_label: {
        pattern: /((?:Order\s*(?:ID|No\.?|Number)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      handle_label: {
        pattern: /((?:username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      title: {
        pattern: /\b(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\b/gi,
        tag: "TITLE"
      }
    }
  };

  // =========================
  // Backward compatibility: RULES_BY_KEY
  // DEFAULT = common + zh only (stable, prevents cross-lang overwrites)
  // =========================
  const RULES_BY_KEY = Object.assign({}, RULES_COMMON, RULES_BY_LANG.zh);

  window.RULES_COMMON = RULES_COMMON;
  window.RULES_BY_LANG = RULES_BY_LANG;
  window.RULES_BY_KEY = RULES_BY_KEY;

  try { window.__rules_boot_ok = true; } catch (_) {}
})();
