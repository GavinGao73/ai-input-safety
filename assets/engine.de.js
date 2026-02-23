// =========================
// assets/engine.de.js
// Content-strategy pack: de (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting
// =========================

(function () {
  "use strict";

  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});

  PACKS.de = {
    lang: "de",

    placeholders: {
      PHONE: "[Telefon]",
      EMAIL: "[E-Mail]",
      URL: "[URL]",
      SECRET: "[Geheim]",
      ACCOUNT: "[Konto]",
      ADDRESS: "[Adresse]",
      HANDLE: "[Handle]",
      REF: "[Referenz]",
      TITLE: "[Anrede]",
      NUMBER: "[Zahl]",
      MONEY: "[Betrag]",
      COMPANY: "[Firma]",
      TERM: "[REDACTED]"
    },

    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      if (/[äöüÄÖÜß]/.test(s)) return "de";
      if (/\b(Straße|Strasse|PLZ|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Kundennummer)\b/i.test(s)) return "de";

      return "";
    },

    // ✅ language-specific execution order
    priority: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "money",
      "phone",
      "company",
      "address_de_street",
      "handle",
      "ref",
      "title",
      "number"
    ],

    // ✅ language-specific always-on
    alwaysOn: ["address_de_street"],

    // ✅ phone FP guard (de): prevent ref-like IDs being masked
    phoneGuard: function ({ label, value, match }) {
      const digits = String(value || "").replace(/\D+/g, "");
      if (digits.length >= 16) return false;
      return true;
    },

    // ✅ company formatting (de): conservative
    formatCompany: function ({ legal, punct, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
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
        pattern: /((?:Passwort|PIN|OTP|2FA|Sicherheitscode|verification\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern: /((?:Kontonummer|Account(?:\s*Number)?|IBAN|Steuer(?:\s*ID|nummer)?|USt-?IdNr\.?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern: /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern: /((?:tel|telefon|handy|kontakt|phone|mobile|whatsapp|telegram|signal)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== ADDRESS (label-driven only) ===================== */
      address_de_street: {
        pattern: /((?:Adresse|Address|Straße|Strasse)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC)\b/gi,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/gi,
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
