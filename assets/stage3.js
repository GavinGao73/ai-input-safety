// =========================
// assets/stage3.js (FULL)
// v20260309a3 — PATCHED (stronger header/footer filter + input editable state)
//
// ADD:
// - stronger filterHeaderFooterText()
// - setInputEditable()
// - Mode A readable PDF => readOnly
// - Mode B / image / non-pdf / failure => editable
//
// GOAL:
// - remove common PDF headers/footers like
//   Page 1 of 1
//   1 / 3
//   CONFIDENTIAL
//   INVOICE
//   company/address footer lines
// - keep input box editable unless readable PDF Mode A is active
// =========================

// ================= HEADER / FOOTER FILTER =================

function filterHeaderFooterText(text) {

  if (!text) return text;

  let lines = text.split(/\r?\n/);

  function isPageLine(s) {
    return /^page\s*\d+\s*(of|\/)\s*\d+$/i.test(s) ||
           /^\d+\s*\/\s*\d+$/.test(s) ||
           /page\s*\d+\s*(of|\/)\s*\d+/i.test(s);
  }

  function isLikelyHeaderLine(s) {
    if (!s) return false;
    if (s.length > 80) return false;
    if (/:/.test(s)) return false;

    // common document header words
    if (/\b(confidential|invoice|statement|receipt|quotation|quote|report|summary)\b/i.test(s)) {
      return true;
    }

    // short title-like lines
    if (/^[A-Z][A-Za-z\s&\-]{4,}$/.test(s)) {
      return true;
    }

    // all-caps short lines
    if (/^[A-Z0-9\s&\-]{4,}$/.test(s)) {
      return true;
    }

    return false;
  }

  function isLikelyFooterLine(s) {
    if (!s) return false;

    if (isPageLine(s)) return true;

    // company + address style footer
    if (
      /(?:GmbH|LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP)\b/.test(s) &&
      /(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|boulevard|blvd\.?|court|ct\.?|place|pl\.?|square|sq\.?)\b/i.test(s)
    ) {
      return true;
    }

    // company/address line with separators
    if (
      /[·|]/.test(s) &&
      (
        /(?:GmbH|LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP)\b/.test(s) ||
        /\b\d{4,6}\s+[A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]+\b/.test(s)
      )
    ) {
      return true;
    }

    return false;
  }

  // ===== remove top header-like lines (only first non-empty block) =====
  let firstNonEmpty = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      firstNonEmpty = i;
      break;
    }
  }

  if (firstNonEmpty >= 0) {
    let removeCount = 0;
    for (let i = firstNonEmpty; i < Math.min(lines.length, firstNonEmpty + 3); i++) {
      const s = lines[i].trim();
      if (!s) break;
      if (isLikelyHeaderLine(s)) {
        removeCount++;
      } else {
        break;
      }
    }
    if (removeCount > 0) {
      lines.splice(firstNonEmpty, removeCount);
    }
  }

  const cleaned = [];

  for (let line of lines) {
    const l = line.trim();

    if (!l) {
      cleaned.push(line);
      continue;
    }

    if (isPageLine(l)) continue;
    if (isLikelyFooterLine(l)) continue;

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
    // only for readable PDF Mode A
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
