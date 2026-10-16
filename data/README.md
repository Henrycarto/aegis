# Evaluation data

Nothing in this folder except this file is committed. Both corpora are fetched
by you and converted locally.

| Corpus | Role | Size | Licence | Source |
|---|---|---|---|---|
| phishing_pot | phishing | 12,265 `.eml` | CC BY-NC 4.0 | https://github.com/rf-peixoto/phishing_pot |
| SpamAssassin public corpus (easy ham 1+2, hard ham 1) | legitimate | 3,900 + 250 | CC0 via `@stdlib/datasets-spam-assassin` | https://www.npmjs.com/package/@stdlib/datasets-spam-assassin |

## Fetch and build

```bash
git clone --depth 1 https://github.com/rf-peixoto/phishing_pot /tmp/phishing_pot
mkdir -p /tmp/ham && (cd /tmp/ham && npm init -y >/dev/null && npm i @stdlib/datasets-spam-assassin)

PHISHING_POT_DIR=/tmp/phishing_pot/email \
HAM_DIR=/tmp/ham/node_modules/@stdlib/datasets-spam-assassin/data \
npm run data
```

This writes `data/corpus.jsonl` (about 48 MB, 16,415 emails). Each record keeps
only what the app sees: sender name and address, subject, body text, and the
real `href` targets from the HTML part. Every email goes to `dev` or `test` by
the first byte of the SHA-256 of its file path, so the split is stable across
machines.

Model answers from `npm run eval:ai` are cached in `data/cache/<model>/`, so a
rerun costs nothing.
