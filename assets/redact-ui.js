/* =========================================================
 * redact-ui.js
 * Minimal manual redaction UI (in-memory only)
 * - Fullscreen overlay with canvas preview (PDF multi-page / image single page)
 * - Drag to create rectangles per page
 * - NO export button here (export MUST happen via main "红删PDF" button)
 * - Stores latest result in memory for app.js to export
 *
 * ENHANCED
 * - Zoom in / zoom out / fit
 * - Mobile-safe fit + scroll
 * - True pinch zoom (two-finger with pointer map)
 * - Delete single rect by tap
 * - Undo last rect
 * ======================================================= */

(function () {
  "use strict";

  const DPI = 300;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function langText(lang) {
    const zh = {
      title: "手工涂抹（框选遮盖区域）",
      tip: "拖拽框选要遮盖的区域；可多次框选。支持缩放、双指缩放、撤销、点击单个框删除。完成后关闭，回到主界面点「红删PDF」导出。",
      prev: "上一页",
      next: "下一页",
      clearPage: "清空本页",
      clearAll: "清空全部",
      undo: "撤销",
      zoomIn: "放大",
      zoomOut: "缩小",
      fit: "适应",
      done: "完成",
      cancel: "关闭",
      page: (i, n) => `第 ${i}/${n} 页`
    };
    const de = {
      title: "Manuell (Bereiche markieren)",
      tip: "Ziehen, um Bereiche zu schwärzen. Zoom, Pinch-Zoom, Rückgängig und Löschen einzelner Rahmen per Tipp werden unterstützt. Danach schließen und im Hauptscreen „PDF schwärzen“ klicken.",
      prev: "Zurück",
      next: "Weiter",
      clearPage: "Seite löschen",
      clearAll: "Alles löschen",
      undo: "Rückgängig",
      zoomIn: "Zoom +",
      zoomOut: "Zoom -",
      fit: "Einpassen",
      done: "Fertig",
      cancel: "Schließen",
      page: (i, n) => `Seite ${i}/${n}`
    };
    const en = {
      title: "Manual redaction",
      tip: "Drag to mark areas. Supports zoom, pinch zoom, undo, and tap-to-delete for a single box. Close it, then click “Redact PDF” on the main screen to export.",
      prev: "Prev",
      next: "Next",
      clearPage: "Clear page",
      clearAll: "Clear all",
      undo: "Undo",
      zoomIn: "Zoom +",
      zoomOut: "Zoom -",
      fit: "Fit",
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
      position:fixed; inset:0; z-index:999999;
      background:rgba(10,12,16,.92);
      display:flex; flex-direction:column;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      color:#fff;
    `;

    root.innerHTML = `
      <div class="rui-top" style="
        display:flex; align-items:center; gap:12px;
        padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.12);
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
        padding:10px 14px;
        overflow:hidden;
      ">
        <div class="rui-canvas-wrap" style="
          flex:1 1 auto;
          min-height:0;
          position:relative;
          display:block;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.10);
          border-radius:14px;
          overflow:auto;
          overscroll-behavior:contain;
          -webkit-overflow-scrolling:touch;
          touch-action:none;
        ">
          <div class="rui-canvas-stage" style="
            position:relative;
            display:flex;
            justify-content:center;
            align-items:flex-start;
            min-width:100%;
            min-height:100%;
            padding:12px;
          ">
            <canvas class="rui-canvas" style="
              display:block;
              transform-origin: top left;
              touch-action:none;
              background:#fff;
              box-shadow:0 8px 24px rgba(0,0,0,.30);
            "></canvas>
          </div>
        </div>

        <div class="rui-bar" style="
          display:flex; align-items:center; gap:10px;
          flex-wrap:wrap; flex:0 0 auto;
        ">
          <button class="rui-btn rui-prev" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.prev}</button>
          <button class="rui-btn rui-next" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.next}</button>

          <button class="rui-btn rui-zoom-out" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.zoomOut}</button>
          <button class="rui-btn rui-zoom-in" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.zoomIn}</button>
          <button class="rui-btn rui-fit" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.fit}</button>

          <div style="margin-left:auto; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="rui-btn rui-undo" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.undo}</button>
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
    const pages =
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
    const canvas = $(".rui-canvas", ui);
    const pageLabel = $(".rui-page", ui);

    const btnPrev = $(".rui-prev", ui);
    const btnNext = $(".rui-next", ui);
    const btnZoomIn = $(".rui-zoom-in", ui);
    const btnZoomOut = $(".rui-zoom-out", ui);
    const btnFit = $(".rui-fit", ui);
    const btnUndo = $(".rui-undo", ui);
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
    const overlayCanvas = document.createElement("canvas");

    let fitZoom = 1;
    let zoom = 1;
    const MIN_ZOOM_ABS = 0.08;
    const MAX_ZOOM = 8;

    let drawState = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false
    };

    const activePointers = new Map();
    let pinchState = {
      active: false,
      ids: [],
      startDist: 0,
      startZoom: 1,
      anchorClientX: 0,
      anchorClientY: 0
    };

    function currentPage() {
      return pages[idx] || null;
    }

    function getCurrentRects() {
      const p = currentPage();
      if (!p) return [];
      return rectsByPage[p.pageNumber] || [];
    }

    function setCurrentRects(arr) {
      const p = currentPage();
      if (!p) return;
      rectsByPage[p.pageNumber] = Array.isArray(arr) ? arr : [];
    }

    function getFitZoomForPage(page) {
      if (!page || !page.canvas || !canvasWrap) return 1;

      const wrapRect = canvasWrap.getBoundingClientRect();
      const innerW = Math.max(40, wrapRect.width - 24);
      const innerH = Math.max(40, wrapRect.height - 24);

      const zx = innerW / page.canvas.width;
      const zy = innerH / page.canvas.height;
      const z = Math.min(zx, zy);

      return Math.max(MIN_ZOOM_ABS, Math.min(1, z || 1));
    }

    function applyCanvasScale(keepVisualAnchor, anchorClientX, anchorClientY) {
      const p = currentPage();
      if (!p || !p.canvas) return;

      const wrapRect = canvasWrap.getBoundingClientRect();

      let contentXBefore = canvasWrap.scrollLeft + wrapRect.width / 2;
      let contentYBefore = canvasWrap.scrollTop + wrapRect.height / 2;

      if (keepVisualAnchor && Number.isFinite(anchorClientX) && Number.isFinite(anchorClientY)) {
        contentXBefore = canvasWrap.scrollLeft + (anchorClientX - wrapRect.left);
        contentYBefore = canvasWrap.scrollTop + (anchorClientY - wrapRect.top);
      }

      const prevZoom = Number(canvas.dataset.zoom || 1) || 1;
      const ratioX = contentXBefore / Math.max(1, p.canvas.width * prevZoom);
      const ratioY = contentYBefore / Math.max(1, p.canvas.height * prevZoom);

      canvas.style.width = `${Math.round(p.canvas.width * zoom)}px`;
      canvas.style.height = `${Math.round(p.canvas.height * zoom)}px`;
      canvas.dataset.zoom = String(zoom);

      requestAnimationFrame(() => {
        if (keepVisualAnchor) {
          const nextContentX = ratioX * (p.canvas.width * zoom);
          const nextContentY = ratioY * (p.canvas.height * zoom);
          const nextScrollLeft = nextContentX - (Number.isFinite(anchorClientX) ? (anchorClientX - wrapRect.left) : wrapRect.width / 2);
          const nextScrollTop = nextContentY - (Number.isFinite(anchorClientY) ? (anchorClientY - wrapRect.top) : wrapRect.height / 2);

          canvasWrap.scrollLeft = Math.max(0, nextScrollLeft);
          canvasWrap.scrollTop = Math.max(0, nextScrollTop);
        }
      });
    }

    function setZoom(nextZoom, keepVisualAnchor, anchorClientX, anchorClientY) {
      zoom = Math.max(MIN_ZOOM_ABS, Math.min(MAX_ZOOM, Number(nextZoom) || 1));
      applyCanvasScale(!!keepVisualAnchor, anchorClientX, anchorClientY);
    }

    function fitToPage() {
      const p = currentPage();
      if (!p) return;
      fitZoom = getFitZoomForPage(p);
      zoom = fitZoom;
      applyCanvasScale(false);
      canvasWrap.scrollLeft = 0;
      canvasWrap.scrollTop = 0;
    }

    function updatePageUI(resetScroll) {
      const p = currentPage();
      if (!p || !p.canvas) return;

      const rects = rectsByPage[p.pageNumber] || [];
      drawPreview(p.canvas, overlayCanvas, rects);

      canvas.width = overlayCanvas.width;
      canvas.height = overlayCanvas.height;
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);

      if (pageLabel) pageLabel.textContent = L.page(idx + 1, pages.length);

      const multi = pages.length > 1;
      btnPrev.disabled = !multi || idx <= 0;
      btnNext.disabled = !multi || idx >= pages.length - 1;
      btnPrev.style.opacity = btnPrev.disabled ? 0.4 : 1;
      btnNext.style.opacity = btnNext.disabled ? 0.4 : 1;

      btnUndo.disabled = getCurrentRects().length <= 0;
      btnUndo.style.opacity = btnUndo.disabled ? 0.4 : 1;

      fitZoom = getFitZoomForPage(p);

      if (resetScroll || !Number.isFinite(zoom) || zoom <= 0) {
        zoom = fitZoom;
        applyCanvasScale(false);
        canvasWrap.scrollLeft = 0;
        canvasWrap.scrollTop = 0;
      } else {
        applyCanvasScale(false);
      }
    }

    function getCanvasPosFromClient(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);
      return { x, y };
    }

    function getPos(ev) {
      return getCanvasPosFromClient(ev.clientX, ev.clientY);
    }

    function distance(a, b) {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function midpoint(a, b) {
      return {
        clientX: (a.clientX + b.clientX) / 2,
        clientY: (a.clientY + b.clientY) / 2
      };
    }

    function findRectAtPoint(x, y) {
      const rects = getCurrentRects();
      for (let i = rects.length - 1; i >= 0; i--) {
        const r = rects[i];
        if (x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) {
          return i;
        }
      }
      return -1;
    }

    function resetDrawState() {
      drawState.active = false;
      drawState.pointerId = null;
      drawState.startX = 0;
      drawState.startY = 0;
      drawState.moved = false;
    }

    function startPinchIfPossible() {
      if (activePointers.size < 2) return;
      const ids = Array.from(activePointers.keys()).slice(0, 2);
      const p1 = activePointers.get(ids[0]);
      const p2 = activePointers.get(ids[1]);
      if (!p1 || !p2) return;

      pinchState.active = true;
      pinchState.ids = ids;
      pinchState.startDist = distance(p1, p2);
      pinchState.startZoom = zoom;

      const mid = midpoint(p1, p2);
      pinchState.anchorClientX = mid.clientX;
      pinchState.anchorClientY = mid.clientY;

      resetDrawState();
    }

    function stopPinch() {
      pinchState.active = false;
      pinchState.ids = [];
      pinchState.startDist = 0;
      pinchState.startZoom = zoom;
      pinchState.anchorClientX = 0;
      pinchState.anchorClientY = 0;
    }

    function updatePinch() {
      if (!pinchState.active) return;
      if (pinchState.ids.length < 2) return;

      const p1 = activePointers.get(pinchState.ids[0]);
      const p2 = activePointers.get(pinchState.ids[1]);
      if (!p1 || !p2) {
        stopPinch();
        return;
      }

      const d = distance(p1, p2);
      if (!d || !pinchState.startDist) return;

      const mid = midpoint(p1, p2);
      const nextZoom = pinchState.startZoom * (d / pinchState.startDist);

      setZoom(nextZoom, true, mid.clientX, mid.clientY);
    }

    function onDown(ev) {
      try { ev.preventDefault(); } catch (_) {}

      activePointers.set(ev.pointerId, {
        pointerId: ev.pointerId,
        clientX: ev.clientX,
        clientY: ev.clientY
      });

      if (activePointers.size >= 2) {
        startPinchIfPossible();
        return;
      }

      if (pinchState.active) return;

      const p = getPos(ev);
      drawState.active = true;
      drawState.pointerId = ev.pointerId;
      drawState.startX = p.x;
      drawState.startY = p.y;
      drawState.moved = false;

      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    }

    function onMove(ev) {
      if (activePointers.has(ev.pointerId)) {
        activePointers.set(ev.pointerId, {
          pointerId: ev.pointerId,
          clientX: ev.clientX,
          clientY: ev.clientY
        });
      }

      if (pinchState.active || activePointers.size >= 2) {
        if (!pinchState.active) startPinchIfPossible();
        updatePinch();
        return;
      }

      if (!drawState.active) return;
      if (drawState.pointerId !== ev.pointerId) return;

      try { ev.preventDefault(); } catch (_) {}

      const p = getPos(ev);
      const x = Math.min(drawState.startX, p.x);
      const y = Math.min(drawState.startY, p.y);
      const w = Math.abs(p.x - drawState.startX);
      const h = Math.abs(p.y - drawState.startY);

      if (w > 3 || h > 3) drawState.moved = true;

      const page = currentPage();
      if (!page) return;

      const rects = getCurrentRects();
      const tmp = rects.concat([{ x, y, w, h }]);
      drawPreview(page.canvas, overlayCanvas, tmp);
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);
    }

    function finishDraw(ev) {
      if (!drawState.active) return;
      if (drawState.pointerId !== ev.pointerId) return;

      try { ev.preventDefault(); } catch (_) {}

      try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {}

      const p = getPos(ev);
      const x = Math.min(drawState.startX, p.x);
      const y = Math.min(drawState.startY, p.y);
      const w = Math.abs(p.x - drawState.startX);
      const h = Math.abs(p.y - drawState.startY);

      const tapLike = w < 6 && h < 6 && !drawState.moved;
      resetDrawState();

      const page = currentPage();
      if (!page) {
        updatePageUI(false);
        return;
      }

      if (tapLike) {
        const hitIdx = findRectAtPoint(p.x, p.y);
        if (hitIdx >= 0) {
          const rects = getCurrentRects().slice();
          rects.splice(hitIdx, 1);
          setCurrentRects(rects);
        }
        updatePageUI(false);
        return;
      }

      if (w < 6 || h < 6) {
        updatePageUI(false);
        return;
      }

      const rects = getCurrentRects().slice();
      rects.push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h)
      });
      setCurrentRects(rects);
      updatePageUI(false);
    }

    function onUp(ev) {
      if (pinchState.active) {
        activePointers.delete(ev.pointerId);
        if (activePointers.size < 2) {
          stopPinch();
        }
        return;
      }

      finishDraw(ev);
      activePointers.delete(ev.pointerId);
    }

    function onCancel(ev) {
      if (pinchState.active) {
        activePointers.delete(ev.pointerId);
        if (activePointers.size < 2) stopPinch();
        return;
      }

      if (drawState.active && drawState.pointerId === ev.pointerId) {
        resetDrawState();
        updatePageUI(false);
      }
      activePointers.delete(ev.pointerId);
    }

    function onLeave(ev) {
      if (pinchState.active) return;
      if (drawState.active && drawState.pointerId === ev.pointerId) {
        finishDraw(ev);
      }
    }

    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerup", onUp, { passive: false });
    canvas.addEventListener("pointercancel", onCancel, { passive: false });
    canvas.addEventListener("pointerleave", onLeave, { passive: false });

    btnPrev.onclick = () => {
      if (idx > 0) {
        idx--;
        stopPinch();
        resetDrawState();
        activePointers.clear();
        updatePageUI(true);
      }
    };

    btnNext.onclick = () => {
      if (idx < pages.length - 1) {
        idx++;
        stopPinch();
        resetDrawState();
        activePointers.clear();
        updatePageUI(true);
      }
    };

    btnZoomIn.onclick = () => {
      const rect = canvasWrap.getBoundingClientRect();
      setZoom(zoom * 1.2, true, rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    btnZoomOut.onclick = () => {
      const rect = canvasWrap.getBoundingClientRect();
      setZoom(zoom / 1.2, true, rect.left + rect.width / 2, rect.top + rect.height / 2);
    };

    btnFit.onclick = () => {
      fitToPage();
    };

    btnUndo.onclick = () => {
      const rects = getCurrentRects().slice();
      if (rects.length) {
        rects.pop();
        setCurrentRects(rects);
        updatePageUI(false);
      }
    };

    btnClearPage.onclick = () => {
      setCurrentRects([]);
      updatePageUI(false);
    };

    btnClearAll.onclick = () => {
      for (const p of pages) {
        rectsByPage[p.pageNumber] = [];
      }
      updatePageUI(false);
    };

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

      try { ui.remove(); } catch (_) {}
    }

    btnDone.onclick = () => {
      try { window.__manual_redact_last = buildResult(); } catch (_) {}
      close();
    };

    btnCancel.onclick = () => close();

    requestAnimationFrame(() => {
      updatePageUI(true);
      setTimeout(() => {
        fitToPage();
      }, 30);
    });

    return {
      done() { return buildResult(); },
      close
    };
  }

  window.RedactUI = { start };
})();
