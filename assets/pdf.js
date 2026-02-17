// assets/pdf.js
// PDF text-layer probe (NOT a content export tool)

let __pdfjsPromise = null;

// ✅ IMPORTANT (CORS FIX):
// Host these folders on YOUR OWN site (same-origin), e.g. GitHub Pages:
// /pdfjs/3.11.174/pdf.min.js
// /pdfjs/3.11.174/pdf.worker.min.js   (or pdf.worker.js if you keep that name)
// /pdfjs/3.11.174/cmaps/
// /pdfjs/3.11.174/standard_fonts/
const PDFJS_VERSION = "3.11.174";
const PDFJS_ASSET_BASE = `/pdfjs/${PDFJS_VERSION}/`;

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (__pdfjsPromise) return __pdfjsPromise;

  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");

    // ✅ use same-origin pdf.min.js (NO build/ folder)
    s.src = PDFJS_ASSET_BASE + "pdf.min.js";

    s.onload = () => resolve(window.pdfjsLib);
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

  const lib = await __pdfjsPromise;

  // ✅ same-origin worker (NO build/ folder)
  try {
    lib.GlobalWorkerOptions.workerSrc = PDFJS_ASSET_BASE + "pdf.worker.min.js";
    // 如果你没改名而仍是 pdf.worker.js，把上一行改为：
    // lib.GlobalWorkerOptions.workerSrc = PDFJS_ASSET_BASE + "pdf.worker.js";
  } catch (_) {}

  return lib;
}

async function probePdfTextLayer(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();

  // ✅ Add cMapUrl + standardFontDataUrl to prevent missing glyphs / CMap errors.
  const doc = await pdfjsLib.getDocument({
    data: buf,

    // keep your original settings
    disableFontFace: true,
    useSystemFonts: false,

    // ✅ must be /cmaps/ (NOT camps)
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

  if (totalChars < 20) {
    return { hasTextLayer: false, text: "" };
  }

  return { hasTextLayer: true, text: pages.join("\n\n") };
}

window.probePdfTextLayer = probePdfTextLayer;
