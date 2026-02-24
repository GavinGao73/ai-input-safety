// =========================
// assets/engine.en.js
// UPGRADE v5.2 (fix: name cross-line + address "ONLY" FP + phone ID trap)
// =========================

(function () {
  "use strict";

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
      TERM: "[REDACTED]",
      NAME: "[Name]"
    },

    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      if (han / Math.max(1, s.length) > 0.03) return "";

      if (/\b(Invoice|Order ID|Account Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s))
        return "en";

      if (/[A-Za-z]/.test(s)) return "en";
      return "";
    },

    priority: [
      "secret",
      "handle_label",

      "dob",

      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      "account",
      "bank",
      "card_security",

      "email",
      "url",

      "ref_label_tail",
      "ref_generic_tail",

      "money",

      "phone",

      "person_name",
      "company",

      "address_en_inline_street",
      "address_en_extra",

      "handle",
      "number"
    ],

    alwaysOn: [
      "handle_label",
      "dob",
      "ref_label_tail",
      "ref_generic_tail",

      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      // ensure names always run
      "person_name",

      "address_en_inline_street",
      "address_en_extra",

      "money",
      "account",
      "bank",
      "card_security"
    ],

    phoneGuard: function ({ label, value }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      if (digits.length >= 16) return false;

      if (
        /\b(?:case|ticket|order|invoice|reference|ref|customer|application|request|account)\b/.test(lbl) &&
        /\b(?:id|no|number|#)\b/.test(lbl)
      )
        return false;

      if (/\b(?:CUST|CASE|ORD|INV|APP|REF|ACC|MEM|INS)-/i.test(val)) return false;

      if (/\b[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-\d{4,}\b/i.test(val)) return false;

      return true;
    },

    formatCompany: function ({ legal, punct, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
    },

    highlightCompany: function ({ match, name, legal, punct, S1, S2 }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawName && rawLegal) return `${S1}${rawName}${S2}${rawLegal}${rawPunct}`;
      const m = String(match || rawName || "");
      return `${S1}${m}${S2}${rawPunct}`;
    },

    rules: {
      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)/giu,
        tag: "MONEY"
      },

      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|account\s*id|handle)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      // DOB: keep year, mask MM-DD (2 groups only, stable with prefix mode)
      dob: {
        pattern: /((?:date\s*of\s*birth|dob)\s*[:：=]\s*\d{4}[-\/\.])(\d{2}[-\/\.]\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:passport(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern:
          /((?:driver[’']?s\s*license(?:\s*(?:no\.?|number))?|driving\s*licen[cs]e(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9\-]{4,28})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ssn: {
        pattern: /((?:ssn|social\s*security\s*number)\s*[:：=]\s*)(\d{3}-\d{2}-\d{4}|\d{9})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ein: {
        pattern: /((?:ein|employer\s*identification\s*number)\s*[:：=]\s*)(\d{2}-\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern:
          /((?:national\s*id(?:\s*(?:no\.?|number))?|id\s*number)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_id: {
        pattern:
          /((?:tax\s*id|tax\s*identification\s*(?:no\.?|number)|tin)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-]{4,32})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern:
          /((?:account(?:\s*number)?|routing\s*number|sort\s*code|iban|credit\s*card|debit\s*card|card\s*number|name\s*on\s*card)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern:
          /((?:swift|swift\s*code|bic)\b\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      card_security: {
        pattern: /((?:cvv|cvc)\s*[:：=]\s*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      // ✅ phone: add boundary so it won't match inside ID tokens like CUST-...
      phone: {
        pattern:
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      // ✅ name: line-anchored, NO \s that can eat newlines (prevents cross-line field mixing)
      person_name: {
        pattern:
          /^((?:name|customer\s*name|account\s*holder|recipient|name\s*on\s*card)[ \t]*[:：=][ \t]*(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?)((?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})[ \t]*$/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP|Co\.?|Company)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      address_en_inline_street: {
        pattern:
          /\b\d{1,5}[A-Za-z]?(?:-\d{1,5})?\s+(?:[A-Za-z0-9.'’\-]+\s+){0,6}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|parkway|pkwy\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|terrace|ter\.?|crescent|cres\.?|close|cl\.?|gardens?|gdns?\.?|mews|row|alley|aly\.?)\b/giu,
        tag: "ADDRESS"
      },

      // ✅ extras: value MUST contain a digit (prevents "room ONLY" etc.)
      address_en_extra: {
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?|dept|department)\b(?:\s+#?\s*|#\s*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      ref_label_tail: {
        pattern:
          /((?:(?:application|order|invoice|reference|ref\.?|case|ticket|request|customer)\s*(?:id|no\.?|number)?\s*(?:[:：=]|-)\s*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_generic_tail: {
        pattern: /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
