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

/* =========================
   assets/styles.css (FULL, consolidated)
   (UPDATED)
   - Titles "输入提示"/"生成进程" centered + i18n-ready
   - ✅ FIX: manualBody/riskBody inner grid fills parent's height (for JS height-lock sync)
   - Expanded: left manual area height follows right risk area; manual textarea scrolls inside
   - Keep left textarea & right output EXACT same sizing
   - Railcard: progress-only (feedback removed)
   - Mobile: IO tabs use TRUE segmented control (connected)
   - ✅ FIX: remove bottom shadow/overlay that covered content when expanded
   - ✅ Mobile: show "图片" upload button only on small screens (optional)
   - ✅ FIX (2026-02-21a2): robust inner fill for equal-height lock (A/B)
   ========================= */

:root{
  --bg:#0b0f14;
  --muted:#8fa0b6;
  --text:#e8eef7;
  --line:#223044;

  --accent: rgba(120,255,240,.86);
  --accent2: rgba(43,144,255,.72);

  --shadow: 0 10px 30px rgba(0,0,0,.35);
  --radius: 14px;

  --max: 1060px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;

  --fs-body: 12px;
  --lh-body: 1.55;

  --panel-bg: rgba(255,255,255,.02);
  --panel-bd: rgba(255,255,255,.08);
  --box-bg: rgba(10,14,20,.55);
  --box-bd: rgba(255,255,255,.10);

  --soft-text: rgba(255,255,255,.55);
  --hint-text: rgba(255,255,255,.28);
}

*{box-sizing:border-box}
html, body{ height:100%; }

body{
  margin:0;
  font-family:var(--sans);
  background: radial-gradient(1200px 600px at 30% -20%, rgba(43,144,255,.22), transparent 55%),
              radial-gradient(1000px 500px at 110% 10%, rgba(54,211,153,.16), transparent 55%),
              var(--bg);
  color:var(--text);
}

/* =========================
   Layout
   ========================= */

.wrap{
  max-width:var(--max);
  margin:0 auto;
  padding:18px 16px 34px;
}

header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:16px;
}

.logo{ display:flex; align-items:center; gap:12px; }
.logo-top-icon{ height:44px; width:auto; display:block; }
.brand-name{
  font-weight:900;
  font-size:20px;
  letter-spacing:0.2px;
  line-height:1.1;
  margin-top:2px;
  color: rgba(255,255,255,.94);
}

.lang{ display:flex; gap:6px; margin-top:6px; }
.lang button{
  background:transparent;
  border:1px solid var(--line);
  color:var(--muted);
  padding:6px 10px;
  border-radius:999px;
  cursor:pointer;
}
.lang button.active{
  background:rgba(43,144,255,.20);
  color:var(--text);
  border-color: rgba(43,144,255,.35);
}

.grid{
  display:grid;
  grid-template-columns: 1fr auto 1fr;
  gap:18px;
  align-items:stretch;
}

@media (max-width: 980px){
  .grid{ grid-template-columns: 1fr; }
  .mid-filter{ display:none; }
}

.card{
  background:rgba(255,255,255,.04);
  border:1px solid var(--panel-bd);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:12px 14px 14px;
  min-width:0;
}

/* ✅ follow content (no forced tall blank area when collapsed) */
.card-col{
  display:flex;
  flex-direction:column;
  min-height:0;
  min-width:0;
}

h3{
  margin:6px 0 10px;
  font-size:14px;
  font-weight:900;
  color: var(--accent);
  text-shadow: 0 0 18px rgba(43,144,255,.10);
}

/* =========================
   Bars / Buttons
   ========================= */

.barcard{
  border:1px solid var(--panel-bd);
  border-radius:14px;
  background:var(--panel-bg);
  padding:10px;
}
.barcard-top{ margin-bottom:10px; }

.filebar{
  display:flex;
  gap:10px;
  align-items:center;
  min-width:0;
}
.filebar-flat{ padding:0; border:0; background:transparent; }
.filebar input[type="file"]{
  position:absolute;
  width:1px;
  height:1px;
  opacity:0;
  pointer-events:none;
}

.filename{
  color:var(--soft-text);
  font-size:12px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  flex:1 1 auto;
  min-width:0;
  text-align:right;
}

