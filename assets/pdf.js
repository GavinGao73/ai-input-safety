// assets/pdf.js
// PDF text-layer probe (NOT a content export tool)

let __pdfjsPromise = null;

const PDFJS_VERSION = "3.11.174";

// ✅ Base that auto-includes repo name (e.g. /ai-input-safety/)
// Works on both local file server and GitHub Pages project site.
function pdfjsBaseUrl() {
  // current page: https://gavingao73.github.io/ai-input-safety/...
  // we want:       https://gavingao73.github.io/ai-input-safety/pdfjs/3.11.174/
  return new URL(`./pdfjs/${PDFJS_VERSION}/`, window.location.href).toString();
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (__pdfjsPromise) return __pdfjsPromise;

  const base = pdfjsBaseUrl();

  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");

    // ✅ Prefer same-origin pdf.min.js you deployed
    s.src = base + "pdf.min.js";

    s.async = true;
    s.onload = () => resolve(window.pdfjsLib);
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

  const lib = await __pdfjsPromise;

  // ✅ Same-origin worker (no CORS)
  try {
    lib.GlobalWorkerOptions.workerSrc = pdfjsBaseUrl() + "pdf.worker.min.js";
  } catch (_) {}

  return lib;
}

async function probePdfTextLayer(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const base = pdfjsBaseUrl();

  const doc = await pdfjsLib.getDocument({
    data: buf,

    // keep your original safe settings
    disableFontFace: true,
    useSystemFonts: false,

    // ✅ MUST: prevent missing glyphs / CMap errors
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/"
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

  if (totalChars < 20) return { hasTextLayer: false, text: "" };
  return { hasTextLayer: true, text: pages.join("\n\n") };
}

window.probePdfTextLayer = probePdfTextLayer;
