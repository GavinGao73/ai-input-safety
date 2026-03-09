// =========================
// assets/stage3.js (FULL)
// v20260309a2 — PATCHED (header/footer filter + input editable state)
//
// ADD:
// - filterHeaderFooterText()
// - setInputEditable()
// - Mode A readable PDF => readOnly
// - Mode B / image / non-pdf / failure => editable
//
// GOAL:
// - remove simple page headers/footers like
//   Page 1 of 1
//   1 / 3
//   repeated short header/footer lines
// - keep input box editable unless readable PDF Mode A is active
// =========================

// ================= HEADER / FOOTER FILTER =================

function filterHeaderFooterText(text) {

  if (!text) return text;

  let lines = text.split(/\r?\n/);

  // ===== 删除顶部标题页眉 =====
  if (lines.length > 0) {

    const first = lines[0].trim();

    if (
      first &&
      first.length < 80 &&
      /^[A-Z][A-Za-z\s]+$/.test(first) &&
      !/:/.test(first)
    ) {
      lines.shift();
    }
  }

  const cleaned = [];

  for (let line of lines) {

    const l = line.trim();

    if (!l) {
      cleaned.push(line);
      continue;
    }

    // Page 1 of 3
    if (/^page\s*\d+\s*(of|\/)\s*\d+$/i.test(l)) continue;

    // 1 / 3
    if (/^\d+\s*\/\s*\d+$/.test(l)) continue;

    // footer page reference
    if (/page\s*\d+\s*(of|\/)\s*\d+/i.test(l)) continue;

    cleaned.push(line);
  }

  return cleaned.join("\n");
}

// ================= INPUT EDIT STATE =================

function setInputEditable(isEditable) {
  const ta = $("inputText");
  if (!ta) return;
  ta.readOnly = !isEditable;
}

// =========================
// keep raw per-page text items
// =========================
let lastPdfPagesItems = [];

// pretty page text
let lastPdfPagesText = [];

// ================= Stage 3 helpers =================
function resetRuleEngineForNewSession() {
  try { window.ruleEngine = ""; } catch (_) {}
  try { window.ruleEngineMode = "auto"; } catch (_) {}
}

function setRuleEngineAuto() {
  return;
}

function lockRuleEngineForSession(lang) {
  const l = String(lang || "").toLowerCase();
  if (!(l === "zh" || l === "de" || l === "en")) return;
  try { window.ruleEngine = l; } catch (_) {}
  try { window.ruleEngineMode = "lock"; } catch (_) {}
}

function applyRulesSafely(text) {
  const s = String(text || "");

  try {
    if (typeof window.ensureLangBeforeApply === "function") {
      const r = window.ensureLangBeforeApply(s);

      if (r === false) return;

      if (r && typeof r.then === "function") {
        return r.then((ok) => {
          if (ok === false) return;
          if (typeof window.applyRules === "function") window.applyRules(s);
        });
      }

      if (typeof window.applyRules === "function") window.applyRules(s);
      return;
    }
  } catch (_) {}

  try {
    if (typeof window.applyRules === "function") window.applyRules(s);
  } catch (_) {}
}

function ensureLangForPdfRaw(text) {
  const s = String(text || "").trim();
  if (!s) return { ok: true, asked: false };

  try {
    if (window.__LangDetect && typeof window.__LangDetect.ensureContentLang === "function") {
      const r = window.__LangDetect.ensureContentLang(s, window.currentLang || "en");
      return r || { ok: true, asked: false };
    }
  } catch (_) {}

  return { ok: true, asked: false };
}

