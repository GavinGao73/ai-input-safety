// =========================
// assets/engine.en.js
// CONSOLIDATED CLEAN VERSION
//
// Goals:
// - Keep original structure and behavior style
// - Merge add-on patches into one clean pack
// - Reduce false positives without expanding complexity
// - Preserve labels / line structure / replacement stability
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

      if (
        /\b(Invoice|Order[ \t]*ID|Account[ \t]*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(
          s
        )
      ) {
        return "en";
      }

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

      "intl_itin",
      "intl_nino",
      "intl_nhs",
      "intl_sin",
      "intl_tfn",
      "intl_abn",
      "uuid",

      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",

      "device_fingerprint",

      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",
      "avs_data",
      "three_ds_status",
      "eci",
      "security_answer",

      "email",
      "url",

      "ref_label_tail",
      "ref_generic_tail",
      "legal_ref_tail",

      "money_label",
      "money",

      "phone",

      "person_name",
      "company",

      "address_de_street",
      "address_de_postal",
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      "handle",

      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      "number"
    ],

    alwaysOn: [
      "handle_label",
      "secret",
      "api_key_token",
      "bearer_token",

      "dob",
      "place_of_birth",

      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",
      "insurance_id",

      "intl_itin",
      "intl_nino",
      "intl_nhs",
      "intl_sin",
      "intl_tfn",
      "intl_abn",
      "uuid",

      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",

      "device_fingerprint",

      "money_label",
      "money",
      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",
      "avs_data",
      "three_ds_status",
      "eci",
      "security_answer",

      "person_name",

      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      "ref_label_tail",
      "ref_generic_tail",
      "legal_ref_tail",

      "wallet_id",
      "tx_hash",
      "crypto_wallet"
    ],

    phoneGuard: function ({ label, value }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const digits = val.replace(/\D+/g, "");

      if (digits.length >= 16) return false;

      if (
        /\b(?:case|ticket|order|invoice|reference|ref|customer|application|request|account)\b/.test(lbl) &&
        /\b(?:id|no|number|#)\b/.test(lbl)
      ) return false;

      if (/\b(?:CUST|CASE|ORD|INV|APP|REF|ACC|MEM|INS|REQ|PR)-/i.test(val)) return false;

      if (/\b[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-\d{4,}\b/i.test(val)) return false;

      return true;
    },

    formatCompany: function ({ legal, punct, placeholder }) {
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${placeholder("COMPANY")}${rawLegal}${rawPunct}`;
      return `${placeholder("COMPANY")}${rawPunct}`;
    },

    highlightCompany: function ({ match, name, legal, punct, S1, S2 }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawName && rawLegal) return `${S1}${rawName}${S2}${rawLegal}${rawPunct}`;
      const m = String(match || rawName || "");
      return `${S1}${m}${S2}${rawPunct}`;
    },

    rules: {
      email: {
        pattern: /\b[A-Z0-9._%+-]+[ \t]*@[ \t]*[A-Z0-9.-]+[ \t]*\.[ \t]*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'\n\r）)\]】]+/giu,
        tag: "URL"
      },

      money_label: {
        pattern:
          /((?:amount|total|subtotal|grand[ \t]*total|price|fee|fees|charge|charges|balance|paid|payment|refund|due|total[ \t]*due|net|gross|tax|vat)(?:[ \t]+\d{1,3}(?:[.,]\d{1,2})?[ \t]*%)?(?:[ \t]*[:：=][ \t]*|[ \t]+))((?:[€$£¥￥][ \t]*[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})?|\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b[ \t]*[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})?|[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})?[ \t]*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})))(?![\dA-Za-z])/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b[ \t]*[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})?(?![\dA-Za-z])|[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,}|\d{1,3})(?:[.,]\d{2})?[ \t]*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b(?![\dA-Za-z])|[€$£¥￥][ \t]*[-+−]?(?:\d{1,3}(?:[., \t]\d{3})+|\d{4,})(?:[.,]\d{2})?(?![\dA-Za-z]))/giu,
        tag: "MONEY"
      },

      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification[ \t]*code|security[ \t]*code|one[- \t]?time[ \t]*code|recovery[ \t]*code|backup[ \t]*code)[ \t]*[:：=][ \t]*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      api_key_token: {
        pattern:
          /((?:api[ \t]*key|x-api-key|access[ \t]*token|refresh[ \t]*token|token|auth[ \t]*token|client[ \t]*secret|secret[ \t]*key)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{8,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      bearer_token: {
        pattern: /(\bauthorization[ \t]*[:：=][ \t]*bearer[ \t]+)([A-Za-z0-9._\-]{8,400})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      handle_label: {
        pattern:
          /((?:username|user[ \t]*id|login[ \t]*id|login|handle)[ \t]*(?:[:：=]|-)[ \t]*)(?![A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      dob: {
        pattern: /((?:date[ \t]*of[ \t]*birth|dob)[ \t]*[:：=][ \t]*\d{4}[-\/\.])(\d{2}[-\/\.]\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      place_of_birth: {
        pattern: /((?:place[ \t]*of[ \t]*birth|pob|birthplace)[ \t]*[:：=][ \t]*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:passport(?:[ \t]*(?:no\.?|number))?)[ \t]*[:：=][ \t]*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern:
          /((?:driver[’']?s[ \t]*license(?:[ \t]*(?:no\.?|number))?|driving[ \t]*licen[cs]e(?:[ \t]*(?:no\.?|number))?)[ \t]*[:：=][ \t]*)([A-Z0-9][A-Z0-9\-]{4,28})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ssn: {
        pattern: /((?:ssn|social[ \t]*security[ \t]*number)[ \t]*[:：=][ \t]*)(\d{3}-\d{2}-\d{4}|\d{9})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ein: {
        pattern: /((?:ein|employer[ \t]*identification[ \t]*number)[ \t]*[:：=][ \t]*)(\d{2}-\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern:
          /((?:national[ \t]*id(?:[ \t]*(?:no\.?|number))?|id[ \t]*number)[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_id: {
        pattern:
          /((?:tax[ \t]*id|tax[ \t]*identification[ \t]*(?:no\.?|number)|tin)[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-]{4,32})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      insurance_id: {
        pattern:
          /((?:insurance[ \t]*(?:id|no\.?|number)|policy[ \t]*(?:id|no\.?|number)|claim[ \t]*(?:id|no\.?|number)|member[ \t]*(?:id|no\.?|number)|membership[ \t]*(?:id|no\.?|number))[ \t]*[:：=][ \t]*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,60})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_itin: {
        pattern: /((?:us[ \t]*)?itin[ \t]*[:：=][ \t]*)(9\d{2}[- \t]?\d{2}[- \t]?\d{4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_nino: {
        pattern: /((?:uk[ \t]*)?nino[ \t]*[:：=][ \t]*)([A-Z]{2}[ \t]?\d{2}[ \t]?\d{2}[ \t]?\d{2}[ \t]?[A-D])/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_nhs: {
        pattern: /((?:uk[ \t]*)?nhs[ \t]*number[ \t]*[:：=][ \t]*)(\d{3}[ \t]?\d{3}[ \t]?\d{4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_sin: {
        pattern: /((?:ca[ \t]*)?sin[ \t]*[:：=][ \t]*)(\d{3}[ \t]?\d{3}[ \t]?\d{3})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_tfn: {
        pattern: /((?:au[ \t]*)?tfn[ \t]*[:：=][ \t]*)(\d{3}[ \t]?\d{3}[ \t]?\d{3})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      intl_abn: {
        pattern: /((?:au[ \t]*)?abn[ \t]*[:：=][ \t]*)(\d{2}[ \t]?\d{3}[ \t]?\d{3}[ \t]?\d{3})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      uuid: {
        pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
        tag: "SECRET"
      },

      ip_label: {
        pattern:
          /((?:ip[ \t]*address|ipv4|ipv6)[ \t]*[:：=][ \t]*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ip_address: {
        pattern:
          /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
        tag: "SECRET"
      },

      mac_label: {
        pattern: /((?:mac[ \t]*(?:address)?)[ \t]*[:：=][ \t]*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      mac_address: {
        pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
        tag: "SECRET"
      },

      imei: {
        pattern: /((?:imei)[ \t]*[:：=][ \t]*)(\d{14,16})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      device_fingerprint: {
        pattern: /((?:device[ \t]*id|session[ \t]*id|fingerprint|user[ \t]*agent)[ \t]*[:：=][ \t]*)([^\n\r]{1,200})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      account: {
        pattern:
          /((?:account[ \t]*number|routing[ \t]*number|sort[ \t]*code|iban|card[ \t]*number)(?:[ \t]*[:：=][ \t]*|[ \t]+))([^\n\r]{2,80})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern:
          /((?:swift|swift[ \t]*code|bic|swift\/bic)\b(?:[ \t]*[:：=][ \t]*|[ \t]+))([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank_routing_ids: {
        pattern:
          /((?:bank[ \t]*name|branch[ \t]*code|clearing[ \t]*(?:number|no\.?)|transit[ \t]*number|bsb|aba[ \t]*(?:number|routing[ \t]*number)?|aba)[ \t]*[:：=][ \t]*)([0-9][0-9 \t-]{2,24}[0-9])/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      card_expiry: {
        pattern:
          /((?:exp(?:iry|iration)?(?:[ \t]*date)?|valid[ \t]*thru|valid[ \t]*through)[ \t]*[:：=][ \t]*)(\d{2}[ \t]*\/[ \t]*\d{2,4}|\d{2}[ \t]*-[ \t]*\d{2,4}|\d{4}[ \t]*-[ \t]*\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      card_security: {
        pattern: /((?:cvv|cvc)[ \t]*[:：=][ \t]*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      avs_data: {
        pattern: /((?:avs[ \t]*data)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{1,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      three_ds_status: {
        pattern: /((?:3-?d[ \t]*secure|3ds)[ \t]*(?:status)?[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{1,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      eci: {
        pattern: /((?:eci)[ \t]*[:：=][ \t]*)(\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      security_answer: {
        pattern: /((?:security[ \t]*answer)[ \t]*[:：=][ \t]*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      phone: {
        pattern:
          /((?:phone|mobile|tel|whatsapp|telegram|signal|fax)[ \t]*[:：=]?[ \t]*)([+＋]?[ \t]*\d[\d \t().-]{5,}\d)\b|(?<![A-Za-z0-9_-])(\b(?:[+＋][ \t]*\d{1,3}|00[ \t]*\d{1,3})[\d \t().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern:
          /^(?:contact[ \t]*details[ \t]+)?((?:name|customer[ \t]*name|account[ \t]*holder|recipient|name[ \t]*on[ \t]*card|to|attn\.?|attention)(?:[ \t]*[:：=][ \t]*|[ \t]+)(?:(?:mr|mrs|ms|miss|dr|prof)\.?[ \t]+)?)((?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:[ \t]+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})(?:[ \t]+(?:\([^\n\r]{0,120}\)))?[ \t]*$/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      company: {
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)[ \t]+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      address_de_street: {
        pattern:
          /((?:address|shipping[ \t]*address|billing[ \t]*address|street[ \t]*address|mailing[ \t]*address)[ \t]*[:：=][ \t]*)([^,\n\r]{4,160}?)(?=[ \t]*,)/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_de_postal: {
        pattern:
          /((?:zip(?:[ \t]*code)?|postal[ \t]*code|postcode)[ \t]*[:：=][ \t]*)(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z][ \t]?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]?[ \t]?\d[A-Z]{2}|\d{4}|[A-Z0-9][A-Z0-9\- ]{2,9}[A-Z0-9])/giu,
        tag: "ADDRESS",
        mode: "prefix"
      },

      address_en_inline_street: {
        pattern:
          /\b\d{1,5}[A-Za-z]?(?:-\d{1,5})?[ \t]+(?:[A-Za-z0-9.'’\-]+[ \t]+){0,6}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|parkway|pkwy\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|terrace|ter\.?|crescent|cres\.?|close|cl\.?|gardens?|gdns?\.?|mews|row|alley|aly\.?)\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra_block: {
        pattern:
          /\b(?:suite|ste\.?|apt|apartment|unit|floor|fl\.?|room|rm\.?|flat|level)\b(?:[ \t]*(?:#|no\.?|number)?[ \t]*[:：-]?[ \t]*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra: {
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|flat|level|building|bldg\.?|dept|department)\b(?:[ \t]+#?[ \t]*|#[ \t]*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      ref_label_tail: {
        pattern:
          /((?:(?:application|order|invoice|reference|ref\.?|case|ticket|request|customer|account)[ \t]*(?:id|no\.?|number)?[ \t]*(?:[:：=]|-)[ \t]*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_generic_tail: {
        pattern: /\b((?!ERR-)(?!SKU:)(?:[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-))(\d{5,})\b/gu,
        tag: "REF",
        mode: "prefix"
      },

      legal_ref_tail: {
        pattern:
          /((?:(?:contract[ \t]*number|claim[ \t]*reference|legal[ \t]*case[ \t]*ref)[ \t]*[:：=][ \t]*)(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,8}[-_.]))(\d{4,})\b/giu,
        tag: "REF",
        mode: "prefix"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      wallet_id: {
        pattern: /((?:wallet[ \t]*id)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{3,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tx_hash: {
        pattern: /((?:transaction[ \t]*hash|tx[ \t]*hash|txn[ \t]*hash)[ \t]*[:：=][ \t]*)(0x[0-9a-f]{16,128})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      crypto_wallet: {
        pattern: /((?:btc|eth)[ \t]*[:：=][ \t]*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      number: {
        pattern: /\b\d[\d \t-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
