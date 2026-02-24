// =========================
// assets/main.js (FULL)
// v20260223-lang-split-stable-a4
//
// ✅ UI language: window.currentLang 只影响 UI 文案
// ✅ Content language: window.contentLang / window.contentLangMode 只由 engine.js 状态机控制
// ✅ auto 仅在 contentLang=="" 时检测一次，检测后立即 lock
// ✅ Clear 必须 resetContentLang(): mode=auto, contentLang=""
// ✅ Export Mode A uses langContent (rule language) rather than UI lang
// =========================

/* =========================
   E) Export progress mirror (UI language aligned)
   - show RasterExport phases in exportStatus
   - keep BOOT line without overwriting progress
   ========================= */
function i18nProgressLine(phase, t) {
  const map = {
    "exportRasterSecurePdfFromReadablePdf:begin": t.progressPhaseBegin || "开始准备…",
    "autoRedactReadablePdf": t.progressPhaseScan || "扫描并计算遮盖区域…",
    "exportRasterSecurePdfFromReadablePdf:export": t.progressPhaseExport || "生成安全PDF（纯图片）…",
    "exportRasterSecurePdfFromVisual": t.progressPhaseExport || "生成安全PDF（纯图片）…"
  };
  return map[phase] || (t.progressPhaseWorking || "处理中…");
}

function renderExportStatusCombined() {
  const el = document.getElementById("exportStatus");
  if (!el) return;

  const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : {};
  const s = window.__RasterExportLast || null;
  const bootLine = window.__bootLine || "";

  // If nothing to show, keep existing
  if (!bootLine && !s) return;

  const lines = [];
  if (bootLine) lines.push(bootLine);

  if (s) {
    if (s.phase) lines.push(`${i18nProgressLine(s.phase, t)}  (${s.phase})`);
    if (s.phase2) lines.push(`${t.progressPhase2 || "阶段2"}: ${s.phase2}`);

    if (s.lang) lines.push(`lang=${s.lang}`);
    if (s.dpi) lines.push(`dpi=${s.dpi}`);

    if (typeof s.pages === "number") lines.push(`${t.progressPages || "页数"}=${s.pages}`);
    if (typeof s.rectsTotal === "number") lines.push(`${t.progressRects || "遮盖块"}=${s.rectsTotal}`);

    if (Array.isArray(s.perPage) && s.perPage.length) {
      const last = s.perPage[s.perPage.length - 1];
      if (last && last.pageNumber) {
        lines.push(
          `${t.progressPage || "当前页"}=${last.pageNumber}  items=${last.items || 0}  rects=${last.rectCount || 0}`
        );
      }
    }
  }

  el.textContent = lines.join("\n");
}

function startExportStatusMirror() {
  if (window.__exportStatusTimer) clearInterval(window.__exportStatusTimer);
  window.__exportStatusTimer = setInterval(() => {
    try { renderExportStatusCombined(); } catch (_) {}
  }, 120);
}

function stopExportStatusMirror() {
  if (window.__exportStatusTimer) {
    clearInterval(window.__exportStatusTimer);
    window.__exportStatusTimer = null;
  }
}

