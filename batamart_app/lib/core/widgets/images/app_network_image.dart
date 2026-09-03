import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/app_colors.dart';

/// Disk+memory-cached replacement for raw `Image.network`, used everywhere
/// a product/evidence photo is rendered so scrolling back to something
/// already seen doesn't re-hit the network (BUILD_PLAN Phase 12
/// performance pass). Pass [width]/[height] so the decoder downsamples to
/// the actual display size instead of decoding a full-resolution image
/// into a small tile.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage(
    this.url, {
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) return _placeholder();
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return CachedNetworkImage(
      imageUrl: url,
      width: width,
      height: height,
      fit: fit,
      memCacheWidth: width == null ? null : (width! * dpr).round(),
      memCacheHeight: height == null ? null : (height! * dpr).round(),
      placeholder: (context, url) => _placeholder(loading: true),
      errorWidget: (context, url, error) => _placeholder(),
    );
  }

  Widget _placeholder({bool loading = false}) {
    return Container(
      color: AppColors.background,
      alignment: Alignment.center,
      child: loading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(LucideIcons.image, color: AppColors.textDisabled),
    );
  }
}