.btn{
  border:1px solid var(--line);
  background:transparent;
  color:var(--text);
  padding:9px 14px;
  border-radius:12px;
  cursor:pointer;
  font-weight:800;
}
.btn.primary{
  background:linear-gradient(135deg, rgba(120,255,240,.95), rgba(43,144,255,.95));
  color:#07111b;
  border:0;
}
.btn.secondary{ background:rgba(255,255,255,.05); }
.btn-s{ padding:8px 12px; border-radius:12px; }
.btn-mini{ width:88px; min-width:88px; text-align:center; }
.btn-fixed{ width:88px; min-width:88px; text-align:center; }

.top-actions{
  display:flex;
  gap:10px;
  justify-content:flex-end;
  align-items:center;
  min-width:0;
}

/* ✅ Mobile-only helper (for "图片" button) */
.only-mobile{ display:none; }
@media (max-width: 560px){
  .only-mobile{ display:inline-flex; }
}

/* =========================
   Input / Output (EXACT same sizing)
   ========================= */

.outbox{ width:100%; min-width:0; }

textarea,
.output,
.input-overlay{
  font-size:var(--fs-body);
  line-height:var(--lh-body);
  font-family:var(--sans);
}

textarea{
  width:100%;
  height:320px;
  max-height:320px;
  background:var(--box-bg);
  border:1px solid var(--box-bd);
  border-radius:12px;
  color:rgba(255,255,255,.92);
  padding:12px;

  white-space:pre;
  overflow-wrap:normal;
  word-break:normal;

  overflow-x:auto;
  overflow-y:auto;

  min-width:0;
}

.output{
  width:100%;
  height:320px;
  max-height:320px;
  background:var(--box-bg);
  border:1px solid var(--box-bd);
  border-radius:12px;
  padding:12px;

  white-space:pre-wrap;
  overflow:auto;
  min-width:0;
}

.hl{
  background: rgba(255, 92, 92, 0.14);
  border: 1px solid rgba(255, 92, 92, 0.35);
  color: rgba(255,255,255,.96);
  padding: 1px 6px;
  border-radius: 999px;
}

.tiny{ font-size:11px; line-height:1.45; }
.muted{ color:var(--muted); }

/* =========================
   Watermark / Overlay
   ========================= */

.textarea-wrap{ position:relative; min-width:0; }

.input-watermark{
  position:absolute;
  left:12px;
  right:12px;
  bottom:12px;
  padding:10px 10px 8px;
  border-radius:12px;
  background:linear-gradient(180deg, rgba(10,14,20,0), var(--box-bg));
  color:var(--hint-text);
  font-size:var(--fs-body);
  line-height:1.45;
  white-space:pre-line;
  pointer-events:none;
  user-select:none;
}
#inputWrap.has-content .input-watermark{ display:none; }

/* ✅ overlay inset; ✅ hide scrollbars, keep scrollable for sync */
.input-overlay{
  display:none;
  position:absolute;
  left:12px; right:12px; top:12px; bottom:12px;
  padding:0;
  border-radius:10px;

  overflow:auto;
  scrollbar-width:none;
  -ms-overflow-style:none;

  white-space:pre;
  overflow-wrap:normal;
  word-break:normal;

  pointer-events:none;
  color: rgba(255,255,255,.92);
}
.input-overlay::-webkit-scrollbar{ width:0; height:0; }
#inputWrap.pdf-overlay-on .input-overlay{ display:block; }

#inputWrap.pdf-overlay-on textarea{
  color: transparent;
  caret-color: rgba(255,255,255,.88);
  -webkit-text-fill-color: transparent;
}
#inputWrap.pdf-overlay-on textarea::selection{ background: transparent; }

.hit{
  background: rgba(255, 92, 92, 0.12);
  border: 1px solid rgba(255, 92, 92, 0.28);
  border-radius: 10px;
  padding: 0 4px;
}

/* =========================
   Middle filter (desktop)
   ========================= */

.mid-filter{
  width: 150px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:14px;
  padding:10px 0;
  opacity:0.98;
}
.mid-filter .flow-line{
  width:4px;
  flex:1;
  border-radius:4px;
  background: linear-gradient(
    to bottom,
    rgba(120, 255, 240, 0),
    rgba(120, 255, 240, 0.65),
    rgba(120, 255, 240, 0)
  );
}
.filter-badge-plain{
  background:transparent;
  border:0;
  box-shadow:none;
  width:auto;
  height:auto;
  display:flex;
  align-items:center;
  justify-content:center;
}
.filter-icon-mid{
  width: 67px;
  height:auto;
  display:block;
  user-select:none;
  -webkit-user-drag:none;
}
.mid-title{
  font-weight:900;
  letter-spacing:.6px;
  color: rgba(255,255,255,.82);
  text-shadow: 0 0 22px rgba(43,144,255,.14);
}

