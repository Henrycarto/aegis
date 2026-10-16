import type { VercelRequest, VercelResponse } from '@vercel/node';
import { analyzeRequest } from '../src/lib/model-call.js';

/**
 * POST /api/analyze-email. Same origin as the app, so no CORS. The Gemini
 * key is read from the Vercel environment and never reaches the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const { status, body } = await analyzeRequest(raw, process.env);
  return res.status(status).json(body);
}
