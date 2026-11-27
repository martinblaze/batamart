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
 * The app is not on Google Play, so the APK is served from this site itself:
 * `public/downloads/batamart.apk` (see the `/downloads/batamart.apk` headers in
 * next.config.js, which force a file download with the right MIME type).
 *
 * It used to point at a GitHub release in `martinblaze/batamart-releases`. That
 * repo was made private, which turned every public download link into a 404 and
 * left Android users on a GitHub error page. Hosting the file here removes the
 * dependency on GitHub entirely.
 *
 * To ship a new build: replace `public/downloads/batamart.apk` (same name) and
 * deploy. Keep the file under the host's static-file size limit.
 *
 * Consequences of sideloading rather than Play: Chrome warns the file "can harm
 * your device", and the user has to allow installs from their browser once.
 * `InstallPrompt` explains both after the download starts.
 */
export const ANDROID_APK_URL = '/downloads/batamart.apk'

/**
 * Android gets the real app; every other platform keeps the PWA prompt, since
 * there is no App Store build and desktop has no native app at all.
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}
