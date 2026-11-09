// Small client-safe formatters shared by the buyer-side ticket pages.

export const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos',
  })
}

export function formatDay(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  return {
    day: d.toLocaleString('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' }),
    month: d.toLocaleString('en-NG', { month: 'short', timeZone: 'Africa/Lagos' }),
  }
}

/** True once an event has finished (no end time: 12 hours after it starts). */
export function eventIsOver(startsAt: string, endsAt: string | null): boolean {
  const end = endsAt ? new Date(endsAt).getTime() : new Date(startsAt).getTime() + 12 * 3_600_000
  return Date.now() > end
}
