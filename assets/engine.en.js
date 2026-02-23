// =========================
// assets/engine.en.js
// Content-strategy pack: en (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// =========================

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

      /* ===================== MONEY (explicit currency only, low FP) ===================== */
      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥])\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?/giu,
        tag: "MONEY"
      },

      /* ===================== SECRET (label-driven) ===================== */
      secret: {
        pattern: /((?:password|passcode|PIN|verification\s*code|security\s*code|one[-\s]?time\s*code|OTP|2FA|CVV|CVC)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern: /((?:account(?:\s*number)?|card\s*number|credit\s*card|debit\s*card|iban|tax\s*(?:id|number)|vat\s*(?:id|number))\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern: /((?:iban|bic|swift|swift\s*code|routing\s*number|sort\s*code|bank\s*(?:account|details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Za-z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern: /((?:phone|mobile|contact|tel|whatsapp|telegram|signal)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== ADDRESS (label-driven only) ===================== */
      address_de_street: {
        pattern: /((?:Address|Shipping\s*Address|Billing\s*Address|Street)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(LLC|Ltd\.?|Inc\.?)\b/g,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== REF (label-driven) ===================== */
      ref_label: {
        pattern: /((?:Application\s*(?:ID|No\.?|Number)|Order\s*(?:ID|No\.?|Number)|Invoice\s*(?:ID|No\.?|Number)|Reference|Ref\.?|Case\s*(?:ID|No\.?|Number)|Ticket\s*(?:ID|No\.?|Number)|Request\s*(?:ID|No\.?|Number))\s*(?:[:：=]|-)\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{2,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:username|user\s*id|login|account\s*id|handle|telegram|signal|whatsapp)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\b/gi,
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
