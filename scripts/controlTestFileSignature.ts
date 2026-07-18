/**
 * Unit test for src/lib/fileSignature.ts — magic-byte validation added so
 * upload endpoints (landingConfig.ts, menuGeneration.ts) no longer trust
 * the client-supplied mimetype/extension alone. Pure functions, no DB.
 *
 * Run: npx ts-node --transpile-only scripts/controlTestFileSignature.ts
 */
import { detectImageKind, isRealImage, detectDocKind, isRealOfficeDoc } from '../src/lib/fileSignature'

let passed = 0, failed = 0
function ok(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅  ${label}`); passed++ }
  else      { console.log(`  ❌  ${label}`); failed++ }
}

console.log('\n1. Real image signatures are detected correctly')
ok(detectImageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])) === 'jpeg', 'JPEG signature detected')
ok(detectImageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])) === 'png', 'PNG signature detected')
ok(detectImageKind(Buffer.from('GIF89a', 'ascii')) === 'gif', 'GIF signature detected')
ok(detectImageKind(Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP', 'ascii')])) === 'webp', 'WebP (RIFF/WEBP) signature detected')

console.log('\n2. Spoofed files (wrong content, claims to be an image) are rejected')
ok(isRealImage(Buffer.from('<script>alert(1)</script>', 'ascii')) === false, 'a text/script payload with an image mimetype header is NOT accepted as a real image')
ok(isRealImage(Buffer.from([0x4d, 0x5a, 0x90, 0x00])) === false, 'a Windows PE executable (MZ header) is NOT accepted as a real image')
ok(isRealImage(Buffer.alloc(0)) === false, 'an empty buffer is not a real image')

console.log('\n3. Real office-doc signatures are detected correctly')
ok(detectDocKind(Buffer.from('%PDF-1.4', 'ascii')) === 'pdf', 'PDF signature detected')
ok(detectDocKind(Buffer.from([0x50, 0x4b, 0x03, 0x04])) === 'zip', 'ZIP (xlsx/docx container) signature detected')
ok(isRealOfficeDoc(Buffer.from('%PDF-1.4', 'ascii'), 'menu.pdf') === true, 'a real PDF passes the .pdf extension check')
ok(isRealOfficeDoc(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'menu.xlsx') === true, 'a real ZIP container passes the .xlsx extension check')
ok(isRealOfficeDoc(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'menu.docx') === true, 'a real ZIP container passes the .docx extension check')

console.log('\n4. Extension/content mismatch is rejected')
ok(isRealOfficeDoc(Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'menu.xlsx') === false, 'a Windows executable renamed to .xlsx is rejected')
ok(isRealOfficeDoc(Buffer.from('%PDF-1.4', 'ascii'), 'menu.docx') === false, 'a real PDF renamed to .docx is rejected (wrong container)')
ok(isRealOfficeDoc(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'menu.pdf') === false, 'a real ZIP renamed to .pdf is rejected')

console.log('\n5. Plain-text formats (no reliable magic bytes) are allowed through unchanged')
ok(isRealOfficeDoc(Buffer.from('col1,col2\nval1,val2', 'ascii'), 'menu.csv') === true, 'csv content is not content-sniffed (nothing reliable to check)')
ok(isRealOfficeDoc(Buffer.from('some plain text', 'ascii'), 'menu.txt') === true, 'txt content is not content-sniffed (nothing reliable to check)')

console.log(`\n${passed} passed, ${failed} failed`)
console.log(failed === 0 ? 'UNIT TEST: PASS' : 'UNIT TEST: FAIL')
if (failed > 0) process.exit(1)
