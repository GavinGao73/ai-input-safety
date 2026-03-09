// =========================
// assets/stage3.js (FULL)
// v20260309a7 — CONSOLIDATED CLEAN VERSION
//
// Goals:
// - Keep original structure and behavior style
// - Use pagesText objects as the primary Mode A text source
// - Remove repeated multi-page edge lines deterministically
// - Keep input box editable unless readable PDF Mode A is active
// - Avoid patch stacking and keep logic centralized
// =========================

// ================= HEADER / FOOTER FILTER =================

function filterHeaderFooterText(text, pagesText) {
  function normLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function getPageText(page) {
    if (typeof page === "string") return page;
    if (page && typeof page.text === "string") return page.text;
    return "";
  }

  function isPageLine(s) {
    return /^page\s*\d+\s*(of|\/)\s*\d+$/i.test(s) ||
           /^\d+\s*\/\s*\d+$/.test(s) ||
           /page\s*\d+\s*(of|\/)\s*\d+/i.test(s);
  }

  function isLikelyFooterLine(s) {
    if (!s) return false;
    if (isPageLine(s)) return true;

    if (
      /(?:GmbH|LLC|L\.?L\.?C\.?|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|LLP)\b/.test(s) &&
      /(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|boulevard|blvd\.?|court|ct\.?|place|pl\.?|square|sq\.?)\b/i.test(s)
    ) {
      return true;
    }

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

  function isProtectedBodyLine(s) {
    if (!s) return false;

    return /^(?:customer|account|reference|order|invoice|section|date|bill to|ship to|payment details)\s*:/i.test(s);
  }

  function collectRepeatedEdgeLines(pages) {
    const edgeCount = new Map();

    if (!Array.isArray(pages) || pages.length < 2) {
      return new Set();
    }

    for (const page of pages) {
      const pageText = getPageText(page);
      const pageLines = String(pageText || "")
        .split(/\r?\n/)
        .map(normLine)
        .filter(Boolean);

      if (!pageLines.length) continue;

      const edgeLines = [
        ...pageLines.slice(0, 5),
        ...pageLines.slice(Math.max(0, pageLines.length - 5))
      ];

      for (const line of edgeLines) {
        edgeCount.set(line, (edgeCount.get(line) || 0) + 1);
      }
    }

    const repeated = new Set();
    for (const [line, count] of edgeCount.entries()) {
      if (count >= 2) repeated.add(line);
    }
    return repeated;
  }

  function cleanOnePage(pageText, repeatedEdgeLines) {
    const rawLines = String(pageText || "").split(/\r?\n/);
    const out = [];
    const lastIndex = rawLines.length - 1;

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const s = normLine(raw);

      if (!s) {
        out.push(raw);
        continue;
      }

      if (isPageLine(s)) continue;

      // remove repeated edge lines only near top/bottom of each page
      if (!isProtectedBodyLine(s) && repeatedEdgeLines.has(s) && (i <= 4 || i >= lastIndex - 4)) continue;

      // remove explicit footer-like lines near page end
      if (!isProtectedBodyLine(s) && i >= lastIndex - 2 && isLikelyFooterLine(s)) continue;

      out.push(raw);
    }

    return out.join("\n").trim();
  }

  if (Array.isArray(pagesText) && pagesText.length) {
    const repeatedEdgeLines = collectRepeatedEdgeLines(pagesText);

    return pagesText
      .map((page) => cleanOnePage(getPageText(page), repeatedEdgeLines))
      .filter(Boolean)
      .join("\n\n");
  }

  return String(text || "").trim();
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

// pretty page text objects
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

    let text = filterHeaderFooterText("", lastPdfPagesText);

    if (!text) {
      text = String(probe.text || "").trim();
    }

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
