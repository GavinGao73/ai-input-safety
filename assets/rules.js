// rules.js
// v1.8 — privacy rules tuned for "personal / readable" redaction (EN-first expansion)
//
// Goals:
// - Keep document readable for AI/humans (labels remain, values masked)
// - ✅ URL handling enabled (full replace)
// - Company name (CN): follow 2 dominant formats
//    1) 地名 + 品牌词 + 行业通用词 + 公司类型：仅遮“品牌词”（不向前）
//       例：上海赛行文化传媒有限公司 → 上海【公司】文化传媒有限公司（允许多遮后面一两个字，但禁止向前）
//    2) 品牌词（地名） + 行业通用词 + 公司类型：仅遮“品牌词（地名）”
//       例：赛行（上海）文化传媒有限公司 → 【公司】文化传媒有限公司（括号内覆盖不全也可）
// - Person name: mask names with strong context to avoid false positives
// - ✅ Strong context labels first (password/otp/account...)
// - ✅ EN v1: prioritize label-driven fields (ref/handle/account/bank/address) to avoid false positives

const RULES_BY_KEY = {
  /* ===================== EMAIL ===================== */
  email: {
    pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
    tag: "EMAIL"
  },

  /* ===================== URL (FULL) ===================== */
  url: {
    // covers: https://..., http://..., www....
    // stop at whitespace / brackets / common closing punctuation
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
    tag: "URL"
  },

  /* ===================== SECRET (password / otp) ===================== */
  secret: {
    // keep label, mask value until end-of-line (avoid over-capturing multi-line)
    // ✅ EN expanded: passcode / verification code / security code / one-time code / CVV/CVC
    pattern:
      /((?:密码|口令|登录密码|支付密码|PIN|Passwort|Password|passcode|验证码|校验码|动态码|verification\s*code|security\s*code|one[-\s]?time\s*code|OTP|2FA|短信验证码|CVV|CVC)\s*[:：]\s*)([^\n\r]{1,120})/giu,
    tag: "SECRET",
    mode: "prefix"
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

  /* ===================== COMPANY (CN + DE/EN) ===================== */
  company: {
    // CN formats supported:
    // (F2) 品牌（地名）... + 公司后缀 → 遮“品牌（地名）”
    // (F1) 地名 + 品牌 + ... + 公司后缀 → 遮“品牌”（不向前遮地名）
    //
    // NOTE:
    // - 捕获组/命名组需与 engine.js 的 company-mode 对齐：
    //   CN: (g1 prefix)(g2 core_to_mask)(g3 tail)(g4 suffix)
    //   DE/EN: named groups { name, legal }  (engine.js reads groups.legal/groups.name)
    pattern: new RegExp(
      String.raw`(?:` +
        // =================== CN format 2: Brand(Region) ... Suffix ===================
        // g1: "" (no prefix)
        // g2: brand + (region)  -> allow full-width and half-width parens
        // g3: tail
        // g4: legal suffix
        String.raw`(` + String.raw`` + String.raw`)` +
        String.raw`((?=[\p{Script=Han}A-Za-z])[\p{Script=Han}A-Za-z0-9·&\-]{2,12}` +
          String.raw`(?:（[\p{Script=Han}]{2,10}）|\([\p{Script=Han}]{2,10}\)))` +
        String.raw`([\p{Script=Han}A-Za-z0-9（）()·&\-\s]{0,40}?)` +
        String.raw`(集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)` +
      String.raw`)` +
      String.raw`|` +
      String.raw`(?:` +
        // =================== CN format 1: Region + Brand + ... Suffix ===================
        // g1: region prefix (keep, NEVER mask forward)
        // g2: brand core (mask)
        // g3: tail
        // g4: legal suffix
        String.raw`((?:[\p{Script=Han}]{2,6}(?:市|省|自治区|特别行政区|区|县|州|盟)?)?)` +
        String.raw`((?=[\p{Script=Han}A-Za-z])[\p{Script=Han}A-Za-z0-9·&\-]{2,12})` +
        String.raw`([\p{Script=Han}A-Za-z0-9（）()·&\-\s]{0,40}?)` +
        String.raw`(集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)` +
      String.raw`)` +
      String.raw`|` +
      // =================== DE/EN company: multi-word name + legal form ===================
      String.raw`(?:` +
        String.raw`\b(?<name>` +
          String.raw`[A-Za-z][A-Za-z0-9&.\-]{1,40}` +
          String.raw`(?:\s+[A-Za-z0-9&.\-]{1,40}){0,4}` +
        String.raw`)` +
        String.raw`\s*,?\s*` +
        String.raw`(?<legal>` +
          String.raw`(?:GmbH(?:\s*&\s*Co\.\s*KG)?|AG|UG|KG|GbR|e\.K\.|` +
          String.raw`Ltd\.?|Inc\.?|LLC|S\.?A\.?|S\.?r\.?l\.?|B\.?V\.?)` +
        String.raw`)` +
        String.raw`\b` +
      String.raw`)`,
      "giu"
    ),
    tag: "COMPANY",
    mode: "company"
  },

  /* ===================== BANK (IBAN / BIC / Routing / Sort Code) ===================== */
  bank: {
    // ✅ EN v1: cover common bank identifiers; prefer label-driven when present
    // NOTE: keep tag as "ACCOUNT" to reuse existing placeholder mapping in engine.js
    pattern: new RegExp(
      String.raw`(` +
        String.raw`(?:IBAN|BIC|SWIFT|SWIFT\s*Code|Routing\s*Number|Sort\s*Code|Bank\s*Account|Bank\s*Details|` +
        String.raw`银行|银行信息|银行账户|支付信息)\s*[:：]?\s*` +
      String.raw`)?` +
      String.raw`(` +
        // IBAN (allow spaces)
        String.raw`[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}` +
        String.raw`|` +
        // BIC/SWIFT
        String.raw`[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?` +
        String.raw`|` +
        // Routing number (US) - 9 digits (allow spaces/dashes)
        String.raw`\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b` +
        String.raw`|` +
        // Sort code (UK) - 6 digits as 12-34-56 or 123456
        String.raw`\b\d{2}[\s-]?\d{2}[\s-]?\d{2}\b` +
      String.raw`)`,
      "giu"
    ),
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== ACCOUNT (label + value) ===================== */
  account: {
    // ✅ EN expanded: card number / account number / tax id (label-driven)
    pattern:
      /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|银行卡号|卡号|对公账户|對公賬戶|Kontonummer|Account(?:\s*No\.)?|Account\s*Number|Card\s*Number|Credit\s*Card|Debit\s*Card|Tax\s*ID|TIN|EIN|IBAN)\s*[:：]?\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{10,40}\d)/giu,
    tag: "ACCOUNT",
    mode: "prefix"
  },

  /* ===================== PHONE ===================== */
  phone: {
    pattern: new RegExp(
      [
        // A) labeled phone
        String.raw`((?:tel|telefon|phone|mobile|handy|kontakt|whatsapp|wechat|telegram|signal|` +
          String.raw`联系方式|联系电话|电话|手機|手机|联系人|聯繫方式)\s*[:：]?\s*)` +
          String.raw`((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})?[\d\s().-]{6,}\d)`,

        // B) unlabeled phone (guarded later by digit-count in applyRules)
        String.raw`((?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d)` +
          String.raw`(?:\s*\((?:WhatsApp|WeChat|Telegram|Signal)\))?`,

        // C) German-style landline
        String.raw`(\b0\d{2,4}[\d\s().-]{6,}\d\b)`
      ].join("|"),
      "giu"
    ),
    tag: "PHONE",
    mode: "phone"
  },

  /* ===================== MONEY (STEADY / LOW-FP) ===================== */
  money: {
    pattern: new RegExp(
      String.raw`(?:` +
        String.raw`(?:\b(?:EUR|USD|RMB|CNY|HKD|GBP|CHF)\b|[€$¥£])\s*` +
          String.raw`(` +
            String.raw`\d{2,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?` +
            String.raw`|\d{4,18}(?:[.,]\d{2})?` +
          String.raw`)` +
        String.raw`)` +
      String.raw`|` +
      String.raw`(?:` +
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

  /* ===================== ADDRESS (DE fallback + EN label-driven) ===================== */
  address_de_street: {
    pattern: new RegExp(
      String.raw`(` +
        String.raw`(?:Address|Shipping\s*Address|Billing\s*Address|Street\s*Address|Address\s*Line\s*1|Address\s*Line\s*2|` +
        String.raw`Wohnadresse|Anschrift|Adresse|Straße|Str\.?)\s*[:：]?\s*` +
      String.raw`)?` +
      String.raw`(` +
        String.raw`[\p{L}ÄÖÜäöüß0-9.\-,'/ ]{2,80}` +
        String.raw`(?:str\.?|straße|weg|platz|allee|gasse|street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|way|court|ct\.?)` +
        String.raw`[\p{L}ÄÖÜäöüß0-9.\-,'/ ]{0,20}` +
        String.raw`\s+\d{1,6}\w?` +
      String.raw`)`,
      "giu"
    ),
    tag: "ADDRESS",
    mode: "prefix"
  },

  /* ===================== CN address (label-driven; partial masking handled in engine.js) ===================== */
  address_cn: {
    pattern:
      /((?:办公地址|通信地址|联系地址|地址)\s*[:：]\s*)([^\n\r]{1,160})/giu,
    tag: "ADDRESS",
    mode: "address_cn_partial"
  },

  /* ===================== HANDLE ===================== */
  handle: {
    pattern: /@[A-Za-z0-9_]{2,32}\b/g,
    tag: "HANDLE"
  },

  /* ===================== HANDLE label-driven ===================== */
  handle_label: {
    // ✅ FIX: no string concatenation inside regex literal (was causing SyntaxError)
    pattern:
      /((?:用户名|用\s*户\s*名|登录账号|登\s*录\s*账\s*号|账号名|账\s*号\s*名|账户名|帐户名|支付账号|支付账户|微信号|WeChat\s*ID|wxid|username|user\s*name|user\s*id|login|login\s*id|account\s*id|telegram|signal|whatsapp)\s*[:：]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
    tag: "HANDLE",
    mode: "prefix"
  },

  /* ===================== REF ===================== */
  ref: {
    pattern: /\b[A-Z]{2,6}-?\d{5,14}\b/g,
    tag: "REF"
  },

  /* ===================== REF label-driven ===================== */
  ref_label: {
    // ✅ FIX: no string concatenation inside regex literal (was causing SyntaxError)
    pattern:
      /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号|order\s*(?:id|no\.?|number)|invoice\s*(?:id|no\.?|number)|reference|ref\.?|tracking\s*(?:id|no\.?|number)|ticket\s*(?:id|no\.?|number)|case\s*(?:id|no\.?|number)|application\s*(?:id|no\.?|number))\s*[:：]\s*)([A-Za-z0-9][A-Za-z0-9\-_.]{3,80})/giu,
    tag: "REF",
    mode: "prefix"
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
