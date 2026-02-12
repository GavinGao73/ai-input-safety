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
