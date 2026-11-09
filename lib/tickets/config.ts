// lib/tickets/config.ts
// Every number the ticketing system depends on, in one place.

/** BataMart's cut of every ticket price. There is no delivery, so it is flat. */
export const PLATFORM_FEE_PCT = 10

/** Most a host may promise a reseller, as a percent of the ticket price. */
export const MAX_COMMISSION_PCT = 30

export const MAX_QTY_PER_PURCHASE = 10
export const MIN_TICKET_PRICE = 100
export const MAX_TICKET_PRICE = 500_000
export const MAX_TIERS_PER_EVENT = 10
export const MAX_CHECKERS_PER_EVENT = 30
export const MAX_UNIQUE_SELLERS_PER_EVENT = 100

/** A started-but-unpaid purchase holds its tickets for this long. */
export const PENDING_HOLD_MINUTES = 20

/** The QR text changes every QR_STEP_SECONDS. */
export const QR_STEP_SECONDS = 30
/** How many steps in the past / future the door scanner still accepts (clock drift, slow scans). */
export const QR_PAST_STEPS = 2
export const QR_FUTURE_STEPS = 1

/** Checker sign-in lasts a long door shift, then they use their link again. */
export const CHECKER_SESSION_HOURS = 18

/** Tickets can be sold until this long after the event starts. */
export const SALES_GRACE_HOURS_AFTER_START = 3

/** When selling stops: the host's end time if they gave one, otherwise a few hours after the start. */
export const salesCloseAt = (startsAt: Date, endsAt?: Date | null): number =>
  endsAt ? Math.max(endsAt.getTime(), startsAt.getTime()) : startsAt.getTime() + SALES_GRACE_HOURS_AFTER_START * 3_600_000

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')

/** The wallet reference prefix used for every ticket money movement. */
export const TICKET_REF_PREFIX = 'TKT'
