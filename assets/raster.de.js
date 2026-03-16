// =========================
// assets/raster.de.js
// Raster render profile: de
// 已按中文结构补齐字段（新增列表为空）
// =========================

(function () {
  "use strict";

  const PACKS = (window.__RASTER_LANG_PACKS__ = window.__RASTER_LANG_PACKS__ || {});

  PACKS.de = {
    lang: "de",
    version: "r1",

    globalHeightTrim: 5,   // ← 正确位置：在对象内部，与 lang 等同级

    limits: { ... },
    bbox: { ... },
    pad: { ... },
    // ... 其余原有字段
  };
})();

  PACKS.de = {
    lang: "de",
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
      default: { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
      longValue: { maxByPage: 0.55, maxByEst: 2.20, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
      address: { maxByPage: 0.60, maxByEst: 2.10, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
      money: { maxByPage: 0.35, maxByEst: 1.80 },
      manual_term: { maxByPage: 0.40, maxByEst: 1.80 }
    },

    pad: {
      person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      person_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      account_holder_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
      company: { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
      manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
      _default: { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
    },

    shrinkLabels: {
      phone: ["Telefon", "Tel", "Handy", "Mobil", "Mobile", "Phone", "Kontakt"],
      account: ["Konto", "Kontonummer", "Account", "IBAN", "Kontoinhaber"],
      email: ["E-mail", "Email", "E-Mail"],
      address: ["Anschrift", "Adresse", "Address", "Rechnungsadresse", "Lieferadresse"],
      bank: ["Bank", "Bankname", "BIC", "SWIFT", "Bankleitzahl", "BLZ"]
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

    // ----- 以下为按中文结构补齐的字段（暂为空）-----
    keyGroups: {
      longValueKeys: [],
      addressKeys: [],
      moneyKeys: []
    },

    wholeValueKeys: [],

    skipLabelShrinkKeys: [],

    collapseHitIdKeys: [],

    paragraphSensitiveKeys: [],

    englishInlineValueKeys: [],

    rectPolicy: {
      coverWholeItemRatio: {
        default: 0.72,
        enDefault: 0.90
      },
      padOverrides: {},
      rectBoxSpecial: {}
    }
  };
})();
