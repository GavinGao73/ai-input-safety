// v1.4 — privacy rules tuned for "personal / readable" redaction
//
// Goals:
// - Keep document readable for AI/humans (labels remain, values masked)
// - No URL handling by design
// - Company name: mask ONLY the core identifying word (brand/主体词), keep suffix + region/type
//
// Notes:
// - Money range masking may still be handled in app.js (M2 needs range computation).
// - This file provides robust detection patterns and capture groups for value-first masking.
// - NUMBER is optional fallback (default OFF).

const RULES_BY_KEY = {
  /* ===================== EMAIL ===================== */
  email: {
    // allow spaces around @ and dot (PDF extraction artifacts)
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

  /* ===================== COMPANY (NEW) ===================== */
  // ✅ Mask ONLY the "core identifying word" (brand/主体词) in company names.
  //
  // Design: capture groups are structured so downstream can keep labels/affixes:
  // - CN:   (1 optional city/province prefix) (2 brand/core) (3 middle descriptor) (4 legal suffix)
  // - DE/EN:(1 brand/core) (2 legal suffix)
  //
  // Examples expected:
  // - 嘉曜兴包装制品（东莞）有限公司 -> mask 嘉曜兴, keep 包装制品（东莞）有限公司
  // - 律商（上海）文化发展有限公司 -> mask 律商, keep （上海）文化发展有限公司
  // - 上海律商文化发展有限公司     -> mask 律商, keep 文化发展有限公司
  // - Beide Tech GmbH            -> mask Beide, keep Tech GmbH
  company: {
    pattern: new RegExp(
      [
        // ----- CN company with legal suffix -----
        // (optional leading city/province token) (brand) (rest) (suffix)
        // City/province token: 2–3 Han chars (e.g., 上海/北京/广东)
        // Brand: 2–12 chars (Han/Latin/digits/·&-)
        // Rest: up to ~40 chars including brackets
        String.raw`(?:` +
          String.raw`((?:[\p{Script=Han}]{2,3})?)` + // (1) optional city/province prefix
          String.raw`([\p{Script=Han}A-Za-z0-9·&\-]{2,12})` + // (2) brand/core (MASK THIS)
          String.raw`([\p{Script=Han}A-Za-z0-9（）()·&\-\s]{0,40}?)` + // (3) descriptor/region/type
          String.raw`(股份有限公司|有限责任公司|有限公司|集团有限公司|集团|公司)` + // (4) legal suffix
        String.raw`)`,

        // OR

        // ----- DE/EN company legal forms -----
        // (brand/core) (legal suffix)
        String.raw`(?:` +
          String.raw`\b([A-Za-z][A-Za-z0-9&.\-]{1,40}?)\b` + // (1) brand/core (MASK THIS)
          String.raw`(\s+(?:GmbH(?:\s*&\s*Co\.\s*KG)?|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC|S\.?A\.?|S\.?r\.?l\.?|B\.?V\.?))\b` + // (2) legal suffix
        String.raw`)`
      ].join("|"),
      "giu"
    ),
    tag: "COMPANY",
    mode: "company"
  },

  /* ===================== BANK / IBAN ===================== */
  // IBAN itself (no label needed) — fully sensitive
  bank: {
    pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\b/g,
    tag: "ACCOUNT"
  },

  /* ===================== ACCOUNT (label + value) ===================== */
  // Keep label, mask the number group (2)
  account: {
    pattern:
      /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|Kontonummer|Account(?:\s*No\.)?|IBAN)\s*[:：]?\s*)(\d[\d\s-]{10,30}\d)/gi,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== PHONE (label + value OR international) ===================== */
  // Keep label when present; otherwise mask international +xxx...
  phone: {
    pattern:
      /((?:tel|telefon|phone|mobile|handy|kontakt|whatsapp|联系方式|联系电话|电话|手機|手机|联系人|聯繫方式)\s*[:：]?\s*)(\+?\d[\d\s().-]{3,}\d)|(\+\d[\d\s().-]{3,}\d)/gi,
    tag: "PHONE",
    mode: "phone"
  },

  /* ===================== MONEY ===================== */
  // Goal: keep currency token/sign/unit, mask digits range in app.js (or downstream)
  // - (1 currency code)(2 amount)
  // - (3 currency sign)(4 amount)
  // - (5 amount)(6 unit)
  money: {
    pattern:
      /(\b(?:EUR|RMB|CNY|USD|HKD|GBP|CHF)\b)\s*([\d][\d\s.,]*\d)|([€$¥])\s*([\d][\d\s.,]*\d)|([\d][\d\s.,]*\d)\s*(元|人民币|欧元|美元|英镑|瑞郎)/gi,
    tag: "MONEY",
    mode: "money"
  },

  /* ===================== ADDRESS (DE street + house no.) ===================== */
  // Value-only street pattern (label handling is done in raster-export shrinkByLabel)
  address_de_street: {
    pattern:
      /\b[\p{L}ÄÖÜäöüß.\- ]{2,60}\b(?:str\.?|straße|weg|platz|allee|gasse)\s*\d{1,4}\w?\b/giu,
    tag: "ADDRESS"
  },

  /* ===================== HANDLE ===================== */
  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  /* ===================== REF ===================== */
  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  /* ===================== TITLE ===================== */
  title: {
    pattern: /\b(Mr|Ms|Mrs|Herr|Frau|Fr\.|Hr\.)\b/gi,
    tag: "TITLE"
  },

  /* ===================== NUMBER (optional fallback) ===================== */
  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

window.RULES_BY_KEY = RULES_BY_KEY;
