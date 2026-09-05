import 'package:flutter/material.dart';
import '../../../core/theme/app_typography.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/app_router.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../state/orders_providers.dart';
import 'star_rating_input.dart';

/// WEB_PAGES_REFERENCE.md: "Skip → orders; success → orders". Chained
/// from Review Product. `POST /api/reviews` with `type: "SELLER"`
/// (BACKEND_REFERENCE.md §3.8).
class ReviewSellerScreen extends ConsumerStatefulWidget {
  const ReviewSellerScreen({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<ReviewSellerScreen> createState() => _ReviewSellerScreenState();
}

class _ReviewSellerScreenState extends ConsumerState<ReviewSellerScreen> {
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
          .submitSellerReview(
            orderId: widget.orderId,
            rating: _rating,
            comment: _commentController.text.trim(),
          );
      if (mounted) context.go(AppRoutes.home);
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
        title: 'Review Seller',
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
            Text(
              'How was the seller?',
              style: AppTypography.display(size: 18, weight: FontWeight.w700),
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
