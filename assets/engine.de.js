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
    // - Put id_label BEFORE phone to avoid phone hitting inside IDs
    // - Conservative DE strategy: cover typical DE identifiers via label-driven rules
    priority: [
      "secret",

      // login / user / access (critical)
      "login_label",

      // IDs / tax / documents / insurance (critical)
      "id_label",
      "vat_id",
      "tax_id",
      "tax_number",
      "svnr",
      "kvnr",
      "insurance_policy",

      "id_card",
      "passport",
      "residence_permit",
      "driver_license",

      "birthdate",
      "birthplace",
      "nationality",

      // address: label-driven + common German lines (street + PLZ/Ort)
      "address_de_street",
      "address_line",
      "plz_city",

      // bank/account + card
      "account",
      "bank",
      "blz",
      "card",

      // comms + web
      "email",
      "url",
      "ip",

      // money (always on via policy)
      "money",

      // phone AFTER id_label
      "phone",

      // remaining
      "company",
      "name_label",
      "handle",
      "ref",
      "title",
      "number"
    ],

    // ✅ language-specific always-on
    // - Ensure critical label-driven identifiers are masked without UI toggles
    alwaysOn: [
      "id_label",
      "login_label",

      "vat_id",
      "tax_id",
      "tax_number",
      "svnr",
      "kvnr",
      "insurance_policy",

      "id_card",
      "passport",
      "residence_permit",
      "driver_license",

      "birthdate",

      // address coverage is product choice; keep conservative but useful
      "address_de_street",
      "address_line",
      "plz_city",

      // bank + cards
      "account",
      "bank",
      "blz",
      "card"
    ],

    // ✅ phone FP guard (de): prevent ref/order/invoice/customer IDs being masked as phone
    phoneGuard: function ({ label, value, match }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");

      // 1) Strong ID prefixes -> NOT phone
      // Covers: KND-xxxx, RE-2026-xxxx, ORD-..., AB-..., V-..., HRB...
      if (/\b(?:knd|re|ord|ab|ref|v|hrb|hra)\s*[-:]\s*/i.test(val)) return false;

      // 2) Label indicates ID/reference/invoice -> NOT phone
      if (
        /\b(?:kundennummer|rechnungsnr|rechnungsnummer|bestellnummer|vorgangs-?id|antragsnummer|referenz|ticketnummer|vertragsnummer|policen(?:nr|nummer)?)\b/i.test(
          lbl
        )
      ) {
        return false;
      }

      // 3) Hard digit-length guard
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

      /* ===================== LOGIN / USER / ACCESS (label-driven) ===================== */
      // Conservative: only label-driven (avoid masking arbitrary tokens)
      login_label: {
        pattern:
          /((?:Benutzername|Nutzername|User(?:\s*name)?|Username|Login(?:-|\s*)ID|Login|User(?:-|\s*)ID|Benutzer(?:-|\s*)ID|Account(?:\s*Name)?|Konto(?:\s*Name)?|Zugang|Zugangs(?:-|\s*)daten)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9_.@-]{2,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== ID / REF (label-driven, always-on) ===================== */
      // Catch:
      // - Antragsnummer / Kundennummer / Vorgangs-ID / Rechnungsnr. / Bestellnummer / Ticketnummer / Referenz / Vertragsnr. / Aktenzeichen
      id_label: {
        pattern:
          /((?:Antragsnummer|Kundennummer|Vorgangs-?ID|Vorgangsnummer|Rechnungsnr\.?|Rechnungsnummer|Bestellnummer|Ticketnummer|Referenz|Vertragsnr\.?|Vertragsnummer|Aktenzeichen|Kundennr\.?|Kunden(?:-|\s*)Nr\.?)\s*[:：=]\s*)([A-Za-z]{0,12}[A-Za-z0-9]*[-_/]?\d[\dA-Za-z\-_.\/]{3,100})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== TAX / ID (DE) ===================== */
      tax_id: {
        // Steuer-ID: 12 345 678 901
        // Steueridentifikationsnummer: 12345678901
        pattern: /((?:Steuer-?ID|Steueridentifikationsnummer)\s*[:：=]\s*)(\d[\d \t]{8,20}\d)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_number: {
        // Steuernummer / Steuernr.: e.g. 123/4567/8901 or 12 345 678 901 or 1234567890
        pattern:
          /((?:Steuernummer|Steuer-?\s*Nr\.?|Steuernr\.?)\s*[:：=]\s*)(\d[\d \t\/-]{6,25}\d)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      vat_id: {
        // USt-IdNr.: DE123456789
        // Umsatzsteuer-ID: DE123456789
        pattern: /((?:USt-?IdNr\.?|Umsatzsteuer-?ID)\s*[:：=]\s*)(DE\s?\d{8,12})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== SOCIAL / HEALTH INSURANCE ===================== */
      svnr: {
        // Sozialversicherungsnummer / Rentenversicherungsnummer (label-driven, broad but bounded)
        pattern:
          /((?:Sozialversicherungsnummer|Sozialvers\.?-?Nr\.?|SV-?Nr\.?|Rentenversicherungsnummer|RV-?Nr\.?)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\/-]{6,30}[A-Za-z0-9])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      kvnr: {
        // Krankenversichertennummer / Versichertennummer / Versicherungsnummer
        pattern:
          /((?:Krankenversichertennummer|Krankenvers\.?-?Nr\.?|Versichertennummer|Versicherten-?Nr\.?|Versicherungsnummer|Versicherungs-?Nr\.?)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\/-]{6,30}[A-Za-z0-9])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      insurance_policy: {
        // Policennummer / Policen-Nr. / Police-Nr.
        pattern:
          /((?:Policen(?:-|\s*)nummer|Policen(?:-|\s*)Nr\.?|Police(?:-|\s*)nummer|Police(?:-|\s*)Nr\.?)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\/-]{4,40}[A-Za-z0-9])/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== DOC IDs (DE) ===================== */
      id_card: {
        // Personalausweis-Nr.: L01X00T47 (heuristic)
        pattern: /((?:Personalausweis-?(?:Nr\.?|nummer)?)\s*[:：=]\s*)([A-Z0-9]{6,18})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        // Reisepass-Nr.: C01X00047
        pattern: /((?:Reisepass-?(?:Nr\.?|nummer)?)\s*[:：=]\s*)([A-Z0-9]{6,18})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      residence_permit: {
        // Aufenthaltstitel / Aufenthaltserlaubnis / Niederlassungserlaubnis Nummer
        pattern:
          /((?:Aufenthaltstitel|Aufenthaltserlaubnis|Niederlassungserlaubnis)(?:\s*(?:Nr\.?|Nummer))?\s*[:：=]\s*)([A-Z0-9][A-Z0-9 \t\/-]{5,25}[A-Z0-9])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        // Führerscheinnummer
        pattern:
          /((?:Führerschein(?:-|\s*)nummer|Führerschein(?:-|\s*)Nr\.?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9 \t\/-]{5,25}[A-Z0-9])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== BIRTH / DEMO ===================== */
      birthdate: {
        // Geburtsdatum: 1990-03-14 / 14.03.1990
        pattern: /((?:Geburtsdatum|Geb\.?\s*Datum)\s*[:：=]\s*)(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthplace: {
        // Geburtsort: Köln
        pattern: /((?:Geburtsort)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      nationality: {
        // Staatsangehörigkeit: deutsch
        pattern: /((?:Staatsangehörigkeit|Nationalität)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== MONEY (strict currency required) ===================== */
      money: {
        pattern: /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*(?:[€$£¥￥]\s*)?\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,'\s]\d{3})*(?:[.,]\d{2})?\s*[€$£¥￥])/giu,
        tag: "MONEY"
      },

      /* ===================== SECRET (label-driven) ===================== */
      // Expanded for DE banking & recovery terms (TAN/PUK etc.)
      secret: {
        pattern:
          /((?:Passwort|PIN|PUK|OTP|2FA|TAN|mTAN|pushTAN|Sicherheitscode|Recovery(?:\s*Code)?|Backup(?:\s*Code)?|verification\s*code|one[-\s]?time\s*code)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        // DO NOT allow \n inside value
        pattern:
          /((?:Kontonummer|Account(?:\s*Number)?|IBAN|USt-?IdNr\.?)\s*[:：=]\s*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        // DO NOT allow \n in the grouped blocks
        pattern:
          /((?:IBAN|BIC|SWIFT|SWIFT\s*Code|Bank\s*(?:Account|Details))\s*[:：=]?\s*)([A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]{4}){3,7}|[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      blz: {
        // Bankleitzahl: 37040044 / BLZ: 37040044
        pattern: /((?:Bankleitzahl|BLZ)\s*[:：=]\s*)(\d{5,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== CARD (label-driven) ===================== */
      // Conservative: only when explicitly labeled (avoid catching random long numbers)
      card: {
        pattern:
          /((?:Kreditkarte|Kreditkarten(?:-|\s*)nummer|Kartennummer|Card(?:\s*Number)?|PAN|CVC|CVV|Sicherheitscode(?:\s*Karte)?|Ablaufdatum|Expiry)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9 \t\/-]{2,40}[A-Za-z0-9])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IP ADDRESS ===================== */
      ip: {
        // IPv4 and basic IPv6 (conservative)
        pattern:
          /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})\b|\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/giu,
        tag: "SECRET"
      },

      /* ===================== PHONE (label-driven + intl) ===================== */
      phone: {
        pattern:
          /((?:tel|telefon|handy|kontakt|phone|mobile|mobil|whatsapp|telegram|signal|fax)(?:\s*\([^)]+\))?\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])((?:[+＋]\s*\d{1,3}|00\s*[1-9]\d{0,2})[\d\s().-]{6,}\d)\b/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== ADDRESS (label-driven + typical DE lines) ===================== */
      address_de_street: {
        pattern: /((?:Adresse|Address|Straße|Strasse)\s*[:：=]?\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_line: {
      // e.g. Musterstraße 12 / Marienplatz 1
      // Avoid false positives like "Lagerplatz 12-07-03", "Parkplatz 3"
        pattern:/\b(?!Lagerplatz\b)(?!Parkplatz\b)(?!Stellplatz\b)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{1,50}(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|ufer|damm|promenade)\s+\d{1,6}[A-Za-z]?)\b/giu,
        tag: "ADDRESS"
      },

      plz_city: {
        // e.g. 50667 Köln / 10115 Berlin
        pattern: /\b(\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{2,50})\b/gu,
        tag: "ADDRESS"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern: /\b([A-Za-z][A-Za-z0-9&.\- ]{1,60})\s+(GmbH|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC)\b/gi,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== NAME (label-driven only; conservative) ===================== */
      // Mask the whole name/value after label (avoid generic NER)
      name_label: {
        pattern:
          /((?:Kontakt|Ansprechpartner|Ansprechperson|Bearbeiter|Sachbearbeiter|Kunde|Kundin|Empfänger|Empfaenger)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
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
