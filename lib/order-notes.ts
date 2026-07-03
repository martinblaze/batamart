const PRIMARY_VARIANT_SEPARATOR = ' | '
const LEGACY_VARIANT_SEPARATOR_RE = /\s*(?:\||\u00b7|\u00c2\u00b7|\/|\u2014|\u2013|-)\s*/u

function splitVariantSummary(summary: string): string[] {
  const normalized = summary.trim()
  if (!normalized) return []
  if (normalized.includes(PRIMARY_VARIANT_SEPARATOR)) {
    return normalized.split(PRIMARY_VARIANT_SEPARATOR).map((part) => part.trim()).filter(Boolean)
  }
  return normalized.split(LEGACY_VARIANT_SEPARATOR_RE).map((part) => part.trim()).filter(Boolean)
}

export function parseVariantNote(orderNote?: string | null): { variantSummary: string; extraNote: string } {
  if (!orderNote) return { variantSummary: '', extraNote: '' }

  const match = orderNote.match(/^\[Order:\s*([^\]]+)\](.*)$/u)
  if (!match) return { variantSummary: '', extraNote: orderNote }

  const variantSummary = match[1]?.trim() || ''
  const suffix = match[2]?.trim() || ''
  const extraNote = suffix.replace(/^(?:\||\u00b7|\u00c2\u00b7|\/|\u2014|\u2013|-)\s*/u, '').trim()

  return { variantSummary, extraNote }
}

export function getVariantChips(orderNote?: string | null): string[] {
  const { variantSummary } = parseVariantNote(orderNote)
  return splitVariantSummary(variantSummary)
}
