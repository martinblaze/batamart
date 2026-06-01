# 🔧 Referral Diagnostics & Cleanup Guide

## Overview
These tools help identify and fix anomalous referral rewards (like the ₦240 appearing without valid referrals).

---

## 📊 1. Check Individual User Referral Status

**Endpoint:** `GET /api/admin/diagnostics/referral-check?email=user@example.com`

**Authentication:** Bearer token (admin only)

**Purpose:** View complete referral history for a specific user

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/diagnostics/referral-check?email=someone@school.edu"
```

**Response includes:**
- ✅ All rewards they received
- ✅ Who they referred (if any)
- ✅ Detailed anomaly report:
  - Self-referrals
  - Orphaned rewards (rewards without referrer)
  - Non-completed orders with rewards
  - Referral mismatches
- ✅ Monthly breakdown
- ✅ Daily cap status

**Example Response:**
```json
{
  "user": {
    "email": "someone@school.edu",
    "userId": "user123",
    "availableBalance": 240,
    "referredById": null,
    "referredByCount": 2
  },
  "referralRewards": {
    "totalAmount": 240,
    "rewardCount": 1,
    "byMonth": { "2026-06": 240 },
    "recentRewards": [
      {
        "orderId": "order456",
        "orderNumber": "BM-789",
        "amount": 240,
        "buyerEmail": "buyer@school.edu",
        "completedAt": "2026-06-02T10:30:00Z"
      }
    ]
  },
  "validation": {
    "hasAnomalies": true,
    "anomalies": [
      "User has 1 referral rewards but no referrer (referredById is null)"
    ],
    "warnings": []
  }
}
```

---

## 🧹 2. Cleanup Anomalous Rewards

**Endpoint:** `POST /api/admin/diagnostics/referral-cleanup`

**Authentication:** Bearer token (admin only)

**Query Parameters:**
- `dryRun=true` - Preview what would be deleted (default: false)
- `type=all|orphaned|self-referral|non-completed` - Cleanup specific category (default: all)

**Purpose:** Remove anomalous rewards and reverse balance impacts

### Step 1: Always do a DRY RUN first!

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/diagnostics/referral-cleanup?dryRun=true"
```

**DRY RUN Response:**
```json
{
  "removedRewards": [
    {
      "id": "reward123",
      "amount": 240,
      "userId": "user456",
      "userEmail": "someone@school.edu",
      "orderId": "order789",
      "orderNumber": "BM-ABC123",
      "reason": "Orphaned (buyer has no referrer)"
    }
  ],
  "totalAmountRemoved": 240,
  "summary": "📊 DRY RUN: Would remove 1 rewards (total ₦240) and affect 1 users."
}
```

### Step 2: If results look good, run actual cleanup

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/diagnostics/referral-cleanup"
```

**Success Response:**
```json
{
  "removedRewards": [
    {
      "id": "reward123",
      "amount": 240,
      "userId": "user456",
      "userEmail": "someone@school.edu",
      "orderId": "order789",
      "orderNumber": "BM-ABC123",
      "reason": "Orphaned (buyer has no referrer)"
    }
  ],
  "reversedBalances": {
    "user456": {
      "userId": "user456",
      "userEmail": "someone@school.edu",
      "amountReversed": 240,
      "newBalance": 0
    }
  },
  "deletedTransactions": 1,
  "totalAmountRemoved": 240,
  "summary": "✅ Cleanup complete. Removed 1 anomalous rewards (total ₦240). Affected 1 users."
}
```

---

## 🏃 3. Run Full Database Scan

**Local script:** `npx ts-node scripts/check-referral-anomalies.ts`

**Purpose:** Comprehensive scan of entire database (no authentication needed locally)

**Output includes:**
- All users receiving referral rewards
- Referral relationship chain
- Orphaned rewards
- Self-referrals
- Duplicate rewards per order

**Example Output:**
```
🔍 Checking for referral reward anomalies...

Found 5 users with referral rewards

📊 User: seller@school.edu
   Total Rewards: ₦1200
   Reward Count: 5
   Current Balance: ₦1200
   Referred by: Someone, Else

📊 User: someone@school.edu
   Total Rewards: ₦240
   Reward Count: 1
   Current Balance: ₦240
   Referred by: Nobody (⚠️ ANOMALY)

🚨 Found 1 referral rewards for buyers with no referrer!

✅ Diagnostic complete
```

---

## 🔍 Troubleshooting the ₦240 Issue

### If user sees ₦240 but didn't make referrals:

1. **Check their status:**
   ```bash
   GET /api/admin/diagnostics/referral-check?email=their@email.com
   ```

2. **Look for anomalies in response:**
   - `hasAnomalies: true` = problem found
   - Check the `anomalies` array for details

3. **If anomalies exist, do cleanup:**
   ```bash
   POST /api/admin/diagnostics/referral-cleanup?dryRun=true
   ```

4. **Review the dry run results, then:**
   ```bash
   POST /api/admin/diagnostics/referral-cleanup
   ```

### Common Findings:

- **"Orphaned (buyer has no referrer)"** = User has rewards but never was referred by anyone. This is impossible and should be removed.
- **"Self-referral fraud"** = User is their own referrer. Remove immediately.
- **"Non-completed order"** = Order status isn't COMPLETED but reward was given. Remove.
- **"Referral mismatch"** = Buyer doesn't have this user as referrer. Remove.

---

## 📋 What Gets Reversed

When cleanup runs:

1. ✅ Referral reward records deleted
2. ✅ Related transactions deleted
3. ✅ User's available balance decreased by reward amount
4. ✅ All changes logged with timestamps and reasons

**Important:** Users won't see the balance removal immediately in the UI (cached). They'll see it when they refresh or next login.

---

## 🚨 Safety Checks

- Cleanup only removes rewards with valid anomaly reasons
- Dry run always available for preview
- Balance can never go below 0
- All changes logged for audit trail
- Requires admin authentication
