// Robust PDF text extractor (client-side) for "Word-exported PDFs"
// - loads PDF.js from cdnjs (stable pinned version 3.11.174)
// - groups text items by line (y coordinate), keeps reading order
// - works better with tables/textboxes where items are fragmented
// - no OCR

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    // ✅ stable version on cdnjs
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(s);
  });

  // Configure worker (must match version)
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  return window.pdfjsLib;
}

// Heuristic: group by "line" using rounded y coordinate
function groupItemsIntoLines(items) {
  const lines = new Map(); // yKey -> array of {x, str}

  for (const it of items) {
    if (!it || !it.str) continue;

    // transform: [a,b,c,d,e,f] => e=x, f=y
    const t = it.transform;
    const x = t && typeof t[4] === "number" ? t[4] : 0;
    const y = t && typeof t[5] === "number" ? t[5] : 0;

    // Word PDFs often have close y values; rounding helps clustering
    const yKey = Math.round(y * 2) / 2; // 0.5 precision

    if (!lines.has(yKey)) lines.set(yKey, []);
    lines.get(yKey).push({ x, str: it.str });
  }

  // Sort lines top->bottom (higher y first), then x left->right
  const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);

  const outLines = [];
  for (const y of sortedY) {
    const parts = lines.get(y).sort((a, b) => a.x - b.x);

    // Join with smart spacing
    let line = "";
    for (const p of parts) {
      const s = String(p.str);

      // Hyphenation join
      if (line.endsWith("-")) {
        line = line.slice(0, -1) + s;
        continue;
      }

      if (!line) {
        line = s;
      } else {
        const last = line.slice(-1);
        const first = s.slice(0, 1);

        const needSpace =
          !/\s/.test(last) &&
          !/[\(\[\{\/“"„'’\-–—]$/.test(last) &&
          !/^[\)\]\}\.,;:!?\/”"„'’]/.test(first);

        line += (needSpace ? " " : "") + s;
      }
    }

    line = line.replace(/\s+/g, " ").trim();
    if (line) outLines.push(line);
  }

  return outLines;
}

async function extractTextFromPdfFile(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();

  const doc = await pdfjsLib.getDocument({
    data: buf,
    // These flags can improve extraction stability for some PDFs
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  const pages = [];
  let totalChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const items = content.items || [];
    const lines = groupItemsIntoLines(items);

    // Primary: line-based
    let pageText = lines.join("\n").trim();

    // Fallback: raw join if line-based yields too little
    const rawJoin = items
      .map(it => (it && it.str ? it.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const compactLen = (s) => String(s || "").replace(/\s/g, "").length;

    if (compactLen(pageText) < 20 && compactLen(rawJoin) > compactLen(pageText)) {
      pageText = rawJoin;
    }

    pageText = String(pageText || "").trim();
    if (pageText) {
      pages.push(pageText);
      totalChars += pageText.length;
    }
  }

  // If extraction produced almost nothing, treat as failure
  if (totalChars < 10) return "";

  return pages.join("\n\n");
}

window.extractTextFromPdfFile = extractTextFromPdfFile;
