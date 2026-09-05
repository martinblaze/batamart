/**
 * Where the native Android app is distributed.
 *
 * The app is not on Google Play, so this points at the APK attached to the
 * latest GitHub release. `/releases/latest/download/<asset>` always resolves to
 * the newest release, so publishing a new one is enough — this URL never needs
 * changing. The asset must be named exactly `batamart.apk`.
 *
 * Consequences of sideloading rather than Play: Chrome warns the file "can harm
 * your device", and the user has to allow installs from their browser once.
 * `InstallPrompt` explains both after the download starts.
 */
export const ANDROID_APK_URL =
  'https://github.com/martinblaze/batamart/releases/latest/download/batamart.apk'

/**
 * Android gets the real app; every other platform keeps the PWA prompt, since
 * there is no App Store build and desktop has no native app at all.
 */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}
