// assets/engine.en.js
// Content-strategy pack: en (NOT UI language)

(function () {
  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});

  PACKS.en = {
    lang: "en",

    placeholders: {
      PHONE: "[Phone]",
      EMAIL: "[Email]",
      URL: "[URL]",
      SECRET: "[Secret]",
      ACCOUNT: "[Account]",
      ADDRESS: "[Address]",
      HANDLE: "[Handle]",
      REF: "[Ref]",
      TITLE: "[Title]",
      NUMBER: "[Number]",
      MONEY: "[Amount]",
      COMPANY: "[Company]",
      TERM: "[REDACTED]"
    },

    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      // If strong German signals exist, do NOT claim en
      if (/[äöüÄÖÜß]/.test(s)) return "";
      if (/\b(Straße|Strasse|PLZ|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Kundennummer)\b/i.test(s)) return "";

      // If strong Chinese signals exist, do NOT claim en
      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      const total = Math.max(1, s.length);
      if (han / total > 0.03) return "";

      // English hints (keep lightweight to reduce FP)
      if (/\b(Invoice|Order ID|Account Number|Username|Address|Phone|Email|Customer|Payment|Bank)\b/i.test(s)) return "en";
      if (/[A-Za-z]/.test(s) && !/[\u4E00-\u9FFF]/.test(s)) return "en";

      return "";
    }
  };
})();
