/**
 * Verified technical signals: facts code can establish without judgement.
 * They are passed to the model as evidence, and only the high-precision ones
 * set a minimum score (see FLOORS and docs/EVALUATION.md for how they were chosen).
 */
import { parse as parseDomain } from 'tldts';
import { AMBIGUOUS_IN_NAMES, BRANDS, URL_SHORTENERS } from './brands';
import type { EmailInput, Severity, Signal, SignalId } from './types';

/**
 * Minimum score per signal. Set from per-signal precision measured on the
 * development split of the evaluation corpus, never on the test split.
 */
export const FLOORS: Record<SignalId, number> = {
  RAW_IP_LINK: 60,
  URL_USERINFO: 60,
  BRAND_LOOKALIKE_SENDER: 60,
  BRAND_LOOKALIKE_LINK: 60,
  DISPLAY_NAME_SPOOF: 40,
  PUNYCODE_DOMAIN: 40,
  AUTH_FAIL: 40,
  SHORTENED_LINK: 0,
  LINK_DOMAIN_MISMATCH: 0,
};

const URL_RE = /\bhttps?:\/\/[^\s<>"'()[\]{}]+/gi;

export function extractUrls(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(URL_RE) || []) out.add(m.replace(/[.,;:!?]+$/, ''));
  return [...out];
}

