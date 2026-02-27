// =========================
// assets/engine.js (FULL)  ✅ PATCHED
// ROUTER + STABLE CORE (no lang rules/priority/alwaysOn/formatters inside)
// - UI language: window.currentLang (UI only)
// - Content strategy language: window.ruleEngine (+ window.ruleEngineMode)
//
// ✅ GOAL:
// - auto only runs ONCE when ruleEngine=="" (first real applyRules after boot/Clear)
// - then lock (no drift)
// - Clear resets to (mode=auto, ruleEngine="")
//
// ✅ ISOLATION (HARD):
// - NO zh/en/de rules/priority/alwaysOn/formatters in engine.js
// - ALL language-specific logic must live in packs: window.__ENGINE_LANG_PACKS__[lang]
// - ALL non-language strategy must live in window.__ENGINE_POLICY__
//
// ✅ PATCHES (this file):
// - P1: Prefix-mode replacement preserves trailing whitespace/newlines (prevents line-merge when a pack regex accidentally eats \n)
// - P2: Placeholder protection ONLY shields engine-generated placeholders (avoid protecting arbitrary [..] such as Markdown links)
// - P3: NEW mode "prefix_keep_tail": keep tail unmasked (needed for DE street-only masking while keeping PLZ/City/Country)
// - P4: Export enabledKeys MUST include ALWAYS_ON (safer & consistent with execution)
// =========================

// ✅ FIX: version string aligned with deployed query param (?v=20260224a1)
console.log("[engine.js] loaded v20260224a1-engine-a5-policy-split");

"use strict";

/* =========================
   DETECTION_ITEMS write-trace (BOOT EARLY)
   - capture who sets window.DETECTION_ITEMS
   - re-init enabled after each set
   - ✅ FIX: even if initEnabled is not ready yet, schedule a deferred init
   - ✅ FIX: DO NOT self-assign window.DETECTION_ITEMS (prevents "last set" being polluted by engine.js)
   ========================= */
(function traceDetectionItemsBoot() {
  try {
    if (window.__TRACE_DETECTION_ITEMS_BOOT__) return;
    window.__TRACE_DETECTION_ITEMS_BOOT__ = true;

    let _v = window.DETECTION_ITEMS;

    Object.defineProperty(window, "DETECTION_ITEMS", {
      configurable: true,
      enumerable: true,
      get() {
        return _v;
      },
      set(v) {
        _v = v;

        // store for later inspection (even if console is noisy)
        try {
          window.__DETECTION_ITEMS_LAST_SET__ = {
            when: Date.now(),
            iso: new Date().toISOString(),
            valueShape: v && typeof v === "object" ? Object.keys(v) : null,
            stack: (new Error("DETECTION_ITEMS set")).stack || ""
          };
        } catch (_) {}

        // visible trace (optional but useful)
        try {
          console.warn("[DETECTION_ITEMS SET]", "time=", new Date().toISOString());
          console.trace("[DETECTION_ITEMS SET TRACE]");
        } catch (_) {}

        // keep enabled in sync (defer to survive load order)
        try {
          setTimeout(() => {
            try {
              if (typeof initEnabled === "function") initEnabled();
              else if (typeof window.initEnabled === "function") window.initEnabled();
            } catch (_) {}
          }, 0);
        } catch (_) {}
      }
    });

    // ✅ If DETECTION_ITEMS already existed before hook:
    // DO NOT write it back (would pollute "last set" stack with engine.js).
    // Instead: do a best-effort deferred init only.
    try {
      if (_v && typeof _v === "object") {
        setTimeout(() => {
          try {
            if (typeof initEnabled === "function") initEnabled();
            else if (typeof window.initEnabled === "function") window.initEnabled();
          } catch (_) {}
        }, 0);
      }
    } catch (_) {}
  } catch (_) {}
})();

/* =========================
   0) Policy access (NON-language)
   ========================= */

function getPolicy() {
  return window.__ENGINE_POLICY__ || {};
}

function normLang(l) {
  const s = String(l || "").toLowerCase();
  return s === "en" || s === "de" || s === "zh" ? s : "";
}

/* =========================
   1) Language helpers (UI vs Content Strategy)
   ========================= */

function getLangUI() {
  return normLang(window.currentLang) || "zh";
}

/**
 * Content strategy language (rules/placeholder), NOT UI language.
 * - if ruleEngine set -> use it
 * - else -> fallback to UI (display only until one-shot detect)
 */
function getLangContent() {
  const v = normLang(window.ruleEngine);
  return v || getLangUI();
}

/**
 * RULE C: Clear resets content strategy language to first-enter start.
 */
function resetRuleEngine() {
  try {
    window.ruleEngine = "";
    window.ruleEngineMode = "auto";

    // ✅ compatibility: keep old names in sync
    try {
      window.contentLang = "";
      window.contentLangMode = "auto";
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("ruleengine:changed", { detail: { lang: getLangContent() } }));
    } catch (_) {}
  } catch (_) {}
}

// Backward compatible name (main.js may call this)
function resetContentLang() {
  resetRuleEngine();
}

/**
 * One-shot auto detect, only when:
 * - mode=auto AND ruleEngine==""
 * After detect: lock.
 */
