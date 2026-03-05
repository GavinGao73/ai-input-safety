// =======================
// assets/main.js (FULL)
// v20260305a1-ui-content-telemetry (PATCHED: report content follows UI + keep actual strategy lang visible)
//
// ✅ UI language: window.currentLang 只影响 UI 文案
// ✅ Content strategy language: window.ruleEngine / window.ruleEngineMode（由 lang-detect.js 的 ensureContentLang + 用户选择锁定）
// ✅ Clear 必须 resetContentLang(): mode=auto, ruleEngine=""
// ✅ Export Mode A uses content-strategy lang (ruleEngine), not UI lang
//
// ✅ REPORT POLICY (A1):
// - “生成进程报告”里的 content 字段：按 UI 语言展示（便于你按 UI 视角读状态）
// - 同时额外展示 contentActual（实际内容策略语言=ruleEngine/lock 或 getLangContent）用于调试与验收
//
// ✅ NEW INVARIANT (A2) 保留：
// - If detector returns a concrete lang with ok=true (or last detection is confident), main.js MUST ensure ruleEngine is set + locked.
// - This prevents content strategy from drifting with UI language when ruleEngine is empty.
// =========================

/* =========================
   LANG STATUS TELEMETRY
   - Keep runtime language state observable in exportStatus box
   - Report policy: content follows UI, but keep actual strategy lang visible as contentActual
   ========================= */
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

    // actual content-strategy lang (what masking/export should follow)
    let contentActual = "";
    try {
      if (typeof window.getLangContent === "function") contentActual = __normLang3(window.getLangContent()) || "";
    } catch (_) {}

    // report content follows UI (per your request)
    const contentReported = ui || "";

    window.__LANG_STATUS__ = {
      when: Date.now(),
      iso: new Date().toISOString(),
      reason: String(reason || ""),

      uiLang: ui,

      // single source of truth for actual strategy
      ruleEngine: re,
      ruleEngineMode: mode,

      // report vs actual (debug clarity)
      langContent: contentReported,                 // ✅ report: follows UI
      langContentActual: contentActual || re || "", // ✅ debug: actual strategy

      modalOpening: !!window.__LANG_MODAL_OPENING__,

      detected
    };
  } catch (_) {}
}

function renderLangStatusLines(t) {
  const st = window.__LANG_STATUS__ || null;
  if (!st) return [];

  const lines = [];

  // report view (UI-centric)
  lines.push(`UI=${st.uiLang || "(?)"}`);
  lines.push(`content=${st.langContent || "(?)"}`); // ✅ content follows UI

  // actual strategy (must stay visible for debugging / export correctness)
  const actual = st.langContentActual || "";
  const re = st.ruleEngine || "";
  const mode = st.ruleEngineMode || "auto";
  lines.push(`ruleEngine=${re || "(empty)"} (${mode})`);

  // show actual content strategy lang explicitly (if differs from reported content)
  if (actual && actual !== st.langContent) {
    lines.push(`contentActual=${actual}`);
  } else if (actual) {
    // still useful to show explicitly even when same
    lines.push(`contentActual=${actual}`);
  }

  lines.push(`modal=${st.modalOpening ? "OPEN" : "false"}`);

  if (st.detected) {
    const d = st.detected;
    const conf = typeof d.confidence === "number" ? d.confidence.toFixed(2) : "(?)";
    const cand = d.candidates && d.candidates.length ? d.candidates.join(",") : "-";
    lines.push(`detect.last=${d.lang || "(?)"} conf=${conf} needsConfirm=${d.needsConfirm ? "true" : "false"}`);
    if (d.reason || d.source) lines.push(`detect.reason=${d.reason || "-"} src=${d.source || "-"}`);
    lines.push(`detect.candidates=${cand}`);
  } else {
    lines.push("detect.last=(none)");
  }

  if (st.reason) lines.push(`telemetry=${st.reason}`);
  return lines;
}

