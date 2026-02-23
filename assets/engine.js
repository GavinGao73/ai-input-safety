// =========================
// assets/engine.js — ROUTER + STABLE CORE (no lang rules inside)
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
// =========================

console.log("[engine.js] loaded v20260223-router-a4-pack-fully-isolated");

"use strict";

/* =========================
   0) Language helpers (UI vs Content Strategy)
   ========================= */

function normLang(l) {
  const s = String(l || "").toLowerCase();
  return s === "en" || s === "de" || s === "zh" ? s : "";
}

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
    try {
      window.dispatchEvent(
        new CustomEvent("ruleengine:changed", { detail: { lang: getLangContent() } })
      );
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
      return;
    }

    const detected = detectRuleEngine(text);
    if (!detected) return;

    window.ruleEngine = detected;
    window.ruleEngineMode = "lock";

    try {
      window.dispatchEvent(
        new CustomEvent("ruleengine:changed", { detail: { lang: detected } })
      );
    } catch (_) {}
  } catch (_) {}
}

// Compatibility wrapper (old name used in applyRules)
function setLangContentAuto(text) {
  setRuleEngineAuto(text);
}

/**
 * Detect content strategy language using registered packs first,
 * fallback to conservative heuristic (minimal, not language-rules).
 */
function detectRuleEngine(text) {
  const s0 = String(text || "");
  const s = s0.slice(0, 2600);
  if (!s.trim()) return "";

  const PACKS = window.__ENGINE_LANG_PACKS__ || {};

  // 1) Prefer pack detectors
  try {
    // order: zh -> de -> en (stable preference)
    if (PACKS.zh && typeof PACKS.zh.detect === "function") {
      const r = normLang(PACKS.zh.detect(s));
      if (r === "zh") return "zh";
    }
    if (PACKS.de && typeof PACKS.de.detect === "function") {
      const r = normLang(PACKS.de.detect(s));
      if (r === "de") return "de";
    }
    if (PACKS.en && typeof PACKS.en.detect === "function") {
      const r = normLang(PACKS.en.detect(s));
      if (r === "en") return "en";
    }
  } catch (_) {}

  // 2) Minimal fallback: character-class only (avoid injecting language rules here)
  const han = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
  const total = Math.max(1, s.length);
  if (han / total > 0.06) return "zh";
  if (/[äöüÄÖÜß]/.test(s)) return "de";
  return "en";
}

/* =========================
   0.1) Pack accessors
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
   1) Core state (language-agnostic)
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
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"]; // keep as-is (your build choice)
  const base = new Set(Array.from(enabled || []));
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
   2) Pack-driven execution policy
   ========================= */

// stable base always-on; packs can add more via pack.alwaysOn (language-specific)
function getAlwaysOnBaseSet() {
  return new Set(["secret", "url", "email", "phone", "account", "bank", "company", "money"]);
}

function getPriorityFallback() {
  // only to avoid crash if pack missing
  return [
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
  ];
}

function getPriority() {
  const pack = getContentPack();
  if (pack && Array.isArray(pack.priority) && pack.priority.length) return pack.priority.slice(0);
  return getPriorityFallback();
}

