// =========================
// assets/engine.de.js
// Content-strategy pack: de (FULL – extended conservative German policy)
// - placeholders + detect + rules
// - high-sensitivity German document model
//
// LOCKED (latest candidate):
// - Keep Herr/Frau/Dr./Prof. in output; mask only the person name
// - Address: only mask street + house number; keep PLZ+City/Country
// - Zusatz: only mask Gebäude/OG/Zimmer-like fragment; keep Klingel tail
// - ID policy: keep prefix/body, mask ONLY the LAST numeric segment
//
// PATCH v20260310-de-stable-candidate:
// - Expanded German person-name labels for real-world docs
// - Added person_name_inline for inline CRM/support patterns
// - Expanded German company legal suffix coverage
// - Added money_negative for negative amounts in statements/invoices
// - Removed "kontakt" from phone labels to reduce false positives
// - Kept patch structure but consolidated obvious risk fixes
//
// PATCH v20260310-de-audit-fix:
// - FIX 1: exclude IBAN/DE IBAN values from phoneGuard
// - FIX 2: allow api_key_token matches without colon, e.g. "API Key abc123"
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

      if (
        /\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Kontoinhaber|Ansprechpartner|Ansprechperson|Kontaktperson|Kundename|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Zusatz|Geburtsdatum|Geburtsort|USt-IdNr|Sachbearbeiter|Bearbeiter|Rechnungsempfänger)\b/i.test(
          s
        )
      ) {
        return "de";
      }

      return "";
    },

    priority: [
      "secret",
      "login",

      "aktenzeichen_tail",
      "id_label_tail",
      "ref_generic_tail_de",

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

      "money_negative",
      "money",

      "phone",

      "person_name_keep_title",
      "person_name_inline",
      "person_name",

      "company",

      "address_de_inline_street",
      "address_de_extra_partial",
      "address_de_street_partial",

      "handle",
      "number"
    ],

    alwaysOn: [
      "secret",
      "login",

      "aktenzeichen_tail",
      "id_label_tail",
      "ref_generic_tail_de",

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
      "money_negative",
      "money",
      "phone",

      "person_name_keep_title",
      "person_name_inline",
      "person_name",

      "company",
      "address_de_inline_street",
      "address_de_extra_partial",
      "address_de_street_partial"
    ],

    phoneGuard: function ({ label, value }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      if (digits.length >= 16) return false;

      if (/^DE\d{2}/i.test(val.trim())) return false;
      if (/\biban\b/i.test(lbl)) return false;

      if (
        /\b(?:aktenzeichen|geschäftszeichen|kundennummer|rechnungsnummer|rechnungsnr|vorgangs-?id|referenz|ticketnummer|bestellnummer|antragsnummer)\b/i.test(
          lbl
        )
      )
        return false;

      if (/\b(?:knd|re|ord|ab|ref|v|vg|js)[ \t]*[-/:][ \t]*/i.test(val)) return false;

      if (/^[A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]{3,5}){2,9}$/i.test(val.trim())) return false;

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
      login: {
        pattern: /((?:Benutzername|User(?:name)?|Login-?ID|User-?ID|Account-?ID)[ \t]*[:：=][ \t]*)([^\n\r]{1,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      secret: {
        pattern:
          /((?:Passwort|Kennwort|PIN|TAN|OTP|2FA|Sicherheitscode|verification[ \t]*code|one[- \t]?time[ \t]*code)[ \t]*[:：=][ \t]*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      aktenzeichen_tail: {
        pattern:
          /((?:Aktenzeichen|Geschäftszeichen)[ \t]*[:：=][ \t]*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.\/][A-Za-z0-9\[\]]+){0,10}[-_.\/]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      aktenzeichen: {
        pattern: /((?:Aktenzeichen|Geschäftszeichen)[ \t]*[:：=][ \t]*)([A-Za-z0-9\-\/\.]{6,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      id_label_tail: {
        pattern:
          /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)[ \t]*[:：=][ \t]*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.\/:][A-Za-z0-9\[\]]+){0,10}[-_.\/:]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      id_label: {
        pattern:
          /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-_\/:.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_generic_tail_de: {
        pattern: /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      tax_id: {
        pattern: /((?:Steuer-?ID|Steueridentifikationsnummer)[ \t]*[:：=][ \t]*)(\d[\d \t]{8,20}\d)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      vat_id: {
        pattern: /((?:USt-?IdNr\.?|Umsatzsteuer-?ID)[ \t]*[:：=][ \t]*)(DE[ \t]?\d{8,12})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      svnr: {
        pattern:
          /((?:Sozialversicherungsnummer|SV-Nummer|Rentenversicherungsnummer)[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9 \t\-]{5,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      id_card: {
        pattern: /((?:Personalausweis(?:nummer|[- \t]?Nr\.?))[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-]{4,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:Reisepass(?:nummer|[- \t]?Nr\.?))[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-]{4,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern:
          /((?:Führerschein(?:nummer|[- \t]?Nr\.?)|Führerscheinnummer)[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-\/]{4,32})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthdate: {
        pattern: /((?:Geburtsdatum|Geb\.?[ \t]*Datum)[ \t]*[:：=][ \t]*)(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      birthplace: {
        pattern: /((?:Geburtsort)[ \t]*[:：=][ \t]*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern:
          /((?:IBAN|Kontonummer|Account(?:[ \t]*Number)?)[ \t]*[:：=][ \t]*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:BIC|SWIFT|SWIFT[ \t]*Code)[ \t]*[:：=]?[ \t]*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      blz: {
        pattern: /((?:Bankleitzahl|BLZ)[ \t]*[:：=][ \t]*)(\d{5,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      creditcard: {
        pattern:
          /((?:Kreditkarte|Kartennummer|Card(?:[ \t]*Number)?|Visa|Mastercard|Amex)[ \t]*[:：=][ \t]*)(\d(?:[ -]?\d){12,22}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      money_negative: {
        pattern:
          /(?:[€$£¥￥][ \t]*[-−]\s*\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?(?![\dA-Za-z])|[-−]\s*\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?[ \t]*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b(?![\dA-Za-z])|\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b[ \t]*[-−]\s*\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?(?![\dA-Za-z])|[-−]\s*\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?[ \t]*[€$£¥￥](?![\dA-Za-z]))/giu,
        tag: "MONEY"
      },

      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b[ \t]*(?:[€$£¥￥][ \t]*)?\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?[ \t]*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥][ \t]*\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,' \t]\d{3})*(?:[.,]\d{2})?[ \t]*[€$£¥￥])/giu,
        tag: "MONEY"
      },

      email: {
        pattern: /\b[A-Z0-9._%+-]+[ \t]*@[ \t]*[A-Z0-9.-]+[ \t]*\.[ \t]*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      phone: {
        pattern:
          /((?:tel|telefon|handy|phone|mobile|mobil|whatsapp|telegram|signal|fax)(?:[ \t]*\([^)]+\))?[ \t]*[:：=]?[ \t]*)([+＋]?[ \t]*\d[\d \t().-]{5,}\d)\b|(?<![A-Za-z0-9_-])((?:[+＋][ \t]*\d{1,3}|00[ \t]*[1-9]\d{0,2})[\d \t().-]{6,}\d)\b/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name_keep_title: {
        pattern:
          /^((?:Name|Kundename|Kunde|Kontaktperson|Kontakt|Ansprechpartner|Ansprechperson|Empfänger|Rechnungsempfänger|Sachbearbeiter|Bearbeiter|Versicherte[ \t]*Person|Patient)[ \t]*[:：=][ \t]*(?:(?:Herr|Frau|Dr\.?|Prof\.?)\.?[ \t]+)?)((?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40})(?:[ \t]+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40}){0,3})(?:[ \t]+(?:\([^\n\r]{0,120}\)))?[ \t]*$/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      person_name_inline: {
        pattern:
          /((?:Name|Kundename|Kunde|Kontaktperson|Kontakt|Ansprechpartner|Ansprechperson|Empfänger|Rechnungsempfänger|Sachbearbeiter|Bearbeiter|Versicherte[ \t]*Person|Patient)[ \t]*[:：=][ \t]*(?:(?:Herr|Frau|Dr\.?|Prof\.?)\.?[ \t]+)?)((?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40})(?:[ \t]+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40}){0,3})(?=[ \t]*(?:[|·]|\n|\r|$))/giu,
        tag: "NAME",
        mode: "prefix"
      },

      person_name: {
        pattern:
          /((?:Name|Kundename|Kunde|Kontaktperson|Kontakt|Ansprechpartner|Ansprechperson|Empfänger|Rechnungsempfänger|Sachbearbeiter|Bearbeiter|Versicherte[ \t]*Person|Patient)[ \t]*[:：=][ \t]*)((?:(?:Herr|Frau|Dr\.?|Prof\.?)[ \t]+)?[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}(?:[ \t]+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}){1,3})/gu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern:
          /\b(?<name>[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9&.\- ]{1,80}?)[ \t]+(?<legal>GmbH(?:[ \t]*&[ \t]*Co\.[ \t]*KG)?|UG(?:[ \t]*\([^)]+\))?|KGaA|OHG|PartG|eG|AG|KG|GbR|e\.K\.?)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      address_de_inline_street: {
        pattern:
          /^(?!.*\b(?:Lagerplatz|Regal|Fach|SKU|Fehlercode|ERR|Testwert|Artikel|Gutschrift|Kontonummer|Bankleitzahl|Versichertennummer)\b)(?:[A-ZÄÖÜ][\p{L}.'\-]{1,40}(?:[ \t]+[A-ZÄÖÜ][\p{L}.'\-]{1,40}){0,4})[ \t]+\d{1,4}(?:[ \t]*[A-Za-z])?(?:-\d{1,4})?$/gmu,
        tag: "ADDRESS"
      },

      address_de_street_partial: {
        pattern:
          /((?:Adresse|Anschrift|Straße|Strasse|Rechnungsadresse|Lieferadresse)[ \t]*[:：=][ \t]*)([^,\n\r]{4,120}?)(?=[ \t]*,)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_extra_partial: {
        pattern:
          /((?:Zusatz)[ \t]*[:：=][ \t]*)((?=[^\n\r]{2,260})(?=.*\b(?:Gebäude|Haus|Block|Aufgang|Etage|Stock|Stockwerk|OG|EG|DG|WHG|Wohnung|Zimmer|Raum|App\.?|Apartment)\b)[^\n\r]*?)(?=,[ \t]*(?:Klingel|Tür|Tel\.?|Telefon)\b)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_extra: {
        pattern:
          /((?:Zusatz)[ \t]*[:：=][ \t]*)((?=[^\n\r]{2,140}$)(?=.*\b(?:Gebäude|Haus|Block|Aufgang|Etage|Stock|Stockwerk|OG|EG|DG|WHG|Wohnung|Zimmer|Raum|App\.?|Apartment|Tür|Klingel)\b)[^\n\r]{2,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_street: {
        pattern:
          /((?:Adresse|Anschrift|Straße|Strasse|Rechnungsadresse|Lieferadresse)[ \t]*[:：=][ \t]*)((?=[^\n\r]{4,140}$)(?=[^\n\r]{0,140}(?:\d{1,4}[ \t]*[A-Za-z]?\b|straße\b|strasse\b|str\.\b|weg\b|platz\b|allee\b|gasse\b|ring\b|ufer\b|damm\b|chaussee\b|promenade\b|markt\b|hof\b|kai\b))[^\n\r]{4,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
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
        pattern: /\b\d[\d \t\-]{6,30}\d\b/g,
        tag: "NUMBER"
      },

      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/g,
        tag: "TITLE"
      }
    }
  };
})();

// =========================
// DE High-Risk ADD-ONLY Patch
// =========================
(function () {
  "use strict";

  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});
  const DE = PACKS.de;
  if (!DE) return;

  function uniqPush(arr, key) {
    if (!arr.includes(key)) arr.push(key);
  }

  function insertBefore(arr, beforeKey, keys) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    const idx = out.indexOf(beforeKey);
    const insertAt = idx >= 0 ? idx : out.length;
    const toInsert = [];
    (keys || []).forEach((k) => {
      if (!out.includes(k) && !toInsert.includes(k)) toInsert.push(k);
    });
    out.splice(insertAt, 0, ...toInsert);
    return out;
  }

  const NEW_KEYS = [
    "api_key_token",
    "bearer_token",
    "security_answer",
    "ip_label",
    "ip_address",
    "mac_label",
    "mac_address",
    "imei2",
    "device_fingerprint",
    "uuid2",
    "bank_routing_ids",
    "avs_data",
    "three_ds_status",
    "eci",
    "legal_ref_tail",
    "wallet_id",
    "tx_hash",
    "crypto_wallet",
    "insurance_id2"
  ];

  // insurance_id2 must run BEFORE generic tail refs
  DE.priority = insertBefore(DE.priority || [], "ref_generic_tail_de", ["insurance_id2"]);

  DE.priority = insertBefore(DE.priority || [], "number", NEW_KEYS);

  DE.alwaysOn = DE.alwaysOn || [];
  NEW_KEYS.forEach((k) => uniqPush(DE.alwaysOn, k));

  Object.assign(DE.rules, {
    api_key_token: {
      pattern:
        /((?:api[ \t]*key|x-api-key|access[ \t]*token|refresh[ \t]*token|token|auth[ \t]*token|client[ \t]*secret|secret[ \t]*key|schlüssel|schluessel)[ \t]*[:：=]?[ \t]+)([A-Za-z0-9._\-]{8,300})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    bearer_token: {
      pattern: /(\bauthorization[ \t]*[:：=][ \t]*bearer[ \t]+)([A-Za-z0-9._\-]{8,400})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    security_answer: {
      pattern:
        /((?:Sicherheitsantwort|Antwort|security[ \t]*answer|answer)[ \t]*[:：=][ \t]*)([^\n\r]{1,160})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    ip_label: {
      pattern:
        /((?:IP(?:[ \t]*Adresse|Address)?|IPv4|IPv6)[ \t]*[:：=][ \t]*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    ip_address: {
      pattern:
        /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
      tag: "SECRET"
    },

    mac_label: {
      pattern: /((?:MAC(?:[ \t]*Adresse|Address)?)[ \t]*[:：=][ \t]*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    mac_address: {
      pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
      tag: "SECRET"
    },

    imei2: {
      pattern: /((?:IMEI)[ \t]*[:：=][ \t]*)(\d{14,16})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    device_fingerprint: {
      pattern:
        /((?:Geräte-?ID|Geraete-?ID|Device[ \t]*ID|Session[ \t]*ID|Sitzungs-?ID|Fingerprint|Browser-?Fingerprint|User-?Agent)[ \t]*[:：=][ \t]*)([^\n\r]{1,220})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    uuid2: {
      pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
      tag: "SECRET"
    },

    bank_routing_ids: {
      pattern:
        /((?:Clearing[ \t]*(?:nummer|number|no\.?)|Clearing|Zentralbank-?Nr\.?|Filial-?Code|Filialnummer|Branch[ \t]*Code|Transit[ \t]*Number|BSB|ABA(?:[ \t]*(?:Number|Routing[ \t]*Number))?)[ \t]*[:：=][ \t]*)([0-9][0-9 \t-]{2,24}[0-9])/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    avs_data: {
      pattern: /((?:AVS[ \t]*Data)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{1,40})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    three_ds_status: {
      pattern: /((?:3-?D[ \t]*Secure|3DS)(?:[ \t]*Status)?[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{1,40})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    eci: {
      pattern: /((?:ECI)[ \t]*[:：=][ \t]*)(\d{2})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    legal_ref_tail: {
      pattern:
        /((?:(?:Vertragsnummer|Vertrag[ \t]*Nr\.?|Schadensnummer|Schaden[ \t]*Nr\.?|Rechtsfall[ \t]*Ref|Legal[ \t]*Case[ \t]*Ref|Claim[ \t]*Reference|Contract[ \t]*Number)[ \t]*[:：=][ \t]*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
      tag: "REF",
      mode: "prefix"
    },

    insurance_id2: {
      pattern:
        /((?:Versicherungs(?:nummer|nr\.?)|Police(?:n)?nummer|Policen(?:nr\.?)|Policy[ \t]*(?:ID|No\.?|Number)|Member[ \t]*(?:ID|No\.?|Number))[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,60})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    wallet_id: {
      pattern: /((?:Wallet[ \t]*ID)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{3,80})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    tx_hash: {
      pattern: /((?:Transaction[ \t]*Hash|TX[ \t]*Hash|Txn[ \t]*Hash)[ \t]*[:：=][ \t]*)(0x[0-9a-f]{16,128})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    crypto_wallet: {
      pattern:
        /((?:BTC|ETH)[ \t]*[:：=][ \t]*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
      tag: "SECRET",
      mode: "prefix"
    }
  });
})();

// =========================
// DE Fix Patch
// =========================
(function () {
  "use strict";

  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});
  const DE = PACKS.de;
  if (!DE) return;

  function uniqPush(arr, key) {
    if (!arr.includes(key)) arr.push(key);
  }

  function insertBefore(arr, beforeKey, keys) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    const idx = out.indexOf(beforeKey);
    const insertAt = idx >= 0 ? idx : out.length;
    const toInsert = [];
    (keys || []).forEach((k) => {
      if (!out.includes(k) && !toInsert.includes(k)) toInsert.push(k);
    });
    out.splice(insertAt, 0, ...toInsert);
    return out;
  }

  const NEW_KEYS = [
    "account_holder_name_keep_title",
    "birthplace_optional_secret",
    "blz_paren",
    "card_expiry_de",
    "card_security_de"
  ];

  // dedicated rule must run BEFORE account
  DE.priority = insertBefore(DE.priority || [], "account", ["account_holder_name_keep_title"]);
  DE.priority = insertBefore(DE.priority || [], "birthplace", ["birthplace_optional_secret"]);
  DE.priority = insertBefore(DE.priority || [], "blz", ["blz_paren"]);
  DE.priority = insertBefore(DE.priority || [], "number", ["card_expiry_de", "card_security_de"]);

  DE.alwaysOn = Array.isArray(DE.alwaysOn) ? DE.alwaysOn : [];
  uniqPush(DE.alwaysOn, "account_holder_name_keep_title");
  uniqPush(DE.alwaysOn, "blz_paren");
  uniqPush(DE.alwaysOn, "card_expiry_de");
  uniqPush(DE.alwaysOn, "card_security_de");

  DE.alwaysOn = DE.alwaysOn.filter((k) => k !== "birthplace" && k !== "birthplace_secret");

  Object.assign(DE.rules, {
    account_holder_name_keep_title: {
      pattern:
        /^((?:Kontoinhaber)[ \t]*[:：=][ \t]*(?:(?:Herr|Frau|Dr\.?|Prof\.?)\.?[ \t]+)?)((?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40})(?:[ \t]+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40}){0,3})(?:[ \t]+(?:\([^\n\r]{0,120}\)))?[ \t]*$/gmiu,
      tag: "NAME",
      mode: "prefix"
    },

    birthplace_optional_secret: {
      pattern: /((?:Geburtsort)[ \t]*[:：=][ \t]*)([^\n\r]{2,80})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    blz_paren: {
      pattern: /((?:Bankleitzahl)[ \t]*(?:\([ \t]*BLZ[ \t]*\))?[ \t]*[:：=][ \t]*)(\d{5,12})/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    card_expiry_de: {
      pattern:
        /((?:Gültig[ \t]*bis|Gueltig[ \t]*bis|Ablaufdatum|Expiry|Expiration|Exp(?:iry|iration)?(?:[ \t]*Date)?|Valid[ \t]*Thru|Valid[ \t]*Through)[ \t]*[:：=][ \t]*)(\d{2}[ \t]*\/[ \t]*\d{2,4}|\d{2}[ \t]*-[ \t]*\d{2,4}|\d{4}[ \t]*-[ \t]*\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
    },

    card_security_de: {
      pattern: /((?:CVC|CVV|CVC2|CAV2)[ \t]*[:：=][ \t]*)(\d{3,4})/giu,
      tag: "SECRET",
      mode: "prefix"
    }
  });
})();
