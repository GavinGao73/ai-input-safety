# PDF Pipeline Decisions (DO NOT MODIFY LIGHTLY)

This document records **non-obvious architectural constraints** of the PDF processing / redaction pipeline.
These are **stability-critical decisions**. Changing them casually will break rendering, geometry alignment,
or cause silent data loss.

---

## 1. PDF.js Version Lock

Version: **3.11.174**

Status: HARD LOCK

Reason:

- Rectangle geometry and text-layer alignment were validated against this exact build.
- Later PDF.js versions modify internal transform matrices, font handling, and worker behavior.
- Even minor upgrades can shift glyph positioning → redaction boxes become misaligned.
- Font fallback logic changed across versions → previously working PDFs lose characters.

Rule:

- DO NOT upgrade PDF.js unless performing a full regression test of:
  - text extraction
  - bounding box coordinates
  - raster export
  - font rendering
  - multi-language PDFs (DE + ZH)

---

## 2. Deployment Model (Same-Origin Requirement)

PDF.js assets MUST be hosted **same-origin**.

Valid:

    ./pdfjs/3.11.174/

Invalid:

    https://cdnjs.cloudflare.com/...
    https://unpkg.com/...

Reason:

- Workers are subject to strict cross-origin restrictions.
- CMap loading fails under CORS → missing glyphs / invisible characters.
- Standard font loading silently fails → tables appear empty.
- Fake worker fallback causes severe performance and rendering inconsistencies.

Rule:

- Worker, cmaps, and standard_fonts must be served from the same domain as the app.
- Never rely on third-party CDN for production pipeline.

---

## 3. Required PDF.js Asset Structure

The following structure is REQUIRED:

    /pdfjs/3.11.174/pdf.min.js
    /pdfjs/3.11.174/pdf.worker.min.js
    /pdfjs/3.11.174/cmaps/
    /pdfjs/3.11.174/standard_fonts/

Notes:

- `cmaps/` must contain ALL bcmap files from the official distribution.
- `standard_fonts/` must contain ALL font files (ttf / pfb / etc).
- Empty folders are INVALID and will cause rendering corruption.

Failure Symptoms When Missing:

- Chinese text disappears
- Tables partially blank
- Massive console warnings
- Redaction rectangles drift

---

## 4. Base URL Resolution (GitHub Pages Safe)

Base URL MUST be computed dynamically.

Correct:

```js
function pdfjsBaseUrl() {
  return new URL(`./pdfjs/3.11.174/`, window.location.href).toString();
}
````

Incorrect:

```js
const base = "/pdfjs/3.11.174/";
const base = "https://gavingao73.github.io/pdfjs/3.11.174/";
```

Reason:

* GitHub Pages project sites include repo name in path.
* Hardcoded roots break when:

  * repo renamed
  * local testing
  * subdirectory deployment

Rule:

* NEVER hardcode absolute paths.

---

## 5. Worker Configuration

Worker MUST be same-origin.

Correct:

```js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfjsBaseUrl() + "pdf.worker.min.js";
```

Reason:

* Cross-origin worker = failure / fake worker fallback.
* Fake worker = unpredictable performance & warnings.

---

## 6. CMap & Font Configuration (Critical)

Always supply BOTH:

```js
cMapUrl: base + "cmaps/",
cMapPacked: true,
standardFontDataUrl: base + "standard_fonts/"
```

Reason:

Without these:

* Asian fonts fail
* Glyph mapping breaks
* Characters silently skipped
* Rendering appears correct but text extraction wrong

---

## 7. Font Handling Strategy

Current Stable Configuration:

```js
disableFontFace: true,
useSystemFonts: false
```

Reason:

* Prevent browser font injection variability.
* Avoid OS-dependent rendering differences.
* Ensure deterministic rasterization.

DO NOT:

* Toggle randomly while debugging visual issues.
* Enable system fonts to "fix missing text".

This masks root problems and destabilizes geometry.

---

## 8. Interpretation of Common Console Warnings

### STSongStd-Light Warning

Example:

```
Warning: Cannot load system font: STSongStd-Light
```

Meaning:

* Informational, NOT fatal.
* Does not imply rendering failure.

Action:

* Ignore if text is visible and extraction correct.

---

### getPathGenerator / ignoring character

Meaning:

* Font program resolution timing issue.
* Typically harmless if output visually correct.

Action:

* Ignore unless characters visibly missing.

---

## 9. Redaction Geometry Invariants

Redaction rectangles depend on:

* text-layer coordinates
* viewport transforms
* version-specific glyph metrics

Implication:

* PDF.js upgrade = geometry regression test REQUIRED.
* Visual correctness alone is insufficient.

Must validate:

✔ Mask placement
✔ Multi-line text
✔ Table cells
✔ Rotated text
✔ Mixed fonts

---

## 10. Regression Testing Rules

Any change to:

* PDF.js version
* Worker configuration
* Font settings
* CMap handling
* Viewport scaling logic

REQUIRES:

1. Load multi-language PDF
2. Verify text extraction length
3. Verify rectangle alignment
4. Verify raster export fidelity

---

## 11. Encoding Rules (Repository-Wide)

ALL files MUST be UTF-8.

Applies to:

* js
* md
* json
* test fixtures

Reason:

* Regex matching depends on Unicode stability.
* Cross-language text otherwise corrupts.

Failure Symptoms:

* Garbled characters
* Incorrect matching
* Invisible text bugs

---

## FINAL RULE

If something appears visually wrong:

❌ DO NOT immediately tweak PDF.js flags
❌ DO NOT upgrade libraries blindly
❌ DO NOT assume fonts are "just warnings"

First verify:

✔ Asset paths
✔ Same-origin loading
✔ cmaps presence
✔ standard_fonts presence

Most pipeline failures originate from deployment, not logic.

---

```

