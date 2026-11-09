// lib/tickets/email-guard.ts — server-only.
// Guests buy tickets with just an email, and the tickets are delivered to it, so
// the address has to be a real, receiving one: not a throwaway inbox, and the
// domain must actually accept mail.

import { promises as dns } from 'dns'

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

// Well-known disposable / temporary inbox providers. Not exhaustive, which is
// why the MX check below also runs.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'guerrillamail.de',
  'sharklasers.com', 'grr.la', 'spam4.me', 'pokemail.net', '10minutemail.com', '10minutemail.net', '10minutemail.co.uk',
  '20minutemail.com', '30minutemail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmail.dev',
  'tempmailo.com', 'tempmailaddress.com', 'temporary-mail.net', 'tempinbox.com', 'throwawaymail.com', 'throwaway.email',
  'trashmail.com', 'trashmail.net', 'trashmail.de', 'trash-mail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc', 'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf', 'getnada.com', 'nada.email', 'nada.ltd', 'dispostable.com',
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mailtemp.info', 'mailforspam.com', 'mohmal.com', 'emailondeck.com',
  'fakeinbox.com', 'fakemail.net', 'fake-mail.net', 'fakemailgenerator.com', 'spamgourmet.com', 'spambox.us', 'spamex.com',
  'spamfree24.org', 'mytemp.email', 'mytrashmail.com', 'mintemail.com', 'getairmail.com', 'airmail.cc', 'inboxkitten.com',
  'burnermail.io', 'anonbox.net', 'anonymbox.com', 'binkmail.com', 'bobmail.info', 'bccto.me', 'cuvox.de', 'dayrep.com',
  'discard.email', 'discardmail.com', 'discardmail.de', 'dropmail.me', 'emailfake.com', 'emailtemporanea.com',
  'email-fake.com', 'ethereal.email', 'fixmail.tk', 'harakirimail.com', 'incognitomail.org', 'instantemailaddress.com',
  'jourrapide.com', 'kasmail.com', 'klzlk.com', 'letthemeatspam.com', 'mailexpire.com', 'mailmoat.com', 'mailnull.com',
  'mailsac.com', 'mailscrap.com', 'mailzilla.com', 'mt2014.com', 'mt2015.com', 'mvrht.com', 'objectmail.com',
  'proxymail.eu', 'rcpt.at', 'rmqkr.net', 'safetymail.info', 'sneakemail.com', 'sogetthis.com', 'tafmail.com',
  'tempail.com', 'tempe-mail.com', 'tempemail.co.za', 'tempemail.com', 'tempemail.net', 'tempr.email', 'thankyou2010.com',
  'trbvm.com', 'trialmail.de', 'wegwerfmail.de', 'wegwerfmail.net', 'wh4f.org', 'yuurok.com', 'zehnminutenmail.de',
  'zippymail.info', 'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'moakt.com', 'luxusmail.org', 'gmailnator.com',
  'minuteinbox.com', 'internxt.com', 'emltmp.com', 'tmailor.com', 'fexbox.org', 'fexpost.com', 'vomoto.com',
  'linshiyouxiang.net', 'cs.email', 'oneoffemail.com', 'smailpro.com', 'xoxy.net', 'mailpoof.com', 'emailnax.com',
])

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: string }

function lookupWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('DNS_TIMEOUT'), { code: 'DNS_TIMEOUT' })), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

/**
 * Accepts a normal, receiving email address. Rejects bad syntax, known
 * temporary-mail domains and domains with no mail server at all. If DNS itself
 * is unreachable we let the address through rather than block a real buyer.
 */
export async function checkEmailAllowed(raw: unknown): Promise<EmailCheck> {
  const email = normalizeEmail(raw)
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, reason: 'Enter a valid email address.' }

  const domain = email.slice(email.lastIndexOf('@') + 1)
  const parts = domain.split('.')
  // mail.tempmail.com should be caught as well as tempmail.com
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE.has(parts.slice(i).join('.'))) {
      return { ok: false, reason: 'Temporary email addresses are not allowed. Use your real email so your ticket reaches you.' }
    }
  }

  try {
    const mx = await lookupWithTimeout(dns.resolveMx(domain), 3500)
    if (mx.length > 0) return { ok: true, email }
  } catch (err: any) {
    if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') {
      // No MX: RFC says fall back to the domain's A record.
      try {
        const a = await lookupWithTimeout(dns.resolve4(domain), 3500)
        if (a.length > 0) return { ok: true, email }
      } catch {
        /* fall through to reject */
      }
      return { ok: false, reason: 'That email domain cannot receive mail. Check the spelling.' }
    }
    // Timeout or a resolver hiccup: do not block a real buyer.
    return { ok: true, email }
  }
  return { ok: false, reason: 'That email domain cannot receive mail. Check the spelling.' }
}
