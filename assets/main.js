// =======================
// assets/main.js (FULL)
// v20260308a2-main-slim2-ui-orchestrator
// - UI orchestration only
// - no rule logic here
// - no matcher logic here
// - no raster rect logic here
// =========================

"use strict";

/* =========================
   UI adapters
   ========================= */

function __uiCall(nsFn, globalFn, arg) {
  try {
    if (window.__UI__ && typeof window.__UI__[nsFn] === "function") {
      window.__UI__[nsFn](arg);
      return true;
    }
  } catch (_) {}

  try {
    if (typeof window[globalFn] === "function") {
      window[globalFn](arg);
      return true;
    }
  } catch (_) {}

  return false;
}

function __uiSnap(reason) {
  __uiCall("snapshotLangStatus", "snapshotLangStatus", reason);
}

function __uiRender() {
  __uiCall("renderExportStatusCombined", "renderExportStatusCombined");
}

function __uiMirrorStart() {
  __uiCall("startExportStatusMirror", "startExportStatusMirror");
}

function __uiMirrorStop() {
  __uiCall("stopExportStatusMirror", "stopExportStatusMirror");
}

/* =========================
   Rule-engine lock invariant
   ========================= */

function ensureRuleEngineLocked(detectResult, reason) {
  try {
    const ll = String((detectResult && detectResult.lang) || "").toLowerCase();
    const L = ll === "zh" || ll === "de" || ll === "en" ? ll : "";
    if (!L) return { changed: false };

    const cur = String(window.ruleEngine || "").toLowerCase();
    const mode = String(window.ruleEngineMode || "").toLowerCase();

    if (mode !== "lock" || !cur) {
      window.ruleEngine = L;
      window.ruleEngineMode = "lock";

      try {
        window.dispatchEvent(new CustomEvent("ruleengine:changed", {
          detail: { lang: L, reason: reason || "" }
        }));
      } catch (_) {}

      return { changed: true, lang: L };
    }

    return { changed: false, lang: cur };
  } catch (_) {
    return { changed: false };
  }
}

/* =========================
   Language guard before apply
   ========================= */

function ensureLangBeforeApply(text) {
  try {
    if (window.__LANG_MODAL_OPENING__) {
      __uiSnap("guard:blocked_by_modal");
      __uiRender();
      return false;
    }

    if (window.__LangDetect && typeof window.__LangDetect.ensureContentLang === "function") {
      const ui = String(window.currentLang || "").toLowerCase();
      const r = window.__LangDetect.ensureContentLang(text, ui);

      try {
        if (r && r.ok === true && r.lang) {
          ensureRuleEngineLocked({ lang: r.lang }, "guard:lock_from_return");
        } else {
          const last =
            window.__LangDetect &&
            window.__LangDetect.__state &&
            window.__LangDetect.__state.last;

          const conf = last && typeof last.confidence === "number" ? last.confidence : null;

          if (last && last.lang && (conf == null || conf >= 0.78)) {
            ensureRuleEngineLocked({ lang: last.lang }, "guard:lock_from_last");
          }
        }
      } catch (_) {}

      __uiSnap("guard:ensureContentLang");

      if (r && r.ok === false) {
        __uiRender();
        return false;
      }

      __uiRender();
      return true;
    }

    __uiSnap("guard:LangDetect_missing");
    __uiRender();
  } catch (_) {}

  return true;
}

try {
  window.ensureLangBeforeApply = ensureLangBeforeApply;
} catch (_) {}

/* =========================
   Helpers
   ========================= */

function __getInputText() {
  const ta = document.getElementById("inputText");
  return ta ? String(ta.value || "") : "";
}

function __hasInputText() {
  return __getInputText().trim().length > 0;
}

function __reapplyCurrentInput() {
  const v = __getInputText();
  if (!v.trim()) return;
  if (!ensureLangBeforeApply(v)) return;
  if (typeof window.applyRules === "function") window.applyRules(v);
}

function __dispatchSafeUpdated() {
  try {
    window.dispatchEvent(new Event("safe:updated"));
  } catch (_) {}
}

