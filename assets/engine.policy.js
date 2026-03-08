// =========================
// assets/engine.policy.js
// v20260308-policy-slim1
// Strategy layer only
// - baseAlwaysOn
// - defaultPriority
// - phoneGuardDefault
// - risk scoring policy
// - detect thresholds / fallback
// =========================

(function () {
  "use strict";

  const POLICY = {
    version: "v20260308-policy-slim1",

    // Global always-on coverage
    baseAlwaysOn: [
      "secret",
      "url",
      "email",
      "phone",
      "account",
      "bank",
      "company",
      "money"
    ],

    // Fallback execution order when lang pack is unavailable
    defaultPriority: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "handle_label",
      "ref_label_tail",
      "money",
      "phone",
      "company",
      "address_cn",
      "address_de_street",
      "handle",
      "ref",
      "title",
      "number"
    ],

    // Default phone guard to avoid masking long IDs as phone numbers
    phoneGuardDefault: function ({ value }) {
      const digits = String(value || "").replace(/\D+/g, "");
      if (digits.length >= 16) return false;
      return true;
    },

    // Risk scoring policy
    risk: {
      // Used for UI "Top risk sources" ranking
      weights: {
        bank: 28,
        account: 26,
        email: 14,
        url: 10,
        secret: 30,
        phone: 16,

        address_de_street: 18,
        address_cn: 18,
        address_de_street_partial: 18,
        address_de_inline_street: 18,
        address_de_extra_partial: 8,

        handle_label: 10,
        ref_label_tail: 6,
        handle: 10,
        ref: 6,
        title: 4,
        number: 2,

        money: 0,
        company: 8,

        card_expiry_de: 12,
        card_security_de: 30,

        imei2: 10,
        uuid2: 10,
        insurance_id2: 16,

        manual_term: 10
      },

      groups: {
        critical: [
          "secret",
          "api_key_token",
          "bearer_token",
          "card_security",
          "card_security_de",
          "security_answer"
        ],

        financial: [
          "account",
          "bank",
          "bank_routing_ids",
          "card_expiry",
          "card_expiry_de"
        ],

        identity: [
          "dob",
          "place_of_birth",
          "passport",
          "driver_license",
          "ssn",
          "ein",
          "national_id",
          "tax_id",
          "insurance_id",
          "insurance_id2",
          "intl_itin",
          "intl_nino",
          "intl_nhs",
          "intl_sin",
          "intl_tfn",
          "intl_abn"
        ],

        contact: [
          "phone",
          "email",
          "url",
          "address_cn",
          "address_de_street",
          "address_en_inline_street",
          "address_en_extra_block",
          "address_en_extra",
          "address_de_inline_street",
          "address_de_extra_partial",
          "address_de_street_partial",
          "handle_label",
          "handle",
          "person_name",
          "person_name_keep_title",
          "company"
        ],

        tracking: [
          "ip_label",
          "ip_address",
          "mac_label",
          "mac_address",
          "imei",
          "uuid",
          "imei2",
          "uuid2",
          "device_fingerprint",
          "wallet_id",
          "tx_hash",
          "crypto_wallet"
        ]
      },

      groupWeights: {
        critical: 0.32,
        financial: 0.28,
        identity: 0.18,
        contact: 0.12,
        tracking: 0.10
      },

      groupK: {
        critical: 0.35,
        financial: 0.30,
        identity: 0.22,
        contact: 0.18,
        tracking: 0.20
      },

      thresholds: {
        mid: 40,
        high: 70
      },

      bonus: {
        base: 0,
        len1500: 2,
        len4000: 3,
        fromPdf: 2
      },

      capPerKey: 12,
      clampMin: 0,
      clampMax: 100
    },

    // Language-detect thresholds
    detect: {
      lockScore: 72,
      minGap: 14,
      allowMixed: true,
      mixedLang: ""
    },

    // Fallback if all detectors return empty
    detectFallback: "en"
  };

  window.__ENGINE_POLICY__ = POLICY;
})();
