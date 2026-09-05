/**
 * Which routes suppress the installed app's chrome.
 *
 * Shared by `Navbar` (which renders the bars) and `NavbarWrapper` (which
 * renders the spacer that reserves room for them). Keeping the rule in one
 * place matters: if only one of the two knows a route is full-bleed, you get
 * either a floating bar over the content or a 56px dead strip at the top of
 * the screen.
 *
 * The set mirrors the Flutter client's pushed destinations. Each of these
 * screens carries its own header and its own primary action — a product page
 * has a collapsing photo header and a persistent buy bar — so the tab bar and
 * top bar would be a second and third chrome competing for the same edges.
 */
const DETAIL_PATTERNS: RegExp[] = [
  /^\/product\/[^/]+/,
  /^\/orders\/[^/]+/,
  /^\/seller\/[^/]+/,
  /^\/sellers\/[^/]+/,
  /^\/disputes\/[^/]+/,
]

// `/cart` joins them: it is not a tab, it carries its own header, and its own
// primary action is "Secure checkout" — the same shape as /checkout.
const DETAIL_PREFIXES = ['/cart', '/checkout', '/sell', '/report']

/** True when [pathname] is a pushed detail screen that owns the full viewport. */
export function isDetailRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (DETAIL_PATTERNS.some((pattern) => pattern.test(pathname))) return true
  return DETAIL_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
