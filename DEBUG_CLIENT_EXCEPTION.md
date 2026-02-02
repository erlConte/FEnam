# Test manuale: client exception su /affiliazione e /accedi-socio

Verifica che le pagine non crashino con query `source=enotempo` e `returnUrl` normali o “sporchi”.

## URL di prova (4)

1. **returnUrl normale (encoded una volta)**  
   `/affiliazione?source=enotempo&returnUrl=https%3A%2F%2Fapp.enotempo.it%2Fdashboard`  
   Atteso: pagina carica, link “Accedi come socio” con returnUrl preservato.

2. **returnUrl doppio-encoded**  
   `/affiliazione?source=enotempo&returnUrl=https%253A%252F%252Fapp.enotempo.it%252F`  
   Atteso: pagina carica, nessun crash (validazione lato server).

3. **returnUrl con caratteri speciali**  
   `/accedi-socio?source=enotempo&returnUrl=https%3A%2F%2Fapp.enotempo.it%2Fpath%3Ffoo%3D1%26bar%3D2`  
   Atteso: pagina carica, form invia returnUrl all’API.

4. **returnUrl malformato (% incompleto)**  
   `/affiliazione?source=enotempo&returnUrl=https%3A%2F%2Fbad%`  
   Atteso: pagina carica, nessun URIError; eventuale redirect/link fallback senza crash.

## Come verificare (3 step)

1. **Locale (production build)**  
   `NODE_ENV=production next build && next start`  
   Apri i 4 URL sopra: nessun “Application error: a client-side exception”.

2. **Staging/Produzione**  
   Apri gli stessi URL sul dominio deployato: stesso risultato.

3. **Console**  
   Nessun `URIError: URI malformed`; eventuali log senza PII (solo pathname/query keys se abilitato).

## Causa root (fix applicato)

Crash dovuto a **decodeURIComponent su stringa già decodificata o malformata** (es. returnUrl doppio-encoded o % incompleti) → `URIError`. In più, **query key incoerente** (`return` vs `returnUrl`) e **router.query come array** non gestiti.

- **Fix**: helper `safeDecodeOnce` (lib/safeDecode.js), `getQueryString` per query robusta, nessun decode in client sulle query; validazione returnUrl solo lato server; error boundary sul box PayPal; API verify usa `safeDecodeOnce`.
