/**
 * The original keyword engine from the Bolt prototype, kept unchanged and used
 * only as the baseline in the evaluation (scripts/eval.ts). The app no longer
 * uses it.
 */
export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';

export interface EmailInput {
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
  domain_age_days?: number | null;
  spf_dkim_dmarc_pass?: boolean | null;
}

export interface RedFlag {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detail: string;
}

export interface AnalysisResult {
  risk_score: number;
  verdict: Verdict;
  red_flags: RedFlag[];
  summary: string;
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
  domain_age_days: number | null;
  spf_dkim_dmarc_pass: boolean | null;
  source: 'heuristic' | 'ai' | 'merged';
}

const WELL_KNOWN_DOMAINS = [
  'google.com', 'gmail.com', 'microsoft.com', 'apple.com',
  'amazon.com', 'stripe.com', 'paypal.com', 'linkedin.com',
  'github.com', 'dropbox.com', 'slack.com', 'zoom.us',
  'sequoiacap.com', 'a16z.com', 'ycombinator.com', 'foundersfund.com',
  'andrewsenior.com', 'bessemer.com', 'lightspeedvp.com',
  'coinbase.com', 'binance.com', 'chase.com', 'bankofamerica.com',
  'wellsfargo.com', 'citi.com', 'venmo.com', 'walmart.com',
  'ups.com', 'fedex.com', 'dhl.com', 'usps.com',
];

const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorte.st',
  'tiny.cc', 'rb.gy', 's.id', 'lnkd.in',
];

