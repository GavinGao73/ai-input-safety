// =========================
// assets/engine.de.js
// Content-strategy pack: de (FULL – extended conservative German policy)
// - placeholders + detect + rules
// - high-sensitivity German document model
//
// PATCH (this file):
// - D1: person_name swallows optional titles (Frau/Herr/Dr./Prof.) in labeled name fields,
//       preventing split-masking like "Name: [Name]: [Anrede] Li Na".
// - D2: company rule upgraded with named groups (?<name>, ?<legal>) so output keeps legal form (GmbH/AG/...).
// - D3: address model fixed for real German address blocks:
//       (a) add inline address lines (street+houseNo, PLZ+city) even without labels
//       (b) split Zusatz into its own label-driven rule (always-on, conservative)
//       (c) label-driven address now requires address-like value (digits/street/plz keywords) to avoid eating company lines
// - D4: priority reordered: company BEFORE address rules; inline address BEFORE label-driven address.
// - D5: inline street rule upgraded to handle German block addresses without suffix (e.g., "Domkloster 4"),
//       line-anchored + negative keywords to reduce warehouse/sku false positives.
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

      if (
        /\b(Straße|Strasse|PLZ|Postleitzahl|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Zusatz|Geburtsdatum|Geburtsort|USt-IdNr)\b/i.test(
          s
        )
      )
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

      // ✅ organization BEFORE address (prevents company line being treated as address context)
      "company",

      // ✅ address lines WITHOUT labels (common in forms: block-style addresses)
      "address_de_inline_street",
      "address_de_inline_plz_city",

      // ✅ label-driven extras (conservative: Gebäude/OG/Zimmer...)
      "address_de_extra",

      // label-driven address (requires address-like value)
      "address_de_street",

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

      // ✅ keep company + addresses always-on for conservative German policy
      "company",
      "address_de_inline_street",
      "address_de_inline_plz_city",
      "address_de_extra",
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
        /\b(?:aktenzeichen|geschäftszeichen|kundennummer|rechnungsnummer|rechnungsnr|vorgangs-?id|referenz|ticketnummer|bestellnummer|antragsnummer)\b/i.test(
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
        pattern:
          /((?:Passwort|Kennwort|PIN|TAN|OTP|2FA|Sicherheitscode|verification\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
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
        pattern:
          /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_\/:.]{3,80})/giu,
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
        pattern:
          /((?:Sozialversicherungsnummer|SV-Nummer|Rentenversicherungsnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\-]{5,40})/giu,
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
        pattern:
          /((?:IBAN|Kontonummer|Account(?:\s*Number)?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
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
        pattern:
          /((?:Kreditkarte|Kartennummer|Card(?:\s*Number)?|Visa|Mastercard|Amex)\s*[:：=]\s*)(\d(?:[ -]?\d){12,22}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== MONEY (strict currency required) ===================== */
      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*(?:[€$£¥￥]\s*)?\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*[€$£¥￥])/giu,
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
        pattern:
          /((?:tel|telefon|handy|kontakt|phone|mobile|mobil|whatsapp|telegram|signal|fax)(?:\s*\([^)]+\))?\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])((?:[+＋]\s*\d{1,3}|00\s*[1-9]\d{0,2})[\d\s().-]{6,}\d)\b/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (STRICT label-driven) ===================== */
      person_name: {
        // covers: Name:, Kontakt:, Ansprechpartner:, Empfänger:
        // - swallows optional titles to prevent split: "Frau Li Na" => [Name]
        // - supports apostrophes/hyphens (O'Neil, Müller-Lüdenscheidt)
        pattern:
          /((?:Name|Kontakt|Ansprechpartner|Empfänger)\s*[:：=]\s*)((?:(?:Herr|Frau|Dr\.?|Prof\.?)\s+)?[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}){1,3})/gu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        // Named groups enable formatCompany to keep legal suffix (GmbH/AG/...)
        pattern: /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>GmbH|AG|UG|KG|GbR|e\.K\.)\b/gu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS (inline, no label) ===================== */
      address_de_inline_street: {
        // Block-style German address line (no label):
        // - Musterstraße 12
        // - Domkloster 4
        // - Am Ring 12-14
        // - Unter den Linden 77a
        //
        // Conservative:
        // - requires house number
        // - line-anchored to reduce accidental matches
        // - negative keywords to avoid warehouse/sku/error-code lines
        // - only allows at most one "-" range, so "12-07-03" won't match
        pattern:
          /^(?!.*\b(?:Lagerplatz|Regal|Fach|SKU|Fehlercode|ERR|Testwert|Artikel|Gutschrift|Kontonummer|Bankleitzahl)\b)(?:[A-ZÄÖÜ][\p{L}.'\-]{1,40}(?:\s+[A-ZÄÖÜ][\p{L}.'\-]{1,40}){0,3})\s+\d{1,4}(?:\s*[A-Za-z])?(?:-\d{1,4})?$/gmu,
        tag: "ADDRESS"
      },

      address_de_inline_plz_city: {
        // Examples: 50667 Köln | 50667 Köln (NRW) | 10115 Berlin
        pattern: /\b\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{1,50}(?:\s*\([A-Z]{2,4}\))?\b/gu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS (label-driven extras) ===================== */
      address_de_extra: {
        // Zusatz: Gebäude A, 3. OG, Zimmer 3.12  (intentionally conservative)
        pattern: /((?:Zusatz)\s*[:：=]\s*)([^\n\r]{2,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== ADDRESS (label-driven, requires address-like value) ===================== */
      address_de_street: {
        // Avoid eating company lines: value must look address-like (contains digits, PLZ, or street keywords)
        pattern:
          /((?:Adresse|Anschrift|Straße|Strasse|PLZ|Postleitzahl|Rechnungsadresse|Lieferadresse)\s*[:：=]\s*)((?=[^\n\r]{4,140}$)(?=[^\n\r]{0,140}(?:\d{5}\b|\d{1,4}\s*[A-Za-z]?\b|straße\b|strasse\b|str\.\b|weg\b|platz\b|allee\b|gasse\b|ring\b|ufer\b|damm\b|chaussee\b|promenade\b|markt\b|hof\b|kai\b))[^\n\r]{4,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
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
