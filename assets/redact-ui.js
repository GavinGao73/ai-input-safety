/* =========================================================
 * redact-ui.js
 * Minimal manual redaction UI (in-memory only)
 * - Fullscreen overlay with canvas preview (PDF multi-page / image single page)
 * - Drag to create rectangles per page
 * - ✅ NO export button here (export MUST happen via main "红删PDF" button)
 * - Stores latest result in memory for app.js to export
 *
 * ENHANCED
 * - Zoom in / zoom out / fit
 * - Mobile-safe fit + scroll
 * - Pinch zoom (two-finger)
 * - Delete single rect by tap
 * - Undo last rect
 * ======================================================= */

(function () {
  "use strict";

  const DPI = 600;

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
    const canvasStage = $(".rui-canvas-stage", ui);
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

    let isDown = false;
    let sx = 0;
    let sy = 0;
    let activePointerId = null;

    let pinchMode = false;
    let pinchPointerA = null;
    let pinchPointerB = null;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    let movedDuringPointer = false;

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

    function applyCanvasScale(keepCenter) {
      const p = currentPage();
      if (!p || !p.canvas) return;

      const prevScrollLeft = canvasWrap.scrollLeft;
      const prevScrollTop = canvasWrap.scrollTop;
      const prevClientW = canvasWrap.clientWidth;
      const prevClientH = canvasWrap.clientHeight;

      const centerX = prevScrollLeft + prevClientW / 2;
      const centerY = prevScrollTop + prevClientH / 2;

      canvas.style.width = `${Math.round(p.canvas.width * zoom)}px`;
      canvas.style.height = `${Math.round(p.canvas.height * zoom)}px`;

      if (keepCenter) {
        requestAnimationFrame(() => {
          const newW = p.canvas.width * zoom;
          const newH = p.canvas.height * zoom;

          const ratioX = p.canvas.width > 0 ? centerX / Math.max(1, p.canvas.width * (zoom || 1)) : 0;
          const ratioY = p.canvas.height > 0 ? centerY / Math.max(1, p.canvas.height * (zoom || 1)) : 0;

          const nextX = ratioX * newW - canvasWrap.clientWidth / 2;
          const nextY = ratioY * newH - canvasWrap.clientHeight / 2;

          canvasWrap.scrollLeft = Math.max(0, nextX);
          canvasWrap.scrollTop = Math.max(0, nextY);
        });
      }
    }

    function setZoom(nextZoom, keepCenter) {
      const z = Math.max(MIN_ZOOM_ABS, Math.min(MAX_ZOOM, Number(nextZoom) || 1));
      zoom = z;
      applyCanvasScale(!!keepCenter);
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

    function getPos(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x, y };
    }

    function distance(a, b) {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function findRectAtPoint(x, y) {
      const rects = getCurrentRects();
      for (let i = rects.length - 1; i >= 0; i--) {
        const r = rects[i];
        if (
          x >= r.x &&
          y >= r.y &&
          x <= r.x + r.w &&
          y <= r.y + r.h
        ) {
          return i;
        }
      }
      return -1;
    }

    function startPinchIfNeeded(ev) {
      if (pinchMode) return;
      if (activePointerId == null) return;

      pinchPointerA = { id: activePointerId, clientX: sx, clientY: sy };
      pinchPointerB = { id: ev.pointerId, clientX: ev.clientX, clientY: ev.clientY };

      pinchStartDist = distance(pinchPointerA, pinchPointerB);
      pinchStartZoom = zoom;

      if (pinchStartDist > 0) {
        pinchMode = true;
        isDown = false;
        try { canvas.releasePointerCapture(activePointerId); } catch (_) {}
        activePointerId = null;
      }
    }

    function updatePinchPointer(ev) {
      if (!pinchMode) return;
      if (pinchPointerA && ev.pointerId === pinchPointerA.id) {
        pinchPointerA.clientX = ev.clientX;
        pinchPointerA.clientY = ev.clientY;
      } else if (pinchPointerB && ev.pointerId === pinchPointerB.id) {
        pinchPointerB.clientX = ev.clientX;
        pinchPointerB.clientY = ev.clientY;
      }

      if (!pinchPointerA || !pinchPointerB) return;

      const d = distance(pinchPointerA, pinchPointerB);
      if (!d || !pinchStartDist) return;

      const nextZoom = pinchStartZoom * (d / pinchStartDist);
      setZoom(nextZoom, true);
    }

    function stopPinchPointer(pointerId) {
      if (!pinchMode) return;

      if (pinchPointerA && pointerId === pinchPointerA.id) pinchPointerA = null;
      if (pinchPointerB && pointerId === pinchPointerB.id) pinchPointerB = null;

      if (!pinchPointerA || !pinchPointerB) {
        pinchMode = false;
        pinchStartDist = 0;
      }
    }

    function onDown(ev) {
      try { ev.preventDefault(); } catch (_) {}

      if (pinchMode) return;

      if (activePointerId != null && activePointerId !== ev.pointerId) {
        startPinchIfNeeded(ev);
        return;
      }

      isDown = true;
      movedDuringPointer = false;
      activePointerId = ev.pointerId;

      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}

      const p = getPos(ev);
      sx = p.x;
      sy = p.y;
    }

    function onMove(ev) {
      if (pinchMode) {
        updatePinchPointer(ev);
        return;
      }

      if (!isDown) return;
      if (activePointerId != null && ev.pointerId !== activePointerId) return;

      try { ev.preventDefault(); } catch (_) {}

      const p = getPos(ev);
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      if (w > 3 || h > 3) movedDuringPointer = true;

      const page = currentPage();
      if (!page) return;

      const rects = getCurrentRects();
      const tmp = rects.concat([{ x, y, w, h }]);
      drawPreview(page.canvas, overlayCanvas, tmp);
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);
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

      const tapLike = w < 6 && h < 6 && !movedDuringPointer;

      activePointerId = null;

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
      if (pinchMode) {
        stopPinchPointer(ev.pointerId);
        return;
      }
      finishUp(ev);
    }

    function onCancel(ev) {
      if (pinchMode) {
        stopPinchPointer(ev.pointerId);
        return;
      }
      finishUp(ev);
    }

    function onLeave() {
      if (pinchMode) return;
      if (isDown) finishUp(null);
    }

    canvas.addEventListener("pointerdown", onDown, { passive: false });
    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerup", onUp, { passive: false });
    canvas.addEventListener("pointercancel", onCancel, { passive: false });
    canvas.addEventListener("pointerleave", onLeave, { passive: false });

    btnPrev.onclick = () => {
      if (idx > 0) {
        idx--;
        updatePageUI(true);
      }
    };

    btnNext.onclick = () => {
      if (idx < pages.length - 1) {
        idx++;
        updatePageUI(true);
      }
    };

    btnZoomIn.onclick = () => {
      setZoom(zoom * 1.2, true);
    };

    btnZoomOut.onclick = () => {
      setZoom(zoom / 1.2, true);
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
