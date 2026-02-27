// =========================
// assets/engine.de.js
// Content-strategy pack: de (FULL – extended conservative German policy)
// - placeholders + detect + rules
// - high-sensitivity German document model
//
// LOCKED (as per latest):
// - Fix: Führerscheinnummer like "D-482771-2026" must match (hyphenated formats)
// - Address: do NOT mask PLZ+City / Country.
//   Only mask street + house number; if apartment details exist, include building/floor/room (e.g., Gebäude/OG/Zimmer).
// - Everything else stays as-is.
//
// USER ADJUST (latest):
// - Name lines: DO NOT output [Anrede]. Keep Herr/Frau/Dr/Prof titles, only mask the name part -> [Name].
// - Geburtsort: low priority; can mask, but leaving it is acceptable.
// - Zusatz: only mask "Gebäude..., OG..., Zimmer..." part; keep ", Klingel „Müller“…"
//
// ID POLICY (latest):
// - ID: overall mask KEEP, but ONLY mask the LAST numeric segment (tail digits).
//   Example: CASE-2026-00078421 -> CASE-2026-[Referenz]
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
      TITLE: "[Anrede]", // NOTE: kept for generic use; title masking is disabled (see Fix Patch)
      NUMBER: "[Zahl]",
      MONEY: "[Betrag]",
      COMPANY: "[Firma]",
      TERM: "[REDACTED]",
      NAME: "[Name]"
    },

    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      // ✅ 不再因为一个 ü/ä/ö/ß 就直接判定德语
      // 只有出现“明显德语关键词”才判定为 de
      if (
        /\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Zusatz|Geburtsdatum|Geburtsort|USt-IdNr)\b/i.test(
          s
        )
      )
        return "de";

      // ✅ 兜底：如果德语字符很多（比如整段德语），也判 de（避免误判）
      const umlauts = (s.match(/[äöüÄÖÜß]/g) || []).length;
      if (umlauts >= 3) return "de";

      return "";
    },

    priority: [
      // secrets / auth first
      "secret",
      "login",

      // identity / case / reference system (very German)
      // ✅ ID tail-only policy (mask only last numeric segment)
      "aktenzeichen_tail",
      "id_label_tail",
      "ref_generic_tail_de",

      // keep legacy full rules defined but NOT executed (see note above)
      // "aktenzeichen",
      // "id_label",

      // tax / government / personal documents
      "tax_id",
      "vat_id",
      "svnr",
      "id_card",
      "passport",
      "driver_license",

      // personal attributes
      "birthdate",
      "birthplace", // low priority; not forced always-on (see Fix Patch)

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
      "person_name_keep_title",
      "person_name",

      // organization BEFORE address (prevents company line being treated as address context)
      "company",

      // ✅ address lines WITHOUT labels (street+houseNo only)
      "address_de_inline_street",

      // ✅ label-driven extras (apartment/building/floor/room) — PARTIAL ONLY
      "address_de_extra_partial",

      // ✅ label-driven address — PARTIAL ONLY (street+houseNo; keeps tail PLZ/City/Country)
      "address_de_street_partial",

      // generic
      "handle",

      // NOTE:
      // - legacy "ref" masked whole token; disabled by tail-only policy (do not run)
      // - "title" masking disabled to keep Herr/Frau/Dr/Prof
      "number"
    ],

    alwaysOn: [
      "secret",
      "login",

      // ✅ ID tail-only policy (mask only last numeric segment)
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

      // birthplace is low priority (user). DO NOT force it.

      "account",
      "bank",
      "blz",
      "creditcard",

      "email",
      "url",
      "money",
      "phone",

      // ✅ Name masking with titles preserved (Herr/Frau/Dr/Prof kept; only name -> [Name])
      "person_name_keep_title",
      "person_name",

      // keep company + street/apartment address always-on (conservative German policy)
      "company",
      "address_de_inline_street",
      "address_de_extra_partial",
      "address_de_street_partial"
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
      // ✅ NEW: tail-only masking for Aktenzeichen/Geschäftszeichen
      // Example: Aktenzeichen: CASE-2026-00078421 -> Aktenzeichen: CASE-2026-[Referenz]
      aktenzeichen_tail: {
        pattern:
          /((?:Aktenzeichen|Geschäftszeichen)\s*[:：=]\s*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.\/][A-Za-z0-9\[\]]+){0,10}[-_.\/]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      // legacy full mask (definition kept, but prefer tail rule via priority/alwaysOn)
      aktenzeichen: {
        pattern: /((?:Aktenzeichen|Geschäftszeichen)\s*[:：=]\s*)([A-Za-z0-9\-\/\.]{6,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== ID / REF LABELS (always-on) ===================== */
      // ✅ NEW: tail-only masking for German label IDs
      id_label_tail: {
        pattern:
          /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)\s*[:：=]\s*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.\/:][A-Za-z0-9\[\]]+){0,10}[-_.\/:]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      id_label: {
        pattern:
          /((?:Antragsnummer|Kundennummer|Rechnungsnummer|Rechnungsnr\.?|Vorgangs-?ID|Referenz|Ticketnummer|Bestellnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_\/:.]{3,80})/giu,
        tag: "REF",
        mode: "prefix"
      },

      // ✅ NEW: generic tail IDs (covers CASE-2026-00078421 style even without label)
      ref_generic_tail_de: {
        pattern: /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
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
        pattern: /((?:Personalausweis(?:nummer|[-\s]?Nr\.?))\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-]{4,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:Reisepass(?:nummer|[-\s]?Nr\.?))\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-]{4,24})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        // ✅ accepts hyphenated formats, e.g. "D-482771-2026"
        pattern:
          /((?:Führerschein(?:nummer|[-\s]?Nr\.?)|Führerscheinnummer)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-\/]{4,32})/giu,
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
        // low priority; not forced always-on
        pattern: /((?:Geburtsort)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
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
      person_name_keep_title: {
        // Expected:
        // Name: Herr [Name]
        // Empfänger: Frau [Name]
        // Ansprechpartner: Dr. [Name]
        // And never emits [Anrede].
        pattern:
          /^((?:Name|Kontakt|Ansprechpartner|Empfänger)[ \t]*[:：=][ \t]*(?:(?:Herr|Frau|Dr\.?|Prof\.?)\.?\s+)?)((?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40})(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’\-]{1,40}){0,3})(?:[ \t]+(?:\([^\n\r]{0,120}\)))?[ \t]*$/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      person_name: {
        // legacy (kept)
        pattern:
          /((?:Name|Kontakt|Ansprechpartner|Empfänger)\s*[:：=]\s*)((?:(?:Herr|Frau|Dr\.?|Prof\.?)\s+)?[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'\-]{1,40}){1,3})/gu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY ===================== */
      company: {
        pattern: /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>GmbH|AG|UG|KG|GbR|e\.K\.)\b/gu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS (inline, street + house no only; no PLZ/City) ===================== */
      address_de_inline_street: {
        pattern:
          /^(?!.*\b(?:Lagerplatz|Regal|Fach|SKU|Fehlercode|ERR|Testwert|Artikel|Gutschrift|Kontonummer|Bankleitzahl|Versichertennummer)\b)(?:[A-ZÄÖÜ][\p{L}.'\-]{1,40}(?:\s+[A-ZÄÖÜ][\p{L}.'\-]{1,40}){0,4})\s+\d{1,4}(?:\s*[A-Za-z])?(?:-\d{1,4})?$/gmu,
        tag: "ADDRESS"
      },

      address_de_street_partial: {
        // Street-only masking; keep tail (PLZ/City/Country)
        // Example:
        // "Adresse: Musterstraße 12, 50667 Köln, Deutschland"
        // -> "Adresse: [Adresse], 50667 Köln, Deutschland"
        pattern:
          /((?:Adresse|Anschrift|Straße|Strasse|Rechnungsadresse|Lieferadresse)\s*[:：=]\s*)([^,\n\r]{4,120}?)(?=\s*,)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_extra_partial: {
        // Zusatz: mask only building/floor/room part; keep ", Klingel …" tail
        // Example:
        // "Zusatz: Gebäude B, 3. OG, Zimmer 12, Klingel „Müller“"
        // -> "Zusatz: [Adresse], Klingel „Müller“"
        pattern:
          /((?:Zusatz)\s*[:：=]\s*)((?=[^\n\r]{2,260})(?=.*\b(?:Gebäude|Haus|Block|Aufgang|Etage|Stock|Stockwerk|OG|EG|DG|WHG|Wohnung|Zimmer|Raum|App\.?|Apartment)\b)[^\n\r]*?)(?=,\s*(?:Klingel|Tür|Tel\.?|Telefon)\b)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      // legacy definitions kept (NOT executed by priority/alwaysOn)
      address_de_extra: {
        pattern:
          /((?:Zusatz)\s*[:：=]\s*)((?=[^\n\r]{2,140}$)(?=.*\b(?:Gebäude|Haus|Block|Aufgang|Etage|Stock|Stockwerk|OG|EG|DG|WHG|Wohnung|Zimmer|Raum|App\.?|Apartment|Tür|Klingel)\b)[^\n\r]{2,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_street: {
        pattern:
          /((?:Adresse|Anschrift|Straße|Strasse|Rechnungsadresse|Lieferadresse)\s*[:：=]\s*)((?=[^\n\r]{4,140}$)(?=[^\n\r]{0,140}(?:\d{1,4}\s*[A-Za-z]?\b|straße\b|strasse\b|str\.\b|weg\b|platz\b|allee\b|gasse\b|ring\b|ufer\b|damm\b|chaussee\b|promenade\b|markt\b|hof\b|kai\b))[^\n\r]{4,140})/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      /* ===================== GENERIC ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      // legacy ref rule definition kept (NOT executed; tail-only enforced by priority)
      ref: {
        pattern: /\b[A-Z]{2,6}-?\d{4,14}\b/g,
        tag: "REF"
      },

      number: {
        pattern: /\b\d[\d\s\-]{6,30}\d\b/g,
        tag: "NUMBER"
      },

      // legacy title rule definition kept (NOT executed)
      title: {
        pattern: /\b(Herr|Frau|Dr\.?|Prof\.?)\b/g,
        tag: "TITLE"
      }
    }
  };
})();

// =========================
// DE High-Risk ADD-ONLY Patch (align with EN patches; German-friendly labels)
// - SAFE: append priority/alwaysOn; add rules only
// - DOES NOT modify existing DE rules (address locks preserved)
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

  DE.priority = insertBefore(DE.priority || [], "number", NEW_KEYS);

  DE.alwaysOn = DE.alwaysOn || [];
  NEW_KEYS.forEach((k) => uniqPush(DE.alwaysOn, k));

  Object.assign(DE.rules, {
    api_key_token: {
      pattern:
        /((?:api\s*key|x-api-key|access\s*token|refresh\s*token|token|auth\s*token|client\s*secret|secret\s*key|schlüssel|schluessel)\s*[:：=]\s*)([A-Za-z0-9._\-]{8,300})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    bearer_token: {
      pattern: /(\bauthorization\s*[:：=]\s*bearer\s+)([A-Za-z0-9._\-]{8,400})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    security_answer: {
      pattern:
        /((?:Sicherheitsantwort|Antwort|security\s*answer|answer)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    ip_label: {
      pattern:
        /((?:IP(?:\s*Adresse|Address)?|IPv4|IPv6)\s*[:：=]\s*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    ip_address: {
      pattern:
        /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
      tag: "SECRET"
    },

    mac_label: {
      pattern: /((?:MAC(?:\s*Adresse|Address)?)\s*[:：=]\s*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    mac_address: {
      pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
      tag: "SECRET"
    },

    imei2: {
      pattern: /((?:IMEI)\s*[:：=]\s*)(\d{14,16})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    device_fingerprint: {
      pattern:
        /((?:Geräte-?ID|Geraete-?ID|Device\s*ID|Session\s*ID|Sitzungs-?ID|Fingerprint|Browser-?Fingerprint|User-?Agent)\s*[:：=]\s*)([^\n\r]{1,220})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    uuid2: {
      pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
      tag: "SECRET"
    },

    bank_routing_ids: {
      pattern:
        /((?:Clearing\s*(?:nummer|number|no\.?)|Clearing|Zentralbank-?Nr\.?|Filial-?Code|Filialnummer|Branch\s*Code|Transit\s*Number|BSB|ABA(?:\s*(?:Number|Routing\s*Number))?)\s*[:：=]\s*)([0-9][0-9\s-]{2,24}[0-9])/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    avs_data: {
      pattern: /((?:AVS\s*Data)\s*[:：=]\s*)([A-Za-z0-9._\-]{1,40})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    three_ds_status: {
      pattern: /((?:3-?D\s*Secure|3DS)(?:\s*Status)?\s*[:：=]\s*)([A-Za-z0-9._\-]{1,40})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    eci: {
      pattern: /((?:ECI)\s*[:：=]\s*)(\d{2})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    legal_ref_tail: {
      pattern:
        /((?:(?:Vertragsnummer|Vertrag\s*Nr\.?|Schadensnummer|Schaden\s*Nr\.?|Rechtsfall\s*Ref|Legal\s*Case\s*Ref|Claim\s*Reference|Contract\s*Number)\s*[:：=]\s*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
      tag: "REF",
      mode: "prefix"
    },

    insurance_id2: {
      pattern:
        /((?:Versicherungs(?:nummer|nr\.?)|Police(?:n)?nummer|Policen(?:nr\.?)|Policy\s*(?:ID|No\.?|Number)|Member\s*(?:ID|No\.?|Number))\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,60})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    wallet_id: {
      pattern: /((?:Wallet\s*ID)\s*[:：=]\s*)([A-Za-z0-9._\-]{3,80})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    tx_hash: {
      pattern: /((?:Transaction\s*Hash|TX\s*Hash|Txn\s*Hash)\s*[:：=]\s*)(0x[0-9a-f]{16,128})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    crypto_wallet: {
      pattern:
        /((?:BTC|ETH)\s*[:：=]\s*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
      tag: "SECRET",
      mode: "prefix"
    }
  });
})();

// =========================
// DE Fix Patch (UPDATED per user; + Zusatz partial masking)
// - Fix BLZ with parentheses: "Bankleitzahl (BLZ): ..."
// - Add card expiry + CVC/CVV
// - Fix Name masking: KEEP titles (Herr/Frau/Dr/Prof) in output; DO NOT emit [Anrede]; only mask name => [Name]
// - Geburtsort: low priority; do NOT force masking (remove from alwaysOn)
// - Address: street-only masking while keeping tail (PLZ/City/Country) WITHOUT requiring new engine modes
// - Zusatz: mask only "Gebäude..., OG..., Zimmer..." and keep ", Klingel …"
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

  // New keys (run earlier than older ones they supersede)
  const NEW_KEYS = [
    "birthplace_optional_secret",
    "blz_paren",
    "card_expiry_de",
    "card_security_de"
  ];

  // Insert BEFORE existing keys where relevant (conservative)
  DE.priority = insertBefore(DE.priority || [], "birthplace", ["birthplace_optional_secret"]);
  DE.priority = insertBefore(DE.priority || [], "blz", ["blz_paren"]);
  DE.priority = insertBefore(DE.priority || [], "number", ["card_expiry_de", "card_security_de"]);

  // Always-on:
  // - keep BLZ/expiry/CVC always on
  // - DO NOT force Geburtsort (user said low priority)
  DE.alwaysOn = Array.isArray(DE.alwaysOn) ? DE.alwaysOn : [];
  uniqPush(DE.alwaysOn, "blz_paren");
  uniqPush(DE.alwaysOn, "card_expiry_de");
  uniqPush(DE.alwaysOn, "card_security_de");

  // Remove birthplace from alwaysOn (soften). Keep birthplace_optional_secret NOT always-on.
  DE.alwaysOn = DE.alwaysOn.filter((k) => k !== "birthplace" && k !== "birthplace_secret");

  Object.assign(DE.rules, {
    /* 1) Geburtsort: optional masking (NOT always-on) */
    birthplace_optional_secret: {
      pattern: /((?:Geburtsort)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    /* 2) BLZ with parentheses */
    blz_paren: {
      pattern: /((?:Bankleitzahl)\s*(?:\(\s*BLZ\s*\))?\s*[:：=]\s*)(\d{5,12})/giu,
      tag: "ACCOUNT",
      mode: "prefix"
    },

    /* 3) Card expiry (DE + EN labels) */
    card_expiry_de: {
      pattern:
        /((?:Gültig\s*bis|Gueltig\s*bis|Ablaufdatum|Expiry|Expiration|Exp(?:iry|iration)?(?:\s*Date)?|Valid\s*Thru|Valid\s*Through)\s*[:：=]\s*)(\d{2}\s*\/\s*\d{2,4}|\d{2}\s*-\s*\d{2,4}|\d{4}\s*-\s*\d{2})/giu,
      tag: "SECRET",
      mode: "prefix"
    },

    /* 4) CVC/CVV */
    card_security_de: {
      pattern: /((?:CVC|CVV|CVC2|CAV2)\s*[:：=]\s*)(\d{3,4})/giu,
      tag: "SECRET",
      mode: "prefix"
    }
  });
})();

