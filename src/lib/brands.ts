/**
 * Brands commonly impersonated in phishing, with the registrable domains they
 * really send from. A domain whose label equals the brand under any public
 * suffix (paypal.de, amazon.co.uk) also counts as official.
 */
export const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com', 'paypal.me', 'paypal-community.com'],
  google: ['google.com', 'gmail.com', 'googlemail.com', 'youtube.com', 'googleusercontent.com', 'gstatic.com', 'googleapis.com', 'withgoogle.com', 'goo.gl', 'g.co'],
  gmail: ['google.com', 'gmail.com', 'googlemail.com'],
  microsoft: ['microsoft.com', 'live.com', 'outlook.com', 'hotmail.com', 'office.com', 'office365.com', 'microsoftonline.com', 'sharepoint.com', 'onmicrosoft.com', 'msn.com', 'bing.com', 'azure.com', 'windows.net', 'microsoftstore.com'],
  office365: ['office365.com', 'office.com', 'microsoft.com', 'microsoftonline.com'],
  apple: ['apple.com', 'icloud.com', 'me.com', 'mac.com', 'itunes.com'],
  icloud: ['icloud.com', 'apple.com', 'me.com'],
  amazon: ['amazon.com', 'amazon.de', 'amazon.co.uk', 'amazonaws.com', 'amazonses.com', 'primevideo.com'],
  netflix: ['netflix.com', 'netflix.net'],
  dhl: ['dhl.com', 'dhl.de', 'dhl.at', 'deutschepost.de', 'dpdhl.com'],
  ups: ['ups.com'],
  fedex: ['fedex.com'],
  usps: ['usps.com', 'usps.gov'],
  dpd: ['dpd.com', 'dpd.de', 'dpd.at', 'dpd.co.uk'],
  docusign: ['docusign.com', 'docusign.net'],
  dropbox: ['dropbox.com', 'dropboxmail.com'],
  linkedin: ['linkedin.com', 'lnkd.in'],
  facebook: ['facebook.com', 'facebookmail.com', 'fb.com', 'meta.com'],
  instagram: ['instagram.com', 'facebookmail.com', 'meta.com'],
  whatsapp: ['whatsapp.com', 'whatsapp.net', 'meta.com'],
  coinbase: ['coinbase.com'],
  binance: ['binance.com'],
  wellsfargo: ['wellsfargo.com', 'wf.com'],
  bankofamerica: ['bankofamerica.com', 'bofa.com'],
  americanexpress: ['americanexpress.com', 'aexp.com'],
  amex: ['americanexpress.com', 'aexp.com'],
  adobe: ['adobe.com', 'adobesign.com', 'adobe.io'],
  steam: ['steampowered.com', 'steamcommunity.com'],
};

/**
 * Brands whose name is also an everyday word or a first name. They are still
 * checked inside domains, but not in display names ("Chase Miller", "Apple Farm").
 */
export const AMBIGUOUS_IN_NAMES = new Set(['apple', 'steam', 'ups']);

export const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly',
  'cutt.ly', 'shorte.st', 'tiny.cc', 'rb.gy', 's.id', 't.ly', 'shorturl.at', 'v.gd',
]);
