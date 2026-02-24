// =========================
// assets/engine.en.js
// UPGRADE v6.1 (targeted fixes only)
//
// Fixes applied:
// 1) Account ID no longer treated as HANDLE
// 2) URL rule hardened against newline capture
// 3) IP rules keep labels (IP Address / IPv4 / IPv6)
//
// No unrelated logic modified.
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
      "api_key_token",
      "bearer_token",
      "handle_label",

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

      "account",
      "bank",
      "card_expiry",
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
      "address_en_extra_block",
      "address_en_extra",

      "handle",
      "number"
    ],

    alwaysOn: [
      "handle_label",
      "dob",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",
      "insurance_id",
      "ip_address",
      "money",
      "account",
      "bank",
      "card_expiry",
      "card_security",
      "person_name",
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",
      "ref_label_tail",
      "ref_generic_tail"
    ],

    rules: {

      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      /* ✅ FIX 2 – prevent newline capture */
      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'\n\r）)\]】]+/giu,
        tag: "URL"
      },

      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|recovery\s*code|backup\s*code)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      api_key_token: {
        pattern:
          /((?:api\s*key|access\s*token|refresh\s*token|client\s*secret|secret\s*key)\s*[:：=]\s*)([A-Za-z0-9._\-]{8,200})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      bearer_token: {
        pattern: /(\bauthorization\s*[:：=]\s*bearer\s+)([A-Za-z0-9._\-]{8,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ✅ FIX 1 – removed account id */
      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|handle)\s*[:：=]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      dob: {
        pattern: /((?:date\s*of\s*birth|dob)\s*[:：=]\s*\d{4}[-\/\.])(\d{2}[-\/\.]\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      place_of_birth: {
        pattern: /((?:place\s*of\s*birth|birthplace)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
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
        pattern: /((?:national\s*id|id\s*number)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_id: {
        pattern: /((?:tax\s*id|tin)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      insurance_id: {
        pattern:
          /((?:insurance|policy|claim|member)\s*(?:id|number)\s*[:：=]\s*)([A-Za-z0-9\-_.]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ✅ FIX 3 – label preserved */
      ip_address: {
        pattern:
          /((?:ip\s*address|ipv4|ipv6)\s*[:：=]\s*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern: /((?:account|iban|routing|sort\s*code|card\s*number|name\s*on\s*card)\s*[:：=]\s*)([^\n\r]+)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:swift|bic)\s*[:：=]?\s*)([A-Z0-9]+)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      card_expiry: {
        pattern: /((?:expiry|valid\s*thru)\s*[:：=]\s*)([0-9\/\-]+)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      card_security: {
        pattern: /((?:cvv|cvc)\s*[:：=]\s*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      phone: {
        pattern: /((?:phone|mobile|fax)\s*[:：=]\s*)([+＋]?\d[\d\s().-]+)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern:
          /^((?:name|customer\s*name|recipient|account\s*holder)[ \t]*[:：=][ \t]*(?:(?:mr|ms|dr|prof)\.?\s+)?)((?:[A-Z][A-Za-z'’\-]+)(?:\s+[A-Z][A-Za-z'’\-]+){0,3})/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern: /\b[A-Za-z0-9&.\- ]+\s+(LLC|Ltd\.?|Inc\.?)\b/giu,
        tag: "COMPANY"
      },

      address_en_inline_street: {
        pattern: /\b\d{1,5}[A-Za-z]?\s+[A-Za-z0-9.'’\- ]+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?)\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra_block: {
        pattern: /\b(?:Suite|Unit|Apt|Floor|Room)\b[^\n\r]{0,80}\b(?:Suite|Unit|Apt|Floor|Room)\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra: {
        pattern: /\b(?:Suite|Unit|Apt|Floor|Room)\s+[A-Za-z0-9.\-]+/giu,
        tag: "ADDRESS"
      },

      ref_label_tail: {
        pattern: /\b[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-\d{4,}\b/g,
        tag: "REF"
      },

      ref_generic_tail: {
        pattern: /\b[A-Z]{2,6}-\d{5,}\b/g,
        tag: "REF"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      number: {
        pattern: /\b\d[\d\s-]{6,}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
