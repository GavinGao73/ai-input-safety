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

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // kept for compatibility (not drawn anymore)
  function langPlaceholder(lang) {
    if (lang === "de") return "GESCHWÄRZT";
    if (lang === "en") return "REDACTED";
    return "已遮盖";
  }

  // ✅ Base URL that auto-includes repo name on GitHub Pages project sites
  function pdfjsBaseUrl() {
    return new URL(`./pdfjs/${PDFJS_VERSION}/`, window.location.href).toString();
  }

  // ======================================================
  // LANG_TUNING (zh/en/de)
  // - MAX_MATCH_LEN per key (guard over-redaction)
  // - bbox clamp (maxByPage/maxByEst multipliers)
  // - padX/padY per key
  // - shrinkByLabel label vocab per language (avoid masking labels)
  // ======================================================
  const LANG_TUNING = {
    zh: {
      maxMatchLen: {
        manual_term: 90,
        person_name: 32,
        company: 60,
        email: 80,
        phone: 50,
        account: 80,
        bank: 120,

        // legacy keys kept for compat
        address_de_street: 140,
        address_de_postal: 140,

        // ✅ address keys (whitelist expansion)
        address_de_street_partial: 140,
        address_de_extra_partial: 140,
        address_de_inline_street: 140,
        address_en_inline_street: 140,
        address_en_extra_block: 140,
        address_en_extra: 140,
        address_cn: 140,

        handle: 80,
        ref: 80,
        title: 80,
        money: 60,
        number: 60
      },

      // bbox clamp multipliers (by key group)
      bbox: {
        // default clamps
        default: {
          maxByPage: 0.30,   // viewport.width * ratio
          maxByEst: 1.45,    // est * multiplier
          wHardCapEstRatio: 2.2, // if w > est*ratio -> clamp to est*soft
          wSoftCapEstMul: 1.15
        },
        longValue: {
          maxByPage: 0.55,
          maxByEst: 2.20,
          wHardCapEstRatio: 2.8,
          wSoftCapEstMul: 1.60
        },
        address: {
          maxByPage: 0.60,
          maxByEst: 2.10,
          wHardCapEstRatio: 3.2,
          wSoftCapEstMul: 1.70
        },
        money: {
          maxByPage: 0.35,
          maxByEst: 1.80
        },
        manual_term: {
          maxByPage: 0.40,
          maxByEst: 1.80
        }
      },

      pad: {
        person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        company:     { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
        manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
        _default:    { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
      },

      shrinkLabels: {
        phone:   ["电话", "手机", "联系电话"],
        account: ["银行账号", "账号", "卡号", "银行卡号"],
        email:   ["邮箱"],
        address: ["地址"],
        bank:    ["开户行", "开户银行", "银行"]
      }
    },

    en: {
      maxMatchLen: {
        manual_term: 90,
        person_name: 40,
        company: 70,
        email: 90,
        phone: 60,
        account: 90,
        bank: 140,

        // legacy keys kept for compat
        address_de_street: 160,
        address_de_postal: 160,

        // ✅ address keys (whitelist expansion)
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
        number: 70
      },

      bbox: {
        default:   { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
        longValue: { maxByPage: 0.55, maxByEst: 2.20, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
        address:   { maxByPage: 0.60, maxByEst: 2.10, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
        money:     { maxByPage: 0.35, maxByEst: 1.80 },
        manual_term:{ maxByPage: 0.40, maxByEst: 1.80 }
      },

      pad: {
        person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        company:     { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
        manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
        _default:    { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
      },

      shrinkLabels: {
        phone:   ["Phone", "Mobile", "Tel", "Telephone"],
        account: ["Account", "Account No", "Account Number", "IBAN"],
        email:   ["Email", "E-mail"],
        address: ["Address"],
        bank:    ["Bank", "Bank Name"]
      }
    },

    de: {
      maxMatchLen: {
        manual_term: 90,
        person_name: 40,
        company: 70,
        email: 90,
        phone: 60,
        account: 90,
        bank: 140,

        // legacy keys kept for compat
        address_de_street: 160,
        address_de_postal: 160,

        // ✅ address keys (whitelist expansion)
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
        number: 70
      },

      bbox: {
        default:   { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 },
        longValue: { maxByPage: 0.55, maxByEst: 2.20, wHardCapEstRatio: 2.8, wSoftCapEstMul: 1.60 },
        address:   { maxByPage: 0.60, maxByEst: 2.10, wHardCapEstRatio: 3.2, wSoftCapEstMul: 1.70 },
        money:     { maxByPage: 0.35, maxByEst: 1.80 },
        manual_term:{ maxByPage: 0.40, maxByEst: 1.80 }
      },

      pad: {
        person_name: { pxW: 0.0020, pyH: 0.030, minX: 0.25, minY: 0.55 },
        company:     { pxW: 0.0045, pyH: 0.032, minX: 0.55, minY: 0.60 },
        manual_term: { pxW: 0.0040, pyH: 0.035, minX: 0.55, minY: 0.65 },
        _default:    { pxW: 0.0050, pyH: 0.045, minX: 0.55, minY: 0.75 }
      },

      shrinkLabels: {
        phone:   ["Telefon", "Tel", "Handy", "Mobil", "Mobile", "Phone"],
        account: ["Konto", "Kontonummer", "Account", "IBAN"],
        email:   ["E-mail", "Email"],
        address: ["Anschrift", "Adresse", "Address"],
        bank:    ["Bank", "Bankname"]
      }
    }
  };

  function getLangTuning(lang) {
    const L = String(lang || "").toLowerCase();
    return LANG_TUNING[L] || LANG_TUNING.zh;
  }

  // ======================================================
  // E) Phase beacon (UI language aligned, in-memory only)
  // - Updates window.__RasterExportLast.phase/phase2
  // - Also mirrors a concise line into #exportStatus if present
  // ======================================================
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

    // mirror to exportStatus (prepend one line; keep existing)
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
        // avoid infinite duplication
        if (!prev.startsWith(line)) el.textContent = line + "\n" + prev;
      }
    } catch (_) {}

    // optional event (in case main.js wants to listen later)
    try {
      window.dispatchEvent(new CustomEvent("raster:phase", {
        detail: { when: Date.now(), phase: String(phase || ""), phase2: String(phase2 || "") }
      }));
    } catch (_) {}
  }

  // --------- Safe dynamic loaders (no logs) ----------
  async function loadPdfJsIfNeeded() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return window.pdfjsLib;

    const base = pdfjsBaseUrl();

    // ✅ Prefer same-origin pdf.min.js (fixes CORS issues with fonts/CMaps in practice)
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

    // ✅ Prefer same-origin worker (critical: no fake worker / no CORS)
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
    } catch (_) {}

    // Fallback worker
    try {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
      }
    } catch (_) {}

    return window.pdfjsLib;
  }

  async function loadPdfLibIfNeeded() {
    if (window.PDFLib && window.PDFLib.PDFDocument) return window.PDFLib;

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

  // --------- Canvas helpers ----------
  function createCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.floor(w));
    c.height = Math.max(1, Math.floor(h));
    return c;
  }

  // ✅ SOLID BLACK ONLY — NO TEXT
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

  // --------- PDF render ----------
  async function renderPdfToCanvases(file, dpi) {
    const pdfjsLib = await loadPdfJsIfNeeded();
    const ab = await readFileAsArrayBuffer(file);

    // ✅ SAME-ORIGIN CMap + standard fonts base URLs (needed for correct text rendering)
    const BASE = pdfjsBaseUrl();

    const loadingTask = pdfjsLib.getDocument({
      data: ab,

      // ✅ keep consistent with probe
      disableFontFace: false,
      useSystemFonts: true,

      // CMaps (font character maps)
      cMapUrl: BASE + "cmaps/",
      cMapPacked: true,

      // Standard font data (LiberationSans, etc.)
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

  // --------- Manual terms parsing ----------
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
    // 1) explicit opts.manualTerms (string or array)
    const mt = opts && opts.manualTerms;
    let terms = [];

    if (Array.isArray(mt)) terms = mt.map(normalizeTerm).filter(Boolean);
    else if (typeof mt === "string") terms = splitTerms(mt);

    // 2) fallback to export snapshot (compat)
    if (!terms.length) {
      const snap = window.__export_snapshot || {};
      if (Array.isArray(snap.manualTerms)) terms = snap.manualTerms.map(normalizeTerm).filter(Boolean);
      else if (typeof snap.manualTerms === "string") terms = splitTerms(snap.manualTerms);
      else if (Array.isArray(snap.nameList)) terms = snap.nameList.map(normalizeTerm).filter(Boolean);
    }

    // cap for perf
    return dedupKeepOrder(terms, 24);
  }

  // --------- Manual terms regex helpers ----------
  function escapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Latin term: exact word match with boundaries (EN/DE)
  function makeLatinExactRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    const src = escapeRegExp(t);
    try { return new RegExp(`\\b${src}\\b`, "iu"); } catch (_) { return null; }
  }

  // CJK term: loose boundary (avoid attaching to other CJK blocks)
  // NOTE: Left boundary is consumed (group1), actual term is group2.
  function makeCjkLooseRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    const src = escapeRegExp(t);
    try { return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${src})(?=$|[^\\u4E00-\\u9FFF])`, "u"); } catch (_) { return null; }
  }

  // --------- Packs/Policy accessors (NO rules.js dependency) ----------
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

    // last resort: keep old behavior
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

  // --------- Rules -> matchers (from packs/policy) ----------
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

    // ✅ Manual terms matcher(s): highest priority
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

    // Built-in rules
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

    // Ensure manual first
    matchers.sort((a, b) => (a.key === "manual_term" ? -1 : 0) - (b.key === "manual_term" ? -1 : 0));

    return matchers;
  }

  // ======================================================
  // Mode A improvement: prefer items from stage3 probe (if exposed)
  // - stage3.js currently caches lastPdfPagesItems in-memory.
  // - This exporter can optionally read:
  //   window.lastPdfPagesItems OR window.__pdf_pages_items (compat).
  // ======================================================
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

  // --------- Text items -> rects (value-first, keep labels) ----------
  function textItemsToRects(pdfjsLib, viewport, textContentOrItems, matchers, lang) {
    const Util = pdfjsLib.Util;

    const tuning = getLangTuning(lang);

    // accept either:
    // - textContent = { items:[...] }
    // - items = [...]
    const items =
      Array.isArray(textContentOrItems) ? textContentOrItems :
      (textContentOrItems && Array.isArray(textContentOrItems.items)) ? textContentOrItems.items :
      [];

    if (!items.length || !matchers || !matchers.length) return [];

    // ✅ hard guard: avoid over-redacting if a rule accidentally matches huge spans
    const MAX_MATCH_LEN = Object.assign({}, (tuning && tuning.maxMatchLen) || {});

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

      // ✅ whitelist: address keys across packs
      const isAddressKey =
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn";

      if (key === "money") return "money";
      if (key === "manual_term") return "manual_term";
      if (isLongValueKey) return "longValue";
      if (isAddressKey) return "address";
      return "default";
    }

    // ✅ Better bbox: derive width from it.width * scaleX when possible.
    function bboxForItem(it, key) {
      const tx = Util.transform(viewport.transform, it.transform || [1, 0, 0, 1, 0, 0]);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);

      // scale factors
      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      // font height estimate
      let fontH = sy * 1.0;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
                Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 10;
      }
      fontH = clamp(fontH * 1.12, 6, 110);

      const s = String(it.str || "");

      // width: prefer it.width * sx (PDF.js width is in text space units)
      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      // fallback if width missing
      if (!Number.isFinite(w) || w <= 0) w = Math.max(8, s.length * fontH * 0.88);

      const est = Math.max(10, s.length * fontH * 0.90);

      const group = keyGroupForBBox(key);
      const bboxCfg = (tuning && tuning.bbox) || {};
      const cfg = bboxCfg[group] || bboxCfg.default || { maxByPage: 0.30, maxByEst: 1.45, wHardCapEstRatio: 2.2, wSoftCapEstMul: 1.15 };

      // hard cap extremely wide items
      const hardRatio = Number(cfg.wHardCapEstRatio || 2.2);
      const softMul = Number(cfg.wSoftCapEstMul || 1.15);
      if (w > est * hardRatio) w = est * softMul;

      const maxByPage = viewport.width * Number(cfg.maxByPage || 0.30);
      const maxByEst = est * Number(cfg.maxByEst || 1.45);
      w = clamp(w, 1, Math.min(maxByPage, maxByEst));

      const isLongValueKey =
        group === "longValue";

      const minW = isLongValueKey ? (est * 0.95) : (est * 0.85);
      w = Math.max(w, Math.min(minW, viewport.width * (isLongValueKey ? 0.40 : 0.20)));

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, 6, viewport.height - ry);

      return { x: rx, y: ry, w: rw, h: rh };
    }

    // ✅ shrinkByLabel: language-split vocab (reduce masking labels)
    function shrinkByLabel(key, s, ls, le) {
      if (key === "manual_term") return { ls, le }; // DO NOT shrink

      if (le <= ls) return { ls, le };
      const sub = s.slice(ls, le);

      const labels = (tuning && tuning.shrinkLabels) || {};
      function makeLabelPrefixRe(words) {
        if (!Array.isArray(words) || !words.length) return null;
        // Build: ^(?:A|B|C)\s*[:：]?\s*
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

    // Build pageText + item ranges
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

    // ✅ CRITICAL FIX:
    // Do NOT convert '\n' to spaces (it enables cross-line greedy matches).
    // Use a sentinel char that typical rules won't match (\u0000).
    const matchText = pageText.replace(/\n/g, "\u0000");

    // spans = {a,b,key,preferSub?}
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

        // ✅ length guard (avoid catastrophic over-redaction)
        const maxLen = MAX_MATCH_LEN[key] || 120;
        if ((b - a) > maxLen) continue;

        const m = h.m || [];
        const full = String(m[0] || "");

        // if match contains sentinel, skip
        if (full.indexOf("\u0000") >= 0) continue;

        // ✅ manual_term: adjust span to the real term (avoid left-boundary char in group1)
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
          // extra guard
          if ((b - a) <= 0 || (b - a) > (MAX_MATCH_LEN.manual_term || 90)) continue;

          spans.push({ a, b, key, preferSub: null });
          continue;
        }

        // keep preferSub logic for existing keys only
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

        } else if (key === "person_name") {
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

        } else if (key === "money") {
          const off = findSubOffsets(m[2] || m[4] || m[5]);
          if (off) preferSub = off;
        }

        spans.push({ a, b, key, preferSub });
      }
    }

    if (!spans.length) return [];

    // Merge spans (same key + overlap/close)
    spans.sort((x, y) => (x.a - y.a) || (x.b - y.b));
    const merged = [];
    const MERGE_GAP = 0; // tighter

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

    // Map spans -> rects
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

        // ✅ Key-aware padding (language tunable)
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

        // ✅ 人名宽度护栏
        if (key === "person_name") {
          const maxW = Math.min(viewport.width * 0.22, bb.w * 0.55);
          if (rw > maxW) continue;
        }

        // ✅ 公司核心词宽度护栏
        if (key === "company") {
          const maxW = Math.min(viewport.width * 0.18, bb.w * 0.45);
          if (rw > maxW) continue;
        }

        // ✅ 手工词条宽度护栏（防止误涂整行）
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

    // Conservative merge of rects on same line & same key only
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
      const sameLine = (overlap / minH) > 0.88;

      const heightRatio = Math.min(last.h, r.h) / Math.max(last.h, r.h);
      const similarHeight = heightRatio > 0.80;

      const gap = r.x - (last.x + last.w);
      const near = gap >= -1 && gap <= 2;

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

    return out.map(({ x, y, w, h }) => ({ x, y, w, h }));
  }

  async function autoRedactReadablePdf({ file, lang, enabledKeys, moneyMode, dpi, manualTerms }) {
    setRasterPhase("autoRedactReadablePdf:begin", null);

    const pdfjsLib = await loadPdfJsIfNeeded();
    const { pdf, pages } = await renderPdfToCanvases(file, dpi || DEFAULT_DPI);

    const matchers = buildRuleMatchers(lang, enabledKeys, moneyMode, manualTerms);
    const _placeholder = langPlaceholder(lang); // kept for compat (not used)

    // ---- status snapshot (no logs) ----
    try {
      const PACKS = window.__ENGINE_LANG_PACKS__ || {};
      const pack = PACKS[lang] || PACKS.zh || null;

      window.__RasterExportLast = {
        when: Date.now(),
        phase: "autoRedactReadablePdf",
        hasRules: !!(pack && pack.rules),
        enabledKeys: Array.isArray(enabledKeys) ? enabledKeys.slice() : [],
        moneyMode: moneyMode || "off",
        manualTerms: Array.isArray(manualTerms) ? manualTerms.slice() : [],
        matcherKeys: (matchers || []).map(m => m.key),
        pages: (pages || []).length,
        lang
      };
    } catch (_) {}

    // ✅ Prefer cached items from stage3 probe if available
    const cached = getCachedPagesItems();

    for (const p of pages) {
      setRasterPhase("autoRedactReadablePdf:page", `p${p.pageNumber}`);

      // text items source
      let itemsOrTextContent = null;

      const cachedItems = findCachedItemsForPage(cached, p.pageNumber);
      if (cachedItems && cachedItems.length) {
        itemsOrTextContent = cachedItems;
      } else {
        // fallback: query PDF.js textContent with probe-like options (stability)
        const page = await pdf.getPage(p.pageNumber);
        itemsOrTextContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
      }

      setRasterPhase("autoRedactReadablePdf:match", `p${p.pageNumber}`);
      const rects = textItemsToRects(pdfjsLib, p.viewport, itemsOrTextContent, matchers, lang);

      // ---- per-page debug snapshot (safe, in-memory only) ----
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
            rects: (Array.isArray(rects) ? rects.slice(0, 5) : [])
          }]),
          rectsTotal: (Number(last.rectsTotal) || 0) + rectCount
        });
      } catch (_) {}

      setRasterPhase("autoRedactReadablePdf:apply", `p${p.pageNumber}`);
      drawRedactionsOnCanvas(p.canvas, rects);
    }

    setRasterPhase("autoRedactReadablePdf:done", null);
    return pages;
  }

  // ✅ Image -> pages[] (and also compatible with {pages: [...]})
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

    // ✅ compat: allow callers to treat it as { pages: [...] }
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

  // ======================================================
  // Mode B visual tuning helper (optional UI hook)
  // - If redact-ui.js / styles are not available here, UI can call this
  //   to style selection rectangles for white backgrounds.
  // ======================================================
  function getModeBOverlayStyle() {
    // High-contrast on white paper: vivid stroke + translucent fill + dashed edge
    return {
      stroke: "rgba(0, 255, 240, 0.95)",
      strokeWidth: 2,
      dash: [6, 4],
      fill: "rgba(0, 255, 240, 0.18)",
      shadow: "rgba(0,0,0,0.35)", // optional if UI uses canvas shadow
      shadowBlur: 4
    };
  }

  // ======================================================
  // Public API
  // ======================================================
  const RasterExport = {
    async exportRasterSecurePdfFromReadablePdf(opts) {
      const file = opts && opts.file;
      if (!file) return;

      const lang = (opts && opts.lang) || "zh";
      const dpi = (opts && opts.dpi) || DEFAULT_DPI;

      const manualTerms = resolveManualTermsFromOptsOrSnapshot(opts);

      // ---- status snapshot before work ----
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
          dpi
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

      // ---- status snapshot before export ----
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
      // Accept both:
      // - result = { pages: [...], rectsByPage, dpi, filename }
      // - result = pagesArray (compat)
      const pages =
        (result && Array.isArray(result.pages)) ? result.pages :
        (Array.isArray(result)) ? result :
        null;

      if (!pages || !pages.length) return;

      const dpi = (result && result.dpi) ? result.dpi : DEFAULT_DPI;
      const _placeholder = langPlaceholder((result && result.lang) || "zh"); // kept for compat (not used)

      // ---- status snapshot ----
      try {
        window.__RasterExportLast = {
          when: Date.now(),
          phase: "exportRasterSecurePdfFromVisual",
          pages: pages.length,
          hasRectPages: !!(result && result.rectsByPage),
          lang: (result && result.lang) || "zh",
          dpi
        };
      } catch (_) {}

      setRasterPhase("exportVisual:apply", null);

      const rectsByPage = (result && result.rectsByPage) ? result.rectsByPage : {};
      for (const p of pages) {
        const pn = p && p.pageNumber ? p.pageNumber : 1;
        const rects = rectsByPage[pn] || [];
        if (p && p.canvas) drawRedactionsOnCanvas(p.canvas, rects);
      }

      const name = (result && result.filename) ? result.filename : `raster_secure_${Date.now()}.pdf`;
      setRasterPhase("exportVisual:export", null);
      await exportCanvasesToPdf(pages, dpi, name);
      setRasterPhase("exportVisual:done", null);
    },

    // UI helper for Mode B visibility
    getModeBOverlayStyle,

    // debugging/inspection hook (safe): expose tuning table
    LANG_TUNING,

    renderPdfToCanvases,
    renderImageToCanvas,
    drawRedactionsOnCanvas
  };

  // ---- minimal status beacon (no logs, in-memory only) ----
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
