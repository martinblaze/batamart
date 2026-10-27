import '../../../core/utils/json_parsing.dart';

class Wallet {
  const Wallet({
    required this.availableBalance,
    required this.pendingBalance,
    required this.completedOrders,
    required this.role,
    this.marketingBalance,
  });

  final double availableBalance;
  final double pendingBalance;
  final int completedOrders;
  final String role;

  /// Field-marketer earnings, kept apart from the main balance. Null unless
  /// the user has joined the field marketers programme.
  final double? marketingBalance;

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      availableBalance: parseBalance(json['availableBalance']),
      pendingBalance: parseBalance(json['pendingBalance']),
      completedOrders: json['completedOrders'] as int? ?? 0,
      role: json['role'] as String? ?? 'BUYER',
      marketingBalance: json['marketing'] is Map
          ? parseBalance((json['marketing'] as Map)['balance'])
          : null,
    );
  }
}

/// Raw `Transaction` row (BACKEND_REFERENCE.md §3.7 — the doc doesn't
/// fully enumerate this shape, only says "raw Transaction rows"). Parsed
/// defensively; `type` drives the icon/sign in the UI.
class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.type,
    required this.amount,
    this.description,
    this.createdAt,
  });

  final String id;
  final String type;
  final double amount;
  final String? description;
  final DateTime? createdAt;

  bool get isCredit => type == 'CREDIT' || type == 'ESCROW';

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'CREDIT',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      description:
          json['description'] as String? ?? json['reference'] as String?,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse(json['createdAt'].toString()),
    );
  }
}
