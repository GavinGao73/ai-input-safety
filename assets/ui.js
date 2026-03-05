// =========================
// assets/ui.js (from app.js)
// v20260305a1 — PATCHED
// - Keep i18n in i18n.js
// - ui.js stays “UI logic + UI observability” (NOT language dict)
// - Moved lang-status / export-status telemetry helpers here (from main.js)
// - Optional debug flags:
//   window.__DEBUG_LANG__ = true   -> show extra lines in exportStatus
//   window.__TRACE_RULEENGINE__ = true -> enable ruleEngine write tracing (hook)
// =========================

// ================= Stage 3 UI texts =================

// Stable global DOM helpers (used by main.js bind())
// $: CSS selector (querySelector) OR id shorthand ("foo" => "#foo")
// $$: CSS selector all (array)
(function () {
  function normSel(sel) {
    const s = String(sel || "").trim();
    if (!s) return s;

    // Already a selector -> keep
    if (
      s[0] === "#" ||
      s[0] === "." ||
      s[0] === "[" ||
      s[0] === ":" ||
      s.includes(" ") ||
      s.includes(">") ||
      s.includes("+") ||
      s.includes("~")
    ) {
      return s;
    }

    // Otherwise treat as id shorthand
    return "#" + s;
  }

  if (typeof window.$ !== "function") {
    window.$ = function (sel, root) {
      const r = root || document;
      return r.querySelector(normSel(sel));
    };
  }
  if (typeof window.$$ !== "function") {
    window.$$ = function (sel, root) {
      const r = root || document;
      return Array.from(r.querySelectorAll(normSel(sel)));
    };
  }
})();

function stage3Text(key) {
  const map = {
    zh: { btnExportPdf: "红删PDF", btnManual: "手工涂抹" },
    de: { btnExportPdf: "PDF", btnManual: "Manuell" },
    en: { btnExportPdf: "PDF", btnManual: "Manual" }
  };
  const m = map[currentLang] || map.zh;
  return m[key] || "";
}

function setStage3Ui(mode) {
  lastStage3Mode = mode || "none";
  const btnPdf = $("btnExportRasterPdf");
  const btnMan = $("btnManualRedact");

  show(btnPdf, lastStage3Mode === "A" || lastStage3Mode === "B");
  show(btnMan, lastStage3Mode === "B");

  const t = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang] : null;

  if (btnPdf) btnPdf.textContent = t && t.btnRedactPdf ? t.btnRedactPdf : stage3Text("btnExportPdf");
  if (btnMan) btnMan.textContent = t && t.btnManualRedact ? t.btnManualRedact : stage3Text("btnManual");

  if (btnPdf && !String(btnPdf.textContent || "").trim()) btnPdf.textContent = stage3Text("btnExportPdf");
  if (btnMan && !String(btnMan.textContent || "").trim()) btnMan.textContent = stage3Text("btnManual");
}

// ================= Manual panes switch (Mode A/B) =================
function setManualPanesForMode(mode) {
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
function setManualRailTextByMode() {
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
function setCtlExpanded(btn, body, expanded) {
  if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (body) {
    body.classList.toggle("open", !!expanded);
    body.style.display = expanded ? "" : "none";
  }
}
function toggleCtl(btn, body) {
  const cur = btn && btn.getAttribute("aria-expanded") === "true";
  setCtlExpanded(btn, body, !cur);
}

// ================= Desktop equal-height + minimum expanded height =================
const DESKTOP_MIN_OPEN_H = 260;

function clearBodyHeights() {
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

function syncManualRiskHeights() {
  if (isSmallScreen()) {
    clearBodyHeights();
    return;
  }

  const manualBody = $("manualBody");
  const riskBody = $("riskBody");
  if (!manualBody || !riskBody) return;

  const manOpen = $("btnToggleManual")?.getAttribute("aria-expanded") === "true";
  const riskOpen = $("btnToggleRisk")?.getAttribute("aria-expanded") === "true";
  if (!manOpen || !riskOpen) {
    clearBodyHeights();
    return;
  }

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
function initRiskResizeObserver() {
  const riskBody = $("riskBody");
  if (!riskBody || !("ResizeObserver" in window)) return;

  if (__riskResizeObs) __riskResizeObs.disconnect();

  __riskResizeObs = new ResizeObserver(() => {
    requestAnimationFrame(syncManualRiskHeights);
  });

  __riskResizeObs.observe(riskBody);
}

function expandManualArea() {
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) setCtlExpanded(btn, body, true);
}
function expandRiskArea() {
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) setCtlExpanded(btn, body, true);
}
function collapseManualArea() {
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) setCtlExpanded(btn, body, false);
}
function collapseRiskArea() {
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) setCtlExpanded(btn, body, false);
}

// ================= Progress area =================
function setProgressText(lines, isError) {
  const box = $("exportStatus");
  if (!box) return;

  const s = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  box.style.color = isError ? "#ffb4b4" : "";
  box.textContent = s;
}

function clearProgress() {
  const a = $("exportStatus");
  if (a) a.textContent = "";
}

