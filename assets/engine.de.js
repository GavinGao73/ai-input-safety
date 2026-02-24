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
      if (
        /\b(Straße|Strasse|PLZ|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Kundennummer)\b/i.test(
          s
        )
      )
        return "de";

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

    // ✅ phone FP guard (de): prevent ref/order/invoice/customer IDs being masked as phone
  phoneGuard: function ({ label, value, match }) {
  const lbl = String(label || "").toLowerCase();
  const val = String(value || "");

  // 1) Strong ID prefixes -> NOT phone
  // Covers: KND-xxxx, RE-2026-xxxx, ORD-..., AB-..., V-...
  if (/\b(?:knd|re|ord|ab|ref|v)\s*[-:]\s*/i.test(val)) return false;

  // 2) Label indicates ID/reference/invoice -> NOT phone
  if (/\b(?:kundennummer|rechnungsnr|rechnungsnummer|bestellnummer|vorgangs-?id|antragsnummer|referenz|ticketnummer)\b/i.test(lbl)) {
    return false;
  }

  // 3) Hard digit-length guard (keep your old rule)
  const digits = val.replace(/\D+/g, "");
  if (digits.length >= 16) return false;

  return true;
},

    // ✅ company formatting (de): conservative
    // Signature aligned with core call-site: ({ raw, name, legal, punct, coreStr, placeholder })
    formatCompany: function ({ raw, name, legal, punct, coreStr, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
    },

    // ✅ company highlight for pdf overlay (de): conservative
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

           /* ===================== MONEY (strict currency required) ===================== */
      // Covers:
      //  - 1.250,00 € / € 99,90 / 12,50 EUR / EUR 12.500,00
      //  - USD $1,499.00 / $2,050.75
      //  - CHF 1'250.50
      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*(?:[€$£¥￥]\s*)?\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*[€$£¥￥])/giu,
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
        // ✅ Fix: DO NOT allow \n inside value (it was eating line breaks => "IBAN: [Konto]BIC: [Konto]")
        pattern: /((?:Kontonummer|Account(?:\s*Number)?|IBAN|Steuer(?:\s*ID|nummer)?|USt-?IdNr\.?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        // ✅ Fix: DO NOT allow \n in the grouped blocks (use [ \t]? not \s?)
        pattern: /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
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
