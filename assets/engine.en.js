// =========================
// assets/engine.en.js
// UPGRADE v4 (stable, broad coverage, fixes over-masking)
// - Fix: ID tail masking (mask ONLY last numeric segment, keep year/segments)
// - Fix: exclude ERR/SKU + avoid SSN/EIN/Tax-ID being hit by ref rules
// - Add: strong EN money + banking + card/CVV/CVC coverage
// - Keep: label-driven identity + person_name + address inline model
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

    // EN should not be blocked just because of ü in a name (DE detect was fixed separately)
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
      // secrets / auth first
      "secret",
      "handle_label",

      // identity (label-driven, low FP)
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",

      // financial
      "account",
      "bank",
      "card_security", // CVV/CVC

      // comms
      "email",
      "url",

      // refs / IDs
      "ref_label_tail",     // label-driven tail mask
      "ref_generic_tail",   // generic tail mask (safe)

      // money (explicit currency only)
      "money",

      // phone AFTER refs/ids to reduce mis-hits
      "phone",

      // person / org
      "person_name",
      "company",

      // address model
      "address_en_inline_street",
      "address_en_extra",
      "address_label_single",

      // generic
      "handle",
      "title",
      "number"
    ],

    alwaysOn: [
      "handle_label",
      "ref_label_tail",
      "ref_generic_tail",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "address_en_inline_street",
      "address_en_extra",
      "address_label_single",
      "money",
      "account",
      "bank",
      "card_security"
    ],

    // prevent IDs being mistaken as phone numbers
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

      // ref-like tokens are not phones
      if (/\b[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-\d{4,}\b/.test(val)) return false;

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

      /* ===================== MONEY (explicit currency only) ===================== */
      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)/giu,
        tag: "MONEY"
      },

      /* ===================== SECRET (label-driven; full value) ===================== */
      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|account\s*id|handle)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== IDENTITY (label-driven) ===================== */
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
        // NOTE: deliberately does NOT match "Tax ID" (you said should NOT match)
        pattern:
          /((?:national\s*id(?:\s*(?:no\.?|number))?|id\s*number)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== BANK / PAYMENT (label-driven) ===================== */
      account: {
        // Account Number / Routing / Sort Code / IBAN / Card Number / Credit Card
        pattern:
          /((?:account(?:\s*number)?|routing\s*number|sort\s*code|iban|credit\s*card|debit\s*card|card\s*number|name\s*on\s*card)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        // SWIFT / BIC (tolerate "SWIFT Code:" or "SWIFT" label)
        pattern:
          /((?:swift|swift\s*code|bic)\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      card_security: {
        pattern: /((?:cvv|cvc)\s*[:：=]\s*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== PHONE ===================== */
      phone: {
        pattern:
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (label-driven; supports titles + O'Neil + Anna-Marie + Müller) ===================== */
      person_name: {
        pattern:
          /((?:name|customer\s*name|account\s*holder|recipient|name\s*on\s*card)\s*[:：=]\s*)((?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})/giu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP|Co\.?|Company)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS inline (street+number ONLY) ===================== */
      address_en_inline_street: {
        pattern:
          /\b\d{1,5}[A-Za-z]?(?:-\d{1,5})?\s+(?:[A-Za-z0-9.'’\-]+\s+){0,6}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|parkway|pkwy\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|terrace|ter\.?|crescent|cres\.?|close|cl\.?|gardens?|gdns?\.?|mews|row|alley|aly\.?)\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS extras (apt/unit/suite/floor/room ONLY) ===================== */
      address_en_extra: {
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?|dept|department)\s*#?\s*[A-Za-z0-9.\-]{1,12}(?:\s*,\s*(?:floor|fl\.?)\s*#?\s*\d{1,3})?(?:\s*,\s*(?:room|rm\.?)\s*#?\s*[A-Za-z0-9.\-]{1,12})?\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS label single-line ===================== */
      address_label_single: {
        pattern: /((?:address|shipping\s*address|billing\s*address|street)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== REF/ID — LABEL-DRIVEN TAIL MASK (SAFE) ===================== */
      ref_label_tail: {
        // Masks ONLY the last numeric segment (>=4) after the last "-" or "_" or "."
        // Keeps year/segments like "2026-02"
        // Excludes SKU/ERR explicitly
        pattern:
          /((?:(?:application|order|invoice|reference|ref\.?|case|ticket|request|customer)\s*(?:id|no\.?|number)?\s*(?:[:：=]|-)\s*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== REF/ID — GENERIC TAIL MASK (SAFE) ===================== */
      ref_generic_tail: {
        // Only matches tokens that START with letters (prevents SSN/EIN/Tax-ID being hit)
        // Only masks last numeric segment (>=5) to avoid ERR-2026-7784 and SKU ADP-1200/CBL-050
        pattern:
          /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== HANDLE (generic) ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\b/gi,
        tag: "TITLE"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