// ================= UI text =================
function exportTitleFallback() {
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

  // keep exportStatus informative on text refresh
  try {
    if (typeof renderExportStatusCombined === "function") renderExportStatusCombined();
  } catch (_) {}
}

/* =========================
   UI Observability (moved from main.js)
   - Lang status snapshot + export status combined view
   - Designed to NOT grow with language count (uses I18N only for a few labels)
   ========================= */

(function ensureUiDebugFlags() {
  try {
    if (typeof window.__DEBUG_LANG__ === "undefined") window.__DEBUG_LANG__ = false;
    // __TRACE_RULEENGINE__ default false; only enable when you really need traces
    if (typeof window.__TRACE_RULEENGINE__ === "undefined") window.__TRACE_RULEENGINE__ = false;
  } catch (_) {}
})();

function __normLang3(x) {
  const s = String(x || "").toLowerCase();
  return s === "zh" || s === "de" || s === "en" ? s : "";
}

function snapshotLangStatus(reason) {
  try {
    const last =
      window.__LangDetect && window.__LangDetect.__state && window.__LangDetect.__state.last
        ? window.__LangDetect.__state.last
        : null;

    const detected = last
      ? {
          lang: __normLang3(last.lang),
          confidence: typeof last.confidence === "number" ? last.confidence : null,
          needsConfirm: !!last.needsConfirm,
          reason: last.reason || "",
          source: last.source || "",
          candidates: Array.isArray(last.candidates) ? last.candidates.map(__normLang3).filter(Boolean) : []
        }
      : null;

    const ui = __normLang3(window.currentLang) || "";
    const re = __normLang3(window.ruleEngine) || "";
    const mode = String(window.ruleEngineMode || "").toLowerCase() || "";

    let content = "";
    try {
      if (typeof window.getLangContent === "function") content = __normLang3(window.getLangContent()) || "";
    } catch (_) {}

    window.__LANG_STATUS__ = {
      when: Date.now(),
      iso: new Date().toISOString(),
      reason: String(reason || ""),
      uiLang: ui,
      ruleEngine: re,
      ruleEngineMode: mode,
      langContent: content || re || ui || "",
      modalOpening: !!window.__LANG_MODAL_OPENING__,
      detected
    };
  } catch (_) {}
}

function renderLangStatusLines(t) {
  const st = window.__LANG_STATUS__ || null;
  if (!st) return [];

  const lines = [];
  lines.push(`UI=${st.uiLang || "(?)"}`);
  lines.push(`content=${st.langContent || "(?)"}`);
  lines.push(`ruleEngine=${st.ruleEngine || "(empty)"} (${st.ruleEngineMode || "auto"})`);
  lines.push(`modal=${st.modalOpening ? "OPEN" : "false"}`);

  if (st.detected) {
    const d = st.detected;
    const conf = typeof d.confidence === "number" ? d.confidence.toFixed(2) : "(?)";
    const cand = d.candidates && d.candidates.length ? d.candidates.join(",") : "-";
    lines.push(`detect.last=${d.lang || "(?)"} conf=${conf} needsConfirm=${d.needsConfirm ? "true" : "false"}`);
    if (d.reason || d.source) lines.push(`detect.reason=${d.reason || "-"} src=${d.source || "-"}`);
    lines.push(`detect.candidates=${cand}`);

    // extra debug lines (optional)
    try {
      if (window.__DEBUG_LANG__ === true) {
        // include detector version if present
        const ver =
          window.__LangDetect && window.__LangDetect.__state && window.__LangDetect.__state.ver
            ? String(window.__LangDetect.__state.ver)
            : "";
        if (ver) lines.push(`detect.ver=${ver}`);
      }
    } catch (_) {}
  } else {
    lines.push("detect.last=(none)");
  }

  if (st.reason) lines.push(`telemetry=${st.reason}`);
  return lines;
}

function i18nProgressLine(phase, t) {
  const map = {
    "exportRasterSecurePdfFromReadablePdf:begin": (t && t.progressPhaseBegin) || "开始准备…",
    autoRedactReadablePdf: (t && t.progressPhaseScan) || "扫描并计算遮盖区域…",
    "exportRasterSecurePdfFromReadablePdf:export": (t && t.progressPhaseExport) || "生成安全PDF（纯图片）…",
    exportRasterSecurePdfFromVisual: (t && t.progressPhaseExport) || "生成安全PDF（纯图片）…"
  };
  return map[phase] || ((t && t.progressPhaseWorking) || "处理中…");
}

function renderExportStatusCombined() {
  const el = document.getElementById("exportStatus");
  if (!el) return;

  const t = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang] : {};
  const s = window.__RasterExportLast || null;
  const bootLine = window.__bootLine || "";

  const lines = [];

  if (bootLine) lines.push(bootLine);

  // always show language status (if available)
  try {
    const langLines = renderLangStatusLines(t);
    if (langLines && langLines.length) lines.push(...langLines);
  } catch (_) {}

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

  if (!lines.length) return;

  el.style.color = ""; // reset error color if any
  el.textContent = lines.join("\n");
}

