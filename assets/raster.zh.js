// =========================
// assets/raster.zh.js
// Raster render profile: zh
// - rendering-only language pack
// - bbox / pad / label shrink / merge / itemBox / limits
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
        person_name: 32,
        person_name_keep_title: 32,
        account_holder_name_keep_title: 32,
        company: 60,
        email: 80,
        phone: 50,
        account: 80,
        bank: 120,

        address_de_street: 140,
        address_de_postal: 140,
        address_de_street_partial: 140,
        address_de_extra_partial: 140,
        address_de_inline_street: 140,
        address_en_inline_street: 140,
        address_en_extra_block: 140,
        address_en_extra: 140,
        address_cn: 140,

        handle: 80,
        ref: 80,
        title: 80,
        money: 60,
        money_label: 60,
        number: 60
      }
    },

    bbox: {
      default: {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      },
      longValue: {
        maxByPage: 0.55,
        maxByEst: 2.20,
        wHardCapEstRatio: 2.8,
        wSoftCapEstMul: 1.60
      },
      address: {
        maxByPage: 0.60,
        maxByEst: 2.10,
        wHardCapEstRatio: 3.2,
        wSoftCapEstMul: 1.70
      },
      money: {
        maxByPage: 0.35,
        maxByEst: 1.80
      },
      manual_term: {
        maxByPage: 0.40,
        maxByEst: 1.80
      }
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
    }
  };
})();
