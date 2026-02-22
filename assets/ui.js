// =========================
// assets/ui.js (from app.js)
// =========================

// ================= Stage 3 UI texts =================
function stage3Text(key){
  const map = {
    zh: { btnExportPdf: "红删PDF", btnManual: "手工涂抹" },
    de: { btnExportPdf: "PDF", btnManual: "Manuell" },
    en: { btnExportPdf: "PDF", btnManual: "Manual" }
  };
  const m = map[currentLang] || map.zh;
  return m[key] || "";
}

function setStage3Ui(mode){
  lastStage3Mode = mode || "none";
  const btnPdf  = $("btnExportRasterPdf");
  const btnMan  = $("btnManualRedact");

  show(btnPdf, lastStage3Mode === "A" || lastStage3Mode === "B");
  show(btnMan, lastStage3Mode === "B");

  const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : null;

  if (btnPdf) btnPdf.textContent = (t && t.btnRedactPdf) ? t.btnRedactPdf : stage3Text("btnExportPdf");
  if (btnMan) btnMan.textContent = (t && t.btnManualRedact) ? t.btnManualRedact : stage3Text("btnManual");

  if (btnPdf && !String(btnPdf.textContent || "").trim()) btnPdf.textContent = stage3Text("btnExportPdf");
  if (btnMan && !String(btnMan.textContent || "").trim()) btnMan.textContent = stage3Text("btnManual");
}

// ================= Manual panes switch (Mode A/B) =================
function setManualPanesForMode(mode){
  const paneA = $("manualTermsPane");
  const paneB = $("manualRedactPane");
  const termInput = $("manualTerms") || $("nameList");

  if (mode === "A") {
    show(paneA, true);
    show(paneB, false);
    if (termInput) termInput.disabled = false;
    return;
  }

  if (mode === "B") {
    show(paneA, false);
    show(paneB, true);
    if (termInput) termInput.disabled = true;
    return;
  }

  show(paneA, true);
  show(paneB, false);
  if (termInput) termInput.disabled = false;
}

// ================= Rail note: switch by mode =================
function setManualRailTextByMode(){
  const t = window.I18N && window.I18N[currentLang];
  const note = $("ui-manual-rail-note");
  const title = $("ui-manual-rail-title");
  if (!t) return;
  if (title) title.textContent = t.manualRailTitle || "";

  if (!note) return;

  if (lastStage3Mode === "B") {
    note.textContent = t.manualRailTextB || t.manualRailText || "";
  } else {
    note.textContent = t.manualRailTextA || t.manualRailText || "";
  }
}

// ================= Unified control toggles =================
function setCtlExpanded(btn, body, expanded){
  if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (body) {
    body.classList.toggle("open", !!expanded);
    body.style.display = expanded ? "" : "none";
  }
}
function toggleCtl(btn, body){
  const cur = (btn && btn.getAttribute("aria-expanded") === "true");
  setCtlExpanded(btn, body, !cur);
}

// ================= Desktop equal-height + minimum expanded height =================
const DESKTOP_MIN_OPEN_H = 260;

function clearBodyHeights(){
  const manualBody = $("manualBody");
  const riskBody = $("riskBody");
  if (manualBody) {
    manualBody.style.height = "";
    manualBody.style.maxHeight = "";
    manualBody.style.minHeight = "";
    manualBody.style.overflow = "";
  }
  if (riskBody) {
    riskBody.style.height = "";
    riskBody.style.maxHeight = "";
    riskBody.style.minHeight = "";
    riskBody.style.overflow = "";
  }
}

function syncManualRiskHeights(){
  if (isSmallScreen()) { clearBodyHeights(); return; }

  const manualBody = $("manualBody");
  const riskBody = $("riskBody");
  if (!manualBody || !riskBody) return;

  const manOpen = $("btnToggleManual")?.getAttribute("aria-expanded") === "true";
  const riskOpen = $("btnToggleRisk")?.getAttribute("aria-expanded") === "true";
  if (!manOpen || !riskOpen) { clearBodyHeights(); return; }

  const rh = riskBody.getBoundingClientRect().height;
  const target = Math.max(Math.ceil(rh || 0), DESKTOP_MIN_OPEN_H);

  manualBody.style.height = `${target}px`;
  manualBody.style.maxHeight = `${target}px`;
  manualBody.style.minHeight = `${DESKTOP_MIN_OPEN_H}px`;
  manualBody.style.overflow = "hidden";

  riskBody.style.height = `${target}px`;
  riskBody.style.maxHeight = `${target}px`;
  riskBody.style.minHeight = `${DESKTOP_MIN_OPEN_H}px`;
  riskBody.style.overflow = "hidden";
}

