// assets/engine.de.js
// Content-strategy pack: de (NOT UI language)

(function () {
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
    }
  };
})();
