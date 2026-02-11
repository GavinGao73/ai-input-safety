const RULES_BY_KEY = {
  email:   { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replace: "[EMAIL]" },
  phone:   { pattern: /\+?\d(?:[\d\s-]){7,}\d/g, replace: "[PHONE]" },
  bank:    { pattern: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){3,5}\b/g, replace: "[BANK]" },
  address: { pattern: /[\u4e00-\u9fff]{2,}(路|街|大道|大街)\d+号?/g, replace: "[ADDRESS]" },
  id:      { pattern: /\b[A-Z0-9]{8,24}\b/gi, replace: "[ID]" },
  cred:    { pattern: /\b(password|pwd|pass|token|api[_-]?key|secret)\b\s*[:=]\s*\S+/gi, replace: "[CREDENTIAL]" },
  url:     { pattern: /\bhttps?:\/\/\S+/gi, replace: "[URL]" },
  handle:  { pattern: /@[A-Za-z0-9_]{2,32}\b/g, replace: "[HANDLE]" },
  ref:     { pattern: /\b[A-Z]{2,5}-?\d{4,}\b/g, replace: "[REF]" },
  title:   { pattern: /\b(Mr|Ms|Mrs|Herr|Frau)\b/gi, replace: "[TITLE]" }
};

window.RULES_BY_KEY = RULES_BY_KEY;

