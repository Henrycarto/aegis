import {
  DEFAULT_MODEL,
  extractGeminiText,
  geminiRequestBody,
  geminiUrl,
  normaliseModelResult,
  type PromptEmail,
  type PromptSignal,
} from '../_shared/prompt.ts';

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const MAX_REQUEST_BYTES = 64_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_BYTES) return json({ error: 'Email too large' }, 413);
    const { email, signals } = JSON.parse(raw) as { email: PromptEmail; signals: PromptSignal[] | null };
    if (!email || (!email.sender_email && !email.subject && !email.body)) {
      return json({ error: 'Missing email content' }, 400);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'AI analysis is not configured' }, 503);
    const model = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL;

    const res = await fetch(geminiUrl(model), {
      method: 'POST',
      // key in a header, not the URL, so it never lands in access logs
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(geminiRequestBody(email, Array.isArray(signals) ? signals : null)),
    });
    if (!res.ok) {
      console.error('Gemini API error', res.status, await res.text());
      return json({ error: 'AI analysis failed' }, 502);
    }
    const text = extractGeminiText(await res.json());
    if (!text) return json({ error: 'AI returned no analysis' }, 502);
    return json({ ...normaliseModelResult(text), model });
  } catch (err) {
    console.error('analyze-email error', err);
    return json({ error: 'Something went wrong during analysis' }, 500);
  }
});
