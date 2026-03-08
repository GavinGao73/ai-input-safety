// =========================
// assets/engine.js (FULL) ✅ SLIMMED / STABLE
// ROUTER + STABLE CORE (no lang rules/priority/alwaysOn/formatters inside)
// - UI language: window.currentLang (UI only)
// - Content strategy language: window.ruleEngine (+ window.ruleEngineMode)
// - Input overlay: plain-text mirror only (NO hit highlighting)
// =========================

"use strict";

const ENGINE_VERSION = "v20260308-engine-a6-slim5-shared-state-bridge";
console.log("[engine.js] loaded " + ENGINE_VERSION);

try {
  if (typeof window.__ENGINE_PRIMARY_SOURCE !== "string") window.__ENGINE_PRIMARY_SOURCE = "";
} catch (_) {}

try {
  if (typeof window.__overlay_source !== "string") window.__overlay_source = "";
} catch (_) {}

try {
  if (typeof window.__lastOutputPlain !== "string") window.__lastOutputPlain = "";
} catch (_) {}

/* =========================
   DETECTION_ITEMS write-trace (BOOT EARLY)
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

        try {
          window.__DETECTION_ITEMS_LAST_SET__ = {
            when: Date.now(),
            iso: new Date().toISOString(),
            valueShape: v && typeof v === "object" ? Object.keys(v) : null,
            stack: new Error("DETECTION_ITEMS set").stack || ""
          };
        } catch (_) {}

        try {
          console.warn("[DETECTION_ITEMS SET]", "time=", new Date().toISOString());
          console.trace("[DETECTION_ITEMS SET TRACE]");
        } catch (_) {}

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
   0) Policy access
   ========================= */

function getPolicy() {
  return window.__ENGINE_POLICY__ || {};
}

function normLang(l) {
  const s = String(l || "").toLowerCase();
  return s === "en" || s === "de" || s === "zh" ? s : "";
}

/* =========================
   1) Language helpers
   ========================= */

function getLangUI() {
  return normLang(window.currentLang) || "zh";
}

function getLangContent() {
  const v = normLang(window.ruleEngine);
  return v || getLangUI();
}

function resetRuleEngine() {
  try {
    window.ruleEngine = "";
    window.ruleEngineMode = "auto";

    try {
      window.contentLang = "";
      window.contentLangMode = "auto";
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("ruleengine:changed", { detail: { lang: getLangContent() } }));
    } catch (_) {}
  } catch (_) {}
}

function resetContentLang() {
  resetRuleEngine();
}

function setRuleEngineAuto() {
  return;
}

function setLangContentAuto() {
  return;
}

/* =========================
   1.0) Engine-level content language guard
   ========================= */