/* =========================
   Footer / Links (normal flow)
   ========================= */

.links{
  display:flex;
  gap:12px;
  font-size:12px;
}
.links a{
  color:rgba(120,255,240,.80);
  text-decoration:none;
}
.links a:hover{ text-decoration:underline; }

.left-footer{ margin-top:12px; padding-top:0; }
.right-footer{ margin-top:12px; padding-top:0; }

.accent-link{ color: rgba(120,255,240,.80); }

#ui-foot{
  font-size:12px;
  line-height:1.45;
}

/* =========================
   Unified control title row + body
   ========================= */

.ctlbar{ margin-top:10px; }
.barcard.ctlbar{ padding:0; }

.ctlbtn{
  width:100%;
  border:0;
  background:transparent;
  color:rgba(255,255,255,.92);
  font-weight:900;
  font-size:13px;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:space-between;

  padding:10px 12px;
  min-height:46px;
  text-align:left;
}
.ctlbtn::after{ content:"▾"; opacity:.65; transform: translateY(-1px); }
.ctlbtn[aria-expanded="true"]::after{ content:"▴"; }

.io-body{ margin-top:10px; display:none; }
.io-body.open{ display:block; }

/* ✅ FIX: remove bottom overlay/shadow that could cover content when expanded */
#manualBody.open,
#riskBody.open{
  background: transparent;
}
#manualBody.open::after,
#riskBody.open::after{
  content:none !important;
}

/* ✅ FIX: when JS locks height, ensure inner fills it */
#manualBody.open .io-bottom-grid,
#riskBody.open .io-bottom-grid{
  height:100%;
}

/* ✅ EXTRA ROBUST FILL (2026-02-21a2):
   Some DOM variants may not have .io-bottom-grid-left/.right.
   Make ANY direct child inside .io-bottom-grid stretch. */
#manualBody.open .io-bottom-grid > *,
#riskBody.open .io-bottom-grid > *{
  height:100%;
  min-height:0;
}

/* ✅ 3:2 ratio (internal within each pane) */
.io-bottom-grid{
  display:grid;
  grid-template-columns: 3fr 2fr;
  gap:12px;
  align-items:stretch;
  min-width:0;
}

/* ✅ critical: allow equal-height + inner scroll */
.io-bottom-grid > *{
  min-height:0;
  height:100%;
}

.subcard{
  border:1px solid var(--panel-bd);
  border-radius:14px;
  background:var(--panel-bg);
  padding:12px;
  min-width:0;

  display:flex;
  flex-direction:column;
  min-height:0;
}

/* =========================
   Rail card (progress only)
   ========================= */

.railcard{
  border:1px solid var(--panel-bd);
  border-radius:14px;
  background:var(--panel-bg);
  padding:10px;

  display:flex;
  flex-direction:column;
  gap:10px;

  min-width:0;
  height:100%;
  min-height:0;
}

.railcard-progress-only{
  gap:8px;
}

.rail-title{
  font-weight:900;
  font-size:12px;
  color: rgba(255,255,255,.88);
  letter-spacing:.2px;
  text-align:center;
}

.rail-divider{
  height:1px;
  width:100%;
  background: rgba(255,255,255,.08);
  margin:4px 0;
}

.side-rail-note{
  font-size:12px;
  line-height:1.5;
  color:rgba(255,255,255,.82);
  white-space:pre-line;
  overflow-wrap:anywhere;
  word-break:break-word;
}

/* =========================
   Manual textarea (shared) — scrolls inside
   ========================= */

.manual-terms-textarea{
  width:100%;
  flex:1 1 auto;
  min-height:0;
  height:100%;

  resize:none;
  background:var(--box-bg);
  border:1px solid var(--box-bd);
  border-radius:12px;
  color:rgba(255,255,255,.92);
  padding:12px;

  font-size:var(--fs-body);
  line-height:var(--lh-body);

  white-space:pre;
  overflow-wrap:normal;
  word-break:normal;
  overflow:auto;
}

/* =========================
   Risk card aesthetics
   ========================= */

