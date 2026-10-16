import type { AnalysisResult, RedFlag } from './types';

/** Scan history, kept only in this browser (localStorage). Nothing is uploaded. */
export interface EmailAnalysisRecord {
  id: string;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  body: string | null;
  risk_score: number;
  verdict: string;
  red_flags: RedFlag[];
  summary: string | null;
  source?: 'ai' | 'signals';
  analyzed_at: string;
}

const STORAGE_KEY = 'aegis_analyses';
const MAX_RECORDS = 200;
const MAX_BODY_STORED = 4000;

function readAll(): EmailAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EmailAnalysisRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: EmailAnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save scan history:', e);
  }
}

export async function saveAnalysis(r: AnalysisResult): Promise<EmailAnalysisRecord> {
  const record: EmailAnalysisRecord = {
    id: crypto.randomUUID(),
    sender_email: r.sender_email || null,
    sender_name: r.sender_name || null,
    subject: r.subject || null,
    body: r.body ? r.body.slice(0, MAX_BODY_STORED) : null,
    risk_score: r.risk_score,
    verdict: r.verdict,
    // keep model findings and verified checks together for the history view
    red_flags: [
      ...r.signals.map(s => ({ category: 'Verified check', severity: s.severity, description: s.description, detail: s.detail })),
      ...r.red_flags,
    ],
    summary: r.summary || null,
    source: r.source,
    analyzed_at: new Date().toISOString(),
  };
  writeAll([record, ...readAll()].slice(0, MAX_RECORDS));
  return record;
}

export async function fetchAnalyses(limit = 50): Promise<EmailAnalysisRecord[]> {
  return readAll().slice(0, limit);
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  writeAll(readAll().filter(r => r.id !== id));
  return true;
}
