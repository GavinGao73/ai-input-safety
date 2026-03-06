// =========================
// assets/ui.js (from app.js)
// v20260305a3 — PATCHED
// - Keep i18n in i18n.js
// - ui.js stays “UI logic + UI observability” (NOT language dict)
// - Moved lang-status / export-status telemetry helpers here (from main.js)
// - Optional debug flags:
//   window.__DEBUG_LANG__ = true   -> show extra lines in exportStatus
//   window.__TRACE_RULEENGINE__ = true -> enable ruleEngine write tracing (hook)
//
// ✅ FIX (A3):
// - exportStatus now has SINGLE WRITER only:
//   renderExportStatusCombined()
// - setProgressText()/clearProgress() no longer write DOM directly;
//   they only update window.__UI_PROGRESS_STATE__
// - This removes textContent vs innerHTML conflicts.
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
let __LOCKED_OPEN_H = 0;

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

  // ✅ 唯一正确基准：左侧 manualBody 的自然高度
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

let __riskResizeObs = null;
function initRiskResizeObserver() {
  const riskBody = $("riskBody");
  if (!riskBody || !("ResizeObserver" in window)) return;

  if (__riskResizeObs) __riskResizeObs.disconnect();

  __riskResizeObs = new ResizeObserver(() => {
    // ✅ 已锁定后，只同步，不再改基准
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
// ================= Progress area =================
// ✅ SINGLE WRITER MODEL:
// - setProgressText / clearProgress only update state
// - renderExportStatusCombined is the ONLY function that writes #exportStatus
(function ensureUiProgressState() {
  try {
    if (!window.__UI_PROGRESS_STATE__) {
      window.__UI_PROGRESS_STATE__ = {
        lines: [],
        isError: false
      };
    }
  } catch (_) {}
})();

function setProgressText(lines, isError) {
  try {
    const s = Array.isArray(lines) ? lines.slice(0) : [String(lines || "")];
    window.__UI_PROGRESS_STATE__ = {
      lines: s.filter((x) => String(x || "").trim() !== ""),
      isError: !!isError
    };

    if (typeof renderExportStatusCombined === "function") {
      renderExportStatusCombined();
    } else {
      const box = $("exportStatus");
      if (!box) return;
      box.style.color = isError ? "#ffb4b4" : "";
      box.textContent = s.join("\n");
    }
  } catch (_) {}
}

function clearProgress() {
  try {
    window.__UI_PROGRESS_STATE__ = {
      lines: [],
      isError: false
    };

    if (typeof renderExportStatusCombined === "function") {
      renderExportStatusCombined();
    } else {
      const a = $("exportStatus");
      if (a) a.textContent = "";
    }
  } catch (_) {}
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

  function L(lang) {
    const z = {
      secCore: "状态",
      secDetect: "识别",
      secDebug: "调试",
      at: "时间",
      ui: "界面",
      content: "内容语言",
      ruleEngine: "规则引擎",
      mode: "模式",
      modal: "语言弹窗",
      last: "识别结果",
      conf: "置信度",
      needs: "需确认",
      source: "来源",
      reason: "原因",
      cand: "候选",
      telemetry: "状态",
      none: "(无)",
      empty: "(空)"
    };

    const e = {
      secCore: "STATE",
      secDetect: "DETECT",
      secDebug: "DEBUG",
      at: "at",
      ui: "UI",
      content: "content",
      ruleEngine: "ruleEngine",
      mode: "mode",
      modal: "modal",
      last: "last",
      conf: "conf",
      needs: "needsConfirm",
      source: "src",
      reason: "reason",
      cand: "candidates",
      telemetry: "telemetry",
      none: "(none)",
      empty: "(empty)"
    };

    const d = {
      secCore: "STATUS",
      secDetect: "ERKENNUNG",
      secDebug: "DEBUG",
      at: "Zeit",
      ui: "UI",
      content: "Inhalt",
      ruleEngine: "RuleEngine",
      mode: "Modus",
      modal: "Modal",
      last: "Ergebnis",
      conf: "Konf.",
      needs: "Bestätigung",
      source: "Quelle",
      reason: "Grund",
      cand: "Kandidaten",
      telemetry: "Status",
      none: "(keins)",
      empty: "(leer)"
    };

    const x = String(lang || "").toLowerCase();
    return x === "de" ? d : (x === "en" ? e : z);
  }

  const labels = L(window.currentLang);

  const lines = [];

  // ===== CORE =====
  lines.push(`=== ${labels.secCore} ===`);

  // 时间：优先 iso；否则用 when
  const ts = st.iso || (typeof st.when === "number" ? new Date(st.when).toISOString() : "");
  if (ts) lines.push(`${labels.at}: ${ts}`);

  lines.push(`${labels.ui}: ${st.uiLang || labels.none}`);
  lines.push(`${labels.content}: ${st.langContent || labels.none}`);
  lines.push(`${labels.ruleEngine}: ${st.ruleEngine || labels.empty} (${st.ruleEngineMode || "auto"})`);
  lines.push(`${labels.modal}: ${st.modalOpening ? "OPEN" : "false"}`);

  if (st.reason) lines.push(`${labels.telemetry}: ${st.reason}`);

  // ===== DETECT =====
  lines.push(``);
  lines.push(`=== ${labels.secDetect} ===`);

  if (!st.detected) {
    lines.push(`${labels.last}: ${labels.none}`);
    return lines;
  }

  const d = st.detected;
  const conf = typeof d.confidence === "number" ? d.confidence.toFixed(2) : labels.none;
  const cand = Array.isArray(d.candidates) && d.candidates.length ? d.candidates.join(",") : "-";

  lines.push(`${labels.last}: ${d.lang || labels.none}`);
  lines.push(`${labels.conf}: ${conf}   ${labels.needs}: ${d.needsConfirm ? "true" : "false"}`);
  if (d.reason) lines.push(`${labels.reason}: ${d.reason}`);
  if (d.source) lines.push(`${labels.source}: ${d.source}`);
  lines.push(`${labels.cand}: ${cand}`);

  // ===== DEBUG (optional) =====
  try {
    if (window.__DEBUG_LANG__ === true) {
      lines.push(``);
      lines.push(`=== ${labels.secDebug} ===`);

      const ver =
        window.__LangDetect &&
        window.__LangDetect.__state &&
        window.__LangDetect.__state.ver
          ? String(window.__LangDetect.__state.ver)
          : "";

      if (ver) lines.push(`detect.ver: ${ver}`);

      // last set stacks are noisy; only show if present
      if (window.__RULEENGINE_LAST_SET__ && window.__RULEENGINE_LAST_SET__.iso) {
        lines.push(`ruleEngine.lastSet: ${window.__RULEENGINE_LAST_SET__.iso} value=${window.__RULEENGINE_LAST_SET__.value || ""}`);
      }
      if (window.__RULEENGINE_MODE_LAST_SET__ && window.__RULEENGINE_MODE_LAST_SET__.iso) {
        lines.push(`ruleEngineMode.lastSet: ${window.__RULEENGINE_MODE_LAST_SET__.iso} value=${window.__RULEENGINE_MODE_LAST_SET__.value || ""}`);
      }
    }
  } catch (_) {}

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
  const pstate = window.__UI_PROGRESS_STATE__ || { lines: [], isError: false };

  // ---------- helpers ----------
  function esc(x) {
    return String(x == null ? "" : x)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normLang3(x) {
    const v = String(x || "").toLowerCase();
    return v === "zh" || v === "en" || v === "de" ? v : "";
  }

  // 两字分区标题：中文用 2 字；英德用 2 码缩写
  function secLabels(uiLang) {
    const L = normLang3(uiLang || currentLang);
    if (L === "de") {
      return { boot: "BT", lang: "SP", state: "ST", detect: "ER", exp: "EX", prog: "PR" };
    }
    if (L === "en") {
      return { boot: "BT", lang: "LG", state: "ST", detect: "DT", exp: "EX", prog: "PR" };
    }
    // zh default
    return { boot: "启动", lang: "语言", state: "状态", detect: "识别", exp: "导出", prog: "进程" };
  }

  // 两字 key：尽量“两个字/两个码”
  function keyLabels(uiLang) {
    const L = normLang3(uiLang || currentLang);
    if (L === "de") {
      return {
        date: "DT", time: "TM",
        ui: "UI", content: "CT", rule: "RE", modal: "MD",
        last: "LS", conf: "CF", need: "NC", src: "SC", reason: "RS", cand: "CA",
        phase: "PH", p2: "P2", lang: "LG", dpi: "DP", pages: "PG", rects: "RC", page: "P#", items: "IT",
        line: "LN"
      };
    }
    if (L === "en") {
      return {
        date: "DT", time: "TM",
        ui: "UI", content: "CT", rule: "RE", modal: "MD",
        last: "LS", conf: "CF", need: "NC", src: "SC", reason: "RS", cand: "CA",
        phase: "PH", p2: "P2", lang: "LG", dpi: "DP", pages: "PG", rects: "RC", page: "P#", items: "IT",
        line: "LN"
      };
    }
    // zh
    return {
      date: "日期", time: "时间",
      ui: "界面", content: "内容", rule: "规则", modal: "弹窗",
      last: "结果", conf: "置信", need: "确认", src: "来源", reason: "原因", cand: "候选",
      phase: "阶段", p2: "二段", lang: "语言", dpi: "精度", pages: "页数", rects: "遮盖", page: "当前", items: "条目",
      line: "内容"
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

  // ISO -> date + time split (你要求“日期和时间分开两行”)
  function splitIso(iso) {
    const s2 = String(iso || "");
    const m = s2.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z)?/);
    if (!m) return { date: "", time: s2 };
    return { date: m[1], time: m[2] + (m[3] ? "Z" : "") };
  }

  const SEC = secLabels(currentLang);
  const K = keyLabels(currentLang);

  const html = [];

  // ===== 启动 / BOOT =====
  html.push(sec(SEC.boot));
  html.push(line("OK", bootLine || "(none)"));

  // ===== 语言/状态/识别：来自 __LANG_STATUS__ =====
  const st = window.__LANG_STATUS__ || null;

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

  // ===== 进程 / PROGRESS (from setProgressText) =====
  if (Array.isArray(pstate.lines) && pstate.lines.length) {
    html.push("");
    html.push(sec(SEC.prog));
    pstate.lines.forEach((row) => {
      html.push(line(K.line, row, pstate.isError ? " tele-line-error" : ""));
    });
  }

  // ===== 导出 / EXPORT (from __RasterExportLast) =====
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

  // render (HTML, not textContent)
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
