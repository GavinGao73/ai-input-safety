// =========================
// assets/stage3.js (FULL)
// v20260309a5 — CONSOLIDATED CLEAN VERSION
//
// Goals:
// - Keep original structure and behavior style
// - Use pagesText as the primary Mode A text source
// - Filter repeated multi-page headers / footers per page
// - Keep input box editable unless readable PDF Mode A is active
// - Avoid patch stacking and keep logic centralized
// =========================

// ================= HEADER / FOOTER FILTER =================

function filterHeaderFooterText(text, pagesText) {
  function normLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function isPageLine(s) {
    return /^page\s*\d+\s*(of|\/)\s*\d+$/i.test(s) ||
           /^\d+\s*\/\s*\d+$/.test(s) ||
           /page\s*\d+\s*(of|\/)\s*\d+/i.test(s);
  }

  function isLikelyHeaderLine(s) {
    if (!s) return false;
    if (s.length > 120) return false;

    if (/\b(confidential|invoice|statement|receipt|quotation|quote|report|summary)\b/i.test(s)) {
      return true;
    }

    if (/^[A-Z][A-Za-z\s&\-]{4,}$/.test(s) && !/:/.test(s)) {
      return true;
    }

    if (/^[A-Z0-9\s&\-]{4,}$/.test(s) && !/:/.test(s)) {
      return true;
    }

    return false;
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

  function collectRepeats(pages) {
    const headCount = new Map();
    const footCount = new Map();

    if (!Array.isArray(pages) || pages.length < 2) {
      return { repeatedHeads: new Set(), repeatedFoots: new Set() };
    }

    for (const pageText of pages) {
      const pageLines = String(pageText || "")
        .split(/\r?\n/)
        .map(normLine)
        .filter(Boolean);

      if (!pageLines.length) continue;

      const heads = pageLines.slice(0, 3);
      const foots = pageLines.slice(Math.max(0, pageLines.length - 3));

      for (const h of heads) {
        headCount.set(h, (headCount.get(h) || 0) + 1);
      }
      for (const f of foots) {
        footCount.set(f, (footCount.get(f) || 0) + 1);
      }
    }

    const repeatedHeads = new Set();
    const repeatedFoots = new Set();

    for (const [k, v] of headCount.entries()) {
      if (v >= 2) repeatedHeads.add(k);
    }
    for (const [k, v] of footCount.entries()) {
      if (v >= 2) repeatedFoots.add(k);
    }

    return { repeatedHeads, repeatedFoots };
  }

  function cleanOnePage(pageText, repeatedHeads, repeatedFoots) {
    const rawLines = String(pageText || "").split(/\r?\n/);
    const out = [];

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const s = normLine(raw);

      if (!s) {
        out.push(raw);
        continue;
      }

      if (isPageLine(s)) continue;
      if (repeatedHeads.has(s)) continue;
      if (repeatedFoots.has(s)) continue;
      if (i < 2 && isLikelyHeaderLine(s)) continue;
      if (i >= rawLines.length - 2 && isLikelyFooterLine(s)) continue;

      out.push(raw);
    }

    return out.join("\n").trim();
  }

  if (Array.isArray(pagesText) && pagesText.length) {
    const { repeatedHeads, repeatedFoots } = collectRepeats(pagesText);

    return pagesText
      .map((p) => cleanOnePage(p, repeatedHeads, repeatedFoots))
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
