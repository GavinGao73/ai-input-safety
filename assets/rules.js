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

  /* ===================== PERSON NAME (CONSERVATIVE) ===================== */
  person_name: {
    tag: "PERSON",
    // 只在两种情况下命中：
    // A) 明确标签引导后的值（姓名/联系人/Ansprechpartner/Name/Contact）
    // B) 英文/德文至少两段的人名（First Last），避免 Hinweise/Deutschland 之类误伤
    pattern:
      /(?:^|[^\p{L}])(?:姓名|联系人|联\s*系\s*人|Ansprechpartner(?:in)?|Kontakt(?:person)?|Name|Contact)\s*[:：]?\s*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}){1,2})|([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}\s+[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30})/gu
  },

  /* ===================== COMPANY (SAFER) ===================== */
  company: {
    pattern: new RegExp(
      String.raw`(?:` +
        // CN company: optional 2–3 Han prefix + core(2–12, MUST contain Han/Letter) + tail + legal suffix
        String.raw`((?:[\p{Script=Han}]{2,3})?)` +
        // ✅ core must contain at least one Han OR letter (blocks pure numbers / garbage)
        String.raw`((?=[\p{Script=Han}A-Za-z])[\p{Script=Han}A-Za-z0-9·&\-]{2,12})` +
        // tail: keep short, avoid swallowing whole sentences
        String.raw`([\p{Script=Han}A-Za-z0-9（）()·&\-\s]{0,24}?)` +
        String.raw`(股份有限公司|有限责任公司|有限公司|集团有限公司|集团|公司)` +
        String.raw`)` +
        String.raw`|` +
        // DE/EN company: name + legal form
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

  /* ===================== MONEY (STEADY / LOW-FP) ===================== */
  money: {
    // 只在“明确货币标识”出现时命中（更稳态，降低误伤）：
    // - 货币代码/符号在前：EUR 1.234,56 / $1,234.56 / ¥ 12,000
    // - 单位在后：1,234.56 USD / 12000 元 / 199 RMB
    //
    // 约束：
    // - 金额主体至少 2 位数字（避免把“€5”这种太短的也全抓，若你要抓可改 {2,} -> {1,}）
    // - 支持千分位（, . 空格）+ 可选小数（.xx 或 ,xx）
    pattern: new RegExp(
      String.raw`(?:` +
        // prefix: code/symbol + amount
        String.raw`(?:\b(?:EUR|USD|RMB|CNY|HKD|GBP|CHF)\b|[€$¥£])\s*` +
          String.raw`(` +
            String.raw`\d{2,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?` + // 1.234,56 / 1,234.56 / 12 000,00
            String.raw`|\d{4,18}(?:[.,]\d{2})?` +             // 12000 / 12000,00 (no thousand sep)
          String.raw`)` +
        String.raw`)` +
      String.raw`|` +
      String.raw`(?:` +
        // suffix: amount + unit/code
        String.raw`(` +
          String.raw`\d{2,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?` +
          String.raw`|\d{4,18}(?:[.,]\d{2})?` +
        String.raw`)` +
        String.raw`\s*(?:\b(?:EUR|USD|RMB|CNY|HKD|GBP|CHF)\b|元|人民币|欧元|美元|英镑|瑞郎)` +
      String.raw`)`,
      "giu"
    ),
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