// ================= bind =================
function bind() {
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      // UI language only
      currentLang = b.dataset.lang;
      window.currentLang = currentLang;

      // refresh UI strings
      setText();

      const ta = $("inputText");
      const inTxt = (ta && ta.value) ? String(ta.value).trim() : "";

      // ✅ IMPORTANT: UI switch MUST NOT overwrite contentLang/mode
      // contentLang must be decided by content detection (engine.js)

      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));

      if (ta) renderInputOverlayForPdf(ta.value || "");

      requestAnimationFrame(syncManualRiskHeights);

      // refresh export status language (same UI lang)
      try { renderExportStatusCombined(); } catch (_) {}
    };
  });

  const btnToggleManual = $("btnToggleManual");
  const manualBody = $("manualBody");
  if (btnToggleManual && manualBody) {
    setCtlExpanded(btnToggleManual, manualBody, false);
    btnToggleManual.onclick = () => {
      toggleCtl(btnToggleManual, manualBody);
      requestAnimationFrame(syncManualRiskHeights);
    };
  }

  const btnToggleRisk = $("btnToggleRisk");
  const riskBody = $("riskBody");
  if (btnToggleRisk && riskBody) {
    setCtlExpanded(btnToggleRisk, riskBody, false);
    btnToggleRisk.onclick = () => {
      toggleCtl(btnToggleRisk, riskBody);
      requestAnimationFrame(syncManualRiskHeights);
    };
  }

  const termInput = $("manualTerms") || $("nameList");
  if (termInput) {
    termInput.addEventListener("input", () => {
      setManualTermsFromText(termInput.value || "");

      if (!window.__export_snapshot) window.__export_snapshot = {};
      window.__export_snapshot.manualTerms = manualTerms.slice(0);

      const inTxt = (($("inputText") && $("inputText").value) || "").trim();
      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));

      renderInputOverlayForPdf(($("inputText") && $("inputText").value) || "");
      requestAnimationFrame(syncManualRiskHeights);
    });

    setManualTermsFromText(termInput.value || "");
    if (!window.__export_snapshot) window.__export_snapshot = {};
    window.__export_snapshot.manualTerms = manualTerms.slice(0);
  }

  const btnClear = $("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      if ($("inputText")) $("inputText").value = "";
      renderOutput("");

      window.__safe_hits = 0;
      window.__safe_breakdown = {};
      window.__safe_score = 0;
      window.__safe_level = "low";
      window.__safe_report = null;

      lastRunMeta.fromPdf = false;

      collapseManualArea();
      collapseRiskArea();
      clearProgress();
      clearBodyHeights();

      const rb = $("riskBox");
      if (rb) rb.innerHTML = "";

      if ($("pdfName")) $("pdfName").textContent = "";

      const wrap = $("inputWrap");
      if (wrap) {
        wrap.classList.remove("pdf-overlay-on");
        wrap.classList.remove("has-content");
      }
      if ($("inputOverlay")) $("inputOverlay").innerHTML = "";

      manualTerms = [];
      const termInput2 = $("manualTerms") || $("nameList");
      if (termInput2) {
        termInput2.value = "";
        termInput2.disabled = false;
      }

      lastUploadedFile = null;
      lastFileKind = "";
      lastProbe = null;
      lastPdfOriginalText = "";
      setStage3Ui("none");
      setManualPanesForMode("none");

      __manualRedactSession = null;
      __manualRedactResult = null;
      try { window.__manual_redact_last = null; } catch (_) {}

      window.__export_snapshot = null;

      // ✅ RULE C: Clear resets to "first-enter" start:
      // contentLangMode="auto", contentLang=""
      try {
        if (typeof resetContentLang === "function") resetContentLang();
        else {
          window.contentLangMode = "auto";
          window.contentLang = "";
        }
      } catch (_) {}

      // also clear export status UI (but keep boot line)
      try {
        window.__RasterExportLast = null;
        renderExportStatusCombined();
      } catch (_) {}

      window.dispatchEvent(new Event("safe:updated"));
    };
  }

  const btnCopy = $("btnCopy");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const t = window.I18N && window.I18N[currentLang];
      try {
        await navigator.clipboard.writeText(lastOutputPlain || "");
        if (t) {
          const old = btnCopy.textContent;
          btnCopy.textContent = t.btnCopied || old;
          setTimeout(() => { btnCopy.textContent = t.btnCopy || old; }, 900);
        }
      } catch (e) {}
    };
  }

  let autoTimer = null;
  const AUTO_DELAY = 220;

  const ta = $("inputText");
  if (ta) {
    ta.addEventListener("input", () => {
      updateInputWatermarkVisibility();

      if (lastRunMeta.fromPdf) renderInputOverlayForPdf(ta.value || "");

      const v = String(ta.value || "");
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (v.trim()) applyRules(v);
        else {
          renderOutput("");
          const rb = $("riskBox");
          if (rb) rb.innerHTML = "";
          clearProgress();
          window.dispatchEvent(new Event("safe:updated"));
        }
      }, AUTO_DELAY);
    });

    ta.addEventListener("scroll", () => {
      const overlay = $("inputOverlay");
      if (overlay) {
        overlay.scrollTop = ta.scrollTop;
        overlay.scrollLeft = ta.scrollLeft;
      }
    });
  }

  const btnManual = $("btnManualRedact");
  if (btnManual) {
    btnManual.onclick = async () => {
      const f = lastUploadedFile;
      if (!f) return;
      if (!window.RedactUI || !window.RedactUI.start) return;

      __manualRedactSession = await window.RedactUI.start({
        file: f,
        fileKind: lastFileKind,
        lang: currentLang // UI language only
      });

      try {
        if (window.__manual_redact_last) __manualRedactResult = window.__manual_redact_last;
      } catch (_) {}

      requestAnimationFrame(syncManualRiskHeights);
    };
  }

  const btnExportRasterPdf = $("btnExportRasterPdf");
  if (btnExportRasterPdf) {
    btnExportRasterPdf.onclick = async () => {
      expandRiskArea();
      expandManualArea();
      requestAnimationFrame(syncManualRiskHeights);

      const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : {};

      // ✅ start mirroring when user clicks export
      try { startExportStatusMirror(); } catch (_) {}

      try {
        const f = lastUploadedFile;

        if (!f) {
          setProgressText(t.progressNoFile || "未检测到文件，请先上传 PDF。", true);
          return;
        }

        if (lastStage3Mode === "B") {
          let res = __manualRedactResult || null;

          try {
            if (!res && window.__manual_redact_last) res = window.__manual_redact_last;
          } catch (_) {}

          if (!res && __manualRedactSession && typeof __manualRedactSession.done === "function") {
            res = await __manualRedactSession.done();
          }

          if (!res || !res.pages || !res.rectsByPage) {
            setProgressText(
              t.progressNeedManualFirst ||
              "请先点「手工涂抹」完成框选并关闭界面，然后再点「红删PDF」。",
              true
            );
            return;
          }

          if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromVisual) {
            setProgressText(t.progressExportMissing || "导出模块未加载", true);
            return;
          }

          setProgressText([
            (t.progressWorking || "处理中…"),
            `mode=B`,
            `dpi=${res.dpi || 600}`
          ], false);

          await window.RasterExport.exportRasterSecurePdfFromVisual(res);

          setProgressText(t.progressDone || "完成 ✅ 已开始下载。", false);
          requestAnimationFrame(syncManualRiskHeights);
          return;
        }

        if (lastFileKind !== "pdf") {
          setProgressText(t.progressNotPdf || "当前不是 PDF 文件。", true);
          return;
        }
        if (!lastProbe || !lastProbe.hasTextLayer) {
          setProgressText(t.progressNotReadable || "PDF 不可读（Mode B），请先手工涂抹并保存框选，然后再点红删PDF。", true);
          return;
        }

        if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
          setProgressText(t.progressExportMissing || "导出模块未加载", true);
          return;
        }

        const snap = window.__export_snapshot || {};
        const enabledKeys = Array.isArray(snap.enabledKeys) ? snap.enabledKeys : effectiveEnabledKeys();

        // ✅ KEY FIX: export uses langContent (rule language), not UI language
        const lang =
          snap.langContent ||
          (typeof getLangContent === "function" ? getLangContent() : null) ||
          currentLang;

        const manualTermsSafe = Array.isArray(snap.manualTerms) ? snap.manualTerms : [];

        setProgressText([
          (t.progressWorking || "处理中…"),
          `mode=A`,
          `lang=${lang}`,
          `moneyMode=M1`,
          `enabledKeys=${enabledKeys.length}`,
          `manualTerms=${manualTermsSafe.length}`
        ], false);

        await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
          file: f,
          lang,
          enabledKeys,
          moneyMode: "m1",
          dpi: 600,
          filename: `raster_secure_${Date.now()}.pdf`,
          manualTerms: manualTermsSafe
        });

        setProgressText(t.progressDone || "完成 ✅ 已开始下载。", false);
        requestAnimationFrame(syncManualRiskHeights);
      } catch (e) {
        const msg = (e && (e.message || String(e))) || "Unknown error";
        const t2 = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : {};
        setProgressText(`${t2.progressFailed || "导出失败："}\n${msg}`, true);
        requestAnimationFrame(syncManualRiskHeights);
      } finally {
        // ✅ stop mirror after completion/failure/early return
        try { stopExportStatusMirror(); } catch (_) {}
        // render once at end
        try { renderExportStatusCombined(); } catch (_) {}
      }
    };
  }

  bindPdfUI();
}

