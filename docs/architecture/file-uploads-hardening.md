# Files / Uploads — Magic-Byte Validation (Shared Core)

## Status change (this sprint)

Per `docs/project/full-product-audit-2026-07-18.md` Part 1 §14 / Part 4: both real upload endpoints (`src/routes/landingConfig.ts`'s hero-image upload, `src/routes/menuGeneration.ts`'s menu-import file) validated file type by client-supplied `mimetype`/filename extension only — both trivially spoofable, since multer's `fileFilter` only sees request metadata, not file content (the buffer isn't populated yet at that point). No virus/malware scanning existed either (still doesn't — out of scope, see below).

## What changed

New `src/lib/fileSignature.ts` — dependency-free magic-byte sniffing (deliberately no new npm package; these are stable, well-known binary signatures for the small set of formats this app actually accepts):
- `isRealImage(buffer)` — JPEG/PNG/GIF/WebP signature check.
- `isRealOfficeDoc(buffer, filename)` — PDF (`%PDF-`) and ZIP-container (xlsx/docx, `PK\x03\x04`) signature check. csv/txt are plain text with no reliable magic bytes, so they pass through unchanged (nothing to sniff) — extension + mimetype remain the only practical check for those, same as before.

Wired into both handlers **after** `upload.single(...)` completes (where `req.file.buffer` first becomes available — this check cannot run inside multer's `fileFilter`, which only sees metadata):
- `landingConfig.ts`: rejects the hero-image upload with 400 if the bytes don't match a real image format.
- `menuGeneration.ts`: rejects the `from-file` menu import with 400 if the bytes don't match what the extension claims (e.g. an executable renamed to `.xlsx`).

## Known limitation (documented, not silently glossed over)

xlsx and docx are both ZIP containers with an identical outer signature — this check confirms "this is really a ZIP archive," not "this is specifically an xlsx vs. a docx." Distinguishing the two precisely would require inspecting the archive's internal `[Content_Types].xml`, which is more than this hardening pass needs to do. The goal is blocking non-office binaries smuggled in with a spoofed extension (the actual attack this closes), not sibling-format precision.

## Still not addressed (flagged, not in scope this sprint)

No virus/malware scanning exists for either endpoint. Adding one would mean picking and paying for a scanning service/library — a cost/vendor decision, not a code-only fix, so it's out of scope for an autonomous sprint per this session's own stop conditions (flagged here for a business decision, not silently dropped).

## Verification

`scripts/controlTestFileSignature.ts` — pure unit test (no DB, no live server): confirms real JPEG/PNG/GIF/WebP/PDF/ZIP signatures are detected, confirms spoofed content (a script payload, a Windows PE executable) is rejected even with a matching claimed type, and confirms extension/content mismatches (exe renamed to `.xlsx`, PDF renamed to `.docx`) are rejected while genuinely matching files and untouched plain-text formats (csv/txt) still pass. 17/17 passing.
