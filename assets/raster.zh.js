// =========================
// assets/raster.zh.js
// Raster render profile: zh
// 修改记录：
// 1. 移除 padOverrides 中的 ref_label_tail / ref_inline_zh（避免覆盖 pad 中的新值）
// 2. 增大 account / ref 等 key 的水平填充（pxW 0.0030→0.0040, minX 0.30→0.40）
// 3. 减小垂直填充（pyH 0.012→0.005, minY 0.18→0.05）
// 4. 调整 _default 以覆盖 handle/ref/number 等未单独配置的 key
// 5. 扩展 shrinkLabels，匹配 engine.zh.js 中的所有标签前缀
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ = window.__RASTER_LANG_PACKS__ || {});

  PACKS.zh = {
    lang: "zh",
    version: "r1",

    // 全局高度削减（像素），值越大黑条越矮。中文建议 4（比英文稍高）
    globalHeightTrim: 20,        // 高度削减
    globalVerticalOffset: 25,     // 向下偏移更多，补偿上移

    limits: {
      maxMatchLen: {
        manual_term: 90,
        person_name: 40,
        person_name_keep_title: 40,
        account_holder_name_keep_title: 40,
        company: 70,
        email: 90,
        phone: 60,
        account: 90,
        bank: 140,
        address_de_street: 160,
        address_de_postal: 160,
        address_de_street_partial: 160,
        address_de_extra_partial: 160,
        address_de_inline_street: 160,
        address_en_inline_street: 160,
        address_en_extra_block: 160,
        address_en_extra: 160,
        address_cn: 160,
        handle: 90,
        ref: 90,
        title: 90,
        money: 70,
        money_label: 70,
        number: 70
      }
    },

    bbox: {
      default: { maxByPage: 0.24, maxByEst: 1.28, wHardCapEstRatio: 1.90, wSoftCapEstMul: 1.08 },
      longValue: { maxByPage: 0.50, maxByEst: 2.00, wHardCapEstRatio: 2.20, wSoftCapEstMul: 1.22 },
      address: { maxByPage: 0.50, maxByEst: 1.80, wHardCapEstRatio: 2.50, wSoftCapEstMul: 1.35 },
      money: { maxByPage: 0.26, maxByEst: 1.35, wHardCapEstRatio: 1.85, wSoftCapEstMul: 1.08 },
      manual_term: { maxByPage: 0.34, maxByEst: 1.55, wHardCapEstRatio: 2.10, wSoftCapEstMul: 1.20 }
    },

    pad: {
      person_name: {
        pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24,
        maxWidthPageRatio: 0.16, maxWidthItemRatio: 0.90
      },
      person_name_keep_title: {
        pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24,
        maxWidthPageRatio: 0.16, maxWidthItemRatio: 0.90
      },
      account_holder_name_keep_title: {
        pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24,
        maxWidthPageRatio: 0.16, maxWidthItemRatio: 0.90
      },
      company: {
        pxW: 0.0025, pyH: 0.022, minX: 0.28, minY: 0.36,
        maxWidthPageRatio: 0.40, maxWidthItemRatio: 1.50
      },
      company_label_inline_zh: { pxW: 0.0023, pyH: 0.020, minX: 0.24, minY: 0.34 },
      company_label_inline_zh_no_colon: { pxW: 0.0023, pyH: 0.020, minX: 0.24, minY: 0.34 },
      phone: { pxW: 0.0022, pyH: 0.020, minX: 0.24, minY: 0.34 },
      email: { pxW: 0.0022, pyH: 0.020, minX: 0.24, minY: 0.34 },
      // 账号类：进一步加宽、下移
      account: { pxW: 0.0040, pyH: 0.005, minX: 0.40, minY: 0.05 },
      account_cn_inline: { pxW: 0.0040, pyH: 0.005, minX: 0.40, minY: 0.05 },
      // 参考编号类：进一步加宽、下移
      ref_label_tail: { pxW: 0.006, pyH: 0.005, minX: 0.6, minY: 0.05 },
      ref_inline_zh: { pxW: 0.006, pyH: 0.005, minX: 0.6, minY: 0.05 },
      money: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
      money_label: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
      money_cn_inline_label: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
      money_label_currency_zh: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
      address_inline_zh: { pxW: 0.0035, pyH: 0.014, minX: 10, minY: 0.24 },
      place_of_birth: { pxW: 0.0040, pyH: 0.014, minX: 8, minY: 0.24 },
      license_plate: { pxW: 0.0040, pyH: 0.014, minX: 8, minY: 0.24 },
      license_plate_inline_zh: { pxW: 0.0040, pyH: 0.014, minX: 8, minY: 0.24 },
      security_answer: { pxW: 0.0040, pyH: 0.014, minX: 8, minY: 0.24 },
      secret_inline_zh: { pxW: 0.0040, pyH: 0.014, minX: 8, minY: 0.24 },
      manual_term: {
        pxW: 0.0030, pyH: 0.024, minX: 0.30, minY: 0.40,
        maxWidthPageRatio: 0.45, maxWidthItemRatio: 1.60
      },
      // 默认值：适当加宽、下移，覆盖 handle/ref/number 等未单独配置的 key
      _default: { pxW: 0.0030, pyH: 0.010, minX: 0.30, minY: 0.10 }
    },

    shrinkLabels: {
      // 电话类
      phone: [
        "电话", "手机", "联系电话", "联系方式", "Tel", "Telefon", "Phone", "Mobile", "Handy"
      ],

      // 账户类（银行账号、卡号、路由号等）
      account: [
        "银行账号", "銀行賬號", "账号", "賬號", "卡号", "银行卡号", "账户", "帳戶",
        "对公账户", "對公賬戶", "收款账号", "收款帳號", "开户账号", "開戶賬號",
        "信用卡", "信用卡号", "信用卡號", "Card Number", "Credit Card", "Debit Card",
        "IBAN", "联行号", "清算号", "分行号", "支行号", "行号", "路由号",
        "Routing Number", "Sort Code", "BSB", "ABA", "Clearing Number", "Transit Number"
      ],

      // 邮箱类
      email: [
        "邮箱", "电子邮箱", "Email", "E-mail", "Mail"
      ],

      // 地址类
      address: [
        "地址", "住址", "办公地址", "辦公地址", "通信地址", "聯絡地址", "联系地址",
        "收货地址", "收貨地址", "收件地址", "居住地址", "单位地址", "公司地址",
        "注册地址", "签署地址", "履约地址", "账单地址", "帳單地址",
        "上海市", "北京市", "天津市", "重庆市", "香港特别行政区", "澳门特别行政区",
        "省", "市", "区", "县", "镇", "路", "街", "道", "大道", "巷", "弄", "里", "坊", "胡同"
      ],

      // 银行类
      bank: [
        "开户行", "開戶銀行", "开户银行", "银行", "銀行", "Bank", "Bank Name",
        "SWIFT", "BIC", "Swift Code", "BIC Code"
      ],

      // 护照类
      passport: [
        "护照号", "护照号码", "Passport No", "Passport Number"
      ],

      // 驾驶证类
      driver_license: [
        "驾驶证号", "驾驶证号码", "Driver's License", "Driving License", "License", "DL"
      ],

      // 车牌类
      license_plate: [
        "车牌号", "车牌号码", "号牌号码", "车牌", "号牌"
      ],

      // 出生日期类
      dob: [
        "出生日期", "出生年月", "生日", "DOB", "Date of Birth"
      ],

      // 身份证类
      id_card: [
        "身份证号", "居民身份证", "身份证号码", "公民身份号码", "ID", "身份证", "Identification"
      ],

      // 公司类
      company: [
        "公司名称", "公司名稱", "单位名称", "單位名稱", "供应商", "供應商",
        "开票方", "開票方", "收款方", "付款方", "法务顾问单位", "项目服务机构",
        "項目服務機構", "开户名", "账户名", "帳戶名", "開戶名", "甲方", "乙方",
        "发货方", "商户", "商戶", "公司", "企业", "集团", "有限公司",
        "股份有限公司", "有限责任公司", "分公司", "事务所", "中心",
      // 新增常见标签
       "企业名称", "组织机构", "法人名称", "公司全称", "公司名", "单位名",
       "商户名称", "商家名称"
      ],

      // 金额类
      money: [
        "金额", "合计", "总计", "小计", "应付", "实付", "已付", "支付金额",
        "付款金额", "收款金额", "退款金额", "余额", "费用", "手续费", "服务费",
        "税额", "税费", "增值税", "合同总金额", "首付款", "尾款", "金额合计",
        "基础服务包", "高级功能模块", "实施费用", "售后支持", "付款",
        "VAT", "Amount", "Total", "Subtotal", "Balance", "Paid", "Payment",
        "Refund", "Due", "Net", "Gross", "人民币", "CNY", "RMB", "USD", "EUR", "$", "€"
      ],

      // 参考编号类
      ref: [
        "申请编号", "参考编号", "订单号", "单号", "合同号", "发票号", "编号",
        "工单号", "票据号", "客户号", "索赔参考号", "法律案件号", "Case ID",
        "Ticket No", "Application ID", "Order ID", "Invoice No", "Reference",
        "客户ID", "Customer ID", "补充协议编号", "合同编号", "法律案件号",
        "索赔参考号", "Ref", "REF"
      ],

      // 用户名/句柄类
      handle: [
        "用户名", "用 户 名", "用户ID", "用户 ID", "用户", "登录账号",
        "登 录 账 号", "账号名", "账 号 名", "账号", "支付账号", "支付账户",
        "微信号", "WeChat ID", "wxid", "User ID"
      ],

      // 人名类
      person_name: [
        "姓名", "收件人", "联系人", "Name", "Recipient", "开户名", "账户名"
      ],

      // 出生地类
      place_of_birth: [
        "出生地", "籍贯", "出生地点", "Birth Place", "Place of Birth"
      ],

      // 秘密/敏感信息类
      secret: [
        "密码", "口令", "登录密码", "支付密码", "PIN", "验证码", "校验码",
        "动态码", "短信验证码", "OTP", "2FA", "口令码", "安全码", "授权码",
        "安全答案", "密保答案", "回答", "答案", "接口密钥", "API Key",
        "Access Token", "刷新令牌", "Refresh Token", "令牌", "Token",
        "会话ID", "Session ID", "设备ID", "Device ID", "钱包地址", "交易哈希",
        "交易Hash", "IP地址", "MAC地址", "MAC Address", "IPv4", "IPv6", "IMEI",
        "设备指纹", "指纹", "User Agent", "UA", "Wallet ID", "钱包ID", "钱包编号",
        "Transaction Hash", "TX Hash", "BTC", "比特币", "ETH", "以太坊",
        "CVV", "CVC", "有效期", "到期", "Expiry", "Expiration", "Valid Thru"
      ]
    },

    merge: {
      nearGapLegacy: 1.2,
      nearGapCore: 1.2,
      sameLineOverlapRatio: 0.88,
      similarHeightRatio: 0.80
    },

    itemBox: {
      fontHeightMul: 1.08,
      fontHeightMin: 6,
      fontHeightMax: 96,
      widthEstMul: 0.72,
      shortTokenCap: 1.10,
      hardCap: 1.18
    },

    rectBox: {
      fontHeightMul: 1.10,
      fontHeightMin: 6,
      fontHeightMax: 104,
      widthEstMul: 0.82
    },

    keyGroups: {
      longValueKeys: [
        "account",
        "account_cn_inline",
        "phone",
        "email",
        "bank",
        "uuid",
        "wallet_id",
        "ip_address",
        "ip_label",
        "device_fingerprint",
        "api_key_token_zh",
        "secret",
        "secret_inline_zh",
        "security_answer",
        "tax_id_zh",
        "passport",
        "passport_inline_zh",
        "id_card",
        "id_card_inline_zh",
        "driver_license",
        "license_plate",
        "license_plate_inline_zh"
      ],
      addressKeys: [
        "address_inline_zh",
        "address_cn",
        "address_de_street",
        "address_de_postal",
        "address_de_street_partial",
        "address_de_extra_partial",
        "address_de_inline_street",
        "address_en_inline_street",
        "address_en_extra_block",
        "address_en_extra"
      ],
      moneyKeys: [
        "money",
        "money_label",
        "money_cn_inline_label",
        "money_label_currency_zh"
      ]
    },

    wholeValueKeys: [
      "account",
      "account_cn_inline",
      "api_key_token_zh",
      "device_fingerprint",
      "dob",
      "driver_license",
      "email",
      "handle_label",
      "id_card",
      "id_card_inline_zh",
      "ip_address",
      "ip_label",
      "money",
      "money_cn_inline_label",
      "money_label",
      "money_label_currency_zh",
      "passport",
      "passport_inline_zh",
      "phone",
      "ref_inline_zh",
      "ref_label_tail",
      "secret",
      "secret_inline_zh",
      "tax_id_zh",
      "uuid",
      "wallet_id"
    ],

    skipLabelShrinkKeys: [
      "ref_label_tail",
      "ref_inline_zh",
      "money",
      "money_label",
      "money_cn_inline_label",
      "money_label_currency_zh",
      "phone",
      "email",
      "account",
      "account_cn_inline",
      "id_card",
      "id_card_inline_zh",
      "passport",
      "passport_inline_zh",
      "driver_license",
      "tax_id_zh",
      "uuid",
      "wallet_id",
      "ip_address",
      "ip_label",
      "secret",
      "secret_inline_zh",
      "api_key_token_zh",
      "device_fingerprint",
      "dob"
    ],

    collapseHitIdKeys: [
      "address_inline_zh",
      "phone",
      "money",
      "company",
      "license_plate",
      "license_plate_inline_zh"
    ],

    paragraphSensitiveKeys: [
      "ref_label_tail",
      "ref_inline_zh",
      "company",
      "company_label_inline_zh",
      "company_label_inline_zh_no_colon",
      "account",
      "account_cn_inline",
      "id_card",
      "id_card_inline_zh",
      "passport",
      "passport_inline_zh",
      "driver_license",
      "license_plate",
      "license_plate_inline_zh",
      "tax_id_zh",
      "uuid",
      "wallet_id",
      "ip_address",
      "ip_label",
      "secret",
      "secret_inline_zh",
      "security_answer",
      "api_key_token_zh",
      "device_fingerprint",
      "handle_label"
    ],

    englishInlineValueKeys: [],

    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },
      // 已移除冲突的 padOverrides 条目，让 pad 中的值生效
      padOverrides: {},
      rectBoxSpecial: {
        refTailWidthRatio: 0.6,
        refTailMinEstRatio: 0.5,
        refTailMinPageRatio: 0.15,
        companyInlineZhWidthRatio: 1.18,
        companyInlineZhMaxPage: 0.34,
        companyInlineZhMaxEst: 1.70,
        companyInlineZhMinEst: 0.98,
        companyInlineZhMinPage: 0.22
      }
    }
  };
})();
