// Robust PDF text extractor (client-side) for "Word-exported PDFs"
// - groups text items by line (y coordinate), keeps reading order
// - works better with tables/textboxes where items are fragmented
// - no OCR

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(s);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js";

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

    // join with space, but avoid inserting spaces inside words too aggressively
    let line = "";
    for (const p of parts) {
      const s = String(p.str);

      // If last char is hyphen, join without space (hyphenation)
      if (line.endsWith("-")) {
        line = line.slice(0, -1) + s;
        continue;
      }

      // If line empty, set; else add space if needed
      if (!line) {
        line = s;
      } else {
        const last = line.slice(-1);
        const first = s.slice(0, 1);

        // Add a space unless punctuation/spacing suggests otherwise
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

  // Because we sorted by y desc, this is already top->bottom.
  // But some PDFs have inverted y; if output looks reversed, we'll detect later.
  return outLines;
}

async function extractTextFromPdfFile(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();

  const doc = await pdfjsLib.getDocument({
    data: buf,
    // Some PDFs need these flags; they can improve extraction stability
    disableFontFace: true,
    useSystemFonts: true,
  }).promise;

  let fullText = [];
  let totalChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);

    // include marked content can help for tagged PDFs, but pdf.js handles internally.
    const content = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const lines = groupItemsIntoLines(content.items || []);

    // Fallback: if line grouping yields too little, fall back to raw join
    let pageText = lines.join("\n");
    const rawJoin = (content.items || [])
      .map(it => (it && it.str ? it.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText.replace(/\s/g, "").length < 20 && rawJoin.replace(/\s/g, "").length > pageText.replace(/\s/g, "").length) {
      pageText = rawJoin;
    }

    pageText = pageText.trim();
    if (pageText) {
      fullText.push(pageText);
      totalChars += pageText.length;
    } else {
      // keep page separator even if empty? no, skip to reduce noise
    }
  }

  // If extraction produced almost nothing, return empty
  if (totalChars < 10) return "";

  // Join pages with blank line
  return fullText.join("\n\n");
}

window.extractTextFromPdfFile = extractTextFromPdfFile;
