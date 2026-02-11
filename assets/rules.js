// v1.2 — tightened rules to reduce false positives
// Key principles:
// 1) Remove dangerous generic ID pattern
// 2) Add context-aware account rule
// 3) Strengthen email/phone/bank/DE-address stability

const RULES_BY_KEY = {
  // 1) Email — keep whole token
  email: {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replace: "[EMAIL]"
  },

  // 2) IBAN (EU) — strict
  bank: {
    pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,7}\b/g,
    replace: "[BANK]"
  },

  // 3) Account number (context-aware) — "银行账号/账号/Account" + 12–25 digits
  // Avoid matching prices or random long digits in other contexts.
  account: {
    pattern: /((?:银行账号|銀行賬號|账号|賬號|收款账号|账户|帳戶|Kontonummer|Account(?:\s*No\.)?)\s*[:：]?\s*)(\d[\d\s-]{10,30}\d)/gi,
    replace: "$1[ACCOUNT]"
  },

  // 4) Phone — more conservative; requires +country or clear separators, length >= 8 digits
  phone: {
    pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d[\d\s-]{6,}\d/g,
    replace: "[PHONE]"
  },

  // 5) German address (street + house no.) — conservative
  // Examples: "Albrecht-Dürer-Str 13", "Musterstraße 5", "Hauptweg 10a"
  address_de_street: {
    pattern: /\b[\p{L}ÄÖÜäöüß.\- ]{2,40}\b(?:str\.?|straße|weg|platz|allee|gasse)\s*\d{1,4}\w?\b/giu,
    replace: "[ADDRESS_STREET]"
  },

  // 6) German postal code + city — 5 digits + City (optional country)
  address_de_city: {
    pattern: /\b\d{5}\s+[\p{L}ÄÖÜäöüß.\- ]{2,40}\b/giu,
    replace: "[ADDRESS_CITY]"
  },

  // 7) URL
  url: {
    pattern: /\bhttps?:\/\/\S+/gi,
    replace: "[URL]"
  },

  // 8) Social handle
  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    replace: "[HANDLE]"
  },

  // 9) Reference-like codes — keep, but stricter than old generic ID
  // e.g. "AB-20240123", "INV-123456", "CN20250101"
  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    replace: "[REF]"
  },

  // 10) Title
  title: {
    pattern: /\b(Mr|Ms|Mrs|Herr|Frau|Fr\.|Hr\.)\b/gi,
    replace: "[TITLE]"
  }
};

window.RULES_BY_KEY = RULES_BY_KEY;
