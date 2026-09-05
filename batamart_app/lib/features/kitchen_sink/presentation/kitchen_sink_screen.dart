import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/badges/campaign_badge.dart';
import '../../../core/widgets/badges/status_chip.dart';
import '../../../core/widgets/badges/trust_badge.dart';
import '../../../core/widgets/buttons/app_buttons.dart';
import '../../../core/widgets/cards/order_card.dart';
import '../../../core/widgets/cards/product_card.dart';
import '../../../core/widgets/chrome/app_bar.dart';
import '../../../core/widgets/chrome/app_bottom_sheet.dart';
import '../../../core/widgets/chrome/app_dialog.dart';
import '../../../core/widgets/inputs/app_text_field.dart';
import '../../../core/widgets/nav/buyer_seller_nav_shell.dart';
import '../../../core/widgets/nav/rider_nav_shell.dart';
import '../../../core/widgets/states/empty_state.dart';
import '../../../core/widgets/states/error_state.dart';
import '../../../core/widgets/states/loading_skeleton.dart';

/// Debug-only "component catalog" screen for Phase 2 — every reusable
/// widget rendered on one screen so the design system can be reviewed
/// against the mockups before any real feature screen is built. Not part
/// of the buyer/seller/rider navigation graph.
class KitchenSinkScreen extends StatefulWidget {
  const KitchenSinkScreen({super.key});

  @override
  State<KitchenSinkScreen> createState() => _KitchenSinkScreenState();
}

class _KitchenSinkScreenState extends State<KitchenSinkScreen> {
  BuyerSellerNavTab _buyerTab = BuyerSellerNavTab.home;
  RiderNavTab _riderTab = RiderNavTab.dashboard;
  bool _riderOnline = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BataAppBar(title: 'Kitchen Sink'),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          _SectionTitle('Palette'),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _swatch('Accent', color: AppColors.primary),
              _swatch('Primary', color: AppColors.primary),
              _swatch('Campaign pink', color: AppColors.campaignRose),
              _swatch('Success', color: AppColors.success),
              _swatch('Warning', color: AppColors.warning),
              _swatch('Danger', color: AppColors.danger),
              _swatch('Info', color: AppColors.info),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Buttons'),
          PrimaryButton(label: 'Login', onPressed: () {}),
          const SizedBox(height: AppSpacing.sm),
          const PrimaryButton(
            label: 'Loading',
            onPressed: null,
            isLoading: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          SecondaryButton(label: 'I already have an account', onPressed: () {}),
          const SizedBox(height: AppSpacing.sm),
          DangerButton(label: 'Remove item', onPressed: () {}),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Text fields'),
          const AppTextField(label: 'Email or Phone', hint: 'you@example.com'),
          const SizedBox(height: AppSpacing.sm),
          const AppTextField(label: 'Password', obscureText: true),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Badges & chips'),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              StatusChip(status: 'PENDING'),
              StatusChip(status: 'PROCESSING'),
              StatusChip(status: 'ON_THE_WAY'),
              StatusChip(status: 'DELIVERED'),
              StatusChip(status: 'CANCELLED'),
              TrustBadge(level: 'BRONZE'),
              TrustBadge(level: 'GOLD'),
              TrustBadge(level: 'VERIFIED'),
              CampaignBadge(tag: 'GIRLFRIENDS_DAY'),
              DiscountBadge(percentOff: 25),
              RatingStars(rating: 4.6, reviewCount: 128),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Product card'),
          SizedBox(
            width: 180,
            child: ProductCard(
              imageUrl: 'https://placehold.co/300x300',
              name: 'Canvas Sneakers',
              price: '₦6,700',
              originalPrice: '₦8,500',
              percentOff: 21,
              rating: 4.6,
              reviewCount: 128,
              onTap: () {},
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          const ProductCardSkeleton(),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Order card'),
          OrderCard(
            orderNumber: 'Order #BM2938',
            date: 'June 10, 2025',
            itemsLabel: '2 items',
            total: '₦14,900',
            status: 'ON_THE_WAY',
            actionLabel: 'View Details',
            onActionTap: () {},
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('States'),
          const SizedBox(
            height: 160,
            child: EmptyState(
              title: 'Your cart is empty',
              message: 'Browse the marketplace to find something you like.',
              actionLabel: 'Shop Now',
            ),
          ),
          SizedBox(
            height: 160,
            child: ErrorState(
              message: 'Could not load your orders.',
              onRetry: () {},
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Overlays'),
          SecondaryButton(
            label: 'Show bottom sheet',
            onPressed: () => AppBottomSheet.show(
              context: context,
              title: 'Withdraw',
              child: const AppTextField(label: 'Amount'),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SecondaryButton(
            label: 'Show dialog',
            onPressed: () => AppDialog.confirm(
              context: context,
              title: 'Confirm Received?',
              message: 'This releases escrow to the seller.',
              confirmLabel: 'Confirm',
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Buyer/Seller bottom nav'),
          BuyerSellerBottomNav(
            currentTab: _buyerTab,
            cartItemCount: 2,
            onTabSelected: (tab) => setState(() => _buyerTab = tab),
          ),
          const SizedBox(height: AppSpacing.xl),

          _SectionTitle('Rider bottom nav'),
          RiderBottomNav(
            currentTab: _riderTab,
            isOnline: _riderOnline,
            onTabSelected: (tab) => setState(() => _riderTab = tab),
            onOnlineToggled: (value) => setState(() => _riderOnline = value),
          ),
        ],
      ),
    );
  }

  Widget _swatch(String label, {Color? color, Gradient? gradient}) {
    return Column(
      children: [
        Container(
          width: 64,
          height: 40,
          decoration: BoxDecoration(
            color: color,
            gradient: gradient,
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 10)),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Text(text, style: Theme.of(context).textTheme.titleLarge),
    );
  }
}
