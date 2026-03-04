// =========================
// assets/stage3.js (FULL)
// v20260223-lang-split-stable-a3 (PATCHED: guard-respect + detectLang bridge)
//
// ✅ Mode A (readable PDF):
// - detect from RAW pdf text (content strategy), then LOCK for session (ruleEngine/ruleEngineMode)
// - applyRules only AFTER language is ensured (if guard exists)
//
// ✅ Mode B (image / unreadable):
// - keep AUTO (no lock)
//
// NOTE (de-couple / single-source-of-truth):
// - DO NOT touch legacy contentLang/contentLangMode here.
// - Stage3 only controls ruleEngine/ruleEngineMode (content strategy language).
// =========================

// ✅ NEW: keep raw per-page text items (for Mode A export rect mapping later)
// NOTE: must keep window pointer in sync whenever we re-assign array
let lastPdfPagesItems = [];

// ================= Stage 3 helpers =================
function setRuleEngineAuto() {
  try { window.ruleEngineMode = "auto"; } catch (_) {}
}

function lockRuleEngineForSession(lang) {
  const l = String(lang || "").toLowerCase();
  if (!(l === "zh" || l === "de" || l === "en")) return;
  try { window.ruleEngine = l; } catch (_) {}
  try { window.ruleEngineMode = "lock"; } catch (_) {}
}

function detectRuleEngineFromRaw(text) {
  const s = String(text || "");

  // Prefer centralized detector if present (use detectLang, not detectRuleEngine)
  try {
    if (window.__LangDetect && typeof window.__LangDetect.detectLang === "function") {
      const r = window.__LangDetect.detectLang(s, window.currentLang || "en");

      // Only lock when it's a stable decision (no confirm needed + confidence high enough)
      if (r && typeof r.lang === "string" && r.lang) {
        if (r.needsConfirm === false && (typeof r.confidence !== "number" || r.confidence >= 0.78)) {
          return r.lang;
        }
      }
      return "";
    }
  } catch (_) {}

  // Fallback: pack-level "detect" heuristics (best-effort; no scoring here)
  try {
    const packs = window.__ENGINE_LANG_PACKS__ || {};
    const order = ["de", "en", "zh"]; // bias de/en because you said they are the confusing pair
    for (const k of order) {
      const p = packs[k];
      if (p && typeof p.detect === "function") {
        const hit = p.detect(s);
        if (hit === k) return k;
      }
    }
  } catch (_) {}

  return "";
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

// ================= Stage 3 file handler =================
async function handleFile(file) {
  if (!file) return;

  lastUploadedFile = file;
  lastProbe = null;
  lastPdfOriginalText = "";

  // ✅ reset every upload
  lastPdfPagesItems = [];
  try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
  try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

  lastFileKind =
    file.type === "application/pdf" ? "pdf" :
    (file.type && file.type.startsWith("image/") ? "image" : "");

  __manualRedactSession = null;
  __manualRedactResult = null;
  try { window.__manual_redact_last = null; } catch (_) {}

  setStage3Ui("none");

  if (lastFileKind === "image") {
    lastRunMeta.fromPdf = false;

    // ✅ Mode B: do NOT lock ruleEngine (keep auto)
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

    // ✅ IMPORTANT: keep window pointers synced (because we re-assigned array)
    try { window.lastPdfPagesItems = lastPdfPagesItems; } catch (_) {}
    try { window.__pdf_pages_items = lastPdfPagesItems; } catch (_) {}

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

    // ✅ Detect content-strategy language from RAW pdf text then LOCK (session stability)
    // (Only if we can actually detect a valid lang; otherwise keep auto.)
    try {
      const detected = detectRuleEngineFromRaw(text);
      if (detected) lockRuleEngineForSession(detected);
      else setRuleEngineAuto();
    } catch (_) {
      setRuleEngineAuto();
    }

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      ta.readOnly = false;
    }

    updateInputWatermarkVisibility();

    if (text) {
      // ✅ apply with guard if available (prevents bypass + allows modal confirm)
      await applyRulesSafely(text);

      // overlay for Mode A pdf mapping (if present)
      try { if (typeof window.renderInputOverlayForPdf === "function") window.renderInputOverlayForPdf(text); } catch (_) {}
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
