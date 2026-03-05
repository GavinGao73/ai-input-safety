// =========================
// assets/ui-core.js (FULL)
// v20260305a1 — MERGED (i18n.js + ui.js + moved UI telemetry from main.js)
//
// GOAL
// - Keep UI stable, keep all existing behaviors
// - Provide unified UI helpers + i18n + stage3 UI + manual/risk UI helpers
// - Provide exportStatus rendering (BOOT + lang status + RasterExport progress)
// - Remove ALL legacy contentLang/contentLangMode writes (single source of truth is ruleEngine/ruleEngineMode)
//
// Exports:
// - window.I18N (same as before)
// - window.setLang(lang) (same behavior: store + dispatch lang:changed)
// - window.__UI__ helpers:
//   snapshotLangStatus, renderExportStatusCombined, startExportStatusMirror, stopExportStatusMirror
// =========================

/* =========================
   I18N DICT (from assets/i18n.js)
   ========================= */
const I18N = {
  zh: {
    inTitle: "在 AI 读取之前，先通过 Filter。",
    outTitle: "过滤后文本，可直接粘贴给 AI。",

    placeholder: "例如：简历、邮件、咨询材料、报告摘要……",
    inputWatermark:
      "AI 系统可以解析文档中的隐藏文本结构。\n本工具仅在本地运行，不上传、不保存内容。",

    // ✅ Upload
    btnUpload: "上传文件",
    btnUploadImg: "图片",

    btnGenerate: "过滤",
    btnCopy: "复制",
    btnCopied: "✔ 已复制",
    btnClear: "清空",

    // toggle titles
    riskTitle: "风险评分",
    manualTitle: "手工处理",

    fbQ: "有帮助吗？",

    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",

    foot: "过滤和修改仅为建议，不构成法律承诺",

    // Mobile tabs
    tabIn: "输入",
    tabOut: "输出",

    // Output action (PDF)
    btnRedactPdf: "红删PDF",

    // Manual terms card (Mode A)
    manualHint: "支持逗号/换行分隔；只遮盖 PDF 原文里真实出现的内容。",
    manualPlaceholder: "例如：张三, 李四, Bei.de Tech GmbH",

    // ✅ Mode B: manual visual redaction pane (left)
    // ✅ no extra title (already have “手工处理”)
    manualRedactTitle: "",
    manualRedactNote:
      "检测到上传内容为图片或不可读 PDF（无文本层）。\n请先进入手工框选，覆盖需要隐藏的信息；详细步骤见下方「使用说明」。",
    btnManualRedact: "手工涂抹",

    // ✅ rail titles + separate texts
    manualRailTitle: "使用说明",

    // Mode A only
    manualRailTextA:
      "Mode A（PDF 可读）：\n" +
      "1) 在左侧「手工处理」中输入需要额外遮盖的关键词（逗号或换行分隔）。\n" +
      "2) 只会遮盖：① 你上传的 PDF 原文里真实出现的词；② 你粘贴/输入的文本里出现的词。\n" +
      "3) 完成后点击右侧「红删PDF」生成新的 PDF。\n" +
      "4) 下载后先检查确认无误，再发送给他人或给 AI。",

    // Mode B only
    manualRailTextB:
      "Mode B（扫描/图片 PDF）：\n" +
      "1) 点击左侧「手工涂抹」，进入框选遮盖。\n" +
      "2) 可多次框选；可清空本页/全部。\n" +
      "3) 框选完成后关闭涂抹界面，回到主界面。\n" +
      "4) 点击右侧「红删PDF」生成新的 PDF；下载检查无误后再发送。",

    exportTitle: "生成进程",

    // progress messages
    progressWorking: "处理中…",
    progressDone: "完成 ✅ 已开始下载。",
    progressNoFile: "未检测到文件，请先上传 PDF。",
    progressNotPdf: "当前不是 PDF 文件。",
    progressNotReadable: "PDF 不可读（Mode B），请先手工涂抹并保存框选，然后再点红删PDF。",
    progressNeedManualFirst: "请先点「手工涂抹」完成框选并关闭界面，然后再点「红删PDF」。",
    progressExportMissing: "导出模块未加载",
    progressFailed: "导出失败：",

    // optional for exportStatus mirror (main.js uses these keys if exist)
    progressPhaseBegin: "开始准备…",
    progressPhaseScan: "扫描并计算遮盖区域…",
    progressPhaseExport: "生成安全PDF（纯图片）…",
    progressPhaseWorking: "处理中…",
    progressPhase2: "阶段2",
    progressPages: "页数",
    progressRects: "遮盖块",
    progressPage: "当前页"
  },

  en: {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — ready to paste into AI.",

    placeholder: "e.g. resume, email, report summary…",
    inputWatermark:
      "AI systems can extract hidden text-layer data.\nAll processing runs locally. Nothing is stored or transmitted.",

    btnUpload: "Choose file",
    btnUploadImg: "Image",

    btnGenerate: "Filter",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    btnClear: "Clear",

    riskTitle: "Risk score",
    manualTitle: "Manual",

    fbQ: "Helpful?",

    learn: "Learn",
    privacy: "Privacy",
    scope: "Scope",

    foot: "Filtering and edits are suggestions only. No legal commitment.",

    tabIn: "Input",
    tabOut: "Output",

    btnRedactPdf: "Redact PDF",

    manualHint: "Separate by commas/new lines. Only masks terms that actually appear in the PDF text.",
    manualPlaceholder: "e.g. Alice, Bob, Bei.de Tech GmbH",

    // ✅ no extra title
    manualRedactTitle: "",
    manualRedactNote:
      "Detected an image or an unreadable PDF (no text layer).\nPlease mark areas to hide first. See “How it works” below for the steps.",
    btnManualRedact: "Mark areas",

    manualRailTitle: "How it works",

    manualRailTextA:
      "Mode A (readable PDF):\n" +
      "1) Enter extra terms to mask in “Manual” (comma/new-line separated).\n" +
      "2) Only masks: ① terms that appear in the uploaded PDF text; ② terms that appear in your input.\n" +
      "3) Click “Redact PDF” to generate a new PDF.\n" +
      "4) Download and verify it before sending.",

    manualRailTextB:
      "Mode B (scanned/image PDF):\n" +
      "1) Click “Manual” to mark areas with rectangles.\n" +
      "2) You can add multiple boxes; clear page/all.\n" +
      "3) Close the marking UI to return.\n" +
      "4) Click “Redact PDF” to generate a new PDF; download and verify before sending.",

    exportTitle: "Progress",

    progressWorking: "Working…",
    progressDone: "Done ✅ Download started.",
    progressNoFile: "No file detected. Please upload a PDF first.",
    progressNotPdf: "This is not a PDF file.",
    progressNotReadable: "PDF not readable (Mode B). Please mark areas first, then click Redact PDF.",
    progressNeedManualFirst: "Please mark areas first (Manual), close it, then click Redact PDF.",
    progressExportMissing: "Export module not loaded",
    progressFailed: "Export failed:",

    progressPhaseBegin: "Preparing…",
    progressPhaseScan: "Scanning & computing masks…",
    progressPhaseExport: "Exporting secure raster PDF…",
    progressPhaseWorking: "Working…",
    progressPhase2: "Phase2",
    progressPages: "Pages",
    progressRects: "Rects",
    progressPage: "Page"
  },

  de: {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",

    placeholder: "z.B. Lebenslauf, E-Mail, Bericht…",
    inputWatermark:
      "KI-Systeme lesen auch verborgene Textlayer-Daten.\nVerarbeitung erfolgt ausschließlich lokal. Keine Speicherung.",

    btnUpload: "Datei auswählen",
    btnUploadImg: "Bild",

    btnGenerate: "Filtern",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    btnClear: "Leeren",

    riskTitle: "Risikowert",
    manualTitle: "Manuell",

    fbQ: "Hilfreich?",

    learn: "Info",
    privacy: "Datenschutz",
    scope: "Umfang",

    foot: "Filterung und Änderungen sind nur Vorschläge. Keine rechtliche Zusage.",

    tabIn: "Eingabe",
    tabOut: "Ausgabe",

    btnRedactPdf: "PDF schwärzen",

    manualHint: "Trennung per Komma/Zeilenumbruch. Es wird nur maskiert, was im PDF-Text wirklich vorkommt。",
    manualPlaceholder: "z.B. Max Mustermann, Erika, Bei.de Tech GmbH",

    // ✅ no extra title
    manualRedactTitle: "",
    manualRedactNote:
      "Bild oder nicht lesbares PDF erkannt (kein Textlayer).\nBitte zuerst Bereiche markieren. Schritte stehen unten unter „So funktioniert’s“.",
    btnManualRedact: "Bereiche markieren",

    manualRailTitle: "So funktioniert’s",

    manualRailTextA:
      "Mode A (lesbares PDF):\n" +
      "1) Zusätzliche Begriffe zum Maskieren unter „Manuell“ eingeben (Komma/Zeilenumbruch).\n" +
      "2) Maskiert wird nur: ① was im PDF-Text vorkommt; ② was in deiner Eingabe vorkommt.\n" +
      "3) „PDF schwärzen“ klicken und ein neues PDF erzeugen.\n" +
      "4) Herunterladen und prüfen, erst dann senden.",

    manualRailTextB:
      "Mode B (Scan/Bild-PDF):\n" +
      "1) „Manuell“ klicken und Bereiche per Rechteck markieren.\n" +
      "2) Mehrfach markieren; Seite/Alles löschen.\n" +
      "3) Markierungs-UI schließen und zurückkehren.\n" +
      "4) „PDF schwärzen“ klicken, herunterladen und prüfen, erst dann senden.",

    exportTitle: "Fortschritt",

    progressWorking: "Wird verarbeitet…",
    progressDone: "Fertig ✅ Download gestartet.",
    progressNoFile: "Keine Datei erkannt. Bitte zuerst ein PDF hochladen.",
    progressNotPdf: "Keine PDF-Datei。",
    progressNotReadable: "PDF nicht lesbar (Mode B). Bitte erst markieren, dann PDF schwärzen.",
    progressNeedManualFirst: "Bitte erst markieren (Manuell), schließen, dann PDF schwärzen。",
    progressExportMissing: "Export-Modul nicht geladen",
    progressFailed: "Export fehlgeschlagen:",

    progressPhaseBegin: "Vorbereitung…",
    progressPhaseScan: "Scan & Maskenberechnung…",
    progressPhaseExport: "Sicheres Raster-PDF wird erzeugt…",
    progressPhaseWorking: "Wird verarbeitet…",
    progressPhase2: "Phase2",
    progressPages: "Seiten",
    progressRects: "Masken",
    progressPage: "Seite"
  }
};

