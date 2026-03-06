// =========================
// assets/stage3.js (FULL)
// v20260307a1 — PATCHED (cache pagesText for export matcher-core)
//
// ✅ Mode A (readable PDF):
// - detect from RAW pdf text (content strategy), then LOCK for session (ruleEngine/ruleEngineMode)
// - applyRules only AFTER language is ensured (if guard exists)
// - ✅ cache pagesItems + pagesText for export-stage matcher-core/page mapping
//
// ✅ Mode B (image / unreadable):
// - keep AUTO (no lock)
//
// NOTE (de-couple / single-source-of-truth):
// - DO NOT touch legacy contentLang/contentLangMode here.
// - Stage3 only controls ruleEngine/ruleEngineMode (content strategy language).
// =========================

// ✅ keep raw per-page text items (for Mode A export rect mapping later)
// NOTE: must keep window pointer in sync whenever we re-assign array
let lastPdfPagesItems = [];

// ✅ NEW: keep pretty per-page text (for export matcher-core; preserves page boundaries)
let lastPdfPagesText = [];

// ================= Stage 3 helpers =================
function resetRuleEngineForNewSession() {
  // ✅ upload/new file == new session
  try { window.ruleEngine = ""; } catch (_) {}
  try { window.ruleEngineMode = "auto"; } catch (_) {}
}

// Backward name (kept)
function setRuleEngineAuto() {
  // legacy compatibility: DO NOTHING
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

  // If main.js provides a guard, prefer it (prevents bypass + ensures modal path)
  try {
    if (typeof window.ensureLangBeforeApply === "function") {
      const r = window.ensureLangBeforeApply(s);

      // ✅ IMPORTANT: guard returns false when modal is opening/open => STOP this run
      if (r === false) return;

      // tolerate async guard (future-proof)
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

  // Fallback: direct applyRules
  try {
    if (typeof window.applyRules === "function") window.applyRules(s);
  } catch (_) {}
}

// ✅ ensure content language for Mode A RAW pdf text
// - Use centralized __LangDetect.ensureContentLang so "uncertain => modal"
// - Do NOT implement detect/threshold logic here.
function ensureLangForPdfRaw(text) {
  const s = String(text || "").trim();
  if (!s) return { ok: true, asked: false };

  try {
    if (window.__LangDetect && typeof window.__LangDetect.ensureContentLang === "function") {
      // This will lock when confident, or open modal when uncertain.
      const r = window.__LangDetect.ensureContentLang(s, window.currentLang || "en");
      return r || { ok: true, asked: false };
    }
  } catch (_) {}

  // If detector missing, remain auto (do not guess)
  return { ok: true, asked: false };
}

// ================= Stage 3 file handler =================
async function handleFile(file) {
  if (!file) return;

  lastUploadedFile = file;
  lastProbe = null;
  lastPdfOriginalText = "";

  // ✅ reset every upload (new session semantics)
  resetRuleEngineForNewSession();

  // ✅ reset every upload
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

    // ✅ Mode B: do NOT lock ruleEngine (keep auto+empty)
    setRuleEngineAuto();

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

  if (lastFileKind !== "pdf") return;

  try {
    if (!window.probePdfTextLayer) {
      lastRunMeta.fromPdf = false;

      // ✅ No probe => treat as Mode B; do NOT lock
      setRuleEngineAuto();

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

    // ✅ cache raw per-page items (even if unreadable, it'll be [])
    try {
      lastPdfPagesItems = (probe && Array.isArray(probe.pagesItems)) ? probe.pagesItems : [];
    } catch (_) {
      lastPdfPagesItems = [];
    }

    // ✅ cache pretty per-page text (for export matcher-core)
    try {
      lastPdfPagesText = (probe && Array.isArray(probe.pagesText)) ? probe.pagesText : [];
    } catch (_) {
      lastPdfPagesText = [];
    }

    // ✅ IMPORTANT: keep window pointers synced (because we re-assigned arrays)
    try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
    try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

    try { window.lastPdfPagesText = lastPdfPagesText; } catch (_) {}
    try { window.__pdf_pages_text = lastPdfPagesText; } catch (_) {}

    if (!probe || !probe.hasTextLayer) {
      lastRunMeta.fromPdf = false;

      // ✅ Unreadable => Mode B; do NOT lock
      setRuleEngineAuto();

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

    // ✅ Readable PDF => Mode A
    lastRunMeta.fromPdf = true;
    setStage3Ui("A");
    setManualPanesForMode("A");
    setManualRailTextByMode();

    const text = String(probe.text || "").trim();
    lastPdfOriginalText = text;

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      ta.readOnly = false;
    }

    updateInputWatermarkVisibility();

    if (text) {
      // ✅ Mode A: ensure language (lock or modal) BEFORE applyRules
      const ensured = ensureLangForPdfRaw(text);

      // If modal opened, STOP here (user will pick and rerun via modal callback chain)
      if (ensured && ensured.ok === false) {
        // keep overlay ready for readability; no applyRules now
        try {
          if (typeof window.renderInputOverlayForPdf === "function") {
            window.renderInputOverlayForPdf(text);
          }
        } catch (_) {}
      } else {
        // ✅ apply with guard if available (prevents bypass + allows modal confirm)
        await applyRulesSafely(text);

        // overlay for Mode A pdf mapping (if present)
        try {
          if (typeof window.renderInputOverlayForPdf === "function") {
            window.renderInputOverlayForPdf(text);
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

    // ✅ Failure => Mode B; do NOT lock
    setRuleEngineAuto();

    // reset caches on failure too
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
  // ✅ Single input on mobile/desktop (m.html uses only #pdfFile)
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

  // keep backward-compat safety (if some page still has #imgFile, it won't break)
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

/* =========================
   EXPORTS (critical for modal rerun chain + load-order safety)
   ========================= */
try {
  if (typeof window.applyRulesSafely !== "function") window.applyRulesSafely = applyRulesSafely;
} catch (_) {}

try {
  if (typeof window.handleFile !== "function") window.handleFile = handleFile;
} catch (_) {}

try {
  if (typeof window.bindPdfUI !== "function") window.bindPdfUI = bindPdfUI;
} catch (_) {}
