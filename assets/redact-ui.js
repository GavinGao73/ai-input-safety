/* =========================================================
 * redact-ui.js
 * Minimal manual redaction UI (in-memory only)
 * - Fullscreen overlay with canvas preview (PDF multi-page / image single page)
 * - Drag to create rectangles per page
 * - Returns {pages, rectsByPage, lang, dpi, filename} for RasterExport
 * ======================================================= */

(function () {
  "use strict";

  const DPI = 600;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function langText(lang) {
    const zh = {
      title: "人工处理（框选遮盖区域）",
      tip: "拖拽框选要遮盖的区域；可多次框选。右上角导出。",
      prev: "上一页",
      next: "下一页",
      clearPage: "清空本页",
      clearAll: "清空全部",
      export: "导出红删PDF",
      cancel: "关闭",
      page: (i, n) => `第 ${i}/${n} 页`
    };
    const de = {
      title: "Manuell (Bereiche markieren)",
      tip: "Ziehen, um Bereiche zu schwärzen. Mehrfach möglich. Oben rechts exportieren.",
      prev: "Zurück",
      next: "Weiter",
      clearPage: "Seite löschen",
      clearAll: "Alles löschen",
      export: "Raster-PDF exportieren",
      cancel: "Schließen",
      page: (i, n) => `Seite ${i}/${n}`
    };
    const en = {
      title: "Manual redaction",
      tip: "Drag to mark areas. Multiple selections allowed. Export on top-right.",
      prev: "Prev",
      next: "Next",
      clearPage: "Clear page",
      clearAll: "Clear all",
      export: "Export redacted PDF",
      cancel: "Close",
      page: (i, n) => `Page ${i}/${n}`
    };
    return lang === "de" ? de : lang === "en" ? en : zh;
  }

  function createOverlay(lang) {
    const L = langText(lang);

    const root = document.createElement("div");
    root.style.cssText = `
      position:fixed; inset:0; z-index:999999;
      background:rgba(10,12,16,.92);
      display:flex; flex-direction:column;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      color:#fff;
    `;

    root.innerHTML = `
      <div class="rui-top" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.12);">
        <div style="font-weight:800; font-size:14px; opacity:.95;">${L.title}</div>
        <div class="rui-page" style="margin-left:auto; font-size:12px; opacity:.70;"></div>
        <button class="rui-btn rui-export" style="border:0; padding:8px 10px; border-radius:10px; background:#2f7cff; color:#fff; font-weight:700; cursor:pointer;">${L.export}</button>
        <button class="rui-btn rui-cancel" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.cancel}</button>
      </div>

      <div class="rui-tip" style="padding:10px 14px; font-size:12px; opacity:.72;">
        ${L.tip}
      </div>

      <div class="rui-body" style="flex:1; display:flex; flex-direction:column; gap:10px; padding:10px 14px;">
        <div class="rui-canvas-wrap" style="flex:1; display:flex; justify-content:center; align-items:center; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10); border-radius:14px; overflow:hidden;">
          <canvas class="rui-canvas" style="max-width:100%; max-height:100%;"></canvas>
        </div>

        <div class="rui-bar" style="display:flex; align-items:center; gap:10px;">
          <button class="rui-btn rui-prev" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.prev}</button>
          <button class="rui-btn rui-next" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.next}</button>

          <div style="margin-left:auto; display:flex; gap:10px;">
            <button class="rui-btn rui-clear-page" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.clearPage}</button>
            <button class="rui-btn rui-clear-all" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.clearAll}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    return root;
  }

  function drawPreview(baseCanvas, overlayCanvas, rects) {
    const ctx = overlayCanvas.getContext("2d");
    overlayCanvas.width = baseCanvas.width;
    overlayCanvas.height = baseCanvas.height;

    // draw base
    ctx.drawImage(baseCanvas, 0, 0);

    // draw rect outlines (visual only; actual redact applied later in RasterExport)
    ctx.save();
    ctx.lineWidth = Math.max(2, Math.round(baseCanvas.width / 500));
    ctx.strokeStyle = "rgba(255,255,255,.90)";
    ctx.fillStyle = "rgba(255,255,255,.14)";

    for (const r of rects) {
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  async function start(opts) {
    const file = opts && opts.file;
    const fileKind = (opts && opts.fileKind) || "";
    const lang = (opts && opts.lang) || "zh";
    if (!file) return null;
    if (!window.RasterExport) throw new Error("RasterExport missing");

    const ui = createOverlay(lang);
    const canvas = $(".rui-canvas", ui);
    const pageLabel = $(".rui-page", ui);
    const btnPrev = $(".rui-prev", ui);
    const btnNext = $(".rui-next", ui);
    const btnClearPage = $(".rui-clear-page", ui);
    const btnClearAll = $(".rui-clear-all", ui);
    const btnExport = $(".rui-export", ui);
    const btnCancel = $(".rui-cancel", ui);
    const L = langText(lang);

    // Prepare pages (base canvases)
    let pages = [];
    if (fileKind === "image") {
      pages = await window.RasterExport.renderImageToCanvas(file, DPI);
    } else {
      // pdf
      const rendered = await window.RasterExport.renderPdfToCanvases(file, DPI);
      pages = rendered.pages;
    }

    const rectsByPage = {}; // { [pageNumber]: [{x,y,w,h}] }
    pages.forEach(p => { rectsByPage[p.pageNumber] = rectsByPage[p.pageNumber] || []; });

    let idx = 0;

    // Use an offscreen overlay canvas for drawing rect previews
    const overlayCanvas = document.createElement("canvas");

    function updatePageUI() {
      const p = pages[idx];
      const rects = rectsByPage[p.pageNumber] || [];
      drawPreview(p.canvas, overlayCanvas, rects);
      canvas.width = overlayCanvas.width;
      canvas.height = overlayCanvas.height;
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);

      if (pageLabel) pageLabel.textContent = L.page(idx + 1, pages.length);
      btnPrev.disabled = idx <= 0;
      btnNext.disabled = idx >= pages.length - 1;
      btnPrev.style.opacity = btnPrev.disabled ? 0.4 : 1;
      btnNext.style.opacity = btnNext.disabled ? 0.4 : 1;
    }

    // Drawing logic
    let isDown = false;
    let sx = 0, sy = 0;

    function getPos(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x, y };
    }

    function onDown(ev) {
      isDown = true;
      const p = getPos(ev);
      sx = p.x; sy = p.y;
    }

    function onMove(ev) {
      if (!isDown) return;
      const p = getPos(ev);
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      const page = pages[idx];
      const rects = rectsByPage[page.pageNumber] || [];
      // preview with a temp rect
      const tmp = rects.concat([{ x, y, w, h }]);
      drawPreview(page.canvas, overlayCanvas, tmp);
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);
    }

    function onUp(ev) {
      if (!isDown) return;
      isDown = false;
      const p = getPos(ev);
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      if (w < 6 || h < 6) { updatePageUI(); return; }

      const page = pages[idx];
      rectsByPage[page.pageNumber].push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h)
      });
      updatePageUI();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    btnPrev.onclick = () => { if (idx > 0) { idx--; updatePageUI(); } };
    btnNext.onclick = () => { if (idx < pages.length - 1) { idx++; updatePageUI(); } };

    btnClearPage.onclick = () => {
      const page = pages[idx];
      rectsByPage[page.pageNumber] = [];
      updatePageUI();
    };

    btnClearAll.onclick = () => {
      for (const p of pages) rectsByPage[p.pageNumber] = [];
      updatePageUI();
    };

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      try {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
      } catch (_) {}
      ui.remove();
    }

    btnCancel.onclick = () => close();

    // done() contract
    const session = {
      async done() {
        // return data for RasterExport (no export here to keep layering clean)
        return {
          pages: pages.map(p => ({
            pageNumber: p.pageNumber,
            canvas: p.canvas,
            width: p.width,
            height: p.height
          })),
          rectsByPage,
          lang,
          dpi: DPI,
          filename: `raster_secure_${Date.now()}.pdf`
        };
      },
      close
    };

    btnExport.onclick = async () => {
      const res = await session.done();
      // Delegate actual export to RasterExport
      await window.RasterExport.exportRasterSecurePdfFromVisual(res);
      close();
    };

    updatePageUI();
    return session;
  }

  window.RedactUI = { start };
})();

