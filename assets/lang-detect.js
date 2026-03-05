// =========================
// assets/lang-detect.js (FULL)
// v20260304a2 — PATCHED (remove umlaut->de + short_latin modal only when NOT confident)
// Language detection orchestrator (franc-all + pack.detect + conservative fallback)
// - Exposes window.__LangDetect.detectLang(text, uiLang)
// - Exposes ensureContentLang() for main.js pre-guard
//
// IMPORTANT (project principle):
// - Primary basis: franc-all (franc/francAll)
// - If franc can't decide confidently => modal for user pick
// - Content strategy language MUST be single source of truth: window.ruleEngine / window.ruleEngineMode
// - DO NOT write/read legacy window.contentLang/window.contentLangMode here
// =========================
(function () {
  "use strict";

  // Expose singleton
  const API = (window.__LangDetect = window.__LangDetect || {});
  API.__state = API.__state || { ver: "v20260304a2-franc-priority", last: null };
  API.__state.ver = "v20260304a2-franc-priority";

  // ---- Config (conservative) ----
  const MIN_LEN_FRANC = 40;      // shorter than this: franc is noisy
  const MIN_LATIN = 12;          // require some letters for en/de
  const HAN_RATIO_ZH = 0.02;     // Han chars ratio >= 2% => strong zh

  // Confidence thresholds
  const CONF_LOCK = 0.78;        // >= lock automatically

  // Extra safety: short Latin text can be ambiguous EN/DE
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

    // NOTE: still measured but NOT used as auto-DE decision anymore
    const umlauts = (s.match(/[äöüÄÖÜß]/g) || []).length;

    // keyword signals (used ONLY here, not in engine.js)
    const hasDeKw = /\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Geburtsdatum|USt-IdNr)\b/i.test(s);
    const hasEnKw = /\b(Invoice|Order\s*ID|Account\s*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s);

    // DE function words: indicator for German prose even without keywords
    const deFnWords = (s.match(/\b(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|nicht|ich|sie|wir|ihr|Sie|mit|für|auf|bei|von|zum|zur|im|am|aus|auch|wird|werden|bitte|danke)\b/gi) || []).length;

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

  // Strong signals (fast + stable). Allowed here (NOT in engine.js).
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

    // ✅ IMPORTANT CHANGE (A2):
    // ❌ Removed: "umlaut/ß => de"
    // Principle: rely on franc for DE/EN when ambiguous; umlaut-only shortcut can mis-route by design.

    // Strong DE by keywords
    if (st.hasDeKw) {
      // if also has strong EN keywords -> mixed => ask
      if (st.hasEnKw) {
        return {
          lang: "",
          confidence: 0.60,
          needsConfirm: true,
          candidates: ["de", "en"],
          reason: "mixed_de_en_keywords",
          source: "heuristic"
        };
      }
      return {
        lang: "de",
        confidence: 0.92,
        needsConfirm: false,
        candidates: ["de"],
        reason: "de_keywords",
        source: "heuristic"
      };
    }

    // Strong DE by function words (German prose)
    if (st.deFnWords >= 2 && st.latin >= MIN_LATIN) {
      return {
        lang: "de",
        confidence: 0.86,
        needsConfirm: false,
        candidates: ["de"],
        reason: "de_function_words",
        source: "heuristic"
      };
    }

    // Strong EN by keywords
    if (st.latin >= MIN_LATIN && st.hasEnKw) {
      return {
        lang: "en",
        confidence: 0.88,
        needsConfirm: false,
        candidates: ["en"],
        reason: "en_keywords",
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

      // ✅ PATCH: do NOT derive confidence from score-gap (score semantics differ by build)
      // Use a conservative-but-stable confidence scheme:
      // - if franc provides a mapped topLang, default confidence >= CONF_LOCK
      // - if candidates include both en & de => force confirm
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
        // keep confidence default 0.86
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

      // ✅ PATCH: if en/de ambiguity exists -> modal
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

      // normal path: confident enough to lock
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

  // ✅ short-latin ambiguity trigger (STRICT + aligned to principle)
  // Only ask if:
  // - short Latin content
  // - AND franc/pack is NOT confident enough to lock (confidence < CONF_LOCK)
  // - AND candidates show EN/DE ambiguity
  // - AND no strong keyword / DE function words / ZH
  function shouldAskShortLatin(st, res) {
    if (!st) return false;

    if (!(st.hanRatio < HAN_RATIO_ZH && st.latin >= MIN_LATIN && st.len <= SHORT_LATIN_AMBIG_LEN)) return false;

    // strong signals -> don't ask here
    if (st.hasDeKw || st.hasEnKw) return false;
    if (st.deFnWords >= 2) return false;

    const conf = typeof (res && res.confidence) === "number" ? res.confidence : 0;
    if (conf >= CONF_LOCK) return false; // ✅ key fix: confident => no modal

    const cand = Array.isArray(res && res.candidates) ? res.candidates : [];
    const hasBoth = cand.includes("en") && cand.includes("de");

    // Only ask if EN/DE ambiguity is real
    if (hasBoth) return true;

    return false;
  }

  // Primary API:
  // Returns: { lang, confidence, needsConfirm, candidates, reason, source }
  API.detectLang = function detectLang(text, uiLang) {
    const trimmed = safeStr(text).trim();
    if (!trimmed) return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "none" };

    const st = stats(trimmed);

    // 1) Strong heuristic first (ZH, DE keywords/fnwords, EN keywords)
    const h = strongHeuristic(trimmed);
    if (h.lang) return h;
    if (h.needsConfirm && (h.candidates && h.candidates.length)) return h;

    // 2) franc (PRIMARY)
    const f = detectByFranc(trimmed);
    if (f.lang || (f.candidates && f.candidates.length)) {
      // ✅ If franc is confident enough to lock, NEVER force short-latin modal
      if (f.lang && typeof f.confidence === "number" && f.confidence >= CONF_LOCK && f.needsConfirm === false) {
        return f;
      }

      // Otherwise, apply short-latin ambiguity rule (only when not confident)
      if (shouldAskShortLatin(st, f) && (f.lang === "en" || f.lang === "de")) {
        return {
          lang: f.lang,
          confidence: Math.min(f.confidence || 0.7, 0.74),
          needsConfirm: true,
          candidates: uniq([f.lang, "en", "de"]).filter(Boolean),
          reason: "short_latin_ambiguous",
          source: "rule"
        };
      }
      return f;
    }

    // 3) pack.detect (secondary)
    const p = detectByPackDetect(trimmed);
    if (p.lang || (p.candidates && p.candidates.length)) {
      if (shouldAskShortLatin(st, p) && (p.lang === "en" || p.lang === "de")) {
        return {
          lang: p.lang,
          confidence: Math.min(p.confidence || 0.7, 0.74),
          needsConfirm: true,
          candidates: uniq([p.lang, "en", "de"]).filter(Boolean),
          reason: "short_latin_ambiguous_pack",
          source: "rule"
        };
      }
      return p;
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

    // ✅ PATCH: do NOT open modal "just to be safe" when we already have a lang.
    // Only ask here when lang is empty (unknown) and modal exists.
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
