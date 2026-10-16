export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface EmailInput {
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
  /** Raw header block, when the user pasted the full source. Optional. */
  headers?: string;
}

/** A fact established by code, not by the model. */
export interface Signal {
  id: SignalId;
  severity: Severity;
  description: string;
  detail: string;
  /** Minimum risk score this signal guarantees (0 = evidence only). */
  floor: number;
}

export type SignalId =
  | 'RAW_IP_LINK'
  | 'URL_USERINFO'
  | 'BRAND_LOOKALIKE_SENDER'
  | 'BRAND_LOOKALIKE_LINK'
  | 'DISPLAY_NAME_SPOOF'
  | 'PUNYCODE_DOMAIN'
  | 'AUTH_FAIL'
  | 'SHORTENED_LINK'
  | 'LINK_DOMAIN_MISMATCH';

export interface RedFlag {
  category: string;
  severity: Severity;
  description: string;
  detail: string;
}

export interface AiAssessment {
  risk_score: number;
  verdict: Verdict;
  summary: string;
  red_flags: RedFlag[];
}

export interface AnalysisResult {
  risk_score: number;
  verdict: Verdict;
  summary: string;
  /** Model findings plus verified signals, for display. */
  red_flags: RedFlag[];
  signals: Signal[];
  ai: AiAssessment | null;
  /** 'ai' = model judged it; 'signals' = model unavailable, technical checks only. */
  source: 'ai' | 'signals';
  /** True when a verified signal raised the score above the model's. */
  floor_applied: boolean;
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
}

export function verdictFor(score: number): Verdict {
  if (score >= 60) return 'DANGEROUS';
  if (score >= 25) return 'SUSPICIOUS';
  return 'SAFE';
}
