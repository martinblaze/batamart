import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Tappable 1-5 star input, shared by Review Product and Review Seller.
class StarRatingInput extends StatelessWidget {
  const StarRatingInput({
    super.key,
    required this.rating,
    required this.onChanged,
  });

  final int rating;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final value = i + 1;
        return IconButton(
          tooltip: '$value star${value == 1 ? '' : 's'}',
          onPressed: () => onChanged(value),
          icon: Icon(
            value <= rating ? Icons.star_rounded : Icons.star_border_rounded,
            color: AppColors.star,
            size: 36,
          ),
        );
      }),
    );
  }
}
