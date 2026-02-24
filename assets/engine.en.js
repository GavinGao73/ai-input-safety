// =========================
// assets/engine.en.js
// UPGRADE v6 (address single-tag + sensitive data expansion)
// - Address: one [Address] per line (block rule before granular extras)
// - Add sensitive data (EN):
//   1) IP (IPv4/IPv6)
//   2) API keys / tokens (label-driven + Bearer)
//   3) Card expiry (MM/YY etc.)
//   4) Insurance IDs (policy/claim/member/insurance id) label-driven
//   5) Place of Birth (label-driven)
//   6) MAC + IMEI (label-driven)
// - Keep: tail-safe ID masking + ERR/SKU safe + banking + money
// - Keep: person_name single-line, keep title, mask name only
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
      // secrets / auth first
      "secret",
      "api_key_token",
      "bearer_token",
      "handle_label",

      // personal attributes
      "dob",
      "place_of_birth",

      // identity (label-driven, low FP)
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      // insurance (label-driven)
      "insurance_id",

      // device / network identifiers
      "ip_address",
      "mac_address",
      "imei",

      // financial
      "account",
      "bank",
      "card_expiry",
      "card_security",

      // comms
      "email",
      "url",

      // refs / IDs
      "ref_label_tail",
      "ref_generic_tail",

      // money (explicit currency only)
      "money",

      // phone AFTER refs/ids to reduce mis-hits
      "phone",

      // person / org
      "person_name",
      "company",

      // address model (inline only)
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      // generic
      "handle",
      "number"
    ],

    alwaysOn: [
      "handle_label",

      "api_key_token",
      "bearer_token",

      "dob",
      "place_of_birth",

      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      "insurance_id",

      "ip_address",
      "mac_address",
      "imei",

      "money",
      "account",
      "bank",
      "card_expiry",
      "card_security",

      // ensure names always run
      "person_name",

      // address
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      // ref tail safety
      "ref_label_tail",
      "ref_generic_tail"
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

      // hard-block ID prefixes in any context
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
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code|recovery\s*code|backup\s*code)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== API KEY / TOKEN (label-driven) ===================== */
      api_key_token: {
        pattern:
          /((?:api\s*key|x-api-key|access\s*token|refresh\s*token|token|auth\s*token|authorization|bearer\s*token|client\s*secret|secret\s*key)\s*[:：=]\s*)([A-Za-z0-9._\-]{8,200})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Bearer token (common inline form) ===================== */
      bearer_token: {
        pattern: /(\bauthorization\s*[:：=]\s*bearer\s+)([A-Za-z0-9._\-]{8,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|account\s*id|handle)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== DOB (mask month+day, keep year) ===================== */
      dob: {
        pattern: /((?:date\s*of\s*birth|dob)\s*[:：=]\s*\d{4}[-\/\.])(\d{2}[-\/\.]\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== PLACE OF BIRTH (label-driven) ===================== */
      place_of_birth: {
        pattern: /((?:place\s*of\s*birth|pob|birthplace)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
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
        pattern:
          /((?:national\s*id(?:\s*(?:no\.?|number))?|id\s*number)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== TAX ID (EN) ===================== */
      tax_id: {
        pattern:
          /((?:tax\s*id|tax\s*identification\s*(?:no\.?|number)|tin)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-]{4,32})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== INSURANCE IDs (label-driven) ===================== */
      insurance_id: {
        pattern:
          /((?:insurance\s*(?:id|no\.?|number)|policy\s*(?:id|no\.?|number)|claim\s*(?:id|no\.?|number)|member\s*(?:id|no\.?|number)|membership\s*(?:id|no\.?|number))\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,60})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IP ADDRESS (IPv4 + IPv6, conservative) ===================== */
      ip_address: {
        pattern:
          /\b(?:(?:ip(?:v4|v6)?\s*(?:address)?)\s*[:：=]\s*)?((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
        tag: "SECRET"
      },

      /* ===================== MAC ADDRESS (label-driven OR standalone MAC) ===================== */
      mac_address: {
        pattern:
          /((?:mac\s*(?:address)?)\s*[:：=]\s*)?(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IMEI (label-driven) ===================== */
      imei: {
        pattern: /((?:imei)\s*[:：=]\s*)(\d{14,16})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== BANK / PAYMENT (label-driven) ===================== */
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

      /* ===================== CARD EXPIRY (label-driven) ===================== */
      card_expiry: {
        pattern:
          /((?:exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*through)\s*[:：=]\s*)(\d{2}\s*\/\s*\d{2,4}|\d{2}\s*-\s*\d{2,4}|\d{4}\s*-\s*\d{2})/giu,
        tag: "SECRET",
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
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (single-line; keep title, mask name only) ===================== */
      person_name: {
        pattern:
          /^((?:name|customer\s*name|account\s*holder|recipient|name\s*on\s*card)[ \t]*[:：=][ \t]*(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?)((?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})[ \t]*$/gmiu,
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

      /* ===================== ADDRESS extras block (ONE [Address] per line) ===================== */
      address_en_extra_block: {
        // Whole-line block like: "Suite 200, Floor 3, Room 3.12" (or similar combinations)
        // Requires at least TWO keywords in the same line to trigger.
        pattern:
          /\b(?:suite|ste\.?|apt|apartment|unit|floor|fl\.?|room|rm\.?)\b[^\n\r]{0,80}\b(?:suite|ste\.?|apt|apartment|unit|floor|fl\.?|room|rm\.?)\b[^\n\r]{0,80}\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS extras (single item; value must contain digit) ===================== */
      address_en_extra: {
        // Example: "Apt 5B" / "Unit 2A" / "Room 3.12"
        // Value MUST contain a digit (prevents "room ONLY" etc.)
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?|dept|department)\b(?:\s+#?\s*|#\s*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== REF/ID — LABEL-DRIVEN TAIL MASK (SAFE) ===================== */
      ref_label_tail: {
        pattern:
          /((?:(?:application|order|invoice|reference|ref\.?|case|ticket|request|customer)\s*(?:id|no\.?|number)?\s*(?:[:：=]|-)\s*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== REF/ID — GENERIC TAIL MASK (SAFE) ===================== */
      ref_generic_tail: {
        pattern: /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== HANDLE (generic) ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