function ensureContentLangInEngine(text) {
  try {
    const mode = String(window.ruleEngineMode || "").toLowerCase();
    const re = normLang(window.ruleEngine);

    if (mode === "lock" && re) return true;
    if (window.__LANG_MODAL_OPENING__) return false;

    if (!window.__LangDetect || typeof window.__LangDetect.ensureContentLang !== "function") {
      return true;
    }

    const ui = getLangUI();
    const r = window.__LangDetect.ensureContentLang(String(text || ""), ui);
    if (r && r.ok === false) return false;

    let L = r && r.lang ? normLang(r.lang) : "";

    if (!L) {
      const last =
        window.__LangDetect &&
        window.__LangDetect.__state &&
        window.__LangDetect.__state.last
          ? window.__LangDetect.__state.last
          : null;

      const lastLang = last && last.lang ? normLang(last.lang) : "";
      const conf = last && typeof last.confidence === "number" ? last.confidence : null;

      if (lastLang && !last.needsConfirm && (conf == null || conf >= 0.78)) {
        L = lastLang;
      }
    }

    if (L) {
      window.ruleEngine = L;
      window.ruleEngineMode = "lock";

      try {
        window.contentLang = L;
        window.contentLangMode = "lock";
      } catch (_) {}

      try {
        window.dispatchEvent(new CustomEvent("ruleengine:changed", { detail: { lang: L } }));
      } catch (_) {}
    }

    return true;
  } catch (_) {
    return true;
  }
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

function getRulesSafe() {
  const pack = getContentPack();
  const rules = pack && pack.rules && typeof pack.rules === "object" ? pack.rules : null;
  return rules && Object.keys(rules).length ? rules : null;
}

/* =========================
   1.2) matcher-core helpers
   ========================= */

function getMatcherCore() {
  const mc = window.__MATCHER_CORE__;
  if (!mc) return null;
  if (typeof mc.match === "function") return mc;
  if (typeof mc.matchDocument === "function") return mc;
  return null;
}

function getCachedPdfPagesForMatcher() {
  try {
    const a = window.lastPdfPagesItems;
    if (Array.isArray(a) && a.length) return a;
  } catch (_) {}

  try {
    const b = window.__pdf_pages_items;
    if (Array.isArray(b) && b.length) return b;
  } catch (_) {}

  return [];
}

function buildMatcherCoreDoc(text) {
  const doc = {
    text: String(text || ""),
    pages: [],
    meta: {
      fromPdf: !!lastRunMeta.fromPdf
    }
  };

  if (!lastRunMeta.fromPdf) return doc;

  const pages = getCachedPdfPagesForMatcher();
  if (!Array.isArray(pages) || !pages.length) return doc;

  doc.pages = pages.map((p, idx) => ({
    pageNumber: Number(p && p.pageNumber) || idx + 1,
    items: Array.isArray(p && p.items)
      ? p.items.map((it) => ({
          str: it && it.str != null ? String(it.str) : "",
          transform: Array.isArray(it && it.transform) ? it.transform.slice(0, 6) : [],
          width: Number(it && it.width) || 0,
          height: Number(it && it.height) || 0
        }))
      : []
  }));

  return doc;
}

function normalizeMatchResult(result) {
  const safe = result && typeof result === "object" ? result : {};
  const hits = Array.isArray(safe.hits) ? safe.hits : [];
  const textMasked = typeof safe.textMasked === "string" ? safe.textMasked : "";
  const byKey =
    safe.summary && safe.summary.byKey && typeof safe.summary.byKey === "object"
      ? safe.summary.byKey
      : (safe.byKey && typeof safe.byKey === "object" ? safe.byKey : {});

  return {
    version: safe.version || "match-result-v1",
    source: safe.source || "matcher-core",
    lang: safe.lang || getLangContent(),
    input: safe.input || {
      textKind: lastRunMeta.fromPdf ? "page-text" : "plain",
      textLength: String(textMasked || "").length
    },
    summary: safe.summary || {
      hitCount: hits.length,
      categoryCounts: {},
      maskedLength: textMasked.length,
      total: hits.length,
      byKey
    },
    hits,
    textMasked,
    byKey
  };
}

function runMatcherCoreMain(text, enabledKeysArr) {
  try {
    const mc = getMatcherCore();
    if (!mc) return null;

    const doc = buildMatcherCoreDoc(text);
    const fn = typeof mc.match === "function" ? mc.match : mc.matchDocument;

    const res = fn.call(mc, {
      doc,
      lang: getLangContent(),
      pack: getContentPack(),
      policy: getPolicy(),
      enabledKeys: Array.isArray(enabledKeysArr) ? enabledKeysArr.slice(0) : [],
      moneyMode: moneyMode,
      manualTerms: manualTerms.slice(0)
    });

    const matchResult = normalizeMatchResult(res);
    window.__MatcherLast = matchResult;
    window.__matcher_core_last = matchResult;
    return matchResult;
  } catch (err) {
    window.__matcher_core_last = {
      ok: false,
      reason: "matcher-core-main-error",
      error: String((err && err.message) || err || ""),
      when: Date.now(),
      engineVersion: ENGINE_VERSION
    };
    return null;
  }
}

function runMatcherCoreProbe(text, enabledKeysArr) {
  try {
    const mc = getMatcherCore();
    if (!mc) {
      window.__matcher_core_probe = {
        ok: false,
        reason: "matcher-core-missing",
        when: Date.now(),
        engineVersion: ENGINE_VERSION
      };
      return null;
    }

    const res = mc.matchDocument({
      doc: buildMatcherCoreDoc(text),
      lang: getLangContent(),
      pack: getContentPack(),
      policy: getPolicy(),
      enabledKeys: Array.isArray(enabledKeysArr) ? enabledKeysArr.slice(0) : [],
      moneyMode: moneyMode,
      manualTerms: manualTerms.slice(0)
    });

    const probe = {
      ok: true,
      when: Date.now(),
      engineVersion: ENGINE_VERSION,
      matcherVersion: mc.version || "",
      lang: getLangContent(),
      fromPdf: !!lastRunMeta.fromPdf,
      enabledKeys: Array.isArray(enabledKeysArr) ? enabledKeysArr.slice(0) : [],
      manualTerms: manualTerms.slice(0),
      summary: res && res.summary ? res.summary : { total: 0, byKey: {} },
      byKey: res && res.byKey ? res.byKey : {},
      hitCount: res && res.summary ? Number(res.summary.total || 0) : 0,
      textMasked: res && typeof res.textMasked === "string" ? res.textMasked : "",
      hits: res && Array.isArray(res.hits) ? res.hits.slice(0, 80) : [],
      debug: res && res.debug ? res.debug : {}
    };

    window.__matcher_core_probe = probe;
    window.__matcher_core_last = probe;
    return probe;
  } catch (err) {
    window.__matcher_core_probe = {
      ok: false,
      reason: "matcher-core-error",
      when: Date.now(),
      engineVersion: ENGINE_VERSION,
      error: String((err && err.message) || err || "")
    };
    return null;
  }
}

/* =========================
   2) Core state
   ========================= */

const enabled = new Set();
let moneyMode = "m1";
window.__safe_moneyMode = moneyMode;

let lastOutputPlain =
  typeof window.__lastOutputPlain === "string" ? window.__lastOutputPlain : "";

let lastUploadedFile =
  typeof window.lastUploadedFile !== "undefined" ? window.lastUploadedFile : null;

let lastFileKind =
  typeof window.lastFileKind === "string" ? window.lastFileKind : "";

let lastProbe =
  typeof window.lastProbe !== "undefined" ? window.lastProbe : null;

let lastPdfOriginalText =
  typeof window.lastPdfOriginalText === "string" ? window.lastPdfOriginalText : "";

let lastStage3Mode =
  typeof window.lastStage3Mode === "string" ? window.lastStage3Mode : "none";

let __manualRedactSession =
  typeof window.__manualRedactSession !== "undefined" ? window.__manualRedactSession : null;

let __manualRedactResult =
  typeof window.__manualRedactResult !== "undefined" ? window.__manualRedactResult : null;

let manualTerms =
  Array.isArray(window.manualTerms) ? window.manualTerms.slice(0) : [];

/* shared-state bridge: keep engine / stage3 / main on the same source of truth */
(function bridgeEngineSharedState() {
  try {
    Object.defineProperty(window, "lastUploadedFile", {
      configurable: true,
      enumerable: true,
      get() { return lastUploadedFile; },
      set(v) { lastUploadedFile = v; }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "lastFileKind", {
      configurable: true,
      enumerable: true,
      get() { return lastFileKind; },
      set(v) { lastFileKind = String(v || ""); }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "lastProbe", {
      configurable: true,
      enumerable: true,
      get() { return lastProbe; },
      set(v) { lastProbe = v; }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "lastPdfOriginalText", {
      configurable: true,
      enumerable: true,
      get() { return lastPdfOriginalText; },
      set(v) { lastPdfOriginalText = String(v || ""); }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "lastStage3Mode", {
      configurable: true,
      enumerable: true,
      get() { return lastStage3Mode; },
      set(v) { lastStage3Mode = String(v || "none"); }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "__manualRedactSession", {
      configurable: true,
      enumerable: false,
      get() { return __manualRedactSession; },
      set(v) { __manualRedactSession = v; }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "__manualRedactResult", {
      configurable: true,
      enumerable: false,
      get() { return __manualRedactResult; },
      set(v) { __manualRedactResult = v; }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "manualTerms", {
      configurable: true,
      enumerable: true,
      get() { return manualTerms; },
      set(v) { manualTerms = Array.isArray(v) ? v : []; }
    });
  } catch (_) {}

  try {
    Object.defineProperty(window, "lastOutputPlain", {
      configurable: true,
      enumerable: true,
      get() { return lastOutputPlain; },
      set(v) {
        lastOutputPlain = String(v || "");
        window.__lastOutputPlain = lastOutputPlain;
      }
    });
  } catch (_) {}

  try {
    window.__lastOutputPlain = lastOutputPlain;
  } catch (_) {}
})();

function normalizeTerm(s) {
  return String(s || "").trim();
}

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

  try {
    window.manualTerms = manualTerms;
  } catch (_) {}
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

/* =========================
   Common helpers
   ========================= */

function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"];
  const base = new Set(Array.from(enabled || []));

  try {
    const ALWAYS_ON = getAlwaysOnSet();
    if (ALWAYS_ON && typeof ALWAYS_ON.forEach === "function") {
      ALWAYS_ON.forEach((k) => base.add(k));
    }
  } catch (_) {}

  for (const k of MUST_INCLUDE) base.add(k);
  return Array.from(base);
}

function placeholder(key) {
  const pack = getContentPack() || (getPacks().zh || null);
  const table = pack && pack.placeholders ? pack.placeholders : null;

  if (table && table[key]) return table[key];

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

function renderOutput(outPlain) {
  lastOutputPlain = String(outPlain || "");
  window.__lastOutputPlain = lastOutputPlain;
  window.lastOutputPlain = lastOutputPlain;

  const host = $("outputText");
  if (!host) return;

  const html = escapeHTML(lastOutputPlain).replace(
    /(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g,
    `<span class="hl">$1</span>`
  );

  host.innerHTML = html;
}

function getCopyText() {
  return window.__lastOutputPlain ?? document.getElementById("outputText")?.innerText ?? "";
}
try {
  if (typeof window.getCopyText !== "function") window.getCopyText = getCopyText;
} catch (_) {}

function updateInputWatermarkVisibility() {
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!ta || !wrap) return;
  const has = String(ta.value || "").trim().length > 0;
  wrap.classList.toggle("has-content", has);
}

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

function afterRenderUi() {
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

  try {
    const ta = $("inputText");
    if (ta) renderInputOverlayForPdf(ta.value || "");
  } catch (_) {}
}

function buildExportSnapshot(enabledKeysArr, source) {
  const _lc = getLangContent();
  return {
    enabledKeys: enabledKeysArr,
    moneyMode: "m1",
    langUI: getLangUI(),
    langContent: _lc,
    ruleEngine: _lc,
    ruleEngineMode: String(window.ruleEngineMode || "auto"),
    contentLangMode: String(window.ruleEngineMode || "auto"),
    fromPdf: !!lastRunMeta.fromPdf,
    manualTerms: manualTerms.slice(0),
    source: source || ""
  };
}

function storeExportSnapshot(enabledKeysArr, source) {
  const snap = buildExportSnapshot(enabledKeysArr, source);
  const _lc = snap.langContent;
  window.__export_snapshot = snap;
  if (!window.__export_snapshot_byLang) window.__export_snapshot_byLang = {};
  window.__export_snapshot_byLang[_lc] = snap;
}

function dispatchSafeUpdated() {
  try {
    window.dispatchEvent(new Event("safe:updated"));
  } catch (_) {}
}

/* =========================
   3) Policy-driven execution
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

  return true;
}

/* =========================
   4) Input overlay: plain-text mirror only
   ========================= */

function renderInputOverlayForPdf(originalText) {
  const overlay = $("inputOverlay");
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!overlay || !ta || !wrap) return;

  if (!lastRunMeta.fromPdf) {
    overlay.innerHTML = "";
    wrap.classList.remove("pdf-overlay-on");
    try {
      window.__overlay_source = "";
    } catch (_) {}
    return;
  }

  overlay.innerHTML = escapeHTML(String(originalText || ""));
  wrap.classList.add("pdf-overlay-on");

  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;

  try {
    window.__overlay_source = "plain-text";
  } catch (_) {}
}

/* =========================
   init enabled
   ========================= */

function initEnabled() {
  enabled.clear();
  Object.values(window.DETECTION_ITEMS || {})
    .flat()
    .forEach((i) => {
      if (i && i.defaultOn) enabled.add(i.key);
    });
}

/* =========================
   5) Risk scoring
   ========================= */

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getRiskI18n() {
  const pack = getUiPack();
  if (pack && pack.ui && pack.ui.riskI18n) return pack.ui.riskI18n;

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
      adviceMid: "Top-Risiken prüfen; ggf. stärker maskieren oder manuelle Schwärzung/Begriffe ergänzen.",
      adviceHigh: "Nicht so versenden: Signatur/Konten entfernen und stärker maskieren.",
      meta: (m) => `Treffer ${m.hits}｜Money M1${m.fromPdf ? "｜Datei" : ""}`
    };
  }

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

function computeRiskReport(hitsByKey, meta) {
  const pol = getPolicy();
  const R = pol && pol.risk ? pol.risk : {};
  const W = R && R.weights ? R.weights : {};
  const T = R && R.thresholds ? R.thresholds : { mid: 40, high: 70 };
  const B = R && R.bonus ? R.bonus : { base: 0, len1500: 2, len4000: 3, fromPdf: 2 };

  const cap = Number(R.capPerKey || 12);
  const clampMin = Number(R.clampMin ?? 0);
  const clampMax = Number(R.clampMax ?? 100);

  const groups = R && R.groups && typeof R.groups === "object" ? R.groups : null;
  const gw = R && R.groupWeights && typeof R.groupWeights === "object" ? R.groupWeights : null;
  const gk = R && R.groupK && typeof R.groupK === "object" ? R.groupK : null;

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
   6) Rule application
   ========================= */

function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

  if (!ensureContentLangInEngine(out)) {
    return lastOutputPlain;
  }

  setLangContentAuto(out);

  const PRIORITY = getPriority();
  const ALWAYS_ON = getAlwaysOnSet();

  function addHit(key) {
    hits++;
    hitsByKey[key] = (hitsByKey[key] || 0) + 1;
  }

  function protectPlaceholders(s) {
    const map = [];
    let t = String(s || "");

    t = t.replace(/【[^【】\n\r]{1,120}】/g, (m) => {
      const id = map.length;
      map.push(m);
      return `\uE000${id}\uE001`;
    });

    const PH = [
      "Telefon", "E-Mail", "URL", "Geheim", "Konto", "Adresse", "Handle", "Referenz", "Anrede", "Zahl", "Betrag", "Firma", "Name",
      "Phone", "Email", "Secret", "Account", "Address", "Ref", "Title", "Number", "Amount", "Company",
      "REDACTED"
    ].map(escapeRegExp).join("|");

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
  const enabledKeysArr = effectiveEnabledKeys();
  const enabledSet = new Set(enabledKeysArr);

  const matchResult = runMatcherCoreMain(out, enabledKeysArr);
  const matcherProbe = matchResult ? null : runMatcherCoreProbe(out, enabledKeysArr);

  lastRunMeta.inputLen = String(text || "").length;
  lastRunMeta.enabledCount = enabledSet.size;
  lastRunMeta.moneyMode = "m1";
  lastRunMeta.langUI = getLangUI();
  lastRunMeta.langContent = getLangContent();

  if (matchResult && typeof matchResult.textMasked === "string") {
    const byKey =
      matchResult.summary && matchResult.summary.byKey && typeof matchResult.summary.byKey === "object"
        ? matchResult.summary.byKey
        : (matchResult.byKey || {});

    const hitCount =
      Number(
        (matchResult.summary && (matchResult.summary.hitCount ?? matchResult.summary.total)) ||
        (Array.isArray(matchResult.hits) ? matchResult.hits.length : 0)
      ) || 0;

    const report = computeRiskReport(byKey, {
      hits: hitCount,
      enabledCount: enabledSet.size,
      moneyMode: "m1",
      fromPdf: lastRunMeta.fromPdf,
      inputLen: lastRunMeta.inputLen
    });

    window.__safe_hits = hitCount;
    window.__safe_moneyMode = "m1";
    window.__safe_breakdown = byKey;
    window.__safe_score = report.score;
    window.__safe_level = report.level;
    window.__safe_report = {
      hits: hitCount,
      hitsByKey: byKey,
      score: report.score,
      level: report.level,
      moneyMode: "m1",
      enabledCount: enabledSet.size,
      fromPdf: lastRunMeta.fromPdf,
      langUI: getLangUI(),
      langContent: getLangContent(),
      source: "matcher-core"
    };

    try {
      window.__safe_report_matcher_probe = {
        ok: true,
        byKey,
        hitCount,
        summary: matchResult.summary || {},
        source: "matcher-core"
      };
    } catch (_) {}

    window.__ENGINE_PRIMARY_SOURCE = "matcher-core";
    window.__ENGINE_PRIMARY_SOURCE__ = "matcher-core";
    window.__lastOutputPlain = matchResult.textMasked;
    window.lastOutputPlain = matchResult.textMasked;
    renderOutput(matchResult.textMasked);
    renderRiskBox(report, {
      hits: hitCount,
      enabledCount: enabledSet.size,
      moneyMode: "m1",
      fromPdf: lastRunMeta.fromPdf,
      inputLen: lastRunMeta.inputLen
    });
    afterRenderUi();
    storeExportSnapshot(enabledKeysArr, "matcher-core");
    dispatchSafeUpdated();
    return matchResult.textMasked;
  }

  if (!rules) {
    out = applyManualTermsMask(out, () => addHit("manual_term"));

    const report = computeRiskReport(hitsByKey, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    try {
      window.__safe_report_matcher_probe = {
        ok: !!(matcherProbe && matcherProbe.ok),
        byKey: matcherProbe && matcherProbe.byKey ? matcherProbe.byKey : {},
        hitCount: matcherProbe && Number.isFinite(matcherProbe.hitCount) ? matcherProbe.hitCount : 0
      };
    } catch (_) {}

    window.__ENGINE_PRIMARY_SOURCE = "legacy-fallback";
    window.__ENGINE_PRIMARY_SOURCE__ = "legacy-fallback";
    window.__lastOutputPlain = out;
    window.lastOutputPlain = out;
    renderOutput(out);
    renderRiskBox(report, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });
    afterRenderUi();
    storeExportSnapshot(enabledKeysArr, "legacy-fallback");
    dispatchSafeUpdated();
    return out;
  }

  out = applyManualTermsMask(out, () => addHit("manual_term"));
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

  try {
    window.__safe_report_matcher_probe = {
      ok: !!(matcherProbe && matcherProbe.ok),
      byKey: matcherProbe && matcherProbe.byKey ? matcherProbe.byKey : {},
      hitCount: matcherProbe && Number.isFinite(matcherProbe.hitCount) ? matcherProbe.hitCount : 0,
      summary: matcherProbe && matcherProbe.summary ? matcherProbe.summary : { total: 0, byKey: {} },
      diff: (() => {
        const a = hitsByKey || {};
        const b = matcherProbe && matcherProbe.byKey ? matcherProbe.byKey : {};
        const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
        const outDiff = {};
        for (const k of keys) {
          const av = Number(a[k] || 0);
          const bv = Number(b[k] || 0);
          if (av !== bv) outDiff[k] = { engine: av, matcher: bv };
        }
        return outDiff;
      })()
    };
  } catch (_) {}

  window.__ENGINE_PRIMARY_SOURCE = "legacy-fallback";
  window.__ENGINE_PRIMARY_SOURCE__ = "legacy-fallback";
  window.__lastOutputPlain = out;
  window.lastOutputPlain = out;
  renderOutput(out);
  renderRiskBox(report, {
    hits,
    enabledCount: enabledSet.size,
    moneyMode: "m1",
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });
  afterRenderUi();
  storeExportSnapshot(enabledKeysArr, "legacy-fallback");
  dispatchSafeUpdated();

  return out;
}

/* =========================
   7) Stability patches
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

/* =========================
   Expose helpers
   ========================= */
try {
  if (typeof window.getLangUI !== "function") window.getLangUI = getLangUI;
  if (typeof window.getLangContent !== "function") window.getLangContent = getLangContent;
  if (typeof window.resetRuleEngine !== "function") window.resetRuleEngine = resetRuleEngine;
  if (typeof window.resetContentLang !== "function") window.resetContentLang = resetContentLang;
  if (typeof window.getContentPack !== "function") window.getContentPack = getContentPack;
  if (typeof window.getPolicy !== "function") window.getPolicy = getPolicy;
  if (typeof window.runMatcherCoreProbe !== "function") window.runMatcherCoreProbe = runMatcherCoreProbe;
  if (typeof window.applyRules !== "function") window.applyRules = applyRules;
  if (typeof window.setManualTermsFromText !== "function") window.setManualTermsFromText = setManualTermsFromText;
  if (typeof window.initEnabled !== "function") window.initEnabled = initEnabled;
  if (typeof window.renderInputOverlayForPdf !== "function") window.renderInputOverlayForPdf = renderInputOverlayForPdf;
} catch (_) {}

/* =========================
   8) BOOT INIT
   ========================= */
(function bootRuleEngineInit() {
  try {
    const m = String(window.ruleEngineMode || "").trim().toLowerCase();
    if (!m) window.ruleEngineMode = "auto";

    const re = normLang(window.ruleEngine);

    if (String(window.ruleEngineMode || "").toLowerCase() === "lock") {
      if (!re) {
        window.ruleEngine = "";
        window.ruleEngineMode = "auto";
      }
    } else {
      if (!re) window.ruleEngine = "";
    }

    try {
      const r2 = normLang(window.ruleEngine);
      window.contentLang = r2 || "";
      window.contentLangMode =
        String(window.ruleEngineMode || "auto").toLowerCase() === "lock" ? "lock" : "auto";
    } catch (_) {}
  } catch (_) {}
})();

/* =========================
   9) Content strategy: manual switch
   ========================= */
function setRuleEngineManual(lang) {
  const L = normLang(lang);
  if (!L) return;

  try {
    window.ruleEngine = L;
    window.ruleEngineMode = "lock";

    try {
      window.contentLang = L;
      window.contentLangMode = "lock";
    } catch (_) {}

    const ta = document.getElementById("inputText");
    const v = ta ? String(ta.value || "") : "";
    if (v.trim()) {
      if (typeof window.applyRulesSafely === "function") {
        window.applyRulesSafely(v);
      } else if (typeof window.ensureLangBeforeApply === "function" && typeof window.applyRules === "function") {
        if (!window.ensureLangBeforeApply(v)) return;
        window.applyRules(v);
      } else if (typeof window.applyRules === "function") {
        window.applyRules(v);
      }
    }
  } catch (_) {}
}

try {
  if (typeof window.setRuleEngineManual !== "function") window.setRuleEngineManual = setRuleEngineManual;
} catch (_) {}

/* =========================
   E) BOOT SELF-CHECK
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
      langUI: typeof window.getLangUI === "function" ? window.getLangUI() : window.currentLang || "",
      langContent: typeof window.getLangContent === "function" ? window.getLangContent() : window.ruleEngine || "",
      ruleEngineMode: String(window.ruleEngineMode || ""),
      engineVersion: ENGINE_VERSION
    };

    try {
      window.dispatchEvent(new CustomEvent("boot:checked", { detail: window.__BOOT_OK }));
    } catch (_) {}
  } catch (_) {}
})();
