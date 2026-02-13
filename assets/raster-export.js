/* =========================================================
 * raster-export.js
 * Raster Secure PDF export pipeline (in-memory only)
 * - PDF/image -> 600 DPI raster -> opaque redaction + placeholder (pixels)
 * - Export PDF as images only (no text layer)
 * - NO OCR / NO logs / NO storage
 * ======================================================= */

/* =========================================================
 * raster-export.js
 * Raster Secure PDF export pipeline (in-memory only)
 * - PDF/image -> 600 DPI raster -> opaque redaction + placeholder (pixels)
 * - Export PDF as images only (no text layer)
 * - NO OCR / NO logs / NO storage
 * ======================================================= */

(function () {
  "use strict";

  const DEFAULT_DPI = 600;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function langPlaceholder(lang) {
    if (lang === "de") return "GESCHWÄRZT";
    if (lang === "en") return "REDACTED";
    return "已遮盖";
  }

  // --------- Safe dynamic loaders (no logs) ----------
  async function loadPdfJsIfNeeded() {
    // Prefer already loaded by your existing pdf.js probe loader
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return window.pdfjsLib;

    // Minimal fallback: try common CDN for pdf.js
    const url = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    // Worker
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } catch (_) {}

    if (!window.pdfjsLib) throw new Error("pdfjsLib not available");
    return window.pdfjsLib;
  }

  async function loadPdfLibIfNeeded() {
    // pdf-lib for assembling image-only PDF
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

  function drawRedactionsOnCanvas(canvas, rects, opt) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const placeholder = (opt && opt.placeholder) || "REDACTED";
    const fontScale = (opt && opt.fontScale) || 1;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (const r of (rects || [])) {
      const x = clamp(r.x, 0, canvas.width);
      const y = clamp(r.y, 0, canvas.height);
      const w = clamp(r.w, 0, canvas.width - x);
      const h = clamp(r.h, 0, canvas.height - y);
      if (w <= 0 || h <= 0) continue;

      // 100% opaque cover
      ctx.fillStyle = "#000";
      ctx.fillRect(x, y, w, h);

      // placeholder (pixel text)
      const fs = clamp(Math.min(h * 0.45, w * 0.12) * fontScale, 10, 64);
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText(placeholder, x + w / 2, y + h / 2);
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
    const loadingTask = pdfjsLib.getDocument({ data: ab });
    const pdf = await loadingTask.promise;

    const scale = (dpi || DEFAULT_DPI) / 72; // 72pt/in
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

  // --------- Rules -> matchers ----------
  function normalizeToRegExp(pat) {
    // Accept RegExp | string | {source, flags} | {pattern, flags}
    if (!pat) return null;

    if (pat instanceof RegExp) return pat;

    if (typeof pat === "string") {
      try { return new RegExp(pat, "g"); } catch (_) { return null; }
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

  function buildRuleMatchers(enabledKeys, moneyMode) {
    // ✅ 关键：与“文本过滤”保持同一套开关/定义
    // - 如果传入 enabledKeys：严格按 enabledKeys 过滤（money 仍受 moneyMode 控制）
    // - 如果 enabledKeys 为空/不可用：回退到 RULES_BY_KEY 全量（money 仍受 moneyMode 控制）
    const matchers = [];
    const src = window.RULES_BY_KEY || {};

    const keys = Array.isArray(enabledKeys) ? enabledKeys : [];
    const enabledSet = new Set(keys);

    const useAll = (keys.length === 0); // fallback only when truly unavailable

    for (const [k, r] of Object.entries(src)) {
      if (!r) continue;

      if (k === "money") {
        if (!moneyMode || moneyMode === "off") continue;
      } else {
        if (!useAll && !enabledSet.has(k)) continue;
      }

      const raw = (r.pattern != null) ? r.pattern
                : (r.re != null) ? r.re
                : (r.regex != null) ? r.regex
                : null;

      const re0 = normalizeToRegExp(raw);
      const re = forceGlobal(re0);
      if (!re) continue;

      matchers.push({ key: k, re });
    }

    return matchers;
  }

  // --------- Text items -> rects ----------
  function textItemsToRects(pdfjsLib, page, viewport, textContent, matchers) {
    const Util = pdfjsLib.Util;
    const items = (textContent && textContent.items) ? textContent.items : [];
    const rects = [];

    if (!items.length || !matchers || !matchers.length) return rects;

    function getAllMatchRanges(re, s) {
      const out = [];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s)) !== null) {
        const a = m.index;
        const b = a + String(m[0] || "").length;
        if (b > a) out.push([a, b]);
        if (m[0] === "") re.lastIndex++;
      }
      return out;
    }

    function bboxForItem(it) {
      const m = Util.transform(viewport.transform, it.transform);

      const w = Number(it.width || 0);
      let h = Number(it.height || 0);

      if (!Number.isFinite(h) || h <= 0) {
        h = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]) || 10;
        h = h * 1.15;
      }

      let ww = w;
      if (!Number.isFinite(ww) || ww <= 0) {
        const s = String(it.str || "");
        const approxCharW = (h * 0.55);
        ww = Math.max(approxCharW * s.length, 6);
      }

      function tp(x, y) {
        return {
          x: m[0] * x + m[2] * y + m[4],
          y: m[1] * x + m[3] * y + m[5]
        };
      }

      const p1 = tp(0, 0);
      const p2 = tp(ww, 0);
      const p3 = tp(0, h);
      const p4 = tp(ww, h);

      const xs = [p1.x, p2.x, p3.x, p4.x];
      const ys = [p1.y, p2.y, p3.y, p4.y];

      const minX = Math.min.apply(null, xs);
      const maxX = Math.max.apply(null, xs);
      const minY = Math.min.apply(null, ys);
      const maxY = Math.max.apply(null, ys);

      return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY)
      };
    }

    // 1) Build pageText (NO separators). Use hasEOL to add '\n' only at line end.
    let pageText = "";
    const itemRanges = []; // { idx, start, end }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const s = String(it.str || "");
      const start = pageText.length;
      pageText += s;
      const end = pageText.length;
      itemRanges.push({ idx: i, start, end });

      if (it && it.hasEOL) pageText += "\n";
    }

    // 2) Match on pageText
    const spans = [];
    for (const m of matchers) {
      const re0 = m.re;
      if (!(re0 instanceof RegExp)) continue;
      const flags = re0.flags.includes("g") ? re0.flags : (re0.flags + "g");
      let re;
      try { re = new RegExp(re0.source, flags); } catch (_) { continue; }
      const rs = getAllMatchRanges(re, pageText);
      for (const r of rs) spans.push(r);
    }
    if (!spans.length) return rects;

    // 3) Merge spans
    spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const mergedSpans = [];
    for (const sp of spans) {
      const last = mergedSpans[mergedSpans.length - 1];
      if (!last) { mergedSpans.push([sp[0], sp[1]]); continue; }
      if (sp[0] <= last[1] + 1) last[1] = Math.max(last[1], sp[1]);
      else mergedSpans.push([sp[0], sp[1]]);
    }

    // 4) Map spans back to items + slice bbox horizontally
    for (const [A, B] of mergedSpans) {
      for (const r of itemRanges) {
        const a = Math.max(A, r.start);
        const b = Math.min(B, r.end);
        if (b <= a) continue;

        const it = items[r.idx];
        const s = String(it.str || "");
        if (!s) continue;

        const localStart = a - r.start;
        const localEnd = b - r.start;

        const bb = bboxForItem(it);
        const len = Math.max(1, s.length);

        const x1 = bb.x + bb.w * (localStart / len);
        const x2 = bb.x + bb.w * (localEnd / len);

        // padding: small, conservative
        const padX = Math.max(1, bb.w * 0.006);
        const padY = Math.max(1, bb.h * 0.08);

        rects.push({
          x: x1 - padX,
          y: bb.y - padY,
          w: (x2 - x1) + padX * 2,
          h: bb.h + padY * 2
        });
      }
    }

    // 4.5) Clamp extreme-wide rects (prevent “black wall”)
    // If a single rect is wider than 45% of page width, we split it into 2–4 chunks.
    const MAX_W_RATIO = 0.45;
    const pageW = Number(viewport && viewport.width) || 0;
    const normalized = [];
    for (const r of rects) {
      if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

      if (pageW > 0 && r.w > pageW * MAX_W_RATIO) {
        const parts = Math.min(4, Math.max(2, Math.ceil(r.w / (pageW * 0.22))));
        const chunkW = r.w / parts;
        for (let i = 0; i < parts; i++) {
          normalized.push({
            x: r.x + i * chunkW,
            y: r.y,
            w: chunkW,
            h: r.h
          });
        }
      } else {
        normalized.push(r);
      }
    }

    // 5) Merge nearby rects (STRICT: avoid cross-column merge)
    normalized.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];
    for (const r of normalized) {
      const last = out[out.length - 1];
      if (!last) { out.push({ ...r }); continue; }

      // tighter y tolerance
      const yClose = Math.abs(last.y - r.y) < 4 || Math.abs((last.y + last.h) - (r.y + r.h)) < 4;

      // compute gap and overlap precisely
      const gap =
        (r.x > last.x + last.w) ? (r.x - (last.x + last.w))
        : (last.x > r.x + r.w) ? (last.x - (r.x + r.w))
        : 0;

      const overlapX = !(r.x > last.x + last.w || last.x > r.x + r.w);

      // merge only if real overlap OR tiny gap
      if (yClose && (overlapX || gap <= 2)) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);
        last.x = nx; last.y = ny; last.w = nr - nx; last.h = nb - ny;
      } else {
        out.push({ ...r });
      }
    }

    // Final clamp to canvas bounds
    const canvasW = Number(viewport && viewport.width) || 0;
    const canvasH = Number(viewport && viewport.height) || 0;
    for (const r of out) {
      r.x = clamp(r.x, 0, canvasW);
      r.y = clamp(r.y, 0, canvasH);
      r.w = clamp(r.w, 1, Math.max(1, canvasW - r.x));
      r.h = clamp(r.h, 1, Math.max(1, canvasH - r.y));
    }

    return out;
  }

  async function autoRedactReadablePdf({ file, lang, enabledKeys, moneyMode, dpi }) {
    const pdfjsLib = await loadPdfJsIfNeeded();
    const { pdf, pages } = await renderPdfToCanvases(file, dpi || DEFAULT_DPI);

    const matchers = buildRuleMatchers(enabledKeys, moneyMode);
    const placeholder = langPlaceholder(lang);

    for (const p of pages) {
      const page = await pdf.getPage(p.pageNumber);
      const textContent = await page.getTextContent();
      const rects = textItemsToRects(pdfjsLib, page, p.viewport, textContent, matchers);
      drawRedactionsOnCanvas(p.canvas, rects, { placeholder });
    }

    return pages;
  }

  // --------- Image -> single canvas ----------
  async function renderImageToCanvas(file, dpi) {
    const dataUrl = await readFileAsDataURL(file);
    const img = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = dataUrl;
    });
    if (!img) throw new Error("Image load failed");

    // Keep original pixels; treat as 600dpi for PDF sizing
    const c = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const ctx = c.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, c.width, c.height);

    return [{ pageNumber: 1, canvas: c, width: c.width, height: c.height, dpi: dpi || DEFAULT_DPI }];
  }

  // --------- Export canvases to image-only PDF ----------
  async function exportCanvasesToPdf(pages, dpi, filename) {
    const PDFLib = await loadPdfLibIfNeeded();
    const { PDFDocument } = PDFLib;

    const doc = await PDFDocument.create();

    for (const p of pages) {
      const pngBytes = await canvasToPngBytes(p.canvas);
      const png = await doc.embedPng(pngBytes);

      const pageWpt = (p.width * 72) / (dpi || DEFAULT_DPI);
      const pageHpt = (p.height * 72) / (dpi || DEFAULT_DPI);

      const page = doc.addPage([pageWpt, pageHpt]);
      page.drawImage(png, {
        x: 0,
        y: 0,
        width: pageWpt,
        height: pageHpt
      });
    }

    const pdfBytes = await doc.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    downloadBlob(blob, filename || `raster_secure_${Date.now()}.pdf`);
  }

  // ======================================================
  // Public API
  // ======================================================
  const RasterExport = {
    // Mode A: readable PDF -> auto redact -> export
    async exportRasterSecurePdfFromReadablePdf(opts) {
      const file = opts && opts.file;
      if (!file) return;
      const lang = (opts && opts.lang) || "zh";
      const dpi = (opts && opts.dpi) || DEFAULT_DPI;

      const pages = await autoRedactReadablePdf({
        file,
        lang,
        enabledKeys: (opts && opts.enabledKeys) || [],
        moneyMode: (opts && opts.moneyMode) || "off",
        dpi
      });

      const name = (opts && opts.filename) || `raster_secure_${Date.now()}.pdf`;
      await exportCanvasesToPdf(pages, dpi, name);
    },

    // Mode B: visual result from UI -> export
    async exportRasterSecurePdfFromVisual(result) {
      if (!result || !result.pages || !result.pages.length) return;
      const lang = result.lang || "zh";
      const dpi = result.dpi || DEFAULT_DPI;
      const placeholder = langPlaceholder(lang);

      const rectsByPage = result.rectsByPage || {};
      for (const p of result.pages) {
        const rects = rectsByPage[p.pageNumber] || [];
        drawRedactionsOnCanvas(p.canvas, rects, { placeholder });
      }

      const name = result.filename || `raster_secure_${Date.now()}.pdf`;
      await exportCanvasesToPdf(result.pages, dpi, name);
    },

    // Utilities used by RedactUI (optional use)
    renderPdfToCanvases,
    renderImageToCanvas,
    drawRedactionsOnCanvas
  };

  window.RasterExport = RasterExport;
})();