/* =========================
   LOCK INVARIANT ENFORCER (A2)
   - If detector provides a concrete lang (zh/de/en), ensure ruleEngine is set + locked.
   - Only enforces when current mode is not locked OR ruleEngine is empty.
   - Does NOT change locked sessions; Clear/manual picker remain the only ways to change.
   ========================= */
function ensureRuleEngineLocked(detectResult, reason) {
  try {
    const ll = String((detectResult && detectResult.lang) || "").toLowerCase();
    const L = ll === "zh" || ll === "de" || ll === "en" ? ll : "";
    if (!L) return { changed: false };

    const cur = String(window.ruleEngine || "").toLowerCase();
    const mode = String(window.ruleEngineMode || "").toLowerCase();

    // only enforce when not already locked with a concrete lang
    if (mode !== "lock" || !cur) {
      window.ruleEngine = L;
      window.ruleEngineMode = "lock";

      // optional signal for observers
      try {
        window.dispatchEvent(new CustomEvent("ruleengine:changed", { detail: { lang: L, reason: reason || "" } }));
      } catch (_) {}

      return { changed: true, lang: L };
    }
    return { changed: false };
  } catch (_) {
    return { changed: false };
  }
}

/* =========================
   E) Export progress mirror (UI language aligned)
   - show RasterExport phases in exportStatus
   - keep BOOT line without overwriting progress
   ========================= */
