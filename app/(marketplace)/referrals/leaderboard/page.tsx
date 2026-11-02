'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Crown, Loader2, Medal, RefreshCw, Trophy, Users } from 'lucide-react'
import { PageHeader, Shell } from '@/components/ui/Shell'

interface LeaderboardEntry {
  rank: number
  name: string
  referrals: number
  orderedReferrals: number
  conversionPercent: number
  isMegaTop: boolean
  isYou: boolean
}

interface LeaderboardData {
  topTen: LeaderboardEntry[]
  megaTop: (LeaderboardEntry & { overallRank: number })[]
  myPosition: {
    rank: number
    referrals: number
    orderedReferrals: number
    conversionPercent: number
    isMegaTop: boolean
  } | null
}

const ordinal = (rank: number) => {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const remainder = rank % 100
  return `${rank}${suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]}`
}

export default function ReferralLeaderboardPage() {
  const router = useRouter()
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push(`/login?redirect=${encodeURIComponent('/referrals/leaderboard')}`)
        return
      }

      const response = await fetch('/api/referrals/leaderboard', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load leaderboard')
      setData(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Shell width="narrow" className="pt-10">
        <div className="ui-panel space-y-4 p-6 text-center">
          <p className="text-sm text-danger">{error || 'Leaderboard unavailable.'}</p>
          <button onClick={() => void load()} className="btn-primary">Try again</button>
        </div>
      </Shell>
    )
  }

  const megaPlaces = [1, 2, 3].map(place => data.megaTop.find(entry => entry.rank === place))

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell width="reading" className="space-y-8 pt-10">
        <Link href="/referrals" className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Your referrals
        </Link>

        <PageHeader
          eyebrow="Referral leaderboard"
          title="The people bringing BataMart to campus"
          description="Ranked by the number of people referred. Order conversion is the share of those people who have placed at least one paid order."
          actions={
            <button
              onClick={() => void load()}
              className="flex h-10 items-center gap-2 border border-border bg-card px-4 text-sm font-medium text-ink"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          }
        />

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="ui-eyebrow mb-1">Top ambassadors</p>
              <h2 className="text-2xl text-ink">Mega Top 3</h2>
            </div>
            <p className="max-w-xs text-right text-xs leading-relaxed text-ink-secondary">
              Selected only from the top 10, with at least 2 referrals and 20% order conversion.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {megaPlaces.map((entry, index) => {
              const place = index + 1
              return (
                <article
                  key={place}
                  className={`border p-5 text-center ${
                    entry?.isYou ? 'border-ink bg-surface ring-1 ring-ink' : 'border-border bg-card'
                  }`}
                >
                  {place === 1
                    ? <Crown className="mx-auto mb-2 h-6 w-6 text-warning" />
                    : <Medal className="mx-auto mb-2 h-6 w-6 text-ink-muted" />}
                  <p className="ui-mono-sm text-ink-muted">MEGA TOP {place}</p>
                  <p className="mt-2 truncate font-semibold text-ink">
                    {entry ? (entry.isYou ? 'You' : entry.name) : '—'}
                  </p>
                  {entry ? (
                    <>
                      <p className="ui-figure mt-3 text-2xl text-ink">{entry.referrals} referrals</p>
                      <p className="mt-1 text-sm text-success">
                        {entry.conversionPercent}% ordered · #{entry.overallRank} overall
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-ink-muted">No qualifying ambassador yet</p>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="ui-panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border p-5">
            <div>
              <p className="ui-eyebrow mb-1">Ranked by total referrals</p>
              <h2 className="text-xl text-ink">Top 10</h2>
            </div>
            <Trophy className="h-5 w-5 text-warning" />
          </div>

          {data.topTen.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-ink-muted" />
              <p className="font-medium text-ink">No referrals on the board yet</p>
              <p className="mt-1 text-sm text-ink-secondary">Share your referral link to claim the first spot.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-surface text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Rank</th>
                    <th className="px-5 py-3 font-medium">Ambassador</th>
                    <th className="px-5 py-3 text-right font-medium">Referred</th>
                    <th className="px-5 py-3 text-right font-medium">Ordered</th>
                    <th className="px-5 py-3 text-right font-medium">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topTen.map(entry => (
                    <tr key={entry.rank} className={entry.isYou ? 'bg-primary/5' : 'bg-card'}>
                      <td className="px-5 py-4 font-mono text-sm text-ink-muted">#{entry.rank}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-ink">
                        {entry.isYou ? 'You' : entry.name}
                        {entry.isMegaTop && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
                            Mega Top
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-ink">{entry.referrals}</td>
                      <td className="px-5 py-4 text-right text-sm text-ink-secondary">{entry.orderedReferrals}</td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-success">
                        {entry.conversionPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border border-ink bg-slab p-5 text-slab-fg">
          <p className="ui-eyebrow mb-2 !text-slab-fg/55">Your position</p>
          {data.myPosition ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="ui-figure text-3xl">{ordinal(data.myPosition.rank)}</p>
                <p className="mt-1 text-sm text-slab-fg/65">
                  {data.myPosition.isMegaTop ? 'You are a Mega Top Ambassador.' : 'Keep referring to climb the board.'}
                </p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="ui-figure text-xl">{data.myPosition.referrals}</p>
                  <p className="text-xs text-slab-fg/55">referred</p>
                </div>
                <div>
                  <p className="ui-figure text-xl">{data.myPosition.orderedReferrals}</p>
                  <p className="text-xs text-slab-fg/55">ordered</p>
                </div>
                <div>
                  <p className="ui-figure text-xl">{data.myPosition.conversionPercent}%</p>
                  <p className="text-xs text-slab-fg/55">conversion</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-lg font-semibold">Not ranked yet</p>
              <p className="mt-1 text-sm text-slab-fg/65">You have referred 0 people so far.</p>
            </div>
          )}
        </section>

        <p className="text-center text-xs leading-relaxed text-ink-muted">
          Field-marketer signups and regular referral-code signups both count. Mega Top status is awarded only to
          qualifying ambassadors who are already in the top 10; one referral alone cannot qualify.
        </p>
      </Shell>
    </div>
  )
}
