// =========================
// assets/engine.en.js
// UPGRADE v3 (fix placeholder-safe tail masking)
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

    detect: s => /[A-Za-z]/.test(String(s || "")) ? "en" : "",

    priority: [
      "secret",
      "handle_label",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "account",
      "bank",
      "email",
      "url",
      "ref_label",
      "ref_taildigits",
      "money",
      "phone",
      "person_name",
      "company",
      "address_en_inline_street",
      "address_en_extra",
      "number"
    ],

    alwaysOn: ["ref_label", "ref_taildigits"],

    rules: {

      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s]+/giu,
        tag: "URL"
      },

      secret: {
        pattern: /((?:password|pin|otp|verification\s*code|security\s*code)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      handle_label: {
        pattern: /((?:username|login|user\s*id)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:passport(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9\-]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern: /((?:driver[’']?s\s*license(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9\-]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ssn: {
        pattern: /((?:ssn|social\s*security\s*number)\s*[:：=]\s*)(\d{3}-\d{2}-\d{4}|\d{9})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ein: {
        pattern: /((?:ein)\s*[:：=]\s*)(\d{2}-\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern: /((?:id\s*number|national\s*id)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern: /((?:account|iban|card\s*number)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:swift|bic)\s*[:：=]?\s*)([^\n\r]+)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* 🔥 FIXED: label IDs – always remove trailing digits */
      ref_label: {
        pattern: /((?:case|ticket|order|invoice|reference|customer|application)\s*(?:id|no\.?|number)?\s*[:：=]\s*[^\n\r\-]*-)(\d{3,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* 🔥 FIXED: generic tail digits (supports [Referenz] / [Ref] prefixes) */
      ref_taildigits: {
        pattern: /\b((?!ERR-)(?!SKU:)[^\s,]*?-)(\d{3,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      phone: {
        pattern: /((?:phone|mobile|fax)\s*[:：=]?\s*)([+＋]?\d[\d\s().-]{5,})/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern: /((?:name|customer\s*name)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern: /\b[A-Za-z][A-Za-z0-9&.\- ]+\s+(LLC|Ltd\.?|Inc\.?)\b/giu,
        tag: "COMPANY"
      },

      address_en_inline_street: {
        pattern: /\b\d{1,5}[A-Za-z]?\s+[A-Za-z0-9.'’\- ]+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?)\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra: {
        pattern: /\b(?:Suite|Unit|Apt|Floor|Room)\s+[A-Za-z0-9.\-]+/giu,
        tag: "ADDRESS"
      },

      number: {
        pattern: /\b\d[\d\s-]{6,}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
