/* =========================================================
 * raster-export.js
 * Raster Secure PDF export pipeline (in-memory only)
 * - PDF/image -> 600 DPI raster -> opaque redaction (pixels)
 * - Export PDF as images only (no text layer)
 * - NO OCR / NO logs / NO storage
 *
 * BOUNDARY
 * - raster-export.js: render / export orchestration only
 * - raster-core.js: text-items -> rects
 * - matcher-core.js: match-result generation
 * ======================================================= */

(function () {
  "use strict";

  const DEFAULT_DPI = 600;
  const PDFJS_VERSION = "3.11.174";

  let __pdfjsLoadPromise = null;
  let __pdflibLoadPromise = null;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function pdfjsBaseUrl() {
    return new URL(`./pdfjs/${PDFJS_VERSION}/`, document.baseURI || window.location.href).toString();
  }

  function getRasterCore() {
    return window.__RASTER_CORE__ || null;
  }

  function getMatcherCore() {
    const mc = window.__MATCHER_CORE__ || null;
    if (!mc) return null;
    if (typeof mc.match === "function") return mc;
    if (typeof mc.matchDocument === "function") return mc;
    return null;
  }

  function uiLang() {
    const l = String(window.currentLang || "").toLowerCase();
    return l === "de" || l === "en" || l === "zh" ? l : "zh";
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
      window.dispatchEvent(new CustomEvent("raster:phase", {
        detail: {
          when: Date.now(),
          phase: String(phase || ""),
          phase2: String(phase2 || "")
        }
      }));
    } catch (_) {}
  }

  function getRasterDebugConfig() {
    const dbg = window.__RASTER_DEBUG__;
    const base = dbg && typeof dbg === "object" ? dbg : {};
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
        throw lastErr || new Error("pdfjsLib not available");
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

    for (const r of rects || []) {
      const x = clamp(Number(r && r.x) || 0, 0, canvas.width);
      const y = clamp(Number(r && r.y) || 0, 0, canvas.height);
      const w = clamp(Number(r && r.w) || 0, 0, canvas.width - x);
      const h = clamp(Number(r && r.h) || 0, 0, canvas.height - y);
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

    for (let p = 1; p <= pdf.numPages; p += 1) {
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

  function getCachedPagesTextMap() {
    const map = new Map();

    try {
      const arr = window.__pdf_pages_text || window.lastPdfPagesText || [];
      if (Array.isArray(arr)) {
        for (const p of arr) {
          const pn = Number(p && p.pageNumber);
          if (!pn) continue;
          map.set(pn, String((p && p.text) || ""));
        }
      }
    } catch (_) {}

    return map;
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

  function buildMatcherDocFromCachedPages(cachedPages) {
    const pages = Array.isArray(cachedPages) ? cachedPages : [];
    const pagesTextMap = getCachedPagesTextMap();

    const outPages = pages.map((p, idx) => {
      const pageNumber = Number(p && p.pageNumber) || (idx + 1);
      const pageText = pagesTextMap.get(pageNumber) || "";

      return {
        pageNumber,
        text: pageText,
        items: Array.isArray(p && p.items)
          ? p.items.map((it) => ({
              str: it && it.str != null ? String(it.str) : "",
              transform: Array.isArray(it && it.transform) ? it.transform.slice(0, 6) : [1, 0, 0, 1, 0, 0],
              width: Number(it && it.width) || 0,
              height: Number(it && it.height) || 0,
              hasEOL: !!(it && it.hasEOL)
            }))
          : []
      };
    });

    const fullText = outPages
      .map((p) => String(p.text || ""))
      .filter(Boolean)
      .join("\n\n");

    return {
      text: fullText,
      pages: outPages,
      meta: { fromPdf: true }
    };
  }

  function hasUsablePdfMatcherDoc(doc) {
    return !!(
      doc &&
      Array.isArray(doc.pages) &&
      doc.pages.length &&
      doc.pages.some((p) => {
        const t = String((p && p.text) || "");
        const items = Array.isArray(p && p.items) ? p.items : [];
        return t.trim() || items.length;
      })
    );
  }

  function getStableMatchResult({ lang, enabledKeys, moneyMode, manualTerms, cachedPages }) {
    let unifiedMatchResult = null;

    try {
      const matcherCore = getMatcherCore();
      if (matcherCore && Array.isArray(cachedPages) && cachedPages.length) {
        const doc = buildMatcherDocFromCachedPages(cachedPages);
        if (hasUsablePdfMatcherDoc(doc)) {
          const fn = typeof matcherCore.match === "function" ? matcherCore.match : matcherCore.matchDocument;
          unifiedMatchResult = fn.call(matcherCore, {
            doc,
            lang,
            enabledKeys,
            moneyMode,
            manualTerms
          });
        }
      }
    } catch (_) {
      unifiedMatchResult = null;
    }

    try {
      if (!unifiedMatchResult) {
        const last = window.__MatcherLast;
        if (
          last &&
          last.source === "matcher-core" &&
          String(last.lang || "") === String(lang || "") &&
          Array.isArray(last.hits)
        ) {
          unifiedMatchResult = last;
        }
      }
    } catch (_) {
      unifiedMatchResult = null;
    }

    return unifiedMatchResult;
  }

  async function buildPageInputs({ pdf, pages, cachedPages }) {
    const pageInputs = [];

    for (const p of pages) {
      const cachedItems = findCachedItemsForPage(cachedPages, p.pageNumber);
      let itemsOrTextContent = null;

      if (cachedItems && cachedItems.length) {
        itemsOrTextContent = normalizeCachedItems(cachedItems);
      } else {
        const page = await pdf.getPage(p.pageNumber);
        itemsOrTextContent = await page.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
      }

      pageInputs.push({
        pageNumber: p.pageNumber,
        width: p.width,
        height: p.height,
        viewport: p.viewport,
        itemsOrTextContent
      });
    }

    return pageInputs;
  }

  function writeRasterRunMeta(meta) {
    try {
      const last = window.__RasterExportLast || {};
      window.__RasterExportLast = Object.assign({}, last, meta || {});
    } catch (_) {}
  }

  async function autoRedactReadablePdf({ file, lang, enabledKeys, moneyMode, dpi, manualTerms }) {
    setRasterPhase("autoRedactReadablePdf:begin", null);

    const rc = getRasterCore();
    if (!rc) throw new Error("Raster core not loaded");

    const pdfjsLib = await loadPdfJsIfNeeded();
    const { pdf, pages } = await renderPdfToCanvases(file, dpi || DEFAULT_DPI);
    const dbgCfg = getRasterDebugConfig();

    const matchers = rc.buildRuleMatchers(lang, enabledKeys, moneyMode, manualTerms);

    writeRasterRunMeta({
      when: Date.now(),
      phase: "autoRedactReadablePdf",
      hasMatcherCore: !!window.__MATCHER_CORE__,
      enabledKeys: Array.isArray(enabledKeys) ? enabledKeys.slice() : [],
      moneyMode: moneyMode || "off",
      manualTerms: Array.isArray(manualTerms) ? manualTerms.slice() : [],
      matcherKeys: (matchers || []).map((m) => m.key),
      pages: pages.length,
      lang,
      rasterDebug: Object.assign({}, dbgCfg)
    });

    const cachedPages = getCachedPagesItems();
    const unifiedMatchResult = getStableMatchResult({
      lang,
      enabledKeys,
      moneyMode,
      manualTerms,
      cachedPages
    });

    writeRasterRunMeta({
      matcherCoreMain: !!unifiedMatchResult,
      matcherCoreMainHitCount: Array.isArray(unifiedMatchResult && unifiedMatchResult.hits)
        ? unifiedMatchResult.hits.length
        : 0
    });

    const pageInputs = await buildPageInputs({
      pdf,
      pages,
      cachedPages
    });

    let unifiedRectResult = null;
    try {
      if (unifiedMatchResult && typeof rc.mapMatchResultToRects === "function") {
        unifiedRectResult = rc.mapMatchResultToRects({
          pdfjsLib,
          pages: pageInputs,
          matchResult: unifiedMatchResult,
          lang
        });
      }
    } catch (_) {
      unifiedRectResult = null;
    }

    let usedPerPageCoreFallback = false;
    let usedLegacyFallback = false;

    for (let idx = 0; idx < pages.length; idx += 1) {
      const p = pages[idx];
      const prepared = pageInputs[idx];
      const itemsOrTextContent = prepared ? prepared.itemsOrTextContent : null;

      setRasterPhase("autoRedactReadablePdf:page", `p${p.pageNumber}`);
      setRasterPhase("autoRedactReadablePdf:match", `p${p.pageNumber}`);

      let rects = [];
      let rectSource = "legacy-fallback";
      let coreHitCount = 0;
      let coreFailed = false;
      let coreError = "";
      let coreSpans = [];
      let coreDebug = null;
      let coreSummary = null;

      try {
        if (unifiedRectResult && Array.isArray(unifiedRectResult.pages)) {
          const pageRectData = unifiedRectResult.pages.find((x) => Number(x && x.pageIndex) === idx) || null;
          const pageRectList = pageRectData && Array.isArray(pageRectData.rects) ? pageRectData.rects : [];

          rects = pageRectList.map((r) => ({
            x: Number(r && r.x) || 0,
            y: Number(r && r.y) || 0,
            w: Number(r && r.w) || 0,
            h: Number(r && r.h) || 0,
            key: String((r && r.key) || "")
          }));

          coreSpans = typeof rc.buildSpansFromMatchResultForPage === "function"
            ? rc.buildSpansFromMatchResultForPage(unifiedMatchResult, p.pageNumber)
            : [];

          rectSource = "matcher-core-main";
          coreHitCount = Array.isArray(coreSpans) ? coreSpans.length : 0;
          coreSummary = unifiedMatchResult && unifiedMatchResult.summary ? unifiedMatchResult.summary : null;
          coreDebug = {
            mode: "match-result-main",
            pageNumber: p.pageNumber
          };
        } else {
          const coreRes = rc.tryMatcherCoreRectsForPage({
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
            usedPerPageCoreFallback = true;
            rects = Array.isArray(coreRes.rects) ? coreRes.rects : [];
            rectSource = coreRes.source || "matcher-core-page-fallback";
            coreHitCount = Number(coreRes.hitCount || 0);
            coreSpans = Array.isArray(coreRes.spans) ? coreRes.spans : [];
            coreDebug = coreRes.debug || null;
            coreSummary = coreRes.summary || null;
          } else {
            usedLegacyFallback = true;
            rects = rc.textItemsToRects(pdfjsLib, p.viewport, itemsOrTextContent, matchers, lang);
            rectSource = "legacy-fallback";
          }
        }
      } catch (e) {
        coreFailed = true;
        coreError = e && e.message ? String(e.message) : "matcher-core-error";
        usedLegacyFallback = true;
        rects = rc.textItemsToRects(pdfjsLib, p.viewport, itemsOrTextContent, matchers, lang);
        rectSource = "legacy-fallback";
      }

      const itemBoxes = rc.buildItemBoxes(pdfjsLib, p.viewport, itemsOrTextContent, lang);
      const pageDebug = {
        pageNumber: p.pageNumber,
        rects: Array.isArray(rects) ? rects.slice() : [],
        itemBoxes: Array.isArray(itemBoxes) ? itemBoxes.slice() : []
      };

      writeRasterRunMeta((() => {
        const last = window.__RasterExportLast || {};
        const prevPerPage = Array.isArray(last.perPage) ? last.perPage : [];

        const rectCount = Array.isArray(rects) ? rects.length : 0;
        const itemCount =
          Array.isArray(itemsOrTextContent) ? itemsOrTextContent.length :
          (itemsOrTextContent && Array.isArray(itemsOrTextContent.items)) ? itemsOrTextContent.items.length :
          0;

        return {
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
        };
      })());

      setRasterPhase("autoRedactReadablePdf:apply", `p${p.pageNumber}`);
      drawRedactionsOnCanvas(p.canvas, rects);

      if (dbgCfg.enabled) {
        drawDebugOverlay(p.canvas, pageDebug, dbgCfg);
      }
    }

    writeRasterRunMeta({
      usedPerPageCoreFallback,
      usedLegacyFallback,
      primaryRectSource: usedLegacyFallback
        ? "legacy-fallback"
        : (usedPerPageCoreFallback ? "matcher-core-page-fallback" : "matcher-core-main")
    });

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

    try {
      arr.pages = arr;
    } catch (_) {}

    return arr;
  }

  async function exportCanvasesToPdf(pages, dpi, filename) {
    setRasterPhase("exportCanvasesToPdf:begin", null);

    const PDFLib = await loadPdfLibIfNeeded();
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.create();

    for (const p of pages || []) {
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

      writeRasterRunMeta({
        when: Date.now(),
        phase: "exportRasterSecurePdfFromReadablePdf:begin",
        enabledKeys: Array.isArray(opts && opts.enabledKeys) ? (opts.enabledKeys || []).slice() : [],
        moneyMode: (opts && opts.moneyMode) || "off",
        manualTerms: manualTerms.slice(),
        lang,
        dpi,
        rasterDebug: getRasterDebugConfig()
      });

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

      writeRasterRunMeta({
        when2: Date.now(),
        phase2: "exportRasterSecurePdfFromReadablePdf:export",
        pages: (pages || []).length,
        filename: name
      });

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
      const dbgCfg = getRasterDebugConfig();

      writeRasterRunMeta({
        when: Date.now(),
        phase: "exportRasterSecurePdfFromVisual",
        pages: pages.length,
        hasRectPages: !!(result && result.rectsByPage),
        lang: (result && result.lang) || "zh",
        dpi,
        rasterDebug: dbgCfg
      });

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
    renderPdfToCanvases,
    renderImageToCanvas,
    drawRedactionsOnCanvas,
    drawDebugOverlay,
    getRasterDebugConfig
  };

  try {
    window.__RasterExportStatus = {
      loaded: true,
      time: Date.now()
    };
  } catch (_) {}

  window.RasterExport = RasterExport;
})();
