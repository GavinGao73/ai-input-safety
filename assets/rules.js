// v1.6 — privacy rules tuned for "personal / readable" redaction
//
// Goals:
// - Keep document readable for AI/humans (labels remain, values masked)
// - No URL handling by design
// - Company name: mask ONLY the core identifying word (brand/主体词), keep suffix + region/type
// - Person name: mask full CN/EN personal names (best-effort, conservative)
//
// Notes:
// - Money range masking may still be handled in app.js (M2 needs range computation).
// - This file provides robust detection patterns and capture groups for value-first masking.
// - NUMBER is optional fallback (default OFF).

const RULES_BY_KEY = {
  /* ===================== EMAIL ===================== */
  email: {
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

  /* ===================== PERSON NAME (FIXED) ===================== */
  // ✅ Fixes:
  // 1) CN names: DO NOT use \b (word boundary doesn't work well for Han)
  //    Use Han-lookarounds to avoid matching inside long Han strings.
  // 2) Allow single-word EN name when preceded by label (联系人/Name/Contact/Attn...)
  // 3) Keep EN multi-word name support.
  person_name: {
    pattern: new RegExp(
      [
        // (A) Label + Name (CN or EN single word)
        String.raw`(?:` +
          String.raw`(?:联系人|收件人|负责人|经办人|姓名|Name|Contact|Attn\.?|Ansprechpartner)\s*[:：]?\s*` +
          String.raw`(?:` +
            // CN name after label
            String.raw`(?<![\p{Script=Han}])[\p{Script=Han}]{2,4}(?:·[\p{Script=Han}]{1,4})?(?![\p{Script=Han}])` +
            String.raw`|` +
            // EN single-word name after label (e.g., Kathy)
            String.raw`[A-Z][A-Za-z]{1,30}(?:[-'][A-Za-z]{1,30})?` +
          String.raw`)` +
        String.raw`)`,

        // OR

        // (B) Standalone CN name (2–4 Han, optional ·), bounded by Han-lookaround
        String.raw`(?<![\p{Script=Han}])[\p{Script=Han}]{2,4}(?:·[\p{Script=Han}]{1,4})?(?![\p{Script=Han}])`,

        // OR

        // (C) Standalone EN full name (First Last / First Middle Last)
        String.raw`\b[A-Z][a-z]+(?:[-'][A-Za-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Za-z]+)?){1,2}\b`
      ].join("|"),
      "gu"
    ),
    tag: "PERSON",
    mode: "person"
  },

  /* ===================== COMPANY ===================== */
  company: {
    pattern: new RegExp(
      String.raw`(?:` +
        String.raw`((?:[\p{Script=Han}]{2,3})?)` +
        String.raw`([\p{Script=Han}A-Za-z0-9·&\-]{2,12})` +
        String.raw`([\p{Script=Han}A-Za-z0-9（）()·&\-\s]{0,40}?)` +
        String.raw`(股份有限公司|有限责任公司|有限公司|集团有限公司|集团|公司)` +
      String.raw`)` +
      String.raw`|` +
      String.raw`(?:` +
        String.raw`\b([A-Za-z][A-Za-z0-9&.\-]{1,40}?)\b` +
        String.raw`(\s+(?:GmbH(?:\s*&\s*Co\.\s*KG)?|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC|S\.?A\.?|S\.?r\.?l\.?|B\.?V\.?))\b` +
      String.raw`)`,
      "giu"
    ),
    tag: "COMPANY",
    mode: "company"
  },

  /* ===================== BANK / IBAN ===================== */
  bank: {
    pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\b/g,
    tag: "ACCOUNT"
  },

  /* ===================== ACCOUNT (label + value) ===================== */
  account: {
    pattern:
      /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|Kontonummer|Account(?:\s*No\.)?|IBAN)\s*[:：]?\s*)(\d[\d\s-]{10,30}\d)/gi,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== PHONE ===================== */
  phone: {
    pattern: new RegExp(
      [
        String.raw`((?:tel|telefon|phone|mobile|handy|kontakt|whatsapp|wechat|telegram|` +
          String.raw`联系方式|联系电话|电话|手機|手机|联系人|聯繫方式)\s*[:：]?\s*)` +
        String.raw`((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)`,

        String.raw`((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d)` +
        String.raw`(?:\s*\((?:WhatsApp|WeChat|Telegram|Signal)\))?`,

        String.raw`(\b0\d{2,4}[\d\s().-]{6,}\d\b)`
      ].join("|"),
      "giu"
    ),
    tag: "PHONE",
    mode: "phone"
  },

  /* ===================== MONEY ===================== */
  money: {
    pattern:
      /(\b(?:EUR|RMB|CNY|USD|HKD|GBP|CHF)\b)\s*([\d][\d\s.,]*\d)|([€$¥])\s*([\d][\d\s.,]*\d)|([\d][\d\s.,]*\d)\s*(元|人民币|欧元|美元|英镑|瑞郎)/gi,
    tag: "MONEY",
    mode: "money"
  },

  /* ===================== ADDRESS ===================== */
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
