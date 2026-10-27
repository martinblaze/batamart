import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_palette.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/images/app_network_image.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/states/error_state.dart';
import '../state/seller_providers.dart';

const _maxPhotos = 3;

/// Edit a listing. Changing the name, photos, description or price sends it
/// back for review: it comes off the marketplace until an admin approves it
/// again. Stock, pausing and ready time don't need a new review.
class EditProductScreen extends ConsumerStatefulWidget {
  const EditProductScreen({super.key, required this.productId});

  final String productId;

  @override
  ConsumerState<EditProductScreen> createState() => _EditProductScreenState();
}

class _EditProductScreenState extends ConsumerState<EditProductScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _price = TextEditingController();
  final _quantity = TextEditingController();
  final _days = TextEditingController();
  List<String> _images = [];
  bool _hasVariants = false;
  String _status = 'APPROVED';
  String? _rejection;

  bool _loading = true;
  bool _saving = false;
  bool _uploading = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _quantity.dispose();
    _days.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await ref
          .read(sellerProductsRepositoryProvider)
          .fetchForEdit(widget.productId);
      _name.text = p['name'] as String? ?? '';
      _description.text = p['description'] as String? ?? '';
      _price.text = '${(p['price'] as num?)?.round() ?? ''}';
      _quantity.text = '${p['quantity'] ?? ''}';
      final est = RegExp(r'(\d+)').firstMatch('${p['deliveryEstimate'] ?? ''}');
      _days.text = est?.group(1) ?? '';
      _images = (p['images'] as List? ?? const []).map((e) => '$e').toList();
      _hasVariants = p['variantsEnabled'] as bool? ?? false;
      _status = p['moderationStatus'] as String? ?? 'APPROVED';
      _rejection = p['rejectionReason'] as String?;
    } catch (e) {
      _loadError = '$e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addPhoto() async {
    if (_images.length >= _maxPhotos) return;
    final repo = ref.read(uploadRepositoryProvider);
    final file = await repo.pickImage();
    if (file == null) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final url = await repo.uploadImage(file);
      if (mounted) setState(() => _images = [..._images, url]);
    } catch (e) {
      if (mounted) setState(() => _error = 'Photo upload failed. Try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final days = int.tryParse(_days.text.trim());
    if (_name.text.trim().length < 3) {
      setState(() => _error = 'Give the listing a name of at least 3 characters.');
      return;
    }
    if (_images.isEmpty) {
      setState(() => _error = 'Keep at least one photo.');
      return;
    }
    if (days == null || days < 1 || days > 30) {
      setState(() => _error = 'Enter how many days it takes to be ready, 1 to 30.');
      return;
    }
    double? price;
    int? quantity;
    if (!_hasVariants) {
      price = double.tryParse(_price.text.trim());
      quantity = int.tryParse(_quantity.text.trim());
      if (price == null || price <= 0) {
        setState(() => _error = 'Enter a valid price.');
        return;
      }
      if (quantity == null || quantity < 0) {
        setState(() => _error = 'Enter a valid stock quantity.');
        return;
      }
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final needsReview = await ref
          .read(sellerProductsRepositoryProvider)
          .updateListing(
            widget.productId,
            name: _name.text.trim(),
            description: _description.text.trim(),
            images: _images,
            deliveryEstimate: '$days day${days == 1 ? '' : 's'}',
            price: price,
            quantity: quantity,
          );
      ref.invalidate(myProductsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            needsReview
                ? 'Saved. Your listing is off the marketplace until it is approved again.'
                : 'Saved.',
          ),
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        appBar: BataAppBar(title: 'Edit listing', showBack: true),
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_loadError != null) {
      return Scaffold(
        appBar: const BataAppBar(title: 'Edit listing', showBack: true),
        body: ErrorState(message: 'Could not load this listing.\n$_loadError', onRetry: _load),
      );
    }

    return Scaffold(
      appBar: const BataAppBar(title: 'Edit listing', showBack: true),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Text(
            'Changes to the name, photos, description or price are reviewed again before the listing goes back on the marketplace.',
            style: TextStyle(color: context.palette.inkSecondary, fontSize: 13),
          ),
          if (_status == 'REJECTED' && (_rejection ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Rejected: $_rejection. Fix it and save to send it for review again.',
              style: const TextStyle(color: AppColors.danger, fontSize: 13),
            ),
          ],
          if (_status == 'PENDING') ...[
            const SizedBox(height: AppSpacing.md),
            const Text(
              'This listing is waiting for review.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          Text('PHOTOS (${_images.length}/$_maxPhotos)',
              style: TextStyle(fontSize: 11, letterSpacing: 1.2, color: context.palette.inkMuted)),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              for (final url in _images)
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    AppNetworkImage(url, width: 88, height: 88),
                    Positioned(
                      right: -8,
                      top: -8,
                      child: InkWell(
                        onTap: () => setState(() => _images = _images.where((u) => u != url).toList()),
                        child: Container(
                          width: 24,
                          height: 24,
                          color: context.palette.ink,
                          child: Icon(Icons.close, size: 16, color: context.palette.page),
                        ),
                      ),
                    ),
                  ],
                ),
              if (_images.length < _maxPhotos)
                InkWell(
                  onTap: _uploading ? null : _addPhoto,
                  child: Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(border: Border.all(color: context.palette.hairline)),
                    child: _uploading
                        ? const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))
                        : Icon(Icons.add, color: context.palette.inkMuted),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(controller: _name, label: 'Name'),
          const SizedBox(height: AppSpacing.md),
          AppTextField(controller: _description, label: 'Description', maxLines: 5),
          const SizedBox(height: AppSpacing.md),
          if (_hasVariants)
            Text(
              'This listing has variants. Price and stock for each variant are managed from the sell screen.',
              style: TextStyle(color: context.palette.inkSecondary, fontSize: 12),
            )
          else
            Row(
              children: [
                Expanded(child: AppTextField(controller: _price, label: 'Price (₦)', keyboardType: TextInputType.number)),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: AppTextField(controller: _quantity, label: 'In stock', keyboardType: TextInputType.number)),
              ],
            ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(controller: _days, label: 'Ready in (days)', hint: '1 to 30', keyboardType: TextInputType.number),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(_error!, style: const TextStyle(color: AppColors.danger)),
          ],
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(label: 'Save changes', onPressed: (_saving || _uploading) ? null : _save, isLoading: _saving),
          const SizedBox(height: AppSpacing.xl),
        ],
      ),
    );
  }
}
