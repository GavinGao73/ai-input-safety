/* =========================================================
 * raster-export.js
 * Raster Secure PDF export pipeline (in-memory only)
 * - PDF/image -> 600 DPI raster -> opaque redaction (pixels)
 * - Export PDF as images only (no text layer)
 * - NO OCR / NO logs / NO storage
 *
 * Personal/Simple:
 * - Cover ONLY sensitive values; keep labels
 * - Solid black bars only (no overlay text)
 * ======================================================= */

(function () {
  "use strict";

  const DEFAULT_DPI = 600;

  // ✅ keep version centralized
  const PDFJS_VERSION = "3.11.174";

  // ✅ PATCH: robust script loader locks (avoid double-inject + allow retry)
  let __pdfjsLoadPromise = null;
  let __pdflibLoadPromise = null;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // kept for compatibility (not drawn anymore)
  function langPlaceholder(lang) {
    if (lang === "de") return "GESCHWÄRZT";
    if (lang === "en") return "REDACTED";
    return "已遮盖";
  }

  // ✅ Base URL that auto-includes repo name on GitHub Pages project sites
  // ✅ PATCH: align with assets/pdf.js (baseURI-safe)
  function pdfjsBaseUrl() {
    return new URL(`./pdfjs/${PDFJS_VERSION}/`, document.baseURI || window.location.href).toString();
  }

  // ======================================================
  // RASTER LANG PACK ACCESS
  // - language-specific rendering tuning is moved out of raster-export.js
  // - source of truth: window.__RASTER_LANG_PACKS__
  // - keep a safe fallback here to prevent crash if packs are missing
  // ======================================================

  function getDefaultRasterTuning() {
    return {
      lang: "zh",
      version: "fallback",
      limits: {
        maxMatchLen: {
          manual_term: 90,
          person_name: 40,
          person_name_keep_title: 40,
          account_holder_name_keep_title: 40,
          company: 70,
          email: 90,
          phone: 60,
          account: 90,
          bank: 140,
          address_de_street: 160,
          address_de_postal: 160,
          address_de_street_partial: 160,
          address_de_extra_partial: 160,
          address_de_inline_street: 160,
          address_en_inline_street: 160,
          address_en_extra_block: 160,
          address_en_extra: 160,
          address_cn: 160,
          handle: 90,
          ref: 90,
          title: 90,
          money: 70,
          money_label: 70,
          number: 70
        }
      },
      bbox: {
        default: { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
        longValue: { maxByPage: 0.55, maxByEst: 2.20, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
        address: { maxByPage: 0.60, maxByEst: 2.10, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
        money: { maxByPage: 0.35, maxByEst: 1.80 },
        manual_term: { maxByPage: 0.40, maxByEst: 1.80 }
      },
      pad: {
        person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        person_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        account_holder_name_keep_title: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        company: { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
        manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
        _default: { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
      },
      shrinkLabels: {
        phone: [],
        account: [],
        email: [],
        address: [],
        bank: []
      },
      merge: {
        nearGapLegacy: 1.2,
        nearGapCore: 1.2,
        sameLineOverlapRatio: 0.88,
        similarHeightRatio: 0.80
      },
      itemBox: {
        fontHeightMul: 1.08,
        fontHeightMin: 6,
        fontHeightMax: 96,
        widthEstMul: 0.72,
        shortTokenCap: 1.10,
        hardCap: 1.18
      },
      rectBox: {
        fontHeightMul: 1.10,
        fontHeightMin: 6,
        fontHeightMax: 104,
        widthEstMul: 0.82
      }
    };
  }

  function getRasterLangPacks() {
    return window.__RASTER_LANG_PACKS__ || {};
  }

  function getLangTuning(lang) {
    const L = String(lang || "").toLowerCase();
    const packs = getRasterLangPacks();
    const base = getDefaultRasterTuning();
    const picked = packs[L] || packs.zh || null;
    if (!picked || typeof picked !== "object") return base;

    return {
      ...base,
      ...picked,
      limits: {
        ...(base.limits || {}),
        ...((picked && picked.limits) || {}),
        maxMatchLen: {
          ...(((base.limits || {}).maxMatchLen) || {}),
          ...((((picked && picked.limits) || {}).maxMatchLen) || {})
        }
      },
      bbox: {
        ...(base.bbox || {}),
        ...((picked && picked.bbox) || {})
      },
      pad: {
        ...(base.pad || {}),
        ...((picked && picked.pad) || {})
      },
      shrinkLabels: {
        ...(base.shrinkLabels || {}),
        ...((picked && picked.shrinkLabels) || {})
      },
      merge: {
        ...(base.merge || {}),
        ...((picked && picked.merge) || {})
      },
      itemBox: {
        ...(base.itemBox || {}),
        ...((picked && picked.itemBox) || {})
      },
      rectBox: {
        ...(base.rectBox || {}),
        ...((picked && picked.rectBox) || {})
      }
    };
  }

  function getMergeCfg(tuning) {
    const m = (tuning && tuning.merge) || {};
    return {
      nearGapLegacy: Number(m.nearGapLegacy || 1.2),
      nearGapCore: Number(m.nearGapCore || 1.2),
      sameLineOverlapRatio: Number(m.sameLineOverlapRatio || 0.88),
      similarHeightRatio: Number(m.similarHeightRatio || 0.80)
    };
  }

  function getItemBoxCfg(tuning) {
    const cfg = (tuning && tuning.itemBox) || {};
    return {
      fontHeightMul: Number(cfg.fontHeightMul || 1.08),
      fontHeightMin: Number(cfg.fontHeightMin || 6),
      fontHeightMax: Number(cfg.fontHeightMax || 96),
      widthEstMul: Number(cfg.widthEstMul || 0.72),
      shortTokenCap: Number(cfg.shortTokenCap || 1.10),
      hardCap: Number(cfg.hardCap || 1.18)
    };
  }

  function getRectBoxCfg(tuning) {
    const cfg = (tuning && tuning.rectBox) || {};
    return {
      fontHeightMul: Number(cfg.fontHeightMul || 1.10),
      fontHeightMin: Number(cfg.fontHeightMin || 6),
      fontHeightMax: Number(cfg.fontHeightMax || 104),
      widthEstMul: Number(cfg.widthEstMul || 0.82)
    };
  }

  function uiLang() {
    const l = String(window.currentLang || "").toLowerCase();
    return (l === "de" || l === "en" || l === "zh") ? l : "zh";
  }

  function phaseText(lang) {
    if (lang === "de") {
      return {
        phase: "Phase",
        exporting: "Export",
        rendering: "Rendern",
        matching: "Treffer",
        applying: "Schwärzen",
        done: "Fertig"
      };
    }
    if (lang === "en") {
      return {
        phase: "Phase",
        exporting: "Export",
        rendering: "Rendering",
        matching: "Matching",
        applying: "Redacting",
        done: "Done"
      };
    }
    return {
      phase: "阶段",
      exporting: "导出",
      rendering: "渲染",
      matching: "命中",
      applying: "遮盖",
      done: "完成"
    };
  }

  function setRasterPhase(phase, phase2) {
    try {
      const last = window.__RasterExportLast || {};
      const next = Object.assign({}, last, { when: Date.now() });
      if (phase != null) next.phase = String(phase);
      if (phase2 != null) next.phase2 = String(phase2);
      window.__RasterExportLast = next;
    } catch (_) {}

    try {
      const el = document.getElementById("exportStatus");
      if (!el) return;
      const L = phaseText(uiLang());
      const p = (phase != null) ? String(phase) : "";
      const p2 = (phase2 != null) ? String(phase2) : "";
      const line = p2 ? `${L.phase}: ${p} / ${p2}` : `${L.phase}: ${p}`;
      const prev = String(el.textContent || "");
      if (!prev) {
        el.textContent = line;
      } else {
        if (!prev.startsWith(line)) el.textContent = line + "\n" + prev;
      }
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent("raster:phase", {
        detail: { when: Date.now(), phase: String(phase || ""), phase2: String(phase2 || "") }
      }));
    } catch (_) {}
  }

  function getRasterDebugConfig() {
    const dbg = window.__RASTER_DEBUG__;
    const base = (dbg && typeof dbg === "object") ? dbg : {};
    return {
      enabled: !!base.enabled,
      showRects: base.showRects !== false,
      showItems: !!base.showItems,
      showLabels: base.showLabels !== false,
      rectStroke: base.rectStroke || "rgba(255, 0, 0, 0.95)",
      itemStroke: base.itemStroke || "rgba(0, 128, 255, 0.40)",
      labelFill: base.labelFill || "rgba(255, 0, 0, 0.95)",
      rectLineWidth: Number(base.rectLineWidth || 2),
      itemLineWidth: Number(base.itemLineWidth || 1),
      font: base.font || "12px sans-serif"
    };
  }

  function drawDebugOverlay(canvas, pageDebug, options) {
    if (!canvas || !pageDebug) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg = options || getRasterDebugConfig();
    if (!cfg.enabled) return;

    ctx.save();

    if (cfg.showItems && Array.isArray(pageDebug.itemBoxes)) {
      ctx.strokeStyle = String(cfg.itemStroke || "rgba(0, 128, 255, 0.40)");
      ctx.lineWidth = Math.max(1, Number(cfg.itemLineWidth || 1));

      for (const b of pageDebug.itemBoxes) {
        if (!b) continue;
        const x = Number(b.x);
        const y = Number(b.y);
        const w = Number(b.w);
        const h = Number(b.h);
        if (!Number.isFinite(x + y + w + h)) continue;
        if (w <= 0 || h <= 0) continue;
        ctx.strokeRect(x, y, w, h);
      }
    }

    if (cfg.showRects && Array.isArray(pageDebug.rects)) {
      ctx.strokeStyle = String(cfg.rectStroke || "rgba(255, 0, 0, 0.95)");
      ctx.lineWidth = Math.max(1, Number(cfg.rectLineWidth || 2));
      ctx.font = String(cfg.font || "12px sans-serif");
      ctx.fillStyle = String(cfg.labelFill || "rgba(255, 0, 0, 0.95)");

      for (const r of pageDebug.rects) {
        if (!r) continue;
        const x = Number(r.x);
        const y = Number(r.y);
        const w = Number(r.w);
        const h = Number(r.h);
        if (!Number.isFinite(x + y + w + h)) continue;
        if (w <= 0 || h <= 0) continue;

        ctx.strokeRect(x, y, w, h);

        if (cfg.showLabels) {
          const label = String(r.key || r._type || "");
          if (label) {
            const tx = x + 2;
            const ty = Math.max(12, y - 4);
            ctx.fillText(label, tx, ty);
          }
        }
      }
    }

    ctx.restore();
  }

  async function loadPdfJsIfNeeded() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return window.pdfjsLib;
    if (__pdfjsLoadPromise) return __pdfjsLoadPromise;

    const base = pdfjsBaseUrl();

    __pdfjsLoadPromise = (async () => {
      const candidates = [
        base + "pdf.min.js",
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`
      ];

      let loaded = false;
      let lastErr = null;

      for (const url of candidates) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.async = true;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Failed to load PDF.js: " + url));
            document.head.appendChild(s);
          });
          loaded = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!loaded || !window.pdfjsLib) {
        throw (lastErr || new Error("pdfjsLib not available"));
      }

      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
      } catch (_) {}

      try {
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
        }
      } catch (_) {}

      return window.pdfjsLib;
    })();

    try {
      return await __pdfjsLoadPromise;
    } catch (e) {
      __pdfjsLoadPromise = null;
      throw e;
    }
  }

  async function loadPdfLibIfNeeded() {
    if (window.PDFLib && window.PDFLib.PDFDocument) return window.PDFLib;
    if (__pdflibLoadPromise) return __pdflibLoadPromise;

    __pdflibLoadPromise = (async () => {
      const url = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

      if (!window.PDFLib) throw new Error("PDFLib not available");
      return window.PDFLib;
    })();

    try {
      return await __pdflibLoadPromise;
    } catch (e) {
      __pdflibLoadPromise = null;
      throw e;
    }
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename || `raster_secure_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function createCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w));
    c.height = Math.max(1, Math.floor(h));
    return c;
  }

  function drawRedactionsOnCanvas(canvas, rects) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    for (const r of (rects || [])) {
      const x = clamp(r.x, 0, canvas.width);
      const y = clamp(r.y, 0, canvas.height);
      const w = clamp(r.w, 0, canvas.width - x);
      const h = clamp(r.h, 0, canvas.height - y);
      if (w <= 0 || h <= 0) continue;

      ctx.fillStyle = "#000";
      ctx.fillRect(x, y, w, h);
    }

    ctx.restore();
  }

  async function canvasToPngBytes(canvas) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1.0));
    if (!blob) throw new Error("PNG blob failed");
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }

  async function renderPdfToCanvases(file, dpi) {
    const pdfjsLib = await loadPdfJsIfNeeded();
    const ab = await readFileAsArrayBuffer(file);

    const BASE = pdfjsBaseUrl();

    const loadingTask = pdfjsLib.getDocument({
      data: ab,
      disableFontFace: false,
      useSystemFonts: true,
      cMapUrl: BASE + "cmaps/",
      cMapPacked: true,
      standardFontDataUrl: BASE + "standard_fonts/"
    });

    const pdf = await loadingTask.promise;

    const scale = (dpi || DEFAULT_DPI) / 72;
    const pages = [];

    setRasterPhase("renderPdfToCanvases", null);

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });

      await page.render({ canvasContext: ctx, viewport }).promise;

      pages.push({
        pageNumber: p,
        canvas,
        width: canvas.width,
        height: canvas.height,
        viewport
      });
    }

    return { pdf, pages, dpi: dpi || DEFAULT_DPI };
  }

  function normalizeTerm(s) {
    return String(s || "").trim();
  }

  function splitTerms(raw) {
    const s = String(raw || "");
    return s
      .split(/[\n\r,，;；、]+/g)
      .map(normalizeTerm)
      .filter(Boolean);
  }

  function dedupKeepOrder(arr, cap) {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      const k = String(x).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (cap && out.length >= cap) break;
    }
    return out;
  }

  function resolveManualTermsFromOptsOrSnapshot(opts) {
    const mt = opts && opts.manualTerms;
    let terms = [];

    if (Array.isArray(mt)) terms = mt.map(normalizeTerm).filter(Boolean);
    else if (typeof mt === "string") terms = splitTerms(mt);

    if (!terms.length) {
      const snap = window.__export_snapshot || {};
      if (Array.isArray(snap.manualTerms)) terms = snap.manualTerms.map(normalizeTerm).filter(Boolean);
      else if (typeof snap.manualTerms === "string") terms = splitTerms(snap.manualTerms);
      else if (Array.isArray(snap.nameList)) terms = snap.nameList.map(normalizeTerm).filter(Boolean);
    }

    return dedupKeepOrder(terms, 24);
  }

  function escapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function makeLatinExactRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    const src = escapeRegExp(t);
    try { return new RegExp(`\\b${src}\\b`, "iu"); } catch (_) { return null; }
  }

  function makeCjkLooseRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    const src = escapeRegExp(t);
    try { return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${src})(?=$|[^\\u4E00-\\u9FFF])`, "u"); } catch (_) { return null; }
  }

  function getEnginePolicy() {
    return window.__ENGINE_POLICY__ || {};
  }

  function normLang(l) {
    const s = String(l || "").toLowerCase();
    return (s === "zh" || s === "en" || s === "de") ? s : "";
  }

  function getPacks() {
    return window.__ENGINE_LANG_PACKS__ || {};
  }

  function getPackForLang(lang) {
    const L = normLang(lang) || "zh";
    const PACKS = getPacks();
    return PACKS[L] || PACKS.zh || null;
  }

  function getPriorityForLang(lang) {
    const pack = getPackForLang(lang);
    if (pack && Array.isArray(pack.priority) && pack.priority.length) return pack.priority.slice(0);

    const pol = getEnginePolicy();
    if (Array.isArray(pol.defaultPriority) && pol.defaultPriority.length) return pol.defaultPriority.slice(0);

    return [
      "person_name",
      "company",
      "email",
      "bank",
      "account",
      "phone",
      "money",
      "address_de_street",
      "address_de_postal",
      "handle",
      "ref",
      "title",
      "number"
    ];
  }

  function getAlwaysOnSetForLang(lang) {
    const pol = getEnginePolicy();
    const baseArr = Array.isArray(pol.baseAlwaysOn) ? pol.baseAlwaysOn : [];
    const s = new Set(baseArr);

    const pack = getPackForLang(lang);
    const extra = pack && pack.alwaysOn ? pack.alwaysOn : null;

    if (Array.isArray(extra)) {
      for (const k of extra) s.add(k);
    } else if (extra && typeof extra.forEach === "function") {
      try { extra.forEach((k) => s.add(k)); } catch (_) {}
    }

    return s;
  }

  function buildRuleMatchers(lang, enabledKeys, moneyMode, manualTerms) {
    const PRIORITY = getPriorityForLang(lang);
    const ALWAYS_ON = getAlwaysOnSetForLang(lang);

    const pack = getPackForLang(lang);
    const rules = (pack && pack.rules && typeof pack.rules === "object") ? pack.rules : {};
    const matchers = [];
    const enabledSet = new Set(Array.isArray(enabledKeys) ? enabledKeys : []);

    function normalizeToRegExp(pat) {
      if (!pat) return null;
      if (pat instanceof RegExp) return pat;

      if (typeof pat === "string") {
        try { return new RegExp(pat, "u"); } catch (_) {
          try { return new RegExp(pat); } catch (__) { return null; }
        }
      }

      if (typeof pat === "object") {
        const src = (typeof pat.source === "string") ? pat.source
                  : (typeof pat.pattern === "string") ? pat.pattern
                  : null;
        if (!src) return null;

        const flags = (typeof pat.flags === "string") ? pat.flags : "";
        try { return new RegExp(src, flags); } catch (_) { return null; }
      }

      return null;
    }

    function forceGlobal(re) {
      if (!(re instanceof RegExp)) return null;
      const flags = re.flags.includes("g") ? re.flags : (re.flags + "g");
      try { return new RegExp(re.source, flags); } catch (_) { return null; }
    }

    const terms = Array.isArray(manualTerms) ? manualTerms : [];
    for (const termRaw of terms) {
      const term = String(termRaw || "").trim();
      if (!term) continue;
      if (term.length > 80) continue;

      const hasCjk = /[\u4E00-\u9FFF]/.test(term);
      const re0 = hasCjk ? makeCjkLooseRegex(term) : makeLatinExactRegex(term);
      const re = forceGlobal(re0);
      if (!re) continue;

      matchers.push({ key: "manual_term", re, mode: "manual", __term: term });
    }

    for (const k of PRIORITY) {
      if (k === "money") {
        if (!moneyMode || moneyMode === "off") continue;
      } else {
        if (!enabledSet.has(k) && !ALWAYS_ON.has(k)) continue;
      }

      const r = rules[k];
      if (!r) continue;

      const raw = (r.pattern != null) ? r.pattern
                : (r.re != null) ? r.re
                : (r.regex != null) ? r.regex
                : null;

      const re0 = normalizeToRegExp(raw);
      const re = forceGlobal(re0);
      if (!re) continue;

      matchers.push({ key: k, re, mode: r.mode || "" });
    }

    matchers.sort((a, b) => (a.key === "manual_term" ? -1 : 0) - (b.key === "manual_term" ? -1 : 0));
    return matchers;
  }

  function getCachedPagesItems() {
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

  function findCachedItemsForPage(cached, pageNumber) {
    if (!Array.isArray(cached) || !cached.length) return null;
    for (const p of cached) {
      if (!p) continue;
      const pn = Number(p.pageNumber || p.p || 0);
      if (pn === Number(pageNumber)) {
        const items = p.items || p.textItems || null;
        if (Array.isArray(items)) return items;
      }
    }
    return null;
  }

  function normalizeCachedItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((it) => ({
      str: it && it.str != null ? String(it.str) : "",
      transform: Array.isArray(it && it.transform) ? it.transform.slice(0, 6) : [1, 0, 0, 1, 0, 0],
      width: Number(it && it.width) || 0,
      height: Number(it && it.height) || 0,
      hasEOL: !!(it && it.hasEOL)
    }));
  }

  function getItemsArray(textContentOrItems) {
    if (Array.isArray(textContentOrItems)) return textContentOrItems;
    if (textContentOrItems && Array.isArray(textContentOrItems.items)) return textContentOrItems.items;
    return [];
  }

  function buildItemBoxes(pdfjsLib, viewport, textContentOrItems, lang) {
    const items = getItemsArray(textContentOrItems);
    if (!items.length || !pdfjsLib || !pdfjsLib.Util || !viewport) return [];

    const tuning = getLangTuning(lang);
    const itemBoxCfg = getItemBoxCfg(tuning);

    const Util = pdfjsLib.Util;
    const out = [];

    for (const it of items) {
      if (!it) continue;

      const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
      const tx = Util.transform(viewport.transform, tr);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);

      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }
      fontH = clamp(
        fontH * itemBoxCfg.fontHeightMul,
        itemBoxCfg.fontHeightMin,
        itemBoxCfg.fontHeightMax
      );

      const s = String(it.str || "");
      const textLen = Math.max(1, s.length);

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      const est = Math.max(8, textLen * fontH * itemBoxCfg.widthEstMul);

      if (!Number.isFinite(w) || w <= 0) {
        w = est;
      }

      const hardCap = est * itemBoxCfg.hardCap;
      if (w > hardCap) w = hardCap;

      if (textLen <= 4) {
        w = Math.min(w, est * itemBoxCfg.shortTokenCap);
      }

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, itemBoxCfg.fontHeightMin, viewport.height - ry);

      if (!Number.isFinite(rx + ry + rw + rh)) continue;
      if (rw <= 0 || rh <= 0) continue;

      out.push({ x: rx, y: ry, w: rw, h: rh });
    }

    return out;
  }

  function getMatcherCore() {
    try {
      const mc = window.__MATCHER_CORE__;
      if (
        mc &&
        typeof mc === "object" &&
        typeof mc.matchDocument === "function"
      ) {
        return mc;
      }
    } catch (_) {}
    return null;
  }

  function buildPageTextAndRangesFromItems(textContentOrItems) {
    const items =
      Array.isArray(textContentOrItems) ? textContentOrItems :
      (textContentOrItems && Array.isArray(textContentOrItems.items)) ? textContentOrItems.items :
      [];

    if (!items.length) {
      return { items: [], pageText: "", itemRanges: [] };
    }

    function needSpaceBetween(line, chunk) {
      if (!line || !chunk) return false;

      const a = line[line.length - 1];
      const b = chunk[0];

      const aIsCjk = /[\u4E00-\u9FFF]/.test(a);
      const bIsCjk = /[\u4E00-\u9FFF]/.test(b);

      let needSpace = true;

      if (aIsCjk || bIsCjk) needSpace = false;
      if (/^[\s\)\]\}\.,;:\/]/.test(chunk)) needSpace = false;
      if (/[\s\-\(\[\{\/]$/.test(line)) needSpace = false;

      return needSpace;
    }

    const rows = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const s0 = String((it && it.str) || "");
      const s = s0.replace(/\s+/g, " ").trim();
      if (!s) continue;

      const tr = Array.isArray(it && it.transform) ? it.transform : [];
      const x = Number(tr[4] || 0);
      const y = Number(tr[5] || 0);
      const yKey = Math.round(y * 2) / 2;

      rows.push({
        idx: i,
        s,
        x,
        y: yKey
      });
    }

    if (!rows.length) {
      return { items, pageText: "", itemRanges: [] };
    }

    rows.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lines = [];
    const Y_EPS = 1.2;

    for (const r of rows) {
      const last = lines[lines.length - 1];
      if (!last || Math.abs(last.y - r.y) > Y_EPS) {
        lines.push({ y: r.y, parts: [r] });
      } else {
        last.parts.push(r);
      }
    }

    let pageText = "";
    const itemRanges = [];
    let prevY = null;

    for (const ln of lines) {
      ln.parts.sort((a, b) => a.x - b.x);

      if (prevY !== null) {
        const gap = prevY - ln.y;
        if (gap > 12) {
          pageText += "\n\n";
        } else if (pageText && !pageText.endsWith("\n")) {
          pageText += "\n";
        }
      }

      let lineText = "";

      for (const part of ln.parts) {
        const chunk = part.s;
        if (!chunk) continue;

        if (lineText && needSpaceBetween(lineText, chunk)) {
          lineText += " ";
        }

        const startInLine = lineText.length;
        lineText += chunk;
        const endInLine = lineText.length;

        itemRanges.push({
          idx: part.idx,
          start: pageText.length + startInLine,
          end: pageText.length + endInLine
        });
      }

      pageText += lineText;
      prevY = ln.y;
    }

    return { items, pageText, itemRanges };
  }

  function normalizeCoreHit(hit) {
    if (!hit || typeof hit !== "object") return null;

    const key =
      typeof hit.key === "string" ? hit.key :
      typeof hit.ruleKey === "string" ? hit.ruleKey :
      typeof hit.type === "string" ? hit.type :
      "";

    const aRaw =
      Number.isFinite(hit.a) ? hit.a :
      Number.isFinite(hit.start) ? hit.start :
      Number.isFinite(hit.from) ? hit.from :
      Number.isFinite(hit.index) ? hit.index :
      null;

    const bRaw =
      Number.isFinite(hit.b) ? hit.b :
      Number.isFinite(hit.end) ? hit.end :
      Number.isFinite(hit.to) ? hit.to :
      (
        Number.isFinite(aRaw) && Number.isFinite(hit.len)
          ? aRaw + Number(hit.len)
          : null
      );

    if (!key) return null;
    if (!Number.isFinite(aRaw) || !Number.isFinite(bRaw)) return null;
    if (bRaw <= aRaw) return null;

    return {
      key,
      a: Math.max(0, Number(aRaw)),
      b: Math.max(0, Number(bRaw)),
      preferSub: hit.preferSub || null
    };
  }

  function collectCoreHitsForPage({ lang, pageText, pageNumber, enabledKeys, moneyMode, manualTerms }) {
    const mc = getMatcherCore();
    if (!mc) return null;

    const rawText = String(pageText || "");
    if (!rawText.trim()) {
      return {
        ok: true,
        spans: [],
        debug: { reason: "empty-page-text" },
        summary: { total: 0, byKey: {} }
      };
    }

    let prettyText = rawText;
    try {
      const pagesText = window.__pdf_pages_text || window.lastPdfPagesText || [];
      const hit = Array.isArray(pagesText)
        ? pagesText.find((p) => Number(p && p.pageNumber) === Number(pageNumber))
        : null;
      if (hit && typeof hit.text === "string" && hit.text.trim()) {
        prettyText = hit.text;
      }
    } catch (_) {}

    prettyText = String(prettyText || "")
      .replace(/\u0000/g, "")
      .replace(/\r\n?/g, "\n")
      .trim();

    if (!prettyText) {
      return {
        ok: true,
        spans: [],
        debug: { reason: "pretty-text-empty-after-clean" },
        summary: { total: 0, byKey: {} }
      };
    }

    const safeLang = (() => {
      const l = String(lang || "").toLowerCase();
      if (l === "zh" || l === "en" || l === "de") return l;
      try {
        const p = String(window.__matcher_core_probe?.lang || "").toLowerCase();
        if (p === "zh" || p === "en" || p === "de") return p;
      } catch (_) {}
      try {
        const r = String(window.ruleEngine || "").toLowerCase();
        if (r === "zh" || r === "en" || r === "de") return r;
      } catch (_) {}
      return "zh";
    })();

    const safeEnabledKeys = Array.isArray(enabledKeys) ? enabledKeys.slice() : [];
    const safeManualTerms = Array.isArray(manualTerms)
      ? manualTerms.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    let normalized = null;
    try {
      normalized = mc.normalizeDocument({
        pages: [{ pageNumber: Number(pageNumber) || 1, text: prettyText }],
        fromPdf: true
      });
    } catch (_) {
      normalized = null;
    }

    const attempts = [];

    if (
      normalized &&
      (
        (typeof normalized.text === "string" && normalized.text.trim()) ||
        (Array.isArray(normalized.pages) && normalized.pages.length)
      )
    ) {
      attempts.push({
        label: "normalized-document",
        run: () => mc.matchDocument({
          lang: safeLang,
          document: normalized,
          enabledKeys: safeEnabledKeys,
          manualTerms: safeManualTerms,
          moneyMode,
          fromPdf: true
        })
      });
    }

    attempts.push({
      label: "raw-paged-document",
      run: () => mc.matchDocument({
        lang: safeLang,
        document: {
          pages: [{ pageNumber: Number(pageNumber) || 1, text: prettyText }],
          fromPdf: true
        },
        enabledKeys: safeEnabledKeys,
        manualTerms: safeManualTerms,
        moneyMode,
        fromPdf: true
      })
    });

    attempts.push({
      label: "plain-text",
      run: () => mc.matchDocument({
        lang: safeLang,
        text: prettyText,
        enabledKeys: safeEnabledKeys,
        manualTerms: safeManualTerms,
        moneyMode,
        fromPdf: true
      })
    });

    let res = null;
    let lastErr = null;
    let usedAttempt = "";

    for (const step of attempts) {
      try {
        const out = step.run();

        if (out && typeof out.then === "function") {
          throw new Error("matcher-core-async-not-supported-here");
        }

        if (!out) continue;

        const total =
          Number(out?.summary?.total) ||
          (Array.isArray(out?.hits) ? out.hits.length : 0) ||
          (Array.isArray(out?.rawHits) ? out.rawHits.length : 0) ||
          (Array.isArray(out?.finalHits) ? out.finalHits.length : 0);

        if (total > 0) {
          res = out;
          usedAttempt = step.label;
          break;
        }

        if (!res) {
          res = out;
          usedAttempt = step.label;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (!res) {
      if (lastErr) throw lastErr;
      return null;
    }

    const rawHits =
      Array.isArray(res.hits) ? res.hits :
      Array.isArray(res.rawHits) ? res.rawHits :
      Array.isArray(res.finalHits) ? res.finalHits :
      [];

    const spans = rawHits
      .map(normalizeCoreHit)
      .filter(Boolean)
      .filter((sp) => {
        if (!sp || !sp.key) return false;
        if (!Number.isFinite(sp.a) || !Number.isFinite(sp.b)) return false;
        if (sp.b <= sp.a) return false;
        if (sp.a < 0) return false;
        if (sp.b > prettyText.length + 4) return false;
        return true;
      })
      .sort((x, y) => (x.a - y.a) || (x.b - y.b));

    return {
      ok: true,
      spans,
      debug: Object.assign({}, res && res.debug ? res.debug : {}, {
        attempt: usedAttempt,
        pageNumber: Number(pageNumber) || 1,
        pageTextLength: prettyText.length
      }),
      summary: res && res.summary ? res.summary : { total: spans.length, byKey: {} }
    };
  }

  function textItemsToRectsFromSpans(pdfjsLib, viewport, textContentOrItems, spans, lang) {
    const Util = pdfjsLib.Util;
    const tuning = getLangTuning(lang);
    const mergeCfg = getMergeCfg(tuning);
    const rectBoxCfg = getRectBoxCfg(tuning);

    const { items, itemRanges } = buildPageTextAndRangesFromItems(textContentOrItems);
    if (!items.length || !Array.isArray(spans) || !spans.length) return [];

    const MAX_MATCH_LEN = Object.assign({}, (((tuning && tuning.limits) || {}).maxMatchLen) || {});

    function keyGroupForBBox(key) {
      const isLongValueKey =
        key === "account" || key === "phone" || key === "email" || key === "bank";

      const isAddressKey =
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn";

      if (key === "money" || key === "money_label") return "money";
      if (key === "manual_term") return "manual_term";
      if (isLongValueKey) return "longValue";
      if (isAddressKey) return "address";
      return "default";
    }

    function bboxForItem(it, key) {
      const tx = Util.transform(viewport.transform, it.transform || [1, 0, 0, 1, 0, 0]);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);

      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy * 1.0;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }
      fontH = clamp(
        fontH * rectBoxCfg.fontHeightMul,
        rectBoxCfg.fontHeightMin,
        rectBoxCfg.fontHeightMax
      );

      const s = String(it.str || "");
      const textLen = Math.max(1, s.length);

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      const est = Math.max(10, textLen * fontH * rectBoxCfg.widthEstMul);

      if (!Number.isFinite(w) || w <= 0) {
        w = est;
      }

      const group = keyGroupForBBox(key);
      const bboxCfg = (tuning && tuning.bbox) || {};
      const cfg = bboxCfg[group] || bboxCfg.default || {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      };

      const hardRatio = Number(cfg.wHardCapEstRatio || 2.2);
      const softMul = Number(cfg.wSoftCapEstMul || 1.15);

      if (w > est * hardRatio) {
        w = est * softMul;
      }

      const maxByPage = viewport.width * Number(cfg.maxByPage || 0.30);
      const maxByEst = est * Number(cfg.maxByEst || 1.45);
      w = clamp(w, 1, Math.min(maxByPage, maxByEst));

      const isLongValueKey = group === "longValue";
      const minW = isLongValueKey ? (est * 0.92) : (est * 0.80);
      w = Math.max(w, Math.min(minW, viewport.width * (isLongValueKey ? 0.38 : 0.18)));

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, 6, viewport.height - ry);

      return { x: rx, y: ry, w: rw, h: rh };
    }

    function shrinkByLabel(key, s, ls, le) {
      if (key === "manual_term") return { ls, le };
      if (le <= ls) return { ls, le };

      const sub = s.slice(ls, le);
      const labels = (tuning && tuning.shrinkLabels) || {};

      function makeLabelPrefixRe(words) {
        if (!Array.isArray(words) || !words.length) return null;
        const parts = words
          .map((w) => String(w || "").trim())
          .filter(Boolean)
          .map(escapeRegExp);
        if (!parts.length) return null;
        try {
          return new RegExp(`^(?:${parts.join("|")})\\s*[:：]?\\s*`, "i");
        } catch (_) {
          return null;
        }
      }

      const weakTrim = (ch) => {
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
        return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
      };

      if (key === "phone") {
        const re = makeLabelPrefixRe(labels.phone);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "account") {
        const re = makeLabelPrefixRe(labels.account);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "email") {
        const re = makeLabelPrefixRe(labels.email);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn"
      ) {
        const re = makeLabelPrefixRe(labels.address);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "bank") {
        const re = makeLabelPrefixRe(labels.bank);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;
      }

      while (ls < le && weakTrim(s[ls])) ls++;
      while (le > ls && weakTrim(s[le - 1])) le--;

      return { ls, le };
    }

    function getPadForKey(key) {
      const pad = (tuning && tuning.pad) || {};
      return pad[key] || pad._default || { pxW: 0.005, pyH: 0.045, minX: 0.55, minY: 0.75 };
    }

    const merged = [];
    for (const sp of spans) {
      if (!sp || !sp.key) continue;
      const maxLen = MAX_MATCH_LEN[sp.key] || 120;
      if ((sp.b - sp.a) > maxLen) continue;

      const last = merged[merged.length - 1];
      if (last && last.key === sp.key && sp.a <= last.b) {
        last.b = Math.max(last.b, sp.b);
      } else {
        merged.push({ a: sp.a, b: sp.b, key: sp.key, preferSub: sp.preferSub || null });
      }
    }

    const rects = [];

    for (const sp of merged) {
      const A = sp.a;
      const B = sp.b;
      const key = sp.key;
      const preferSub = sp.preferSub;

      for (const r of itemRanges) {
        const a0 = Math.max(A, r.start);
        const b0 = Math.min(B, r.end);
        if (b0 <= a0) continue;

        const it = items[r.idx];
        const s = String(it.str || "");
        if (!s) continue;

        let ls = a0 - r.start;
        let le = b0 - r.start;

        if (preferSub) {
          const fullLen = Math.max(0, B - A);
          if (fullLen > 0) {
            const subA = A + Number(preferSub.offsetStart || 0);
            const subB = A + Number(preferSub.offsetEnd || 0);
            const a1 = Math.max(subA, r.start);
            const b1 = Math.min(subB, r.end);
            if (b1 > a1) {
              ls = a1 - r.start;
              le = b1 - r.start;
            } else {
              continue;
            }
          }
        } else {
          const shr = shrinkByLabel(key, s, ls, le);
          ls = shr.ls;
          le = shr.le;
          if (le <= ls) continue;
        }

        if (le - ls <= 0) continue;

        const bb = bboxForItem(it, key);
        const len = Math.max(1, s.length);

        const x1 = bb.x + bb.w * (ls / len);
        const x2 = bb.x + bb.w * (le / len);

        const pcfg = getPadForKey(key);
        const padX = Math.max(Number(pcfg.minX || 0), bb.w * Number(pcfg.pxW || 0));
        const padY = Math.max(Number(pcfg.minY || 0), bb.h * Number(pcfg.pyH || 0));

        let rx = x1 - padX;
        let ry = bb.y - padY;
        let rw = (x2 - x1) + padX * 2;
        let rh = bb.h + padY * 2;

        rx = clamp(rx, 0, viewport.width);
        ry = clamp(ry, 0, viewport.height);
        rw = clamp(rw, 1, viewport.width - rx);
        rh = clamp(rh, 6, viewport.height - ry);

        if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
          const maxW = Math.min(viewport.width * 0.22, bb.w * 0.55);
          if (rw > maxW) continue;
        }

        if (key === "company") {
          const maxW = Math.min(viewport.width * 0.18, bb.w * 0.45);
          if (rw > maxW) continue;
        }

        if (key === "manual_term") {
          const maxW = Math.min(viewport.width * 0.28, bb.w * 0.70);
          if (rw > maxW) continue;
        }

        if (rw > viewport.width * 0.92) continue;
        if (rh > viewport.height * 0.35) continue;
        if (rw > viewport.width * 0.85 && rh > viewport.height * 0.20) continue;

        rects.push({ x: rx, y: ry, w: rw, h: rh, key });
      }
    }

    if (!rects.length) return [];

    rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];

    for (const r of rects) {
      if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

      const last = out[out.length - 1];
      if (!last) {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key });
        continue;
      }

      const sameKey = r.key === last.key;
      const rTop = r.y;
      const rBot = r.y + r.h;
      const lTop = last.y;
      const lBot = last.y + last.h;

      const overlap = Math.max(0, Math.min(lBot, rBot) - Math.max(lTop, rTop));
      const minH = Math.max(1, Math.min(last.h, r.h));
      const sameLine = (overlap / minH) > mergeCfg.sameLineOverlapRatio;

      const heightRatio = Math.min(last.h, r.h) / Math.max(last.h, r.h);
      const similarHeight = heightRatio > mergeCfg.similarHeightRatio;

      const gap = r.x - (last.x + last.w);
      const near = gap >= 0 && gap <= mergeCfg.nearGapCore;

      if (sameKey && sameLine && similarHeight && near) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);

        last.x = nx;
        last.y = ny;
        last.w = nr - nx;
        last.h = nb - ny;
      } else {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key });
      }
    }

    return out.map(({ x, y, w, h, key }) => ({ x, y, w, h, key }));
  }

  function tryMatcherCoreRectsForPage({ pdfjsLib, viewport, itemsOrTextContent, pageNumber, lang, enabledKeys, moneyMode, manualTerms }) {
    const mc = getMatcherCore();
    if (!mc) return null;

    const built = buildPageTextAndRangesFromItems(itemsOrTextContent);
    const pageText = String(built.pageText || "");
    if (!pageText.trim()) {
      return {
        ok: true,
        rects: [],
        spans: [],
        source: "matcher-core",
        hitCount: 0,
        debug: { reason: "empty-page-text" },
        summary: { total: 0, byKey: {} }
      };
    }

    const coreRes = collectCoreHitsForPage({
      lang,
      pageText,
      pageNumber,
      enabledKeys,
      moneyMode,
      manualTerms
    });
    if (!coreRes || !coreRes.ok) return null;

    const rects = textItemsToRectsFromSpans(
      pdfjsLib,
      viewport,
      itemsOrTextContent,
      coreRes.spans || [],
      lang
    );

    return {
      ok: true,
      rects,
      spans: Array.isArray(coreRes.spans) ? coreRes.spans : [],
      source: "matcher-core",
      hitCount: Array.isArray(coreRes.spans) ? coreRes.spans.length : 0,
      debug: coreRes.debug || null,
      summary: coreRes.summary || null
    };
  }

  function textItemsToRects(pdfjsLib, viewport, textContentOrItems, matchers, lang) {
    const Util = pdfjsLib.Util;
    const tuning = getLangTuning(lang);
    const mergeCfg = getMergeCfg(tuning);
    const rectBoxCfg = getRectBoxCfg(tuning);

    const items =
      Array.isArray(textContentOrItems) ? textContentOrItems :
      (textContentOrItems && Array.isArray(textContentOrItems.items)) ? textContentOrItems.items :
      [];

    if (!items.length || !matchers || !matchers.length) return [];

    const MAX_MATCH_LEN = Object.assign({}, (((tuning && tuning.limits) || {}).maxMatchLen) || {});

    function isWs(ch) {
      return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
    }

    function shouldInsertSpace(prevChar, nextChar) {
      if (!prevChar || !nextChar) return false;
      if (isWs(prevChar) || isWs(nextChar)) return false;
      const a = /[A-Za-z0-9]/.test(prevChar);
      const b = /[A-Za-z0-9]/.test(nextChar);
      return a && b;
    }

    function getAllMatchesWithGroups(re, s) {
      const out = [];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s)) !== null) {
        const text = String(m[0] || "");
        if (!text) { re.lastIndex++; continue; }
        out.push({ index: m.index, len: text.length, m });
      }
      return out;
    }

    function keyGroupForBBox(key) {
      const isLongValueKey =
        key === "account" || key === "phone" || key === "email" || key === "bank";

      const isAddressKey =
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn";

      if (key === "money" || key === "money_label") return "money";
      if (key === "manual_term") return "manual_term";
      if (isLongValueKey) return "longValue";
      if (isAddressKey) return "address";
      return "default";
    }

    function bboxForItem(it, key) {
      const tx = Util.transform(viewport.transform, it.transform || [1, 0, 0, 1, 0, 0]);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);

      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy * 1.0;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }
      fontH = clamp(
        fontH * rectBoxCfg.fontHeightMul,
        rectBoxCfg.fontHeightMin,
        rectBoxCfg.fontHeightMax
      );

      const s = String(it.str || "");
      const textLen = Math.max(1, s.length);

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      const est = Math.max(10, textLen * fontH * rectBoxCfg.widthEstMul);

      if (!Number.isFinite(w) || w <= 0) {
        w = est;
      }

      const group = keyGroupForBBox(key);
      const bboxCfg = (tuning && tuning.bbox) || {};
      const cfg = bboxCfg[group] || bboxCfg.default || {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      };

      const hardRatio = Number(cfg.wHardCapEstRatio || 2.2);
      const softMul = Number(cfg.wSoftCapEstMul || 1.15);
      if (w > est * hardRatio) w = est * softMul;

      const maxByPage = viewport.width * Number(cfg.maxByPage || 0.30);
      const maxByEst = est * Number(cfg.maxByEst || 1.45);
      w = clamp(w, 1, Math.min(maxByPage, maxByEst));

      const isLongValueKey = group === "longValue";
      const minW = isLongValueKey ? (est * 0.92) : (est * 0.80);
      w = Math.max(w, Math.min(minW, viewport.width * (isLongValueKey ? 0.38 : 0.18)));

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, 6, viewport.height - ry);

      return { x: rx, y: ry, w: rw, h: rh };
    }

    function shrinkByLabel(key, s, ls, le) {
      if (key === "manual_term") return { ls, le };

      if (le <= ls) return { ls, le };
      const sub = s.slice(ls, le);

      const labels = (tuning && tuning.shrinkLabels) || {};
      function makeLabelPrefixRe(words) {
        if (!Array.isArray(words) || !words.length) return null;
        const parts = words
          .map((w) => String(w || "").trim())
          .filter(Boolean)
          .map(escapeRegExp);
        if (!parts.length) return null;
        const src = `^(?:${parts.join("|")})\\s*[:：]?\\s*`;
        try { return new RegExp(src, "i"); } catch (_) { return null; }
      }

      const weakTrim = (ch) => {
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
        return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
      };

      if (key === "phone") {
        const re = makeLabelPrefixRe(labels.phone);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "account") {
        const re = makeLabelPrefixRe(labels.account);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "email") {
        const re = makeLabelPrefixRe(labels.email);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn"
      ) {
        const re = makeLabelPrefixRe(labels.address);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "bank") {
        const re = makeLabelPrefixRe(labels.bank);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;
      }

      while (ls < le && weakTrim(s[ls])) ls++;
      while (le > ls && weakTrim(s[le - 1])) le--;

      return { ls, le };
    }

    function getPadForKey(key) {
      const pad = (tuning && tuning.pad) || {};
      return pad[key] || pad._default || { pxW: 0.005, pyH: 0.045, minX: 0.55, minY: 0.75 };
    }

    let pageText = "";
    const itemRanges = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const s = String(it.str || "");
      if (!s) continue;

      const prevChar = pageText.length ? pageText[pageText.length - 1] : "";
      const nextChar = s[0];

      if (pageText && shouldInsertSpace(prevChar, nextChar) && !it.hasEOL) {
        pageText += " ";
      }

      const start = pageText.length;
      pageText += s;
      const end = pageText.length;

      itemRanges.push({ idx: i, start, end });

      if (it && it.hasEOL) pageText += "\n";
    }

    const matchText = pageText.replace(/\n/g, "\u0000");
    const spans = [];

    for (const mm of matchers) {
      const re0 = mm.re;
      if (!(re0 instanceof RegExp)) continue;

      const flags = re0.flags.includes("g") ? re0.flags : (re0.flags + "g");
      let re;
      try { re = new RegExp(re0.source, flags); } catch (_) { continue; }

      const hits = getAllMatchesWithGroups(re, matchText);
      for (const h of hits) {
        let a = h.index;
        let b = a + h.len;
        const key = mm.key;

        const maxLen = MAX_MATCH_LEN[key] || 120;
        if ((b - a) > maxLen) continue;

        const m = h.m || [];
        const full = String(m[0] || "");
        if (full.indexOf("\u0000") >= 0) continue;

        if (key === "manual_term") {
          const g2 = (m[2] != null) ? String(m[2]) : "";
          const g1 = (m[1] != null) ? String(m[1]) : "";
          const term = g2 || g1;
          if (term) {
            const pos = full.indexOf(term);
            if (pos >= 0) {
              a = h.index + pos;
              b = a + term.length;
            }
          }
          if ((b - a) <= 0 || (b - a) > (MAX_MATCH_LEN.manual_term || 90)) continue;

          spans.push({ a, b, key, preferSub: null });
          continue;
        }

        let preferSub = null;

        function findSubOffsets(subStr) {
          if (!subStr) return null;
          const sub = String(subStr);
          const pos = full.indexOf(sub);
          if (pos < 0) return null;
          return { offsetStart: pos, offsetEnd: pos + sub.length };
        }

        if (key === "company") {
          const coreCN = m[2] && String(m[2]);
          const coreDE = m[5] && String(m[5]);
          const core = (coreCN && coreCN.length >= 2) ? coreCN : coreDE;
          const off = (core && core.length >= 2) ? findSubOffsets(core) : null;
          if (off) preferSub = off;

        } else if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
          const cand1 = (m[1] != null) ? String(m[1]) : "";
          const cand2 = (m[2] != null) ? String(m[2]) : "";
          const best = (cand1 && cand1.length >= 2) ? cand1 : (cand2 && cand2.length >= 2) ? cand2 : full;
          const off = findSubOffsets(best);
          if (off) preferSub = off;

        } else if (key === "account") {
          const off = findSubOffsets(m[2]);
          if (off) preferSub = off;

        } else if (key === "phone") {
          const candidates = [m[2], m[3], m[4]].filter(Boolean).map(String);
          let best = "";
          for (const c of candidates) if (c.length > best.length) best = c;

          if (best) {
            const pos = full.indexOf(best);
            if (pos >= 0) {
              let end = pos + best.length;
              const tail = full.slice(end);
              const tailHit = tail.match(/^\s*(?:\(|（)(?:WhatsApp|WeChat|Telegram|Signal)(?:\)|）)/i);
              if (tailHit && tailHit[0]) end += tailHit[0].length;
              preferSub = { offsetStart: pos, offsetEnd: end };
            }
          }

        } else if (key === "money" || key === "money_label") {
          const off = findSubOffsets(m[2] || m[4] || m[5]);
          if (off) preferSub = off;
        }

        spans.push({ a, b, key, preferSub });
      }
    }

    if (!spans.length) return [];

    spans.sort((x, y) => (x.a - y.a) || (x.b - y.b));
    const merged = [];
    const MERGE_GAP = 0;

    function samePreferSub(p, q) {
      if (!p && !q) return true;
      if (!p || !q) return false;
      return p.offsetStart === q.offsetStart && p.offsetEnd === q.offsetEnd;
    }

    for (const sp of spans) {
      const last = merged[merged.length - 1];
      if (!last) { merged.push({ ...sp }); continue; }

      const sameKey = sp.key === last.key;
      const close = sp.a <= last.b + MERGE_GAP;

      if (sameKey && close) {
        last.b = Math.max(last.b, sp.b);
        if (last.preferSub && sp.preferSub) {
          last.preferSub = samePreferSub(last.preferSub, sp.preferSub) ? last.preferSub : null;
        } else {
          last.preferSub = last.preferSub || sp.preferSub || null;
        }
      } else {
        merged.push({ ...sp });
      }
    }

    const rects = [];

    for (const sp of merged) {
      const A = sp.a, B = sp.b, key = sp.key;
      const preferSub = sp.preferSub;

      for (const r of itemRanges) {
        const a0 = Math.max(A, r.start);
        const b0 = Math.min(B, r.end);
        if (b0 <= a0) continue;

        const it = items[r.idx];
        const s = String(it.str || "");
        if (!s) continue;

        let ls = a0 - r.start;
        let le = b0 - r.start;

        if (preferSub) {
          const fullLen = Math.max(0, B - A);
          if (fullLen > 0) {
            const subA = A + preferSub.offsetStart;
            const subB = A + preferSub.offsetEnd;

            const a1 = Math.max(subA, r.start);
            const b1 = Math.min(subB, r.end);
            if (b1 > a1) {
              ls = a1 - r.start;
              le = b1 - r.start;
            } else {
              continue;
            }
          }
        } else {
          const shr = shrinkByLabel(key, s, ls, le);
          ls = shr.ls; le = shr.le;
          if (le <= ls) continue;
        }

        if (le - ls <= 0) continue;

        const bb = bboxForItem(it, key);
        const len = Math.max(1, s.length);

        const x1 = bb.x + bb.w * (ls / len);
        const x2 = bb.x + bb.w * (le / len);

        const pcfg = getPadForKey(key);
        const padX = Math.max(Number(pcfg.minX || 0), bb.w * Number(pcfg.pxW || 0));
        const padY = Math.max(Number(pcfg.minY || 0), bb.h * Number(pcfg.pyH || 0));

        let rx = x1 - padX;
        let ry = bb.y - padY;
        let rw = (x2 - x1) + padX * 2;
        let rh = bb.h + padY * 2;

        rx = clamp(rx, 0, viewport.width);
        ry = clamp(ry, 0, viewport.height);
        rw = clamp(rw, 1, viewport.width - rx);
        rh = clamp(rh, 6, viewport.height - ry);

        if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
          const maxW = Math.min(viewport.width * 0.22, bb.w * 0.55);
          if (rw > maxW) continue;
        }

        if (key === "company") {
          const maxW = Math.min(viewport.width * 0.18, bb.w * 0.45);
          if (rw > maxW) continue;
        }

        if (key === "manual_term") {
          const maxW = Math.min(viewport.width * 0.28, bb.w * 0.70);
          if (rw > maxW) continue;
        }

        if (rw > viewport.width * 0.92) continue;
        if (rh > viewport.height * 0.35) continue;
        if (rw > viewport.width * 0.85 && rh > viewport.height * 0.20) continue;

        rects.push({ x: rx, y: ry, w: rw, h: rh, key });
      }
    }

    if (!rects.length) return [];

    rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];

    for (const r of rects) {
      if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

      const last = out[out.length - 1];
      if (!last) { out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key }); continue; }

      const sameKey = (r.key === last.key);

      const rTop = r.y;
      const rBot = r.y + r.h;
      const lTop = last.y;
      const lBot = last.y + last.h;

      const overlap = Math.max(0, Math.min(lBot, rBot) - Math.max(lTop, rTop));
      const minH = Math.max(1, Math.min(last.h, r.h));
      const sameLine = (overlap / minH) > mergeCfg.sameLineOverlapRatio;

      const heightRatio = Math.min(last.h, r.h) / Math.max(last.h, r.h);
      const similarHeight = heightRatio > mergeCfg.similarHeightRatio;

      const gap = r.x - (last.x + last.w);
      const near = gap >= 0 && gap <= mergeCfg.nearGapLegacy;

      if (sameKey && sameLine && similarHeight && near) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);

        last.x = nx;
        last.y = ny;
        last.w = nr - nx;
        last.h = nb - ny;
      } else {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key });
      }
    }

    return out.map(({ x, y, w, h, key }) => ({ x, y, w, h, key }));
  }

  async function autoRedactReadablePdf({ file, lang, enabledKeys, moneyMode, dpi, manualTerms }) {
    setRasterPhase("autoRedactReadablePdf:begin", null);

    const pdfjsLib = await loadPdfJsIfNeeded();
    const { pdf, pages } = await renderPdfToCanvases(file, dpi || DEFAULT_DPI);

    const matchers = buildRuleMatchers(lang, enabledKeys, moneyMode, manualTerms);
    const _placeholder = langPlaceholder(lang);
    const dbgCfg = getRasterDebugConfig();

    try {
      const PACKS = window.__ENGINE_LANG_PACKS__ || {};
      const pack = PACKS[lang] || PACKS.zh || null;

      window.__RasterExportLast = {
        when: Date.now(),
        phase: "autoRedactReadablePdf",
        hasRules: !!(pack && pack.rules),
        hasMatcherCore: !!getMatcherCore(),
        enabledKeys: Array.isArray(enabledKeys) ? enabledKeys.slice() : [],
        moneyMode: moneyMode || "off",
        manualTerms: Array.isArray(manualTerms) ? manualTerms.slice() : [],
        matcherKeys: (matchers || []).map(m => m.key),
        pages: (pages || []).length,
        lang,
        rasterDebug: Object.assign({}, dbgCfg)
      };
    } catch (_) {}

    const cached = getCachedPagesItems();

    for (const p of pages) {
      setRasterPhase("autoRedactReadablePdf:page", `p${p.pageNumber}`);

      let itemsOrTextContent = null;

      const cachedItems = findCachedItemsForPage(cached, p.pageNumber);
      if (cachedItems && cachedItems.length) {
        itemsOrTextContent = normalizeCachedItems(cachedItems);
      } else {
        const page = await pdf.getPage(p.pageNumber);
        itemsOrTextContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
      }

      setRasterPhase("autoRedactReadablePdf:match", `p${p.pageNumber}`);

      let rects = [];
      let rectSource = "legacy-regex";
      let coreHitCount = 0;
      let coreFailed = false;
      let coreError = "";
      let coreSpans = [];
      let coreDebug = null;
      let coreSummary = null;

      try {
        const coreRes = tryMatcherCoreRectsForPage({
          pdfjsLib,
          viewport: p.viewport,
          itemsOrTextContent,
          pageNumber: p.pageNumber,
          lang,
          enabledKeys,
          moneyMode,
          manualTerms
        });

        if (coreRes && coreRes.ok) {
          rects = Array.isArray(coreRes.rects) ? coreRes.rects : [];
          rectSource = coreRes.source || "matcher-core";
          coreHitCount = Number(coreRes.hitCount || 0);
          coreSpans = Array.isArray(coreRes.spans) ? coreRes.spans : [];
          coreDebug = coreRes.debug || null;
          coreSummary = coreRes.summary || null;
        } else {
          rects = textItemsToRects(pdfjsLib, p.viewport, itemsOrTextContent, matchers, lang);
          rectSource = "legacy-regex";
        }
      } catch (e) {
        coreFailed = true;
        coreError = e && e.message ? String(e.message) : "matcher-core-error";
        rects = textItemsToRects(pdfjsLib, p.viewport, itemsOrTextContent, matchers, lang);
        rectSource = "legacy-regex";
      }

      const itemBoxes = buildItemBoxes(pdfjsLib, p.viewport, itemsOrTextContent, lang);
      const pageDebug = {
        pageNumber: p.pageNumber,
        rects: Array.isArray(rects) ? rects.slice() : [],
        itemBoxes: Array.isArray(itemBoxes) ? itemBoxes.slice() : []
      };

      try {
        const last = window.__RasterExportLast || {};
        const prevPerPage = Array.isArray(last.perPage) ? last.perPage : [];

        const rectCount = Array.isArray(rects) ? rects.length : 0;
        const itemCount =
          Array.isArray(itemsOrTextContent) ? itemsOrTextContent.length :
          (itemsOrTextContent && Array.isArray(itemsOrTextContent.items)) ? itemsOrTextContent.items.length :
          0;

        window.__RasterExportLast = Object.assign({}, last, {
          perPage: prevPerPage.concat([{
            pageNumber: p.pageNumber,
            items: itemCount,
            rectCount,
            rectSource,
            coreHitCount,
            coreFailed,
            coreError,
            coreDebug,
            coreSummary,
            spans: Array.isArray(coreSpans)
              ? coreSpans.slice(0, 30).map((sp) => ({
                  key: sp.key || "",
                  a: Number(sp.a || 0),
                  b: Number(sp.b || 0),
                  preferSub: sp.preferSub || null
                }))
              : [],
            rects: Array.isArray(rects)
              ? rects.slice(0, 30).map((r) => ({
                  key: r.key || "",
                  x: r.x,
                  y: r.y,
                  w: r.w,
                  h: r.h
                }))
              : [],
            itemBoxes: Array.isArray(itemBoxes)
              ? itemBoxes.slice(0, 50).map((b) => ({
                  x: b.x,
                  y: b.y,
                  w: b.w,
                  h: b.h
                }))
              : []
          }]),
          rectsTotal: (Number(last.rectsTotal) || 0) + rectCount
        });
      } catch (_) {}

      setRasterPhase("autoRedactReadablePdf:apply", `p${p.pageNumber}`);
      drawRedactionsOnCanvas(p.canvas, rects);

      if (dbgCfg.enabled) {
        drawDebugOverlay(p.canvas, pageDebug, dbgCfg);
      }
    }

    setRasterPhase("autoRedactReadablePdf:done", null);
    return pages;
  }

  async function renderImageToCanvas(file, dpi) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = dataUrl;
    });
    if (!img) throw new Error("Image load failed");

    const c = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const ctx = c.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, c.width, c.height);

    const arr = [{
      pageNumber: 1,
      canvas: c,
      width: c.width,
      height: c.height,
      dpi: dpi || DEFAULT_DPI
    }];

    try { arr.pages = arr; } catch (_) {}

    return arr;
  }

  async function exportCanvasesToPdf(pages, dpi, filename) {
    setRasterPhase("exportCanvasesToPdf:begin", null);

    const PDFLib = await loadPdfLibIfNeeded();
    const { PDFDocument } = PDFLib;

    const doc = await PDFDocument.create();

    for (const p of (pages || [])) {
      if (!p || !p.canvas) continue;

      const pngBytes = await canvasToPngBytes(p.canvas);
      const png = await doc.embedPng(pngBytes);

      const pw = Number(p.width || (p.canvas ? p.canvas.width : 0));
      const ph = Number(p.height || (p.canvas ? p.canvas.height : 0));
      if (!pw || !ph) continue;

      const pageWpt = (pw * 72) / (dpi || DEFAULT_DPI);
      const pageHpt = (ph * 72) / (dpi || DEFAULT_DPI);

      const page = doc.addPage([pageWpt, pageHpt]);
      page.drawImage(png, { x: 0, y: 0, width: pageWpt, height: pageHpt });
    }

    setRasterPhase("exportCanvasesToPdf:save", null);

    const pdfBytes = await doc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(blob, filename || `raster_secure_${Date.now()}.pdf`);

    setRasterPhase("exportCanvasesToPdf:done", null);
  }

  function getModeBOverlayStyle() {
    return {
      stroke: "rgba(0, 255, 240, 0.95)",
      strokeWidth: 2,
      dash: [6, 4],
      fill: "rgba(0, 255, 240, 0.18)",
      shadow: "rgba(0,0,0,0.35)",
      shadowBlur: 4
    };
  }

  const RasterExport = {
    async exportRasterSecurePdfFromReadablePdf(opts) {
      const file = opts && opts.file;
      if (!file) return;

      const lang = (opts && opts.lang) || "zh";
      const dpi = (opts && opts.dpi) || DEFAULT_DPI;
      const manualTerms = resolveManualTermsFromOptsOrSnapshot(opts);

      try {
        const PACKS = window.__ENGINE_LANG_PACKS__ || {};
        const pack = PACKS[lang] || PACKS.zh || null;

        window.__RasterExportLast = {
          when: Date.now(),
          phase: "exportRasterSecurePdfFromReadablePdf:begin",
          hasRules: !!(pack && pack.rules),
          enabledKeys: Array.isArray(opts && opts.enabledKeys) ? (opts.enabledKeys || []).slice() : [],
          moneyMode: (opts && opts.moneyMode) || "off",
          manualTerms: manualTerms.slice(),
          lang,
          dpi,
          rasterDebug: getRasterDebugConfig()
        };
      } catch (_) {}

      setRasterPhase("exportReadable:begin", null);

      const pages = await autoRedactReadablePdf({
        file,
        lang,
        enabledKeys: (opts && opts.enabledKeys) || [],
        moneyMode: (opts && opts.moneyMode) || "off",
        dpi,
        manualTerms
      });

      const name = (opts && opts.filename) || `raster_secure_${Date.now()}.pdf`;

      try {
        const last = window.__RasterExportLast || {};
        window.__RasterExportLast = Object.assign({}, last, {
          when2: Date.now(),
          phase2: "exportRasterSecurePdfFromReadablePdf:export",
          pages: (pages || []).length,
          filename: name
        });
      } catch (_) {}

      setRasterPhase("exportReadable:export", null);
      await exportCanvasesToPdf(pages, dpi, name);
      setRasterPhase("exportReadable:done", null);
    },

    async exportRasterSecurePdfFromVisual(result) {
      const pages =
        (result && Array.isArray(result.pages)) ? result.pages :
        (Array.isArray(result)) ? result :
        null;

      if (!pages || !pages.length) return;

      const dpi = (result && result.dpi) ? result.dpi : DEFAULT_DPI;
      const _placeholder = langPlaceholder((result && result.lang) || "zh");
      const dbgCfg = getRasterDebugConfig();

      try {
        window.__RasterExportLast = {
          when: Date.now(),
          phase: "exportRasterSecurePdfFromVisual",
          pages: pages.length,
          hasRectPages: !!(result && result.rectsByPage),
          lang: (result && result.lang) || "zh",
          dpi,
          rasterDebug: dbgCfg
        };
      } catch (_) {}

      setRasterPhase("exportVisual:apply", null);

      const rectsByPage = (result && result.rectsByPage) ? result.rectsByPage : {};
      for (const p of pages) {
        const pn = p && p.pageNumber ? p.pageNumber : 1;
        const rects = rectsByPage[pn] || [];
        if (p && p.canvas) {
          drawRedactionsOnCanvas(p.canvas, rects);
          if (dbgCfg.enabled) {
            drawDebugOverlay(p.canvas, {
              pageNumber: pn,
              rects: Array.isArray(rects) ? rects.slice() : [],
              itemBoxes: []
            }, dbgCfg);
          }
        }
      }

      const name = (result && result.filename) ? result.filename : `raster_secure_${Date.now()}.pdf`;
      setRasterPhase("exportVisual:export", null);
      await exportCanvasesToPdf(pages, dpi, name);
      setRasterPhase("exportVisual:done", null);
    },

    getModeBOverlayStyle,
    getLangTuning,
    getRasterLangPacks,
    renderPdfToCanvases,
    renderImageToCanvas,
    drawRedactionsOnCanvas,
    drawDebugOverlay,
    getRasterDebugConfig
  };

  try {
    const PACKS = window.__ENGINE_LANG_PACKS__ || {};
    const pack = PACKS.zh || null;

    window.__RasterExportStatus = {
      loaded: true,
      hasRules: !!(pack && pack.rules),
      time: Date.now()
    };
  } catch (_) {}

  window.RasterExport = RasterExport;
})();
