// rules.js v2.0 — LANG-AWARE STABLE BUILD
// - Provides RULES_COMMON + RULES_BY_LANG for language-specific rules.
// - Keeps RULES_BY_KEY as backward-compatible merged map.
// - Uses ONLY regex literals (no RegExp constructor) to avoid syntax traps.

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

    /* ===================== SECRET / PASSCODE ===================== */
    secret: {
      pattern: /((?:密码|PIN|Passwort|Password|passcode|verification\s*code|security\s*code|one[-\s]?time\s*code|OTP|2FA|CVV|CVC)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    /* ===================== ACCOUNT / CARD ===================== */
    account: {
      pattern: /((?:账号|账户|Account(?:\s*Number)?|Card\s*Number|Credit\s*Card|Debit\s*Card|IBAN|Tax\s*(?:ID|Number)|VAT\s*(?:ID|Number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== BANK / SWIFT / ROUTING ===================== */
    bank: {
      pattern: /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Routing\s*Number|Sort\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== PHONE ===================== */
    phone: {
      pattern: /((?:tel|telefon|phone|mobile|handy|kontakt|contact|whatsapp|telegram|signal)\s*[:：=]?\s*)?((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)/giu,
      tag: "PHONE",
      mode: "phone"
    },

    /* ===================== HANDLE / USERNAME ===================== */
    handle_label: {
      pattern: /((?:用户名|username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
      tag: "HANDLE",
      mode: "prefix"
    },

    handle: {
      pattern: /@[A-Za-z0-9_]{2,32}\b/g,
      tag: "HANDLE"
    },

    /* ===================== REF / ORDER / INVOICE ===================== */
    ref_label: {
      pattern: /((?:Order\s*(?:ID|No\.?|Number)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
      tag: "REF",
      mode: "prefix"
    },

    ref: {
      pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
      tag: "REF"
    },

    /* ===================== COMPANY ===================== */
    company: {
      pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|LLC|Ltd\.?|Inc\.?)\b/g,
      tag: "COMPANY",
      mode: "company"
    },

    /* ===================== MONEY ===================== */
    money: {
      pattern: /(?:\b(?:EUR|USD|GBP|CHF)\b|[€$£])\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?/giu,
      tag: "MONEY"
    },

    /* ===================== NUMBER fallback ===================== */
    number: {
      pattern: /\b\d[\d\s-]{6,28}\d\b/g,
      tag: "NUMBER"
    }
  };

  // =========================
  // LANGUAGE-SPECIFIC
  // =========================
  const RULES_BY_LANG = {
    zh: {
      // 中文地址：只遮盖 “路/街/... + 号” 的号段（engine 里有 address_cn_partial 的专用逻辑）
      address_cn: {
        pattern: /((?:地址|住址|办公地址|通信地址|收货地址|居住地址|单位地址)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      // 中文称谓/头衔（保守：仅常见敬称，避免误伤）
      title: {
        pattern: /\b(先生|女士|小姐|太太|老师|同学|经理|主任|总监|博士|教授)\b/gu,
        tag: "TITLE"
      }
    },

    de: {
      // 德语街道门牌（你 v1.9 的规则）
      address_de_street: {
        pattern: /((?:Address|Shipping\s*Address|Billing\s*Address|Street|Straße|Strasse|Adresse)\s*[:：=]?\s*)?([\p{L}0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/gi,
        tag: "TITLE"
      }
    },

    en: {
      address_de_street: {
        pattern: /((?:Address|Shipping\s*Address|Billing\s*Address|Street)\s*[:：=]?\s*)?([A-Za-z0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/g,
        tag: "ADDRESS",
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
  // - merge common + all language rules into one map
  // - later merges overwrite earlier if same key (acceptable for shared keys like address_de_street/title)
  // =========================
  const RULES_BY_KEY = Object.assign(
    {},
    RULES_COMMON,
    RULES_BY_LANG.zh,
    RULES_BY_LANG.de,
    RULES_BY_LANG.en
  );

  window.RULES_COMMON = RULES_COMMON;
  window.RULES_BY_LANG = RULES_BY_LANG;
  window.RULES_BY_KEY = RULES_BY_KEY;

  // tiny debug
  try {
    window.__rules_boot_ok = true;
  } catch (_) {}
})();
