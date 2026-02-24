// =========================
// assets/engine.en.js
// UPGRADE v2 (tail-safe + ERR/SKU safe)
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

      if (/[äöüÄÖÜß]/.test(s)) return "";
      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      if (han / Math.max(1, s.length) > 0.03) return "";

      if (/[A-Za-z]/.test(s)) return "en";
      return "";
    },

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
      "address_de_street",

      "handle",
      "title",
      "number"
    ],

    alwaysOn: [
      "handle_label",
      "ref_label",
      "ref_taildigits",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id"
    ],

    phoneGuard: function ({ label, value }) {
      const lbl = String(label || "").toLowerCase();
      if (/\b(id|reference|order|case|ticket)\b/.test(lbl)) return false;
      return true;
    },

    formatCompany: function ({ legal, punct, placeholder }) {
      if (legal) return `${placeholder("COMPANY")} ${legal}${punct || ""}`;
      return `${placeholder("COMPANY")}${punct || ""}`;
    },

    rules: {

      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"']+/giu,
        tag: "URL"
      },

      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF)\b|[€$£])\s*\d+(?:[.,]\d{2})?/giu,
        tag: "MONEY"
      },

      secret: {
        pattern:
          /((?:password|pin|otp|verification\s*code|security\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      handle_label: {
        pattern:
          /((?:username|login|account\s*id)\s*[:：=]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      passport: {
        pattern:
          /((?:passport(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9\-]{5,})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern:
          /((?:driver[’']?s\s*license(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9\-]{5,})/giu,
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
        pattern:
          /((?:ein)\s*[:：=]\s*)(\d{2}-\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern:
          /((?:id\s*number|national\s*id)\s*[:：=]\s*)([A-Za-z0-9\-]{4,})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern:
          /((?:account|iban|card\s*number)\s*[:：=]\s*)([A-Z0-9\s\-]{6,})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern:
          /((?:swift|bic)\s*[:：=]?\s*)([A-Z0-9]{6,})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      ref_label: {
        pattern:
          /((?:case|order|reference|customer)\s*(?:id|number)?\s*[:：=]\s*(?:[A-Za-z0-9\-_.]{0,80}?[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_taildigits: {
        pattern:
          /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      phone: {
        pattern:
          /((?:phone|mobile|tel)\s*[:：=]?\s*)([+＋]?\d[\d\s().-]{5,}\d)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern:
          /((?:name|customer\s*name)\s*[:：=]\s*)([A-Z][A-Za-z'’\-]{1,40}(?:\s+[A-Z][A-Za-z'’\-]{1,40}){0,3})/giu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>LLC|Ltd\.?|Inc\.?)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      address_en_inline_street: {
        pattern:
          /\b\d{1,5}[A-Za-z]?\s+(?:[A-Za-z0-9.'’\-]+\s+){0,6}(?:street|st\.?|road|rd\.?|avenue|ave\.?)\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra: {
        pattern:
          /\b(?:apt|unit|suite|floor|room)\s*#?\s*[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      address_de_street: {
        pattern:
          /((?:address)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      title: {
        pattern: /\b(Mr\.?|Ms\.?|Dr\.?)\b/gi,
        tag: "TITLE"
      },

      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
