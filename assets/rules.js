// rules.js v2.0 — LANGUAGE-AWARE BUILD
// - RULES_COMMON: stable across languages
// - RULES_BY_LANG: language-specific, avoid false positives
// - Backward-compatible: window.RULES_BY_KEY is always available (merged)

(function () {
  function getLangSafe() {
    const l = String(window.currentLang || "").toLowerCase();
    return (l === "en" || l === "de" || l === "zh") ? l : "zh";
  }

  // ===================== COMMON (low-risk, cross-language) =====================
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
      pattern:
        /((?:密码|PIN|Passwort|Password|passcode|verification\s*code|security\s*code|one[-\s]?time\s*code|OTP|2FA|CVV|CVC)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    /* ===================== ACCOUNT / CARD ===================== */
    account: {
      pattern:
        /((?:账号|账户|Account(?:\s*Number)?|Card\s*Number|Credit\s*Card|Debit\s*Card|IBAN|Tax\s*(?:ID|Number)|VAT\s*(?:ID|Number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== BANK / SWIFT / ROUTING ===================== */
    bank: {
      pattern:
        /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Routing\s*Number|Sort\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== PHONE ===================== */
    phone: {
      pattern:
        /((?:tel|telefon|phone|mobile|handy|kontakt|contact|whatsapp|telegram|signal)\s*[:：=]?\s*)?((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)/giu,
      tag: "PHONE",
      mode: "phone"
    },

    /* ===================== DE/EN STREET-LIKE ADDRESS (kept common, conservative) ===================== */
    address_de_street: {
      pattern:
        /((?:Address|Shipping\s*Address|Billing\s*Address|Street)\s*[:：=]?\s*)?([\p{L}0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/giu,
      tag: "ADDRESS",
      mode: "prefix"
    },

    /* ===================== HANDLE / USERNAME ===================== */
    handle_label: {
      pattern:
        /((?:用户名|username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
      tag: "HANDLE",
      mode: "prefix"
    },

    handle: {
      pattern: /@[A-Za-z0-9_]{2,32}\b/g,
      tag: "HANDLE"
    },

    /* ===================== REF / ORDER / INVOICE ===================== */
    ref_label: {
      pattern:
        /((?:Order\s*(?:ID|No\.?|Number)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
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

  // ===================== LANGUAGE-SPECIFIC (higher false-positive risk) =====================
  const RULES_BY_LANG = {
    // 中文：地址“路/街/道 + 号”按你 engine 里的 address_cn_partial 机制做“部分遮盖”
    zh: {
      // label optional; value group 2 is the full address line
      // engine 会在 mode === "address_cn_partial" 时只遮“xx路 88号”中的“88号”
      address_cn: {
        pattern:
          /((?:地址|办公地址|通信地址|收货地址|联系地址|住址|所在地)\s*[:：=]?\s*)([^\n\r]{4,120})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      }
    },

    // 英文：先不加高风险规则（保持保守，避免误伤）
    en: {},

    // 德文：同样先保持保守（你的 address_de_street 已经能覆盖一部分）
    de: {}
  };

  function mergeRules(lang) {
    const l = lang || "zh";
    const spec = RULES_BY_LANG[l] || {};
    return Object.assign({}, RULES_COMMON, spec);
  }

  // expose
  window.RULES_COMMON = RULES_COMMON;
  window.RULES_BY_LANG = RULES_BY_LANG;

  // backward compatible: keep RULES_BY_KEY always pointing to merged rules of current language
  Object.defineProperty(window, "RULES_BY_KEY", {
    configurable: true,
    enumerable: true,
    get: function () {
      return mergeRules(getLangSafe());
    }
  });
})();
