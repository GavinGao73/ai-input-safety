// v1.3 — money protection (M1/M2) + stable privacy rules (no URL handling by design)
//
// Notes:
// - Money masking is handled in app.js (because M2 needs range computation).
// - This file only provides robust money detection pattern.
// - NUMBER is optional fallback (default OFF).

const RULES_BY_KEY = {
  email: {
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

  bank: {
    pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\b/g,
    tag: "ACCOUNT"
  },

  account: {
    pattern:
      /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|Kontonummer|Account(?:\s*No\.)?)\s*[:：]?\s*)(\d[\d\s-]{10,30}\d)/gi,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  // Phone: +international OR phone-context word before number
  phone: {
    pattern:
      /((?:tel|telefon|phone|mobile|handy|kontakt|whatsapp|联系方式|联系电话|电话|手機|手机|联系人|聯繫方式)\s*[:：]?\s*)(\+?\d[\d\s().-]{3,}\d)|(\+\d[\d\s().-]{3,}\d)/gi,
    tag: "PHONE",
    mode: "phone"
  },

  // Money: detect currency sign/keyword + amount
  // (range masking is handled in app.js)
  money: {
    pattern:
      /(\b(?:EUR|RMB|CNY|USD|HKD|GBP|CHF)\b)\s*([\d][\d\s.,]*\d)|([€$¥])\s*([\d][\d\s.,]*\d)|([\d][\d\s.,]*\d)\s*(元|人民币|欧元|美元|英镑|瑞郎)/gi,
    tag: "MONEY",
    mode: "money"
  },

  // German street + house number => mask street+house
  address_de_street: {
    pattern:
      /\b[\p{L}ÄÖÜäöüß.\- ]{2,60}\b(?:str\.?|straße|weg|platz|allee|gasse)\s*\d{1,4}\w?\b/giu,
    tag: "ADDRESS"
  },

  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  title: {
    pattern: /\b(Mr|Ms|Mrs|Herr|Frau|Fr\.|Hr\.)\b/gi,
    tag: "TITLE"
  },

  number: {
    pattern: /\b\d[\d\s-]{6,28}\d\b/g,
    tag: "NUMBER"
  }
};

window.RULES_BY_KEY = RULES_BY_KEY;
