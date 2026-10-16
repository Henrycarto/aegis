/**
 * Build data/corpus.jsonl from the two public corpora. Neither corpus is
 * redistributed in this repository; see data/README.md for how to fetch them.
 *
 *   PHISHING_POT_DIR=/path/to/phishing_pot/email HAM_DIR=/path/to/spam-assassin/data \
 *     npx tsx scripts/build-dataset.ts
 *
 * Only what the app itself sees is kept: sender, subject, body text, and the
 * real link targets from the HTML (which a reader would see by hovering).
 * Routing and authentication headers are dropped on purpose: the legitimate
 * corpus predates DKIM and DMARC, so headers would let a model tell the two
 * corpora apart by era instead of by content.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { simpleParser, type ParsedMail } from 'mailparser';

export interface CorpusEmail {
  id: string;
  label: 'phish' | 'ham';
  subset: 'phishing_pot' | 'easy_ham' | 'hard_ham';
  split: 'dev' | 'test';
  sender_name: string;
  sender_email: string;
  subject: string;
  body: string;
}

const MAX_BODY = 8000;
const PER_SUBSET_LIMIT = Number(process.env.PER_SUBSET_LIMIT ?? 100000);

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function hrefs(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi)) out.add(m[1].replace(/&amp;/g, '&'));
  return [...out].slice(0, 30);
}

function splitOf(id: string): 'dev' | 'test' {
  return createHash('sha256').update(id).digest()[0] % 2 === 0 ? 'dev' : 'test';
}

async function toRecord(raw: Buffer | string, id: string, label: CorpusEmail['label'], subset: CorpusEmail['subset']): Promise<CorpusEmail | null> {
  let m: ParsedMail;
  try {
    m = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  } catch {
    return null;
  }
  const from = m.from?.value?.[0];
  const html = typeof m.html === 'string' ? m.html : '';
  let body = (m.text && m.text.trim()) || (html ? htmlToText(html) : '');
  const links = html ? hrefs(html) : [];
  const missing = links.filter(l => !body.includes(l));
  if (missing.length) body += `\n\n[Links in this email]\n${missing.join('\n')}`;
  body = body.replace(/\r\n/g, '\n').trim().slice(0, MAX_BODY);
  if (!body && !m.subject) return null;
  return {
    id, label, subset, split: splitOf(id),
    sender_name: from?.name ?? '',
    sender_email: from?.address ?? '',
    subject: m.subject ?? '',
    body,
  };
}

async function main() {
  const pp = process.env.PHISHING_POT_DIR;
  const ham = process.env.HAM_DIR;
  if (!pp || !ham) throw new Error('set PHISHING_POT_DIR and HAM_DIR');
  const out: CorpusEmail[] = [];

  // Antivirus software may quarantine phishing samples while this loop reads
  // them. Such a file is skipped and counted rather than aborting the build.
  let unreadable = 0;
  const ppFiles = readdirSync(pp).filter(f => f.endsWith('.eml')).sort().slice(0, PER_SUBSET_LIMIT);
  for (const f of ppFiles) {
    let raw: Buffer;
    try { raw = readFileSync(join(pp, f)); } catch { unreadable++; console.error(`skipped unreadable ${f}`); continue; }
    const r = await toRecord(raw, `phishing_pot/${f}`, 'phish', 'phishing_pot');
    if (r) out.push(r);
  }
  if (unreadable) console.error(`${unreadable} phishing file(s) could not be read (removed by antivirus?)`);
  for (const [dir, subset] of [['easy-ham-1', 'easy_ham'], ['easy-ham-2', 'easy_ham'], ['hard-ham-1', 'hard_ham']] as const) {
    const files = readdirSync(join(ham, dir)).filter(f => f.endsWith('.txt')).sort().slice(0, PER_SUBSET_LIMIT);
    for (const f of files) {
      const r = await toRecord(readFileSync(join(ham, dir, f)), `${dir}/${f}`, 'ham', subset);
      if (r) out.push(r);
    }
  }

  mkdirSync('data', { recursive: true });
  writeFileSync('data/corpus.jsonl', out.map(r => JSON.stringify(r)).join('\n') + '\n');
  const count = (pred: (r: CorpusEmail) => boolean) => out.filter(pred).length;
  console.log(`wrote ${out.length} emails: phish ${count(r => r.label === 'phish')}, easy_ham ${count(r => r.subset === 'easy_ham')}, hard_ham ${count(r => r.subset === 'hard_ham')}; dev ${count(r => r.split === 'dev')}, test ${count(r => r.split === 'test')}`);
}

main();
