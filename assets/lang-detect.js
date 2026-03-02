// =========================
// assets/lang-detect.js (NEW)
// Language detection orchestrator (franc-all + pack.detect + conservative fallback)
// - Exposes window.__LangDetect.detectLang(text, uiLang)
// - Optionally exposes ensureContentLang() for main.js pre-guard
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

  // Confidence thresholds
  const CONF_LOCK = 0.75;        // >= lock automatically
  const CONF_ASK = 0.70;         // < ask (modal)

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
    return {
      len,
      han,
      latin,
      umlauts,
      hanRatio: han / Math.max(1, len)
    };
  }

  // Strong signals (fast + stable). These are allowed here (NOT in engine.js).
  function strongHeuristic(text) {
    const s = safeStr(text);
    const st = stats(s);

    // Strong ZH
    if (st.hanRatio >= HAN_RATIO_ZH) {
      return { lang: "zh", confidence: 0.98, needsConfirm: false, candidates: ["zh"], reason: "han_ratio", source: "heuristic" };
    }

    // Strong DE
    if (st.umlauts >= UMLAUTS_DE) {
      return { lang: "de", confidence: 0.95, needsConfirm: false, candidates: ["de"], reason: "umlauts", source: "heuristic" };
    }
    if (/\b(Straße|Strasse|Herr|Frau|GmbH|Kontonummer|Ansprechpartner|Rechnung|Aktenzeichen|Rechnungsadresse|Lieferadresse|Geburtsdatum|USt-IdNr)\b/i.test(s)) {
      return { lang: "de", confidence: 0.92, needsConfirm: false, candidates: ["de"], reason: "de_keywords", source: "heuristic" };
    }

    // Strong EN (conservative)
    if (st.latin >= MIN_LATIN && /\b(Invoice|Order\s*ID|Account\s*Number|Username|Address|Phone|Email|Customer|Payment|Bank|Passport|SSN)\b/i.test(s)) {
      return { lang: "en", confidence: 0.88, needsConfirm: false, candidates: ["en"], reason: "en_keywords", source: "heuristic" };
    }

    return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "no_strong_signal", source: "heuristic" };
  }

  // franc-all gives ISO 639-3 code, e.g. "eng", "deu", "cmn"
  function detectByFranc(text) {
    try {
      const s = safeStr(text).trim();
      if (!s) return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "empty", source: "franc" };

      // ✅ Bundle export: window.FrLang.{franc, francAll}
      const F = window.FrLang || {};

      if (typeof F.franc !== "function") {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "franc_missing", source: "franc" };
      }

      // Too short => franc noisy; skip
      if (s.length < MIN_LEN) {
        return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "too_short_for_franc", source: "franc" };
      }

      let topIso3 = "";
      let secondIso3 = "";
      let confidence = 0.78;

      // If francAll exists, use top-2 as candidates, and compute a conservative confidence by gap
      if (typeof F.francAll === "function") {
        const all = F.francAll(s);
        if (Array.isArray(all) && all.length) {
          const top = all[0];
          const second = all[1];

          topIso3 = safeStr(top && top[0]);
          secondIso3 = safeStr(second && second[0]);

          const topScore = Number(top && top[1]);
          const secondScore = Number(second && second[1]);

          // NOTE: franc score meaning differs by build; use only as soft heuristic
          if (Number.isFinite(topScore) && Number.isFinite(secondScore)) {
            const gap = Math.max(0, secondScore - topScore);
            confidence = Math.max(0.62, Math.min(0.92, 0.62 + gap / 120));
          } else {
            confidence = 0.80;
          }
        }
      }

      if (!topIso3) {
        topIso3 = safeStr(F.franc(s));
        confidence = 0.78;
      }

      const topLang = normalizePackLang(ISO3_TO_PACK[topIso3] || "");
      const secondLang = normalizePackLang(ISO3_TO_PACK[secondIso3] || "");

      if (!topLang) {
        return {
          lang: "",
          confidence: 0,
          needsConfirm: true,
          candidates: uniq([secondLang]),
          reason: "franc_unmapped:" + topIso3,
          source: "franc"
        };
      }

      const candidates = uniq([topLang, secondLang]).filter(Boolean);

      // If close/low confidence => ask
      const needsConfirm = confidence < CONF_LOCK;

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

  function detectByPackDetect(text) {
    try {
      const packs = getPacks();
      const s = safeStr(text);
      const claims = [];

      // NOTE: pack.detect order is NOT a priority decision here; it is only a signal source.
      ["zh", "de", "en"].forEach((k) => {
        const p = packs[k];
        if (p && typeof p.detect === "function") {
          const r = normalizePackLang(p.detect(s));
          if (r) claims.push(r);
        }
      });

      const u = uniq(claims);

      if (u.length === 1) {
        return { lang: u[0], confidence: 0.76, needsConfirm: false, candidates: [u[0]], reason: "pack_detect_single", source: "pack" };
      }

      if (u.length >= 2) {
        return { lang: "", confidence: 0.55, needsConfirm: true, candidates: u.slice(0, 3), reason: "pack_detect_conflict", source: "pack" };
      }

      return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "pack_detect_none", source: "pack" };
    } catch (e) {
      return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "pack_detect_error", source: "pack" };
    }
  }

  // Primary API used by engine.js external hook:
  // Returns: { lang, confidence, needsConfirm, candidates, reason, source }
  API.detectLang = function detectLang(text, uiLang) {
    const s = safeStr(text);

    // 0) quick empty
    const trimmed = s.trim();
    if (!trimmed) {
      return { lang: "", confidence: 0, needsConfirm: false, candidates: [], reason: "empty", source: "none" };
    }

    // 1) Strong heuristic
    const h = strongHeuristic(trimmed);
    if (h.lang) return h;

    // 2) franc
    const f = detectByFranc(trimmed);
    if (f.lang) return f;

    // 3) pack.detect
    const p = detectByPackDetect(trimmed);
    if (p.lang || (p.candidates && p.candidates.length)) return p;

    // 4) last fallback: UI lang as suggestion, but ask
    const u = normalizePackLang(uiLang);
    if (u) {
      return { lang: u, confidence: 0.55, needsConfirm: true, candidates: [u], reason: "fallback_ui_lang", source: "fallback" };
    }

    return { lang: "", confidence: 0, needsConfirm: true, candidates: [], reason: "unknown", source: "fallback" };
  };

  // Optional pre-guard for main.js:
  // - If uncertain: open modal once and return ok=false (caller should stop)
  // - If certain: lock ruleEngine and return ok=true
  // - If already locked: ok=true
  API.ensureContentLang = function ensureContentLang(text, uiLang) {
    const s = safeStr(text).trim();
    if (!s) return { ok: true, lang: "", asked: false };

    // Already locked
    if (safeStr(window.ruleEngineMode).toLowerCase() === "lock" && safeStr(window.ruleEngine)) {
      return { ok: true, lang: safeStr(window.ruleEngine), asked: false };
    }

    const res = API.detectLang(s, uiLang);

    // If needs confirm -> open modal (once) and stop
    if (res && res.needsConfirm) {
      // prevent double-open (engine hook / main guard)
      if (window.__LANG_MODAL_OPENING__) {
        return { ok: false, lang: "", asked: true };
      }

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

              // Mirror old naming (compat)
              window.contentLang = L;
              window.contentLangMode = "lock";

              // clear flag
              window.__LANG_MODAL_OPENING__ = false;

              // rerun immediately
              try {
                const ta = document.getElementById("inputText");
                const v = ta ? String(ta.value || "") : s;
                if (typeof window.applyRules === "function") window.applyRules(v);
              } catch (_) {}
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
      window.contentLang = res.lang;
      window.contentLangMode = "lock";
      return { ok: true, lang: res.lang, asked: false };
    }

    // If res.lang exists but not confident, still ask (best safety)
    if (res && res.lang) {
      return API.ensureContentLang(s, uiLang); // will open modal due to needsConfirm
    }

    return { ok: true, lang: "", asked: false };
  };

})();
