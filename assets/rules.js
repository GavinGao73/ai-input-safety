// v1.2.2 — tightened & multilingual placeholder-ready rules
// Design goals:
// - No generic "ID" pattern (avoid contaminating normal text)
// - Phone: only "+..." OR phone-context (Tel/电话/WhatsApp etc.) — avoids house numbers
// - Address (DE street + house no.): mask street+house, keep city/country
// - Account: context-aware (银行账号/Account No./Kontonummer...)
// - Email: tolerate spaces around @ and dots (PDF extraction artifacts)
// - NUMBER: optional fallback (default OFF in catalog)

const RULES_BY_KEY = {
  // EMAIL (tolerate spaces caused by PDF extraction)
  email: {
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

  // IBAN (EU)
  bank: {
    pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\b/g,
    tag: "ACCOUNT"
  },

  // Account number (context-aware): 12–25 digits (allow spaces/hyphens)
  account: {
    pattern:
      /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|Kontonummer|Account(?:\s*No\.)?)\s*[:：]?\s*)(\d[\d\s-]{10,30}\d)/gi,
    tag: "ACCOUNT",
    mode: "prefix" // keep the label prefix
  },

  // PHONE: only matches if
  //  A) has +country prefix (international-like), OR
  //  B) appears after phone-context words (Tel/Telefon/电话/联系方式/WhatsApp...)
  phone: {
    pattern:
      /((?:tel|telefon|phone|mobile|handy|kontakt|whatsapp|联系方式|联系电话|电话|手機|手机|联系人|聯繫方式)\s*[:：]?\s*)(\+?\d[\d\s().-]{3,}\d)|(\+\d[\d\s().-]{3,}\d)/gi,
    tag: "PHONE",
    mode: "phone" // special handling: if group1 exists keep prefix
  },
   
  money: {
  // currency amounts: EUR/€/$/¥/RMB/CNY + common separators
  pattern: /\b(?:EUR|RMB|CNY|USD|HKD|GBP|CHF)\s*[\d][\d\s.,]*\d\b|[€$¥]\s*[\d][\d\s.,]*\d\b|[\d][\d\s.,]*\d\s*(?:元|人民币|欧元|美元|英镑|瑞郎)\b/gi,
  tag: "MONEY"
},

  // German street + house number: mask street+house, keep city/country separately
  // Matches: "...str. 13", "...straße 13a", "...weg 10", "...platz 1"
  address_de_street: {
    pattern:
      /\b[\p{L}ÄÖÜäöüß.\- ]{2,60}\b(?:str\.?|straße|weg|platz|allee|gasse)\s*\d{1,4}\w?\b/giu,
    tag: "ADDRESS"
  },

  // URL
  url: {
    pattern: /\bhttps?:\/\/\S+/gi,
    tag: "URL"
  },

  // Social handle
  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  // Reference-like codes (stricter than generic ID)
  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  // Titles
  title: {
    pattern: /\b(Mr|Ms|Mrs|Herr|Frau|Fr\.|Hr\.)\b/gi,
    tag: "TITLE"
  },

  // NUMBER (optional fallback): long digit sequences (8–30), allow spaces/hyphens
  // Default OFF in catalog
  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

window.RULES_BY_KEY = RULES_BY_KEY;
