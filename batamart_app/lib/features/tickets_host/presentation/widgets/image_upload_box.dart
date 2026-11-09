import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_palette.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/widgets/images/app_network_image.dart';
import '../../state/ticket_host_providers.dart';

/// Picks a gallery image and uploads it through the same `/api/upload`
/// endpoint product photos use, then reports the hosted URL.
class ImageUploadBox extends ConsumerStatefulWidget {
  const ImageUploadBox({
    super.key,
    required this.url,
    required this.onChanged,
    this.height = 160,
    this.width,
    this.hint = 'Add image',
  });

  final String? url;
  final ValueChanged<String?> onChanged;
  final double height;
  final double? width;
  final String hint;

  @override
  ConsumerState<ImageUploadBox> createState() => _ImageUploadBoxState();
}

class _ImageUploadBoxState extends ConsumerState<ImageUploadBox> {
  bool _uploading = false;
  String? _error;

  Future<void> _pick() async {
    final repo = ref.read(uploadRepositoryProvider);
    final file = await repo.pickImage();
    if (file == null) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await repo.uploadImage(file);
      widget.onChanged(url);
    } catch (_) {
      if (mounted) setState(() => _error = 'Upload failed. Try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final hasImage = (widget.url ?? '').isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: widget.width ?? double.infinity,
          height: widget.height,
          child: Stack(
            fit: StackFit.expand,
            children: [
              InkWell(
                onTap: _uploading ? null : _pick,
                child: hasImage
                    ? AppNetworkImage(widget.url!, height: widget.height)
                    : Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: p.hairline),
                          color: p.card,
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.imagePlus, color: p.inkMuted),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              widget.hint,
                              style: TextStyle(color: p.inkMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
              ),
              if (_uploading)
                Container(
                  color: Colors.black38,
                  child: const Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
              if (hasImage && !_uploading)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Material(
                    color: p.ink,
                    child: InkWell(
                      onTap: () => widget.onChanged(null),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(LucideIcons.x, size: 16, color: p.page),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ),
      ],
    );
  }
}
