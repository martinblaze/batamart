import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'rider_repository.dart';

/// Foreground-only GPS broadcast for `POST /api/riders/live-location`
/// (BACKEND_REFERENCE.md §3.12 — "client's discretion" on interval; 20s
/// matches the doc's suggested 15-30s range). Polls `getCurrentPosition`
/// on a timer rather than a continuous position stream, to avoid
/// spamming the endpoint on every GPS update.
///
/// **Not background-safe** — broadcasting stops the moment the app is
/// backgrounded, since there's no foreground service wired up (a real
/// background-safe stream is a much larger scope item; see README
/// "Phase 10 status"). Acceptable for a rider actively navigating with
/// the app open, not for backgrounded delivery tracking.
class LocationBroadcastService {
  LocationBroadcastService(this._repository);

  final RiderRepository _repository;
  Timer? _timer;

  bool get isBroadcasting => _timer != null;

  Future<bool> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) return false;
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  void start({String? batchId, List<String>? orderIds}) {
    stop();
    _timer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _ping(batchId, orderIds),
    );
    _ping(batchId, orderIds);
  }

  Future<void> _ping(String? batchId, List<String>? orderIds) async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      await _repository.sendLiveLocation(
        batchId: batchId,
        orderIds: orderIds,
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
      );
    } catch (_) {
      // Best-effort — a missed ping isn't fatal, the next timer tick retries.
    }
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
