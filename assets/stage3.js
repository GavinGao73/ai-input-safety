// =========================
// assets/stage3.js (FULL)
// v20260309a9 — CONSOLIDATED CLEAN VERSION
//
// Goals:
// - Keep original structure and behavior style
// - Mode A requires:
//   1) text layer exists
//   2) text coverage is usable
//   3) semantic reading order is usable
// - Use pagesText objects as the primary Mode A text source
// - Remove repeated multi-page edge lines deterministically
// - Keep input box editable unless readable PDF Mode A is active
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

    return /^(?:customer|account|reference|order|invoice|section|date|bill to|ship to|payment details|statement period)\s*:/i.test(s);
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

      if (!isProtectedBodyLine(s) && repeatedEdgeLines.has(s) && (i <= 4 || i >= lastIndex - 4)) continue;

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

// ================= TEXT COVERAGE CHECK =================

function isTextCoverageUsable(text, pagesText) {
  function getPageText(page) {
    if (typeof page === "string") return page;
    if (page && typeof page.text === "string") return page.text;
    return "";
  }

  const pages = Array.isArray(pagesText) && pagesText.length
    ? pagesText
    : [{ pageNumber: 1, text: String(text || "") }];

  const cleanedPages = pages
    .map((page) => filterHeaderFooterText("", [page]))
    .map((s) => String(s || "").trim());

  const totalLen = cleanedPages.reduce((sum, s) => sum + s.length, 0);
  const avgLen = cleanedPages.length ? (totalLen / cleanedPages.length) : 0;
  const weakPages = cleanedPages.filter((s) => s.length < 50).length;

  if (totalLen < 120) return false;
  if (avgLen < 80) return false;
  if (weakPages > Math.floor(cleanedPages.length / 2)) return false;

  // extra guard: if raw extracted text exists but almost all useful text disappears after cleaning,
  // it usually means only marginal header/footer text was extractable
  const rawTotal = pages
    .map(getPageText)
    .map((s) => String(s || ""))
    .reduce((sum, s) => sum + s.length, 0);

  if (rawTotal > 0 && totalLen / Math.max(1, rawTotal) < 0.15) return false;

  return true;
}

// ================= SEMANTIC USABILITY CHECK =================

function isSemanticReadingUsable(text, pagesText) {
  function normLine(s) {
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  function getPageText(page) {
    if (typeof page === "string") return page;
    if (page && typeof page.text === "string") return page.text;
    return "";
  }

  function countMatches(s, re) {
    const m = String(s || "").match(re);
    return m ? m.length : 0;
  }

  function hasRepeatedPhrase(line) {
    return /\b([A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,6})\b.*\b\1\b/i.test(line);
  }

  function isSuspiciousMergedLine(line) {
    const s = normLine(line);
    if (!s || s.length < 40) return false;

    const labelRepeats =
      countMatches(s, /ticket\s*no\.?/gi) +
      countMatches(s, /case\s*id/gi) +
      countMatches(s, /email\s*:/gi) +
      countMatches(s, /phone\s*:/gi) +
      countMatches(s, /contact\s*:/gi) +
      countMatches(s, /ref\s*:/gi) +
      countMatches(s, /amount\s*:/gi);

    if (labelRepeats >= 2) return true;
    if (hasRepeatedPhrase(s)) return true;

    const sepCount = countMatches(s, /[·|]/g);
    if (sepCount >= 4 && labelRepeats >= 1) return true;

    return false;
  }

  const pages = Array.isArray(pagesText) && pagesText.length
    ? pagesText.map(getPageText)
    : [String(text || "")];

  let suspiciousPages = 0;

  for (const pageText of pages) {
    const lines = String(pageText || "")
      .split(/\r?\n/)
      .map(normLine)
      .filter(Boolean);

    if (!lines.length) continue;

    let suspiciousLines = 0;
    for (const line of lines) {
      if (isSuspiciousMergedLine(line)) suspiciousLines++;
    }

    if (suspiciousLines >= 3) suspiciousPages++;
  }

  return suspiciousPages === 0;
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

function enterModeBFromPdf(rawText) {
  lastRunMeta.fromPdf = false;

  // Mode B does not need language detection
  try { window.ruleEngine = ""; } catch (_) {}
  try { window.ruleEngineMode = "lock"; } catch (_) {}

  setInputEditable(true);

  // 语义不可读 / 覆盖不足的 PDF 不再把混乱文本写进输入框
  lastPdfOriginalText = "";

  const ta = $("inputText");
  if (ta) {
    ta.value = "";
  }

  updateInputWatermarkVisibility();

  setStage3Ui("B");
  setManualPanesForMode("B");
  setManualRailTextByMode();

  requestAnimationFrame(() => {
    expandManualArea();
    expandRiskArea();
    syncManualRiskHeights();
  });
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

    try { window.ruleEngine = ""; } catch (_) {}
    try { window.ruleEngineMode = "lock"; } catch (_) {}
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
      enterModeBFromPdf("");
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
      enterModeBFromPdf("");
      return;
    }

    const rawText = String(probe.text || "").trim();
    const coverageOk = isTextCoverageUsable(rawText, lastPdfPagesText);

    if (!coverageOk) {
      enterModeBFromPdf(rawText);
      return;
    }

    const semanticOk = isSemanticReadingUsable(rawText, lastPdfPagesText);

    if (!semanticOk) {
      enterModeBFromPdf(rawText);
      return;
    }

    lastRunMeta.fromPdf = true;
    setStage3Ui("A");
    setManualPanesForMode("A");
    setManualRailTextByMode();

    let text = filterHeaderFooterText("", lastPdfPagesText);

    if (!text) {
      text = rawText;
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
    enterModeBFromPdf("");
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
