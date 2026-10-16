export interface EmailAnalysisRecord {
  id: string;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  body: string | null;
  risk_score: number;
  verdict: string;
  red_flags: any[];
  summary: string | null;
  domain_age_days: number | null;
  spf_dkim_dmarc_pass: boolean | null;
  analyzed_at: string;
}

const STORAGE_KEY = 'aegis_analyses';

function readAll(): EmailAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EmailAnalysisRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: EmailAnalysisRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export async function saveAnalysis(result: {
  sender_email: string;
  sender_name: string;
  subject: string;
  body: string;
  risk_score: number;
  verdict: string;
  red_flags: any[];
  summary: string;
  domain_age_days: number | null;
  spf_dkim_dmarc_pass: boolean | null;
}): Promise<EmailAnalysisRecord | null> {
  const record: EmailAnalysisRecord = {
    id: crypto.randomUUID(),
    sender_email: result.sender_email || null,
    sender_name: result.sender_name || null,
    subject: result.subject || null,
    body: result.body || null,
    risk_score: result.risk_score,
    verdict: result.verdict,
    red_flags: result.red_flags,
    summary: result.summary,
    domain_age_days: result.domain_age_days,
    spf_dkim_dmarc_pass: result.spf_dkim_dmarc_pass,
    analyzed_at: new Date().toISOString(),
  };
  const records = readAll();
  records.unshift(record);
  writeAll(records.slice(0, 200));
  return record;
}

export async function fetchAnalyses(limit = 50): Promise<EmailAnalysisRecord[]> {
  return readAll().slice(0, limit);
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const records = readAll().filter(r => r.id !== id);
  writeAll(records);
  return true;
}