function getAlwaysOnSet() {
  const base = getAlwaysOnBaseSet();
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

/* =========================
   3) PDF overlay highlight (language hooks live in pack)
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
  const enabledKeysArr =
    snap && Array.isArray(snap.enabledKeys) ? snap.enabledKeys : Array.from(enabled || []);
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

    if (r.mode === "address_cn_partial") {
      s = s.replace(r.pattern, (m, p1, p2) => {
        const label = p1 || "";
        const val = p2 || "";
        if (pack && typeof pack.highlightAddressCnPartial === "function") {
          try {
            const res = pack.highlightAddressCnPartial({ label, val, S1, S2 });
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

        let ok = true;
        if (pack && typeof pack.phoneGuard === "function") {
          try {
            ok = !!pack.phoneGuard({ label, value, match: m });
          } catch (_) {
            ok = true;
          }
        } else {
          const digits = String(value).replace(/\D+/g, "");
          ok = digits.length < 16;
        }
        if (!ok) return m;

        if (label) return `${label}${S1}${m.slice(label.length)}${S2}`;
        return `${S1}${m}${S2}`;
      });
      continue;
    }

    if (r.mode === "company") {
      s = s.replace(r.pattern, (...args) => {
        const m = String(args[0] || "");
        const punctMatch = m.match(/[。．.，,;；!！?？)）】\]\s]+$/u);
        const punct = punctMatch ? punctMatch[0] : "";
        const coreStr = punct ? m.slice(0, -punct.length) : m;

        const groups = args[args.length - 1];
        const legal = groups && typeof groups === "object" && groups.legal ? String(groups.legal) : "";
        const name = groups && typeof groups === "object" && groups.name ? String(groups.name) : coreStr;

        // allow pack to highlight name part only
        if (legal) return `${S1}${name}${S2}${legal}${punct}`;
        return `${S1}${m}${S2}`;
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
   4) Risk scoring (core stable; UI text from packs)
   ========================= */

const RISK_WEIGHTS = {
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
};

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getRiskI18n() {
  const pack = getUiPack();
  if (pack && pack.ui && pack.ui.riskI18n) return pack.ui.riskI18n;

  // hard fallback only
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
  let score = 0;

  for (const [k, c] of Object.entries(hitsByKey || {})) {
    if (!c) continue;
    const w = RISK_WEIGHTS[k] || 0;
    const capped = Math.min(c, 12);
    score += w * capped;
  }

  score += 10;
  if (meta.inputLen >= 1500) score += 6;
  if (meta.inputLen >= 4000) score += 8;
  if (meta.fromPdf) score += 6;

  score = clamp(Math.round(score), 0, 100);

  let level = "low";
  if (score >= 70) level = "high";
  else if (score >= 35) level = "mid";

  const pairs = Object.entries(hitsByKey || {})
    .filter(([, c]) => c > 0)
    .map(([k, c]) => {
      const w = RISK_WEIGHTS[k] || 0;
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

  const advice =
    report.level === "high" ? t.adviceHigh : report.level === "mid" ? t.adviceMid : t.adviceLow;

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
   5) Rule application (pack-driven)
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

  function protectPlaceholders(s) {
    const map = [];
    const re = /(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g;
    const t = String(s || "").replace(re, (m) => {
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
      const match = args[0] || "";

      if (r.mode === "prefix") {
        const label = args[1] || "";
        addHit(key);
        return `${label}${placeholder(r.tag)}`;
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

        let ok = true;
        if (pack && typeof pack.phoneGuard === "function") {
          try {
            ok = !!pack.phoneGuard({ label, value, match });
          } catch (_) {
            ok = true;
          }
        } else {
          const digits = String(value).replace(/\D+/g, "");
          ok = digits.length < 16;
        }
        if (!ok) return match;

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

        if (legal) return `${placeholder("COMPANY")}${legal}${punct}`;
        return placeholder("COMPANY");
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
   ✅ STABILITY PATCHES (safe no-op)
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
  if (typeof window.getContentPack !== "function") window.getContentPack = getContentPack;
} catch (_) {}

/* =========================
   ✅ BOOT INIT (RULE A)
   ========================= */
(function bootRuleEngineInit() {
  try {
    const m = String(window.ruleEngineMode || "").trim().toLowerCase();
    if (!m) window.ruleEngineMode = "auto";

    if (String(window.ruleEngineMode || "").toLowerCase() === "auto") {
      if (normLang(window.ruleEngine)) {
        window.ruleEngineMode = "lock";
      } else {
        window.ruleEngine = "";
      }
    }

    if (String(window.ruleEngineMode || "").toLowerCase() === "lock" && !normLang(window.ruleEngine)) {
      window.ruleEngine = getLangUI(); // safe fallback
    }
  } catch (_) {}
})();

// =========================
// Content strategy: manual switch (NO CLEAR, keep file)
// =========================
function setRuleEngineManual(lang) {
  const L = normLang(lang);
  if (!L) return;

  try {
    window.ruleEngine = L;
    window.ruleEngineMode = "lock";

    // compatibility
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
