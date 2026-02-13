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

  // --------- Rules -> redaction rects (conservative item-level) ----------
  function buildRuleMatchers(enabledKeys, moneyMode) {
    // expects global RULES_BY_KEY from your rules.js
    const keys = Array.isArray(enabledKeys) ? enabledKeys : [];
    const matchers = [];

    const PRIORITY = [
      "email",
      "bank",
      "account",
      "phone",
      "money",
      "address_de_street",
      "handle",
      "ref",
      "title",
      "number"
    ];

    for (const k of PRIORITY) {
      if (k !== "money" && keys.indexOf(k) === -1) continue;
      if (k === "money" && (!moneyMode || moneyMode === "off")) continue;

      const r = (window.RULES_BY_KEY && window.RULES_BY_KEY[k]) || null;
      if (!r || !r.pattern) continue;

      // Ensure global regex
      let pat = r.pattern;
      if (!(pat instanceof RegExp)) continue;
      const flags = pat.flags.includes("g") ? pat.flags : (pat.flags + "g");
      pat = new RegExp(pat.source, flags);

      matchers.push({ key: k, re: pat });
    }
    return matchers;
  }

  function textItemsToRects(pdfjsLib, page, viewport, textContent, matchers) {
    const rects = [];
    const items = (textContent && textContent.items) ? textContent.items : [];
    const Util = pdfjsLib.Util;

    for (const it of items) {
      const s = String(it.str || "");
      if (!s) continue;

      let hit = false;
      for (const m of matchers) {
        m.re.lastIndex = 0;
        if (m.re.test(s)) { hit = true; break; }
      }
      if (!hit) continue;

      // Conservative: cover whole text item box
      // Based on common pdf.js mapping approach
      const tx = Util.transform(viewport.transform, it.transform);
      const x = tx[4];
      const y = tx[5];

      // Height estimate: vector length of [tx[2], tx[3]] or [tx[0], tx[1]]
      const fontH = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || 10;

      // Width: use it.width * viewport.scale if width seems unscaled
      // In many builds, it.width is already in viewport units; we clamp to safe.
      let w = Number(it.width || 0);
      if (!Number.isFinite(w) || w <= 0) w = s.length * fontH * 0.55;
      // Heuristic: if w is too small, scale it
      if (w < 2) w = s.length * fontH * 0.55;

      // PDF coords: y is baseline; convert to canvas coords (top-left origin)
      const canvasH = Math.floor(viewport.height);
      const rect = {
        x: clamp(x, 0, viewport.width),
        y: clamp(canvasH - y - fontH, 0, viewport.height),
        w: clamp(w, 1, viewport.width),
        h: clamp(fontH * 1.15, 6, 120)
      };
      rects.push(rect);
    }

    // Merge near-overlapping rects a bit (simple)
    rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const merged = [];
    for (const r of rects) {
      const last = merged[merged.length - 1];
      if (!last) { merged.push({ ...r }); continue; }
      const yClose = Math.abs((last.y + last.h) - (r.y + r.h)) < 8 || Math.abs(last.y - r.y) < 8;
      const overlapX = !(r.x > last.x + last.w + 6 || last.x > r.x + r.w + 6);
      if (yClose && overlapX) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);
        last.x = nx; last.y = ny; last.w = nr - nx; last.h = nb - ny;
      } else {
        merged.push({ ...r });
      }
    }

    return merged;
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
    // Mode A: readable PDF -> auto redact (conservative) -> export
    async exportRasterSecurePdfFromReadablePdf(opts) {
      // opts: { file, lang, enabledKeys, moneyMode, dpi, filename }
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
    // result: { pages:[{canvas,width,height}], rectsByPage?:{[pageNumber]:rect[]}, lang, dpi, filename }
    async exportRasterSecurePdfFromVisual(result) {
      if (!result || !result.pages || !result.pages.length) return;
      const lang = result.lang || "zh";
      const dpi = result.dpi || DEFAULT_DPI;
      const placeholder = langPlaceholder(lang);

      // Apply rects if provided
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

