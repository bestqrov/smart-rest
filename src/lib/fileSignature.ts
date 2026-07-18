// ─── File Signature (Magic Byte) Validation ─────────────────────────────────
// multer's fileFilter only sees client-supplied metadata (mimetype,
// originalname) — both trivially spoofable, and the file content isn't
// buffered yet at that point. Real content validation has to happen after
// the upload completes, by inspecting the actual bytes. Deliberately no new
// dependency (no `file-type` package) — these are well-known, stable binary
// signatures for the small set of formats this app actually accepts.

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp'
export type DocKind = 'pdf' | 'zip' // zip covers xlsx/docx — both are ZIP containers

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false
  return bytes.every((b, i) => buf[offset + i] === b)
}

export function detectImageKind(buf: Buffer): ImageKind | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'gif' // GIF8[7|9]a
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp' // RIFF....WEBP
  return null
}

export function isRealImage(buf: Buffer): boolean {
  return detectImageKind(buf) !== null
}

export function detectDocKind(buf: Buffer): DocKind | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf' // "%PDF-"
  // ZIP local-file-header signature (also covers the empty-archive variant) —
  // xlsx/docx are both ZIP containers; distinguishing between the two would
  // require inspecting the archive's internal [Content_Types].xml, which is
  // more than this check needs to do — the goal is rejecting non-office
  // binaries smuggled in with a spoofed extension, not sibling-format precision.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) || startsWith(buf, [0x50, 0x4b, 0x07, 0x08])) return 'zip'
  return null
}

// csv/txt are plain text with no reliable magic bytes — nothing to sniff;
// extension + mimetype remain the only practical check for those, same as
// before this change.
export function isRealOfficeDoc(buf: Buffer, ext: string): boolean {
  const kind = detectDocKind(buf)
  if (/\.(csv|txt)$/i.test(ext)) return true // no binary signature to check
  if (/\.pdf$/i.test(ext)) return kind === 'pdf'
  if (/\.(xlsx|xls|docx)$/i.test(ext)) return kind === 'zip'
  return false
}
