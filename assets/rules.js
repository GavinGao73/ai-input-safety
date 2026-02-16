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
person_name: {
  tag: "PERSON",
  // 更保守：只认“标签引导值”或“至少两段且像人名”的英文/德文姓名
  // 额外防误伤：不吃域名/邮箱/公司后缀（GmbH/AG/...）
  pattern: new RegExp(
    [
      // A) 标签引导：姓名/联系人/... 后面跟的值（支持中文 2–4 字 或 拉丁字母姓名）
      String.raw`(?:^|[^\p{L}\p{N}@.])(?:姓名|联系人|联\s*系\s*人|Ansprechpartner(?:in)?|Kontakt(?:person)?|Name|Contact)\s*[:：]?\s*` +
      String.raw`(` +
        // 中文名：2–4 个汉字（只在“标签引导”后允许）
        String.raw`[\p{Script=Han}]{2,4}` +
        String.raw`|` +
        // 拉丁字母：至少两段（First Last / First Middle Last）
        String.raw`[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}){1,2}` +
      String.raw`)`,

      // B) 非标签：至少两段、每段首字母大写；并排除公司后缀/域名/邮箱
      String.raw`(?:^|[^\p{L}\p{N}@.])` +
      String.raw`(` +
        String.raw`[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}\s+` +
        String.raw`[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'.-]{1,30}` +
      String.raw`)` +
      // 右侧不是域名/邮箱继续部分
      String.raw`(?!\s*@)(?!\.[A-Za-z]{2,6})` +
      // 第二段不是公司后缀
      String.raw`(?!\s+(?:GmbH|AG|UG|KG|GbR|e\.K\.|Ltd\.?|Inc\.?|LLC|S\.?A\.?|S\.?r\.?l\.?|B\.?V\.?)\b)`
    ].join("|"),
    "gu"
  ),
  mode: "person"
},

  /* ===================== COMPANY ===================== */
  company: {
  tag: "COMPANY",
  // 更保守：只命中“像公司名的东西”
  // 1) 带明确公司后缀：GmbH/UG/AG/Ltd/Inc/LLC/股份有限公司/有限公司/公司 等
  // 2) 或“公司/单位/Firma/Company”标签后的值（长度限制，防止整句吞掉）
  // 同时排除“贵公司/本公司/该公司”这种泛称
  pattern: /(?:^|[^\p{L}\p{N}])(?:公司|单位|Firma|Company)\s*[:：]?\s*(?!贵公司|本公司|该公司)([^\n\r,，;；]{2,48}?(?:GmbH|UG\s*\(haftungsbeschränkt\)|AG|KG|OHG|e\.V\.|Ltd\.?|Limited|Inc\.?|Incorporated|LLC|Co\.?,?\s*Ltd\.?|股份有限公司|有限责任公司|有限公司|公司))|(?<!贵公司)(?<!本公司)(?<!该公司)([^\n\r,，;；]{2,48}?(?:GmbH|UG\s*\(haftungsbeschränkt\)|AG|KG|OHG|e\.V\.|Ltd\.?|Limited|Inc\.?|Incorporated|LLC|Co\.?,?\s*Ltd\.?|股份有限公司|有限责任公司|有限公司|公司))/gu
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
