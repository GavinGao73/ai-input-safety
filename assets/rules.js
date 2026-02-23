// rules.js v2.0 — REGISTRY + META (lang buckets + global)
// - No RegExp constructor
// - Add address_cn (mode: address_cn_partial) to match engine.js usage
// - Provide RULES_META: per-language PRIORITY + ALWAYS_ON
// - Keep keys stable: email/url/secret/account/bank/phone/address_cn/address_de_street/handle_label/handle/ref_label/ref/company/money/number

/* ===================== GLOBAL (low-FP / cross-language stable) ===================== */
const RULES_GLOBAL = {
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

  /* ===================== ACCOUNT / CARD (label-gated) ===================== */
  account: {
    pattern: /((?:账号|账户|Account(?:\s*Number)?|Card\s*Number|Credit\s*Card|Debit\s*Card|IBAN|Tax\s*(?:ID|Number)|VAT\s*(?:ID|Number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== BANK / SWIFT / ROUTING (label-gated) ===================== */
  bank: {
    pattern: /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Routing\s*Number|Sort\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== MONEY ===================== */
  money: {
    pattern: /(?:\b(?:EUR|USD|GBP|CHF)\b|[€$£])\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?/giu,
    tag: "MONEY"
  },

  /* ===================== COMPANY ===================== */
  company: {
    pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|LLC|Ltd\.?|Inc\.?)\b/g,
    tag: "COMPANY",
    mode: "company"
  }
};

/* ===================== ZH (China-centric / label-gated) ===================== */
const RULES_ZH = {
  /* ===================== PHONE (label REQUIRED; avoid mis-hitting IDs) ===================== */
  phone: {
    pattern: /((?:电话|手机|联系方式|tel|telefon|phone|mobile|handy|kontakt|contact|whatsapp|telegram|signal)\s*[:：=]?\s*)([+＋]?\s*(?:\d{1,3}\s*)?(?:[\d\s().-]{6,}\d))/giu,
    tag: "PHONE",
    mode: "phone"
  },

  /* ===================== ADDRESS CN (label REQUIRED; mode: address_cn_partial) ===================== */
  // Group1 = label, Group2 = value
  address_cn: {
    pattern: /((?:地址|住址|通信地址|办公地址|收货地址|Address|Billing\s*Address|Shipping\s*Address)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
    tag: "ADDRESS",
    mode: "address_cn_partial"
  },

  /* ===================== HANDLE / USERNAME (label-gated) ===================== */
  handle_label: {
    pattern: /((?:用户名|账号名|登录账号|username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
    tag: "HANDLE",
    mode: "prefix"
  },

  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  /* ===================== REF / ORDER / INVOICE (label-gated) ===================== */
  ref_label: {
    pattern: /((?:申请编号|受理编号|订单号|发票号|参考号|Order\s*(?:ID|No\.?|Number|Ref\.?)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?|Ticket\s*ID|Case\s*ID|Request\s*ID|Confirmation\s*Code)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
    tag: "REF",
    mode: "prefix"
  },

  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  /* ===================== NUMBER fallback (OFF by default policy; keep rule for opt-in) ===================== */
  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

/* ===================== EN (EN-first / label-gated) ===================== */
const RULES_EN = {
  phone: {
    pattern: /((?:tel|phone|mobile|contact|whatsapp|telegram|signal)\s*[:：=]?\s*)([+＋]?\s*(?:\d{1,3}\s*)?(?:[\d\s().-]{6,}\d))/giu,
    tag: "PHONE",
    mode: "phone"
  },

  handle_label: {
    pattern: /((?:username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
    tag: "HANDLE",
    mode: "prefix"
  },

  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  ref_label: {
    pattern: /((?:Order\s*(?:ID|No\.?|Number|Ref\.?)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?|Ticket\s*ID|Case\s*ID|Request\s*ID|Confirmation\s*Code)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
    tag: "REF",
    mode: "prefix"
  },

  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  address_de_street: {
    // EN: require label, avoid free-text swallowing
    pattern: /((?:Address|Shipping\s*Address|Billing\s*Address|Street)\s*[:：=]?\s*)([\p{L}0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/giu,
    tag: "ADDRESS",
    mode: "prefix"
  },

  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

/* ===================== DE (Germany-centric / label-gated) ===================== */
const RULES_DE = {
  phone: {
    pattern: /((?:tel|telefon|handy|kontakt|phone|mobile|whatsapp|telegram|signal)\s*[:：=]?\s*)([+＋]?\s*(?:\d{1,3}\s*)?(?:[\d\s().-]{6,}\d))/giu,
    tag: "PHONE",
    mode: "phone"
  },

  handle_label: {
    pattern: /((?:benutzername|username|user\s*id|login|konto\s*id|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
    tag: "HANDLE",
    mode: "prefix"
  },

  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  ref_label: {
    pattern: /((?:Vorgangsnummer|Aktenzeichen|Bestell\s*(?:ID|Nr\.?|Nummer)|Rechnungs\s*(?:ID|Nr\.?|Nummer)|Referenz|Ref\.?)\s*(?:[:：=]|-)\s*)([A-Za-z0-9\-_.]{3,80})/giu,
    tag: "REF",
    mode: "prefix"
  },

  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  address_de_street: {
    // DE/EN street+no, label required
    pattern: /((?:Adresse|Anschrift|Address|Shipping\s*Address|Billing\s*Address|Straße|Str\.?|Street)\s*[:：=]?\s*)([\p{L}0-9.\-,'/ ]{2,80}\s+\d{1,6}\w?)/giu,
    tag: "ADDRESS",
    mode: "prefix"
  },

  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

/* ===================== REGISTRY EXPORT ===================== */
window.RULES_REGISTRY = {
  global: RULES_GLOBAL,
  zh: RULES_ZH,
  en: RULES_EN,
  de: RULES_DE
};

/* ===================== META (policy owned by rules.js) ===================== */
window.RULES_META = {
  // PRIORITY: safe order; keep wide matchers late
  priorityByLang: {
    zh: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "phone",
      "company",
      "handle_label",
      "ref_label",
      "address_cn",
      "money",
      "handle",
      "ref",
      "number"
    ],
    en: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "phone",
      "company",
      "handle_label",
      "ref_label",
      "money",
      "address_de_street",
      "handle",
      "ref",
      "number"
    ],
    de: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "phone",
      "company",
      "handle_label",
      "ref_label",
      "money",
      "address_de_street",
      "handle",
      "ref",
      "number"
    ]
  },

  // ALWAYS_ON: minimal, low-FP keys. Keep phone/address off ALWAYS_ON unless you *want* mandatory coverage.
  alwaysOnByLang: {
    zh: ["secret", "email", "url", "account", "bank", "company", "handle_label", "ref_label", "address_cn"],
    en: ["secret", "email", "url", "account", "bank", "company", "handle_label", "ref_label"],
    de: ["secret", "email", "url", "account", "bank", "company", "handle_label", "ref_label"]
  }
};

// Backward-compat (optional): provide a default flat view for current language
// (engine.js v2 uses RULES_REGISTRY; this is just for older code paths)
(function(){
  const lang = (String(window.currentLang || "zh").toLowerCase());
  const L = (lang === "en" || lang === "de" || lang === "zh") ? lang : "zh";
  window.RULES_BY_KEY = { ...(RULES_GLOBAL || {}), ...((window.RULES_REGISTRY && window.RULES_REGISTRY[L]) || {}) };
})();

/* ===================== COMPAT VIEW (RULES_BY_KEY) ===================== */
(function () {
  function normLang(x) {
    const l = String(x || "").toLowerCase();
    return (l === "en" || l === "de" || l === "zh") ? l : "zh";
  }

  function getRulesForLang(lang) {
    const L = normLang(lang);
    const reg = window.RULES_REGISTRY || {};
    const global = (reg.global && typeof reg.global === "object") ? reg.global : {};
    const bucket = (reg[L] && typeof reg[L] === "object") ? reg[L] : {};
    return { ...global, ...bucket };
  }

  // expose helpers for engine / ui (safe)
  window.getRulesForLang = getRulesForLang;

  function refreshRulesByKey() {
    window.RULES_BY_KEY = getRulesForLang(window.currentLang);
  }

  // ✅ build once on load (so UI init won't crash)
  refreshRulesByKey();

  // ✅ refresh on lang changes (whenever UI toggles window.currentLang)
  // If you already dispatch a specific event, keep it; otherwise this is harmless.
  window.addEventListener("safe:lang-changed", refreshRulesByKey);
  window.addEventListener("languagechange", refreshRulesByKey);

  // Optional: if UI sets currentLang without events, allow manual call
  window.__refreshRulesByKey = refreshRulesByKey;
})();
