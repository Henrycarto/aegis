import { combine } from './scoring';
import { computeSignals } from './signals';
import type { AiAssessment, AnalysisResult, EmailInput, Signal } from './types';

export { parseRawEmail } from './parse';
export { SAMPLE_EMAILS } from './samples';
export type { AnalysisResult, EmailInput, RedFlag, Signal } from './types';

async function askModel(input: EmailInput, signals: Signal[]): Promise<AiAssessment | null> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/functions/v1/analyze-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        email: { sender_email: input.sender_email, sender_name: input.sender_name, subject: input.subject, body: input.body },
        signals: signals.map(s => ({ id: s.id, severity: s.severity, description: s.description })),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || typeof data.risk_score !== 'number') return null;
    return { risk_score: data.risk_score, verdict: data.verdict, summary: data.summary ?? '', red_flags: data.red_flags ?? [] };
  } catch {
    return null;
  }
}

export async function analyze(input: EmailInput): Promise<AnalysisResult> {
  const signals = computeSignals(input);
  const ai = await askModel(input, signals);
  return combine(input, signals, ai);
}