function __syncHeightsSoon() {
  try {
    requestAnimationFrame(() => {
      try {
        if (typeof window.syncManualRiskHeights === "function") {
          window.syncManualRiskHeights();
        }
      } catch (_) {}
    });
  } catch (_) {}
}

function __clearRiskBox() {
  try {
    const rb = $("riskBox");
    if (rb) rb.innerHTML = "";
  } catch (_) {}
}

function __clearInputOverlay() {
  try {
    const wrap = $("inputWrap");
    if (wrap) {
      wrap.classList.remove("pdf-overlay-on");
      wrap.classList.remove("has-content");
    }
  } catch (_) {}

  try {
    const ov = $("inputOverlay");
    if (ov) ov.innerHTML = "";
  } catch (_) {}
}

function __resetManualTermsUi() {
  try {
    window.manualTerms = [];
  } catch (_) {}

  try {
    const termInput = $("manualTerms") || $("nameList");
    if (termInput) {
      termInput.value = "";
      termInput.disabled = false;
    }
  } catch (_) {}
}

function __resetStage3State() {
  try { window.lastUploadedFile = null; } catch (_) {}
  try { window.lastFileKind = ""; } catch (_) {}
  try { window.lastProbe = null; } catch (_) {}
  try { window.lastPdfOriginalText = ""; } catch (_) {}
  try { window.lastStage3Mode = "none"; } catch (_) {}

  try { window.__manualRedactSession = null; } catch (_) {}
  try { window.__manualRedactResult = null; } catch (_) {}
  try { window.__manual_redact_last = null; } catch (_) {}

  try {
    if (typeof window.setStage3Ui === "function") window.setStage3Ui("none");
  } catch (_) {}

  try {
    if (typeof window.setManualPanesForMode === "function") window.setManualPanesForMode("none");
  } catch (_) {}
}

function __resetExportSnapshots() {
  try { window.__export_snapshot = null; } catch (_) {}
  try { window.__export_snapshot_byLang = null; } catch (_) {}
  try { window.__RasterExportLast = null; } catch (_) {}
}

function __resetSafeState() {
  try { window.__safe_hits = 0; } catch (_) {}
  try { window.__safe_breakdown = {}; } catch (_) {}
  try { window.__safe_score = 0; } catch (_) {}
  try { window.__safe_level = "low"; } catch (_) {}
  try { window.__safe_report = null; } catch (_) {}
  try { window.__ENGINE_PRIMARY_SOURCE = ""; } catch (_) {}
  try { window.__overlay_source = ""; } catch (_) {}
}

function __resetContentLangState() {
  try {
    if (typeof window.resetContentLang === "function") {
      window.resetContentLang();
    } else {
      window.ruleEngineMode = "auto";
      window.ruleEngine = "";
    }
  } catch (_) {}
}

function __setProgress(msg, isError) {
  try {
    if (typeof window.setProgressText === "function") {
      window.setProgressText(msg, !!isError);
    }
  } catch (_) {}
}

function __getExportEnabledKeys() {
  try {
    const snap = window.__export_snapshot || {};
    if (Array.isArray(snap.enabledKeys)) return snap.enabledKeys;
  } catch (_) {}

  try {
    if (typeof window.effectiveEnabledKeys === "function") {
      return window.effectiveEnabledKeys();
    }
  } catch (_) {}

  return [];
}

function __getExportLang() {
  try {
    const snap = window.__export_snapshot || {};
    if (snap.langContent) return snap.langContent;
  } catch (_) {}

  try {
    if (typeof window.getLangContent === "function") return window.getLangContent();
  } catch (_) {}

  try {
    if (String(window.ruleEngineMode || "").toLowerCase() === "lock" && window.ruleEngine) {
      return window.ruleEngine;
    }
  } catch (_) {}

  return "";
}

function __getExportManualTerms() {
  try {
    const snap = window.__export_snapshot || {};
    if (Array.isArray(snap.manualTerms)) return snap.manualTerms;
  } catch (_) {}
  return [];
}

/* =========================
   Optional manual picker
   ========================= */