/* =========================
   E) UI: show engine boot self-check (__BOOT_OK) as a single cached line
   - does NOT overwrite export progress
   ========================= */
(function bootCheckUiWire() {
  function updateBootLine() {
    const b = window.__BOOT_OK;
    if (!b) return;

    if (b.ok) {
      window.__bootLine = "BOOT: OK";
      return;
    }

    const parts = [];
    parts.push("BOOT: NOT OK");
    parts.push("hasPolicy=" + String(!!b.hasPolicy));
    parts.push("hasPacks=" + String(!!b.hasPacks));
    if (Array.isArray(b.missingPacks) && b.missingPacks.length) {
      parts.push("missing=" + b.missingPacks.join(","));
    }
    window.__bootLine = parts.join(" | ");
  }

  function rerender() {
    try { renderExportStatusCombined(); } catch (_) {}
  }

  // react to event from engine.js
  try {
    window.addEventListener("boot:checked", function () {
      try { updateBootLine(); } catch (_) {}
      try { rerender(); } catch (_) {}
    });
  } catch (_) {}

  // also try once on next tick (covers cases where engine fired before listener)
  try {
    setTimeout(() => {
      try { updateBootLine(); } catch (_) {}
      try { rerender(); } catch (_) {}
    }, 0);
  } catch (_) {}
})();

