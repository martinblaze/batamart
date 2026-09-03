package com.batamart.batamart

import io.flutter.embedding.android.FlutterFragmentActivity

// local_auth's BiometricPrompt integration requires a FragmentActivity —
// plain FlutterActivity doesn't extend one and biometric calls crash with
// a ClassCastException at runtime otherwise.
class MainActivity : FlutterFragmentActivity()
