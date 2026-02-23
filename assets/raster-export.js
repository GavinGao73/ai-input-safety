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

  // --------- Text items -> rects (value-first, keep labels) ----------
  function textItemsToRects(pdfjsLib, viewport, textContent, matchers) {
    const Util = pdfjsLib.Util;
    const items = (textContent && textContent.items) ? textContent.items : [];
    if (!items.length || !matchers || !matchers.length) return [];

    // ✅ hard guard: avoid over-redacting if a rule accidentally matches huge spans
    const MAX_MATCH_LEN = {
      manual_term: 90,
      person_name: 40,
      company: 60,
      email: 80,
      phone: 50,
      account: 80,
      bank: 120,
      address_de_street: 140,
      address_de_postal: 140,
      handle: 80,
      ref: 80,
      title: 80,
      money: 60,
      number: 60
    };

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

    function bboxForItem(it, key) {
      const tx = Util.transform(viewport.transform, it.transform);

      const x = tx[4];
      const y = tx[5];

      let fontH = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || 10;
      fontH = clamp(fontH * 1.12, 6, 110);

      const s = String(it.str || "");

      let w = Number(it.width || 0);
      if (!Number.isFinite(w) || w <= 0) w = Math.max(8, s.length * fontH * 0.88);

      const est = Math.max(10, s.length * fontH * 0.90);

      if (w > est * 2.2) w = est * 1.15;

      const isLongValueKey =
        key === "account" || key === "phone" || key === "email" || key === "bank";

      const isAddressKey =
        key === "address_de_street" || key === "address_de_postal";

      let maxByPage = viewport.width * 0.30;
      let maxByEst = est * 1.45;

      if (isLongValueKey) {
        maxByPage = viewport.width * 0.55;
        maxByEst = est * 2.20;
        if (w > est * 2.8) w = est * 1.60;
      } else if (isAddressKey) {
        maxByPage = viewport.width * 0.60;
        maxByEst = est * 2.10;
        if (w > est * 3.2) w = est * 1.70;
      } else if (key === "money") {
        maxByPage = viewport.width * 0.35;
        maxByEst = est * 1.80;
      } else if (key === "manual_term") {
        maxByPage = viewport.width * 0.40;
        maxByEst = est * 1.80;
      }

      w = clamp(w, 1, Math.min(maxByPage, maxByEst));

      const minW = isLongValueKey ? (est * 0.95) : (est * 0.85);
      w = Math.max(w, Math.min(minW, viewport.width * (isLongValueKey ? 0.40 : 0.20)));

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, 6, viewport.height - ry);

      return { x: rx, y: ry, w: rw, h: rh };
    }

    function shrinkByLabel(key, s, ls, le) {
      // ✅ manual_term: DO NOT shrink; exact cover
      if (key === "manual_term") return { ls, le };

      if (le <= ls) return { ls, le };
      const sub = s.slice(ls, le);

      if (key === "phone") {
        const mm = sub.match(/^(电话|手机|联系电话|Tel\.?|Telefon|Phone|Mobile|Handy)\s*[:：]?\s*/i);
        if (mm && mm[0]) ls += mm[0].length;
      } else if (key === "account") {
        const mm = sub.match(/^(银行账号|账号|卡号|银行卡号|Konto|Account|IBAN)\s*[:：]?\s*/i);
        if (mm && mm[0]) ls += mm[0].length;
      } else if (key === "email") {
        const mm = sub.match(/^(邮箱|E-?mail)\s*[:：]?\s*/i);
        if (mm && mm[0]) ls += mm[0].length;
      } else if (key === "address_de_street" || key === "address_de_postal") {
        const mm = sub.match(/^(地址|Anschrift|Address)\s*[:：]?\s*/i);
        if (mm && mm[0]) ls += mm[0].length;
      } else if (key === "bank") {
        const mm = sub.match(/^(开户行|开户银行|银行)\s*[:：]?\s*/i);
        if (mm && mm[0]) ls += mm[0].length;
      }

      const weakTrim = (ch) => {
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
        return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
      };

      while (ls < le && weakTrim(s[ls])) ls++;
      while (le > ls && weakTrim(s[le - 1])) le--;

      return { ls, le };
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

        // ✅ Key-aware padding
        let padX, padY;

        if (key === "person_name") {
          padX = Math.max(0.25, bb.w * 0.002);
          padY = Math.max(0.55, bb.h * 0.030);

        } else if (key === "company") {
          padX = Math.max(0.55, bb.w * 0.0045);
          padY = Math.max(0.60, bb.h * 0.032);

        } else if (key === "manual_term") {
          padX = Math.max(0.55, bb.w * 0.0040);
          padY = Math.max(0.65, bb.h * 0.035);

        } else {
          padX = Math.max(0.55, bb.w * 0.005);
          padY = Math.max(0.75, bb.h * 0.045);
        }

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

    for (const p of pages) {
      const page = await pdf.getPage(p.pageNumber);
      const textContent = await page.getTextContent();
      const rects = textItemsToRects(pdfjsLib, p.viewport, textContent, matchers);

      // ---- per-page debug snapshot (safe, in-memory only) ----
      try {
        const last = window.__RasterExportLast || {};
        const prevPerPage = Array.isArray(last.perPage) ? last.perPage : [];

        const rectCount = Array.isArray(rects) ? rects.length : 0;

        window.__RasterExportLast = Object.assign({}, last, {
          perPage: prevPerPage.concat([{
            pageNumber: p.pageNumber,
            items: (textContent && textContent.items) ? textContent.items.length : 0,
            rectCount,
            rects: (Array.isArray(rects) ? rects.slice(0, 5) : [])
          }]),
          rectsTotal: (Number(last.rectsTotal) || 0) + rectCount
        });
      } catch (_) {}

      drawRedactionsOnCanvas(p.canvas, rects);
    }

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

    const pdfBytes = await doc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(blob, filename || `raster_secure_${Date.now()}.pdf`);
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

      await exportCanvasesToPdf(pages, dpi, name);
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

      const rectsByPage = (result && result.rectsByPage) ? result.rectsByPage : {};
      for (const p of pages) {
        const pn = p && p.pageNumber ? p.pageNumber : 1;
        const rects = rectsByPage[pn] || [];
        if (p && p.canvas) drawRedactionsOnCanvas(p.canvas, rects);
      }

      const name = (result && result.filename) ? result.filename : `raster_secure_${Date.now()}.pdf`;
      await exportCanvasesToPdf(pages, dpi, name);
    },

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

