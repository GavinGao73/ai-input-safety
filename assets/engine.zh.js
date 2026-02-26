// =========================
// assets/engine.zh.js
// Content-strategy pack: zh (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting / address partial formatting
// =========================

(function () {
  "use strict";

  const PACKS = (window.__ENGINE_LANG_PACKS__ = window.__ENGINE_LANG_PACKS__ || {});

  PACKS.zh = {
    lang: "zh",

    placeholders: {
      PHONE: "【电话】",
      EMAIL: "【邮箱】",
      URL: "【网址】",
      SECRET: "【敏感】",
      ACCOUNT: "【账号】",
      ADDRESS: "【地址】",
      HANDLE: "【账号名】",
      REF: "【编号】",
      TITLE: "【称谓】",
      NUMBER: "【数字】",
      MONEY: "【金额】",
      COMPANY: "【公司】",
      TERM: "【遮盖】",
      NAME: "【姓名】"
    },

    // One-shot detect hints (content strategy only)
    detect: function (s) {
      s = String(s || "");
      if (!s.trim()) return "";

      const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
      const total = Math.max(1, s.length);
      if (han / total > 0.05) return "zh";

      if (
        /(申请编号|参考编号|办公地址|通信地址|联系人|手机号|银行卡号|开户地址|密码|验证码|登录账号|微信号|开户银行|对公账户|收款账号|身份证|护照|出生日期|出生地|设备ID|会话ID|IP地址|交易哈希|钱包地址|车牌|号牌)/.test(
          s
        )
      ) {
        return "zh";
      }
      return "";
    },

    // ✅ language-specific execution order (tuned independently)
    priority: [
      // secrets/auth first
      "secret",
      "security_answer",

      // identity (CN-realistic)
      "dob",
      "place_of_birth",
      "id_card",
      "passport",
      "driver_license",
      "license_plate",

      // device / tracking
      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      // financial
      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      // comms
      "email",
      "url",

      // refs / handles (label-driven)
      "handle_label",

      // ✅ Customer ID: keep "CUST-" prefix, mask digits only
      "cust_id",

      // ✅ ID policy: keep prefix/body, mask ONLY the last numeric segment (tail digits)
      // (replaces previous FULL ref mask behavior)
      "ref_label_tail",

      // legacy full rule definition kept but NOT executed
      // "ref_label_full",

      // money
      "money_label",
      "money",

      // phone AFTER ids
      "phone",

      // person/org
      // ✅ company before person_name (开户名等公司字段不应被人名抢走)
      "company",
      "person_name",

      // address (CN partial)
      "address_cn",

      // crypto / chain
      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      // generic
      "handle",
      "ref",
      "title",
      "number"
    ],

    // ✅ language-specific always-on
    alwaysOn: [
      "handle_label",

      // refs / ids
      "cust_id",
      "ref_label_tail",

      "address_cn",

      "secret",
      "security_answer",

      "dob",
      "place_of_birth",
      "id_card",
      "passport",
      "driver_license",
      "license_plate",

      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      "account",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      "money_label",
      "money",

      // ✅ org before person
      "company",
      "person_name",

      "wallet_id",
      "tx_hash",
      "crypto_wallet"
    ],

    // ✅ phone FP guard (zh): prevent long numeric IDs/refs being treated as phone
    phoneGuard: function ({ label, value, match }) {
      const digits = String(value || "").replace(/\D+/g, "");
      if (digits.length >= 16) return false;

      const lbl = String(label || "").toLowerCase();
      // labels that are usually IDs, not phones
      if (/(编号|单号|订单|发票|合同|申请|工单|票据|客户|账号|账户|卡号|对公|税号)/i.test(lbl)) return false;

      // value itself looks like typical ID prefix
      if (/\b(?:CUST|CASE|ORD|INV|APP|REF|ACC|REQ|TKT|TK|LC|CLM|LEGAL)-/i.test(String(value || ""))) return false;

      return true;
    },

    // ✅ address_cn_partial formatting (zh-only)
    formatAddressCnPartial: function ({ label, val, placeholder }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;
      if (reRoadNo.test(val)) {
        const v2 = String(val || "").replace(reRoadNo, (m2, a, b) => `${a}${placeholder("ADDRESS")}`);
        return `${label}${v2}`;
      }
      return `${label}${placeholder("ADDRESS")}`;
    },

    // ✅ highlight helper for pdf overlay (zh-only)
    highlightAddressCnPartial: function ({ label, val, S1, S2 }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;
      const v = String(val || "");
      if (reRoadNo.test(v)) {
        const markedVal = v.replace(reRoadNo, (mm, a, b) => `${a}${S1}${b}${S2}`);
        return `${label}${markedVal}`;
      }
      return `${label}${S1}${v}${S2}`;
    },

    // ✅ company formatting strategy (zh-only): keep partial industry tail + legal suffix
    // Signature aligned with core call-site: ({ raw, name, legal, punct, coreStr, placeholder })
    formatCompany: function ({ raw, name, legal, punct, coreStr, placeholder }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");

      // if no legal, just mask whole company token
      if (!rawLegal) return `${placeholder("COMPANY")}${rawPunct}`;

      const INDUSTRY = [
        "网络科技",
        "科技",
        "数据服务",
        "品牌管理",
        "创新股份",
        "创新",
        "信息技术",
        "技术",
        "咨询",
        "服务",
        "贸易",
        "传媒",
        "物流",
        "电子",
        "软件",
        "金融",
        "投资",
        "实业",
        "工程",
        "建筑",
        "教育",
        "医疗",
        "广告",
        "文化",
        "餐饮",
        "供应链",
        "电商",
        "互联网"
      ];

      let keep = "";
      for (const kw of INDUSTRY) {
        const i = rawName.lastIndexOf(kw);
        if (i >= 0 && i >= Math.max(0, rawName.length - 10)) {
          keep = rawName.slice(i);
          break;
        }
      }

      if (!keep && rawName.length > 4) keep = rawName.slice(-4);

      return `${placeholder("COMPANY")}${keep}${rawLegal}${rawPunct}`;
    },

    // ✅ company highlight for pdf overlay (zh-only)
    // Signature aligned with core call-site: ({ match, name, legal, punct, S1, S2 })
    highlightCompany: function ({ match, name, legal, punct, S1, S2 }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${S1}${rawName}${S2}${rawLegal}${rawPunct}`;
      // fallback: highlight whole token if no legal captured
      const m = String(match || rawName || "");
      return `${S1}${m}${S2}${rawPunct}`;
    },

    rules: {
      /* ===================== EMAIL ===================== */
      email: {
        pattern: /\b[A-Z0-9._%+-]+\s*@\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      /* ===================== URL ===================== */
      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      /* ===================== SECRET (label-driven) ===================== */
      secret: {
        pattern: /((?:密码|口令|登录密码|支付密码|PIN|验证码|校验码|动态码|短信验证码|OTP|2FA|口令码|安全码|授权码)\s*[:：=]\s*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== SECURITY ANSWER (label-driven) ===================== */
      security_answer: {
        pattern: /((?:安全答案|密保答案|回答|答案|security\s*answer|answer)\s*[:：=]\s*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== DOB / Birthdate (label-driven) ===================== */
      dob: {
        pattern: /((?:出生日期(?:（中文）)?|出生年月|生日|DOB|Date\s*of\s*Birth)\s*[:：=]\s*)(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Place of birth (label-driven) ===================== */
      place_of_birth: {
        pattern: /((?:出生地|籍贯|出生地点|Birth\s*Place|Place\s*of\s*Birth)\s*[:：=]\s*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== CN ID Card (label-driven) ===================== */
      id_card: {
        pattern: /((?:身份证号|居民身份证|身份证号码|公民身份号码)\s*[:：=]\s*)(\d{17}[\dXx])\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Passport (label-driven) ===================== */
      passport: {
        pattern: /((?:护照号|护照号码|Passport(?:\s*No\.?|Number)?)\s*[:：=]\s*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== Driver License (label-driven) ===================== */
      driver_license: {
        // CN policy: 驾驶证号按“身份证号”处理（18位，末位可X）。
        // 同时为了防止字段里出现脏数据（例如带"-"的拼接编号），只要该字段值含数字也整体遮盖。
        pattern: /((?:驾驶证号|驾驶证号码|Driver[’']?s\s*License(?:\s*No\.?|Number)?)\s*[:：=]\s*)(\d{17}[\dXx]|(?=[^\n\r]*\d)[^\n\r]{4,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== LICENSE PLATE (label-driven; CN) ===================== */
      license_plate: {
        // CN plate: “京A123456” (汉字 + 字母 + 5~6位字母数字), no "-" / no spaces.
        pattern: /((?:车牌号|车牌号码|号牌号码|车牌|号牌)\s*[:：=]\s*)([\u4E00-\u9FFF][A-Z][A-Z0-9]{5,6})\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== CUSTOMER ID (CUST-...) ===================== */
      cust_id: {
        // Customer ID: CUST-004918273645 -> Customer ID: CUST-【编号】
        pattern: /((?:Customer\s*ID|客户号|客户ID)\s*[:：=]\s*CUST-)(?![^\n\r]*【编号】)(\d{6,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== REF TAIL MASK (label-driven; keep prefix/body, mask last digits only) ===================== */
      ref_label_tail: {
        // ✅ Tail-only replacement: keep prefix/body, mask ONLY the last numeric tail (>=4 digits)
        // Covers:
        // Case ID / Ticket No. / Application ID / Order ID / Invoice No. / Reference
        // 合同号 / 索赔参考号 / 法律案件号 / 申请编号 / 参考编号 / 工单号 / 票据号 / 客户号 / 编号 ...
        // Example: CASE-2026-00078421 -> CASE-2026-【编号】
        pattern:
          /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号|工单号|票据号|客户号|索赔参考号|法律案件号|Case\s*ID|Ticket\s*No\.?|Application\s*ID|Order\s*ID|Invoice\s*No\.?|Reference)\s*[:：=]\s*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,10}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== REF FULL MASK (label-driven; single placeholder) ===================== */
      ref_label_full: {
        // ✅ FULL replacement, single 【编号】 only, no tail logic.
        // Covers:
        // Case ID / Ticket No. / Application ID / Order ID / Invoice No. / Reference
        // 合同号 / 索赔参考号 / 法律案件号 / 申请编号 / 参考编号 / 工单号 / 票据号 / 客户号 / 编号 ...
        pattern:
          /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号|工单号|票据号|客户号|索赔参考号|法律案件号|Case\s*ID|Ticket\s*No\.?|Application\s*ID|Order\s*ID|Invoice\s*No\.?|Reference)\s*[:：=]\s*)(?![^\n\r]*【编号】)([A-Za-z0-9][A-Za-z0-9._\-]{3,120})/giu,
        tag: "REF",
        mode: "prefix"
      },

      /* ===================== ACCOUNT (label-driven) ===================== */
      account: {
        pattern: /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|银行卡号|卡号|信用卡|信用卡号|信用卡號|card\s*number|credit\s*card|对公账户|對公賬戶|IBAN|Account\s*Number)\s*[:：=]?\s*)([A-Z]{2}\d{2}[\d\s-]{10,40}|\d[\d\s-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK / SWIFT / BIC ===================== */
      bank: {
        pattern: /((?:开户银行|開戶銀行|银行|銀行|BIC|SWIFT|Swift\s*Code)\s*[:：=]?\s*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== BANK ROUTING / CLEARING / BRANCH (label-driven) ===================== */
      bank_routing_ids: {
        pattern: /((?:联行号|清算号|分行号|支行号|行号|路由号|routing\s*number|aba|bsb|transit\s*number|clearing\s*(?:number|no\.?)|branch\s*code)\s*[:：=]\s*)([0-9][0-9\s-]{2,24}[0-9])/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      /* ===================== CARD EXPIRY (label-driven) ===================== */
      card_expiry: {
        pattern: /((?:有效期|到期|exp(?:iry|iration)?(?:\s*date)?|valid\s*thru|valid\s*through)\s*[:：=]\s*)(\d{2}\s*\/\s*\d{2,4}|\d{2}\s*-\s*\d{2,4}|\d{4}\s*-\s*\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== CARD SECURITY (label-driven) ===================== */
      card_security: {
        pattern: /((?:CVV|CVC|安全码|校验码)\s*[:：=]\s*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== PHONE (label-driven + explicit intl prefix) ===================== */
      phone: {
        // ✅ minimal FP cut: remove "联系人/kontakt" from label list (it caused accidental non-phone spans)
        pattern: /((?:联系方式|联系电话|电话|手機|手机|tel|telefon|phone|mobile|handy)\s*[:：=]?\s*)([+＋]?\s*\d[\d\s().-]{5,}\d)\b|(\b(?:[+＋]\s*\d{1,3}|00\s*\d{1,3})[\d\s().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      /* ===================== PERSON NAME (label-driven; CN-realistic) ===================== */
      person_name: {
        // FIX: "开户名" 只有在该行不像公司名时才按人名处理
        // - 如果该行包含公司法定后缀（有限公司/公司/集团/有限责任公司/股份有限公司等），则跳过 person_name，让 company 接管
        pattern:
          /((?:姓名|收件人|联系人|Name|Recipient|开户名)\s*[:：=]\s*)(?![^\n\r]*(?:集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司))((?:(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s*)?[\u4E00-\u9FFF]{2,6}|(?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})/gmu,
        tag: "NAME",
        mode: "prefix"
      },

      /* ===================== HANDLE (label-driven) ===================== */
      handle_label: {
        pattern: /((?:用户名|用\s*户\s*名|登录账号|登\s*录\s*账\s*号|账号名|账\s*号\s*名|账户名|帐户名|支付账号|支付账户|微信号|WeChat\s*ID|wxid|User\s*ID)\s*[:：=]\s*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      /* ===================== ADDRESS (CN partial) ===================== */
      address_cn: {
        // ✅ require delimiter (avoid matching headings like "地址信息（用于...）")
        pattern: /((?:地址|住址|办公地址|通信地址|收货地址|居住地址|单位地址|联系地址)\s*[:：=]\s*)([^\n\r]{2,120})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      /* ===================== MONEY LABEL (ZH/EN strong labels; no currency sign required) ===================== */
      money_label: {
        // ✅ label-driven money to catch "Amount: 2950.15" / "Total=-106.82" etc.
        // - requires strong money labels
        // - requires decimal part (prevents "any integer" being treated as money)
        pattern:
          /((?:金额|合计|总计|小计|应付|实付|已付|支付金额|付款金额|收款金额|退款金额|余额|费用|手续费|服务费|税额|税费|增值税|VAT|Amount|Total|Subtotal|Balance|Paid|Payment|Refund|Due|Net|Gross)\s*[:：=]\s*)([-+−]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2}))/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      /* ===================== MONEY (ZH require currency indicator) ===================== */
      money: {
        // ✅ FIX: all non-capturing to prevent split/double replacement
        // ✅ Add optional sign (do NOT expand to "any decimal is money")
        pattern:
          /(?:\b(?:人民币|CNY|RMB)\b\s*[-+−]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?\s*(?:元)?|[¥￥]\s*[-+−]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\b[-+−]?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?\s*元|\bUSD\b\s*\$?\s*[-+−]?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s*[-+−]?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|€\s*[-+−]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\b[-+−]?\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*€)/giu,
        tag: "MONEY"
      },

      /* ===================== COMPANY (ZH) ===================== */
      company: {
        pattern: /(?<name>[\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,60}?)(?<legal>集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)(?=$|[^\u4E00-\u9FFF])/gu,
        tag: "COMPANY",
        mode: "company"
      },

      /* ===================== IP (label-driven) ===================== */
      ip_label: {
        pattern:
          /((?:IP(?:\s*Address)?|IPv4|IPv6|IP地址)\s*[:：=]\s*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== IP (bare) ===================== */
      ip_address: {
        pattern:
          /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
        tag: "SECRET"
      },

      /* ===================== MAC (label-driven) ===================== */
      mac_label: {
        pattern: /((?:MAC(?:\s*Address)?|MAC地址)\s*[:：=]\s*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== MAC (bare) ===================== */
      mac_address: {
        pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
        tag: "SECRET"
      },

      /* ===================== IMEI (label-driven) ===================== */
      imei: {
        pattern: /((?:IMEI)\s*[:：=]\s*)(\d{14,16})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== DEVICE / SESSION / FINGERPRINT / USER-AGENT (label-driven) ===================== */
      device_fingerprint: {
        pattern:
          /((?:设备ID|Device\s*ID|会话ID|Session\s*ID|指纹|Fingerprint|User-?Agent|UA)\s*[:：=]\s*)([^\n\r]{1,220})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== UUID / GUID (bare) ===================== */
      uuid: {
        pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
        tag: "SECRET"
      },

      /* ===================== WALLET ID (label-driven) ===================== */
      wallet_id: {
        pattern: /((?:Wallet\s*ID|钱包ID|钱包编号)\s*[:：=]\s*)([A-Za-z0-9._\-]{3,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== TX HASH (label-driven) ===================== */
      tx_hash: {
        pattern: /((?:Transaction\s*Hash|TX\s*Hash|交易哈希|交易Hash)\s*[:：=]\s*)(0x[0-9a-f]{16,128})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== CRYPTO WALLET (label-driven) ===================== */
      crypto_wallet: {
        pattern: /((?:BTC|比特币|ETH|以太坊)\s*[:：=]\s*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      /* ===================== TITLE ===================== */
      title: {
        pattern: /\b(先生|女士|小姐|太太|老师|同学|经理|主任|总监|博士|教授)\b/gu,
        tag: "TITLE"
      },

      /* ===================== HANDLE (generic) ===================== */
      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      /* ===================== REF (format-like) ===================== */
      ref: {
        // keep conservative to avoid partial hits inside multi-segment IDs (handled by ref_label_tail)
        pattern: /\b[A-Z]{2,6}-?\d{5,14}\b(?![-_.][A-Za-z0-9])/g,
        tag: "REF"
      },

      /* ===================== NUMBER fallback ===================== */
      number: {
        pattern: /\b\d[\d\s-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
