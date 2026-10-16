Model: gemini-3.8-flash

| Engine | Phishing caught (score ≥ 60) | Phishing flagged (≥ 25) | False alarms, everyday mail (≥ 25) | False alarms, hard legit mail (≥ 25) | AUC |
|---|---|---|---|---|---|
| Legacy keyword engine (Bolt prototype) | 21.3% | 63.0% | 73.3% | 76.4% | 0.445 |
| Verified signals only (fallback mode) | 6.3% | 10.7% | 0.0% | 3.1% | 0.548 |
| Model alone (gemini-3.8-flash, no evidence) | 94.0% | 98.3% | 0.0% | 1.6% | 0.998 |
| Aegis: model + verified evidence + floors | 94.3% | 98.7% | 0.0% | 4.7% | 0.997 |
