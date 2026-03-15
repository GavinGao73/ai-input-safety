// =========================
// assets/raster.en.js
// Raster render profile: en
// 版本：保留标题，只覆盖内容
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ = window.__RASTER_LANG_PACKS__ || {});

  PACKS.en = {
    lang: "en",
    version: "r2",

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
      default: { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
      longValue: { maxByPage: 0.70, maxByEst: 2.50, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
      address: { maxByPage: 0.75, maxByEst: 2.40, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
      money: { maxByPage: 0.35, maxByEst: 1.80 },
      manual_term: { maxByPage: 0.40, maxByEst: 1.80 }
    },

    pad: {
      person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      person_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      account_holder_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },

      company: { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
      manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },

      uuid: { pxW: 0.008, pyH: 0.045, minX: 0.8, minY: 0.75 },
      ip_address: { pxW: 0.007, pyH: 0.045, minX: 0.7, minY: 0.75 },
      wallet_id: { pxW: 0.007, pyH: 0.045, minX: 0.7, minY: 0.75 },

      _default: { pxW: 0.004, pyH: 0.035, minX: 0.5, minY: 0.70 }
    },

    shrinkLabels: {
      phone: ["Phone", "Mobile", "Tel", "Telephone", "Contact", "Cell"],
      account: ["Account", "Account No", "Account Number", "IBAN", "Card Number", "Routing Number", "Bank Account"],
      email: ["Email", "E-mail", "Email Address"],
      address: ["Address", "Shipping Address", "Billing Address", "Mailing Address", "Office Address"],
      bank: ["Bank", "Bank Name", "BIC", "SWIFT", "SWIFT/BIC"],
      passport: ["Passport", "Passport Number", "Passport No"],
      driver_license: ["Driver License", "Driver's License", "License", "DL"],
      license_plate: ["License Plate", "Plate", "Registration"],
      dob: ["Date of Birth", "DOB", "Birth Date"],
      id_card: ["ID", "ID Card", "Identification", "Identity Card"],
      company: ["Company", "Company Name", "Organization", "Supplier", "Legal Entity", "Registered Company", "Billing Company"],
      money: ["Amount", "Contract Amount", "Service Fee", "Tax Amount", "Total Amount", "USD"],
      ref: ["Reference", "Ref", "Reference ID", "Order Number", "Case ID", "Application ID", "Invoice Number", "Customer ID"],
      handle: ["Handle", "User", "Username"]
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
        "account","account_cn_inline","phone","email","bank",
        "uuid","wallet_id","ip_address","ip_label",
        "device_fingerprint","api_key_token_zh","secret",
        "secret_inline_zh","security_answer","tax_id_zh",
        "passport","passport_inline_zh","id_card",
        "id_card_inline_zh","driver_license","license_plate",
        "license_plate_inline_zh"
      ],

      addressKeys: [
        "address_inline_zh","address_cn","address_de_street",
        "address_de_postal","address_de_street_partial",
        "address_de_extra_partial","address_de_inline_street",
        "address_en_inline_street","address_en_extra_block",
        "address_en_extra"
      ],

      moneyKeys: [
        "money","money_label","money_cn_inline_label",
        "money_label_currency_zh"
      ]
    },

    wholeValueKeys: [
      "account","account_cn_inline","api_key_token_zh",
      "device_fingerprint","dob","driver_license","email",
      "handle_label","id_card","id_card_inline_zh",
      "ip_address","ip_label","money","money_cn_inline_label",
      "money_label","money_label_currency_zh","passport",
      "passport_inline_zh","phone","ref_inline_zh",
      "ref_label_tail","secret","secret_inline_zh",
      "tax_id_zh","uuid","wallet_id"
    ],

    skipLabelShrinkKeys: [
      "ref_label_tail","ref_inline_zh","money","money_label",
      "money_cn_inline_label","money_label_currency_zh",
      "phone","email","account","account_cn_inline",
      "id_card","id_card_inline_zh","passport",
      "passport_inline_zh","driver_license","tax_id_zh",
      "uuid","wallet_id","ip_address","ip_label","secret",
      "secret_inline_zh","api_key_token_zh","device_fingerprint",
      "dob"
    ],

    collapseHitIdKeys: [
      "address_inline_zh","phone","money","company",
      "license_plate","license_plate_inline_zh"
    ],

    paragraphSensitiveKeys: [
      "ref_label_tail","ref_inline_zh","company",
      "company_label_inline_zh","company_label_inline_zh_no_colon",
      "account","account_cn_inline","id_card",
      "id_card_inline_zh","passport","passport_inline_zh",
      "driver_license","license_plate","license_plate_inline_zh",
      "tax_id_zh","uuid","wallet_id","ip_address","ip_label",
      "secret","secret_inline_zh","security_answer",
      "api_key_token_zh","device_fingerprint","handle_label"
    ],

    englishInlineValueKeys: [
      "phone","email","money","money_label",
      "money_cn_inline_label","money_label_currency_zh",
      "account","account_cn_inline","dob","id_card",
      "id_card_inline_zh","passport","passport_inline_zh",
      "driver_license","tax_id_zh","uuid","wallet_id",
      "ip_address","ip_label","secret","secret_inline_zh",
      "api_key_token_zh","device_fingerprint","company",
      "ref_label_tail","ref_inline_zh"
    ],

    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },

      padOverrides: {
        email: { pxW: 0.004, pyH: 0.030 },
        phone: { pxW: 0.004, pyH: 0.030 },
        account: { pxW: 0.004, pyH: 0.030 },
        money: { pxW: 0.004, pyH: 0.030 }
      },

      rectBoxSpecial: {
        email: { widthMul: 1.05 },
        phone: { widthMul: 1.05 },
        account: { widthMul: 1.05 },
        money: { widthMul: 1.05 },
        ref_label_tail: { widthMul: 1.05 }
      }
    }
  };
})();