window.__I18N__ = {
  get(lang, key) {},
  risk(lang) {},
  labels(lang) {}
};

window.I18N = I18N;

/* =========================
   i18n bootstrap (from assets/i18n.js, cleaned)
   - UI language auto-pick from browser/system; still allows manual override via buttons (setLang)
   - ❌ removed legacy contentLang/contentLangMode/setContentLang*
   ========================= */
(function bootstrapI18n() {
  try {
    var KEY = "__safe_lang";

    function norm(s){ return String(s || "").toLowerCase(); }
    function pick(v){ return (v === "zh" || v === "en" || v === "de") ? v : ""; }

    // ✅ auto UI language from browser/system
    function detectUiLang(){
      try {
        var cand = "";
        if (Array.isArray(navigator.languages) && navigator.languages.length) {
          cand = String(navigator.languages[0] || "");
        } else {
          cand = String(navigator.language || "");
        }
        cand = norm(cand);
        if (cand.startsWith("de")) return "de";
        if (cand.startsWith("zh")) return "zh";
        return "en";
      } catch (_) {
        return "zh";
      }
    }

    // 1) stored manual choice
    var stored = "";
    try { stored = localStorage.getItem(KEY) || ""; } catch (_) {}

    // 2) window.currentLang if preset by HTML
    // 3) navigator detection
    // 4) fallback zh
    var initial =
      pick(norm(stored)) ||
      pick(norm(window.currentLang)) ||
      detectUiLang() ||
      "zh";

    window.currentLang = initial;

    if (typeof window.setLang !== "function") {
      window.setLang = function (lang) {
        var next = pick(norm(lang)) || "zh";
        window.currentLang = next;
        try { localStorage.setItem(KEY, next); } catch (_) {}
        try {
          window.dispatchEvent(new CustomEvent("lang:changed", { detail: { lang: next } }));
        } catch (_) {}
        return next;
      };
    }

    window.__i18n_boot_ok = true;
    window.__i18n_boot_lang = window.currentLang;
  } catch (e) {
    window.__i18n_boot_ok = false;
    window.__i18n_boot_err = String(e && e.message ? e.message : e);
  }
})();

