import 'dart:async';
import 'dart:io' show Platform;

import 'package:geolocator/geolocator.dart';

import 'rider_repository.dart';

/// GPS broadcast for `POST /api/riders/live-location`.
///
/// Uses a continuous position stream rather than a timer around
/// `getCurrentPosition`, because a timer dies with the app's UI isolate the
/// moment the phone sleeps. The stream is backed by:
///   * Android — a foreground service (persistent "Delivery in progress"
///     notification) with a wake lock, which the OS keeps alive while the
///     screen is off or the app is backgrounded.
///   * iOS — `allowBackgroundLocationUpdates` (needs the `location` entry in
///     UIBackgroundModes) with the blue background-location indicator.
///
/// Pings are throttled to one every [_minInterval], and the stream stops
/// itself once the server reports it attached the ping to zero orders for
/// [_idleStopAfter] pings in a row (delivery finished), so the notification
/// doesn't outlive the job.
class LocationBroadcastService {
  LocationBroadcastService(this._repository);

  static const _minInterval = Duration(seconds: 8);
  static const _idleStopAfter = 3;

  final RiderRepository _repository;
  StreamSubscription<Position>? _subscription;
  DateTime _lastSentAt = DateTime.fromMillisecondsSinceEpoch(0);
  int _idlePings = 0;
  bool _sending = false;

  /// Called when the service stops itself because there is nothing to track.
  void Function()? onAutoStopped;

  bool get isBroadcasting => _subscription != null;

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

  LocationSettings _settings() {
    if (Platform.isAndroid) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 8,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'BataMart delivery in progress',
          notificationText: 'Sharing your live location with the customer.',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }
    if (Platform.isIOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 8,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
        allowBackgroundLocationUpdates: true,
      );
    }
    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 8,
    );
  }

  void start({String? batchId, List<String>? orderIds}) {
    stop();
    _idlePings = 0;
    _lastSentAt = DateTime.fromMillisecondsSinceEpoch(0);
    _subscription = Geolocator.getPositionStream(locationSettings: _settings())
        .listen(
          (position) => _ping(position, batchId, orderIds),
          onError: (_) {
            // Best-effort — the stream keeps running through transient errors.
          },
        );
  }

  Future<void> _ping(
    Position position,
    String? batchId,
    List<String>? orderIds,
  ) async {
    final now = DateTime.now();
    if (_sending || now.difference(_lastSentAt) < _minInterval) return;
    _sending = true;
    _lastSentAt = now;
    try {
      final written = await _repository.sendLiveLocation(
        batchId: batchId,
        orderIds: orderIds,
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
      );
      _idlePings = written == 0 ? _idlePings + 1 : 0;
      if (_idlePings >= _idleStopAfter) {
        stop();
        onAutoStopped?.call();
      }
    } catch (_) {
      // A missed ping isn't fatal; the next position update retries.
    } finally {
      _sending = false;
    }
  }

  void stop() {
    _subscription?.cancel();
    _subscription = null;
  }
}
