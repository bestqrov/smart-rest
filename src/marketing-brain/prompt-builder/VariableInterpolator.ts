/**
 * Template variable interpolation.
 *
 * Variables use the {{key}} syntax (double curly braces, word chars only).
 * Interpolation is a single-pass string replace — no nested or computed variables.
 *
 * All functions are pure: no side effects, no DB access.
 */

// Matches {{key}} where key is one or more word characters (\w = [a-zA-Z0-9_])
const VAR_RE = /\{\{(\w+)\}\}/g

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Replace all {{key}} occurrences with their value from `variables`.
 * Keys with no matching value are left as-is (still `{{key}}`).
 *
 * Call `findUnresolved()` on the output to detect and reject unresolved keys.
 *
 * @param template  The raw template body string.
 * @param variables Map of key → resolved value.
 * @returns         Interpolated string.
 */
export function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(VAR_RE, (_match, key: string) => variables[key] ?? _match)
}

/**
 * Extract every unique {{key}} that appears in the template string.
 * Result is sorted for deterministic output.
 */
export function extractKeys(template: string): string[] {
  const keys = new Set<string>()
  // Reset lastIndex before iterating — VAR_RE has the /g flag
  VAR_RE.lastIndex = 0
  for (const m of template.matchAll(VAR_RE)) {
    keys.add(m[1]!)
  }
  return [...keys].sort()
}

/**
 * Find every {{key}} that remains unresolved after interpolation.
 * An unresolved key means the variables map had no value for it.
 *
 * Returns a sorted, deduplicated list of the missing key names.
 *
 * Example:
 *   findUnresolved("Hello {{ownerName}}, your trial {{trialLink}} expired")
 *   // with variables = { ownerName: "Hassan" }
 *   // → ["trialLink"]
 */
export function findUnresolved(interpolated: string): string[] {
  return extractKeys(interpolated)
}

/**
 * Format the resolved variables as a human-readable list for inclusion in the user prompt.
 * Sorted by key for deterministic output.
 *
 * Example output:
 *   {{cafeName}} → "Café Atlas"
 *   {{ownerName}} → "Hassan"
 */
export function formatVariableList(variables: Record<string, string>): string {
  return Object.keys(variables)
    .sort()
    .map(k => `  {{${k}}} → "${variables[k]}"`)
    .join('\n')
}
