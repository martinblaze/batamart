// lib/notify/email-drafts.ts
// Turns the short push text an admin types into a full email, automatically
// and with no AI: it works out what the message is about and builds the email
// from the admin's own words plus facts that are true of BataMart today. Pure
// functions, so the admin page can run it live as the admin types.
//
// The topic library lives in email-topics.ts. To teach it something new, add a
// topic there; nothing else changes.

import { EMAIL_TOPICS, type EmailTopic } from '@/lib/notify/email-topics'

export interface DraftInput {
  title: string
  message: string
  url?: string
  /** Force a topic instead of detecting one (a key from email-topics.ts). */
  topic?: string
}

export interface EmailDraft {
  subject: string
  heading: string
  /** Paragraphs separated by a blank line. */
  body: string
  button: string
  topic: string
  topicLabel: string
}

const GENERAL: EmailTopic = {
  key: 'general',
  label: 'General',
  group: 'Platform',
  keywords: [],
  more: [
    'We have been working on BataMart to make buying and selling on campus simpler and safer.',
    'Your payment is protected until you confirm delivery, and deliveries run every Wednesday and Saturday.',
    'Open BataMart to see what is new.',
  ],
  button: 'Open BataMart',
}

const sentence = (text: string) => {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A keyword must start at the beginning of a word, so "earn" matches "earning"
// but not "learn". It may continue ("deal" matches "deals").
const countHits = (haystack: string, needle: string) => {
  if (!needle) return 0
  const pattern = /^[a-z0-9]/i.test(needle) ? `(^|[^a-z0-9])${escapeRegex(needle)}` : escapeRegex(needle)
  return (haystack.match(new RegExp(pattern, 'g')) ?? []).length
}

/** Best-matching topic. A hit in the link counts most (it is where the email sends people), then the title, then the message. */
export function detectTopic(input: Pick<DraftInput, 'title' | 'message' | 'url'>): EmailTopic {
  const title = input.title.toLowerCase()
  const message = input.message.toLowerCase()
  const url = (input.url ?? '').toLowerCase()

  let best: EmailTopic = GENERAL
  let bestScore = 0
  for (const topic of EMAIL_TOPICS) {
    let score = 0
    for (const keyword of topic.keywords) {
      const k = keyword.toLowerCase()
      // Longer, more specific phrases are worth more than single words.
      const weight = k.includes(' ') ? 2 : 1
      score += weight * (countHits(title, k) * 3 + countHits(url, k) * 4 + countHits(message, k))
    }
    if (score > bestScore) {
      best = topic
      bestScore = score
    }
  }
  return best
}

export function autoDraftEmail({ title, message, url = '', topic: forced }: DraftInput): EmailDraft {
  const cleanTitle = title.trim()
  const cleanMessage = message.trim()
  const topic = (forced && EMAIL_TOPICS.find(t => t.key === forced)) || detectTopic({ title: cleanTitle, message: cleanMessage, url })

  const lead = sentence(cleanMessage)
  // If the admin already wrote plenty, respect it and only add the closing line.
  const paragraphs =
    cleanMessage.length > 350
      ? [lead, topic.more[topic.more.length - 1]]
      : [lead, ...topic.more]

  return {
    subject: cleanTitle.slice(0, 60) || 'News from BataMart',
    heading: cleanTitle || 'News from BataMart',
    body: paragraphs.filter(Boolean).join('\n\n'),
    button: topic.button,
    topic: topic.key,
    topicLabel: topic.label,
  }
}
