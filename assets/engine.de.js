// =========================
// assets/engine.de.js
// Content-strategy pack: de (FULL – extended conservative German policy)
// - placeholders + detect + rules
// - high-sensitivity German document model
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
      TERM: "[REDACTED]",
      NAME: "[Name]"
    },

    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      if (/[äöüÄÖÜß]/.test(s)) return "de";

      if (/\b(Straße|Strasse|PLZ|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen)\b/i.test(s))
        return "de";

      return "";
    },

    priority: [
      // secrets / auth first
      "secret",
      "login",

      // identity / case / reference system (very German)
      "aktenzeichen",
      "id_label",

      // tax / government / personal documents
      "tax_id",
      "vat_id",
      "svnr",
      "id_card",
      "passport",
      "driver_license",

      // personal attributes
      "birthdate",
      "birthplace",

      // financial / banking
      "account",
      "bank",
      "blz",
      "creditcard",

      // communications
      "email",
      "url",

      // money (strict currency)
      "money",

      // phone AFTER IDs to reduce mis-hits
      "phone",

      // person names (STRICT label-driven)
      "person_name",

      // location / address
      "address_de_street",

      // organization
      "company",

      // generic
      "handle",
      "ref",
      "title",
      "number"
    ],

    alwaysOn: [
      "secret",
      "login",

      "aktenzeichen",
      "id_label",

      "tax_id",
      "vat_id",
      "svnr",
      "id_card",
      "passport",
      "driver_license",
      "birthdate",
      "birthplace",

      "account",
      "bank",
      "blz",
      "creditcard",

      "email",
      "url",
      "money",
      "phone",

      "person_name",
      "address_de_street"
    ],

    // phone FP guard (de): prevent ref/order/invoice/customer IDs being masked as phone
    phoneGuard: function ({ label, value }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      // long numeric IDs are not phones (also avoids card-like sequences)
      if (digits.length >= 16) return false;

      // label indicates reference/ID -> not phone
      if (
        /\b(?:aktenzeichen|geschäftszeichen|kundennummer|rechnungsnummer|vorgangs-?id|referenz|ticketnummer|bestellnummer)\b/i.test(
          lbl
        )
      )
        return false;

      // value itself looks like an ID prefix (defensive)
      if (/\b(?:knd|re|ord|ab|ref|v|vg|js)\s*[-/:]\s*/i.test(val)) return false;

      return true;
    },

    formatCompany: function ({ legal, punct, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
    },

    highlightCompany: function ({ match, S1, S2 }) {
      return `${S1}${match}${S2}`;
    },

    rules: {
      /* ===================== AUTH / LOGIN (label-driven) ===================== */
      login: {
        pattern: /((?:Benutzername|User(?:name)?|Login-?ID|User-?ID|Account-?ID)\s*[:：=]\s*)([^\n\r]{1,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== SECRET (label-driven) ===================== */
      secret: {
        pattern: /((?:Passwort|Kennwort|PIN|TAN|OTP|2FA|Sicherheitscode|verification\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== CASE FILE / BUSINESS REF ===================== */
      aktenzeichen: {
        pattern: /((?:Aktenzeichen|Geschäftszeichen)\s*[:：=]\s*)([A-Za-z0-9\-\/\.]{6,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== ID / REF LABELS (always-on) ===================== */
      id_label: {
        pattern: /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_\/:.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== TAX (DE) ===================== */
      tax_id: {
        pattern: /((?:Steuer-?ID|Steueridentifikationsnummer)\s*[:：=]\s*)(\d[\d \t]{8,20}\d)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      vat_id: {
        pattern: /((?:USt-?IdNr\.?|Umsatzsteuer-?ID)\s*[:：=]\s*)(DE\s?\d{8,12})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== SOCIAL SECURITY (DE heuristic) ===================== */
      svnr: {
        pattern: /((?:Sozialversicherungsnummer|SV-Nummer|Rentenversicherungsnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\-]{5,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== DOC IDs (DE) ===================== */
      id_card: {
        pattern: /((?:Personalausweis(?:nummer|[-\s]?Nr\.?))\s*[:：=]\s*)([A-Z0-9]{5,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:Reisepass(?:nummer|[-\s]?Nr\.?))\s*[:：=]\s*)([A-Z0-9]{5,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern: /((?:Führerschein(?:nummer|[-\s]?Nr\.?))\s*[:：=]\s*)([A-Z0-9]{5,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== PERSONAL ATTRIBUTES ===================== */
      birthdate: {
        pattern: /((?:Geburtsdatum|Geb\.?\s*Datum)\s*[:：=]\s*)(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthplace: {
        pattern: /((?:Geburtsort)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== FINANCIAL / BANKING ===================== */
      account: {
        // IBAN / Kontonummer / Account Number
        pattern: /((?:IBAN|Kontonummer|Account(?:\s*Number)?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        // BIC / SWIFT
        pattern: /((?:BIC|SWIFT|SWIFT\s*Code)\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      blz: {
        // Bankleitzahl / BLZ
        pattern: /((?:Bankleitzahl|BLZ)\s*[:：=]\s*)(\d{5,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      creditcard: {
        // label-driven card number (avoid swallowing random IDs)
        pattern: /((?:Kreditkarte|Kartennummer|Card(?:\s*Number)?|Visa|Mastercard|Amex)\s*[:：=]\s*)(\d(?:[ -]?\d){12,22}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== MONEY (strict currency required) ===================== */
      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*(?:[€$£¥￥]\s*)?\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*[€$£¥￥])/giu,
        tag: "MONEY"
      },

      /* ===================== COMMUNICATION ===================== */
      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        // avoid eating trailing brackets/quotes
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      phone: {
        // allow Telefon (Durchwahl): ...
        pattern: /((?:tel|telefon|handy|kontakt|phone|mobile|mobil|whatsapp|telegram|signal|fax)(?:\s*\([^)]+\))?\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])((?:[+＋]\s*\d{1,3}|00\s*[1-9]\d{0,2})[\d\s().-]{6,}\d)\b/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (STRICT label-driven) ===================== */
      person_name: {
        // covers: Name:, Kontakt:, Ansprechpartner:, Empfänger:
        // - Latin / German names + simple transliterations (Zhang Wei)
        pattern:
          /((?:Name|Kontakt|Ansprechpartner|Empfänger)\s*[:：=]\s*)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}){1,3})/gu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== ADDRESS (label-driven) ===================== */
      address_de_street: {
        pattern: /((?:Adresse|Anschrift|Straße|Strasse|PLZ|Postleitzahl)\s*[:：=]\s*)([^\n\r]{4,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|KG|GbR|e\.K\.)\b/g,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== HANDLE ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== REF ===================== */
      ref: {
        pattern: /\b[A-Z]{2,6}-?\d{4,14}\b/g,
        tag: "REF"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s\-]{6,30}\d\b/g,
        tag: "NUMBER"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/g,
        tag: "TITLE"
      }
    }
  };
})();
