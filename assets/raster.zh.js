// =========================
// assets/raster.zh.js
// Raster render profile: zh
// 从 raster-core.js 中提取的中文红删配置，以固化内容为准
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ = window.__RASTER_LANG_PACKS__ || {});

  PACKS.zh = {
    lang: "zh",
    version: "r1",

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
      longValue: { maxByPage: 0.42, maxByEst: 1.70, wHardCapEstRatio: 2.20, wSoftCapEstMul: 1.22 },
      address: { maxByPage: 0.50, maxByEst: 1.80, wHardCapEstRatio: 2.50, wSoftCapEstMul: 1.35 },
      money: { maxByPage: 0.26, maxByEst: 1.35, wHardCapEstRatio: 1.85, wSoftCapEstMul: 1.08 },
      manual_term: { maxByPage: 0.34, maxByEst: 1.55, wHardCapEstRatio: 2.10, wSoftCapEstMul: 1.20 }
    },

    pad: {
      person_name: { pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24 },
      person_name_keep_title: { pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24 },
      account_holder_name_keep_title: { pxW: 0.0005, pyH: 0.014, minX: 0.5, minY: 0.24 },
      company: { pxW: 0.0025, pyH: 0.022, minX: 0.28, minY: 0.36 },
      company_label_inline_zh: { pxW: 0.0023, pyH: 0.020, minX: 0.24, minY: 0.34 },
      company_label_inline_zh_no_colon: { pxW: 0.0023, pyH: 0.020, minX: 0.24, minY: 0.34 },
      phone: { pxW: 0.0022, pyH: 0.020, minX: 0.24, minY: 0.34 },
      email: { pxW: 0.0022, pyH: 0.020, minX: 0.24, minY: 0.34 },
      account: { pxW: 0.0024, pyH: 0.020, minX: 0.24, minY: 0.34 },
      account_cn_inline: { pxW: 0.0024, pyH: 0.020, minX: 0.24, minY: 0.34 },
      ref_label_tail: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
      ref_inline_zh: { pxW: 0.0018, pyH: 0.018, minX: 0.18, minY: 0.30 },
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
      manual_term: { pxW: 0.0030, pyH: 0.024, minX: 0.30, minY: 0.40 },
      _default: { pxW: 0.0022, pyH: 0.020, minX: 0.22, minY: 0.34 }
    },

    shrinkLabels: {
      phone: ["电话", "手机", "联系电话", "联系方式"],
      account: ["银行账号", "账号", "卡号", "银行卡号", "账户", "对公账户", "收款账号", "IBAN"],
      email: ["邮箱", "电子邮箱"],
      address: ["地址", "住址", "办公地址", "通信地址", "收货地址", "居住地址", "单位地址", "联系地址"],
      bank: ["开户行", "开户银行", "银行", "SWIFT", "BIC"]
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

    // 以下字段为新增，从核心的硬编码列表迁移而来
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

    // 中文不需要 englishInlineValueKeys，留空
    englishInlineValueKeys: [],

    // rectPolicy 中的非列表字段（覆盖默认）
    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },
      padOverrides: {
        ref_label_tail: { pxW: 0.002, pyH: 0.018, minX: 2, minY: 0.30 },
        ref_inline_zh: { pxW: 0.002, pyH: 0.018, minX: 2, minY: 0.30 }
      },
      rectBoxSpecial: {
        refTailWidthRatio: 0.535,
        refTailMinEstRatio: 0.425,
        refTailMinPageRatio: 0.108,
        companyInlineZhWidthRatio: 1.18,
        companyInlineZhMaxPage: 0.34,
        companyInlineZhMaxEst: 1.70,
        companyInlineZhMinEst: 0.98,
        companyInlineZhMinPage: 0.22
      }
    }
  };
})();
