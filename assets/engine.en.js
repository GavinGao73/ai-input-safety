// =========================
// assets/engine.en.js
// Content-strategy pack: en (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting
//
// PATCH (this file, v1 upgrade):
// - E1: Priority/alwaysOn restructured (auth/ids before phone; money explicit only).
// - E2: Fix misnamed "address_de_street" -> proper en keys (address_en_*).
// - E3: Add login/auth labels + split secrets vs handle.
// - E4: Add government/identity IDs common in en: SSN, EIN, passport, DL, national ID (label-driven).
// - E5: Add credit-card fields (label-driven), CVV/CVC kept as SECRET.
// - E6: Add inline address rules (street+no + apt/unit/suite/floor/room) BUT do NOT mask ZIP/city/state.
// - E7: Strengthen phoneGuard to avoid refs/invoices/tickets/order IDs being treated as phone.
// - E8: Company regex upgraded with named groups (?<name>, ?<legal>) for consistent formatCompany.
//
// NOTE: No engine.js changes required; pack-only upgrade.
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

      // English hints (lightweight)
      if (/\b(Invoice|Order|Account|Username|Address|Phone|Email|Customer|Payment|Bank|SSN|Passport)\b/i.test(s))
        return "en";
      if (/[A-Za-z]/.test(s) && !/[\u4E00-\u9FFF]/.test(s)) return "en";

      return "";
    },

    // ✅ language-specific execution order (conservative, minimize cross-hits)
    priority: [
      // auth first
      "secret",
      "login",

      // labeled references/ids before phone
      "ref_label",

      // identity/government (label-driven)
      "ssn",
      "ein",
      "passport",
      "driver_license",
      "national_id",

      // banking/payment
      "account",
      "bank",
      "creditcard",

      // comms
      "email",
      "url",

      // money explicit currency only
      "money",

      // phone after refs/ids
      "phone",

      // org/person
      "company",
      "person_name",

      // address (street+no, apt/unit/suite/floor/room)
      "address_en_inline_street",
      "address_en_extra",
      "address_en_label",

      // generic
      "handle_label",
      "handle",
      "title",
      "ref",
      "number"
    ],

    // ✅ language-specific always-on (conservative security)
    alwaysOn: [
      "secret",
      "login",
      "ref_label",

      "ssn",
      "ein",
      "passport",
      "driver_license",
      "national_id",

      "account",
      "bank",
      "creditcard",

      "email",
      "url",
      "money",
      "phone",

      "company",

      // address masking kept always-on per your conservative posture,
      // but scoped to street+no and apt/unit/suite/floor/room only.
      "address_en_inline_street",
      "address_en_extra",
      "address_en_label",

      // name: label-driven only to avoid massive FP in English
      "person_name"
    ],

    // ✅ phone FP guard (en): prevent ref/order/invoice/customer IDs being masked
    phoneGuard: function ({ label, value, match }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      // Very long numeric strings => not phone (cards/ids)
      if (digits.length >= 16) return false;

      // Label indicates not-a-phone
      if (
        /\b(?:invoice|order|ticket|case|reference|ref|request|application|customer\s*id|account\s*number|routing|iban|swift|bic)\b/i.test(
          lbl
        )
      ) {
        return false;
      }

      // Value looks like structured ref
      if (/\b(?:inv|invoice|ord|order|req|case|ref|ticket)\s*[-:#/]/i.test(val)) return false;

      return true;
    },

    // ✅ company formatting (en): conservative
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
      // Covers: $1,200.00 | USD 1200 | 1200 USD | € 99,90 | GBP 2,300 | 2,300 GBP
      money: {
        pattern:
          /(?:\b(?:USD|EUR|GBP|CHF|CAD|AUD|NZD|SGD|HKD|CNY|RMB|JPY)\b\s*\$?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:USD|EUR|GBP|CHF|CAD|AUD|NZD|SGD|HKD|CNY|RMB|JPY)\b|[$€£¥￥]\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)/giu,
        tag: "MONEY"
      },

      /* ===================== AUTH / LOGIN (label-driven) ===================== */
      // Username/Login ID/User ID/Account ID etc. => HANDLE
      login: {
        pattern: /((?:username|user\s*name|login-?id|login\s*id|user-?id|account-?id|handle)\s*[:：=]\s*)([^\n\r]{1,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== SECRET (label-driven) ===================== */
      // Password/PIN/OTP/2FA/CVV/CVC etc. => SECRET
      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code|cvv|cvc)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== REF / CASE / ORDER (label-driven) ===================== */
      ref_label: {
        pattern:
          /((?:application\s*(?:id|no\.?|number)|order\s*(?:id|no\.?|number)|invoice\s*(?:id|no\.?|number)|reference|ref\.?|case\s*(?:id|no\.?|number)|ticket\s*(?:id|no\.?|number)|request\s*(?:id|no\.?|number)|customer\s*(?:id|no\.?|number))\s*(?:[:：=]|-)\s*)([A-Za-z0-9][A-Za-z0-9\-_.\/:#]{2,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== IDENTITY / GOV (label-driven) ===================== */
      // SSN: 123-45-6789 / 123456789
      ssn: {
        pattern: /((?:ssn|social\s*security\s*(?:number|no\.?))\s*[:：=]\s*)(\d{3}[-\s]?\d{2}[-\s]?\d{4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      // EIN: 12-3456789
      ein: {
        pattern: /((?:ein|employer\s*identification\s*(?:number|no\.?))\s*[:：=]\s*)(\d{2}[-\s]?\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:passport\s*(?:number|no\.?)|passport\s*#)\s*[:：=]\s*)([A-Za-z0-9]{6,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern:
          /((?:driver'?s\s*license\s*(?:number|no\.?)|driving\s*license\s*(?:number|no\.?)|dl\s*(?:number|no\.?)|license\s*#)\s*[:：=]\s*)([A-Za-z0-9\-]{5,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern:
          /((?:national\s*id\s*(?:number|no\.?)|id\s*card\s*(?:number|no\.?)|identity\s*(?:number|no\.?)|government\s*id)\s*[:：=]\s*)([A-Za-z0-9\-]{5,30})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern:
          /((?:account(?:\s*number)?|iban|tax\s*(?:id|number)|vat\s*(?:id|number)|cardholder|name\s*on\s*card)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d|[^\n\r]{2,80})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern:
          /((?:iban|bic|swift|swift\s*code|routing\s*number|sort\s*code|bank\s*(?:account|details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Za-z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== CREDIT CARD (label-driven) ===================== */
      creditcard: {
        pattern:
          /((?:credit\s*card|debit\s*card|card\s*number|card\s*no\.?|card\s*#|visa|mastercard|amex)\s*[:：=]\s*)(\d(?:[ -]?\d){12,22}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern:
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])((?:[+＋]\s*\d{1,3}|00\s*[1-9]\d{0,2})[\d\s().-]{6,}\d)\b/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (STRICT label-driven) ===================== */
      // English names are too ambiguous; only label-driven, allow optional title.
      person_name: {
        pattern:
          /((?:name|contact|recipient|attention|attn\.?|account\s*holder|customer\s*name)\s*[:：=]\s*)((?:(?:mr|mrs|ms|dr|prof)\.?\s+)?[A-Z][A-Za-z'\-]{1,40}(?:\s+[A-Z][A-Za-z'\-]{1,40}){0,3})/giu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        // Named groups enable formatCompany to keep legal suffix (Inc/LLC/Ltd/PLC/etc.)
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,80}?)\s+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|GmbH)\b/gu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS (inline street+no only; no ZIP/city/state) ===================== */
      // Examples:
      //  - 221B Baker Street
      //  - 1600 Amphitheatre Parkway
      //  - 10 Downing St.
      // Conservative: requires a street-type + number.
      address_en_inline_street: {
        pattern:
          /\b\d{1,6}\s+[A-Z0-9][A-Za-z0-9.\-']{1,30}(?:\s+[A-Z0-9][A-Za-z0-9.\-']{1,30}){0,6}\s+(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Boulevard|Blvd\.|Lane|Ln\.|Drive|Dr\.|Way|Court|Ct\.|Place|Pl\.|Square|Sq\.|Parkway|Pkwy\.|Highway|Hwy\.|Terrace|Ter\.|Circle|Cir\.)\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS (extras: apt/unit/suite/floor/room) ===================== */
      address_en_extra: {
        pattern:
          /((?:apt\.?|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?)\s*[:：=]?\s*)([A-Za-z0-9.\-]{1,20}(?:\s*(?:,|-)\s*[A-Za-z0-9.\-]{1,20}){0,3})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== ADDRESS (label-driven, but still street+no focus) ===================== */
      address_en_label: {
        // Require address-like value: contains a number + a street-type word OR apt/unit marker.
        pattern:
          /((?:address|shipping\s*address|billing\s*address|street\s*address|street)\s*[:：=]?\s*)((?=[^\n\r]{3,160}$)(?=[^\n\r]{0,160}(?:\d{1,6}\s+.*\b(?:Street|St\.|Road|Rd\.|Avenue|Ave\.|Boulevard|Blvd\.|Lane|Ln\.|Drive|Dr\.|Way|Court|Ct\.|Place|Pl\.|Square|Sq\.|Parkway|Pkwy\.|Highway|Hwy\.|Terrace|Ter\.|Circle|Cir\.)\b|\b(?:apt\.?|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?)\b))[^\n\r]{3,160})/giu,
        tag: "ADDRESS",
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
