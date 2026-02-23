// assets/rules.js v2.1 — LANGUAGE-AWARE + SAFE EXPORT
// ✅ RULES_COMMON + RULES_BY_LANG + window.RULES_BY_KEY (merged)
// ✅ Auto-refresh on language change (wrap setLang + optional event)

(function () {
  function getLangSafe() {
    const l = String(window.currentLang || "").toLowerCase();
    return (l === "en" || l === "de" || l === "zh") ? l : "zh";
  }

  // ===================== COMMON (cross-language, low false positives) =====================
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

    /* ===================== ACCOUNT / CARD (label-driven) ===================== */
    // NOTE: language-specific label expansions are in RULES_BY_LANG.zh/de/en if needed.
    account: {
      pattern:
        /((?:账号|账户|Account(?:\s*Number)?|Card\s*Number|Credit\s*Card|Debit\s*Card|IBAN|Tax\s*(?:ID|Number)|VAT\s*(?:ID|Number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== BANK / SWIFT / ROUTING (label-driven) ===================== */
    bank: {
      pattern:
        /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Routing\s*Number|Sort\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* ===================== PHONE (conservative baseline) ===================== */
    // baseline: strict-ish international formats only
    phone: {
      pattern:
        /((?:tel|telefon|phone|mobile|handy|kontakt|contact|whatsapp|telegram|signal)\s*[:：=]?\s*)?((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})\s*[\d\s().-]{6,}\d)/giu,
      tag: "PHONE",
      mode: "phone"
    },

    /* ===================== ADDRESS (DE/EN street-like; conservative) ===================== */
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

    /* ===================== COMPANY (Latin legal forms) ===================== */
    company: {
      pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|LLC|Ltd\.?|Inc\.?)\b/g,
      tag: "COMPANY",
      mode: "company"
    },

    /* ===================== MONEY (€, $, £ + codes) ===================== */
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

  // ===================== LANGUAGE-SPECIFIC (higher risk; tighten per language) =====================
  const RULES_BY_LANG = {
    zh: {
      // ---- PHONE for zh: allow common CN formats but avoid ID-like strings ----
      // - mobile: 1[3-9]xxxxxxxxx
      // - landline: 0xx-xxxxxxx / 0xxx-xxxxxxxx
      // - service: 400-xxx-xxxx
      // - plus/00 intl also ok
      // require: either label OR explicit CN/intl pattern; avoids CN-2026-... / ORD-...
      phone: {
        pattern:
          /((?:手机|电话|联系电话|联系方式|备用联系方式|客服电话|热线|Tel|TEL|Phone|Mobile|Kontakt|Contact|WhatsApp|Telegram|Signal)\s*[:：=]?\s*)?((?:(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})\s*[\d\s().-]{6,}\d)|(?:1[3-9]\d{9})|(?:0\d{2,3}[\s-]?\d{7,8})|(?:400[\s-]?\d{3}[\s-]?\d{4}))/giu,
        tag: "PHONE",
        mode: "phone"
      },

      // ---- CN address: label-driven; engine uses address_cn_partial to mask only "号" part if present ----
      address_cn: {
        pattern:
          /((?:地址|办公地址|通信地址|收货地址|联系地址|住址|所在地)\s*[:：=]?\s*)([^\n\r]{4,160})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      // ---- CN ref labels: prevent ORD/REF/CN-... being eaten by phone/number ----
      ref_label: {
        pattern:
          /((?:申请编号|申请号|订单号|参考编号|参考号|编号|单号)\s*[:：=]?\s*)([A-Za-z0-9\-_.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      // ---- CN account labels: cover bank card / public account / payment id etc ----
      account: {
        pattern:
          /((?:账号|账户|登录账号|支付账号|银行卡号|卡号|对公账户|对公账号|开户账号|Account(?:\s*Number)?|Card\s*Number|Credit\s*Card|Debit\s*Card|IBAN|Tax\s*(?:ID|Number)|VAT\s*(?:ID|Number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      // ---- CN money: RMB/CNY/元/￥ formats ----
      money_zh: {
        pattern:
          /(?:人民币|CNY|RMB|￥|元)\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?(?:\s*元)?/giu,
        tag: "MONEY"
      },

      // ---- CN company (optional; keep conservative: only legal suffix) ----
      // NOTE: your engine "company" mode preserves suffix; this rule helps hit CN companies.
      company_cn: {
        pattern:
          /\b([\u4E00-\u9FFF][\u4E00-\u9FFF0-9A-Za-z（）()·\-\s]{1,60})(集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)\b/gu,
        tag: "COMPANY",
        mode: "company"
      },

      // ---- Handle label: include 支付账号 / 登录信息 explicitly ----
      handle_label: {
        pattern:
          /((?:用户名|账号名|登录账号|登录信息|支付账号|username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      }
    },

    en: {
      // keep conservative for now
    },

    de: {
      // keep conservative for now
    }
  };

  function mergeRules(lang) {
    const l = lang || "zh";
    const spec = RULES_BY_LANG[l] || {};
    return Object.assign({}, RULES_COMMON, spec);
  }

  function refreshRulesNow() {
    const lang = getLangSafe();
    // Always provide plain object (no getter), so other scripts won't see "0 keys"
    window.RULES_COMMON = RULES_COMMON;
    window.RULES_BY_LANG = RULES_BY_LANG;
    window.RULES_BY_KEY = mergeRules(lang);
    window.__rules_lang = lang;
    window.__rules_boot_ok = true;
  }

  // Initial export
  refreshRulesNow();

  // Wrap setLang to refresh rules after language switches (non-breaking)
  if (typeof window.setLang === "function" && !window.__rules_wrap_setLang) {
    const _setLang = window.setLang;
    window.setLang = function (lang) {
      const r = _setLang.apply(this, arguments);
      try { refreshRulesNow(); } catch (_) {}
      return r;
    };
    window.__rules_wrap_setLang = true;
  }

  // Optional event hook if you later emit something like "i18n:changed"
  window.addEventListener("i18n:changed", function () {
    try { refreshRulesNow(); } catch (_) {}
  });

  // manual refresh hook for console
  window.__refreshRulesNow = refreshRulesNow;
})();
