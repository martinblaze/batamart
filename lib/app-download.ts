/**
 * Android app distribution, and why the PWA is no longer installable.
 *
 * Suppressing `beforeinstallprompt` is not enough on its own. That event only
 * controls Chrome's *automatic* mini-infobar; the ⋮ menu → "Install app" entry
 * is driven purely by the manifest and cannot be cancelled from JavaScript. So
 * anyone who installed the way most people actually do — from Chrome's own
 * menu — still got the PWA, which is exactly the bug this was meant to fix.
 *
 * Both manifests therefore set `prefer_related_applications: true`. Per the
 * spec note: "For Chromium-based browsers, prefer_related_applications should
 * be set to false or omitted to make your web app installable." Setting it true
 * makes the web app fail Chromium's installability check, so Chrome stops
 * offering it anywhere and our own Download button becomes the only route.
 *
 * `related_applications` is deliberately empty. The obvious entry would be
 * `{platform: "play", id: "com.batamart.batamart"}`, but there is no Play
 * listing yet and pointing Chrome at a Play page that 404s is worse than
 * pointing it nowhere. Fill it in the day the app ships on Play — at which
 * point Chrome will offer the real app directly and this file's APK URL can go.
 *
 * Cost of this: desktop Chrome loses its PWA install button too, since a
 * static manifest cannot vary by platform. iOS is unaffected — Safari's "Add to
 * Home Screen" is a manual Share-sheet action and does not consult
 * installability criteria.
 *
 * Where the native Android app is distributed.
 *
 * The app is not on Google Play, so this points at the APK attached to the
 * latest GitHub release. `/releases/latest/download/<asset>` always resolves to
 * the newest release, so publishing a new one is enough — this URL never needs
 * changing. The asset must be named exactly `batamart.apk`.
 *
 * It deliberately points at `batamart-releases`, NOT the source repo. The
 * source repo is private, and a private repo's release assets are not publicly
 * downloadable — they answer 404 to anyone without repo access, so every user
 * tapping Download would have got nothing. A separate public repo holds the
 * APK and only the APK; the source stays private.
 *
 * Verified: an unauthenticated ranged GET from an Android Chrome user agent
 * returns 206 with real bytes, redirected to GitHub's release-asset CDN. None
 * of this traffic touches the site's own hosting.
 *
 * Consequences of sideloading rather than Play: Chrome warns the file "can harm
 * your device", and the user has to allow installs from their browser once.
 * `InstallPrompt` explains both after the download starts.
 */
export const ANDROID_APK_URL =
  'https://github.com/martinblaze/batamart-releases/releases/latest/download/batamart.apk'

/**
 * Android gets the real app; every other platform keeps the PWA prompt, since
 * there is no App Store build and desktop has no native app at all.
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}
