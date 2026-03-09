/* =========================================================
 * redact-ui.js
 * Minimal manual redaction UI (in-memory only)
 * - Fullscreen overlay with canvas preview (PDF multi-page / image single page)
 * - Drag to create rectangles per page
 * - ✅ NO export button here (export MUST happen via main "红删PDF" button)
 * - Stores latest result in memory for app.js to export
 *
 * PATCH (2026-03-09)
 * - ✅ add zoom in / zoom out / fit controls
 * - ✅ desktop: scroll large pages inside viewport
 * - ✅ mobile: fit button works, can zoom out, can see full page
 * - ✅ selection rects stay accurate after zoom / scroll
 * ======================================================= */

(function () {
  "use strict";

  const DPI = 600;
  const MIN_ZOOM = 0.05;
  const MAX_ZOOM = 4.00;
  const ZOOM_STEP = 1.25;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function roundZoom(z) {
    return Math.round(Number(z || 1) * 100) / 100;
  }

  function langText(lang) {
    const zh = {
      title: "手工涂抹（框选遮盖区域）",
      tip: "拖拽框选要遮盖的区域；可多次框选。完成后关闭，回到主界面点「红删PDF」导出。",
      prev: "上一页",
      next: "下一页",
      clearPage: "清空本页",
      clearAll: "清空全部",
      zoomOut: "缩小",
      zoomIn: "放大",
      fit: "适应",
      zoom: (z) => `${Math.round(z * 100)}%`,
      done: "完成",
      cancel: "关闭",
      page: (i, n) => `第 ${i}/${n} 页`
    };
    const de = {
      title: "Manuell (Bereiche markieren)",
      tip: "Ziehen, um Bereiche zu schwärzen. Danach schließen und im Hauptscreen „PDF schwärzen“ klicken.",
      prev: "Zurück",
      next: "Weiter",
      clearPage: "Seite löschen",
      clearAll: "Alles löschen",
      zoomOut: "−",
      zoomIn: "+",
      fit: "Anpassen",
      zoom: (z) => `${Math.round(z * 100)}%`,
      done: "Fertig",
      cancel: "Schließen",
      page: (i, n) => `Seite ${i}/${n}`
    };
    const en = {
      title: "Manual redaction",
      tip: "Drag to mark areas. Close it, then click “Redact PDF” on the main screen to export.",
      prev: "Prev",
      next: "Next",
      clearPage: "Clear page",
      clearAll: "Clear all",
      zoomOut: "−",
      zoomIn: "+",
      fit: "Fit",
      zoom: (z) => `${Math.round(z * 100)}%`,
      done: "Done",
      cancel: "Close",
      page: (i, n) => `Page ${i}/${n}`
    };
    return lang === "de" ? de : lang === "en" ? en : zh;
  }

  function createOverlay(lang) {
    const L = langText(lang);

    const root = document.createElement("div");
    root.style.cssText = `
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(10,12,16,.92);
      display:flex;
      flex-direction:column;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      color:#fff;
    `;

    root.innerHTML = `
      <div class="rui-top" style="
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,.12);
        flex:0 0 auto;
      ">
        <div style="font-weight:800; font-size:14px; opacity:.95;">${L.title}</div>
        <div class="rui-page" style="margin-left:auto; font-size:12px; opacity:.70;"></div>
        <button class="rui-btn rui-done" style="border:0; padding:8px 10px; border-radius:10px; background:#2f7cff; color:#fff; font-weight:700; cursor:pointer;">${L.done}</button>
        <button class="rui-btn rui-cancel" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.cancel}</button>
      </div>

      <div class="rui-tip" style="padding:10px 14px; font-size:12px; opacity:.72; flex:0 0 auto;">
        ${L.tip}
      </div>

      <div class="rui-body" style="
        flex:1 1 auto;
        min-height:0;
        display:flex;
        flex-direction:column;
        gap:10px;
        padding:10px 14px 14px;
      ">
        <div class="rui-toolbar" style="
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
          flex:0 0 auto;
        ">
          <button class="rui-btn rui-prev" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.prev}</button>
          <button class="rui-btn rui-next" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.next}</button>

          <div style="width:1px; height:24px; background:rgba(255,255,255,.12); margin:0 2px;"></div>

          <button class="rui-btn rui-zoom-out" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.zoomOut}</button>
          <div class="rui-zoom-label" style="min-width:62px; text-align:center; font-size:12px; opacity:.82;">${L.zoom(1)}</div>
          <button class="rui-btn rui-zoom-in" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.zoomIn}</button>
          <button class="rui-btn rui-fit" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.fit}</button>

          <div style="margin-left:auto; display:flex; gap:10px;">
            <button class="rui-btn rui-clear-page" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.clearPage}</button>
            <button class="rui-btn rui-clear-all" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.clearAll}</button>
          </div>
        </div>

        <div class="rui-canvas-wrap" style="
          flex:1 1 auto;
          min-height:0;
          min-width:0;
          overflow:auto;
          display:block;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.10);
          border-radius:14px;
          padding:12px;
          touch-action:pan-x pan-y;
          overscroll-behavior:contain;
          -webkit-overflow-scrolling:touch;
        ">
          <div class="rui-stage" style="
            position:relative;
            display:block;
            width:max-content;
            height:max-content;
            margin:0 auto;
          ">
            <canvas class="rui-canvas" style="
              display:block;
              background:#fff;
              transform-origin:top left;
              touch-action:none;
            "></canvas>
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

    ctx.drawImage(baseCanvas, 0, 0);

    const outerW = Math.max(3, Math.round(baseCanvas.width / 520));
    const innerW = Math.max(2, Math.round(baseCanvas.width / 780));

    ctx.save();

    for (const r of (rects || [])) {
      const x = r.x, y = r.y, w = r.w, h = r.h;

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#00E5FF";
      ctx.fillRect(x, y, w, h);

      ctx.globalAlpha = 0.95;
      ctx.setLineDash([]);
      ctx.lineWidth = outerW;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeRect(x, y, w, h);

      ctx.setLineDash([6, 4]);
      ctx.lineWidth = innerW;
      ctx.strokeStyle = "rgba(0,229,255,0.95)";
      ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
    }

    ctx.restore();
  }

  function normalizePages(rendered) {
    let pages =
      Array.isArray(rendered) ? rendered :
      (rendered && Array.isArray(rendered.pages)) ? rendered.pages :
      [];

    const out = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p || !p.canvas) continue;

      const pn = Number(p.pageNumber || (i + 1));
      const w = Number(p.width || (p.canvas ? p.canvas.width : 0));
      const h = Number(p.height || (p.canvas ? p.canvas.height : 0));

      out.push({
        pageNumber: pn > 0 ? pn : (i + 1),
        canvas: p.canvas,
        width: w || (p.canvas ? p.canvas.width : 1),
        height: h || (p.canvas ? p.canvas.height : 1)
      });
    }
    return out;
  }

  async function start(opts) {
    const file = opts && opts.file;
    const fileKind = (opts && opts.fileKind) || "";
    const lang = (opts && opts.lang) || "zh";
    if (!file) return null;
    if (!window.RasterExport) throw new Error("RasterExport missing");

    const filename = `raster_secure_${Date.now()}.pdf`;

    const ui = createOverlay(lang);
    const canvasWrap = $(".rui-canvas-wrap", ui);
    const stage = $(".rui-stage", ui);
    const canvas = $(".rui-canvas", ui);
    const pageLabel = $(".rui-page", ui);
    const zoomLabel = $(".rui-zoom-label", ui);

    const btnPrev = $(".rui-prev", ui);
    const btnNext = $(".rui-next", ui);
    const btnZoomOut = $(".rui-zoom-out", ui);
    const btnZoomIn = $(".rui-zoom-in", ui);
    const btnFit = $(".rui-fit", ui);
    const btnClearPage = $(".rui-clear-page", ui);
    const btnClearAll = $(".rui-clear-all", ui);
    const btnDone = $(".rui-done", ui);
    const btnCancel = $(".rui-cancel", ui);

    const L = langText(lang);

    let pages = [];
    try {
      if (fileKind === "image") {
        const rendered = await window.RasterExport.renderImageToCanvas(file, DPI);
        pages = normalizePages(rendered);
      } else {
        const rendered = await window.RasterExport.renderPdfToCanvases(file, DPI);
        pages = normalizePages(rendered);
      }
    } catch (e) {
      try { ui.remove(); } catch (_) {}
      throw e;
    }

    if (!pages.length) {
      try { ui.remove(); } catch (_) {}
      return null;
    }

    const rectsByPage = {};
    pages.forEach((p) => {
      const pn = p.pageNumber || 1;
      rectsByPage[pn] = rectsByPage[pn] || [];
    });

    let idx = 0;
    let zoom = 1;
    let fitZoom = 1;
    let isDown = false;
    let sx = 0;
    let sy = 0;
    let activePointerId = null;
    let overlayCanvas = document.createElement("canvas");

    function getCurrentPage() {
      return pages[idx] || null;
    }

    function computeFitZoom(page) {
      if (!page || !canvasWrap) return 1;

      const wrapW = Math.max(1, canvasWrap.clientWidth - 24);
      const wrapH = Math.max(1, canvasWrap.clientHeight - 24);

      const zW = wrapW / Math.max(1, page.width || 1);
      const zH = wrapH / Math.max(1, page.height || 1);

      const z = Math.min(zW, zH, 1);
      return clamp(roundZoom(z), MIN_ZOOM, MAX_ZOOM);
    }

    function updateZoomLabel() {
      if (zoomLabel) zoomLabel.textContent = L.zoom(zoom);
    }

    function applyZoom(keepCenter) {
      const page = getCurrentPage();
      if (!page) return;

      const prevScrollLeft = canvasWrap.scrollLeft;
      const prevScrollTop = canvasWrap.scrollTop;
      const prevClientW = canvasWrap.clientWidth;
      const prevClientH = canvasWrap.clientHeight;
      const centerX = prevScrollLeft + prevClientW / 2;
      const centerY = prevScrollTop + prevClientH / 2;
      const oldZoom = Number(stage.dataset.zoom || zoom || 1) || 1;

      canvas.style.width = `${Math.round(page.width * zoom)}px`;
      canvas.style.height = `${Math.round(page.height * zoom)}px`;
      stage.style.width = `${Math.round(page.width * zoom)}px`;
      stage.style.height = `${Math.round(page.height * zoom)}px`;
      stage.dataset.zoom = String(zoom);

      updateZoomLabel();

      btnZoomOut.disabled = zoom <= MIN_ZOOM + 0.0001;
      btnZoomIn.disabled = zoom >= MAX_ZOOM - 0.0001;
      btnZoomOut.style.opacity = btnZoomOut.disabled ? 0.4 : 1;
      btnZoomIn.style.opacity = btnZoomIn.disabled ? 0.4 : 1;

      if (keepCenter) {
        const ratio = zoom / oldZoom;
        const newCenterX = centerX * ratio;
        const newCenterY = centerY * ratio;
        canvasWrap.scrollLeft = Math.max(0, newCenterX - prevClientW / 2);
        canvasWrap.scrollTop = Math.max(0, newCenterY - prevClientH / 2);
      } else {
        canvasWrap.scrollLeft = 0;
        canvasWrap.scrollTop = 0;
      }
    }

    function redrawCurrentPage() {
      const page = getCurrentPage();
      if (!page || !page.canvas) return;

      const rects = rectsByPage[page.pageNumber] || [];
      drawPreview(page.canvas, overlayCanvas, rects);

      canvas.width = overlayCanvas.width;
      canvas.height = overlayCanvas.height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    function updatePageUI(resetZoomMode) {
      const p = getCurrentPage();
      if (!p || !p.canvas) return;

      redrawCurrentPage();

      if (pageLabel) pageLabel.textContent = L.page(idx + 1, pages.length);

      const multi = pages.length > 1;
      btnPrev.disabled = !multi || idx <= 0;
      btnNext.disabled = !multi || idx >= pages.length - 1;
      btnPrev.style.opacity = btnPrev.disabled ? 0.4 : 1;
      btnNext.style.opacity = btnNext.disabled ? 0.4 : 1;

      fitZoom = computeFitZoom(p);

      if (resetZoomMode !== false) {
        zoom = fitZoom;
        applyZoom(false);
      } else {
        zoom = clamp(roundZoom(zoom), MIN_ZOOM, MAX_ZOOM);
        applyZoom(false);
      }
    }

    function setZoom(nextZoom, keepCenter) {
      zoom = clamp(roundZoom(nextZoom), MIN_ZOOM, MAX_ZOOM);
      applyZoom(keepCenter !== false);
    }

    function getPos(ev) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);

      const x = (ev.clientX - rect.left) * scaleX;
      const y = (ev.clientY - rect.top) * scaleY;

      return {
        x: clamp(x, 0, canvas.width),
        y: clamp(y, 0, canvas.height)
      };
    }

    function onDown(ev) {
      try { ev.preventDefault(); } catch (_) {}
      isDown = true;
      activePointerId = ev.pointerId;
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}

      const p = getPos(ev);
      sx = p.x;
      sy = p.y;
    }

    function onMove(ev) {
      if (!isDown) return;
      if (activePointerId != null && ev.pointerId !== activePointerId) return;

      try { ev.preventDefault(); } catch (_) {}

      const p = getPos(ev);
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      const page = getCurrentPage();
      if (!page) return;

      const rects = rectsByPage[page.pageNumber] || [];
      const tmp = rects.concat([{ x, y, w, h }]);

      drawPreview(page.canvas, overlayCanvas, tmp);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(overlayCanvas, 0, 0);
    }

    function finishUp(ev) {
      if (!isDown) return;
      if (activePointerId != null && ev && ev.pointerId != null && ev.pointerId !== activePointerId) return;

      try { if (ev) ev.preventDefault(); } catch (_) {}
      isDown = false;

      try {
        if (activePointerId != null) canvas.releasePointerCapture(activePointerId);
      } catch (_) {}

      const p = ev ? getPos(ev) : { x: sx, y: sy };
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      activePointerId = null;

      if (w < 6 || h < 6) {
        redrawCurrentPage();
        return;
      }

      const page = getCurrentPage();
      if (!page) return;

      rectsByPage[page.pageNumber].push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h)
      });

      redrawCurrentPage();
    }

    function onUp(ev) { finishUp(ev); }
    function onCancel(ev) { finishUp(ev); }
    function onLeave() { if (isDown) finishUp(null); }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);

    btnPrev.onclick = () => {
      if (idx > 0) {
        idx -= 1;
        updatePageUI(true);
      }
    };

    btnNext.onclick = () => {
      if (idx < pages.length - 1) {
        idx += 1;
        updatePageUI(true);
      }
    };

    btnZoomOut.onclick = () => {
      setZoom(zoom / ZOOM_STEP, true);
    };

    btnZoomIn.onclick = () => {
      setZoom(zoom * ZOOM_STEP, true);
    };

    btnFit.onclick = () => {
      const page = getCurrentPage();
      if (!page) return;
      fitZoom = computeFitZoom(page);
      setZoom(fitZoom, false);
    };

    btnClearPage.onclick = () => {
      const page = getCurrentPage();
      if (!page) return;
      rectsByPage[page.pageNumber] = [];
      redrawCurrentPage();
    };

    btnClearAll.onclick = () => {
      for (const p of pages) rectsByPage[p.pageNumber] = [];
      redrawCurrentPage();
    };

    let resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const page = getCurrentPage();
        if (!page) return;

        const oldFit = fitZoom;
        fitZoom = computeFitZoom(page);

        const wasAtFit = Math.abs(zoom - oldFit) < 0.02 || Math.abs(zoom - fitZoom) < 0.02;
        if (wasAtFit) zoom = fitZoom;

        applyZoom(false);
      }, 80);
    }

    window.addEventListener("resize", onResize);

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;

      try {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onCancel);
        canvas.removeEventListener("pointerleave", onLeave);
      } catch (_) {}

      try {
        window.removeEventListener("resize", onResize);
      } catch (_) {}

      try {
        clearTimeout(resizeTimer);
      } catch (_) {}

      ui.remove();
    }

    function cloneRectsByPage(src) {
      const out = {};
      const keys = Object.keys(src || {});
      for (const k of keys) {
        const arr = Array.isArray(src[k]) ? src[k] : [];
        out[k] = arr.map((r) => ({
          x: Number(r.x || 0),
          y: Number(r.y || 0),
          w: Number(r.w || 0),
          h: Number(r.h || 0)
        }));
      }
      return out;
    }

    function buildResult() {
      return {
        pages: pages.map((p) => ({
          pageNumber: p.pageNumber,
          canvas: p.canvas,
          width: p.width || (p.canvas ? p.canvas.width : 1),
          height: p.height || (p.canvas ? p.canvas.height : 1)
        })),
        rectsByPage: cloneRectsByPage(rectsByPage),
        lang,
        dpi: DPI,
        filename
      };
    }

    btnDone.onclick = () => {
      try { window.__manual_redact_last = buildResult(); } catch (_) {}
      close();
    };

    btnCancel.onclick = () => close();

    updatePageUI(true);

    return {
      done() { return buildResult(); },
      close
    };
  }

  window.RedactUI = { start };
})();
