// v1.6 — privacy rules tuned for "personal / readable" redaction
//
// Goals:
// - Keep document readable for AI/humans (labels remain, values masked)
// - No URL handling by design
// - Company name: mask ONLY the core identifying word (brand/主体词), keep suffix + region/type
// - Person name: mask names with strong context to avoid false positives

const RULES_BY_KEY = {
  /* ===================== EMAIL ===================== */
  email: {
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

    /* ===================== PERSON NAME (REAL-WORLD SAFE) ===================== */
  // Strategy:
  // - CN: 姓+名（避免任意2–4字误伤）
  // - EN: 允许单个首字母大写名字（商业文档高频）
  // - 优先降低漏检，而不是学术上的“姓名正确性”

   /* ===================== PERSON NAME (REAL-WORLD SAFE) ===================== */
  // Strategy:
  // - CN: 姓+名（避免任意2–4字误伤）
  // - EN: 允许单个首字母大写名字（商业文档高频）
  // - 优先降低漏检，而不是学术上的“姓名正确性”

  person_name: {
    pattern: new RegExp(
      [
        // 中文姓名：常见姓氏 + 1–2字名
        String.raw`\b(?:赵|钱|孙|李|周|吴|郑|王|冯|陈|刘|杨|黄|张|朱|林|何|高|郭|马|罗|梁|宋|郑|谢|韩|唐|许|邓|冯|曹|彭|曾|肖|田)[\p{Script=Han}]{1,2}\b`,

        // 英文单名（核心修复点）
        // Kathy / Michael / David / Anna / Lucas
        String.raw`\b[A-Z][a-z]{2,20}\b`,

        // 英文完整姓名（保留）
        String.raw`\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b`
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
