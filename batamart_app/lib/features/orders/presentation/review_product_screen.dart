import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../state/orders_providers.dart';
import 'star_rating_input.dart';

/// WEB_PAGES_REFERENCE.md: "Skip → orders; success → chains into Review
/// Seller". `POST /api/reviews/product` (BACKEND_REFERENCE.md §3.8).
class ReviewProductScreen extends ConsumerStatefulWidget {
  const ReviewProductScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<ReviewProductScreen> createState() =>
      _ReviewProductScreenState();
}

class _ReviewProductScreenState extends ConsumerState<ReviewProductScreen> {
  final _commentController = TextEditingController();
  int _rating = 5;
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await ref
          .read(reviewsRepositoryProvider)
          .submitProductReview(
            orderId: widget.orderId,
            rating: _rating,
            comment: _commentController.text.trim(),
          );
      if (mounted) {
        context.pushReplacement(AppRoutes.reviewSellerPath(widget.orderId));
      }
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: BataAppBar(
        title: 'Review Product',
        showBack: true,
        actions: [
          TextButton(
            onPressed: () => context.go(AppRoutes.home),
            child: const Text('Skip'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'How was the product?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: StarRatingInput(
                rating: _rating,
                onChanged: (r) => setState(() => _rating = r),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _commentController,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Share more about your experience (optional)',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: AppSpacing.lg),
            PrimaryButton(
              label: 'Submit Review',
              onPressed: _submit,
              isLoading: _isSubmitting,
            ),
          ],
        ),
      ),
    );
  }
}
