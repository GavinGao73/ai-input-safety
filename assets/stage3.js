// =========================
// assets/stage3.js (FULL)
// v20260223-lang-split-stable-a2
// ✅ Mode A (readable PDF): detect from RAW pdf text, then LOCK for session
// ✅ Mode B (image / unreadable): keep auto (no lock)
// =========================

// ✅ NEW: keep raw per-page text items (for Mode A export rect mapping later)
// NOTE: must keep window pointer in sync whenever we re-assign array
let lastPdfPagesItems = [];

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

  lastFileKind = (file.type === "application/pdf") ? "pdf"
              : (file.type && file.type.startsWith("image/") ? "image" : "");

  __manualRedactSession = null;
  __manualRedactResult = null;
  try { window.__manual_redact_last = null; } catch (_) {}

  setStage3Ui("none");

  if (lastFileKind === "image") {
    lastRunMeta.fromPdf = false;

    // ✅ Mode B: do NOT lock contentLang (keep auto)
    try { window.contentLangMode = "auto"; } catch (_) {}

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
      try { window.contentLangMode = "auto"; } catch (_) {}

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

    // ✅ NEW: cache raw per-page items (even if unreadable, it'll be [])
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
      try { window.contentLangMode = "auto"; } catch (_) {}

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

    // ✅ Detect contentLang from RAW pdf text then LOCK (session stability)
    try {
      if (typeof setLangContentAutoFromRaw === "function") setLangContentAutoFromRaw(text);
      if (typeof lockContentLangForSession === "function") lockContentLangForSession(window.contentLang || "");
    } catch (_) {}

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      ta.readOnly = false;
    }

    updateInputWatermarkVisibility();

    if (text) {
      applyRules(text);
      renderInputOverlayForPdf(text);
    }

    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualRiskHeights();
    });

    window.dispatchEvent(new Event("safe:updated"));
  } catch (e) {
    lastRunMeta.fromPdf = false;

    // ✅ Failure => Mode B; do NOT lock
    try { window.contentLangMode = "auto"; } catch (_) {}

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
