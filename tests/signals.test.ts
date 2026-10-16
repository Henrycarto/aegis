import { describe, expect, it } from 'vitest';
import { computeSignals, extractUrls, impersonatedBrand, signalFloor } from '../src/lib/signals';
import type { EmailInput } from '../src/lib/types';

const email = (over: Partial<EmailInput>): EmailInput => ({ sender_email: '', sender_name: '', subject: '', body: '', ...over });
const ids = (e: EmailInput) => computeSignals(e).map(s => s.id);

describe('brand impersonation', () => {
  it.each([
    ['accounts-google.com', 'google'],
    ['paypal-secure-login.xyz', 'paypal'],
    ['paypal.com.verify-account.info', 'paypal'],
    ['paypa1.com', 'paypal'],
    ['dhl-tracking.net', 'dhl'],
    ['amazon-billing.co', 'amazon'],
    ['s.netfix.acess.com.ru', 'netflix'],
  ])('%s imitates %s', (host, brand) => {
    expect(impersonatedBrand(host)).toBe(brand);
  });

  it.each([
    'google.com', 'mail.google.com', 'paypal.de', 'amazon.co.uk', 'amazonses.com',
    'upstart.com', 'appleinsider.com', 'github.com', 'email.teams.microsoft.com', 'dhl.de',
    'finance.yahoo.com', 'gcloud.zoolz.com', 'storage.cloud.google.com',
  ])('%s is not an impersonation', host => {
    expect(impersonatedBrand(host)).toBeNull();
  });
});

describe('signals', () => {
  it('flags the lookalike sender the old engine scored 0', () => {
    expect(ids(email({ sender_email: 'no-reply@accounts-google.com', sender_name: 'Google' }))).toContain('BRAND_LOOKALIKE_SENDER');
  });

  it('flags a raw IP link and a userinfo trick', () => {
    const s = ids(email({ body: 'go to http://203.0.113.45/verify and https://paypal.com@evil.example/login' }));
    expect(s).toEqual(expect.arrayContaining(['RAW_IP_LINK', 'URL_USERINFO']));
  });

  it('flags a display name that claims a brand from a foreign domain', () => {
    expect(ids(email({ sender_email: 'support@mail-center.ru', sender_name: 'PayPal Service' }))).toContain('DISPLAY_NAME_SPOOF');
  });

  it('does not flag first names or real brand senders', () => {
    expect(ids(email({ sender_email: 'chase.miller@gmail.com', sender_name: 'Chase Miller' }))).not.toContain('DISPLAY_NAME_SPOOF');
    expect(ids(email({ sender_email: 'service@paypal.de', sender_name: 'PayPal' }))).not.toContain('DISPLAY_NAME_SPOOF');
  });

  it('raises nothing on a genuine GitHub security notice', () => {
    const s = computeSignals(email({
      sender_email: 'noreply@github.com', sender_name: 'GitHub',
      subject: '[GitHub] A new SSH authentication public key was added to your account',
      body: 'If you believe this key was added in error, remove it at https://github.com/settings/keys',
    }));
    expect(signalFloor(s)).toBe(0);
  });

  it('treats shorteners as evidence only and no longer emits link mismatch', () => {
    const s = computeSignals(email({ sender_email: 'news@shop.example', body: 'see https://bit.ly/abc' }));
    expect(s.map(x => x.id)).toEqual(['SHORTENED_LINK']);
    expect(signalFloor(s)).toBe(0);
  });

  it('reads authentication failures from pasted headers, including folded lines', () => {
    const headers = 'From: x@y.com\nAuthentication-Results: mx.example;\n\tspf=pass smtp.mailfrom=y.com;\n\tdmarc=fail header.from=y.com';
    expect(ids(email({ sender_email: 'x@y.com', headers }))).toContain('AUTH_FAIL');
  });

  it('strips trailing punctuation from links', () => {
    expect(extractUrls('Visit https://example.com/a, then https://example.org.')).toEqual(['https://example.com/a', 'https://example.org']);
  });
});
