// PDF text-layer probe (NOT a content export tool)

let __pdfjsPromise = null;

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  if (__pdfjsPromise) return __pdfjsPromise;

  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => resolve(window.pdfjsLib);
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

  const lib = await __pdfjsPromise;

  lib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  return lib;
}

async function probePdfTextLayer(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();

  const doc = await pdfjsLib.getDocument({
    data: buf,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  let totalChars = 0;
  const pages = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const items = content.items || [];

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
