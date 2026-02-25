// =========================
// assets/engine.policy.js (FULL)
// Strategy layer (NON-language, change here frequently)
// - baseAlwaysOn (global coverage defaults)
// - defaultPriority (fallback when packs missing)
// - phoneGuardDefault (avoid treating long IDs as phone)
// - risk scoring policy (weights/thresholds/bonuses)
// =========================

(function () {
  "use strict";

  const POLICY = {
    version: "v20260223-policy-a1",

    // ✅ global always-on (non-language, product decision)
    // Keep minimal; language-specific additions live in packs[lang].alwaysOn
    baseAlwaysOn: ["secret", "url", "email", "phone", "account", "bank", "company", "money"],

    // ✅ fallback execution order if pack missing (product default)
    // If you prefer "no fallback" (fail closed), set this to []
    defaultPriority: [
      "secret",
      "account",
      "bank",
      "email",
      "url",
      "handle_label",
      "ref_label",
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

    // ✅ language-agnostic default phone guard (used only if pack.phoneGuard missing)
    phoneGuardDefault: function ({ label, value, match }) {
      const digits = String(value || "").replace(/\D+/g, "");
      // protect against long numeric IDs (Order ID / refs / account etc.)
      if (digits.length >= 16) return false;
      return true;
    },

    // ✅ risk scoring policy (non-language)
    risk: {
      // legacy weights kept for UI "Top risk sources" ranking (no UI change)
      weights: {
        bank: 28,
        account: 26,
        email: 14,
        url: 10,
        secret: 30,
        phone: 16,
        address_de_street: 18,
        address_cn: 18,
        handle_label: 10,
        ref_label: 6,
        handle: 10,
        ref: 6,
        title: 4,
        number: 2,
        money: 0,
        company: 8,
        manual_term: 10
      },

      // Scheme A config: grouped saturation scoring
      groups: {
        critical: [
          "secret",
          "api_key_token",
          "bearer_token",
          "card_security",
          "security_answer"
        ],
        financial: [
          "account",
          "bank",
          "bank_routing_ids",
          "card_expiry"
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
          "address_cn_partial",
          "address_de_street",
          "address_en_inline_street",
          "address_en_extra_block",
          "address_en_extra",
          "handle_label",
          "handle",
          "person_name",
          "company"
        ],
        tracking: [
          "ip_label",
          "ip_address",
          "mac_label",
          "mac_address",
          "imei",
          "device_fingerprint",
          "uuid",
          "wallet_id",
          "tx_hash",
          "crypto_wallet"
        ]
      },

      // group weights MUST sum to 1.0
      groupWeights: {
        critical: 0.32,
        financial: 0.28,
        identity: 0.18,
        contact: 0.12,
        tracking: 0.10
      },

      // saturation speed per group (higher => saturates faster)
      groupK: {
        critical: 0.35,
        financial: 0.30,
        identity: 0.22,
        contact: 0.18,
        tracking: 0.20
      },

      // thresholds (tuned for Scheme A distribution)
      thresholds: {
        mid: 40,
        high: 70
      },

      // score bonuses (kept, but reduced so high-intensity docs don't constant-hit 100)
      bonus: {
        base: 0,
        len1500: 2,
        len4000: 3,
        fromPdf: 2
      },

      // cap hits per key to avoid runaway within a group
      capPerKey: 12,

      clampMin: 0,
      clampMax: 100
    },

    // ✅ language detection fallback behavior
    // If pack detectors all return "", use this:
    // - "ui": return UI lang
    // - "en": always fallback to en
    detectFallback: "en"
  };

  window.__ENGINE_POLICY__ = POLICY;
})();