/* =========================
   DOM helpers + UI helpers (from assets/ui.js)
   ========================= */
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

  const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : null;

  if (btnPdf) btnPdf.textContent = (t && t.btnRedactPdf) ? t.btnRedactPdf : stage3Text("btnExportPdf");
  if (btnMan) btnMan.textContent = (t && t.btnManualRedact) ? t.btnManualRedact : stage3Text("btnManual");

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
  const cur = (btn && btn.getAttribute("aria-expanded") === "true");
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
}

// =========================
// UI boot patch (from ui.js)
// =========================
(function uiBootPatch() {
  function safeApplyTexts() {
    try {
      if (!(window.I18N && window.I18N[currentLang])) return;
      if (typeof setText === "function") setText();
      else if (typeof setStage3Ui === "function") setStage3Ui(lastStage3Mode);
    } catch (_) {}
  }

  if (document.readyState === "interactive" || document.readyState === "complete") {
    requestAnimationFrame(safeApplyTexts);
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => { requestAnimationFrame(safeApplyTexts); },
      { once: true }
    );
  }

  window.addEventListener(
    "load",
    () => { requestAnimationFrame(safeApplyTexts); },
    { once: true }
  );
})();

/* =========================
   MOVED FROM main.js: LANG STATUS TELEMETRY + EXPORT STATUS RENDER
   - main.js will call window.__UI__.snapshotLangStatus / renderExportStatusCombined / start/stop mirror
   ========================= */
(function initUiTelemetryExports(){
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
    } else {
      lines.push("detect.last=(none)");
    }

    if (st.reason) lines.push(`telemetry=${st.reason}`);
    return lines;
  }

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

  window.__UI__ = window.__UI__ || {};
  window.__UI__.snapshotLangStatus = snapshotLangStatus;
  window.__UI__.renderExportStatusCombined = renderExportStatusCombined;
  window.__UI__.startExportStatusMirror = startExportStatusMirror;
  window.__UI__.stopExportStatusMirror = stopExportStatusMirror;
})();