window.openLangPicker = function () {
  try {
    const v = __getInputText();

    if (!window.__LangModal || typeof window.__LangModal.open !== "function") return;

    try { window.__LANG_MODAL_OPENING__ = true; } catch (_) {}

    __uiSnap("picker:open");
    __uiRender();

    window.__LangModal.open({
      uiLang: String(window.currentLang || "en").toLowerCase(),
      detected: (window.getLangContent && window.getLangContent()) || window.ruleEngine || "",
      confidence: null,
      candidates: ["zh", "de", "en"],
      reason: "manual_open",
      onPick: function (lang) {
        try { window.__LANG_MODAL_OPENING__ = false; } catch (_) {}

        const ll = String(lang || "").toLowerCase();
        const L = ll === "zh" || ll === "de" || ll === "en" ? ll : "";
        if (!L) return;

        window.ruleEngine = L;
        window.ruleEngineMode = "lock";

        __uiSnap("picker:onPick_lock");
        __uiRender();

        if (v.trim()) __reapplyCurrentInput();
      },
      onClose: function () {
        try { window.__LANG_MODAL_OPENING__ = false; } catch (_) {}
        __uiSnap("picker:onClose");
        __uiRender();
      }
    });
  } catch (_) {}
};

/* =========================
   Bind
   ========================= */

function bindLangButtons() {
  document.querySelectorAll(".lang button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");

      window.currentLang = b.dataset.lang;

      if (typeof window.setText === "function") window.setText();

      __uiSnap("ui:switch");
      __uiRender();

      if (__hasInputText()) __reapplyCurrentInput();
      else __dispatchSafeUpdated();

      __syncHeightsSoon();
      __uiRender();
    };
  });
}

function bindFoldControls() {
  const btnToggleManual = $("btnToggleManual");
  const manualBody = $("manualBody");
  if (btnToggleManual && manualBody) {
    setCtlExpanded(btnToggleManual, manualBody, false);
    btnToggleManual.onclick = () => {
      toggleCtl(btnToggleManual, manualBody);
      __syncHeightsSoon();
    };
  }

  const btnToggleRisk = $("btnToggleRisk");
  const riskBody = $("riskBody");
  if (btnToggleRisk && riskBody) {
    setCtlExpanded(btnToggleRisk, riskBody, false);
    btnToggleRisk.onclick = () => {
      toggleCtl(btnToggleRisk, riskBody);
      __syncHeightsSoon();
    };
  }
}

function bindManualTermsInput() {
  const termInput = $("manualTerms") || $("nameList");
  if (!termInput) return;

  termInput.addEventListener("input", () => {
    if (typeof window.setManualTermsFromText === "function") {
      window.setManualTermsFromText(termInput.value || "");
    }

    if (!window.__export_snapshot) window.__export_snapshot = {};
    try {
      window.__export_snapshot.manualTerms = Array.isArray(window.manualTerms) ? window.manualTerms.slice(0) : [];
    } catch (_) {
      window.__export_snapshot.manualTerms = [];
    }

    if (__hasInputText()) __reapplyCurrentInput();
    else __dispatchSafeUpdated();

    __syncHeightsSoon();
    __uiSnap("manualTerms:input");
    __uiRender();
  });

  if (typeof window.setManualTermsFromText === "function") {
    window.setManualTermsFromText(termInput.value || "");
  }

  if (!window.__export_snapshot) window.__export_snapshot = {};
  try {
    window.__export_snapshot.manualTerms = Array.isArray(window.manualTerms) ? window.manualTerms.slice(0) : [];
  } catch (_) {
    window.__export_snapshot.manualTerms = [];
  }
}

