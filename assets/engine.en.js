// =========================
// assets/engine.en.js
// UPGRADE v6.3.1 (close with zh-pack philosophy, keep v6.2 person_name stability)
//
// - 移除额外 patch（International / High-Risk / EN Compat），合并进主 pack 或暂时关闭
// - ID 策略改为「标签驱动 + 尾段遮盖」，增加 Account ID / Request ID / Portal Ref 支持
// - 强化 phoneGuard：避免业务 ID / 引用号被误当作电话
// - 地址策略：只遮街道+门牌+楼层/房间，城市和国家保留
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

      if (/\b(Invoice|Order ID|Account Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s))
        return "en";

      if (/[A-Za-z]/.test(s)) return "en";
      return "";
    },

    // Score-based detect (0..100). Keeps existing detect() for compatibility.
    detectScore: function (s) {
      s = String(s || "");
      const t = s.slice(0, 2600);
      if (!t.trim()) return { lang: "en", score: 0, confidence: 0, signals: [] };

      let score = 0;
      const signals = [];

      // strong EN document fields
      if (/\b(Invoice|Order ID|Application ID|Case ID|Ticket No\.?|Reference|Customer ID)\b/i.test(t)) {
        score += 34; signals.push("en:ref_fields");
      }
      if (/\b(Account Number|Routing Number|Sort Code|IBAN|SWIFT|BIC|CVV|CVC|Expiry|Expiration|Valid Thru)\b/i.test(t)) {
        score += 26; signals.push("en:bank_card_fields");
      }
      if (/\b(Phone|Email|Address|Shipping Address|Billing Address)\b/i.test(t)) {
        score += 18; signals.push("en:contact_fields");
      }
      if (/\b(Username|Login|Handle|Password|OTP|2FA)\b/i.test(t)) {
        score += 18; signals.push("en:auth_fields");
      }

      // penalty if a lot of Chinese characters (mixed content)
      const han = (t.match(/[\u4E00-\u9FFF]/g) || []).length;
      const total = Math.max(1, t.length);
      if (han / total > 0.02) { score -= 18; signals.push("mix:han"); }

      if (score < 0) score = 0;
      if (score > 100) score = 100;

      const confidence = score >= 80 ? 0.9 : score >= 70 ? 0.8 : score >= 55 ? 0.65 : score >= 40 ? 0.5 : 0.3;
      return { lang: "en", score, confidence, signals };
    },

    // Language-specific execution order
    priority: [
      // 1) secrets / auth
      "secret",
      "api_key_token",
      "bearer_token",
      "security_answer",

      // 2) identity
      "dob",
      "place_of_birth",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      // 3) device / network
      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      // 4) financial
      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      // 5) comms
      "email",
      "url",

      // 6) refs / IDs / handles
      "handle_label",
      "cust_id",
      "ref_label_tail",

      // 7) money
      "money_label",
      "money",

      // 8) phone AFTER ids
      "phone",

      // 9) org / person (org first)
      "company",
      "person_name",

      // 10) address
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      // 11) crypto / chain
      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      // 12) generic
      "handle",
      "number"
    ],

    // Language-specific always-on set
    alwaysOn: [
      // secrets / auth
      "secret",
      "api_key_token",
      "bearer_token",
      "security_answer",

      // identity
      "dob",
      "place_of_birth",
      "passport",
      "driver_license",
      "ssn",
      "ein",
      "national_id",
      "tax_id",

      // device / network
      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      // financial
      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      // money
      "money_label",
      "money",

      // org / person
      "company",
      "person_name",

      // address
      "address_en_inline_street",
      "address_en_extra_block",
      "address_en_extra",

      // refs
      "cust_id",
      "ref_label_tail",

      // crypto
      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      // handles
      "handle_label"
    ],

    // Phone FP guard: prevent IDs / refs being treated as phone
    phoneGuard: function ({ label, value, match }) {
      const lbl = String(label || "").toLowerCase();
      const val = String(value || "");
      const raw = String(match || value || "");
      const digits = val.replace(/\D+/g, "");

      // 长数字串：更可能是 ID / 账号，而不是手机号
      if (digits.length >= 16) return false;

      // label 像典型编号字段（Case ID / Ticket No / Order ID ...）
      if (
        /\b(?:case|ticket|order|invoice|reference|ref|customer|application|request|account|portal|contract|claim|legal)\b/.test(lbl) &&
        /\b(?:id|no|number|#)\b/.test(lbl)
      ) {
        return false;
      }

      // 原始片段里带典型业务 ID 前缀
      // CUST- / CASE- / ORD- / INV- / APP- / REF- / ACC- / MEM- / INS- / REQ- / PR- / LC- / CLM- / CNT-
      if (/\b(?:CUST|CASE|ORD|INV|APP|REF|ACC|MEM|INS|REQ|PR|LC|CLM|CNT)-/i.test(raw)) {
        return false;
      }

      // 通用业务 ID 模式：大写前缀 + 多段 -/._ + 4+ 尾数
      if (/\b[A-Z]{2,6}(?:-[A-Z0-9]{1,12}){1,6}-\d{4,}\b/i.test(raw)) {
        return false;
      }

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
      /* ===================== EMAIL ===================== */
      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      /* ===================== URL ===================== */
      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'\n\r）)\]】]+/giu,
        tag: "URL"
      },

      /* ===================== MONEY (label-driven) ===================== */
      money_label: {
        pattern:
          /((?:amount|total|subtotal|grand\s*total|price|fee|fees|charge|charges|balance|paid|payment|refund|due|net|gross|tax|vat)\s*[:：=]\s*)([-+−]?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2}))/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      /* ===================== MONEY (with explicit currency) ===================== */
      money: {
        pattern:
          /(?:\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b\s*[-+−]?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\b[-+−]?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?\s*\b(?:EUR|USD|GBP|CHF|RMB|CNY|HKD)\b|[€$£¥￥]\s*[-+−]?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)/giu,
        tag: "MONEY"
      },

      /* ===================== SECRET (password / OTP / codes) ===================== */
      secret: {
        pattern:
          /((?:password|passcode|pin|otp|2fa|verification\s*code|security\s*code|one[-\s]?time\s*code|recovery\s*code|backup\s*code)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== API keys / tokens ===================== */
      api_key_token: {
        // FIX A: "authorization" removed here; bearer_token owns it
        pattern:
          /((?:api\s*key|x-api-key|access\s*token|refresh\s*token|token|auth\s*token|client\s*secret|secret\s*key)\s*[:：=]\s*)([A-Za-z0-9._\-]{8,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      bearer_token: {
        pattern: /(\bauthorization\s*[:：=]\s*bearer\s+)([A-Za-z0-9._\-]{8,400})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== USERNAME / HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:username|user\s*id|login\s*id|login|handle)\s*(?:[:：=]|-)\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== SECURITY ANSWER (label-driven) ===================== */
      security_answer: {
        pattern: /((?:answer|security\s*answer)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== DOB / Date of birth ===================== */
      dob: {
        pattern: /((?:date\s*of\s*birth|dob)\s*[:：=]\s*\d{4}[-\/\.])(\d{2}[-\/\.]\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Place of birth ===================== */
      place_of_birth: {
        pattern: /((?:place\s*of\s*birth|pob|birthplace)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Passport ===================== */
      passport: {
        pattern: /((?:passport(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Driver license ===================== */
      driver_license: {
        pattern:
          /((?:driver[’']?s\s*license(?:\s*(?:no\.?|number))?|driving\s*licen[cs]e(?:\s*(?:no\.?|number))?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9\-]{4,28})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== US SSN ===================== */
      ssn: {
        pattern: /((?:ssn|social\s*security\s*number)\s*[:：=]\s*)(\d{3}-\d{2}-\d{4}|\d{9})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Business / tax IDs (EIN / TIN / National ID) ===================== */
      ein: {
        pattern: /((?:ein|employer\s*identification\s*number)\s*[:：=]\s*)(\d{2}-\d{7})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      national_id: {
        pattern:
          /((?:national\s*id(?:\s*(?:no\.?|number))?|id\s*number)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_id: {
        pattern:
          /((?:tax\s*id|tax\s*identification\s*(?:no\.?|number)|tin)\s*[:：=]\s*)([A-Za-z0-9][A-Za-z0-9\-]{4,32})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IP (label-driven) ===================== */
      ip_label: {
        pattern:
          /((?:ip\s*address|ipv4|ipv6)\s*[:：=]\s*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IP (bare) ===================== */
      ip_address: {
        pattern:
          /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
        tag: "SECRET"
      },

      /* ===================== MAC (label-driven) ===================== */
      mac_label: {
        pattern: /((?:mac\s*(?:address)?)\s*[:：=]\s*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== MAC (bare) ===================== */
      mac_address: {
        pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
        tag: "SECRET"
      },

      /* ===================== IMEI ===================== */
      imei: {
        pattern: /((?:imei)\s*[:：=]\s*)(\d{14,16})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Device / session / fingerprint / user-agent ===================== */
      device_fingerprint: {
        pattern:
          /((?:device\s*id|session\s*id|fingerprint|user\s*agent)\s*[:：=]\s*)([^\n\r]{1,220})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== UUID / GUID (bare) ===================== */
      uuid: {
        pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
        tag: "SECRET"
      },

      /* ===================== ACCOUNT / CARD / IBAN (label-driven) ===================== */
      account: {
        pattern:
          /((?:account(?:\s*number)?|routing\s*number|sort\s*code|iban|credit\s*card|debit\s*card|card\s*number|name\s*on\s*card)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== Bank SWIFT / BIC ===================== */
      bank: {
        pattern:
          /((?:swift|swift\s*code|bic)\b\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== Bank routing / clearing / branch (label-driven) ===================== */
      bank_routing_ids: {
        pattern:
          /((?:bank\s*name|branch\s*code|clearing\s*(?:number|no\.?)|transit\s*number|bsb|aba\s*(?:number|routing\s*number)?|aba)\s*[:：=]\s*)([0-9][0-9\s-]{2,24}[0-9])/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== Card expiry ===================== */
      card_expiry: {
        pattern:
          /((?:exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*through)\s*[:：=]\s*)(\d{2}\s*\/\s*\d{2,4}|\d{2}\s*-\s*\d{2,4}|\d{4}\s*-\s*\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Card security code ===================== */
      card_security: {
        pattern: /((?:cvv|cvc)\s*[:：=]\s*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        pattern:
          /((?:phone|mobile|contact|tel|whatsapp|telegram|signal|fax)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(?<![A-Za-z0-9_-])(\b(?:[+＋]\s*\d{1,3}|0{2}\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (line-anchored; keep title) ===================== */
      person_name: {
        // v6.2-stable: line-anchored, no cross-line; allow optional trailing inline comment
        // Minimal extension: allow From/To/Attn labels (still requires ":/=" and capitalized-name structure)
        pattern:
          /^((?:name|customer\s*name|account\s*holder|recipient|name\s*on\s*card|from|to|attn\.?|attention)[ \t]*[:：=][ \t]*(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?)((?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})(?:[ \t]+(?:\([^\n\r]{0,120}\)))?[ \t]*$/gmiu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== COMPANY (legal suffix kept) ===================== */
      company: {
        pattern:
          /\b(?<name>[A-Za-z][A-Za-z0-9&.\- ]{1,60}?)\s+(?<legal>LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP|Co\.?|Company)\b/giu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== ADDRESS (inline street line, e.g. "1600 Amphitheatre Parkway") ===================== */
      address_en_inline_street: {
        pattern:
          /\b\d{1,5}[A-Za-z]?(?:-\d{1,5})?\s+(?:[A-Za-z0-9.'’\-]+\s+){0,6}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|parkway|pkwy\.?|court|ct\.?|place|pl\.?|square|sq\.?|highway|hwy\.?|terrace|ter\.?|crescent|cres\.?|close|cl\.?|gardens?|gdns?\.?|mews|row|alley|aly\.?)\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== ADDRESS EXTRA (suite / apt / unit / floor / room) ===================== */
      address_en_extra_block: {
        // 只遮 "suite/apt/unit/floor/room + id" 片段
        pattern:
          /\b(?:suite|ste\.?|apt|apartment|unit|floor|fl\.?|room|rm\.?)\b(?:\s*(?:#|no\.?|number)?\s*[:：-]?\s*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      address_en_extra: {
        pattern:
          /\b(?:apt|apartment|unit|suite|ste\.?|floor|fl\.?|room|rm\.?|building|bldg\.?|dept|department)\b(?:\s+#?\s*|#\s*)(?=[A-Za-z0-9.\-]{1,12}\b)(?=[A-Za-z0-9.\-]*\d)[A-Za-z0-9.\-]{1,12}\b/giu,
        tag: "ADDRESS"
      },

      /* ===================== CUSTOMER ID (CUST-...) ===================== */
      cust_id: {
        // Customer ID: CUST-004918273645 -> Customer ID: CUST-[Ref]
        pattern: /((?:customer\s*id)\s*[:：=]\s*CUST-)(?![^\n\r]*\[Ref\])(\d{6,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== REF TAIL MASK (label-driven; tail-only policy) ===================== */
      ref_label_tail: {
        // Tail-only replacement: keep prefix/body, mask ONLY the last numeric tail (>=4 digits)
        // Covers:
        // Case ID / Ticket No. / Application ID / Order ID / Invoice No. / Reference /
        // Request ID / Account ID / Customer ID / Portal Ref / ...
        pattern:
          /(((?:application|order|invoice|reference|ref\.?|case|ticket|request|customer|portal\s*ref)\s*(?:id|no\.?|number)?|account\s*id)\s*(?:[:：=]|-)\s*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,10}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== HANDLE (generic @username) ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== WEB3: Wallet ID / Tx Hash / Wallet addresses ===================== */
      wallet_id: {
        pattern: /((?:wallet\s*id)\s*[:：=]\s*)([A-Za-z0-9._\-]{3,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tx_hash: {
        pattern: /((?:transaction\s*hash|tx\s*hash|txn\s*hash)\s*[:：=]\s*)(0x[0-9a-f]{16,128})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      crypto_wallet: {
        pattern:
          /((?:btc|eth)\s*[:：=]\s*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
