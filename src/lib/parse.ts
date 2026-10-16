import type { EmailInput } from './types';

const ADDR_RE = /[\w.+'-]+@[\w-]+(?:\.[\w-]+)+/;

function splitNameAddress(s: string): { name: string; email: string } {
  const str = s.trim();
  const angle = str.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angle) return { name: angle[1].replace(/^["']|["']$/g, '').trim(), email: angle[2].trim() };
  const m = str.match(ADDR_RE);
  if (m) return { name: str.slice(0, m.index).replace(/^["']|["']$/g, '').trim(), email: m[0] };
  return { name: str, email: '' };
}

/**
 * Turn what the user pasted into an EmailInput. Accepts either a sender line
 * plus a body (optionally starting with "Subject:"), or the full raw source
 * of an email with its header block, in which case the headers are kept for
 * authentication checks.
 */
export function parseRawEmail(rawSender: string, rawContent: string): EmailInput {
  let content = rawContent.replace(/\r\n/g, '\n').trim();
  let headers: string | undefined;

  // Full source: a run of "Name: value" lines (with folded continuations) before the first blank line.
  const blank = content.indexOf('\n\n');
  if (blank > 0) {
    const head = content.slice(0, blank);
    const lines = head.split('\n');
    const headerish = lines.every(l => /^[A-Za-z][A-Za-z0-9-]*:\s?/.test(l) || /^[ \t]/.test(l));
    const count = lines.filter(l => /^[A-Za-z][A-Za-z0-9-]*:/.test(l)).length;
    if (headerish && count >= 2) {
      headers = head;
      content = content.slice(blank + 2).trim();
    }
  }

  const header = (name: string): string | undefined => {
    if (!headers) return undefined;
    const unfolded = headers.replace(/\n[ \t]+/g, ' ');
    const m = unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
    return m ? m[1].trim() : undefined;
  };

  let { name: sender_name, email: sender_email } = splitNameAddress(rawSender || '');
  if (!sender_email) {
    const from = header('from') ?? content.match(/^from:\s*(.+)$/im)?.[1];
    if (from) {
      const p = splitNameAddress(from);
      sender_email = p.email;
      sender_name = sender_name || p.name;
    }
  }

  let subject = header('subject') ?? '';
  if (!subject) {
    const sm = content.match(/^subject:\s*(.+)$/im);
    if (sm) {
      subject = sm[1].trim();
      content = content.replace(/^subject:\s*.+\n?/im, '').trim();
    }
  }
  const body = content.replace(/^(from|to|date|reply-to|cc):\s*.+\n/gim, '').trim();
  return { sender_email, sender_name, subject, body, headers };
}
