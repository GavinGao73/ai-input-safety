// =========================
// assets/ui.js (FULL)
// v20260308-ui-slim1-single-writer
// - UI only: text / panels / progress / telemetry rendering
// - Keep i18n in i18n.js
// - Keep masking / matcher / export pipeline out of ui.js
// - exportStatus has SINGLE WRITER: renderExportStatusCombined()
// =========================

(function () {
  "use strict";

  /* =========================
     Small DOM helpers
     ========================= */
  function normSel(sel) {
    const s = String(sel || "").trim();
    if (!s) return s;

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

  function uiLang() {
    const s = String(window.currentLang || "").toLowerCase();
    return s === "zh" || s === "de" || s === "en" ? s : "zh";
  }

  function show(el, yes) {
    if (!el) return;
    el.style.display = yes ? "" : "none";
  }

  function isSmallScreen() {
    try {
      return !!(window.matchMedia && window.matchMedia("(max-width: 560px)").matches);
    } catch (_) {
      return false;
    }
  }

  /* =========================
     Stage3 buttons / panes
     ========================= */
  function stage3Text(key) {
    const map = {
      zh: { btnExportPdf: "红删PDF", btnManual: "手工涂抹" },
      de: { btnExportPdf: "PDF", btnManual: "Manuell" },
      en: { btnExportPdf: "PDF", btnManual: "Manual" }
    };
    const m = map[uiLang()] || map.zh;
    return m[key] || "";
  }

  function setStage3Ui(mode) {
    window.lastStage3Mode = mode || "none";

    const btnPdf = $("btnExportRasterPdf");
    const btnMan = $("btnManualRedact");
    const t = window.I18N && window.I18N[uiLang()] ? window.I18N[uiLang()] : null;

    show(btnPdf, window.lastStage3Mode === "A" || window.lastStage3Mode === "B");
    show(btnMan, window.lastStage3Mode === "B");

    if (btnPdf) btnPdf.textContent = (t && t.btnRedactPdf) || stage3Text("btnExportPdf");
    if (btnMan) btnMan.textContent = (t && t.btnManualRedact) || stage3Text("btnManual");
  }

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

  function setManualRailTextByMode() {
    const t = window.I18N && window.I18N[uiLang()];
    const note = $("ui-manual-rail-note");
    const title = $("ui-manual-rail-title");
    if (!t) return;

    if (title) title.textContent = t.manualRailTitle || "";
    if (!note) return;

    if (window.lastStage3Mode === "B") {
      note.textContent = t.manualRailTextB || t.manualRailText || "";
    } else {
      note.textContent = t.manualRailTextA || t.manualRailText || "";
    }
  }

  /* =========================
     Expand / collapse controls
     ========================= */
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

  /* =========================
     Equal-height sync
     ========================= */
  const DESKTOP_MIN_OPEN_H = 260;
  let __LOCKED_OPEN_H = 0;
  let __riskResizeObs = null;

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

    __LOCKED_OPEN_H = 0;
  }

  function getNaturalBodyHeight(el) {
    if (!el) return 0;

    const save = {
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      minHeight: el.style.minHeight,
      overflow: el.style.overflow
    };

    el.style.height = "";
    el.style.maxHeight = "";
    el.style.minHeight = "";
    el.style.overflow = "";

    const h = Math.ceil(el.getBoundingClientRect().height || 0);

    el.style.height = save.height;
    el.style.maxHeight = save.maxHeight;
    el.style.minHeight = save.minHeight;
    el.style.overflow = save.overflow;

    return h;
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

    if (!__LOCKED_OPEN_H) {
      const manualNatural = getNaturalBodyHeight(manualBody);
      __LOCKED_OPEN_H = Math.max(manualNatural, DESKTOP_MIN_OPEN_H);
    }

    const target = __LOCKED_OPEN_H;

    manualBody.style.height = `${target}px`;
    manualBody.style.maxHeight = `${target}px`;
    manualBody.style.minHeight = `${DESKTOP_MIN_OPEN_H}px`;
    manualBody.style.overflow = "hidden";

    riskBody.style.height = `${target}px`;
    riskBody.style.maxHeight = `${target}px`;
    riskBody.style.minHeight = `${DESKTOP_MIN_OPEN_H}px`;
    riskBody.style.overflow = "hidden";
  }

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
    __LOCKED_OPEN_H = 0;
    requestAnimationFrame(syncManualRiskHeights);
  }

  function expandRiskArea() {
    const btn = $("btnToggleRisk");
    const body = $("riskBody");
    if (btn && body) setCtlExpanded(btn, body, true);
    __LOCKED_OPEN_H = 0;
    requestAnimationFrame(syncManualRiskHeights);
  }

  function collapseManualArea() {
    const btn = $("btnToggleManual");
    const body = $("manualBody");
    if (btn && body) setCtlExpanded(btn, body, false);
    clearBodyHeights();
  }

  function collapseRiskArea() {
    const btn = $("btnToggleRisk");
    const body = $("riskBody");
    if (btn && body) setCtlExpanded(btn, body, false);
    clearBodyHeights();
  }

  /* =========================
     Progress state
     ========================= */
  if (!window.__UI_PROGRESS_STATE__) {
    window.__UI_PROGRESS_STATE__ = { lines: [], isError: false };
  }

  function setProgressText(lines, isError) {
    try {
      const s = Array.isArray(lines) ? lines.slice(0) : [String(lines || "")];
      window.__UI_PROGRESS_STATE__ = {
        lines: s.filter((x) => String(x || "").trim() !== ""),
        isError: !!isError
      };

      if (typeof renderExportStatusCombined === "function") {
        renderExportStatusCombined();
      }
    } catch (_) {}
  }

  function clearProgress() {
    try {
      window.__UI_PROGRESS_STATE__ = { lines: [], isError: false };
      if (typeof renderExportStatusCombined === "function") {
        renderExportStatusCombined();
      }
    } catch (_) {}
  }

  /* =========================
     UI texts
     ========================= */
  function exportTitleFallback() {
    const L = uiLang();
    if (L === "de") return "Fortschritt";
    if (L === "en") return "Progress";
    return "生成进程";
  }

  function setText() {
    const t = window.I18N && window.I18N[uiLang()];
    if (!t) return;

    window.currentLang = uiLang();

    if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
    if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;
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

    if ($("manualTerms")) {
      $("manualTerms").placeholder = t.manualPlaceholder || "例如：张三, 李四, Bei.de Tech GmbH";
    }

    const mrNote = $("ui-manual-redact-note");
    if (mrNote) mrNote.textContent = t.manualRedactNote || "";

    if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;
    if ($("btnClear")) $("btnClear").textContent = t.btnClear;
    if ($("linkLearn")) $("linkLearn").textContent = t.learn;
    if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
    if ($("linkScope")) $("linkScope").textContent = t.scope;
    if ($("ui-foot")) $("ui-foot").textContent = t.foot;

    setStage3Ui(window.lastStage3Mode);

    try {
      renderExportStatusCombined();
    } catch (_) {}
  }

  /* =========================
     Lang telemetry
     ========================= */
  if (typeof window.__DEBUG_LANG__ === "undefined") window.__DEBUG_LANG__ = false;
  if (typeof window.__TRACE_RULEENGINE__ === "undefined") window.__TRACE_RULEENGINE__ = false;

  function __normLang3(x) {
    const s = String(x || "").toLowerCase();
    return s === "zh" || s === "de" || s === "en" ? s : "";
  }

  function snapshotLangStatus(reason) {
    try {
      const last =
        window.__LangDetect &&
        window.__LangDetect.__state &&
        window.__LangDetect.__state.last
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

  /* =========================
     Export status single writer
     ========================= */
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

    const t = window.I18N && window.I18N[uiLang()] ? window.I18N[uiLang()] : {};
    const st = window.__LANG_STATUS__ || null;
    const s = window.__RasterExportLast || null;
    const bootLine = window.__bootLine || "";
    const pstate = window.__UI_PROGRESS_STATE__ || { lines: [], isError: false };

    function esc(x) {
      return String(x == null ? "" : x)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function secLabels(lang) {
      const L = __normLang3(lang);
      if (L === "de") return { boot: "BT", lang: "SP", detect: "ER", exp: "EX", prog: "PR" };
      if (L === "en") return { boot: "BT", lang: "LG", detect: "DT", exp: "EX", prog: "PR" };
      return { boot: "启动", lang: "语言", detect: "识别", exp: "导出", prog: "进程" };
    }

    function keyLabels(lang) {
      const L = __normLang3(lang);
      if (L === "de" || L === "en") {
        return {
          date: "DT", time: "TM", ui: "UI", content: "CT", rule: "RE", modal: "MD",
          last: "LS", conf: "CF", need: "NC", src: "SC", reason: "RS", cand: "CA",
          phase: "PH", p2: "P2", lang: "LG", dpi: "DP", pages: "PG", rects: "RC", page: "P#", items: "IT", line: "LN"
        };
      }
      return {
        date: "日期", time: "时间", ui: "界面", content: "内容", rule: "规则", modal: "弹窗",
        last: "结果", conf: "置信", need: "确认", src: "来源", reason: "原因", cand: "候选",
        phase: "阶段", p2: "二段", lang: "语言", dpi: "精度", pages: "页数", rects: "遮盖", page: "当前", items: "条目", line: "内容"
      };
    }

    function sec(title2) {
      return `<div class="tele-sec">${esc(title2)}</div>`;
    }

    function line(k2, v, cls) {
      const vv = String(v == null ? "" : v);
      const extra = cls ? ` ${cls}` : "";
      return `<div class="tele-line${extra}"><span class="tele-k">${esc(k2)}</span><span class="tele-v">${esc(vv)}</span></div>`;
    }

    function splitIso(iso) {
      const s2 = String(iso || "");
      const m = s2.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z)?/);
      if (!m) return { date: "", time: s2 };
      return { date: m[1], time: m[2] + (m[3] ? "Z" : "") };
    }

    const SEC = secLabels(uiLang());
    const K = keyLabels(uiLang());
    const html = [];

    html.push(sec(SEC.boot));
    html.push(line("OK", bootLine || "(none)"));

    html.push("");
    html.push(sec(SEC.lang));

    if (!st) {
      html.push(line("—", "(lang telemetry unavailable)"));
    } else {
      const ts = st.iso || (typeof st.when === "number" ? new Date(st.when).toISOString() : "");
      const dt = splitIso(ts);

      if (dt.date) html.push(line(K.date, dt.date));
      if (dt.time) html.push(line(K.time, dt.time));

      html.push(line(K.ui, st.uiLang || "(?)"));
      html.push(line(K.content, st.langContent || "(?)"));
      html.push(line(K.rule, `${st.ruleEngine || "(empty)"} (${st.ruleEngineMode || "auto"})`));
      html.push(line(K.modal, st.modalOpening ? "OPEN" : "false"));
      if (st.reason) html.push(line("状态", st.reason));

      html.push("");
      html.push(sec(SEC.detect));

      if (!st.detected) {
        html.push(line(K.last, "(none)"));
      } else {
        const d = st.detected;
        const conf = typeof d.confidence === "number" ? d.confidence.toFixed(2) : "(?)";
        const cand = Array.isArray(d.candidates) && d.candidates.length ? d.candidates.join(",") : "-";

        html.push(line(K.last, d.lang || "(?)"));
        html.push(line(K.conf, conf));
        html.push(line(K.need, d.needsConfirm ? "true" : "false"));
        if (d.reason) html.push(line(K.reason, d.reason));
        if (d.source) html.push(line(K.src, d.source));
        html.push(line(K.cand, cand));
      }
    }

    if (Array.isArray(pstate.lines) && pstate.lines.length) {
      html.push("");
      html.push(sec(SEC.prog));
      pstate.lines.forEach((row) => {
        html.push(line(K.line, row, pstate.isError ? " tele-line-error" : ""));
      });
    }

    html.push("");
    html.push(sec(SEC.exp));

    if (!s) {
      html.push(line("—", "(idle)"));
    } else {
      if (s.phase) html.push(line(K.phase, `${i18nProgressLine(s.phase, t)} (${s.phase})`));
      if (s.phase2) html.push(line(K.p2, s.phase2));
      if (s.lang) html.push(line(K.lang, s.lang));
      if (s.dpi) html.push(line(K.dpi, s.dpi));
      if (typeof s.pages === "number") html.push(line(K.pages, s.pages));
      if (typeof s.rectsTotal === "number") html.push(line(K.rects, s.rectsTotal));

      if (Array.isArray(s.perPage) && s.perPage.length) {
        const last = s.perPage[s.perPage.length - 1];
        if (last && last.pageNumber) {
          html.push(line(K.page, last.pageNumber));
          html.push(line(K.items, `${last.items || 0} / ${last.rectCount || 0}`));
        }
      }
    }

    el.style.color = "";
    el.innerHTML = html.filter(Boolean).join("");
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
     Optional ruleEngine trace
     ========================= */
  function traceRuleEngineWrites() {
    try {
      if (window.__TRACE_RULEENGINE__ !== true) return;
      if (window.__TRACE_RULEENGINE__HOOKED__) return;
      window.__TRACE_RULEENGINE__HOOKED__ = true;

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

  try {
    traceRuleEngineWrites();
  } catch (_) {}

  /* =========================
     UI boot patch
     ========================= */
  (function uiBootPatch() {
    function safeApplyTexts() {
      try {
        if (!(window.I18N && window.I18N[window.currentLang])) return;

        if (typeof window.setText === "function") window.setText();
        else if (typeof window.setStage3Ui === "function") window.setStage3Ui(window.lastStage3Mode);

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

    if (document.readyState === "interactive" || document.readyState === "complete") {
      requestAnimationFrame(safeApplyTexts);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        requestAnimationFrame(safeApplyTexts);
      }, { once: true });
    }

    window.addEventListener("load", () => {
      requestAnimationFrame(safeApplyTexts);
    }, { once: true });
  })();

  /* =========================
     Export telemetry API
     ========================= */
  (function exportUiTelemetryApi() {
    try {
      window.__UI__ = window.__UI__ || {};
      window.__UI__.snapshotLangStatus = snapshotLangStatus;
      window.__UI__.renderExportStatusCombined = renderExportStatusCombined;
      window.__UI__.startExportStatusMirror = startExportStatusMirror;
      window.__UI__.stopExportStatusMirror = stopExportStatusMirror;
    } catch (_) {}
  })();

  /* =========================
     Expose globals used by main.js
     ========================= */
  window.stage3Text = stage3Text;
  window.setStage3Ui = setStage3Ui;
  window.setManualPanesForMode = setManualPanesForMode;
  window.setManualRailTextByMode = setManualRailTextByMode;

  window.setCtlExpanded = setCtlExpanded;
  window.toggleCtl = toggleCtl;

  window.clearBodyHeights = clearBodyHeights;
  window.syncManualRiskHeights = syncManualRiskHeights;
  window.initRiskResizeObserver = initRiskResizeObserver;

  window.expandManualArea = expandManualArea;
  window.expandRiskArea = expandRiskArea;
  window.collapseManualArea = collapseManualArea;
  window.collapseRiskArea = collapseRiskArea;

  window.setProgressText = setProgressText;
  window.clearProgress = clearProgress;

  window.setText = setText;
  window.snapshotLangStatus = snapshotLangStatus;
  window.renderExportStatusCombined = renderExportStatusCombined;
  window.startExportStatusMirror = startExportStatusMirror;
  window.stopExportStatusMirror = stopExportStatusMirror;
})();
