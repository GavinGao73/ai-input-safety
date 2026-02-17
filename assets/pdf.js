// assets/pdf.js
// PDF text-layer probe (NOT a content export tool)

let __pdfjsPromise = null;

// ✅ IMPORTANT (CORS FIX):
// Host these folders on YOUR OWN site (same-origin), e.g. GitHub Pages:
//
// /pdfjs/3.11.174/build/pdf.min.js
// /pdfjs/3.11.174/build/pdf.worker.min.js
// /pdfjs/3.11.174/cmaps/
// /pdfjs/3.11.174/standard_fonts/
const PDFJS_VERSION = "3.11.174";
const PDFJS_ASSET_BASE = `/pdfjs/${PDFJS_VERSION}/`;

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (__pdfjsPromise) return __pdfjsPromise;

  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");

    // ✅ Prefer same-origin build to avoid any CORS / version mismatch
    s.src = PDFJS_ASSET_BASE + "build/pdf.min.js";

    // Fallback to cdnjs only if local file missing
    s.onerror = () => {
      const s2 = document.createElement("script");
      s2.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
      s2.onload = () => resolve(window.pdfjsLib);
      s2.onerror = () => reject(new Error("Failed to load PDF.js (local + CDN both failed)"));
      document.head.appendChild(s2);
    };

    s.onload = () => resolve(window.pdfjsLib);
    document.head.appendChild(s);
  });

  const lib = await __pdfjsPromise;

  // ✅ Prefer same-origin worker to avoid CORS
  try {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_ASSET_BASE + "build/pdf.worker.min.js";
  } catch (_) {}

  // Fallback (only if above fails at runtime you may still see errors in console)
  try {
    if (!lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
    }
  } catch (_) {}

  return lib;
}

async function probePdfTextLayer(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();

  // ✅ Add cMapUrl + standardFontDataUrl to prevent missing glyphs / CMap errors.
  // These MUST be same-origin and contain real files (not empty folders).
  const doc = await pdfjsLib.getDocument({
    data: buf,

    // keep your original settings
    disableFontFace: true,
    useSystemFonts: false,

    // ✅ same-origin assets
    cMapUrl: PDFJS_ASSET_BASE + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: PDFJS_ASSET_BASE + "standard_fonts/"
  }).promise;

  let totalChars = 0;
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false
    });

    const items = content.items || [];

    const pageText = items
      .map(it => (it && it.str ? String(it.str) : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
      totalChars += pageText.length;
    }
  }

  // Very short => treat as no readable text layer
  if (totalChars < 20) {
    return { hasTextLayer: false, text: "" };
  }

  return { hasTextLayer: true, text: pages.join("\n\n") };
}

window.probePdfTextLayer = probePdfTextLayer;