.risk{ padding:0; border:0; background:transparent; }
.riskhead{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.riskmeta{ margin-top:2px; color:var(--muted); font-size:12px; }

.riskscore{
  min-width:96px;
  text-align:center;
  padding:10px 10px 8px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(10,14,20,.35);
}
.riskscore .n{ font-size:26px; font-weight:900; line-height:1; }
.riskscore .l{ font-size:12px; opacity:.9; margin-top:4px; color:rgba(255,255,255,.86); }

.risksec{ margin-top:10px; }
.risklabel{ font-size:12px; color:var(--muted); margin-bottom:6px; }

.risklist{ display:flex; flex-direction:column; gap:6px; }
.riskitem{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:7px 10px;
  border-radius:12px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
}
.riskitem .rk{ font-size:12px; color:rgba(255,255,255,.90); }
.riskitem .rv{ font-size:12px; color:var(--muted); }

.riskadvice{ font-size:12px; line-height:1.5; color:rgba(255,255,255,.82); }

/* =========================
   Progress output — takes remaining height and scrolls
   ========================= */

#exportStatus{
  flex:1 1 auto;
  min-height:0;
  font-size:11px;
  line-height:1.55;
  color:rgba(255,255,255,.80);
  white-space:pre-wrap;
  overflow:auto;
}

/* =========================
   Mobile
   ========================= */

.panel-radio{
  position:absolute;
  left:-9999px;
  width:1px;
  height:1px;
  opacity:0;
}

.io-tabs{ display:none; }

@media (max-width: 560px){

  .wrap{ padding:12px 10px 14px; }

  header{ margin-bottom:10px; align-items:center; }
  .logo{ gap:10px; }
  .logo-top-icon{ height:34px; }
  .brand-name{ font-size:16px; line-height:1.15; }
  .lang{ margin-top:0; gap:6px; }
  .lang button{ padding:6px 9px; font-size:12px; }

  .card{ padding:10px; border-radius:14px; }
  .barcard{ padding:8px; border-radius:14px; }

  h3{ font-size:12px; margin:4px 0 6px; }

  .wrap-mobile{
    min-height: 100dvh;
    display:flex;
    flex-direction:column;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
  }
  @supports not (height: 1dvh){
    .wrap-mobile{ min-height: 100vh; }
  }

  /* =========================
     Mobile segmented tabs (Input / Output)
     - 连体切换按钮（segmented control）
     - 不改 HTML 结构，只改样式
     ========================= */

  .io-tabs{
    display:flex;
    gap:0;                 /* ✅ 连体：去掉间距 */
    margin: 8px 0 10px;
    flex: 0 0 auto;

    border:1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.03);
    border-radius: 999px;
    padding: 3px;          /* 外壳内边距，形成“槽” */
    overflow:hidden;
  }

  .io-tabs label{
    flex:1 1 0;
    min-height:36px;
    margin:0;
    border:0;              /* ✅ 子按钮不要外框 */
    border-radius: 999px;  /* ✅ 选中态内部胶囊 */
    background: transparent;
    color: rgba(255,255,255,.70);

    display:flex;
    align-items:center;
    justify-content:center;

    font-weight:900;
    font-size:12px;
    cursor:pointer;
    user-select:none;
    position:relative;
  }

  /* 中间分割线（只在左段右侧画一条） */
  .io-tabs label[for="tab-in"]::after{
    content:"";
    position:absolute;
    right:-1px;
    top:8px;
    bottom:8px;
    width:1px;
    background: rgba(255,255,255,.10);
    opacity:.9;
  }

  /* 选中态（高亮段） */
  #tab-in:checked ~ .io-tabs label[for="tab-in"],
  #tab-out:checked ~ .io-tabs label[for="tab-out"]{
    background: rgba(43,144,255,.22);
    color: rgba(255,255,255,.92);
    box-shadow: 0 6px 14px rgba(0,0,0,.25) inset,
                0 8px 18px rgba(0,0,0,.20);
  }

  /* 选中时隐藏中线（避免压在高亮上） */
  #tab-in:checked ~ .io-tabs label[for="tab-in"]::after{ opacity:0; }
  #tab-out:checked ~ .io-tabs label[for="tab-in"]::after{ opacity:.9; }

  .grid-mobile-one{
    flex: 1 1 auto;
    display:flex;
    flex-direction:column;
    min-height:0;
  }

  .io-panel{ display:none; }
  #tab-in:checked ~ .grid-mobile-one .io-in{ display:flex; }
  #tab-out:checked ~ .grid-mobile-one .io-out{ display:flex; }

  .io-panel{
    flex: 1 1 auto;
    flex-direction:column;
    min-height:0;
  }
  .io-panel.card-col{ min-height:0 !important; }

  .io-panel .outbox{
    flex:1 1 auto;
    min-height:0;
    display:flex;
    flex-direction:column;
  }
  .io-panel .textarea-wrap{
    flex:1 1 auto;
    min-height:0;
    display:flex;
    flex-direction:column;
  }

  .io-panel textarea{
    flex:1 1 auto;
    height:auto !important;
    max-height:none !important;
    min-height:0 !important;
    overflow:auto !important;
    padding:10px;
  }

  .io-panel .output{
    flex:1 1 auto;
    height:auto !important;
    max-height:none !important;
    min-height:0 !important;
    overflow:auto !important;
    padding:10px;
  }

  textarea, .output, .input-overlay{
    font-size: 11.5px;
    line-height: 1.5;
  }

  .filebar{ gap:8px; }
  #pdfName.filename{
    text-align:center;
    flex:1 1 auto;
    min-width:0;
    font-size:11px;
    opacity:.75;
    padding:0 6px;
  }
  #btnClear{ margin-left:auto; }

  .top-actions{ gap:10px; }
  .top-actions .btn{ flex:1 1 0; min-width:0; }

  .grid, .card, .card-col, .filebar, .top-actions, .filename{ min-width:0; }

  .io-bottom-grid{ grid-template-columns: 1fr; }
}

