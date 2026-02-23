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

      // thresholds
      thresholds: {
        mid: 35,
        high: 70
      },

      // score bonuses
      bonus: {
        base: 10,
        len1500: 6,
        len4000: 8,
        fromPdf: 6
      },

      // cap hits per key to avoid runaway score
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
