// PDF text-layer probe (NOT a content export tool)
// Purpose:
// - Detect whether PDF contains machine-readable text layer
// - Provide temporary text for in-memory risk detection ONLY
// - Never used for final document output

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  return window.pdfjsLib;
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

    const pageText = items
      .map(it => (it && it.str ? it.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
      totalChars += pageText.length;
    }
  }

  // If almost no text detected → treat as visual-only document
  if (totalChars < 20) {
    return {
      hasTextLayer: false,
      text: ""
    };
  }

  return {
    hasTextLayer: true,
    text: pages.join("\n\n") // in-memory only
  };
}

window.probePdfTextLayer = probePdfTextLayer;