// ================= boot =================
(function boot(){
  try {
    if (typeof initEnabled === "function") initEnabled();
    if (typeof setText === "function") setText();
    if (typeof bind === "function") bind();
    if (typeof updateInputWatermarkVisibility === "function") updateInputWatermarkVisibility();
    if (typeof initRiskResizeObserver === "function") initRiskResizeObserver();

    // ✅ IMPORTANT: do NOT force contentLang/contentLangMode here.
    // engine.js owns content language state machine.
  } catch (e) {
    console.error("[boot] failed:", e);
  }
})();

// =========================
// Shadow debug (no DevTools)
// Toggle: press "D" (shift optional)
// - outlines fixed/sticky layers
// - can hide common gradient overlays
// - dumps topmost element at screen bottom center
// =========================
(function shadowDebugBoot(){
  try{
    let on = false;

    function markAll(){
      const els = Array.from(document.querySelectorAll("*"));
      for(const el of els){
        const cs = getComputedStyle(el);
        const pos = cs.position;

        // mark only suspicious layers
        if(pos === "fixed" || pos === "sticky"){
          el.dataset.__dbg_shadow = "1";
          el.style.outline = "2px solid rgba(255,0,0,.7)";
          el.style.outlineOffset = "-2px";
        }
      }
    }

    function unmarkAll(){
      const els = Array.from(document.querySelectorAll("[data-__dbg_shadow]"));
      for(const el of els){
        delete el.dataset.__dbg_shadow;
        el.style.outline = "";
        el.style.outlineOffset = "";
      }
    }

    // hide common overlay patterns (gradient masks, pseudo overlays simulated by elements)
    function hideOverlaysYes(){
      const els = Array.from(document.querySelectorAll("*"));
      for(const el of els){
        const cs = getComputedStyle(el);

        const bg = cs.backgroundImage || "";
        const hasGrad = bg.includes("gradient");
        const hasMask = (cs.maskImage && cs.maskImage !== "none") || (cs.webkitMaskImage && cs.webkitMaskImage !== "none");
        const hasShadow = cs.boxShadow && cs.boxShadow !== "none";
        const opaque = parseFloat(cs.opacity || "1") < 1;

        // only target likely overlay layers
        if(hasGrad || hasMask || (hasShadow && (cs.position==="fixed"||cs.position==="sticky")) || opaque){
          el.dataset.__dbg_overlay = "1";
          el.style.backgroundImage = "none";
          el.style.webkitMaskImage = "none";
          el.style.maskImage = "none";
          el.style.boxShadow = "none";
        }
      }
    }

    function hideOverlaysNo(){
      const els = Array.from(document.querySelectorAll("[data-__dbg_overlay]"));
      for(const el of els){
        delete el.dataset.__dbg_overlay;
        el.style.backgroundImage = "";
        el.style.webkitMaskImage = "";
        el.style.maskImage = "";
        el.style.boxShadow = "";
      }
    }

    function probeBottomTop(){
      // bottom-center point
      const x = Math.floor(window.innerWidth / 2);
      const y = Math.floor(window.innerHeight - 8);
      const el = document.elementFromPoint(x, y);
      const name = el ? (el.tagName.toLowerCase() + (el.id ? ("#" + el.id) : "") + (el.className ? ("." + String(el.className).trim().replace(/\s+/g,".")) : "")) : "(none)";

      // show in your existing progress area if possible
      const host = document.getElementById("exportStatus") || document.getElementById("riskBox");
      if(host){
        const prev = host.textContent || "";
        host.textContent = `ShadowDebug: bottom-top = ${name}\n` + prev;
      }else{
        alert("ShadowDebug: bottom-top = " + name);
      }
    }

    function apply(){
      if(on){
        markAll();
        hideOverlaysYes();
        probeBottomTop();
      }else{
        unmarkAll();
        hideOverlaysNo();
      }
    }

    window.addEventListener("keydown", (e)=>{
      // press D to toggle
      if(String(e.key||"").toLowerCase() !== "d") return;
      on = !on;
      apply();
    });

    // expose manual trigger
    window.__shadowDebug = {
      on(){ on=true; apply(); },
      off(){ on=false; apply(); },
      probe: probeBottomTop
    };
  }catch(_){}
})();
