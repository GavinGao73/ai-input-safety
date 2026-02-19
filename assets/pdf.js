// assets/pdf.js
// PDF text-layer probe (NOT a content export tool)

let __pdfjsPromise = null;

const PDFJS_VERSION = "3.11.174";

// ✅ Base that auto-includes repo name (e.g. /ai-input-safety/)
// Works on both local file server and GitHub Pages project site.
function pdfjsBaseUrl() {
  // Use baseURI so it works even if location contains query/hash or nested routes
  return new URL(`./pdfjs/${PDFJS_VERSION}/`, document.baseURI || window.location.href).toString();
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
    lib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.js";
  } catch (_) {}

  return lib;
}

/**
 * ✅ Try to preserve readable formatting for copied/pasted PDFs:
 * - group text items into lines by Y (with tolerance)
 * - sort by X inside the line
 * - insert blank lines when line gaps are large (paragraph-ish)
 * Notes:
 * - This is best-effort "pretty" text for UI, NOT a faithful export.
 */
function buildPrettyTextFromPdfItems(items) {
  const rows = [];

  for (const it of (items || [])) {
    const s0 = (it && it.str) ? String(it.str) : "";
    const s = s0.replace(/\s+/g, " ").trim();
    if (!s) continue;

    const tr = it.transform || [];
    const x = Number(tr[4] || 0);
    const y = Number(tr[5] || 0);

    // normalize y (reduce jitter)
    const yKey = Math.round(y * 2) / 2; // 0.5 precision
    rows.push({ s, x, y: yKey });
  }

  if (!rows.length) return "";

  // sort: top->bottom (y desc), left->right (x asc)
  rows.sort((a, b) => (b.y - a.y) || (a.x - b.x));

  // group into lines by y proximity
  const lines = [];
  const Y_EPS = 1.2;

  for (const r of rows) {
    const last = lines[lines.length - 1];
    if (!last || Math.abs(last.y - r.y) > Y_EPS) {
      lines.push({ y: r.y, parts: [{ x: r.x, s: r.s }] });
    } else {
      last.parts.push({ x: r.x, s: r.s });
    }
  }

  // assemble lines
  const out = [];
  let prevY = null;

  for (const ln of lines) {
    ln.parts.sort((a, b) => a.x - b.x);

    let line = "";
    for (const p of ln.parts) {
      const chunk = p.s;
      if (!chunk) continue;

      // smart spacing: avoid adding spaces between CJK chars
      if (line) {
        const a = line[line.length - 1];
        const b = chunk[0];
        const aIsCjk = /[\u4E00-\u9FFF]/.test(a);
        const bIsCjk = /[\u4E00-\u9FFF]/.test(b);

        const needSpace =
          !(aIsCjk || bIsCjk) &&
          !/[\s\-\(\[\{\/]/.test(b) &&
          !/[\s\-\(\[\{\/]/.test(a);

        if (needSpace) line += " ";
      }
      line += chunk;
    }

    // insert paragraph breaks by larger y gap
    if (prevY !== null) {
      const gap = prevY - ln.y; // y desc
      if (gap > 12) out.push("");
    }

    out.push(line.trimEnd());
    prevY = ln.y;
  }

  // collapse excessive blank lines
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function probePdfTextLayer(file) {
  const pdfjsLib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const base = pdfjsBaseUrl();

  const doc = await pdfjsLib.getDocument({
    data: buf,

    // keep your original safe settings
    disableFontFace: false,
    useSystemFonts: true,

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

    // ✅ better formatting than "join(' ')"
    const pageText = buildPrettyTextFromPdfItems(items);

    if (pageText) {
      pages.push(pageText);
      totalChars += pageText.replace(/\s+/g, "").length; // count non-space for reliability
    }
  }

  if (totalChars < 20) return { hasTextLayer: false, text: "" };

  // pages separated by blank line (kept, readable)
  return { hasTextLayer: true, text: pages.join("\n\n") };
}

window.probePdfTextLayer = probePdfTextLayer;