let __riskResizeObs = null;
function initRiskResizeObserver(){
  const riskBody = $("riskBody");
  if (!riskBody || !("ResizeObserver" in window)) return;

  if (__riskResizeObs) __riskResizeObs.disconnect();

  __riskResizeObs = new ResizeObserver(() => {
    requestAnimationFrame(syncManualRiskHeights);
  });

  __riskResizeObs.observe(riskBody);
}

function expandManualArea(){
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) setCtlExpanded(btn, body, true);
}
function expandRiskArea(){
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) setCtlExpanded(btn, body, true);
}
function collapseManualArea(){
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) setCtlExpanded(btn, body, false);
}
function collapseRiskArea(){
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) setCtlExpanded(btn, body, false);
}

// ================= Progress area =================
function setProgressText(lines, isError){
  const box = $("exportStatus");
  if (!box) return;

  const s = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  box.style.color = isError ? "#ffb4b4" : "";
  box.textContent = s;
}

function clearProgress(){
  const a = $("exportStatus");
  if (a) a.textContent = "";
}

// ================= UI text =================
function exportTitleFallback(){
  if (currentLang === "de") return "Fortschritt";
  if (currentLang === "en") return "Progress";
  return "生成进程";
}

function setText() {
  const t = window.I18N && window.I18N[currentLang];
  if (!t) return;

  window.currentLang = currentLang;

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  // ✅ FIX: mobile top IO tabs text
  if ($("ui-tab-in")) $("ui-tab-in").textContent = t.tabIn || "";
  if ($("ui-tab-out")) $("ui-tab-out").textContent = t.tabOut || "";

  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  if ($("ui-upload-btn")) $("ui-upload-btn").textContent = t.btnUpload;

  const spMan = $("ui-manual-toggle-title");
  const spRisk = $("ui-risk-toggle-title");
  if (spMan) spMan.textContent = t.manualTitle || "手工处理";
  if (spRisk) spRisk.textContent = t.riskTitle || "风险评分";

  setManualRailTextByMode();

  const exportTitle = $("ui-export-title");
  if (exportTitle) exportTitle.textContent = t.exportTitle || exportTitleFallback();

  if ($("manualTerms")) $("manualTerms").placeholder = t.manualPlaceholder || "例如：张三, 李四, Bei.de Tech GmbH";

  const mrNote = $("ui-manual-redact-note");
  if (mrNote) mrNote.textContent = t.manualRedactNote || "";

  if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;
  if ($("btnClear")) $("btnClear").textContent = t.btnClear;

  if ($("linkLearn")) $("linkLearn").textContent = t.learn;
  if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
  if ($("linkScope")) $("linkScope").textContent = t.scope;

  if ($("ui-foot")) $("ui-foot").textContent = t.foot;

  setStage3Ui(lastStage3Mode);
}

// =========================
// UI boot patch (restored from app.js boot responsibility)
// Purpose: ensure UI texts are applied once DOM+i18n are ready,
// even after app.js is split into multiple files.
// NOTE: does NOT change any existing logic; only triggers setText/setStage3Ui safely.
// =========================
(function uiBootPatch(){
  function safeApplyTexts(){
    try {
      // i18n not ready -> skip
      if (!(window.I18N && window.I18N[currentLang])) return;

      // apply all UI texts (includes stage3 buttons)
      if (typeof setText === "function") setText();
      else if (typeof setStage3Ui === "function") setStage3Ui(lastStage3Mode);

    } catch (_) {}
  }

  // If DOM already parsed, run ASAP; otherwise wait for DOMContentLoaded.
  if (document.readyState === "interactive" || document.readyState === "complete") {
    // defer one frame to let other scripts define globals (engine/stage3/main)
    requestAnimationFrame(safeApplyTexts);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      requestAnimationFrame(safeApplyTexts);
    }, { once: true });
  }

  // Also listen for i18n late-load edge case
  window.addEventListener("load", () => {
    requestAnimationFrame(safeApplyTexts);
  }, { once: true });
})();