/* FORCE: wrap-mobile does not grow */
.wrap-mobile{
  height: 100dvh;
  overflow: hidden;
}
@supports not (height: 1dvh){
  .wrap-mobile{ height: 100vh; }
}
.wrap-mobile .grid-mobile-one{ flex: 1 1 auto; min-height: 0; }
.wrap-mobile .io-panel{ flex: 1 1 auto; min-height: 0; }
.wrap-mobile .io-panel .outbox{
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.wrap-mobile .io-panel .output{
  flex: 1 1 auto;
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: auto !important;
}
.wrap-mobile .io-panel textarea{
  flex: 1 1 auto;
  min-height: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: auto !important;
}

/* =========================
   Manual panes (Mode A/B switch)
   ========================= */

.manual-pane{
  display:flex;
  flex-direction:column;
  min-height:0;
  height:100%;
}

.manual-redact-title{
  font-weight:900;
  font-size:13px;
  color: rgba(255,255,255,.92);
  text-align:center;
  margin-bottom:8px;
}

/* ✅ FIX: if i18n sets title to "", don't reserve blank space */
.manual-redact-title:empty{
  display:none;
  margin:0;
}

.manual-redact-note{
  font-size:11px;
  line-height:1.55;
  color: rgba(255,255,255,.72);
  white-space:pre-line;
  overflow-wrap:anywhere;
  text-align:left;
}

.manual-redact-actions{
  margin-top:12px;
  display:flex;
  justify-content:center;
}

/* =========================
   Export status stability fix
   ========================= */

.export-status{
  white-space: pre-wrap;
  word-break: break-word;     /* 防止被整行裁切 */
  overflow-wrap: anywhere;    /* 关键：允许断开 */
  min-width: 0;               /* ⚠️ 在 flex 布局中极重要 */
}

.railcard{
  min-width: 0;               /* 如果父级是 flex，必须有 */
}

/* =========================
   FIX E: mid-filter bottom shadow overlay
   - keep visual divider
   - never cover/click-block left/right
   ========================= */

/* 1) mid column should not capture pointer events */
.mid-filter{
  pointer-events: none !important;
  position: relative !important;
  z-index: 0 !important;
  overflow: hidden !important;   /* critical: clip any gradient shadow inside */
}

/* 2) if there is a pseudo-element doing fade/shadow, clip/disable it */
.mid-filter::before,
.mid-filter::after{
  pointer-events: none !important;
  box-shadow: none !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* if your shadow is from a gradient mask, kill it */
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
}

/* 3) ensure left/right cards always render above mid column */
#leftCard, #rightCard{
  position: relative !important;
  z-index: 2 !important;
}

.mid-filter *{
  box-shadow: none !important;
  background-image: none !important;
  -webkit-mask-image: none !important;
  mask-image: none !important;
  filter: none !important;
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
