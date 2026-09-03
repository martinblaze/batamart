import '../../../core/api/api_client.dart';

class ReferralInfo {
  const ReferralInfo({
    required this.referralCode,
    required this.referralLink,
    required this.totalReferrals,
    required this.totalEarnings,
    required this.referrals,
    required this.recentRewards,
  });

  final String referralCode;
  final String referralLink;
  final int totalReferrals;
  final double totalEarnings;
  final List<Map<String, dynamic>> referrals;
  final List<Map<String, dynamic>> recentRewards;

  factory ReferralInfo.fromJson(Map<String, dynamic> json) {
    return ReferralInfo(
      referralCode: json['referralCode'] as String? ?? '',
      referralLink: json['referralLink'] as String? ?? '',
      totalReferrals: json['totalReferrals'] as int? ?? 0,
      totalEarnings: (json['totalEarnings'] as num?)?.toDouble() ?? 0,
      referrals: (json['referrals'] as List? ?? const [])
          .cast<Map<String, dynamic>>(),
      recentRewards: (json['recentRewards'] as List? ?? const [])
          .cast<Map<String, dynamic>>(),
    );
  }
}

/// `GET /api/referrals` — read-only; crediting happens server-side as a
/// side effect of order/delivery completion (BACKEND_REFERENCE.md §3.11).
class ReferralsRepository {
  Future<ReferralInfo> fetchReferralInfo() async {
    final response = await ApiClient.instance.get('/api/referrals');
    return ReferralInfo.fromJson(response);
  }
}