function setRuleEngineAuto(text) {
  try {
    const mode = String(window.ruleEngineMode || "auto").toLowerCase();
    if (mode !== "auto") return;

    if (normLang(window.ruleEngine)) {
      window.ruleEngineMode = "lock";

      // ✅ compatibility: lock old names too
      try {
        window.contentLang = window.ruleEngine;
        window.contentLangMode = "lock";
      } catch (_) {}

      return;
    }

    const detected = detectRuleEngine(text);
    if (!detected) return;

    window.ruleEngine = detected;
    window.ruleEngineMode = "lock";

    // ✅ compatibility: keep old names in sync
    try {
      window.contentLang = detected;
      window.contentLangMode = "lock";
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("ruleengine:changed", { detail: { lang: detected } }));
    } catch (_) {}
  } catch (_) {}
}

// Compatibility wrapper (old name used in applyRules)
function setLangContentAuto(text) {
  setRuleEngineAuto(text);
}

/* =========================
   1.0) Detection helper (score-based; pack-owned logic)
   - Engine remains language-agnostic: it only asks packs for scores.
   ========================= */

function detectByPackScore(pack, langKey, text) {
  try {
    if (!pack || typeof pack !== "object") return null;

    // New API: detectScore()
    if (typeof pack.detectScore === "function") {
      const r = pack.detectScore(text);
      if (!r || typeof r !== "object") return null;

      const lang = normLang(r.lang || langKey);
      const score = Number(r.score);
      const confidence = Number(r.confidence);

      if (!lang || !Number.isFinite(score)) return null;

      return {
        lang,
        score: clamp(score, 0, 100),
        confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : null,
        signals: Array.isArray(r.signals) ? r.signals.slice(0, 10) : []
      };
    }

    // Old API: detect() -> treat as weak evidence (compat)
    if (typeof pack.detect === "function") {
      const r = normLang(pack.detect(text));
      if (r === langKey) return { lang: langKey, score: 60, confidence: 0.6, signals: ["legacy_detect"] };
      return { lang: langKey, score: 0, confidence: 0, signals: [] };
    }

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Detect content strategy language:
 * - ask pack detectors only
 * - fallback via policy (no char-heuristics here)
 */
/**
 * Detect content strategy language:
 * - ask pack detectors only (now score-based)
 * - fallback via policy (no char-heuristics here)
 */
function detectRuleEngine(text) {
  const s0 = String(text || "");
  const s = s0.slice(0, 2600);
  if (!s.trim()) return "";

  const PACKS = getPacks();
  const pol = getPolicy();
  const det = (pol && pol.detect) || {};

  // policy-driven thresholds (engine remains language-agnostic)
  const TH_LOCK = Number(det.lockScore ?? 72); // must be strong enough to lock
  const GAP = Number(det.minGap ?? 14);        // winner must beat runner-up
  const ALLOW_MIXED = det.allowMixed !== false; // default true
  const MIXED_LANG = String(det.mixedLang || ""); // "" recommended = do not set ruleEngine

  const cand = [];
  const z = detectByPackScore(PACKS.zh, "zh", s);
  const e = detectByPackScore(PACKS.en, "en", s);
  const d = detectByPackScore(PACKS.de, "de", s);
  if (z) cand.push(z);
  if (e) cand.push(e);
  if (d) cand.push(d);

  // If packs provide no usable detection, fallback policy
  if (!cand.length) {
    const fb = String(pol.detectFallback || "en").toLowerCase();
    if (fb === "ui") return getLangUI();
    if (fb === "zh" || fb === "de" || fb === "en") return fb;
    return "en";
  }

  cand.sort((a, b) => (b.score - a.score) || ((b.confidence || 0) - (a.confidence || 0)));

  const best = cand[0];
  const second = cand[1] || { score: 0, confidence: 0 };

  const strongEnough = best.score >= TH_LOCK;
  const gapEnough = best.score - second.score >= GAP;

  // ✅ lock only when strong + distinct
  if (strongEnough && gapEnough) return best.lang;

  // ✅ mixed fallback: keep engine neutral (no lock)
  if (ALLOW_MIXED) return normLang(MIXED_LANG) || "";

  // if mixed disabled, pick best anyway
  return best.lang;
}

/* =========================
   1.1) Pack accessors
   ========================= */

function getPacks() {
  return window.__ENGINE_LANG_PACKS__ || {};
}

function getContentPack() {
  const PACKS = getPacks();
  const lang = getLangContent();
  return PACKS[lang] || null;
}

function getUiPack() {
  const PACKS = getPacks();
  const lang = getLangUI();
  return PACKS[lang] || null;
}

// rules are loaded ONLY from language packs
function getRulesSafe() {
  const pack = getContentPack();
  const rules = pack && pack.rules && typeof pack.rules === "object" ? pack.rules : null;
  return rules && Object.keys(rules).length ? rules : null;
}

/* =========================
   2) Core state (language-agnostic)
   ========================= */

const enabled = new Set();

// ✅ Money protection always ON (M1). No UI selector.
let moneyMode = "m1";
window.__safe_moneyMode = moneyMode;

let lastOutputPlain = "";

// ================= Stage 3 state =================
let lastUploadedFile = null; // File object (pdf or image)
let lastFileKind = ""; // "pdf" | "image" | ""
let lastProbe = null; // { hasTextLayer, text }
let lastPdfOriginalText = ""; // extracted text for readable PDF
let lastStage3Mode = "none"; // "A" | "B" | "none"

// store manual redaction session/result (Mode B export via main button)
let __manualRedactSession = null;
let __manualRedactResult = null;

// ================= Manual terms =================
let manualTerms = [];

function normalizeTerm(s) {
  return String(s || "").trim();
}

/**
 * - split by comma/newline/;、 etc
 * - dedup case-insensitive
 * - cap 24
 */
function setManualTermsFromText(raw) {
  const s = String(raw || "");
  const parts = s
    .split(/[\n\r,，;；、]+/g)
    .map(normalizeTerm)
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  manualTerms = out.slice(0, 24);
}

function show(el, yes) {
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

function isSmallScreen() {
  try {
    return !!(window.matchMedia && window.matchMedia("(max-width: 560px)").matches);
  } catch (_) {
    return false;
  }
}

// --- Risk scoring meta ---
let lastRunMeta = {
  fromPdf: false,
  inputLen: 0,
  enabledCount: 0,
  moneyMode: "m1",
  langUI: "zh",
  langContent: "zh"
};

function $(id) {
  return document.getElementById(id);
}

function escapeHTML(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ================= ENABLED KEYS FOR EXPORT =================
// ✅ PATCH P4: export enabledKeys MUST include ALWAYS_ON (policy + pack)
// - enabled = UI-selected defaults/toggles
// - ALWAYS_ON = enforced coverage regardless of UI
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"]; // keep as-is (your build choice)

  const base = new Set(Array.from(enabled || []));

  // include always-on keys (policy + pack)
  try {
    const ALWAYS_ON = getAlwaysOnSet();
    if (ALWAYS_ON && typeof ALWAYS_ON.forEach === "function") {
      ALWAYS_ON.forEach((k) => base.add(k));
    }
  } catch (_) {}

  for (const k of MUST_INCLUDE) base.add(k);
  return Array.from(base);
}

// ================= placeholders (follow CONTENT STRATEGY language) =================
function placeholder(key) {
  const pack = getContentPack() || (getPacks().zh || null);
  const table = pack && pack.placeholders ? pack.placeholders : null;

  if (table && table[key]) return table[key];

  // last resort
  const fallback = {
    PHONE: "[Phone]",
    EMAIL: "[Email]",
    URL: "[URL]",
    SECRET: "[Secret]",
    ACCOUNT: "[Account]",
    ADDRESS: "[Address]",
    HANDLE: "[Handle]",
    REF: "[Ref]",
    TITLE: "[Title]",
    NUMBER: "[Number]",
    MONEY: "[Amount]",
    COMPANY: "[Company]",
    TERM: "[REDACTED]"
  };
  return fallback[key] || `[${key}]`;
}

// ================= output render =================
function renderOutput(outPlain) {
  lastOutputPlain = String(outPlain || "");
  const host = $("outputText");
  if (!host) return;

  const html = escapeHTML(lastOutputPlain).replace(
    /(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g,
    `<span class="hl">$1</span>`
  );

  host.innerHTML = html;
}

// ================= input watermark hide =================
function updateInputWatermarkVisibility() {
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!ta || !wrap) return;
  const has = String(ta.value || "").trim().length > 0;
  wrap.classList.toggle("has-content", has);
}

// ================= Manual terms masking =================
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function makeLatinTermRegex(term) {
  const n = escapeRegExp(term);
  return new RegExp(`\\b${n}\\b`, "gi");
}
function makeCjkTermRegex(term) {
  const n = escapeRegExp(term);
  return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${n})(?=$|[^\\u4E00-\\u9FFF])`, "g");
}

function applyManualTermsMask(out, addHit) {
  if (!manualTerms || !manualTerms.length) return out;

  let s = String(out || "");
  for (const tm of manualTerms) {
    if (!tm) continue;

    const hasCjk = /[\u4E00-\u9FFF]/.test(tm);
    if (hasCjk) {
      const re = makeCjkTermRegex(tm);
      s = s.replace(re, (m, p1) => {
        if (typeof addHit === "function") addHit("manual_term");
        return `${p1}${placeholder("TERM")}`;
      });
    } else {
      const re = makeLatinTermRegex(tm);
      s = s.replace(re, () => {
        if (typeof addHit === "function") addHit("manual_term");
        return placeholder("TERM");
      });
    }
  }
  return s;
}

/* =========================
   3) Policy-driven execution (NON-language strategy read from policy)
   ========================= */

function getAlwaysOnSet() {
  const pol = getPolicy();
  const baseArr = Array.isArray(pol.baseAlwaysOn) ? pol.baseAlwaysOn : [];
  const base = new Set(baseArr);

  const pack = getContentPack();
  const extra = pack && pack.alwaysOn ? pack.alwaysOn : null;

  if (Array.isArray(extra)) {
    for (const k of extra) base.add(k);
  } else if (extra && typeof extra.forEach === "function") {
    try {
      extra.forEach((k) => base.add(k));
    } catch (_) {}
  }
  return base;
}

function getPriority() {
  const pack = getContentPack();
  if (pack && Array.isArray(pack.priority) && pack.priority.length) return pack.priority.slice(0);

  const pol = getPolicy();
  const fb = Array.isArray(pol.defaultPriority) ? pol.defaultPriority : [];
  return fb.slice(0);
}

function phoneGuardOk({ label, value, match }) {
  const pack = getContentPack();
  if (pack && typeof pack.phoneGuard === "function") {
    try {
      return !!pack.phoneGuard({ label, value, match });
    } catch (_) {
      return true;
    }
  }

  const pol = getPolicy();
  if (pol && typeof pol.phoneGuardDefault === "function") {
    try {
      return !!pol.phoneGuardDefault({ label, value, match });
    } catch (_) {
      return true;
    }
  }

  // last resort safe permissive
  return true;
}

/* =========================
   4) PDF overlay highlight (language hooks in packs)
   ========================= */

function renderInputOverlayForPdf(originalText) {
  const overlay = $("inputOverlay");
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!overlay || !ta || !wrap) return;

  if (!lastRunMeta.fromPdf) {
    overlay.innerHTML = "";
    wrap.classList.remove("pdf-overlay-on");
    return;
  }

  const marked = markHitsInOriginal(originalText);
  overlay.innerHTML = marked;

  wrap.classList.add("pdf-overlay-on");

  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;
}

function markHitsInOriginal(text) {
  let s = String(text || "");
  const S1 = "⟦HIT⟧";
  const S2 = "⟦/HIT⟧";

  const snap = window.__export_snapshot || null;
  const enabledKeysArr = snap && Array.isArray(snap.enabledKeys) ? snap.enabledKeys : Array.from(enabled || []);
  const enabledSet = new Set(enabledKeysArr);

  // manual terms highlight
  if (manualTerms && manualTerms.length) {
    for (const tm of manualTerms) {
      const hasCjk = /[\u4E00-\u9FFF]/.test(tm);
      if (hasCjk) {
        const re = makeCjkTermRegex(tm);
        s = s.replace(re, (m, p1, p2) => `${p1}${S1}${p2}${S2}`);
      } else {
        const re = makeLatinTermRegex(tm);
        s = s.replace(re, (m) => `${S1}${m}${S2}`);
      }
    }
  }

  const rules = getRulesSafe();
  const PRIORITY = getPriority();
  const ALWAYS_ON = getAlwaysOnSet();
  const pack = getContentPack();

  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key) && !ALWAYS_ON.has(key)) continue;

    const r = rules && rules[key];
    if (!r || !r.pattern) continue;

    if (r.mode === "prefix") {
      s = s.replace(r.pattern, (m, p1, p2) => {
        const label = p1 || "";
        const val = p2 || "";
        return `${label}${S1}${val}${S2}`;
      });
      continue;
    }

    // ✅ P3: prefix_keep_tail (highlight ONLY the masked segment, keep tail as normal)
    if (r.mode === "prefix_keep_tail") {
      s = s.replace(r.pattern, (m, p1, p2, p3) => {
        const label = p1 || "";
        const toMask = p2 || "";
        const tail = p3 || "";
        return `${label}${S1}${toMask}${S2}${tail}`;
      });
      continue;
    }

    if (r.mode === "address_cn_partial") {
      s = s.replace(r.pattern, (m, p1, p2) => {
        const label = p1 || "";
        const val = p2 || "";
        if (pack && typeof pack.highlightAddressCnPartial === "function") {
          try {
            const res = pack.highlightAddressCnPartial({ label, val, S1, S2, match: m });
            if (typeof res === "string" && res) return res;
          } catch (_) {}
        }
        return `${label}${S1}${val}${S2}`;
      });
      continue;
    }

    if (r.mode === "phone") {
      s = s.replace(r.pattern, (m, p1, p2, p3, p4) => {
        const label = p1 || "";
        const value = p2 || p3 || p4 || m;
        if (!phoneGuardOk({ label, value, match: m })) return m;

        if (label) return `${label}${S1}${m.slice(label.length)}${S2}`;
        return `${S1}${m}${S2}`;
      });
      continue;
    }

    if (r.mode === "company") {
      s = s.replace(r.pattern, (...args) => {
        const match = String(args[0] || "");
        const punctMatch = match.match(/[。．.，,;；!！?？)）】\]\s]+$/u);
        const punct = punctMatch ? punctMatch[0] : "";
        const coreStr = punct ? match.slice(0, -punct.length) : match;

        const groups = args[args.length - 1];
        const legal = groups && typeof groups === "object" && groups.legal ? String(groups.legal) : "";
        const name = groups && typeof groups === "object" && groups.name ? String(groups.name) : coreStr;

        if (pack && typeof pack.highlightCompany === "function") {
          try {
            const res = pack.highlightCompany({ match, coreStr, punct, groups, name, legal, S1, S2 });
            if (typeof res === "string" && res) return res;
          } catch (_) {}
        }

        // conservative fallback (no splitting)
        return `${S1}${match}${S2}`;
      });
      continue;
    }

    s = s.replace(r.pattern, (m) => `${S1}${m}${S2}`);
  }

  const esc = escapeHTML(s);
  return esc.replaceAll(S1, `<span class="hit">`).replaceAll(S2, `</span>`);
}

// ================= init enabled =================
function initEnabled() {
  enabled.clear();
  Object.values(window.DETECTION_ITEMS || {})
    .flat()
    .forEach((i) => {
      if (i && i.defaultOn) enabled.add(i.key);
    });
}

/* =========================
   5) Risk scoring (policy weights; UI text from packs)
   ========================= */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getRiskI18n() {
  const pack = getUiPack();
  if (pack && pack.ui && pack.ui.riskI18n) return pack.ui.riskI18n;

  // ✅ fallback follows UI language (NOT content/rule language)
  const L = getLangUI();

  if (L === "zh") {
    return {
      low: "低",
      mid: "中",
      high: "高",
      top: "主要风险来源",
      advice: "建议",
      adviceLow: "可以使用。金钱保护默认开启（M1）。",
      adviceMid: "请检查主要风险来源；可考虑加强遮罩或添加手工涂抹/术语。",
      adviceHigh: "不建议直接发送：请移除签名/账户等敏感细节，并加强遮罩。",
      meta: (m) => `命中 ${m.hits}｜Money M1${m.fromPdf ? "｜文件" : ""}`
    };
  }

  if (L === "de") {
    return {
      low: "Niedrig",
      mid: "Mittel",
      high: "Hoch",
      top: "Top-Risikoquellen",
      advice: "Hinweis",
      adviceLow: "OK. Geldschutz ist standardmäßig aktiv (M1).",
      // ✅ FIX: replace Chinese punctuation with German/Latin period
      adviceMid: "Top-Risiken prüfen; ggf. stärker maskieren oder manuelle Schwärzung/Begriffe ergänzen.",
      adviceHigh: "Nicht so versenden: Signatur/Konten entfernen und stärker maskieren.",
      meta: (m) => `Treffer ${m.hits}｜Money M1${m.fromPdf ? "｜Datei" : ""}`
    };
  }

  // EN default
  return {
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Ok to use. Money protection is on by default.",
    adviceMid: "Review top risks; consider stronger masking or manual redaction.",
    adviceHigh: "Do not send as-is: remove signature/account details and mask more.",
    meta: (m) => `Hits ${m.hits}｜Money M1${m.fromPdf ? "｜File" : ""}`
  };
}

function labelForKey(k) {
  const pack = getUiPack();
  const labels = pack && pack.ui && pack.ui.labels ? pack.ui.labels : null;
  if (labels && labels[k]) return labels[k];
  return k;
}

/**
 * Scheme A (grouped saturation):
 * - score is computed from 5 risk groups with diminishing returns: 1 - exp(-k * hits)
 * - group weights sum to 1.0, final score in [0..100]
 * - keeps "top" list based on legacy weights for UI explanation (no UI changes)
 */
function computeRiskReport(hitsByKey, meta) {
  const pol = getPolicy();
  const R = pol && pol.risk ? pol.risk : {};

  // legacy (UI top list)
  const W = R && R.weights ? R.weights : {};

  // thresholds/bonus
  const T = R && R.thresholds ? R.thresholds : { mid: 40, high: 70 };
  const B = R && R.bonus ? R.bonus : { base: 0, len1500: 2, len4000: 3, fromPdf: 2 };

  const cap = Number(R.capPerKey || 12);
  const clampMin = Number(R.clampMin ?? 0);
  const clampMax = Number(R.clampMax ?? 100);

  const groups = R && R.groups && typeof R.groups === "object" ? R.groups : null;
  const gw = R && R.groupWeights && typeof R.groupWeights === "object" ? R.groupWeights : null;
  const gk = R && R.groupK && typeof R.groupK === "object" ? R.groupK : null;

  // Safe defaults (only used if policy missing)
  // ✅ PATCH: remove non-existent "address_cn_partial" key; the key is "address_cn" (mode may be address_cn_partial)
  const DEFAULT_GROUPS = {
    critical: ["secret", "api_key_token", "bearer_token", "card_security", "security_answer", "otp", "pin", "2fa"],
    financial: ["account", "bank", "bank_routing_ids", "card_expiry"],
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
  };

  const DEFAULT_GW = { critical: 0.32, financial: 0.28, identity: 0.18, contact: 0.12, tracking: 0.1 };
  const DEFAULT_GK = { critical: 0.35, financial: 0.3, identity: 0.22, contact: 0.18, tracking: 0.2 };

  const G = groups || DEFAULT_GROUPS;
  const GW = gw || DEFAULT_GW;
  const GK = gk || DEFAULT_GK;

  function getCappedHit(k) {
    const c = Number((hitsByKey && hitsByKey[k]) || 0);
    if (!c) return 0;
    return Math.min(c, cap);
  }

  function satScore(hits, k) {
    const hh = Math.max(0, Number(hits || 0));
    const kk = Math.max(0, Number(k || 0));
    if (hh <= 0 || kk <= 0) return 0;
    return 1 - Math.exp(-kk * hh);
  }

  const groupHits = {};
  for (const gname of Object.keys(G || {})) {
    const arr = Array.isArray(G[gname]) ? G[gname] : [];
    let sum = 0;
    for (const k of arr) sum += getCappedHit(k);
    groupHits[gname] = sum;
  }

  let base = 0;
  for (const gname of Object.keys(GW || {})) {
    const w = Number(GW[gname] || 0);
    if (!w) continue;
    const hits = Number(groupHits[gname] || 0);
    const k = Number(GK[gname] || 0);
    base += w * satScore(hits, k);
  }
  let score = Math.round(base * 100);

  score += Number(B.base || 0);
  if (meta && meta.inputLen >= 1500) score += Number(B.len1500 || 0);
  if (meta && meta.inputLen >= 4000) score += Number(B.len4000 || 0);
  if (meta && meta.fromPdf) score += Number(B.fromPdf || 0);

  score = clamp(score, clampMin, clampMax);

  let level = "low";
  if (score >= Number(T.high || 70)) level = "high";
  else if (score >= Number(T.mid || 40)) level = "mid";

  const pairs = Object.entries(hitsByKey || {})
    .filter(([, c]) => c > 0)
    .map(([k, c]) => {
      const w = Number(W[k] || 0);
      return { k, c, w, s: c * w };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  return { score, level, top: pairs };
}

function renderRiskBox(report, meta) {
  const box = $("riskBox");
  if (!box) return;

  const t = getRiskI18n();
  const levelText = report.level === "high" ? t.high : report.level === "mid" ? t.mid : t.low;

  const topHtml =
    report.top && report.top.length
      ? report.top
          .map((x) => {
            return `<div class="riskitem">
        <span class="rk">${labelForKey(x.k)}</span>
        <span class="rv">${x.c}</span>
      </div>`;
          })
          .join("")
      : `<div class="tiny muted">-</div>`;

  const advice = report.level === "high" ? t.adviceHigh : report.level === "mid" ? t.adviceMid : t.adviceLow;

  box.innerHTML = `
    <div class="riskhead">
      <div class="riskleft">
        <div class="riskmeta">${t.meta(meta)}</div>
      </div>

      <div class="riskscore">
        <div class="n">${report.score}</div>
        <div class="l">${levelText}</div>
      </div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.top}</div>
      <div class="risklist">${topHtml}</div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.advice}</div>
      <div class="riskadvice">${advice}</div>
    </div>
  `;
}

/* =========================
   6) Rule application (pack-driven; strategy from policy)
   ========================= */

function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

  // ✅ one-shot auto detect
  setLangContentAuto(out);

  const PRIORITY = getPriority();
  const ALWAYS_ON = getAlwaysOnSet();

  function addHit(key) {
    hits++;
    hitsByKey[key] = (hitsByKey[key] || 0) + 1;
  }

  // P2: protect ONLY engine-generated placeholders (do NOT protect arbitrary [..] such as Markdown labels)
  function protectPlaceholders(s) {
    const map = [];
    let t = String(s || "");

    // (A) Protect 【...】 blocks
    t = t.replace(/【[^【】\n\r]{1,120}】/g, (m) => {
      const id = map.length;
      map.push(m);
      return `\uE000${id}\uE001`;
    });

    // (B) Protect ONLY known placeholder tokens in square brackets
    const PH = [
      // DE
      "Telefon",
      "E-Mail",
      "URL",
      "Geheim",
      "Konto",
      "Adresse",
      "Handle",
      "Referenz",
      "Anrede",
      "Zahl",
      "Betrag",
      "Firma",
      "Name",
      // EN fallback tokens
      "Phone",
      "Email",
      "Secret",
      "Account",
      "Address",
      "Ref",
      "Title",
      "Number",
      "Amount",
      "Company",
      // generic
      "REDACTED"
    ]
      .map(escapeRegExp)
      .join("|");

    const rePH = new RegExp(`\\[(?:${PH})\\]`, "g");
    t = t.replace(rePH, (m) => {
      const id = map.length;
      map.push(m);
      return `\uE000${id}\uE001`;
    });

    return { t, map };
  }

  function restorePlaceholders(s, map) {
    let t = String(s || "");
    for (let i = 0; i < (map || []).length; i++) {
      const token = new RegExp(`\\uE000${i}\\uE001`, "g");
      t = t.replace(token, map[i]);
    }
    return t;
  }

  const rules = getRulesSafe();
  const pack = getContentPack();

  // ✅ PATCH P4 in action: enabledKeysArr now includes ALWAYS_ON too
  const enabledKeysArr = effectiveEnabledKeys();
  const enabledSet = new Set(enabledKeysArr);

  lastRunMeta.inputLen = String(text || "").length;
  lastRunMeta.enabledCount = enabledSet.size;
  lastRunMeta.moneyMode = "m1";
  lastRunMeta.langUI = getLangUI();
  lastRunMeta.langContent = getLangContent();

  // If packs not loaded, only manual terms
  if (!rules) {
    out = applyManualTermsMask(out, () => addHit("manual_term"));
    renderOutput(out);

    const report = computeRiskReport(hitsByKey, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    renderRiskBox(report, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    try {
      const ta2 = $("inputText");
      const hasInput = !!(ta2 && String(ta2.value || "").trim());
      if (hasInput) {
        if (typeof window.expandManualArea === "function") window.expandManualArea();
        if (typeof window.expandRiskArea === "function") window.expandRiskArea();
        if (typeof window.syncManualRiskHeights === "function") window.syncManualRiskHeights();
      }
    } catch (_) {}

    updateInputWatermarkVisibility();
    const ta = $("inputText");
    if (ta) renderInputOverlayForPdf(ta.value || "");

    const _lc = getLangContent();
    const snap = {
      enabledKeys: enabledKeysArr,
      moneyMode: "m1",
      langUI: getLangUI(),
      langContent: _lc,
      ruleEngine: _lc,
      ruleEngineMode: String(window.ruleEngineMode || "auto"),
      contentLangMode: String(window.ruleEngineMode || "auto"),
      fromPdf: !!lastRunMeta.fromPdf,
      manualTerms: manualTerms.slice(0)
    };

    window.__export_snapshot = snap;
    if (!window.__export_snapshot_byLang) window.__export_snapshot_byLang = {};
    window.__export_snapshot_byLang[_lc] = snap;

    try {
      window.dispatchEvent(new Event("safe:updated"));
    } catch (_) {}
    return out;
  }

  // manual first
  out = applyManualTermsMask(out, () => addHit("manual_term"));

  // protect existing placeholders
  const p0 = protectPlaceholders(out);
  out = p0.t;

  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key) && !ALWAYS_ON.has(key)) continue;

    const r = rules[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      out = out.replace(r.pattern, () => {
        addHit("money");
        return placeholder("MONEY");
      });
      continue;
    }

    out = out.replace(r.pattern, (...args) => {
      const match = String(args[0] || "");

      if (r.mode === "prefix") {
        const label = String(args[1] || "");
        const val = String(args[2] || "");
        const consumed = (label + val).length;
        const suffix = consumed > 0 && consumed <= match.length ? match.slice(consumed) : "";
        addHit(key);
        return `${label}${placeholder(r.tag)}${suffix}`;
      }

      if (r.mode === "prefix_keep_tail") {
        const label = String(args[1] || "");
        const toMask = String(args[2] || "");
        const tail = String(args[3] || "");
        addHit(key);
        return `${label}${placeholder(r.tag)}${tail}`;
      }

      if (r.mode === "address_cn_partial") {
        const label = args[1] || "";
        const val = args[2] || "";

        if (pack && typeof pack.formatAddressCnPartial === "function") {
          try {
            const res = pack.formatAddressCnPartial({ label, val, match, placeholder });
            if (typeof res === "string" && res) {
              addHit(key);
              return res;
            }
          } catch (_) {}
        }

        addHit(key);
        return `${label}${placeholder("ADDRESS")}`;
      }

      if (r.mode === "phone") {
        const label = args[1] || "";
        const vA = args[2] || "";
        const vB = args[3] || "";
        const vC = args[4] || "";
        const value = vA || vB || vC || match;

        if (!phoneGuardOk({ label, value, match })) return match;

        addHit(key);
        if (label) return `${label}${placeholder(r.tag)}`;
        return placeholder(r.tag);
      }

      if (r.mode === "company") {
        const raw = String(match || "");
        const punctMatch = raw.match(/[。．.，,;；!！?？)）】\]\s]+$/u);
        const punct = punctMatch ? punctMatch[0] : "";
        const coreStr = punct ? raw.slice(0, -punct.length) : raw;

        const groups = args[args.length - 1];
        const legal = groups && typeof groups === "object" && groups.legal ? String(groups.legal) : "";
        const name = groups && typeof groups === "object" && groups.name ? String(groups.name) : coreStr;

        addHit("company");

        if (pack && typeof pack.formatCompany === "function") {
          try {
            const res = pack.formatCompany({ raw, name, legal, punct, coreStr, placeholder });
            if (typeof res === "string" && res) return res;
          } catch (_) {}
        }

        return `${placeholder("COMPANY")}${punct}`;
      }

      addHit(key);
      return placeholder(r.tag);
    });
  }

  out = restorePlaceholders(out, p0.map);

  const report = computeRiskReport(hitsByKey, {
    hits,
    enabledCount: enabledSet.size,
    moneyMode: "m1",
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  window.__safe_hits = hits;
  window.__safe_moneyMode = "m1";
  window.__safe_breakdown = hitsByKey;
  window.__safe_score = report.score;
  window.__safe_level = report.level;
  window.__safe_report = {
    hits,
    hitsByKey,
    score: report.score,
    level: report.level,
    moneyMode: "m1",
    enabledCount: enabledSet.size,
    fromPdf: lastRunMeta.fromPdf,
    langUI: getLangUI(),
    langContent: getLangContent()
  };

  renderOutput(out);
  renderRiskBox(report, {
    hits,
    enabledCount: enabledSet.size,
    moneyMode: "m1",
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  try {
    const ta2 = $("inputText");
    const hasInput = !!(ta2 && String(ta2.value || "").trim());
    if (hasInput) {
      if (typeof window.expandManualArea === "function") window.expandManualArea();
      if (typeof window.expandRiskArea === "function") window.expandRiskArea();
      if (typeof window.syncManualRiskHeights === "function") window.syncManualRiskHeights();
    }
  } catch (_) {}

  updateInputWatermarkVisibility();
  const ta = $("inputText");
  if (ta) renderInputOverlayForPdf(ta.value || "");

  const _lc = getLangContent();
  const snap2 = {
    enabledKeys: enabledKeysArr,
    moneyMode: "m1",
    langUI: getLangUI(),
    langContent: _lc,
    ruleEngine: _lc,
    ruleEngineMode: String(window.ruleEngineMode || "auto"),
    contentLangMode: String(window.ruleEngineMode || "auto"),
    fromPdf: !!lastRunMeta.fromPdf,
    manualTerms: manualTerms.slice(0)
  };

  window.__export_snapshot = snap2;
  if (!window.__export_snapshot_byLang) window.__export_snapshot_byLang = {};
  window.__export_snapshot_byLang[_lc] = snap2;

  try {
    window.dispatchEvent(new Event("safe:updated"));
  } catch (_) {}

  return out;
}

/* =========================
   7) Stability patches (safe no-op)
   ========================= */
try {
  if (typeof window.$ !== "function") window.$ = $;
} catch (_) {}

try {
  if (typeof window.expandManualArea !== "function") window.expandManualArea = function () {};
  if (typeof window.expandRiskArea !== "function") window.expandRiskArea = function () {};
  if (typeof window.syncManualRiskHeights !== "function") window.syncManualRiskHeights = function () {};
  if (typeof expandManualArea !== "function") var expandManualArea = window.expandManualArea;
  if (typeof expandRiskArea !== "function") var expandRiskArea = window.expandRiskArea;
  if (typeof syncManualRiskHeights !== "function") var syncManualRiskHeights = window.syncManualRiskHeights;
} catch (_) {}

// expose helpers
try {
  if (typeof window.getLangUI !== "function") window.getLangUI = getLangUI;
  if (typeof window.getLangContent !== "function") window.getLangContent = getLangContent;

  if (typeof window.resetRuleEngine !== "function") window.resetRuleEngine = resetRuleEngine;
  if (typeof window.resetContentLang !== "function") window.resetContentLang = resetContentLang;

  if (typeof window.__detectRuleEngine !== "function") window.__detectRuleEngine = detectRuleEngine;

  // Debug pack access
  if (typeof window.getContentPack !== "function") window.getContentPack = getContentPack;
  if (typeof window.getPolicy !== "function") window.getPolicy = getPolicy;

  // Main entry
  if (typeof window.applyRules !== "function") window.applyRules = applyRules;

  // manual terms setter (if main.js uses it)
  if (typeof window.setManualTermsFromText !== "function") window.setManualTermsFromText = setManualTermsFromText;

  // init enabled (if main.js uses it)
  if (typeof window.initEnabled !== "function") window.initEnabled = initEnabled;
} catch (_) {}

/* =========================
   8) BOOT INIT (RULE A)
   ========================= */
(function bootRuleEngineInit() {
  try {
    const m = String(window.ruleEngineMode || "").trim().toLowerCase();
    if (!m) window.ruleEngineMode = "auto";

    if (String(window.ruleEngineMode || "").toLowerCase() === "auto") {
      if (normLang(window.ruleEngine)) {
        window.ruleEngineMode = "lock";

        // ✅ compatibility: lock old names too
        try {
          window.contentLang = window.ruleEngine;
          window.contentLangMode = "lock";
        } catch (_) {}
      } else {
        window.ruleEngine = "";

        // ✅ compatibility: reset old names too
        try {
          window.contentLang = "";
          window.contentLangMode = "auto";
        } catch (_) {}
      }
    }

    if (String(window.ruleEngineMode || "").toLowerCase() === "lock" && !normLang(window.ruleEngine)) {
      window.ruleEngine = getLangUI(); // safe fallback

      // ✅ compatibility: keep old names in sync
      try {
        window.contentLang = window.ruleEngine;
        window.contentLangMode = "lock";
      } catch (_) {}
    }
  } catch (_) {}
})();

/* =========================
   9) Content strategy: manual switch (NO CLEAR, keep file)
   ========================= */
function setRuleEngineManual(lang) {
  const L = normLang(lang);
  if (!L) return;

  try {
    window.ruleEngine = L;
    window.ruleEngineMode = "lock";

    // compatibility (if some older code reads contentLang)
    try {
      window.contentLang = L;
      window.contentLangMode = "lock";
    } catch (_) {}

    // re-apply rules to current input
    const ta = document.getElementById("inputText");
    const v = ta ? String(ta.value || "") : "";
    if (v.trim() && typeof applyRules === "function") applyRules(v);
  } catch (_) {}
}

try {
  if (typeof window.setRuleEngineManual !== "function") window.setRuleEngineManual = setRuleEngineManual;
} catch (_) {}

/* =========================
   E) BOOT SELF-CHECK (in-memory only)
   - Detect missing packs/policy early
   - No console logs, no storage
   ========================= */
(function bootSelfCheck() {
  try {
    const packs = window.__ENGINE_LANG_PACKS__;
    const policy = window.__ENGINE_POLICY__;

    const hasPacksObj = !!(packs && typeof packs === "object");
    const hasPolicyObj = !!(policy && typeof policy === "object");

    const need = ["zh", "en", "de"];
    const missingPacks = [];

    if (hasPacksObj) {
      for (const k of need) {
        const p = packs[k];
        const ok = !!(
          p &&
          typeof p === "object" &&
          p.rules &&
          typeof p.rules === "object" &&
          Object.keys(p.rules).length > 0
        );
        if (!ok) missingPacks.push(k);
      }
    } else {
      missingPacks.push(...need);
    }

    const ok = hasPolicyObj && hasPacksObj && missingPacks.length === 0;

    window.__BOOT_OK = {
      ok,
      when: Date.now(),
      hasPolicy: hasPolicyObj,
      hasPacks: hasPacksObj,
      missingPacks,
      // helpful runtime hints
      langUI: typeof window.getLangUI === "function" ? window.getLangUI() : window.currentLang || "",
      langContent: typeof window.getLangContent === "function" ? window.getLangContent() : window.ruleEngine || "",
      ruleEngineMode: String(window.ruleEngineMode || ""),
      // ✅ FIX: align with deployed version tag
      engineVersion: "v20260224a1-engine-a5-policy-split"
    };

    try {
      window.dispatchEvent(new CustomEvent("boot:checked", { detail: window.__BOOT_OK }));
    } catch (_) {}
  } catch (_) {}
})();
