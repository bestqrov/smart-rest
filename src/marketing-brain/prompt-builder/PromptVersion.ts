/**
 * Deterministic content fingerprinting for assembled prompts.
 *
 * Design:
 *   - Schema version prefix ("v1-") identifies the PromptBuilder generation algorithm.
 *     If the system prompt structure changes in a future sprint, bump to "v2-".
 *   - Content hash: djb2 over concatenated systemPrompt + NUL + userPrompt.
 *     Same content → same hash. Different content → (almost certainly) different hash.
 *   - No timestamp, no randomness. Pure function of content.
 *
 * When to bump the schema prefix:
 *   - When the section headings, ordering, or structural grammar of generated
 *     prompts change (content format change, not data change).
 *   - Do NOT bump when knowledge or rule content changes — the hash handles that.
 */

const SCHEMA_VERSION = 'v1'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic version string for a built prompt.
 *
 * @param systemPrompt  The assembled system prompt string.
 * @param userPrompt    The assembled user prompt string.
 * @returns             Format: `v1-<8-char lowercase hex>` e.g. `v1-4f2a9c1e`
 */
export function generateVersion(systemPrompt: string, userPrompt: string): string {
  const combined = `${systemPrompt}\x00${userPrompt}`
  const hash     = djb2(combined)
  return `${SCHEMA_VERSION}-${hash.toString(16).padStart(8, '0')}`
}

/**
 * Check whether two version strings share the same schema version.
 * Useful for detecting whether a cached prompt was built with a stale builder.
 */
export function isSameSchema(versionA: string, versionB: string): boolean {
  return schemaOf(versionA) === schemaOf(versionB)
}

export function schemaOf(version: string): string {
  return version.split('-')[0] ?? ''
}

// ─── Hash implementation ──────────────────────────────────────────────────────

/**
 * djb2 hash — fast, simple, deterministic 32-bit hash.
 * Not cryptographic. Used only for change-detection fingerprinting.
 *
 * Result is converted to unsigned 32-bit to avoid negative hex strings.
 */
function djb2(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    // h = (h << 5) + h + charCode  =  h * 33 + charCode
    h = Math.imul(h, 33) ^ s.charCodeAt(i)
  }
  // >>> 0 converts to unsigned 32-bit integer
  return h >>> 0
}
