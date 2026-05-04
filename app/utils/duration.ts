// Format an integer minutes value as "H:MM" for display. Pipeline export
// will use this same shape to preserve the legacy CSV column format.
export function formatMinutes(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total) || total < 0) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')}`
}