function hostOf(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function registrableDomain(hostOrEmailDomain: string): string | null {
  const p = parseDomain(hostOrEmailDomain.toLowerCase());
  return p.domain || null;
}

export function senderDomain(email: string): string | null {
  const m = email.match(/@([\w.-]+)\s*$/);
  return m ? m[1].toLowerCase().replace(/\.$/, '') : null;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function isOfficialFor(brand: string, domain: string): boolean {
  const p = parseDomain(domain);
  if (!p.domain) return false;
  return BRANDS[brand].includes(p.domain) || p.domainWithoutSuffix === brand;
}

/**
 * Brand a hostname is pretending to be, or null. A hostname impersonates a
 * brand when one of its label tokens IS the brand (or one edit away, for
 * brands of 6+ letters) but its registrable domain is not an official one.
 * Tokens are whole pieces between dots, hyphens and digits, so "upstart.com"
 * does not match "ups" and "amazonses.com" does not match "amazon".
 */
export function impersonatedBrand(hostname: string): string | null {
  const p = parseDomain(hostname.toLowerCase());
  if (!p.domain || p.isIp) return null;
  const labels = [p.subdomain || '', p.domainWithoutSuffix || ''].join('.');
  const tokens = labels.split(/[.\-_\d]+/).filter(Boolean);
  for (const brand of Object.keys(BRANDS)) {
    // one-edit typosquats must keep the first letter: paypa1, amazom, netfix
    // (without this, finance~binance and gcloud~icloud match)
    const hit = tokens.some(t => t === brand || (brand.length >= 6 && t.length >= 5 && t[0] === brand[0] && levenshtein(t, brand) === 1));
    if (hit && !isOfficialFor(brand, p.domain)) return brand;
  }
  return null;
}

function brandInDisplayName(name: string): string | null {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const joined = words.join('');
  for (const brand of Object.keys(BRANDS)) {
    if (AMBIGUOUS_IN_NAMES.has(brand)) continue;
    if (words.includes(brand) || (brand.length >= 9 && joined.includes(brand))) return brand;
  }
  return null;
}

function authFailure(headers: string | undefined): string | null {
  if (!headers) return null;
  const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ');
  const lines = unfolded.split(/\r?\n/).filter(l => /^(authentication-results|arc-authentication-results):/i.test(l));
  for (const l of lines) {
    const m = l.match(/\b(spf|dkim|dmarc)=(fail|softfail|permerror)\b/i);
    if (m) return `${m[1].toLowerCase()}=${m[2].toLowerCase()}`;
  }
  return null;
}

function sig(id: SignalId, severity: Severity, description: string, detail: string): Signal {
  return { id, severity, description, detail, floor: FLOORS[id] };
}

export function computeSignals(input: EmailInput): Signal[] {
  const out: Signal[] = [];
  const sDomain = senderDomain(input.sender_email || '');
  const sReg = sDomain ? registrableDomain(sDomain) : null;
  const urls = extractUrls(`${input.subject || ''}\n${input.body || ''}`);

  if (sDomain) {
    const b = impersonatedBrand(sDomain);
    if (b) out.push(sig('BRAND_LOOKALIKE_SENDER', 'critical', `Sender domain "${sDomain}" imitates ${b}`,
      `The sender's domain contains "${b}" but is not one of ${b}'s real domains. Lookalike domains are registered to borrow a brand's trust.`));
    if (sDomain.includes('xn--')) out.push(sig('PUNYCODE_DOMAIN', 'high', `Sender domain uses an encoded international name (${sDomain})`,
      'Internationalised (punycode) domains can display as letters that look identical to a real brand.'));
  }

  if (input.sender_name && sReg) {
    const b = brandInDisplayName(input.sender_name);
    if (b && !isOfficialFor(b, sReg)) out.push(sig('DISPLAY_NAME_SPOOF', 'high', `Name says "${input.sender_name}" but the address is @${sDomain}`,
      `The display name claims to be ${b}, but the email was sent from ${sReg}, which is not a ${b} domain. Mail clients often show only the name.`));
  }

  const linkRegs = new Set<string>();
  let ip = false, userinfo = false, shortener: string | null = null, puny: string | null = null, linkBrand: [string, string] | null = null;
  for (const u of urls) {
    const url = hostOf(u);
    if (!url) continue;
    const host = url.hostname.toLowerCase();
    const p = parseDomain(host);
    if (p.isIp || /^\[?[0-9a-f:]+\]?$/i.test(host)) ip = true;
    if (url.username) userinfo = true;
    if (p.domain) {
      linkRegs.add(p.domain);
      if (URL_SHORTENERS.has(p.domain) || URL_SHORTENERS.has(host)) shortener = shortener || p.domain;
    }
    if (host.includes('xn--')) puny = puny || host;
    const b = impersonatedBrand(host);
    if (b && !linkBrand) linkBrand = [host, b];
  }
  if (ip) out.push(sig('RAW_IP_LINK', 'critical', 'A link points to a raw IP address',
    'Legitimate services link to named domains. A bare IP address hides who runs the server.'));
  if (userinfo) out.push(sig('URL_USERINFO', 'critical', 'A link hides its real destination with an @',
    'In a URL like https://brand.com@evil.example, everything before the @ is ignored. The browser goes to the part after it.'));
  if (linkBrand) out.push(sig('BRAND_LOOKALIKE_LINK', 'critical', `Link to "${linkBrand[0]}" imitates ${linkBrand[1]}`,
    `The link contains "${linkBrand[1]}" but does not go to one of ${linkBrand[1]}'s real domains.`));
  if (puny) out.push(sig('PUNYCODE_DOMAIN', 'high', `A link uses an encoded international domain (${puny})`,
    'Punycode domains can render as characters that look identical to a trusted brand.'));
  if (shortener) out.push(sig('SHORTENED_LINK', 'medium', `A link uses the shortener ${shortener}`,
    'Shortened links hide the real destination until you click.'));
  // LINK_DOMAIN_MISMATCH is not emitted: on the development split it fired on
  // 71% of legitimate mail and 45% of phishing, so it points the wrong way.

  const auth = authFailure(input.headers);
  if (auth) out.push(sig('AUTH_FAIL', 'high', `Email authentication failed (${auth})`,
    'The receiving server recorded a failed SPF, DKIM or DMARC check, so the sender could not prove it is allowed to send for this domain.'));

  // a signal type appears once
  const seen = new Set<string>();
  return out.filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function signalFloor(signals: Signal[]): number {
  return signals.reduce((m, s) => Math.max(m, s.floor), 0);
}
