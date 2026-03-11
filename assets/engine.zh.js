// =========================
// assets/engine.zh.js
// Content-strategy pack: zh (NOT UI language)
// - placeholders + detect + rules (FULL, no common)
// - pack policy hooks: priority / alwaysOn / phoneGuard / company formatting / address partial formatting
//
// LOCKED (whitelist-aligned for zh):
// - ID policy: keep prefix/body, mask ONLY the last numeric segment via ref_label_tail / cust_id.
// - Disable legacy generic ref masking ("ref") to avoid breaking tail-only policy.
// - Disable title masking ("title") to keep 先生/女士/教授 等称谓原样保留（不输出【称谓】）。
//
// NOTE (allowed cleanup):
// - ref_label_full is legacy and NOT executed; removed to reduce confusion/attack surface.
//
// FINAL-CANDIDATE PATCH:
// - FIX 1: person_name 移除“开户名 / 账户名”，避免与公司/对公账户名冲突
// - FIX 2: company 补充高价值中文组织后缀：分公司 / 事务所 / 中心
// - Keep all other behaviors unchanged
//
// PATCH-2 (minimal confirmed fixes only):
// - FIX 3: 新增 api_key_token_zh，覆盖“接口密钥 / API Key / Access Token / Token”
// - FIX 4: handle_label 增补“用户ID / 用户 / 账号”，但不重新引入“账户名 / 開戶名”
// - FIX 5: money_label 扩充中文财务标签；新增 money_cn_inline_label
// - FIX 6: company 通用规则移除裸“中心”，避免误伤地址；保留 company_block 中的“中心”
// - FIX 7: 补强 address_cn / address_cn_block 标签覆盖
// - NO unrelated deletions
// - NO structural shrink
//
// PATCH-3 (minimal confirmed fixes only):
// - FIX 8: 新增 company_label_inline_zh，覆盖“单位名称 / 项目服务机构 / 账户名”等单行公司标签
// - FIX 9: 新增 address_cn_block_multiline，覆盖“标签 + 姓名 + 地址”三段式多行地址块
// - FIX 10: 新增 money_label_currency_zh，覆盖“人民币：12600.00”等货币标签格式
// - FIX 11: 新增 account_cn_inline，覆盖长段落中的“收款账号6217... / 联行号1021...”
// - FIX 12: 新增 secret_inline_zh，覆盖长段落中的“接口密钥sk_... / 会话IDsess_... / 钱包地址0x...”
//
// PATCH-4 (minimal confirmed fixes only):
// - FIX 13: 新增 company_label_inline_zh_no_colon，覆盖长段落中的“账户名北京星舟科技中心 / 開戶名广州...分公司”
// - FIX 14: 强化 address_cn_block_multiline，兼容“【姓名】”占位后的三段式地址块
// - FIX 15: 强化 account_cn_inline，兼容标签后直接接数字、空格或换行
// - FIX 16: 强化 secret_inline_zh，兼容“接口密钥 sk_... / 会话ID sess_... / 设备ID device_... / 钱包地址 0x...”及轻微断裂
//
// PATCH-5 (minimal confirmed fixes only):
// - FIX 17: 新增 ref_inline_zh，覆盖长段落中的“合同编号HT-... / 订单号ORD-... / 参考编号REF-...”
// - FIX 18: 进一步补强 address_cn_block_multiline，兼容“标签 + 【姓名】 + 下一行地址正文”
// - FIX 19: 进一步补强 account_cn_inline / secret_inline_zh 的跨行值形式
// - NO unrelated deletions
// - NO structural shrink
//
// PATCH-6 (minimal confirmed fixes only):
// - FIX 20: ref_inline_zh 改为“仅遮尾段数字”，不再吞掉前缀主体
// - FIX 21: 新增长段落裸值规则：id_card_inline_zh / passport_inline_zh / driver_license_inline_zh / license_plate_inline_zh
// - NO unrelated deletions
// - NO structural shrink
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
      TITLE: "【称谓】", // kept for compatibility; execution disabled (see priority list)
      NUMBER: "【数字】",
      MONEY: "【金额】",
      COMPANY: "【公司】",
      TERM: "【遮盖】",
      NAME: "【姓名】"
    },

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

    priority: [
      "secret",
      "security_answer",
      "api_key_token_zh",
      "secret_inline_zh",

      "dob",
      "place_of_birth",
      "id_card",
      "id_card_inline_zh",
      "passport",
      "passport_inline_zh",
      "driver_license",
      "driver_license_inline_zh",
      "license_plate",
      "license_plate_inline_zh",
      "tax_id_zh",

      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      "account",
      "account_cn_inline",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      "email",
      "url",

      "handle_label",

      "cust_id",

      "ref_label_tail",
      "ref_inline_zh",

      "money_label",
      "money_label_currency_zh",
      "money_cn_inline_label",
      "money",

      "phone",

      "company_label_inline_zh",
      "company_label_inline_zh_no_colon",
      "company",
      "company_block",
      "person_name",
      "person_name_address_block",

      "address_cn_block_multiline",
      "address_cn",
      "address_cn_block",

      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      "handle",
      "number"
    ],

    alwaysOn: [
      "handle_label",

      "cust_id",
      "ref_label_tail",
      "ref_inline_zh",

      "address_cn_block_multiline",
      "address_cn",
      "address_cn_block",

      "secret",
      "security_answer",
      "api_key_token_zh",
      "secret_inline_zh",

      "dob",
      "place_of_birth",
      "id_card",
      "id_card_inline_zh",
      "passport",
      "passport_inline_zh",
      "driver_license",
      "driver_license_inline_zh",
      "license_plate",
      "license_plate_inline_zh",
      "tax_id_zh",

      "ip_label",
      "ip_address",
      "mac_label",
      "mac_address",
      "imei",
      "device_fingerprint",
      "uuid",

      "account",
      "account_cn_inline",
      "bank",
      "bank_routing_ids",
      "card_expiry",
      "card_security",

      "money_label",
      "money_label_currency_zh",
      "money_cn_inline_label",
      "money",

      "company_label_inline_zh",
      "company_label_inline_zh_no_colon",
      "company",
      "company_block",
      "person_name",
      "person_name_address_block",

      "wallet_id",
      "tx_hash",
      "crypto_wallet"
    ],

    phoneGuard: function ({ label, value, match }) {
      const digits = String(value || "").replace(/\D+/g, "");
      if (digits.length >= 16) return false;

      const lbl = String(label || "").toLowerCase();
      if (/(编号|单号|订单|发票|合同|申请|工单|票据|客户|账号|账户|卡号|对公|税号)/i.test(lbl)) return false;

      if (/\b(?:CUST|CASE|ORD|INV|APP|REF|ACC|REQ|TKT|TK|LC|CLM|LEGAL)-/i.test(String(value || ""))) return false;

      return true;
    },

    formatAddressCnPartial: function ({ label, val, placeholder }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,40}(?:路|街|道|大道|巷|弄|里|坊|胡同|区|镇|村|桥|湾|园|城|厦|楼))[ \t]*(\d{1,6}(?:-\d{1,4})?[ \t]*号)/g;
      if (reRoadNo.test(val)) {
        const v2 = String(val || "").replace(reRoadNo, (m2, a, b) => `${a}${placeholder("ADDRESS")}`);
        return `${label}${v2}`;
      }
      return `${label}${placeholder("ADDRESS")}`;
    },

    highlightAddressCnPartial: function ({ label, val, S1, S2 }) {
      const reRoadNo = /([\u4E00-\u9FFF]{1,40}(?:路|街|道|大道|巷|弄|里|坊|胡同|区|镇|村|桥|湾|园|城|厦|楼))[ \t]*(\d{1,6}(?:-\d{1,4})?[ \t]*号)/g;
      const v = String(val || "");
      if (reRoadNo.test(v)) {
        const markedVal = v.replace(reRoadNo, (mm, a, b) => `${a}${S1}${b}${S2}`);
        return `${label}${markedVal}`;
      }
      return `${label}${S1}${v}${S2}`;
    },

    formatCompany: function ({ raw, name, legal, punct, coreStr, placeholder }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");

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
        "互联网",
        "事务所"
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

    highlightCompany: function ({ match, name, legal, punct, S1, S2 }) {
      const rawName = String(name || "");
      const rawLegal = String(legal || "");
      const rawPunct = String(punct || "");
      if (rawLegal) return `${S1}${rawName}${S2}${rawLegal}${rawPunct}`;
      const m = String(match || rawName || "");
      return `${S1}${m}${S2}${rawPunct}`;
    },

    rules: {
      email: {
        pattern: /\b[A-Z0-9._%+-]+[ \t]*@[ \t]*[A-Z0-9.-]+[ \t]*\.[ \t]*[A-Z]{2,}\b/gi,
        tag: "EMAIL"
      },

      url: {
        pattern: /\b(?:https?:\/\/|www\.)[^\s<>"'）)\]】]+/giu,
        tag: "URL"
      },

      secret: {
        pattern: /((?:密码|口令|登录密码|支付密码|PIN|验证码|校验码|动态码|短信验证码|OTP|2FA|口令码|安全码|授权码)[ \t]*[:：=][ \t]*)([^\n\r]{1,120})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      security_answer: {
        pattern: /((?:安全答案|密保答案|回答|答案|security[ \t]*answer|answer)[ \t]*[:：=][ \t]*)([^\n\r]{1,160})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      api_key_token_zh: {
        pattern: /((?:接口密钥|API[ \t]*Key|Api[ \t]*Key|访问令牌|Access[ \t]*Token|刷新令牌|Refresh[ \t]*Token|令牌|Token)[ \t]*[:：=]?[ \t]*)([A-Za-z0-9._\-]{8,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      secret_inline_zh: {
        pattern: /((?:接口密钥|API[ \t]*Key|Access[ \t]*Token|接[ \t]*口密钥|会[ \t]*话ID|会话ID|Session[ \t]*ID|设[ \t]*备ID|设备ID|Device[ \t]*ID|钱[ \t]*包地址|钱包地址|交[ \t]*易哈希|交易哈希|交易Hash)[ \t:：=]*)(?:\r?\n[ \t]*)?(0x[0-9a-f]{16,128}|sk_[A-Za-z0-9._\-]{8,300}|sess_[A-Za-z0-9._\-]{4,300}|device_[A-Za-z0-9._\-]{4,300}|[A-Za-z0-9._\-]{6,300})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      dob: {
        pattern: /((?:出生日期(?:（中文）)?|出生年月|生日|DOB|Date[ \t]*of[ \t]*Birth)[ \t]*[:：=][ \t]*)(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}|\d{4}年\d{1,2}月\d{1,2}日)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      place_of_birth: {
        pattern: /((?:出生地|籍贯|出生地点|Birth[ \t]*Place|Place[ \t]*of[ \t]*Birth)[ \t]*[:：=][ \t]*)([^\n\r]{2,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      id_card: {
        pattern: /((?:身份证号|居民身份证|身份证号码|公民身份号码)[ \t]*[:：=][ \t]*)(\d{17}[\dXx])\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      id_card_inline_zh: {
        pattern: /((?:身份证号|居民身份证|身份证号码|公民身份号码)[ \t]*)(\d{17}[\dXx])\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport: {
        pattern: /((?:护照号|护照号码|Passport(?:[ \t]*No\.?|[ \t]*Number)?)[ \t]*[:：=][ \t]*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      passport_inline_zh: {
        pattern: /((?:护照号|护照号码|Passport(?:[ \t]*No\.?|[ \t]*Number)?)[ \t]*)([A-Z0-9][A-Z0-9\-]{4,22})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license: {
        pattern: /((?:驾驶证号|驾驶证号码|Driver[’']?s[ \t]*License(?:[ \t]*No\.?|[ \t]*Number)?)[ \t]*[:：=][ \t]*)(\d{17}[\dXx]|(?=[^\n\r]*\d)[^\n\r]{4,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      driver_license_inline_zh: {
        pattern: /((?:驾驶证号|驾驶证号码|Driver[’']?s[ \t]*License(?:[ \t]*No\.?|[ \t]*Number)?)[ \t]*)(\d{17}[\dXx]|(?=[^\n\r]*\d)[A-Za-z0-9\-]{4,40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      license_plate: {
        pattern: /((?:车牌号|车牌号码|号牌号码|车牌|号牌)[ \t]*[:：=][ \t]*)([\u4E00-\u9FFF][A-Z][A-Z0-9]{5,6})\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      license_plate_inline_zh: {
        pattern: /((?:车牌号|车牌号码|号牌号码|车牌|号牌)[ \t]*)([\u4E00-\u9FFF][A-Z][A-Z0-9]{5,6})\b/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tax_id_zh: {
        pattern: /((?:税号|纳税人识别号|统一社会信用代码)[ \t]*[:：=][ \t]*)([A-Z0-9][A-Z0-9\-]{7,31})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      cust_id: {
        pattern: /((?:Customer[ \t]*ID|客户号|客户ID)[ \t]*[:：=][ \t]*CUST-)(?![^\n\r]*【编号】)(\d{6,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_label_tail: {
        pattern: /((?:申请编号|参考编号|订单号|单号|合同号|发票号|编号|工单号|票据号|客户号|索赔参考号|法律案件号|Case[ \t]*ID|Ticket[ \t]*No\.?|Application[ \t]*ID|Order[ \t]*ID|Invoice[ \t]*No\.?|Reference)[ \t]*[:：=][ \t]*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,10}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      ref_inline_zh: {
        pattern: /((?:合同编号|补充协议编号|参考编号|订单号|发票号|申请编号|工单号|票据号|法律案件号|索赔参考号|客户号|合同号)[ \t]*(?!ERR-)(?!SKU:)(?:[A-Za-z0-9\[\]]+(?:[-_.][A-Za-z0-9\[\]]+){0,10}[-_.]))(\d{4,})/giu,
        tag: "REF",
        mode: "prefix"
      },

      account: {
        pattern: /((?:银行账号|銀行賬號|账号|賬號|收款账号|收款帳號|账户|帳戶|开户账号|開戶賬號|银行卡号|卡号|信用卡|信用卡号|信用卡號|card[ \t]*number|credit[ \t]*card|对公账户|對公賬戶|IBAN|Account[ \t]*Number)[ \t]*[:：=]?[ \t]*)([A-Z]{2}\d{2}[\d \t-]{10,40}|\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      account_cn_inline: {
        pattern: /((?:对公账户|收款账号|银行账号|银行卡号|联行号|清算号|分行号|支行号|路由号)[ \t:：=]*)(?:\r?\n[ \t]*)?(\d[\d \t-]{6,40}\d)/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank: {
        pattern: /((?:开户银行|開戶銀行|银行|銀行|BIC|SWIFT|Swift[ \t]*Code)[ \t]*[:：=]?[ \t]*)([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?|\d{6,12})/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      bank_routing_ids: {
        pattern: /((?:联行号|清算号|分行号|支行号|行号|路由号|routing[ \t]*number|aba|bsb|transit[ \t]*number|clearing[ \t]*(?:number|no\.?)|branch[ \t]*code)[ \t]*[:：=][ \t]*)([0-9][0-9 \t-]{2,24}[0-9])/giu,
        tag: "ACCOUNT",
        mode: "prefix"
      },

      card_expiry: {
        pattern: /((?:有效期|到期|exp(?:iry|iration)?(?:[ \t]*date)?|valid[ \t]*thru|valid[ \t]*through)[ \t]*[:：=][ \t]*)(\d{2}[ \t]*\/[ \t]*\d{2,4}|\d{2}[ \t]*-[ \t]*\d{2,4}|\d{4}[ \t]*-[ \t]*\d{2})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      card_security: {
        pattern: /((?:CVV|CVC|安全码|校验码)[ \t]*[:：=][ \t]*)(\d{3,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      phone: {
        pattern: /((?:联系方式|联系电话|电话|手機|手机|tel|telefon|phone|mobile|handy)[ \t]*[:：=]?[ \t]*)([+＋]?[ \t]*\d[\d \t().-]{5,}\d)\b|(\b(?:[+＋][ \t]*\d{1,3}|00[ \t]*\d{1,3})[\d \t().-]{6,}\d\b)/giu,
        tag: "PHONE",
        mode: "phone"
      },

      person_name: {
        pattern: /((?:姓名|收件人|联系人|Name|Recipient)[ \t]*[:：=][ \t]*)(?![^\n\r]*(?:集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司|分公司|事务所))((?:(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)[ \t]*)?[\u4E00-\u9FFF]{2,6}|(?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40})(?:[ \t]+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,40}){0,3})/gmu,
        tag: "NAME",
        mode: "prefix"
      },

      person_name_address_block: {
        pattern: /((?:账单地址|帳單地址|收货地址|收貨地址|办公地址|辦公地址|通信地址|聯絡地址|联系地址|聯繫地址|地址)[ \t]*[:：=]?[ \t]*(?:\r?\n[ \t]*){1,4})(?![^\n\r]*(?:集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司|分公司|事务所))((?:【姓名】|[\u4E00-\u9FFF]{2,6}))(?=[ \t]*(?:\r?\n))/gmu,
        tag: "NAME",
        mode: "prefix"
      },

      handle_label: {
        pattern: /((?:用户名|用[ \t]*户[ \t]*名|用户ID|用户[ \t]*ID|用户|登录账号|登[ \t]*录[ \t]*账[ \t]*号|账号名|账[ \t]*号[ \t]*名|账号|支付账号|支付账户|微信号|WeChat[ \t]*ID|wxid|User[ \t]*ID)[ \t]*[:：=][ \t]*)([A-Za-z0-9_@.\-]{3,80})/giu,
        tag: "HANDLE",
        mode: "prefix"
      },

      address_cn: {
        pattern: /((?:地址|住址|办公地址|通信地址|收货地址|收件地址|联系地址|联系住址|居住地址|单位地址|公司地址|注册地址|签署地址|履约地址)[ \t]*[:：=][ \t]*)([^\n\r]{2,160})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      address_cn_block: {
        pattern: /((?:账单地址|帳單地址|收货地址|收貨地址|收件地址|办公地址|辦公地址|通信地址|聯系地址|联系地址|公司地址|注册地址|签署地址|履约地址|地址)[ \t]*[:：=]?[ \t]*(?:\r?\n[ \t]*){1,4}(?:(?:【姓名】|[\u4E00-\u9FFF]{2,6})[ \t]*(?:\r?\n[ \t]*){1,4})?)(?=[^\n\r]{2,200})((?:.*?(?:路|街|道|大道|巷|弄|里|坊|胡同))\d{1,6}(?:-\d{1,4})?[ \t]*号[^\n\r]{0,80})/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      address_cn_block_multiline: {
        pattern: /((?:账单地址|帳單地址|收货地址|收貨地址|收件地址|办公地址|辦公地址|通信地址|聯系地址|联系地址|公司地址|注册地址|签署地址|履约地址|地址)[ \t]*[:：=]?[ \t]*(?:\r?\n[ \t]*){1,3}(?:(?:【姓名】|[\u4E00-\u9FFF]{2,6})[ \t]*(?:\r?\n[ \t]*){1,3})?)([^\n\r]{2,200}(?:(?:路|街|道|大道|巷|弄|里|坊|胡同)[^\n\r]{0,40}\d{1,6}(?:-\d{1,4})?[ \t]*号[^\n\r]{0,80}))/giu,
        tag: "ADDRESS",
        mode: "address_cn_partial"
      },

      money_label: {
        pattern: /((?:金额|合计|总计|小计|应付|实付|已付|支付金额|付款金额|收款金额|退款金额|余额|费用|手续费|服务费|税额|税费|增值税|合同总金额|首付款|尾款|金额合计|基础服务包|高级功能模块|实施费用|售后支持|付款|VAT|Amount|Total|Subtotal|Balance|Paid|Payment|Refund|Due|Net|Gross)[ \t]*[:：=][ \t]*)((?:[-+−]?(?:\d{1,3}(?:[, \t]\d{3})+|\d+)(?:\.\d{1,2})?))/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      money_label_currency_zh: {
        pattern: /((?:人民币|CNY|RMB|USD|EUR)[ \t]*[:：=][ \t]*)([-+−]?(?:\d{1,3}(?:[,\.\t ]\d{3})+|\d+)(?:[.,]\d{1,2})?)/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      money_cn_inline_label: {
        pattern: /((?:基础服务包|高级功能模块|实施费用|售后支持|首付款|尾款|合同总金额|服务费|手续费|增值税)[ \t]*)([-+−]?(?:\d{1,3}(?:[, \t]\d{3})+|\d+)(?:\.\d{1,2})?)/giu,
        tag: "MONEY",
        mode: "prefix"
      },

      money: {
        pattern: /(?:\b(?:人民币|CNY|RMB)\b[ \t]*[-+−]?(?:\d{1,3}(?:[, \t]\d{3})+|\d+)(?:\.\d{1,2})?[ \t]*(?:元)?|[¥￥][ \t]*[-+−]?(?:\d{1,3}(?:[, \t]\d{3})+|\d+)(?:\.\d{1,2})?|\b[-+−]?(?:\d{1,3}(?:[, \t]\d{3})+|\d+)(?:\.\d{1,2})?[ \t]*元|\bUSD\b[ \t]*\$?[ \t]*[-+−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|\$[ \t]*[-+−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?|€[ \t]*[-+−]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?|\b[-+−]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?[ \t]*€)/giu,
        tag: "MONEY"
      },

      company_label_inline_zh: {
        pattern: /((?:公司名称|公司名稱|单位名称|單位名稱|供应商|供應商|开票方|開票方|收款方|付款方|法务顾问单位|项目服务机构|項目服務機構|开户名|账户名|帳戶名|開戶名|甲方|乙方|发货方)[ \t]*[:：=][ \t]*)([\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,80}?(?:集团有限公司|股份有限公司|有限责任公司|有限公司|分公司|事务所|中心|集团|公司))/gmu,
        tag: "COMPANY",
        mode: "prefix"
      },

      company_label_inline_zh_no_colon: {
        pattern: /((?:开户名|账户名|帳戶名|開戶名|公司名称|公司名稱|单位名称|單位名稱|项目服务机构|項目服務機構|法务顾问单位|发货方|甲方|乙方)[ \t]*)([\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,80}?(?:集团有限公司|股份有限公司|有限责任公司|有限公司|分公司|事务所|中心|集团|公司))/gmu,
        tag: "COMPANY",
        mode: "prefix"
      },

      company: {
        pattern: /(?<name>[\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,60}?)(?<legal>集团有限公司|股份有限公司|有限责任公司|有限公司|分公司|事务所|集团|公司)(?=$|[^\u4E00-\u9FFF])/gu,
        tag: "COMPANY",
        mode: "company"
      },

      company_block: {
        pattern: /((?:开票方|開票方|收款方|付款方|商户|商戶|供应商|供應商|公司名称|公司名稱|单位名称|單位名稱|开户名|账户名|帳戶名|開戶名)[ \t]*[:：=]?[ \t]*(?:\r?\n[ \t]*){1,4})([\u4E00-\u9FFF][\u4E00-\u9FFF0-9（）()·&\-\s]{1,60}?(?:集团有限公司|股份有限公司|有限责任公司|有限公司|分公司|事务所|中心|集团|公司))/gmu,
        tag: "COMPANY",
        mode: "prefix"
      },

      ip_label: {
        pattern: /((?:IP(?:[ \t]*Address)?|IPv4|IPv6|IP地址)[ \t]*[:：=][ \t]*)((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      ip_address: {
        pattern: /\b((?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)|(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4})\b/giu,
        tag: "SECRET"
      },

      mac_label: {
        pattern: /((?:MAC(?:[ \t]*Address)?|MAC地址)[ \t]*[:：=][ \t]*)(\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b)/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      mac_address: {
        pattern: /\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b/giu,
        tag: "SECRET"
      },

      imei: {
        pattern: /((?:IMEI)[ \t]*[:：=][ \t]*)(\d{14,16})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      device_fingerprint: {
        pattern: /((?:设备ID|Device[ \t]*ID|会话ID|Session[ \t]*ID|指纹|Fingerprint|User-?Agent|UA)[ \t]*[:：=][ \t]*)([^\n\r]{1,220})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      uuid: {
        pattern: /\b([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\b/giu,
        tag: "SECRET"
      },

      wallet_id: {
        pattern: /((?:Wallet[ \t]*ID|钱包ID|钱包编号)[ \t]*[:：=][ \t]*)([A-Za-z0-9._\-]{3,80})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      tx_hash: {
        pattern: /((?:Transaction[ \t]*Hash|TX[ \t]*Hash|交易哈希|交易Hash)[ \t]*[:：=][ \t]*)(0x[0-9a-f]{16,128})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      crypto_wallet: {
        pattern: /((?:BTC|比特币|ETH|以太坊)[ \t]*[:：=][ \t]*)((?:bc1)[0-9a-z]{25,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34}|0x[a-f0-9]{40})/giu,
        tag: "SECRET",
        mode: "prefix"
      },

      handle: {
        pattern: /@[A-Za-z0-9_]{2,32}\b/g,
        tag: "HANDLE"
      },

      number: {
        pattern: /\b\d[\d \t-]{6,28}\d\b/g,
        tag: "NUMBER"
      }
    }
  };
})();
