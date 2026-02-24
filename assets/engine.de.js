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
      "secret",

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
      "aktenzeichen",
      "id_label",
      "tax_id",
      "vat_id",
      "svnr",
      "id_card",
      "passport",
      "driver_license",
      "birthdate",
      "account",
      "bank",
      "blz",
      "creditcard",
      "email",
      "url",
      "phone",
      "person_name",
      "address_de_street"
    ],

    phoneGuard: function ({ label, value }) {
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      if (digits.length >= 16) return false;
      if (/\b(?:aktenzeichen|kundennummer|rechnungsnummer|vorgangs-id|referenz)\b/i.test(val)) return false;

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
      secret: {
        pattern: /((?:Passwort|Kennwort|PIN|TAN|OTP|2FA)[\s:：=]+)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      aktenzeichen: {
        pattern: /((?:Aktenzeichen|Geschäftszeichen)[\s:：=]+)([A-Za-z0-9\-\/\.]{6,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      id_label: {
        pattern: /((?:Kundennummer|Rechnungsnummer|Vorgangs-ID|Referenz|Ticketnummer)[\s:：=]+)([A-Za-z0-9\-_]{4,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      tax_id: {
        pattern: /((?:Steuer-?ID|Steueridentifikationsnummer)[\s:：=]+)(\d[\d\s]{8,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      vat_id: {
        pattern: /((?:USt-?IdNr\.?|Umsatzsteuer-?ID)[\s:：=]+)(DE\s?\d{8,12})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      svnr: {
        pattern: /((?:Sozialversicherungsnummer|SV-Nummer)[\s:：=]+)([A-Za-z0-9\s\-]{6,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      id_card: {
        pattern: /((?:Personalausweis(?:nummer|[-\s]?Nr\.?))[\\s:：=]+)([A-Z0-9]{5,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:Reisepass(?:nummer|[-\s]?Nr\.?))[\\s:：=]+)([A-Z0-9]{5,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern: /((?:Führerschein(?:nummer|[-\s]?Nr\.?))[\\s:：=]+)([A-Z0-9]{5,20})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthdate: {
        pattern: /((?:Geburtsdatum)[\s:：=]+)(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthplace: {
        pattern: /((?:Geburtsort)[\s:：=]+)([^\n\r]{2,80})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      creditcard: {
        pattern: /\b(?:\d[ -]*?){13,19}\b/g,
        tag: "ACCOUNT"
      },

      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s]+/giu,
        tag: "URL"
      },

      phone: {
        pattern: /((?:Telefon|Handy|Mobil|Fax)[\s:：=]+)([+0-9()\s\-]{6,40})/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern: /((?:Name|Kontakt|Ansprechpartner|Empfänger)[\s:：=]+)([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/g,
        tag: "NAME",
        mode: "prefix"
      },

      address_de_street: {
        pattern: /((?:Adresse|Anschrift|Straße|Strasse)[\s:：=]+)([^\n\r]{4,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|KG|GbR|e\.K\.)\b/g,
        tag: "COMPANY",
        mode: "company"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      ref: {
        pattern: /\b[A-Z]{2,6}-?\d{4,14}\b/g,
        tag: "REF"
      },

      number: {
        pattern: /\b\d[\d\s\-]{6,30}\d\b/g,
        tag: "NUMBER"
      },

      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/g,
        tag: "TITLE"
      }
    }
  };
})();
