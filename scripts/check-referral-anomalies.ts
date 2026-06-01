// scripts/check-referral-anomalies.ts
// Run with: npx ts-node scripts/check-referral-anomalies.ts
// Purpose: Identify users with referral rewards and verify the referral relationships are valid

import { prisma } from '@/lib/prisma'

async function main() {
  console.log('🔍 Checking for referral reward anomalies...\n')

  // Find all users who received referral rewards
  const usersWithRewards = await prisma.user.findMany({
    where: {
      referralReward: {
        some: {},
      },
    },
    select: {
      id: true,
      email: true,
      availableBalance: true,
      referralReward: {
        select: {
          id: true,
          amount: true,
          createdAt: true,
          orderId: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  console.log(`Found ${usersWithRewards.length} users with referral rewards\n`)

  for (const user of usersWithRewards) {
    const totalRewardsAmount = user.referralReward.reduce((sum, r) => sum + r.amount, 0)
    console.log(`📊 User: ${user.email}`)
    console.log(`   Total Rewards: ₦${totalRewardsAmount}`)
    console.log(`   Reward Count: ${user.referralReward.length}`)
    console.log(`   Current Balance: ₦${user.availableBalance}`)

    // Find all users who referred this person
    const referredUsers = await prisma.user.findMany({
      where: {
        referralReward: {
          some: {
            order: {
              buyerId: user.id,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    })

    console.log(`   Referred by: ${referredUsers.map(u => u.email).join(', ') || 'Nobody (⚠️ ANOMALY)'}`)

    // Check if there are any self-referrals (shouldn't exist with our validation)
    const selfReferral = await prisma.user.findUnique({
      where: { id: user.id },
      select: { referredById: true },
    })

    if (selfReferral?.referredById === user.id) {
      console.log(`   ⚠️ FRAUD DETECTED: Self-referral!`)
    }

    console.log()
  }

  // Check for orphaned referral rewards (rewards to users with no referrer)
  console.log('\n🚨 Checking for orphaned referral rewards...')
  const orphanedRewards = await prisma.referralReward.findMany({
    include: {
      order: {
        select: {
          buyerId: true,
          buyer: {
            select: {
              email: true,
              referredById: true,
            },
          },
        },
      },
    },
  })

  const anomalies = orphanedRewards.filter(r => !r.order.buyer.referredById)

  if (anomalies.length > 0) {
    console.log(`⚠️ Found ${anomalies.length} referral rewards for buyers with no referrer!\n`)
    for (const anomaly of anomalies) {
      console.log(`  - Buyer: ${anomaly.order.buyer.email} (Order ID: ${anomaly.orderId})`)
      console.log(`    Reward Amount: ₦${anomaly.amount}`)
    }
  } else {
    console.log('✅ No orphaned referral rewards found')
  }

  // Check for duplicate rewards on same order
  console.log('\n🔄 Checking for duplicate rewards per order...')
  const duplicates = await prisma.referralReward.groupBy({
    by: ['orderId'],
    _count: true,
    having: {
      orderId: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  if (duplicates.length > 0) {
    console.log(`⚠️ Found ${duplicates.length} orders with duplicate rewards!\n`)
    for (const dup of duplicates) {
      const rewards = await prisma.referralReward.findMany({
        where: { orderId: dup.orderId },
        select: { amount: true, createdAt: true },
      })
      console.log(`  - Order ID: ${dup.orderId}`)
      console.log(`    Rewards: ${rewards.map(r => `₦${r.amount}`).join(', ')}`)
    }
  } else {
    console.log('✅ No duplicate rewards per order')
  }

  console.log('\n✅ Diagnostic complete')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
