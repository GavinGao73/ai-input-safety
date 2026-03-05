// =========================
// assets/lang-detect.js (FULL)
// v20260305a1 — PATCHED (FRANC-ONLY decision; no umlaut/keywords/pack.detect auto-lang)
// Language detection orchestrator (franc-all primary; modal on uncertainty)
//
// ✅ PRINCIPLE (hard):
// - ONLY franc determines language automatically.
// - If franc is uncertain/unmapped/too-short/missing => open modal (user chooses).
// - NO heuristic (äöüß / keywords / function words) is allowed to auto-pick lang.
// - pack.detect may ONLY contribute candidates for modal; never auto-pick.
// - Content strategy language single source of truth: window.ruleEngine / window.ruleEngineMode
// - DO NOT write/read legacy window.contentLang/window.contentLangMode here
// =========================
(function () {
  "use strict";

  // Expose singleton
  const API = (window.__LangDetect = window.__LangDetect || {});
  API.__state = API.__state || { ver: "v20260305a1-franc-only", last: null };
  API.__state.ver = "v20260305a1-franc-only";

  // ---- Config (conservative) ----
  const MIN_LEN_FRANC = 40;      // shorter than this: franc is noisy => modal
  const MIN_LATIN = 12;          // used only for candidate hinting
  const HAN_RATIO_ZH = 0.02;     // used only for candidate hinting

  // Confidence thresholds
  const CONF_LOCK = 0.78;        // >= lock automatically (ONLY when source=franc)

  // Extra safety: short Latin text can be ambiguous EN/DE -> modal if not confident
  const SHORT_LATIN_AMBIG_LEN = 120;

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
    const umlauts = (s.match(/[äöüÄÖÜß]/g) || []).length;

    // NOTE: Keywords/function words are kept ONLY as "hint signals" for modal candidates.
    // They MUST NOT directly decide lang.
    const hasDeKw =
      /\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Geburtsdatum|USt-IdNr)\b/i.test(
        s
      );
    const hasEnKw =
      /\b(Invoice|Order\s*ID|Account\s*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(
        s
      );

    const deFnWords =
      (s.match(
        /\b(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|nicht|ich|sie|wir|ihr|Sie|mit|für|auf|bei|von|zum|zur|im|am|aus|auch|wird|werden|bitte|danke)\b/gi
      ) || []).length;

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

  // ✅ Candidate hinting ONLY (never returns a final lang)
  function hintCandidates(text) {
    const s = safeStr(text);
    const st = stats(s);

    const c = [];

    // Strong-looking ZH (visual signal) => suggest zh for modal
    if (st.hanRatio >= HAN_RATIO_ZH) c.push("zh");

    // If franc is missing/too short/unmapped, umlaut/ß may suggest de (candidate only)
    if (st.umlauts > 0) c.push("de");

    // Keyword hints (candidate only)
    if (st.hasDeKw) c.push("de");
    if (st.hasEnKw) c.push("en");

    // German function words hint (candidate only)
    if (st.deFnWords >= 2 && st.latin >= MIN_LATIN) c.push("de");

    return uniq(c).filter(Boolean);
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
        return {
          lang: "",
          confidence: 0,
          needsConfirm: true,
          candidates: [],
          reason: "too_short_for_franc",
          source: "franc"
        };
      }

      let topIso3 = "";
      let secondIso3 = "";
      let confidence = 0.78;

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
        confidence = 0.78;
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

      // decide confirm policy (still franc-only)
      let needsConfirm = confidence < CONF_LOCK;

      // extra conservative for EN/DE ambiguity
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

  // pack.detect can ONLY contribute candidates for modal; never auto-lang
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
    } catch (e) {
      return [];
    }
  }

  // ✅ short-latin ambiguity trigger (strict)
  // This only affects "needsConfirm" (modal), never forces a language.
  function shouldAskShortLatin(st, res) {
    if (!st) return false;
    if (!(st.hanRatio < HAN_RATIO_ZH && st.latin >= MIN_LATIN && st.len <= SHORT_LATIN_AMBIG_LEN)) return false;

    const cand = Array.isArray(res && res.candidates) ? res.candidates : [];
    const hasBoth = cand.includes("en") && cand.includes("de");
    const conf = typeof (res && res.confidence) === "number" ? res.confidence : 0.7;

    if (hasBoth) return true;
    if ((res && (res.lang === "en" || res.lang === "de")) && conf < 0.85) return true;

    return false;
  }

  // Primary API:
  // Returns: { lang, confidence, needsConfirm, candidates, reason, source }
  API.detectLang = function detectLang(text, uiLang) {
    const trimmed = safeStr(text).trim();
    if (!trimmed) return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "none" };

    const st = stats(trimmed);

    // 1) franc FIRST (single authority)
    const f = detectByFranc(trimmed);

    // 1.1) If franc produced a mapped lang OR candidates, return it (possibly needsConfirm)
    if (f && (f.lang || (f.candidates && f.candidates.length))) {
      // Extra strict: short latin ambiguous -> needsConfirm (still franc-based)
      if (shouldAskShortLatin(st, f) && (f.lang === "en" || f.lang === "de")) {
        return {
          lang: f.lang, // NOTE: still informational; auto-lock only when confidence>=CONF_LOCK in ensureContentLang()
          confidence: Math.min(typeof f.confidence === "number" ? f.confidence : 0.7, 0.74),
          needsConfirm: true,
          candidates: uniq([f.lang, "en", "de"]).filter(Boolean),
          reason: "short_latin_ambiguous",
          source: "rule"
        };
      }
      return f;
    }

    // 2) If franc failed/unmapped/too-short/missing => modal candidates from:
    // - franc candidates (if any)
    // - pack.detect candidates (candidate-only)
    // - heuristic hints (candidate-only)
    const c1 = (f && Array.isArray(f.candidates) ? f.candidates : []).slice(0, 3);
    const c2 = detectByPackDetectCandidates(trimmed);
    const c3 = hintCandidates(trimmed);

    const cand = uniq([].concat(c1, c2, c3)).filter(Boolean);

    // 3) last fallback: follow UI but ALWAYS ASK (safe)
    const u = normalizePackLang(uiLang);
    if (u && !cand.includes(u)) cand.push(u);

    return {
      lang: "",                    // ✅ important: unknown until user picks
      confidence: 0,
      needsConfirm: true,
      candidates: cand.slice(0, 6),
      reason: (f && f.reason) ? ("franc_fail:" + f.reason) : "franc_fail",
      source: "fallback"
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

  function openLangModal({ uiLang, detected, confidence, candidates, reason, textForRerun }) {
    if (window.__LANG_MODAL_OPENING__ === true) return false;
    if (!window.__LangModal || typeof window.__LangModal.open !== "function") return false;

    try {
      window.__LANG_MODAL_OPENING__ = true;

      window.__LangModal.open({
        uiLang: normalizePackLang(uiLang) || "en",
        detected: detected || "",
        confidence: typeof confidence === "number" ? confidence : null,
        candidates: Array.isArray(candidates) ? candidates.slice(0, 6) : [],
        reason: reason || "",
        onPick: function (lang) {
          const L = normalizePackLang(lang);
          if (!L) return;

          window.ruleEngine = L;
          window.ruleEngineMode = "lock";

          window.__LANG_MODAL_OPENING__ = false;

          rerunAfterPick(textForRerun);
        },
        onClose: function () {
          window.__LANG_MODAL_OPENING__ = false;
        }
      });

      return true;
    } catch (_) {
      try { window.__LANG_MODAL_OPENING__ = false; } catch (_) {}
      return false;
    }
  }

  // Pre-guard for main.js:
  // - If uncertain: open modal and return ok=false
  // - If franc is confident enough: lock ruleEngine and return ok=true
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
      const opened = openLangModal({
        uiLang,
        detected: res.lang || "",
        confidence: typeof res.confidence === "number" ? res.confidence : null,
        candidates: Array.isArray(res.candidates) ? res.candidates : [],
        reason: res.reason || "",
        textForRerun: s
      });

      return { ok: false, lang: "", asked: !!opened };
    }

    // ✅ Auto lock ONLY when source=franc AND confidence>=CONF_LOCK AND lang is valid
    if (res && res.source === "franc" && res.lang && (typeof res.confidence !== "number" || res.confidence >= CONF_LOCK)) {
      const L = normalizePackLang(res.lang);
      if (L) {
        window.ruleEngine = L;
        window.ruleEngineMode = "lock";
        return { ok: true, lang: L, asked: false };
      }
    }

    // Otherwise: safe ask if modal exists (do NOT lock from non-franc sources)
    const opened2 = openLangModal({
      uiLang,
      detected: (res && res.lang) ? res.lang : "",
      confidence: res && typeof res.confidence === "number" ? res.confidence : null,
      candidates: Array.isArray(res && res.candidates) ? res.candidates : [],
      reason: (res && res.reason) ? ("ask_fallback:" + res.reason) : "ask_fallback",
      textForRerun: s
    });

    if (opened2) return { ok: false, lang: "", asked: true };

    return { ok: true, lang: "", asked: false };
  };

})();
