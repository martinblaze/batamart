import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_palette.dart';

/// A live map with one rider pin that glides between GPS fixes and leaves a
/// trail, the same behaviour as the web order page. Uses OpenStreetMap tiles,
/// so no map API key is needed.
class LiveRiderMap extends StatefulWidget {
  const LiveRiderMap({super.key, required this.lat, required this.lng});

  final double lat;
  final double lng;

  @override
  State<LiveRiderMap> createState() => _LiveRiderMapState();
}

class _LiveRiderMapState extends State<LiveRiderMap>
    with SingleTickerProviderStateMixin {
  // Slightly longer than the 5s poll, so the pin is still gliding when the next
  // fix arrives and the motion reads as continuous.
  static const _glide = Duration(milliseconds: 5500);

  final _map = MapController();
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _glide,
  );
  late LatLng _from = LatLng(widget.lat, widget.lng);
  late LatLng _to = _from;
  final List<LatLng> _trail = [];

  LatLng get _current => LatLng(
    _from.latitude + (_to.latitude - _from.latitude) * _controller.value,
    _from.longitude + (_to.longitude - _from.longitude) * _controller.value,
  );

  @override
  void initState() {
    super.initState();
    _trail.add(_to);
    _controller.addListener(() {
      if (!mounted) return;
      setState(() {});
      // Follow the rider, but only once they near the edge so the map does not
      // fight someone who is looking around.
      final camera = _map.camera;
      final inner = camera.visibleBounds;
      final c = _current;
      final padLat = (inner.north - inner.south) * 0.2;
      final padLng = (inner.east - inner.west) * 0.2;
      final safe = c.latitude < inner.north - padLat &&
          c.latitude > inner.south + padLat &&
          c.longitude < inner.east - padLng &&
          c.longitude > inner.west + padLng;
      if (!safe) _map.move(c, camera.zoom);
    });
  }

  @override
  void didUpdateWidget(covariant LiveRiderMap old) {
    super.didUpdateWidget(old);
    if (old.lat == widget.lat && old.lng == widget.lng) return;
    _from = _current;
    _to = LatLng(widget.lat, widget.lng);
    _trail.add(_to);
    if (_trail.length > 80) _trail.removeAt(0);
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    _map.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final pin = _current;
    return ClipRect(
      child: SizedBox(
        height: 240,
        child: FlutterMap(
          mapController: _map,
          options: MapOptions(initialCenter: pin, initialZoom: 16.5),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.batamart.batamart',
            ),
            PolylineLayer(
              polylines: [
                Polyline(
                  points: [..._trail, pin],
                  strokeWidth: 3,
                  color: p.ink.withValues(alpha: 0.55),
                ),
              ],
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: pin,
                  width: 26,
                  height: 26,
                  child: Container(
                    decoration: BoxDecoration(
                      color: p.ink,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3),
                      boxShadow: const [
                        BoxShadow(color: Color(0x59000000), blurRadius: 4),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const RichAttributionWidget(
              attributions: [TextSourceAttribution('OpenStreetMap contributors')],
            ),
          ],
        ),
      ),
    );
  }
}