function i18nProgressLine(phase, t) {
  const map = {
    "exportRasterSecurePdfFromReadablePdf:begin": t.progressPhaseBegin || "开始准备…",
    autoRedactReadablePdf: t.progressPhaseScan || "扫描并计算遮盖区域…",
    "exportRasterSecurePdfFromReadablePdf:export": t.progressPhaseExport || "生成安全PDF（纯图片）…",
    exportRasterSecurePdfFromVisual: t.progressPhaseExport || "生成安全PDF（纯图片）…"
  };
  return map[phase] || (t.progressPhaseWorking || "处理中…");
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
   LANG DETECT GUARD
   - call before applyRules() to avoid wrong-language pack usage
   - A2: enforce lock invariant when detector returns a concrete lang
   ========================= */
function ensureLangBeforeApply(text) {
  try {
    // If modal is already opening/open, do NOT run applyRules again
    if (window.__LANG_MODAL_OPENING__) {
      try {
        snapshotLangStatus("guard:blocked_by_modal");
      } catch (_) {}
      try {
        renderExportStatusCombined();
      } catch (_) {}
      return false;
    }

    if (window.__LangDetect && typeof window.__LangDetect.ensureContentLang === "function") {
      const r = window.__LangDetect.ensureContentLang(text, currentLang);

      // ✅ A2: Strongly ensure ruleEngine is set+locked if detector yields a concrete lang
      try {
        if (r && r.ok === true && r.lang) {
          ensureRuleEngineLocked({ lang: r.lang }, "guard:lock_from_return");
        } else {
          const last = window.__LangDetect && window.__LangDetect.__state && window.__LangDetect.__state.last;
          const conf = last && typeof last.confidence === "number" ? last.confidence : null;

          // mirror CONF_LOCK=0.78 (lang-detect.js) but keep safe if confidence missing
          if (last && last.lang && (conf == null || conf >= 0.78)) {
            ensureRuleEngineLocked({ lang: last.lang }, "guard:lock_from_last");
          }
        }
      } catch (_) {}

      // snapshot after enforcement
      try {
        snapshotLangStatus("guard:ensureContentLang");
      } catch (_) {}

      // if modal opened -> stop this run
      if (r && r.ok === false) {
        try {
          renderExportStatusCombined();
        } catch (_) {}
        return false;
      }

      try {
        renderExportStatusCombined();
      } catch (_) {}
      return true;
    }

    // detector missing
    try {
      snapshotLangStatus("guard:LangDetect_missing");
      renderExportStatusCombined();
    } catch (_) {}
  } catch (_) {}

  return true;
}

// expose for lang-detect.js / stage3.js rerun chain
try {
  if (typeof window.ensureLangBeforeApply !== "function") window.ensureLangBeforeApply = ensureLangBeforeApply;
} catch (_) {}

// Optional manual picker entry (no UI clutter by default)
window.openLangPicker = function () {
  try {
    const ta = document.getElementById("inputText");
    const v = ta ? String(ta.value || "") : "";

    if (window.__LangModal && typeof window.__LangModal.open === "function") {
      try {
        window.__LANG_MODAL_OPENING__ = true;
      } catch (_) {}
      try {
        snapshotLangStatus("picker:open");
        renderExportStatusCombined();
      } catch (_) {}

      window.__LangModal.open({
        uiLang: String(currentLang || "en").toLowerCase(),
        detected: (window.getLangContent && window.getLangContent()) || window.ruleEngine || "",
        confidence: null,
        candidates: ["zh", "de", "en"],
        reason: "manual_open",
        onPick: function (lang) {
          try {
            window.__LANG_MODAL_OPENING__ = false;
          } catch (_) {}

          // normalize (safety): only accept zh/de/en
          const ll = String(lang || "").toLowerCase();
          const L = ll === "zh" || ll === "de" || ll === "en" ? ll : "";
          if (!L) return;

          window.ruleEngine = L;
          window.ruleEngineMode = "lock";

          try {
            snapshotLangStatus("picker:onPick_lock");
            renderExportStatusCombined();
          } catch (_) {}

          // never call applyRules() directly here; always go through safe/guard entry
          if (v.trim()) {
            if (typeof window.applyRulesSafely === "function") window.applyRulesSafely(v);
            else if (typeof window.ensureLangBeforeApply === "function" && typeof window.applyRules === "function") {
              if (!window.ensureLangBeforeApply(v)) return;
              window.applyRules(v);
            }
          }
        },
        onClose: function () {
          try {
            window.__LANG_MODAL_OPENING__ = false;
          } catch (_) {}
          try {
            snapshotLangStatus("picker:onClose");
            renderExportStatusCombined();
          } catch (_) {}
        }
      });
    }
  } catch (_) {}
};

// ================= bind =================
function bind() {
  document.querySelectorAll(".lang button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");

      // UI language only
      currentLang = b.dataset.lang;
      window.currentLang = currentLang;

      // refresh UI strings
      setText();

      // snapshot on UI change
      try {
        snapshotLangStatus("ui:switch");
        renderExportStatusCombined();
      } catch (_) {}

      const ta = $("inputText");
      const inTxt = ta && ta.value ? String(ta.value).trim() : "";

      // UI switch MUST NOT overwrite ruleEngine/mode
      if (inTxt) {
        if (!ensureLangBeforeApply(inTxt)) return;
        applyRules(inTxt);
      } else window.dispatchEvent(new Event("safe:updated"));

      if (ta) renderInputOverlayForPdf(ta.value || "");

      requestAnimationFrame(syncManualRiskHeights);

      try {
        renderExportStatusCombined();
      } catch (_) {}
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
      if (inTxt) {
        if (!ensureLangBeforeApply(inTxt)) return;
        applyRules(inTxt);
      } else window.dispatchEvent(new Event("safe:updated"));

      renderInputOverlayForPdf((($("inputText") && $("inputText").value) || ""));

      requestAnimationFrame(syncManualRiskHeights);

      // snapshot after manual terms input
      try {
        snapshotLangStatus("manualTerms:input");
        renderExportStatusCombined();
      } catch (_) {}
    });

    setManualTermsFromText(termInput.value || "");
    if (!window.__export_snapshot) window.__export_snapshot = {};
    window.__export_snapshot.manualTerms = manualTerms.slice(0);
  }

  const btnClear = $("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      // 0) FIRST: re-init enabled (must not be blocked by later UI errors)
      try {
        if (typeof window.initEnabled === "function") window.initEnabled();
        else if (typeof initEnabled === "function") initEnabled();
      } catch (_) {}

      // 1) everything else: do not allow any single error to abort the rest
      try {
        if ($("inputText")) $("inputText").value = "";
      } catch (_) {}
      try {
        renderOutput("");
      } catch (_) {}

      try {
        window.__safe_hits = 0;
      } catch (_) {}
      try {
        window.__safe_breakdown = {};
      } catch (_) {}
      try {
        window.__safe_score = 0;
      } catch (_) {}
      try {
        window.__safe_level = "low";
      } catch (_) {}
      try {
        window.__safe_report = null;
      } catch (_) {}

      try {
        lastRunMeta.fromPdf = false;
      } catch (_) {}

      try {
        if (typeof collapseManualArea === "function") collapseManualArea();
      } catch (_) {}
      try {
        if (typeof collapseRiskArea === "function") collapseRiskArea();
      } catch (_) {}
      try {
        if (typeof clearProgress === "function") clearProgress();
      } catch (_) {}
      try {
        if (typeof clearBodyHeights === "function") clearBodyHeights();
      } catch (_) {}

      try {
        const rb = $("riskBox");
        if (rb) rb.innerHTML = "";
      } catch (_) {}
      try {
        if ($("pdfName")) $("pdfName").textContent = "";
      } catch (_) {}

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

      try {
        manualTerms = [];
        const termInput2 = $("manualTerms") || $("nameList");
        if (termInput2) {
          termInput2.value = "";
          termInput2.disabled = false;
        }
      } catch (_) {}

      try {
        lastUploadedFile = null;
      } catch (_) {}
      try {
        lastFileKind = "";
      } catch (_) {}
      try {
        lastProbe = null;
      } catch (_) {}
      try {
        lastPdfOriginalText = "";
      } catch (_) {}
      try {
        if (typeof setStage3Ui === "function") setStage3Ui("none");
      } catch (_) {}
      try {
        if (typeof setManualPanesForMode === "function") setManualPanesForMode("none");
      } catch (_) {}

      try {
        __manualRedactSession = null;
      } catch (_) {}
      try {
        __manualRedactResult = null;
      } catch (_) {}
      try {
        window.__manual_redact_last = null;
      } catch (_) {}

      try {
        window.__export_snapshot = null;
      } catch (_) {}
      try {
        window.__export_snapshot_byLang = null;
      } catch (_) {}

      // RULE C: reset ruleEngine/contentLang
      try {
        if (typeof resetContentLang === "function") {
          resetContentLang();
        } else {
          window.ruleEngineMode = "auto";
          window.ruleEngine = "";
        }
      } catch (_) {}

      // clear export status (keep boot line)
      try {
        window.__RasterExportLast = null;
      } catch (_) {}

      // snapshot after clear
      try {
        snapshotLangStatus("ui:clear");
      } catch (_) {}

      try {
        if (typeof renderExportStatusCombined === "function") renderExportStatusCombined();
      } catch (_) {}

      // FINAL: initEnabled again as a last safety net
      try {
        if (typeof window.initEnabled === "function") window.initEnabled();
        else if (typeof initEnabled === "function") initEnabled();
      } catch (_) {}

      try {
        window.dispatchEvent(new Event("safe:updated"));
      } catch (_) {}
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
          setTimeout(() => {
            btnCopy.textContent = t.btnCopy || old;
          }, 900);
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
        if (v.trim()) {
          if (!ensureLangBeforeApply(v)) return;
          applyRules(v);

          // snapshot after apply
          try {
            snapshotLangStatus("input:applyRules");
            renderExportStatusCombined();
          } catch (_) {}
        } else {
          renderOutput("");
          const rb = $("riskBox");
          if (rb) rb.innerHTML = "";
          clearProgress();

          // snapshot on empty
          try {
            snapshotLangStatus("input:empty");
            renderExportStatusCombined();
          } catch (_) {}

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

      // snapshot when manual redact UI opened
      try {
        snapshotLangStatus("modeB:manualRedactStart");
        renderExportStatusCombined();
      } catch (_) {}
    };
  }

  const btnExportRasterPdf = $("btnExportRasterPdf");
  if (btnExportRasterPdf) {
    btnExportRasterPdf.onclick = async () => {
      expandRiskArea();
      expandManualArea();
      requestAnimationFrame(syncManualRiskHeights);

      const t = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang] : {};

      // start mirroring when user clicks export
      try {
        startExportStatusMirror();
      } catch (_) {}

      // snapshot at export click
      try {
        snapshotLangStatus("export:click");
        renderExportStatusCombined();
      } catch (_) {}

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
              t.progressNeedManualFirst || "请先点「手工涂抹」完成框选并关闭界面，然后再点「红删PDF」。",
              true
            );
            return;
          }

          if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromVisual) {
            setProgressText(t.progressExportMissing || "导出模块未加载", true);
            return;
          }

          setProgressText([t.progressWorking || "处理中…", "mode=B", `dpi=${res.dpi || 600}`], false);

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
          setProgressText(
            t.progressNotReadable || "PDF 不可读（Mode B），请先手工涂抹并保存框选，然后再点红删PDF。",
            true
          );
          return;
        }

        if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
          setProgressText(t.progressExportMissing || "导出模块未加载", true);
          return;
        }

        const snap = window.__export_snapshot || {};
        const enabledKeys = Array.isArray(snap.enabledKeys) ? snap.enabledKeys : effectiveEnabledKeys();

        // export uses content-strategy lang, not UI lang
        const lang =
          snap.langContent ||
          (typeof getLangContent === "function" ? getLangContent() : null) ||
          (String(window.ruleEngineMode || "").toLowerCase() === "lock" && window.ruleEngine ? window.ruleEngine : "") ||
          "";

        const manualTermsSafe = Array.isArray(snap.manualTerms) ? snap.manualTerms : [];

        setProgressText(
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

        setProgressText(t.progressDone || "完成 ✅ 已开始下载。", false);
        requestAnimationFrame(syncManualRiskHeights);
      } catch (e) {
        const msg = (e && (e.message || String(e))) || "Unknown error";
        const t2 = window.I18N && window.I18N[currentLang] ? window.I18N[currentLang] : {};
        setProgressText(`${t2.progressFailed || "导出失败："}\n${msg}`, true);
        requestAnimationFrame(syncManualRiskHeights);
      } finally {
        try {
          stopExportStatusMirror();
        } catch (_) {}
        try {
          renderExportStatusCombined();
        } catch (_) {}
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
    try {
      renderExportStatusCombined();
    } catch (_) {}
  }

  try {
    window.addEventListener("boot:checked", function () {
      try {
        updateBootLine();
      } catch (_) {}
      try {
        rerender();
      } catch (_) {}
    });
  } catch (_) {}

  try {
    setTimeout(() => {
      try {
        updateBootLine();
      } catch (_) {}
      try {
        rerender();
      } catch (_) {}
    }, 0);
  } catch (_) {}
})();

(function traceRuleEngineWrites() {
  try {
    if (window.__TRACE_RULEENGINE__) return;
    window.__TRACE_RULEENGINE__ = true;

    // ---- ruleEngine ----
    let _re = window.ruleEngine;

    Object.defineProperty(window, "ruleEngine", {
      configurable: true,
      enumerable: true,
      get() { return _re; },
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
      get() { return _rm; },
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
})();

// ================= boot =================
(function boot() {
  try {
    if (typeof initEnabled === "function") initEnabled();
    if (typeof setText === "function") setText();
    if (typeof bind === "function") bind();
    if (typeof updateInputWatermarkVisibility === "function") updateInputWatermarkVisibility();
    if (typeof initRiskResizeObserver === "function") initRiskResizeObserver();

    // snapshot at boot (immediate view even before typing)
    try {
      snapshotLangStatus("boot");
      renderExportStatusCombined();
    } catch (_) {}

    // do NOT force ruleEngine/ruleEngineMode here.
  } catch (e) {
    console.error("[boot] failed:", e);
  }
})();
