// =========================
// assets/engine.en.js
// Content-strategy pack: en (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting
//
// UPGRADE v1 (stable, pack-only):
// - E1: Add EN identity rules (passport / driver_license / ssn / ein / national_id) — label-driven, low FP
// - E2: Add EN person_name rule (label-driven, swallows titles; supports O'Neil / Anna-Marie / Müller)
// - E3: Add EN address model (inline street+number + apt/unit/suite/floor/room ONLY)
//       ZIP/city/state remain unmasked (by design)
// - E4: Improve phoneGuard to avoid ref-like IDs (case/ticket/order/invoice/customer id)
// - E5: Upgrade company rule to named groups (?<name>, ?<legal>) to keep legal suffix
//
// NOTE: we keep key "address_de_street" for backward compatibility with existing UI/config,
//       but it is now EN label-driven address (single-line) — real coverage mainly comes from inline rules.
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

      // If strong German signals exist, do NOT claim en
      if (/[äöüÄÖÜß]/.test(s)) return "";
      if (/\b(Straße|Strasse|PLZ|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Kundennummer)\b/i.test(s))
        return "";

      // If strong Chinese signals exist, do NOT claim en
      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      const total = Math.max(1, s.length);
      if (han / total > 0.03) return "";

      // English hints (keep lightweight to reduce FP)
      if (/\b(Invoice|Order ID|Account Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s))
        return "en";
      if (/[A-Za-z]/.test(s) && !/[\u4E00-\u9FFF]/.test(s)) return "en";

      return "";
    },

    // ✅ language-specific execution order
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

      // comms
      "email",
      "url",

      // refs
      "ref_label",

      // money (explicit currency only)
      "money",

      // phone AFTER refs/ids to reduce mis-hits
      "phone",

      // person / org
      "person_name",
      "company",

      // address model (street+number + apt/unit/suite/floor/room ONLY)
      "address_en_inline_street",
      "address_en_extra",
      "address_de_street", // (compat key) EN label-driven single-line

      // generic
      "handle",
      "ref",
      "title",
      "number"
    ],

    // ✅ language-specific always-on (conservative + stable)
    alwaysOn: [
      "handle_label",
      "ref_label",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "address_en_inline_street",
      "address_en_extra",
      "address_de_street"
    ],

    // ✅ phone FP guard (en): prevent ref-like IDs being masked
    phoneGuard: function ({ label, value, match }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      // long numeric IDs are not phones (also avoids card-like sequences)
      if (digits.length >= 16) return false;

      // labels that are clearly IDs, not phones
      if (
        /\b(?:case|ticket|order|invoice|reference|ref|customer|application|request|account)\b/.test(lbl) &&
        /\b(?:id|no|number|#)\b/.test(lbl)
      )
        return false;

      // common ID-ish shapes should not be treated as phones
      if (/\b[A-Z]{2,6}-\d{4,14}\b/i.test(val)) return false; // ref-like
      if (/\b\d{4,8}-\d{3,8}\b/.test(val) && digits.length < 10) return false; // ticket-ish

      return true;
    },

    // ✅ company formatting (en): conservative
    // Signature aligned with core call-site: ({ raw, name, legal, punct, coreStr, placeholder })
    formatCompany: function ({ raw, name, legal, punct, coreStr, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
    },

    // ✅ company highlight for pdf overlay (en): conservative
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

      /* ===================== MONEY (explicit currency only, low FP) ===================== */
      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥])\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?/giu,
        tag: "MONEY"
      },

      /* ===================== SECRET (label-driven) ===================== */
      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code|cvv|cvc)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|account\s*id|handle)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== REF (label-driven) ===================== */
      ref_label: {
        pattern:
          /((?:application\s*(?:id|no\.?|number)|order\s*(?:id|no\.?|number)|invoice\s*(?:id|no\.?|number)|reference|ref\.?|case\s*(?:id|no\.?|number)|ticket\s*(?:id|no\.?|number)|request\s*(?:id|no\.?|number)|customer\s*(?:id|no\.?|number))\s*(?:[:：=]|-)\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{2,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== IDENTITY (EN, label-driven, low FP) ===================== */

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
        pattern:
          /((?:ssn|social\s*security\s*number)\s*[:：=]\s*)(\d{3}-\d{2}-\d{4}|\d{9})/giu,
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

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern:
          /((?:account(?:\s*number)?|card\s*number|credit\s*card|debit\s*card|iban|vat\s*(?:id|number)|routing\s*number|sort\s*code)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern:
          /((?:iban|bic|swift|swift\s*code|bank\s*(?:account|details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Za-z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern:
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (label-driven) ===================== */
      person_name: {
        // Covers: Name:, Customer Name:, Account Holder:, Name on card:
        // - Swallows optional titles (Mr/Ms/Mrs/Dr/Prof)
        // - Supports O'Neil / Anna-Marie / Müller
        pattern:
          /((?:name|customer\s*name|account\s*holder|name\s*on\s*card)\s*[:：=]\s*)((?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})/giu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        // Named groups enable formatCompany to keep legal suffix
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP|Co\.?|Company)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS (inline, street+number ONLY) ===================== */
      address_en_inline_street: {
        // Examples:
        // - 1600 Amphitheatre Parkway
        // - 221B Baker Street
        // - 10 Downing St.
        // - 12-14 King’s Road (handled via optional range)
        pattern:
          /\b\d{1,5}[A-Za-z]?(?:-\d{1,5})?\s+(?:[A-Za-z0-9.'’\-]+\s+){0,6}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|parkway|pkwy\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|terrace|ter\.?|crescent|cres\.?|close|cl\.?|gardens?|gdns?\.?|mews|row|alley|aly\.?)\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS (extras: apt/unit/suite/floor/room ONLY) ===================== */
      address_en_extra: {
        // Masks apartment/unit/suite/floor/room info; intentionally does NOT touch ZIP/city/state.
        // Examples:
        // - Suite 200, Floor 3, Room 3.12
        // - Unit 2A
        // - Apt #12
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?|dept|department)\s*#?\s*[A-Za-z0-9.\-]{1,12}(?:\s*,\s*(?:floor|fl\.?)\s*#?\s*\d{1,3})?(?:\s*,\s*(?:room|rm\.?)\s*#?\s*[A-Za-z0-9.\-]{1,12})?\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS (label-driven single-line, compat key) ===================== */
      address_de_street: {
        // Backward compatible key name.
        // If an address is given on the SAME LINE after label, only mask that value.
        pattern: /((?:address|shipping\s*address|billing\s*address|street)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\b/gi,
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
