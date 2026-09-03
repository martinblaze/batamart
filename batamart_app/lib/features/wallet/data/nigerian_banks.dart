/// No bank-list endpoint exists anywhere in BACKEND_REFERENCE.md — the
/// withdraw form needs *a* bank code, so this bundles the common Nigerian
/// banks' standard NIBSS/Flutterwave codes (public reference data, not
/// app-specific). Verify/expand against Flutterwave's actual bank list
/// once reachable; there's also no account-name resolution endpoint, so
/// `accountName` on the withdraw form is typed manually rather than
/// auto-verified — flagged in README "Phase 8 status".
class NigerianBank {
  const NigerianBank(this.name, this.code);
  final String name;
  final String code;
}

const kNigerianBanks = [
  NigerianBank('Access Bank', '044'),
  NigerianBank('GTBank', '058'),
  NigerianBank('Zenith Bank', '057'),
  NigerianBank('First Bank', '011'),
  NigerianBank('UBA', '033'),
  NigerianBank('Fidelity Bank', '070'),
  NigerianBank('Union Bank', '032'),
  NigerianBank('Sterling Bank', '232'),
  NigerianBank('Wema Bank', '035'),
  NigerianBank('Polaris Bank', '076'),
  NigerianBank('Opay', '999992'),
  NigerianBank('PalmPay', '999991'),
  NigerianBank('Kuda Bank', '50211'),
  NigerianBank('Moniepoint', '50515'),
];