const URGENCY_PATTERNS = [
  { regex: /\b(by (end of day|EOD|tomorrow|tonight|today))\b/i, weight: 'high', label: 'Deadline pressure' },
  { regex: /\b(urgent|immediately|right away|ASAP|as soon as possible)\b/i, weight: 'high', label: 'Urgency language' },
  { regex: /\b(act now|don'?t delay|time.?sensitive|expires?)\b/i, weight: 'medium', label: 'Time pressure' },
  { regex: /\b(limited.?time|last chance|final notice|overdue)\b/i, weight: 'medium', label: 'Scarcity pressure' },
  { regex: /\b(within \d+ hours?|in the next \d+ minutes?)\b/i, weight: 'high', label: 'Arbitrary deadline' },
];

const FINANCIAL_PATTERNS = [
  { regex: /\b(wire|wire transfer|bank transfer|wire funds?)\b/i, weight: 'critical', label: 'Wire transfer request' },
  { regex: /\b(send (money|payment|funds?))\b/i, weight: 'high', label: 'Payment request' },
  { regex: /\b(gift card|iTunes card|Google Play card|Amazon card)\b/i, weight: 'critical', label: 'Gift card request' },
  { regex: /\b(crypto|bitcoin|BTC|ethereum|ETH|wallet address)\b/i, weight: 'high', label: 'Cryptocurrency request' },
  { regex: /\b(invoice|payment (is |was )?due|outstanding balance|overdue payment)\b/i, weight: 'medium', label: 'Invoice pressure' },
  { regex: /\b(\$[\d,]+|€[\d,]+|£[\d,]+)\b/g, weight: 'low', label: 'Specific dollar amount' },
];

const AUTHORITY_PATTERNS = [
  { regex: /\b(I am (the |a )?(CEO|CFO|CTO|founder|partner|managing director))\b/i, weight: 'medium', label: 'Authority claim' },
  { regex: /\b(on behalf of|representing|authorized by)\b/i, weight: 'medium', label: 'Third-party representation' },
  { regex: /\b(legal (department|counsel|team)|compliance (team|department|office))\b/i, weight: 'medium', label: 'Legal/compliance intimidation' },
  { regex: /\b(account (will be|has been) (suspended|terminated|closed|locked|disabled))\b/i, weight: 'high', label: 'Account threat' },
  { regex: /\b(verify (your |the )?(identity|account|information))\b/i, weight: 'medium', label: 'Verification request' },
];

const INVESTMENT_SCAM_PATTERNS = [
  { regex: /\b(seed (round|investment|check|funding))\b/i, weight: 'high', label: 'Seed investment offer' },
  { regex: /\b(term sheet|investment offer|funding offer)\b/i, weight: 'high', label: 'Investment document lure' },
  { regex: /\b(fast.?track|expedited|pre.?approved)\b/i, weight: 'medium', label: 'Fast-track investment pressure' },
  { regex: /\b(venture capitalist|VC|angel investor|partner at)\b/i, weight: 'low', label: 'Investor identity claim' },
  { regex: /\b(pitch deck|business plan|financials?)\b/i, weight: 'low', label: 'Business document request' },
  { regex: /\b(secure portal|document portal|review (here|at this link))\b/i, weight: 'high', label: 'Portal link lure' },
  { regex: /\b(co.?founder|business partner|associate|assistant)\b/i, weight: 'low', label: 'Associate impersonation' },
];

const CREDENTIAL_PATTERNS = [
  { regex: /\b(log ?in|sign ?in|authenticate|verify password)\b/i, weight: 'medium', label: 'Login prompt' },
  { regex: /\b(password|passcode|PIN|2FA|two.?factor|verification code)\b/i, weight: 'high', label: 'Credential request' },
  { regex: /\b(reset (your )?(password|account)|update (your )?(credentials|login))\b/i, weight: 'high', label: 'Password reset lure' },
  { regex: /\b(account (suspended|locked|compromised|breached))\b/i, weight: 'high', label: 'Account compromise scare' },
];

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function extractDomain(email: string): string | null {
  const match = email.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : null;
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  return text.match(urlRegex) || [];
}

function checkTyposquatting(domain: string): { isTyposquat: boolean; target?: string; distance: number } {
  for (const known of WELL_KNOWN_DOMAINS) {
    if (domain === known) return { isTyposquat: false, distance: 0 };
    const distance = levenshtein(domain, known);
    const threshold = known.length <= 8 ? 1 : 2;
    if (distance > 0 && distance <= threshold) {
      return { isTyposquat: true, target: known, distance };
    }
  }
  return { isTyposquat: false, distance: -1 };
}

const SEVERITY_POINTS: Record<string, number> = {
  low: 8,
  medium: 18,
  high: 30,
  critical: 45,
};

function computeScore(flags: RedFlag[]): { score: number; verdict: Verdict } {
  let score = 0;
  const categoryWeights: Record<string, number> = {};
  for (const flag of flags) {
    const base = SEVERITY_POINTS[flag.severity] || 10;
    const prev = categoryWeights[flag.category] || 0;
    const contribution = Math.round(base * Math.max(0.4, 1 - prev * 0.2));
    score += contribution;
    categoryWeights[flag.category] = prev + 1;
  }
  score = Math.min(100, score);
  let verdict: Verdict = 'SAFE';
  if (score >= 60) verdict = 'DANGEROUS';
  else if (score >= 25) verdict = 'SUSPICIOUS';
  return { score, verdict };
}

function buildSummary(flags: RedFlag[], input: EmailInput): string {
  const hasFinancial = flags.some(f => f.category === 'Financial Request');
  const hasInvestor = flags.some(f => f.category === 'Investment Scam');
  const hasCredential = flags.some(f => f.category === 'Credential Theft');
  const hasTyposquat = flags.some(f => f.category === 'Domain Impersonation');
  const hasUrgency = flags.some(f => f.category === 'Urgency / Pressure');
  const hasTooGood = flags.some(f => f.category === 'Too Good to Be True');
  const sender = input.sender_name || input.sender_email || 'The sender';

  if (hasTyposquat && hasInvestor) {
    return `${sender} is impersonating a known brand or organization. The domain is a lookalike designed to fool you into trusting it.`;
  }
  if (hasTyposquat && hasCredential) {
    return `${sender} is spoofing a well-known brand to steal your login. The domain looks real at a glance but is not the real thing.`;
  }
  if (hasInvestor && hasFinancial) {
    return `${sender} is using a fake investment offer to pressure you into sending money or clicking a malicious link.`;
  }
  if (hasInvestor) {
    return `${sender} is dangling a fake investment opportunity to lure you into clicking a dangerous link or sharing sensitive documents.`;
  }
  if (hasCredential && hasTyposquat) {
    return `${sender} is trying to steal your credentials through a spoofed domain. Do not enter your password anywhere this email links to.`;
  }
  if (hasCredential) {
    return `${sender} is trying to steal your login credentials by directing you to a fake sign-in page.`;
  }
  if (hasFinancial && hasUrgency) {
    return `${sender} is creating false urgency around a payment request to make you act before you can verify it.`;
  }
  if (hasTooGood && hasFinancial) {
    return `${sender} is dangling money or prizes and asking for financial details. That combination is a textbook scam.`;
  }
  if (hasTooGood) {
    return `${sender} is offering something that sounds way too good to be true. It almost certainly is.`;
  }
  if (hasFinancial) {
    return `${sender} is requesting a financial transaction. Verify the request through a known, separate channel before you do anything.`;
  }
  if (hasUrgency) {
    return `${sender} is using urgency tactics to pressure you into acting quickly without thinking it through.`;
  }
  if (flags.length > 0) {
    return `${sender} shows some suspicious patterns. Proceed with caution and verify through a separate channel.`;
  }
  return `${sender} appears to be a legitimate email with no significant red flags detected.`;
}

export function analyzeEmail(input: EmailInput): AnalysisResult {
  const flags: RedFlag[] = [];
  const domain = extractDomain(input.sender_email);
  const bodyText = input.body || '';
  const fullText = `${input.subject || ''} ${bodyText}`.trim();
  const urls = extractUrls(fullText);

  if (domain) {
    const typoCheck = checkTyposquatting(domain);
    if (typoCheck.isTyposquat && typoCheck.target) {
      flags.push({
        category: 'Domain Impersonation',
        severity: 'critical',
        description: `Lookalike domain detected: "${domain}" mimics "${typoCheck.target}"`,
        detail: `The sender domain "${domain}" differs from the legitimate "${typoCheck.target}" by only ${typoCheck.distance} character(s). This is a classic typosquatting technique used to impersonate trusted brands.`,
      });
    }

    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.click', '.country', '.stream'];
    if (suspiciousTlds.some(tld => domain.endsWith(tld))) {
      flags.push({
        category: 'Domain Reputation',
        severity: 'medium',
        description: `Sender uses a high-risk TLD: ${domain}`,
        detail: `The domain "${domain}" uses a top-level domain frequently associated with spam and phishing campaigns. Legitimate businesses rarely use these TLDs.`,
      });
    }

    if (input.domain_age_days != null && input.domain_age_days >= 0 && input.domain_age_days <= 30) {
      flags.push({
        category: 'Domain Reputation',
        severity: input.domain_age_days <= 7 ? 'critical' : 'high',
        description: `Sender domain was registered only ${input.domain_age_days} day(s) ago`,
        detail: `The domain "${domain}" was registered just ${input.domain_age_days} day(s) ago. Established companies and organizations use domains that have been around for years. A freshly registered domain is a classic phishing tell.`,
      });
    }

    const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'protonmail.com', 'icloud.com', 'aol.com'];
    if (freeProviders.includes(domain) && /\b(partner|investor|VC|venture|capital|firm|fund|term sheet|seed|CEO|CFO|director|manager|HR|recruiter)\b/i.test(fullText)) {
      flags.push({
        category: 'Domain Impersonation',
        severity: 'high',
        description: `Official-sounding claim from a free email provider (${domain})`,
        detail: `The sender claims to hold a business role but is using a free email provider. Real companies and firms use corporate domains for official business. Be skeptical of business propositions from @gmail.com or @yahoo.com addresses.`,
      });
    }
  }

  if (input.spf_dkim_dmarc_pass === false) {
    flags.push({
      category: 'Email Authentication',
      severity: 'high',
      description: 'Email failed SPF/DKIM/DMARC authentication',
      detail: 'This email failed standard email authentication checks (SPF, DKIM, or DMARC). The sender could not cryptographically prove they are authorized to send from this domain. That is a strong indicator of spoofing.',
    });
  }

  for (const url of urls) {
    const urlLower = url.toLowerCase();
    for (const shortener of URL_SHORTENERS) {
      if (urlLower.includes(shortener)) {
        flags.push({
          category: 'Link Safety',
          severity: 'high',
          description: `Shortened/obfuscated link detected: ${shortener}`,
          detail: `The email contains a shortened URL (${shortener}) that hides the real destination. Attackers use link shorteners to conceal malicious URLs. Hover or use a link expander before clicking.`,
        });
        break;
      }
    }
    if (/https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
      flags.push({
        category: 'Link Safety',
        severity: 'critical',
        description: 'Link points to a raw IP address instead of a domain',
        detail: `The URL "${url}" points directly to an IP address instead of a named domain. Legitimate services use domain names. Raw IP URLs are almost always malicious.`,
      });
    }
    if (url.includes('@') && !url.match(/^https?:\/\/[^@]*@/)) {
      const atIndex = url.indexOf('@', 8);
      if (atIndex > 0) {
        flags.push({
          category: 'Link Safety',
          severity: 'high',
          description: 'URL contains an @ symbol (possible redirect trick)',
          detail: `The URL "${url}" contains an @ symbol in the path, a technique used to trick you into thinking you're going to one site when you're actually redirected to another.`,
        });
      }
    }
  }

  for (const pattern of URGENCY_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      flags.push({
        category: 'Urgency / Pressure',
        severity: pattern.weight as RedFlag['severity'],
        description: `${pattern.label}: "${match[0]}"`,
        detail: `The email uses urgency language ("${match[0]}") to pressure you into acting quickly. Attackers manufacture time pressure so you don't have time to verify the request.`,
      });
      break;
    }
  }

  for (const pattern of FINANCIAL_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      flags.push({
        category: 'Financial Request',
        severity: pattern.weight as RedFlag['severity'],
        description: `${pattern.label}: "${match[0]}"`,
        detail: `The email references financial transactions ("${match[0]}"). ${pattern.weight === 'critical' ? 'This is a high-risk pattern. Wire transfers and gift cards are the number one BEC attack vector.' : 'Verify any financial request through a known, separate communication channel.'}`,
      });
    }
  }

  for (const pattern of AUTHORITY_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      flags.push({
        category: 'Authority Claim',
        severity: pattern.weight as RedFlag['severity'],
        description: `${pattern.label}: "${match[0]}"`,
        detail: `The sender invokes authority ("${match[0]}") to make you compliant. Social engineers claim positions of power to bypass your skepticism.`,
      });
      break;
    }
  }

  for (const pattern of INVESTMENT_SCAM_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      flags.push({
        category: 'Investment Scam',
        severity: pattern.weight as RedFlag['severity'],
        description: `${pattern.label}: "${match[0]}"`,
        detail: `The email uses investment-related language ("${match[0]}") to bait you. Fake investor emails are a growing attack vector. Real investors do not rush unsolicited term sheets or funding offers to strangers.`,
      });
    }
  }

  for (const pattern of CREDENTIAL_PATTERNS) {
    const match = fullText.match(pattern.regex);
    if (match) {
      flags.push({
        category: 'Credential Theft',
        severity: pattern.weight as RedFlag['severity'],
        description: `${pattern.label}: "${match[0]}"`,
        detail: `The email tries to steer you toward entering credentials ("${match[0]}"). Credential phishing is the most common attack. Never log in through a link in an email.`,
      });
      break;
    }
  }

  if (/\b(dear (sir|madam|valued customer|friend|account holder))\b/i.test(bodyText)) {
    flags.push({
      category: 'Language Anomaly',
      severity: 'medium',
      description: 'Generic greeting instead of your name',
      detail: 'The email uses a generic greeting ("Dear Sir/Madam", "Valued Customer") instead of addressing you by name. Legitimate contacts who reached your email know who you are.',
    });
  }

  if (domain) {
    const bodyDomains = extractUrls(bodyText).map(u => {
      const m = u.match(/https?:\/\/([^/]+)/);
      return m ? m[1].replace(/^www\./, '').toLowerCase() : null;
    }).filter(Boolean);
    if (bodyDomains.length > 0 && !bodyDomains.some(d => d === domain || (d && d.endsWith(`.${domain}`)))) {
      const mismatchDomain = bodyDomains[0];
      flags.push({
        category: 'Sender Mismatch',
        severity: 'high',
        description: `Links go to a different domain (${mismatchDomain}) than the sender (${domain})`,
        detail: `The email came from "${domain}" but the links point to "${mismatchDomain}". This mismatch is a hallmark of phishing. The sender is spoofed while the actual malicious payload lives elsewhere.`,
      });
    }
  }

  if (/\b((you'?ve (won|been selected|been chosen))|(congratulations|congrats)|(lottery|sweepstake|inheritance|beneficiary)|(free (gift|iPhone|prize|money)))\b/i.test(fullText)) {
    flags.push({
      category: 'Too Good to Be True',
      severity: 'high',
      description: 'Offers unrealistic rewards or prizes',
      detail: 'The email promises money, prizes, or gifts you did not sign up for. If it sounds too good to be true, it is. This is a classic lure to get you to click or share information.',
    });
  }

  const { score, verdict } = computeScore(flags);
  const summary = buildSummary(flags, input);

  return {
    risk_score: score,
    verdict,
    red_flags: flags,
    summary,
    sender_email: input.sender_email || '',
    sender_name: input.sender_name || '',
    subject: input.subject || '',
    body: input.body || '',
    domain_age_days: input.domain_age_days ?? null,
    spf_dkim_dmarc_pass: input.spf_dkim_dmarc_pass ?? null,
    source: 'heuristic',
  };
}

export interface ParsedEmail {
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
}

export function parseRawEmail(rawSender: string, rawContent: string): ParsedEmail {
  let sender_email = '';
  let sender_name = '';

  const senderStr = rawSender.trim();

  const nameEmailMatch = senderStr.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (nameEmailMatch) {
    sender_name = nameEmailMatch[1].replace(/^["']|["']$/g, '').trim();
    sender_email = nameEmailMatch[2].trim();
  } else {
    const emailMatch = senderStr.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      sender_email = emailMatch[0];
      const before = senderStr.substring(0, emailMatch.index).trim();
      sender_name = before.replace(/^["']|["']$/g, '').trim();
    } else {
      sender_name = senderStr;
    }
  }

  const content = rawContent.trim();
  let subject = '';
  let body = content;

  const subjectMatch = content.match(/^subject:\s*(.+)$/im);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    body = content.replace(/^subject:\s*.+\r?\n?/im, '').trim();
  }

  if (!sender_email) {
    const fromMatch = content.match(/^from:\s*(.+)$/im);
    if (fromMatch) {
      const fromStr = fromMatch[1].trim();
      const innerEmail = fromStr.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (innerEmail) {
        sender_email = innerEmail[0];
        const innerName = fromStr.match(/^(.*?)\s*</);
        if (innerName && innerName[1]) {
          sender_name = innerName[1].replace(/^["']|["']$/g, '').trim();
        }
      }
    }
  }

  body = body.replace(/^(from|to|date|reply-to):\s*.+\r?\n/gim, '').trim();

  return { sender_email, sender_name, subject, body };
}

function deduplicateFlags(flags: RedFlag[]): RedFlag[] {
  const seen = new Set<string>();
  const result: RedFlag[] = [];
  for (const flag of flags) {
    const key = `${flag.category}-${flag.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(flag);
    }
  }
  return result;
}

function mergeResults(heuristic: AnalysisResult, ai: AnalysisResult): AnalysisResult {
  const mergedFlags = deduplicateFlags([...heuristic.red_flags, ...ai.red_flags]);

  const aiScore = ai.risk_score;
  const heurScore = heuristic.risk_score;
  const mergedScore = Math.round(Math.max(aiScore * 0.7 + heurScore * 0.3, heurScore));

  let verdict: Verdict = 'SAFE';
  if (mergedScore >= 60) verdict = 'DANGEROUS';
  else if (mergedScore >= 25) verdict = 'SUSPICIOUS';

  const summary = ai.summary || heuristic.summary;

  return {
    risk_score: Math.min(100, mergedScore),
    verdict,
    red_flags: mergedFlags,
    summary,
    sender_email: heuristic.sender_email,
    sender_name: heuristic.sender_name,
    subject: heuristic.subject,
    body: heuristic.body,
    domain_age_days: heuristic.domain_age_days,
    spf_dkim_dmarc_pass: heuristic.spf_dkim_dmarc_pass,
    source: 'merged',
  };
}

export async function analyzeWithAI(input: EmailInput): Promise<AnalysisResult> {
  const heuristic = analyzeEmail(input);

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-email`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sender_email: input.sender_email,
        sender_name: input.sender_name,
        subject: input.subject,
        body: input.body,
      }),
    });

    if (!response.ok) {
      console.warn('AI analysis failed, falling back to heuristic only:', response.status);
      return heuristic;
    }

    const data = await response.json();

    if (data.error) {
      console.warn('AI analysis returned error:', data.error);
      return heuristic;
    }

    const aiResult: AnalysisResult = {
      risk_score: typeof data.risk_score === 'number' ? data.risk_score : 0,
      verdict: ['SAFE', 'SUSPICIOUS', 'DANGEROUS'].includes(data.verdict) ? data.verdict : 'SAFE',
      red_flags: Array.isArray(data.red_flags) ? data.red_flags : [],
      summary: typeof data.summary === 'string' ? data.summary : '',
      sender_email: input.sender_email,
      sender_name: input.sender_name,
      subject: input.subject,
      body: input.body,
      domain_age_days: input.domain_age_days ?? null,
      spf_dkim_dmarc_pass: input.spf_dkim_dmarc_pass ?? null,
      source: 'ai',
    };

    return mergeResults(heuristic, aiResult);
  } catch (err) {
    console.warn('AI analysis unavailable, using heuristic only:', err);
    return heuristic;
  }
}

export const SAMPLE_EMAILS: { label: string; tag: 'danger' | 'suspicious' | 'safe'; sender: string; content: string; domain_age_days?: number; spf_dkim_dmarc_pass?: boolean }[] = [
  {
    label: 'Fake Investment Pitch',
    tag: 'danger',
    sender: 'John Doe <partner@sequoia-cap-seed.com>',
    content: 'Subject: Urgent: Direct Investment & Term Sheet for your startup\n\nHey,\n\nLoved your launch on Product Hunt. We want to fast-track a $250k seed check into your round. Review our standard term sheet on this secure portal: https://bit.ly/3xYp9kQ\n\nLet me know by EOD if you can sign so we can wire the funds.\n\nBest,\nJohn Doe\nPartner, Sequoia Capital Seed',
    domain_age_days: 2,
    spf_dkim_dmarc_pass: false,
  },
  {
    label: 'Package Delivery Scam',
    tag: 'danger',
    sender: 'UPS Delivery <notifications@ups-track.info>',
    content: 'Subject: Your package could not be delivered - action required\n\nDear Customer,\n\nWe attempted to deliver your package but no one was available. Your package is being held at our facility. Please confirm your delivery details and pay a small redelivery fee of $1.99 to reschedule.\n\nClick here to update your information: http://192.168.44.21/ups-redelivery\n\nFailure to respond within 48 hours will result in the package being returned to sender.\n\nUPS Customer Service',
    domain_age_days: 3,
    spf_dkim_dmarc_pass: false,
  },
  {
    label: 'Account Compromise Scare',
    tag: 'suspicious',
    sender: 'Google Security <no-reply@accounts-google.com>',
    content: 'Subject: Your account has been compromised - verify immediately\n\nDear User,\n\nWe have detected suspicious activity on your Google account. Your account will be suspended within 24 hours unless you verify your identity.\n\nPlease log in and reset your password here: http://203.0.113.45/verify\n\nGoogle Security Team',
    domain_age_days: 5,
    spf_dkim_dmarc_pass: false,
  },
  {
    label: 'Legitimate Email',
    tag: 'safe',
    sender: 'Sarah Chen <sarah.chen@gmail.com>',
    content: 'Subject: Great meeting you at the conference!\n\nHi,\n\nIt was great meeting you at the conference yesterday. I\'d love to grab coffee next week and talk about what you\'re building. Let me know what works for you.\n\nBest,\nSarah',
  },
];
