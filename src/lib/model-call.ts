/**
 * The server half of Aegis: one request in, one model answer out. Shared by
 * the Vercel function (production) and the Vite dev middleware, so the same
 * code runs in both. Uses only fetch and JSON, no runtime-specific APIs.
 */
import {
  DEFAULT_MODEL,
  extractGeminiText,
  geminiRequestBody,
  geminiUrl,
  normaliseModelResult,
  type PromptEmail,
  type PromptSignal,
} from './prompt.js';

export const MAX_REQUEST_BYTES = 64_000;

export interface ModelEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

export interface ModelResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function analyzeRequest(raw: string, env: ModelEnv): Promise<ModelResponse> {
  if (raw.length > MAX_REQUEST_BYTES) return { status: 413, body: { error: 'Email too large' } };

  let email: PromptEmail | undefined;
  let signals: PromptSignal[] | null = null;
  try {
    const parsed = JSON.parse(raw) as { email?: PromptEmail; signals?: PromptSignal[] | null };
    email = parsed.email;
    signals = Array.isArray(parsed.signals) ? parsed.signals : null;
  } catch {
    return { status: 400, body: { error: 'Request is not valid JSON' } };
  }
  if (!email || (!email.sender_email && !email.subject && !email.body)) {
    return { status: 400, body: { error: 'Missing email content' } };
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return { status: 503, body: { error: 'AI analysis is not configured' } };
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(geminiUrl(model), {
      method: 'POST',
      // key in a header, not the URL, so it never lands in access logs
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(geminiRequestBody(email, signals)),
    });
    if (!res.ok) {
      console.error('Gemini API error', res.status, await res.text());
      return { status: 502, body: { error: 'AI analysis failed' } };
    }
    const text = extractGeminiText(await res.json());
    if (!text) return { status: 502, body: { error: 'AI returned no analysis' } };
    return { status: 200, body: { ...normaliseModelResult(text), model } };
  } catch (err) {
    console.error('analyze-email error', err);
    return { status: 500, body: { error: 'Something went wrong during analysis' } };
  }
}
