// =========================
// assets/lang-detect.js (NEW)
// Language detection orchestrator (franc-all + pack.detect + conservative fallback)
// - DOES NOT modify engine.js logic by itself
// - main.js will call ensureContentLang() before applyRules()
// =========================
(function () {
  "use strict";

  // Expose singleton
  const API = (window.__LangDetect = window.__LangDetect || {});

  // ---- Config (conservative) ----
  const MIN_LEN = 40;            // text shorter than this is often ambiguous
  const MIN_LATIN = 12;          // require some letters for en/de detection
  const HAN_RATIO_ZH = 0.02;     // if Han chars ratio >= 2% => strong zh
  const UMLAUTS_DE = 2;          // >=2 umlauts => strong de
  const FRANC_CERTAIN = 0.85;    // using francAll list position heuristic (see francAll usage below)

  // ISO639-3 -> our pack lang
  const ISO3_TO_PACK = {
    eng: "en",
    deu: "de",
    ger: "de",
    zho: "zh",
    cmn: "zh",
    yue: "zh",
    wuu: "zh",
    nan: "zh"
  };

  function safeStr(x) {
    return String(x == null ? "" : x);
  }

  function getPacks() {
    return window.__ENGINE_LANG_PACKS__ || {};
  }

  function normalizePackLang(l) {
    const s = safeStr(l).toLowerCase();
    return s === "en" || s === "de" || s === "zh" ? s : "";
  }

  function stats(text) {
    const s = safeStr(text);
    const len = s.length;
    const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    const umlauts = (s.match(/[äöüÄÖÜß]/g) || []).length;
    return {
      len,
      han,
      latin,
      umlauts,
      hanRatio: han / Math.max(1, len)
    };
  }

  function strongHeuristic(text) {
    const s = safeStr(text);
    const st = stats(s);

    // Strong ZH
    if (st.hanRatio >= HAN_RATIO_ZH) {
      return { lang: "zh", certainty: 0.98, reason: "han_ratio" };
    }

    // Strong DE
    if (st.umlauts >= UMLAUTS_DE) {
      return { lang: "de", certainty: 0.95, reason: "umlauts" };
    }
    if (/\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Geburtsdatum|USt-IdNr)\b/i.test(s)) {
      return { lang: "de", certainty: 0.92, reason: "de_keywords" };
    }

    // Strong EN (conservative)
    if (st.latin >= MIN_LATIN && /\b(Invoice|Order\s*ID|Account\s*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s)) {
      return { lang: "en", certainty: 0.88, reason: "en_keywords" };
    }

    return { lang: "", certainty: 0, reason: "no_strong_signal" };
  }

  // franc-all gives ISO 639-3 code, e.g. "eng", "deu", "cmn"
  function detectByFranc(text) {
    try {
      if (typeof window.franc !== "function") {
        return { lang: "", certainty: 0, reason: "franc_missing" };
      }

      const s = safeStr(text).trim();
      if (!s) return { lang: "", certainty: 0, reason: "empty" };

      // If too short, franc can be noisy; let heuristic/pack handle
      if (s.length < MIN_LEN) return { lang: "", certainty: 0, reason: "too_short_for_franc" };

      // Use francAll list to estimate certainty if available
      // francAll(s) returns array like [[iso3, score], ...] in some builds;
      // if not available, fall back to franc(s) single result.
      let topIso3 = "";
      let certainty = 0.7;

      if (typeof window.francAll === "function") {
        const all = window.francAll(s);
        if (Array.isArray(all) && all.length) {
          const top = all[0];
          const second = all[1];
          topIso3 = safeStr(top && top[0]);
          // heuristic: if top exists and second exists, compare their "distance"
          // many builds return numeric score (lower is better). we normalize to 0..1 roughly.
          const topScore = Number(top && top[1]);
          const secondScore = Number(second && second[1]);
          if (Number.isFinite(topScore) && Number.isFinite(secondScore)) {
            // If second is much worse, higher certainty
            const gap = Math.max(0, secondScore - topScore);
            certainty = Math.max(0.6, Math.min(0.98, 0.6 + gap / 100));
          } else {
            certainty = 0.8;
          }
        }
      }

      if (!topIso3) {
        topIso3 = safeStr(window.franc(s));
        certainty = 0.78;
      }

      const packLang = ISO3_TO_PACK[topIso3] || "";
      if (!packLang) return { lang: "", certainty: 0, reason: "franc_unmapped:" + topIso3 };

      return { lang: packLang, certainty, reason: "franc:" + topIso3 };
    } catch (e) {
      return { lang: "", certainty: 0, reason: "franc_error" };
    }
  }

  function detectByPackDetect(text) {
    try {
      const packs = getPacks();
      const s = safeStr(text);
      const candidates = [];

      ["zh", "de", "en"].forEach((k) => {
        const p = packs[k];
        if (p && typeof p.detect === "function") {
          const r = normalizePackLang(p.detect(s));
          if (r) candidates.push(r);
        }
      });

      // If only one pack claims it, accept
      const uniq = Array.from(new Set(candidates));
      if (uniq.length === 1) return { lang: uniq[0], certainty: 0.76, reason: "pack_detect_single" };

      // If conflicting or none, return empty
      return { lang: "", certainty: 0, reason: uniq.length ? "pack_detect_conflict" : "pack_detect_none" };
    } catch (e) {
      return { lang: "", certainty: 0, reason: "pack_detect_error" };
    }
  }

  API.detectLang = function detectLang(text, uiLang) {
    const s = safeStr(text);

    // 1) Strong heuristic (fast, stable)
    const h = strongHeuristic(s);
    if (h.lang) return h;

    // 2) franc (broad language set)
    const f = detectByFranc(s);
    if (f.lang && f.certainty >= 0.75) return f;

    // 3) pack.detect (your existing per-language logic)
    const p = detectByPackDetect(s);
    if (p.lang) return p;

    // 4) very last fallback: follow UI lang (but mark uncertain)
    const u = normalizePackLang(uiLang);
    if (u) return { lang: u, certainty: 0.55, reason: "fallback_ui_lang" };

    return { lang: "", certainty: 0, reason: "unknown" };
  };

  // Decide whether we should ask user (modal) or auto lock.
  API.shouldAsk = function shouldAsk(result) {
    if (!result || !result.lang) return true;
    // If certainty low-ish, ask
    if (typeof result.certainty === "number" && result.certainty < 0.70) return true;
    return false;
  };

  // Ensure contentLang is set; returns { ok, lang, asked }
  // - ok=true: caller may proceed applyRules()
  // - ok=false: caller should stop (modal opened)
  API.ensureContentLang = function ensureContentLang(text, uiLang) {
    const s = safeStr(text).trim();
    if (!s) return { ok: true, lang: "", asked: false };

    // If engine already locked language, do nothing
    if (safeStr(window.ruleEngineMode) === "lock" && safeStr(window.ruleEngine)) {
      return { ok: true, lang: safeStr(window.ruleEngine), asked: false };
    }

    const res = API.detectLang(s, uiLang);

    // If uncertain -> ask user via modal (if available)
    if (API.shouldAsk(res) && window.__LangModal && typeof window.__LangModal.open === "function") {
      try {
        window.__LangModal.open({
          uiLang: normalizePackLang(uiLang) || "en",
          detected: res.lang || "",
          reason: res.reason || "",
          onPick: function (lang) {
            window.ruleEngine = lang;
            window.ruleEngineMode = "lock";
            // Mirror for old naming if you still use contentLang/contentLangMode
            window.contentLang = lang;
            window.contentLangMode = "lock";

            // Rerun immediately if possible
            try {
              const ta = document.getElementById("inputText");
              const v = ta ? String(ta.value || "") : s;
              if (typeof window.applyRules === "function") window.applyRules(v);
            } catch (_) {}
          }
        });
      } catch (_) {}
      return { ok: false, lang: "", asked: true };
    }

    // Auto lock
    if (res.lang) {
      window.ruleEngine = res.lang;
      window.ruleEngineMode = "lock";
      window.contentLang = res.lang;
      window.contentLangMode = "lock";
      return { ok: true, lang: res.lang, asked: false };
    }

    return { ok: true, lang: "", asked: false };
  };

})();