function startExportStatusMirror() {
  if (window.__exportStatusTimer) clearInterval(window.__exportStatusTimer);
  window.__exportStatusTimer = setInterval(() => {
    try {
      renderExportStatusCombined();
    } catch (_) {}
  }, 120);
}

function stopExportStatusMirror() {
  if (window.__exportStatusTimer) {
    clearInterval(window.__exportStatusTimer);
    window.__exportStatusTimer = null;
  }
}

/* =========================
   Optional: ruleEngine write tracing (debug only)
   - Disabled by default. Enable by setting window.__TRACE_RULEENGINE__=true before ui.js loads,
     or call window.enableRuleEngineTrace(true) after load.
   ========================= */

function traceRuleEngineWrites() {
  try {
    if (window.__TRACE_RULEENGINE__ !== true) return;
    if (window.__TRACE_RULEENGINE__HOOKED__) return;
    window.__TRACE_RULEENGINE__HOOKED__ = true;

    // ---- ruleEngine ----
    let _re = window.ruleEngine;

    Object.defineProperty(window, "ruleEngine", {
      configurable: true,
      enumerable: true,
      get() {
        return _re;
      },
      set(v) {
        _re = v;
        try {
          window.__RULEENGINE_LAST_SET__ = {
            when: Date.now(),
            iso: new Date().toISOString(),
            value: String(v),
            stack: (new Error("ruleEngine set")).stack || ""
          };
        } catch (_) {}
        try {
          console.warn("[ruleEngine SET]", v);
          console.trace("[ruleEngine SET TRACE]");
        } catch (_) {}
      }
    });

    // ---- ruleEngineMode ----
    let _rm = window.ruleEngineMode;

    Object.defineProperty(window, "ruleEngineMode", {
      configurable: true,
      enumerable: true,
      get() {
        return _rm;
      },
      set(v) {
        _rm = v;
        try {
          window.__RULEENGINE_MODE_LAST_SET__ = {
            when: Date.now(),
            iso: new Date().toISOString(),
            value: String(v),
            stack: (new Error("ruleEngineMode set")).stack || ""
          };
        } catch (_) {}
        try {
          console.warn("[ruleEngineMode SET]", v);
          console.trace("[ruleEngineMode SET TRACE]");
        } catch (_) {}
      }
    });
  } catch (_) {}
}

window.enableRuleEngineTrace = function (on) {
  try {
    window.__TRACE_RULEENGINE__ = !!on;
    traceRuleEngineWrites();
    return window.__TRACE_RULEENGINE__ === true;
  } catch (_) {
    return false;
  }
};

// auto-hook if enabled
(function maybeHookRuleEngineTrace() {
  try {
    traceRuleEngineWrites();
  } catch (_) {}
})();

/* =========================
   UI boot patch (restored from app.js boot responsibility)
   - ensure UI texts applied once DOM+i18n are ready
   - keep export status visible/consistent early
   ========================= */
(function uiBootPatch() {
  function safeApplyTexts() {
    try {
      // i18n not ready -> skip
      if (!(window.I18N && window.I18N[window.currentLang])) return;

      // apply all UI texts (includes stage3 buttons)
      if (typeof window.setText === "function") window.setText();
      else if (typeof window.setStage3Ui === "function") window.setStage3Ui(window.lastStage3Mode);

      // make export status visible/consistent early (optional; only if functions exist)
      try {
        if (typeof window.snapshotLangStatus === "function") {
          if (!window.__LANG_STATUS__) window.snapshotLangStatus("ui:bootPatch");
        }
        if (typeof window.renderExportStatusCombined === "function") {
          window.renderExportStatusCombined();
        }
      } catch (_) {}
    } catch (_) {}
  }

  // If DOM already parsed, run ASAP; otherwise wait for DOMContentLoaded.
  if (document.readyState === "interactive" || document.readyState === "complete") {
    // defer one frame to let other scripts define globals (engine/stage3/main)
    requestAnimationFrame(safeApplyTexts);
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        requestAnimationFrame(safeApplyTexts);
      },
      { once: true }
    );
  }

  // Also listen for i18n late-load edge case
  window.addEventListener(
    "load",
    () => {
      requestAnimationFrame(safeApplyTexts);
    },
    { once: true }
  );
})();

/* =========================
   UI telemetry export (for main.js)
   - expose functions via window.__UI__ (no new file)
   ========================= */
(function exportUiTelemetryApi() {
  try {
    window.__UI__ = window.__UI__ || {};

    if (typeof window.snapshotLangStatus === "function") {
      window.__UI__.snapshotLangStatus = window.snapshotLangStatus;
    }
    if (typeof window.renderExportStatusCombined === "function") {
      window.__UI__.renderExportStatusCombined = window.renderExportStatusCombined;
    }
    if (typeof window.startExportStatusMirror === "function") {
      window.__UI__.startExportStatusMirror = window.startExportStatusMirror;
    }
    if (typeof window.stopExportStatusMirror === "function") {
      window.__UI__.stopExportStatusMirror = window.stopExportStatusMirror;
    }
  } catch (_) {}
})();