function bindClearButton() {
  const btnClear = $("btnClear");
  if (!btnClear) return;

  btnClear.onclick = () => {
    try {
      if (typeof window.initEnabled === "function") window.initEnabled();
    } catch (_) {}

    try {
      if ($("inputText")) {
        $("inputText").value = "";
        $("inputText").readOnly = false;
      }
    } catch (_) {}

    try {
      if (typeof window.renderOutput === "function") window.renderOutput("");
    } catch (_) {}

    try { if (window.lastRunMeta) window.lastRunMeta.fromPdf = false; } catch (_) {}

    try { if (typeof window.collapseManualArea === "function") window.collapseManualArea(); } catch (_) {}
    try { if (typeof window.collapseRiskArea === "function") window.collapseRiskArea(); } catch (_) {}
    try { if (typeof window.clearProgress === "function") window.clearProgress(); } catch (_) {}
    try { if (typeof window.clearBodyHeights === "function") window.clearBodyHeights(); } catch (_) {}

    __clearRiskBox();
    __clearInputOverlay();
    __resetManualTermsUi();
    __resetStage3State();
    __resetExportSnapshots();
    __resetSafeState();
    __resetContentLangState();

    try {
      if ($("pdfName")) $("pdfName").textContent = "";
    } catch (_) {}

    __uiSnap("ui:clear");
    __uiRender();

    try {
      if (typeof window.initEnabled === "function") window.initEnabled();
    } catch (_) {}

    __dispatchSafeUpdated();
  };
}

function bindCopyButton() {
  const btnCopy = $("btnCopy");
  if (!btnCopy) return;

  btnCopy.onclick = async () => {
    const t = window.I18N && window.I18N[window.currentLang];
    try {
      await navigator.clipboard.writeText(window.__lastOutputPlain || "");
      if (t) {
        const old = btnCopy.textContent;
        btnCopy.textContent = t.btnCopied || old;
        setTimeout(() => {
          btnCopy.textContent = t.btnCopy || old;
        }, 900);
      }
    } catch (_) {}
  };
}

