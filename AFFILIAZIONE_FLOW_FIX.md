# Affiliazione flow — fix applicati e output

## 1. Elenco file modificati

| File | Modifiche |
|------|-----------|
| **pages/api/affiliazione/paypal.js** | Flusso esplicito (1–4), log con correlationId/paypalMode/intent/amount/currency/orderID, category PAYPAL_API in catch, TODO P0/P1 in testa. |
| **pages/api/affiliazione/capture.js** | Step 1: capture + fallback GET se ordine già catturato (idempotente). Step 3: dbStatusBefore/dbStatusAfter. already_completed: true in risposta. Salvataggio lastPaypalStatus=COMPLETED su DB se update fallisce (recovery). Log con pdfGenerated, emailSent, handoffSent. Validazione con category VALIDATION. TODO P1 (allowlist IP). Rimozione catch orfano. |
| **lib/paypalEnv.js** | TODO P0 (mismatch client ID), TODO P1 (PAYPAL_ENV, currency/amount). |
| **lib/cors.js** | Log `[CORS] Origin blocked` con origin e path (no PII) quando 403. |
| **lib/rateLimit.js** | Log `[Rate Limit] Request rate limited` sempre (senza IP), messaggio utente in risposta 429. |
| **pages/api/admin/debug/paypal-order.js** | **Nuovo**: GET ?orderId=..., admin-only, PayPal GET order, risposta JSON status + captureStatus + purchase_units (no PII). |

---

## 2. Comandi curl

Sostituire `<URL>` con il dominio (es. `fenam.website` o `localhost:3000`), `<ORDER_ID>` con l’orderID restituito da create order, `<ADMIN_TOKEN>` con il token admin.

```bash
# Create order
curl -i -X POST "https://<URL>/api/affiliazione/paypal" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Test","cognome":"User","email":"test@example.com","telefono":"+393331112233","privacy":true,"donazione":10}'

# Capture
curl -i -X POST "https://<URL>/api/affiliazione/capture" \
  -H "Content-Type: application/json" \
  -d '{"orderID":"<ORDER_ID>"}'

# Admin debug PayPal order (richiede ADMIN_TOKEN)
curl -s "https://<URL>/api/admin/debug/paypal-order?orderId=<ORDER_ID>" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq
```

---

## 3. P0 blockers trovati e fixati

| P0 | Descrizione | Fix |
|----|-------------|-----|
| **Mismatch client ID** | NEXT_PUBLIC_PAYPAL_CLIENT_ID ≠ PAYPAL_CLIENT_ID (sandbox vs live) → bottone crea ordine su un ambiente e capture su altro → fallimento. | **Flaggato** con TODO P0 in paypal.js e paypalEnv.js; log in paypalEnv già segnala clientIdsMatch. Nessun fix automatico (configurazione env). |
| **Ordine già catturato** | Doppia chiamata capture o returnUrl che richiama capture due volte → 422 da PayPal, utente bloccato. | **Fix**: in capture.js, su 422/ORDER_ALREADY_CAPTURED si fa GET order; se status COMPLETED si sincronizza DB (idempotente) e si ritorna 200. |
| **DB pending dopo capture** | Capture PayPal ok ma update DB fallisce → pagamento preso, affiliazione resta pending. | **Fix**: prima di ritornare 500, si aggiorna `lastPaypalStatus: 'COMPLETED'` e `lastPaypalCheckedAt` sul record (colonne esistenti) per recovery/debug. Endpoint admin debug/paypal-order permette di confrontare stato PayPal vs DB. |

---

## 4. P1 risks flaggati (TODO nel codice)

| P1 | Dove | Note |
|----|------|------|
| **PAYPAL_ENV sbagliato** | paypal.js, paypalEnv.js | Es. production in preview → modalità sbagliata; verificare in Vercel. |
| **Currency/amount non accettati** | paypalEnv.js, paypal.js | Conto PayPal non accetta EUR o importo → errore da API; log in paypal/capture. |
| **Donazione concettuale** | paypal.js | "Donazione" è concettuale; l’ordine è pagamento normale PayPal. TODO per ricevuta/descrizione/branding. |
| **Allowlist IP PayPal** | capture.js | Se PayPal richiede allowlist IP è setting account; in serverless non controlli facilmente IP. |

---

## 5. Flusso affiliazione (ordine esplicito)

1. **POST /api/affiliazione/paypal**  
   Valida input → crea ordine PayPal (intent CAPTURE) → crea record Affiliation pending con orderId → ritorna orderID.

2. **POST /api/affiliazione/capture**  
   Cattura ordine (o GET se già catturato) → se COMPLETED: aggiorna DB a completed (idempotente) → side effects (PDF + email Resend) → se configurato handoff (token + risposta HTML form POST).  
   Se side effects falliscono: **non** rollback completed; risposta 200 con warnings.

3. **Idempotenza**  
   - Affiliation già completed → 200 con `already_completed: true` e stato attuale (no PII extra).  
   - PayPal "ordine già catturato" → GET order → sync DB → 200.  
   - DB update fallito dopo capture → salvataggio lastPaypalStatus/lastPaypalCheckedAt per recovery.

4. **Log/telemetria**  
   correlationId, paypalMode, paypalBaseUrl, intent, amount, currency, orderID, paypalStatus, affiliationId, dbStatusBefore/dbStatusAfter, pdfGenerated, emailSent, handoffSent; errori con category (PAYPAL_API, DB_CONN, EMAIL, PDF, HANDOFF, VALIDATION). Nessun PII.
