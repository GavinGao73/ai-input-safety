// =========================
// assets/lang-detect.js (FULL)
// v20260304a2 — PATCHED (franc-primary, no DE-heuristic auto-claim, empty/uncertain => modal)
//
// Language detection orchestrator (franc-all + minimal zh heuristic + modal on uncertainty)
// - Exposes window.__LangDetect.detectLang(text, uiLang)
// - Exposes ensureContentLang() for main.js pre-guard
//
// IMPORTANT (project principle):
// - Content strategy language MUST be single source of truth: window.ruleEngine / window.ruleEngineMode
// - DE/EN decision MUST be franc-primary
// - If uncertain / empty / too-short / mixed => modal (user pick)
// - DO NOT use umlaut/keywords/function-words to auto-claim DE
// =========================
(function () {
  "use strict";

  // Expose singleton
  const API = (window.__LangDetect = window.__LangDetect || {});
  API.__state = API.__state || { ver: "v20260304a2-franc-primary", last: null };

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

  function stats(text) {
    const s = safeStr(text);
    const len = s.length;
    const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;

    return {
      len,
      han,
      latin,
      hanRatio: han / Math.max(1, len)
    };
  }

  // ✅ Only strong heuristic we keep: Chinese
  function strongHeuristic(text) {
    const s = safeStr(text);
    const st = stats(s);

    // Strong ZH
    if (st.hanRatio >= HAN_RATIO_ZH) {
      return {
        lang: "zh",
        confidence: 0.98,
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

      if (typeof window.franc !== "function") {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "franc_missing", source: "franc" };
      }

      if (s.length < MIN_LEN_FRANC) {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "too_short_for_franc", source: "franc" };
      }

      let topIso3 = "";
      let secondIso3 = "";
      let confidence = 0.80;

      if (typeof window.francAll === "function") {
        const all = window.francAll(s);
        if (Array.isArray(all) && all.length) {
          const top = all[0];
          const second = all[1];

          topIso3 = safeStr(top && top[0]);
          secondIso3 = safeStr(second && second[0]);

          const topScore = Number(top && top[1]);
          const secondScore = Number(second && second[1]);

          // franc score meaning differs by build; treat only as soft indicator
          if (Number.isFinite(topScore) && Number.isFinite(secondScore)) {
            const gap = Math.max(0, topScore - secondScore);
            confidence = Math.max(0.62, Math.min(0.92, 0.62 + gap / 120));
          } else {
            confidence = 0.80;
          }
        }
      }

      if (!topIso3) {
        topIso3 = safeStr(window.franc(s));
        confidence = 0.80;
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

      let needsConfirm = confidence < CONF_LOCK;

      // If franc thinks EN/DE are close, prefer asking
      if (candidates.includes("en") && candidates.includes("de") && confidence < 0.88) needsConfirm = true;

      return {
        lang: topLang,
        confidence,
        needsConfirm,
        candidates: candidates.length ? candidates : [topLang],
        reason: "franc:" + topIso3,
        source: "franc"
      };
    } catch (e) {
      return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "franc_error", source: "franc" };
    }
  }

  // pack.detect is kept ONLY to provide candidates when franc is missing/too-short
  function detectByPackDetectCandidates(text) {
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

      return uniq(claims).slice(0, 3);
    } catch (_) {
      return [];
    }
  }

  // Primary API:
  // Returns: { lang, confidence, needsConfirm, candidates, reason, source }
  API.detectLang = function detectLang(text, uiLang) {
    const trimmed = safeStr(text).trim();
    if (!trimmed) return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "none" };

    // 1) Strong heuristic: ZH only
    const h = strongHeuristic(trimmed);
    if (h.lang) return h;

    // 2) franc primary for DE/EN (and others)
    const f = detectByFranc(trimmed);

    // If franc produced something (lang or candidates), return it
    if (f.lang || (f.candidates && f.candidates.length)) return f;

    // 3) If franc gives nothing, provide pack.detect candidates but still ask
    const cand = detectByPackDetectCandidates(trimmed);
    if (cand && cand.length) {
      return {
        lang: "",
        confidence: 0.55,
        needsConfirm: true,
        candidates: cand,
        reason: "pack_candidates_only",
        source: "pack"
      };
    }

    // 4) last fallback: follow UI but ASK (safe)
    const u = normalizePackLang(uiLang);
    if (u) return { lang: u, confidence: 0.55, needsConfirm: true, candidates: [u], reason: "fallback_ui_lang", source: "fallback" };

    return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "unknown", source: "fallback" };
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
  // - If uncertain OR empty => open modal and return ok=false
  // - If certain AND confident => lock ruleEngine and return ok=true
  API.ensureContentLang = function ensureContentLang(text, uiLang) {
    const s = safeStr(text).trim();
    if (!s) return { ok: true, lang: "", asked: false };

    // Already locked (single source of truth)
    if (safeStr(window.ruleEngineMode).toLowerCase() === "lock" && safeStr(window.ruleEngine)) {
      return { ok: true, lang: safeStr(window.ruleEngine), asked: false };
    }

    const res = API.detectLang(s, uiLang);
    API.__state.last = res;

    // ✅ HARD RULE: if res is uncertain OR lang is empty => MUST ask (if modal exists)
    const mustAsk = !res || !res.lang || !!res.needsConfirm;

    if (mustAsk) {
      if (window.__LANG_MODAL_OPENING__ === true) return { ok: false, lang: "", asked: true };

      if (window.__LangModal && typeof window.__LangModal.open === "function") {
        try {
          window.__LANG_MODAL_OPENING__ = true;

          const cand = Array.isArray(res && res.candidates) && res.candidates.length
            ? res.candidates.slice(0, 6)
            : ["zh", "de", "en"];

          window.__LangModal.open({
            uiLang: normalizePackLang(uiLang) || "en",
            detected: res && res.lang ? res.lang : "",
            confidence: res && typeof res.confidence === "number" ? res.confidence : null,
            candidates: cand,
            reason: res && res.reason ? res.reason : "uncertain",
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

      // no modal available => fail-open but do not lock
      return { ok: true, lang: res && res.lang ? res.lang : "", asked: false };
    }

    // Auto lock if confident enough
    if (res && res.lang && (typeof res.confidence !== "number" || res.confidence >= CONF_LOCK)) {
      window.ruleEngine = res.lang;
      window.ruleEngineMode = "lock";
      return { ok: true, lang: res.lang, asked: false };
    }

    // If not confident but also not "mustAsk" (shouldn't happen), be safe and ask if possible
    if (window.__LangModal && typeof window.__LangModal.open === "function") {
      if (window.__LANG_MODAL_OPENING__ === true) return { ok: false, lang: "", asked: true };
      try {
        window.__LANG_MODAL_OPENING__ = true;
        window.__LangModal.open({
          uiLang: normalizePackLang(uiLang) || "en",
          detected: res && res.lang ? res.lang : "",
          confidence: res && typeof res.confidence === "number" ? res.confidence : null,
          candidates: Array.isArray(res && res.candidates) ? res.candidates.slice(0, 6) : ["zh", "de", "en"],
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
