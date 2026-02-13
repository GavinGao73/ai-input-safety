# Decisions Log

## D1: Product form
- Single-page web tool (PWA-ready), no native app in v1.

## D2: Scope boundary
- Not a chat platform; we do not host conversations.
- We only generate a safer copy before upload.

## D3: No storage by design
- No login, no history, no database.
- Data exists only in-memory in the browser; refresh/close clears.

## D4: No AI calling
- We do not call AI on behalf of users in v1.

## D5: Mobile-first key scenario
- “Paste a piece of material (resume/document summary) before uploading.”

## D6: Metrics (minimal)
- Only anonymous usage signals: page open, key button clicks, optional 👍/👎.
- No content logging, no user identification.

## D7: Threat Model Clarification
Primary risk target is machine / AI / automated extraction,
not human visual inspection.

## D8: Document Safety Strategy
Documents are processed using a Raster Secure Model
to eliminate recoverable text-layer data.

## D9: No OCR by Design
OCR is intentionally excluded to avoid privacy ambiguity,
false positives, and reconstruction errors.

---

## D10: Stage 3 — Raster Secure Export is the only “document-output” model (LOCKED)

### Status
- Accepted / Locked (security invariant)

### Goal (strict)
Before users upload/share a PDF or image with AI/translation/third-party systems,
we prevent sensitive information from being recovered by:
- text layer extraction
- hidden object recovery
- structural parsing of PDF text objects
- vector overlay interpretation

### Decision
All “document exports” MUST be produced as **Raster Secure PDF**:

**Document page → high DPI raster → draw redaction + visual placeholders → rebuild PDF**

Security properties of the exported file:
- MUST NOT contain any PDF text objects
- MUST NOT contain extractable strings
- MUST NOT contain hidden text layers
- MUST NOT preserve original PDF object structure
- MUST NOT use vector overlays as redaction
- MUST NOT use transparency in redaction

### Default security parameters (locked)
- DPI: 600 (fixed)
- Redaction: 100% opaque
- Padding: slight expansion (anti-leak edges)
- Compression: medium (quality > size)

Design rule:
- File size is not a primary concern; recovery resistance is.

### Explicitly forbidden (hard boundary)
- Vector Overlay PDF export
- Keeping / reusing original text layer
- Exporting “searchable PDF”
- Logging hit content / raw text persistence
- Transparent masks

---

## D11: Input mode classification (lightweight, no complex guidance)

### Mode A — Machine-Readable PDF (has text layer)
Trigger:
- `hasTextLayer === true`

User can choose one of two outputs:
1) **Text output** (current tool behavior; placeholders + highlights)
2) **Raster Secure PDF output** (Stage 3 export)

Processing for Raster Secure PDF in Mode A:
- Parse text objects locally (in-memory only)
- Detect sensitive regions via rule engine
- Convert pages to raster
- Draw opaque redaction + visual placeholders on raster
- Rebuild Raster Secure PDF

UX rule:
- No extra wizard; minimal toggle/choice only.

### Mode B — Visual-Only document (no text layer or image)
Trigger:
- `hasTextLayer === false` OR input is an image file

System behavior (one prompt + one action):
- Show a single message:
  “未检测到可解析文本层。本文件被视为图像文档。请手动标记需要遮盖的区域。”
- Provide one entry action:
  [人工处理]

Processing in Mode B:
- Render pages to raster
- User draws rectangles (manual selection)
- (Optional) user selects category (PHONE/EMAIL/…)
- Draw opaque redaction + visual placeholders on raster
- Rebuild Raster Secure PDF (or a raster image export if input is image)

---

## D12: Placeholder policy (raster-only, default English)

Key property:
- Placeholders are **pure pixels**, not text objects in the PDF structure.

Default placeholder set:
- PHONE
- EMAIL
- ADDRESS
- ID
- FINANCIAL DATA
- AMOUNT RANGE (e.g., €1k–€5k)

Language policy for exported document:
- Default placeholders in **English** (lowest font rendering risk).
- UI may be multilingual; export placeholders remain English by default.

---

## D13: Reversibility policy (limited and user-controlled)

Raster Secure exports are **non-reversible by design**.

Allowed “undo/recover” scope:
- Only during the current session (in-memory)
- Only for selected redaction rectangles (remove/adjust/re-draw before export)
- No attempt to reconstruct original pixels/text after export

User assurance:
- The user’s original file always stays local and unchanged.
- If over-redaction happens, user can re-upload or adjust selections before exporting.

---

## D14: Engineering constraints (implementation guardrails)

- No saving raw text, redaction content, or hit logs to localStorage/indexedDB by default.
- No background uploads.
- All processing in browser memory only.
- Export artifacts are produced only on explicit user action.

---

## D15: Ownership of Stage 3 implementation

Primary implementation touchpoints (expected files):
- `pdf.js` — PDF load, detect text layer, render to canvas (raster)
- `app.js` — UI state machine for Mode A/B, action routing (“过滤文字/导出PDF/人工处理”)
- `share.js` — optional: generate share card from metadata only (never raw content)
- `rules.js` — detection rules used for Mode A redaction region generation (not OCR)

