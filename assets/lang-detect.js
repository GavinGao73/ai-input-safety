// =========================
// assets/lang-detect.js (FULL)
// v20260305a1 — PATCHED (方案 P · franc 优先 · 极简稳定版)
// Language detection orchestrator (franc-first + modal fallback)
// - Exposes window.__LangDetect.detectLang(text, uiLang)
// - Exposes ensureContentLang() for main.js pre-guard
//
// IMPORTANT (project principle):
// 1) 汉字强信号 => zh（唯一允许的 heuristic）
// 2) 其它语言一律依赖 franc / francAll
// 3) franc 不确定 => modal 让用户选择 => lock
//
// - Content strategy language MUST be single source of truth: window.ruleEngine / window.ruleEngineMode
// - DO NOT write/read legacy window.contentLang/window.contentLangMode here
// =========================
(function () {
  "use strict";

  // Expose singleton
  const API = (window.__LangDetect = window.__LangDetect || {});
  API.__state = API.__state || { ver: "v20260305a1-p-franc-first", last: null };
  API.__state.ver = "v20260305a1-p-franc-first";

  // ---- Config (conservative) ----
  const MIN_LEN_FRANC = 40;      // shorter than this: franc is noisy
  const HAN_RATIO_ZH = 0.02;     // Han chars ratio >= 2% => strong zh

  // Confidence thresholds
  const CONF_LOCK = 0.78;        // >= lock automatically

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

  function uniq(arr) {
    return Array.from(new Set((arr || []).filter(Boolean)));
  }

  // ✅ franc bridge (top-level hardening)
  // Ensure window.franc / window.francAll exist even when bundle exposes window.FrLang.*
  try {
    if (typeof window.franc !== "function" && window.FrLang && typeof window.FrLang.franc === "function") {
      window.franc = window.FrLang.franc;
    }
    if (typeof window.francAll !== "function" && window.FrLang && typeof window.FrLang.francAll === "function") {
      window.francAll = window.FrLang.francAll;
    }
  } catch (_) {}

  function stats(text) {
    const s = safeStr(text);
    const len = s.length;
    const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;

    // NOTE: still measured (debug only); NOT used as EN/DE auto decision
    const umlauts = (s.match(/[äöüÄÖÜß]/g) || []).length;

    // keyword signals (debug only; NOT used to auto-pick EN/DE)
    const hasDeKw = /\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Geburtsdatum|USt-IdNr)\b/i.test(
      s
    );
    const hasEnKw = /\b(Invoice|Order\s*ID|Account\s*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(
      s
    );

    // DE function words (debug only; NOT used to auto-pick DE)
    const deFnWords = (s.match(/\b(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|nicht|ich|sie|wir|ihr|Sie|mit|für|auf|bei|von|zum|zur|im|am|aus|auch|wird|werden|bitte|danke)\b/gi) || [])
      .length;

    return {
      len,
      han,
      latin,
      umlauts,
      hanRatio: han / Math.max(1, len),
      hasDeKw,
      hasEnKw,
      deFnWords
    };
  }

  // ✅ Scheme P: the ONLY allowed heuristic is "Han => zh"
  function strongHeuristic(text) {
    const s = safeStr(text);
    const st = stats(s);

    if (st.hanRatio >= HAN_RATIO_ZH) {
      return {
        lang: "zh",
        confidence: 0.99,
        needsConfirm: false,
        candidates: ["zh"],
        reason: "han_ratio",
        source: "heuristic"
      };
    }

    return {
      lang: "",
      confidence: 0,
      needsConfirm: false,
      candidates: [],
      reason: "no_strong_signal",
      source: "heuristic"
    };
  }

  // franc-all gives ISO 639-3 code, e.g. "eng", "deu", "cmn"
  function detectByFranc(text) {
    try {
      const s = safeStr(text).trim();
      if (!s) {
        return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "franc" };
      }

      // ✅ PATCH (lazy bridge):
      // If the franc bundle exposes window.FrLang but the inline bridge ran too early (due to defer),
      // bind window.franc/window.francAll here before using them.
      try {
        if (typeof window.franc !== "function" && window.FrLang && typeof window.FrLang.franc === "function") {
          window.franc = window.FrLang.franc;
        }
        if (typeof window.francAll !== "function" && window.FrLang && typeof window.FrLang.francAll === "function") {
          window.francAll = window.FrLang.francAll;
        }
      } catch (_) {}

      if (typeof window.franc !== "function") {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "franc_missing", source: "franc" };
      }

      if (s.length < MIN_LEN_FRANC) {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "too_short_for_franc", source: "franc" };
      }

      let topIso3 = "";
      let secondIso3 = "";

      // ✅ NOTE: do NOT derive confidence from score-gap (score semantics differ by build)
      // Conservative stable confidence:
      // - base confidence for mapped result
      // - force confirm when EN/DE ambiguity appears in candidates
      let confidence = 0.86;

      if (typeof window.francAll === "function") {
        const all = window.francAll(s);
        if (Array.isArray(all) && all.length) {
          const top = all[0];
          const second = all[1];
          topIso3 = safeStr(top && top[0]);
          secondIso3 = safeStr(second && second[0]);
        }
      }

      if (!topIso3) {
        topIso3 = safeStr(window.franc(s));
      }

      const topLang = normalizePackLang(ISO3_TO_PACK[topIso3] || "");
      const secondLang = normalizePackLang(ISO3_TO_PACK[secondIso3] || "");

      const candidates = uniq([topLang, secondLang]).filter(Boolean);

      if (!topLang) {
        return {
          lang: "",
          confidence: 0,
          needsConfirm: true,
          candidates,
          reason: "franc_unmapped:" + topIso3,
          source: "franc"
        };
      }

      // ✅ If EN/DE ambiguity exists -> modal (scheme P)
      if (candidates.includes("en") && candidates.includes("de")) {
        return {
          lang: topLang,
          confidence: 0.74,
          needsConfirm: true,
          candidates,
          reason: "franc_en_de_ambiguous:" + topIso3,
          source: "franc"
        };
      }

      return {
        lang: topLang,
        confidence,
        needsConfirm: confidence < CONF_LOCK,
        candidates: candidates.length ? candidates : [topLang],
        reason: "franc:" + topIso3,
        source: "franc"
      };
    } catch (e) {
      return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "franc_error", source: "franc" };
    }
  }

  // (kept for future/debug; NOT used by scheme P detectLang)
  function detectByPackDetect(text) {
    try {
      const packs = getPacks();
      const s = safeStr(text);
      const claims = [];

      ["zh", "de", "en"].forEach((k) => {
        const p = packs[k];
        if (p && typeof p.detect === "function") {
          const r = normalizePackLang(p.detect(s));
          if (r) claims.push(r);
        }
      });

      const u = uniq(claims);

      if (u.length === 1) {
        return {
          lang: u[0],
          confidence: 0.74,
          needsConfirm: false,
          candidates: [u[0]],
          reason: "pack_detect_single",
          source: "pack"
        };
      }

      if (u.length >= 2) {
        return {
          lang: "",
          confidence: 0.55,
          needsConfirm: true,
          candidates: u.slice(0, 3),
          reason: "pack_detect_conflict",
          source: "pack"
        };
      }

      return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "pack_detect_none", source: "pack" };
    } catch (e) {
      return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "pack_detect_error", source: "pack" };
    }
  }

  // Primary API (Scheme P):
  // Returns: { lang, confidence, needsConfirm, candidates, reason, source }
  API.detectLang = function detectLang(text, uiLang) {
    const s = safeStr(text).trim();
    if (!s) {
      return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "none" };
    }

    // 1) ZH strong signal (唯一允许 heuristic)
    const h = strongHeuristic(s);
    if (h.lang === "zh") return h;

    // 2) franc first (EN/DE 等一律只依赖 franc)
    const f = detectByFranc(s);

    // treat "und" as uncertain => modal
    if (f.lang && f.lang !== "und" && !f.needsConfirm) {
      return f;
    }

    // 3) franc uncertain => modal
    return {
      lang: (f.lang && f.lang !== "und") ? f.lang : "",
      confidence: f.confidence || 0,
      needsConfirm: true,
      candidates: Array.isArray(f.candidates) ? f.candidates : [],
      reason: f.reason || "franc_uncertain",
      source: "franc"
    };
  };

  function rerunAfterPick(fallbackText) {
    try {
      const ta = document.getElementById("inputText");
      const v = String((fallbackText != null ? fallbackText : (ta ? ta.value : "")) || "");
      if (!v.trim()) return;

      // 1) Best: stage3 exposes a safe wrapper
      if (typeof window.applyRulesSafely === "function") {
        window.applyRulesSafely(v);
        return;
      }

      // 2) Otherwise: guard OK => run applyRules
      if (typeof window.ensureLangBeforeApply === "function") {
        const ok = window.ensureLangBeforeApply(v);
        if (ok === false) return;
      }

      if (typeof window.applyRules === "function") {
        window.applyRules(v);
      }
    } catch (_) {}
  }

  // Pre-guard for main.js:
  // - If uncertain: open modal and return ok=false
  // - If certain: lock ruleEngine and return ok=true
  API.ensureContentLang = function ensureContentLang(text, uiLang) {
    const s = safeStr(text).trim();
    if (!s) return { ok: true, lang: "", asked: false };

    // Already locked (single source of truth)
    if (safeStr(window.ruleEngineMode).toLowerCase() === "lock" && safeStr(window.ruleEngine)) {
      return { ok: true, lang: safeStr(window.ruleEngine), asked: false };
    }

    const res = API.detectLang(s, uiLang);
    API.__state.last = res;

    // needsConfirm => open modal
    if (res && res.needsConfirm) {
      if (window.__LANG_MODAL_OPENING__ === true) return { ok: false, lang: "", asked: true };

      if (window.__LangModal && typeof window.__LangModal.open === "function") {
        try {
          window.__LANG_MODAL_OPENING__ = true;

          window.__LangModal.open({
            uiLang: normalizePackLang(uiLang) || "en",
            detected: res.lang || "",
            confidence: typeof res.confidence === "number" ? res.confidence : null,
            candidates: Array.isArray(res.candidates) ? res.candidates.slice(0, 6) : [],
            reason: res.reason || "",
            onPick: function (lang) {
              const L = normalizePackLang(lang);
              if (!L) return;

              window.ruleEngine = L;
              window.ruleEngineMode = "lock";

              window.__LANG_MODAL_OPENING__ = false;

              rerunAfterPick(s);
            },
            onClose: function () {
              window.__LANG_MODAL_OPENING__ = false;
            }
          });
        } catch (_) {
          window.__LANG_MODAL_OPENING__ = false;
        }
      }

      return { ok: false, lang: "", asked: true };
    }

    // Auto lock if confident enough
    if (res && res.lang && (typeof res.confidence !== "number" || res.confidence >= CONF_LOCK)) {
      window.ruleEngine = res.lang;
      window.ruleEngineMode = "lock";
      return { ok: true, lang: res.lang, asked: false };
    }

    // If we have a lang but not confident (should be rare under scheme P), do not force modal here.
    // Only ask when lang is empty and modal exists.
    if ((!res || !res.lang) && window.__LangModal && typeof window.__LangModal.open === "function") {
      if (window.__LANG_MODAL_OPENING__ === true) return { ok: false, lang: "", asked: true };

      try {
        window.__LANG_MODAL_OPENING__ = true;
        window.__LangModal.open({
          uiLang: normalizePackLang(uiLang) || "en",
          detected: res && res.lang ? res.lang : "",
          confidence: res && typeof res.confidence === "number" ? res.confidence : null,
          candidates: Array.isArray(res && res.candidates) ? res.candidates.slice(0, 6) : [],
          reason: (res && res.reason) ? ("ask_fallback:" + res.reason) : "ask_fallback",
          onPick: function (lang) {
            const L = normalizePackLang(lang);
            if (!L) return;

            window.ruleEngine = L;
            window.ruleEngineMode = "lock";

            window.__LANG_MODAL_OPENING__ = false;

            rerunAfterPick(s);
          },
          onClose: function () {
            window.__LANG_MODAL_OPENING__ = false;
          }
        });
      } catch (_) {
        window.__LANG_MODAL_OPENING__ = false;
      }

      return { ok: false, lang: "", asked: true };
    }

    return { ok: true, lang: res && res.lang ? res.lang : "", asked: false };
  };

})();
