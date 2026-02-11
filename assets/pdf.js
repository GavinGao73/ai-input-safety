// Minimal PDF text extractor (client-side)
// NOTE: uses PDF.js from CDN, loaded dynamically.

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  // Load PDF.js from CDN (no backend). You can pin a version later.
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(s);
  });

  // Configure worker
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js";

  return window.pdfjsLib;
}

async function extractTextFromPdfFile(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;

  let full = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(it => (it && it.str) ? it.str : "").filter(Boolean);
    const pageText = strings.join(" ").replace(/\s+/g, " ").trim();
    if (pageText) full += pageText + "\n\n";
  }
  return full.trim();
}

window.extractTextFromPdfFile = extractTextFromPdfFile;