// ================= Stage 3 file handler =================
async function handleFile(file) {
  if (!file) {
    setInputEditable(true);
    return;
  }

  lastUploadedFile = file;
  lastProbe = null;
  lastPdfOriginalText = "";

  resetRuleEngineForNewSession();

  lastPdfPagesItems = [];
  lastPdfPagesText = [];

  try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
  try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

  try { window.lastPdfPagesText = lastPdfPagesText; } catch (_) {}
  try { window.__pdf_pages_text = lastPdfPagesText; } catch (_) {}

  lastFileKind =
    file.type === "application/pdf" ? "pdf" :
    (file.type && file.type.startsWith("image/") ? "image" : "");

  __manualRedactSession = null;
  __manualRedactResult = null;
  try { window.__manual_redact_last = null; } catch (_) {}

  setStage3Ui("none");

  if (lastFileKind === "image") {
    lastRunMeta.fromPdf = false;

    setRuleEngineAuto();
    setInputEditable(true);

    setStage3Ui("B");
    setManualPanesForMode("B");
    setManualRailTextByMode();

    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualRiskHeights();
    });
    return;
  }

  if (lastFileKind !== "pdf") {
    setInputEditable(true);
    return;
  }

  try {
    if (!window.probePdfTextLayer) {
      lastRunMeta.fromPdf = false;

      setRuleEngineAuto();
      setInputEditable(true);

      setStage3Ui("B");
      setManualPanesForMode("B");
      setManualRailTextByMode();

      requestAnimationFrame(() => {
        expandManualArea();
        expandRiskArea();
        syncManualRiskHeights();
      });
      return;
    }

    const probe = await window.probePdfTextLayer(file);
    lastProbe = probe || null;

    try {
      lastPdfPagesItems = (probe && Array.isArray(probe.pagesItems)) ? probe.pagesItems : [];
    } catch (_) {
      lastPdfPagesItems = [];
    }

    try {
      lastPdfPagesText = (probe && Array.isArray(probe.pagesText)) ? probe.pagesText : [];
    } catch (_) {
      lastPdfPagesText = [];
    }

    try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
    try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

    try { window.lastPdfPagesText = lastPdfPagesText; } catch (_) {}
    try { window.__pdf_pages_text = lastPdfPagesText; } catch (_) {}

    if (!probe || !probe.hasTextLayer) {
      lastRunMeta.fromPdf = false;

      setRuleEngineAuto();
      setInputEditable(true);

      setStage3Ui("B");
      setManualPanesForMode("B");
      setManualRailTextByMode();

      requestAnimationFrame(() => {
        expandManualArea();
        expandRiskArea();
        syncManualRiskHeights();
      });
      return;
    }

    lastRunMeta.fromPdf = true;
    setStage3Ui("A");
    setManualPanesForMode("A");
    setManualRailTextByMode();

    let text = String(probe.text || "").trim();

    // ================= HEADER / FOOTER FILTER =================
    text = filterHeaderFooterText(text);

    lastPdfOriginalText = text;

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
    }
    setInputEditable(false);

    updateInputWatermarkVisibility();

    if (text) {
      const ensured = ensureLangForPdfRaw(text);

      if (ensured && ensured.ok === false) {
        try {
          if (typeof window.renderInputOverlayForPdf === "function") {
          }
        } catch (_) {}
      } else {
        await applyRulesSafely(text);

        try {
          if (typeof window.renderInputOverlayForPdf === "function") {
          }
        } catch (_) {}
      }
    }

    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualRiskHeights();
    });

    try { window.dispatchEvent(new Event("safe:updated")); } catch (_) {}
  } catch (e) {
    lastRunMeta.fromPdf = false;

    setRuleEngineAuto();
    setInputEditable(true);

    lastPdfPagesItems = [];
    lastPdfPagesText = [];

    try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
    try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

    try { window.lastPdfPagesText = lastPdfPagesText; } catch (_) {}
    try { window.__pdf_pages_text = lastPdfPagesText; } catch (_) {}

    setStage3Ui("B");
    setManualPanesForMode("B");
    setManualRailTextByMode();

    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualRiskHeights();
    });
  }
}

// ================= bind upload =================
function bindPdfUI() {
  const pdfInput = $("pdfFile");
  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && $("pdfName")) $("pdfName").textContent = f.name || "";
      clearProgress();
      handleFile(f);
      e.target.value = "";
    });
  }

  const imgInput = $("imgFile");
  if (imgInput) {
    imgInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && $("pdfName")) $("pdfName").textContent = f.name || "";
      clearProgress();
      handleFile(f);
      e.target.value = "";
    });
  }
}

try {
  if (typeof window.applyRulesSafely !== "function") window.applyRulesSafely = applyRulesSafely;
} catch (_) {}

try {
  if (typeof window.handleFile !== "function") window.handleFile = handleFile;
} catch (_) {}

try {
  if (typeof window.bindPdfUI !== "function") window.bindPdfUI = bindPdfUI;
} catch (_) {}
