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

      try {
        const f = lastUploadedFile;

        if (!f) { setProgressText(t.progressNoFile || "未检测到文件，请先上传 PDF。", true); return; }

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

        if (lastFileKind !== "pdf") { setProgressText(t.progressNotPdf || "当前不是 PDF 文件。", true); return; }
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
      }
    };
  }

  bindPdfUI();
}

/* =========================
   E) UI: show engine boot self-check (__BOOT_OK) in exportStatus
   - in-memory only
   - no dependency on rules.js
   ========================= */
(function bootCheckUiWire() {
  function renderBootStatus() {
    const el = document.getElementById("exportStatus");
    if (!el) return;

    const b = window.__BOOT_OK;
    if (!b) {
      // no status yet
      return;
    }

    if (b.ok) {
      // keep minimal, avoid noise
      // (if you want more detail later, we can expand this)
      el.textContent = "BOOT: OK";
      return;
    }

    const lines = [];
    lines.push("BOOT: NOT OK");
    lines.push("hasPolicy: " + String(!!b.hasPolicy));
    lines.push("hasPacks: " + String(!!b.hasPacks));
    if (Array.isArray(b.missingPacks) && b.missingPacks.length) {
      lines.push("missing packs: " + b.missingPacks.join(", "));
    }
    el.textContent = lines.join("\n");
  }

  // react to event from engine.js
  try {
    window.addEventListener("boot:checked", function () {
      try { renderBootStatus(); } catch (_) {}
    });
  } catch (_) {}

  // also try once on next tick (covers cases where engine fired before listener)
  try {
    setTimeout(() => { try { renderBootStatus(); } catch (_) {} }, 0);
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
