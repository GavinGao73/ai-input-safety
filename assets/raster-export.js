/* =========================================================
 * raster-export.js
 * Raster Secure PDF export pipeline (in-memory only)
 * - PDF/image -> 600 DPI raster -> opaque redaction + placeholder (pixels)
 * - Export PDF as images only (no text layer)
 * - NO OCR / NO logs / NO storage
 *
 * ✅ ABSOLUTE CONSISTENCY MODE:
 *   - PDF redaction uses the SAME enabledKeys + moneyMode as text mode
 *   - i.e. "text hits what, PDF covers what"
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
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return window.pdfjsLib;

    const url = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } catch (_) {}

    if (!window.pdfjsLib) throw new Error("pdfjsLib not available");
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

function drawRedactionsOnCanvas(canvas, rects, opt) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const placeholder = (opt && opt.placeholder) || "REDACTED";
  const fontScale = (opt && opt.fontScale) || 1;

  const rs = Array.isArray(rects) ? rects.slice() : [];
  if (!rs.length) return;

  // ✅ 阅读顺序：先按 y 再按 x，便于做“相邻不重复写字”
  rs.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // ✅ 标签节流阈值：相邻两个块如果“很近”，后一个不写字
  // 可调：越大越少字。你这个案例建议 28~40
  const NEAR_PX = (opt && opt.nearPx) || 34;

  // ✅ 只有足够大的遮罩才考虑写字（避免短条噪音）
  function canLabel(w, h) {
    const area = w * h;
    return (w >= 180 && h >= 22) || (area >= 9000 && h >= 18);
  }

  // ✅ 判断两个矩形是否“很近”（横向或纵向接近即可）
  function isNear(prev, cur) {
    // 计算两矩形的最短边缘距离（轴对齐）
    const dx = Math.max(0, Math.max(prev.x - (cur.x + cur.w), cur.x - (prev.x + prev.w)));
    const dy = Math.max(0, Math.max(prev.y - (cur.y + cur.h), cur.y - (prev.y + prev.h)));
    // 同行/同列常见：dx 或 dy 很小就算近
    return (dx <= NEAR_PX && dy <= NEAR_PX);
  }

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  let lastLabeled = null; // 记录上一个“写过字”的遮罩块

  for (const r0 of rs) {
    // clamp + sanitize
    const x = clamp(r0.x, 0, canvas.width);
    const y = clamp(r0.y, 0, canvas.height);
    const w = clamp(r0.w, 0, canvas.width - x);
    const h = clamp(r0.h, 0, canvas.height - y);
    if (w <= 0 || h <= 0) continue;

    // 1) always cover
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, w, h);

    // 2) label decision
    if (!canLabel(w, h)) continue;

    // 如果离上一个“已写字”的块太近：不再写字
    if (lastLabeled && isNear(lastLabeled, { x, y, w, h })) continue;

    const fs = clamp(Math.min(h * 0.45, w * 0.12) * fontScale, 10, 64);
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.fillText(placeholder, x + w / 2, y + h / 2);

    lastLabeled = { x, y, w, h };
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

  // --------- Rules -> matchers (ABSOLUTE CONSISTENCY) ----------
  function buildRuleMatchers(enabledKeys, moneyMode) {
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

    const rules = window.RULES_BY_KEY || {};
    const matchers = [];

    const enabledSet = new Set(Array.isArray(enabledKeys) ? enabledKeys : []);

    // Accept RegExp | string | {source, flags} | {pattern, flags}
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

    for (const k of PRIORITY) {
      if (k === "money") {
        if (!moneyMode || moneyMode === "off") continue;
      } else {
        if (!enabledSet.has(k)) continue;
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

      matchers.push({ key: k, re });
    }

    return matchers;
  }

  // --------- Text items -> rects ----------
  function textItemsToRects(pdfjsLib, viewport, textContent, matchers) {
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

    // ✅ 核心修复：安全 bbox（避免 double-scaling 导致整行黑墙）
    function bboxForItem(it) {
  const tx = Util.transform(viewport.transform, it.transform);

  const x = tx[4];
  const y = tx[5];

  // height estimate from transform
  let fontH = Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || 10;
  fontH = clamp(fontH * 1.15, 6, 120);

  // width: prefer it.width
  let w = Number(it.width || 0);
  if (!Number.isFinite(w) || w <= 0) {
    const s0 = String(it.str || "");
    w = Math.max(6, s0.length * fontH * 0.55);
  }

  const s = String(it.str || "");

  // 估宽：更贴近实际（中文/混排）
  const est = Math.max(10, s.length * fontH * 0.95);

  // ✅ 上限更紧：避免长黑条（从 0.75 -> 0.55；est*3.2 -> est*2.2）
  w = clamp(w, 1, Math.min(viewport.width * 0.55, est * 2.2));

  // ✅ 关键：不要再用 viewport.width*0.40 当下限（这就是“过宽”的主要来源）
  // 只给一个非常温和的下限，防止极端情况下太窄：
  w = Math.max(w, Math.min(est * 0.95, 220));

  // top-left box
  const rx = clamp(x, 0, viewport.width);
  const ry = clamp(y - fontH, 0, viewport.height);
  const rw = clamp(w, 1, viewport.width - rx);
  const rh = clamp(fontH, 6, viewport.height - ry);

  return { x: rx, y: ry, w: rw, h: rh };
}

    function isWs(ch) {
      return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
    }

    function shouldInsertSpace(prevChar, nextChar) {
      if (!prevChar || !nextChar) return false;
      if (isWs(prevChar) || isWs(nextChar)) return false;

      // only between ASCII word/digit blocks (avoid messing CJK)
      const a = /[A-Za-z0-9]/.test(prevChar);
      const b = /[A-Za-z0-9]/.test(nextChar);
      return a && b;
    }

    // 1) Build pageText similar to probe.text
    let pageText = "";
    const itemRanges = []; // { idx, start, end, len }

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

      itemRanges.push({ idx: i, start, end, len: Math.max(1, s.length) });

      if (it && it.hasEOL) pageText += "\n";
    }

    // 2) Match spans on pageText (keep key)
    const spans = [];
    for (const m of matchers) {
      const re0 = m.re;
      if (!(re0 instanceof RegExp)) continue;

      const flags = re0.flags.includes("g") ? re0.flags : (re0.flags + "g");
      let re;
      try { re = new RegExp(re0.source, flags); } catch (_) { continue; }

      const rs = getAllMatchRanges(re, pageText);
      for (const [a, b] of rs) spans.push({ a, b, key: m.key });
    }
    if (!spans.length) return rects;

    // 3) Merge spans (within same key)
    spans.sort((x, y) =>
      (x.key > y.key ? 1 : x.key < y.key ? -1 : (x.a - y.a) || (x.b - y.b))
    );

    const mergedSpans = [];
    for (const sp of spans) {
      const last = mergedSpans[mergedSpans.length - 1];
      if (!last || last.key !== sp.key) {
        mergedSpans.push({ ...sp });
        continue;
      }
      if (sp.a <= last.b + 1) last.b = Math.max(last.b, sp.b);
      else mergedSpans.push({ ...sp });
    }

    // 4) Map spans back to items (trim weak punct)
    for (const sp of mergedSpans) {
      const A = sp.a;
      const B = sp.b;
      const hitKey = sp.key;

      for (const r of itemRanges) {
        const a = Math.max(A, r.start);
        const b = Math.min(B, r.end);
        if (b <= a) continue;

        const it = items[r.idx];
        const s = String(it.str || "");
        if (!s) continue;

        const localStart = a - r.start;
        const localEnd = b - r.start;

        let ls = localStart;
        let le = localEnd;

        const weakTrim = (ch) => {
          if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
          return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
        };

        while (ls < le && weakTrim(s[ls])) ls++;
        while (le > ls && weakTrim(s[le - 1])) le--;
        if (le <= ls) continue;

        const bb = bboxForItem(it);
        const len = Math.max(1, s.length);

        const x1 = bb.x + bb.w * (ls / len);
        const x2 = bb.x + bb.w * (le / len);

        const tight = (hitKey === "email" || hitKey === "account");
        const padX = tight ? Math.max(0.4, bb.w * 0.006) : Math.max(0.8, bb.w * 0.010);
        const padY = tight ? Math.max(0.8, bb.h * 0.060) : Math.max(1.0, bb.h * 0.075);

        let rx = x1 - padX;
        let ry = bb.y - padY;
        let rw = (x2 - x1) + padX * 2;
        let rh = bb.h + padY * 2;

        rx = clamp(rx, 0, viewport.width);
        ry = clamp(ry, 0, viewport.height);
        rw = clamp(rw, 1, viewport.width - rx);
        rh = clamp(rh, 6, viewport.height - ry);

        // Drop absurd rectangles
        if (rw > viewport.width * 0.92) continue;
        if (rh > viewport.height * 0.35) continue;
        if (rw > viewport.width * 0.85 && rh > viewport.height * 0.20) continue;

        rects.push({ x: rx, y: ry, w: rw, h: rh, key: hitKey });
      }
    }

    // 5) Conservative merge: same line only (and same key)
    rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    const out = [];
    for (const r of rects) {
      if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

      const last = out[out.length - 1];
      if (!last) { out.push({ ...r }); continue; }

      if ((last.key || "") !== (r.key || "")) {
        out.push({ ...r });
        continue;
      }

      const rTop = r.y;
      const rBot = r.y + r.h;
      const lTop = last.y;
      const lBot = last.y + last.h;

      const overlap = Math.max(0, Math.min(lBot, rBot) - Math.max(lTop, rTop));
      const minH = Math.max(1, Math.min(last.h, r.h));

      const sameLine = (overlap / minH) > 0.82;

      const heightRatio = Math.min(last.h, r.h) / Math.max(last.h, r.h);
      const similarHeight = heightRatio > 0.78;

      const gap = r.x - (last.x + last.w);
      const near = gap >= -2 && gap <= 4;

      if (sameLine && similarHeight && near) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);

        last.x = nx;
        last.y = ny;
        last.w = nr - nx;
        last.h = nb - ny;
      } else {
        out.push({ ...r });
      }
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
      const rects = textItemsToRects(pdfjsLib, p.viewport, textContent, matchers);
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