function bindInputAutoApply() {
  let autoTimer = null;
  const AUTO_DELAY = 220;

  const ta = $("inputText");
  if (!ta) return;

  ta.addEventListener("input", () => {
    try {
      if (typeof window.updateInputWatermarkVisibility === "function") {
        window.updateInputWatermarkVisibility();
      }
    } catch (_) {}

    const v = String(ta.value || "");
    clearTimeout(autoTimer);

    autoTimer = setTimeout(() => {
      if (v.trim()) {
        if (!ensureLangBeforeApply(v)) return;
        if (typeof window.applyRules === "function") window.applyRules(v);
        __uiSnap("input:applyRules");
        __uiRender();
      } else {
        try {
          if (typeof window.renderOutput === "function") window.renderOutput("");
        } catch (_) {}
        __clearRiskBox();
        try { if (typeof window.clearProgress === "function") window.clearProgress(); } catch (_) {}
        __uiSnap("input:empty");
        __uiRender();
        __dispatchSafeUpdated();
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

function bindManualRedactButton() {
  const btnManual = $("btnManualRedact");
  if (!btnManual) return;

  btnManual.onclick = async () => {
    const f = window.lastUploadedFile;
    if (!f) return;
    if (!window.RedactUI || !window.RedactUI.start) return;

    window.__manualRedactSession = await window.RedactUI.start({
      file: f,
      fileKind: window.lastFileKind,
      lang: window.currentLang
    });

    try {
      if (window.__manual_redact_last) window.__manualRedactResult = window.__manual_redact_last;
    } catch (_) {}

    __syncHeightsSoon();
    __uiSnap("modeB:manualRedactStart");
    __uiRender();
  };
}

async function handleModeBExport(t) {
  let res = window.__manualRedactResult || null;

  try {
    if (!res && window.__manual_redact_last) res = window.__manual_redact_last;
  } catch (_) {}

  if (!res && window.__manualRedactSession && typeof window.__manualRedactSession.done === "function") {
    res = await window.__manualRedactSession.done();
  }

  if (!res || !res.pages || !res.rectsByPage) {
    __setProgress(
      t.progressNeedManualFirst || "请先点「手工涂抹」完成框选并关闭界面，然后再点「红删PDF」。",
      true
    );
    return;
  }

  if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromVisual) {
    __setProgress(t.progressExportMissing || "导出模块未加载", true);
    return;
  }

  __setProgress([t.progressWorking || "处理中…", "mode=B", `dpi=${res.dpi || 600}`], false);

  await window.RasterExport.exportRasterSecurePdfFromVisual(res);

  __setProgress(t.progressDone || "完成 ✅ 已开始下载。", false);
  __syncHeightsSoon();
}

async function handleModeAExport(f, t) {
  if (window.lastFileKind !== "pdf") {
    __setProgress(t.progressNotPdf || "当前不是 PDF 文件。", true);
    return;
  }

  if (!window.lastProbe || !window.lastProbe.hasTextLayer) {
    __setProgress(
      t.progressNotReadable || "PDF 不可读（Mode B），请先手工涂抹并保存框选，然后再点红删PDF。",
      true
    );
    return;
  }

  if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
    __setProgress(t.progressExportMissing || "导出模块未加载", true);
    return;
  }

  const enabledKeys = __getExportEnabledKeys();
  const lang = __getExportLang();
  const manualTermsSafe = __getExportManualTerms();

  __setProgress(
    [
      t.progressWorking || "处理中…",
      "mode=A",
      `lang=${lang || "(auto)"}`,
      "moneyMode=M1",
      `enabledKeys=${enabledKeys.length}`,
      `manualTerms=${manualTermsSafe.length}`
    ],
    false
  );

  await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
    file: f,
    lang,
    enabledKeys,
    moneyMode: "m1",
    dpi: 600,
    filename: `raster_secure_${Date.now()}.pdf`,
    manualTerms: manualTermsSafe
  });

  __setProgress(t.progressDone || "完成 ✅ 已开始下载。", false);
  __syncHeightsSoon();
}

function bindExportButton() {
  const btnExportRasterPdf = $("btnExportRasterPdf");
  if (!btnExportRasterPdf) return;

  btnExportRasterPdf.onclick = async () => {
    try { if (typeof window.expandRiskArea === "function") window.expandRiskArea(); } catch (_) {}
    try { if (typeof window.expandManualArea === "function") window.expandManualArea(); } catch (_) {}
    __syncHeightsSoon();

    const t = window.I18N && window.I18N[window.currentLang] ? window.I18N[window.currentLang] : {};
    __uiMirrorStart();
    __uiSnap("export:click");
    __uiRender();

    try {
      const f = window.lastUploadedFile;

      if (!f) {
        __setProgress(t.progressNoFile || "未检测到文件，请先上传 PDF。", true);
        return;
      }

      if (window.lastStage3Mode === "B") {
        await handleModeBExport(t);
        return;
      }

      await handleModeAExport(f, t);
    } catch (e) {
      const msg = (e && (e.message || String(e))) || "Unknown error";
      const t2 = window.I18N && window.I18N[window.currentLang] ? window.I18N[window.currentLang] : {};
      __setProgress(`${t2.progressFailed || "导出失败："}\n${msg}`, true);
      __syncHeightsSoon();
    } finally {
      __uiMirrorStop();
      __uiRender();
    }
  };
}

function bind() {
  bindLangButtons();
  bindFoldControls();
  bindManualTermsInput();
  bindClearButton();
  bindCopyButton();
  bindInputAutoApply();
  bindManualRedactButton();
  bindExportButton();

  try {
    if (typeof window.bindPdfUI === "function") window.bindPdfUI();
  } catch (_) {}
}

window.bind = bind;

/* =========================
   Boot self-check UI wire
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
    __uiRender();
  }

  try {
    window.addEventListener("boot:checked", function () {
      try { updateBootLine(); } catch (_) {}
      try { rerender(); } catch (_) {}
    });
  } catch (_) {}

  try {
    setTimeout(() => {
      try { updateBootLine(); } catch (_) {}
      try { rerender(); } catch (_) {}
    }, 0);
  } catch (_) {}
})();

/* =========================
   Boot
   ========================= */

(function boot() {
  try {
    if (typeof window.initEnabled === "function") window.initEnabled();
    if (typeof window.setText === "function") window.setText();
    if (typeof window.bind === "function") window.bind();
    if (typeof window.updateInputWatermarkVisibility === "function") {
      window.updateInputWatermarkVisibility();
    }
    if (typeof window.initRiskResizeObserver === "function") {
      window.initRiskResizeObserver();
    }

    __uiSnap("boot");
    __uiRender();
  } catch (e) {
    console.error("[boot] failed:", e);
  }
})();
