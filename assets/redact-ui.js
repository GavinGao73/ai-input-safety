/* =========================================================
 * redact-ui.js
 * Minimal manual redaction UI (in-memory only)
 * - Fullscreen overlay with canvas preview (PDF multi-page / image single page)
 * - Drag to create rectangles per page
 * - ✅ NO export button here (export MUST happen via main "红删PDF" button)
 * - Stores latest result in memory for app.js to export
 * ======================================================= */

(function () {
  "use strict";

  const DPI = 600;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function langText(lang) {
    const zh = {
      title: "手工涂抹（框选遮盖区域）",
      tip: "拖拽框选要遮盖的区域；可多次框选。完成后关闭，回到主界面点「红删PDF」导出。",
      prev: "上一页",
      next: "下一页",
      clearPage: "清空本页",
      clearAll: "清空全部",
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
      <div class="rui-top" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.12);">
        <div style="font-weight:800; font-size:14px; opacity:.95;">${L.title}</div>
        <div class="rui-page" style="margin-left:auto; font-size:12px; opacity:.70;"></div>
        <button class="rui-btn rui-done" style="border:0; padding:8px 10px; border-radius:10px; background:#2f7cff; color:#fff; font-weight:700; cursor:pointer;">${L.done}</button>
        <button class="rui-btn rui-cancel" style="border:1px solid rgba(255,255,255,.18); padding:8px 10px; border-radius:10px; background:transparent; color:#fff; font-weight:700; cursor:pointer;">${L.cancel}</button>
      </div>

      <div class="rui-tip" style="padding:10px 14px; font-size:12px; opacity:.72;">
        ${L.tip}
      </div>

      <div class="rui-body" style="flex:1; display:flex; flex-direction:column; gap:10px; padding:10px 14px;">
        <div class="rui-canvas-wrap" style="flex:1; display:flex; justify-content:center; align-items:center; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10); border-radius:14px; overflow:hidden;">
          <canvas class="rui-canvas" style="max-width:100%; max-height:100%; touch-action:none;"></canvas>
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

    ctx.drawImage(baseCanvas, 0, 0);

    // ✅ High-contrast selection box (works on white PDFs)
    // - cyan translucent fill
    // - dark outer stroke
    // - cyan dashed inner stroke
    const outerW = Math.max(3, Math.round(baseCanvas.width / 520));
    const innerW = Math.max(2, Math.round(baseCanvas.width / 780));

    ctx.save();

    for (const r of (rects || [])) {
      const x = r.x, y = r.y, w = r.w, h = r.h;

      // 1) fill
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#00E5FF";
      ctx.fillRect(x, y, w, h);

      // 2) outer stroke
      ctx.globalAlpha = 0.95;
      ctx.setLineDash([]);
      ctx.lineWidth = outerW;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeRect(x, y, w, h);

      // 3) inner dashed stroke
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = innerW;
      ctx.strokeStyle = "rgba(0,229,255,0.95)";
      ctx.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
    }

    ctx.restore();
  }

  // ✅ Normalize pages from multiple return shapes
  function normalizePages(rendered) {
    let pages =
      Array.isArray(rendered) ? rendered :
      (rendered && Array.isArray(rendered.pages)) ? rendered.pages :
      [];

    // sanitize minimal shape (pageNumber/canvas/width/height)
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

    const ui = createOverlay(lang);
    const canvas = $(".rui-canvas", ui);
    const pageLabel = $(".rui-page", ui);
    const btnPrev = $(".rui-prev", ui);
    const btnNext = $(".rui-next", ui);
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
    pages.forEach(p => {
      const pn = p.pageNumber || 1;
      rectsByPage[pn] = rectsByPage[pn] || [];
    });

    let idx = 0;
    const overlayCanvas = document.createElement("canvas");

    function updatePageUI() {
      const p = pages[idx];
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
    }

    let isDown = false;
    let sx = 0, sy = 0;
    let activePointerId = null;

    function getPos(ev) {
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
      return { x, y };
    }

    function onDown(ev) {
      try { ev.preventDefault(); } catch (_) {}
      isDown = true;
      activePointerId = ev.pointerId;
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}

      const p = getPos(ev);
      sx = p.x; sy = p.y;
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

      const page = pages[idx];
      if (!page) return;

      const rects = rectsByPage[page.pageNumber] || [];
      const tmp = rects.concat([{ x, y, w, h }]);
      drawPreview(page.canvas, overlayCanvas, tmp);
      canvas.getContext("2d").drawImage(overlayCanvas, 0, 0);
    }

    function finishUp(ev) {
      if (!isDown) return;
      if (activePointerId != null && ev && ev.pointerId != null && ev.pointerId !== activePointerId) return;

      try { if (ev) ev.preventDefault(); } catch (_) {}
      isDown = false;

      try { if (activePointerId != null) canvas.releasePointerCapture(activePointerId); } catch (_) {}

      const p = ev ? getPos(ev) : { x: sx, y: sy };
      const x = Math.min(sx, p.x);
      const y = Math.min(sy, p.y);
      const w = Math.abs(p.x - sx);
      const h = Math.abs(p.y - sy);

      activePointerId = null;

      if (w < 6 || h < 6) { updatePageUI(); return; }

      const page = pages[idx];
      if (!page) return;

      rectsByPage[page.pageNumber].push({
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h)
      });
      updatePageUI();
    }

    function onUp(ev) { finishUp(ev); }
    function onCancel(ev) { finishUp(ev); }
    function onLeave() { if (isDown) finishUp(null); }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);

    btnPrev.onclick = () => { if (idx > 0) { idx--; updatePageUI(); } };
    btnNext.onclick = () => { if (idx < pages.length - 1) { idx++; updatePageUI(); } };

    btnClearPage.onclick = () => {
      const page = pages[idx];
      if (!page) return;
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
        canvas.removeEventListener("pointercancel", onCancel);
        canvas.removeEventListener("pointerleave", onLeave);
      } catch (_) {}
      ui.remove();
    }

    function buildResult() {
      return {
        pages: pages.map(p => ({
          pageNumber: p.pageNumber,
          canvas: p.canvas,
          width: p.width || (p.canvas ? p.canvas.width : 1),
          height: p.height || (p.canvas ? p.canvas.height : 1)
        })),
        rectsByPage,
        lang,
        dpi: DPI,
        filename: `raster_secure_${Date.now()}.pdf`
      };
    }

    // ✅ Done = save to memory and close
    btnDone.onclick = () => {
      try { window.__manual_redact_last = buildResult(); } catch (_) {}
      close();
    };

    btnCancel.onclick = () => close();

    updatePageUI();

    // Return a session for app.js to pull result later
    return {
      done() { return buildResult(); },
      close
    };
  }

  window.RedactUI = { start };
})();
