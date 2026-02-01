# Certificazione tecnica FENAM — Affiliazione, utenti e handoff Enotempo

**Data:** 1 febbraio 2026  
**Oggetto:** Analisi del flusso di affiliazione, persistenza utenti, uso di Supabase Auth e handoff verso Enotempo.  
**Vincolo:** Solo analisi; nessuna modifica al codice.

---

## STEP 1 — Mappa completa del flusso di affiliazione

### Punto di ingresso

- **Pagina:** `/affiliazione` (`pages/affiliazione.js`)
- **Componente form:** `AffiliazioneForm` (`components/AffiliazioneForm.js`)
- **Endpoint coinvolti:**  
  - `POST /api/affiliazione/paypal` (crea ordine PayPal + record DB)  
  - `POST /api/affiliazione/capture` (cattura pagamento + completa affiliazione)  
  - `POST /api/affiliazione/handoff` (opzionale, dopo successo: token per Enotempo)

### Diagramma testuale del flusso

```
[Utente] → /affiliazione
    │
    ├─ Compila form: nome, cognome, email, telefono, donazione (≥10€), privacy (obbligatorio)
    │
    ├─ Clic "Paga con PayPal" (createOrder)
    │       │
    │       └─► POST /api/affiliazione/paypal
    │               ├─ Validazione Zod (privacy=true, donazione 10–10000)
    │               ├─ PayPal: OrdersCreateRequest (CAPTURE, EUR)
    │               └─ DB: prisma.affiliation.create({ nome, cognome, email, telefono, privacy, orderId, status: 'pending' })
    │
    ├─ PayPal approva pagamento (onApprove)
    │       │
    │       └─► POST /api/affiliazione/capture
    │               ├─ PayPal: OrdersCaptureRequest(orderID)
    │               ├─ SE status !== 'COMPLETED' → update lastPaypalStatus/lastPaypalCheckedAt, return 200 + messaggio (NON completa)
    │               ├─ SE status === 'COMPLETED':
    │               │     ├─ Trova/crea Affiliation per orderId (recovery se mancante)
    │               │     ├─ markAffiliationCompleted(affiliationId, payerEmail) → status='completed', memberNumber, memberSince, memberUntil
    │               │     ├─ runAffiliationSideEffects (email conferma, PDF tessera) — non bloccante
    │               │     └─ Risposta JSON (o HTML redirect se ENOTEMPO_HANDOFF_URL)
    │               └─ Frontend: se paypalStatus !== 'COMPLETED' → toast warning, stop; altrimenti → handleSuccessRedirect
    │
    └─ handleSuccessRedirect(orderID)
          ├─ Se source===enotempo o returnUrl → POST /api/affiliazione/handoff → redirect con token
          └─ Altrimenti → router.push(/affiliazione/success?orderId=...)
```

### Tabelle coinvolte e ordine di scrittura

| Ordine | Tabella      | Quando                    | Campi chiave scritti |
|--------|--------------|---------------------------|------------------------|
| 1      | **Affiliation** | `POST /api/affiliazione/paypal` | `nome`, `cognome`, `email`, `telefono`, `privacy`, `orderId`, `status: 'pending'` |
| 2      | **Affiliation** | `POST /api/affiliazione/capture` (se PayPal ≠ COMPLETED) | `lastPaypalStatus`, `lastPaypalCheckedAt` (solo debug) |
| 3      | **Affiliation** | `POST /api/affiliazione/capture` (se PayPal COMPLETED) | `status: 'completed'`, `payerEmail` (opz.), `memberSince`, `memberUntil`, `memberNumber` |
| 4      | **Affiliation** | Side effects (dopo completed) | `confirmationEmailSentAt`, `membershipCardSentAt` |

**Nessun’altra tabella** viene scritta nel flusso di affiliazione (né NewsletterSubscription né ContactMessage né tabelle Supabase Auth).

---

## STEP 2 — Analisi tabella `Affiliation`

### Schema (Prisma)

- `id` (cuid), `nome`, `cognome`, `email`, `telefono`, `privacy`
- `orderId` (unique, nullable)
- `status` (String, default `"pending"`)
- `payerEmail` (nullable)
- `confirmationEmailSentAt`, `membershipCardSentAt` (nullable)
- `memberSince`, `memberUntil` (nullable)
- `memberNumber` (unique, nullable, formato `FENAM-YYYY-XXXXXX`)
- `lastPaypalStatus`, `lastPaypalCheckedAt` (nullable, debug)

### Significato dei campi critici

| Campo             | Significato |
|-------------------|-------------|
| **status**        | Stato dell’affiliazione. Valori usati nel codice: `pending` (ordine creato, pagamento non completato o non ancora catturato), `completed` (pagamento catturato e affiliazione completata). Nessun altro valore viene impostato dal flusso standard. |
| **memberSince**   | Data inizio validità membership (impostata da `markAffiliationCompleted`: oggi per nuova, o `existingMember.memberSince` per rinnovo). |
| **memberUntil**   | Data fine validità (oggi + 1 anno per nuova; per rinnovo: scadenza esistente + 1 anno se ancora attiva, altrimenti oggi + 1 anno). |
| **memberNumber**  | Identificativo tessera univoco (es. `FENAM-2026-ABC123`). Generato solo quando `status` diventa `completed`. |
| **lastPaypalStatus** | Ultimo stato restituito da PayPal sulla capture (es. `PENDING`, `COMPLETED`). Solo diagnostico; non usato per logica di business. |

### Condizione esatta “affiliato valido” (membership attiva)

**Regola booleana:**

```text
Affiliato valido (membership attiva) =
  status === 'completed'
  AND memberNumber IS NOT NULL
  AND memberUntil IS NOT NULL
  AND memberUntil > NOW()
```

Implementata in:

- `pages/api/membership/verify.js`: `isActive = affiliation.status === 'completed' && affiliation.memberUntil && new Date(affiliation.memberUntil) > now`
- `pages/api/admin/affiliations.js` (filtro “attivi”): `status === 'completed'` e `memberUntil > now`

### Stati e possibili incoerenze

- **Stati usati:** solo `pending` e `completed`. Nessuno stato “zombie” o custom (es. `cancelled`, `refunded`) è gestito dal codice.
- **Stati ignorati:** se in DB fosse presente un valore diverso da `pending`/`completed` (es. inserito a mano), la verifica membership e l’handoff considerano solo `status === 'completed'`; gli altri stati sono di fatto “non completati”.
- **lastPaypalStatus:** può essere `PENDING` o altro anche con `status === 'completed'` (es. aggiornamento debug su record già completato). La logica di “affiliato completato” dipende da `status` e date, non da `lastPaypalStatus`.

---

## STEP 3 — Supabase Auth: è usato o no?

### Ricerca nel codebase

- **supabase**, **supabase.auth**, **getUser**, **getSession**, **middleware auth**, **cookie sb-***: **nessuna occorrenza** in tutto il progetto.
- **Supabase** compare solo come provider di database (PostgreSQL + pooler) in `lib/prisma.js` e negli script di migrazione; **non** come servizio Auth.

### Dichiarazione

- **FENAM non usa Supabase Auth.**
- Gli utenti (affiliati) **non** vengono creati in Supabase Authentication → Users.
- L’unica persistenza degli “utenti” (affiliati) è la tabella **Affiliation** nel database PostgreSQL (Supabase come DB).

### Conseguenze architetturali

- **Authentication → Users** in Supabase è correttamente vuoto per gli affiliati: non c’è nessun flusso che crei lì account.
- Non esiste login/sessione utente per i soci: nessun “account” da cui fare login sul sito FENAM.
- L’accesso alle funzionalità “da affiliato” (es. handoff, verifica tessera) non dipende da sessione o cookie di autenticazione, ma da **orderId** (dopo pagamento) o **memberNumber** (verifica pubblica).

---

## STEP 4 — Stato “autenticato” vs “affiliato”

### Differenza concettuale

| Concetto        | Significato in FENAM |
|-----------------|----------------------|
| **Affiliato**   | Record in tabella `Affiliation` con `status === 'completed'` e (per “attivo”) `memberUntil > now`. È uno stato di **membership** (tessera valida). |
| **Autenticato** | In FENAM **non esiste** uno stato “utente autenticato” per i soci. Esiste solo **autenticazione admin** (Bearer token, `ADMIN_TOKEN`) per le API admin (soci, resend card, debug). |

### Frontend e riconoscimento dell’affiliato

- Le pagine pubbliche (affiliazione, success, verifica tessera) **non** richiedono login.
- Lo stato “affiliato” **non** è derivato da sessione o cookie: dopo il pagamento il frontend ha solo `orderId` in query (success) o l’utente inserisce `memberNumber` nella pagina Verifica.
- La dashboard admin `/admin/soci` richiede un token salvato in `localStorage` (`admin_token`), confrontato con `ADMIN_TOKEN` lato server: è **solo auth admin**, non “sessione affiliato”.

### Tabella: stato DB vs stato UI

| Stato DB (Affiliation)              | Cosa vede l’utente / UI |
|------------------------------------|---------------------------|
| `status: pending`                  | Pagina success non raggiunta con “completato”; Verifica: “IN ATTESA”. |
| `status: completed`, `memberUntil > now` | Verifica: “Attiva”; handoff consentito (vedi STEP 5). |
| `status: completed`, `memberUntil <= now` | Verifica: “SCADUTA”; handoff ancora consentito (vedi STEP 5). |
| Record non trovato (orderId/memberNumber sbagliato) | 404 handoff / Verifica “Non trovata”. |

### Possibili mismatch

- **Pagina success:** mostra “Affiliazione Completata!” solo se il client arriva con `orderId` in query; non c’è rilettura da DB. Se l’utente modifica l’URL o perde l’`orderId`, non vede dati tessera (né memberNumber in pagina). Comportamento coerente con “nessuna sessione”: non c’è “area soci” persistente.
- **Handoff:** l’utente può richiedere handoff finché `status === 'completed'` (anche se scaduto). Vedi STEP 5.

---

## STEP 5 — Handoff verso Enotempo

### Flusso

1. **Client:** dopo capture OK, se `source === 'enotempo'` o c’è `returnUrl`, chiama `POST /api/affiliazione/handoff` con `{ orderID, returnUrl, source }`.
2. **Server (`pages/api/affiliazione/handoff.js`):**
   - Cerca `Affiliation` con `orderId === orderID`.
   - Se non trovata → 404.
   - Se `affiliation.status !== 'completed'` → 400 “Affiliazione non completata”.
   - Valida `returnUrl` con `getSafeReturnUrl` (HTTPS + allowlist host).
   - Genera token HMAC (`lib/handoffToken.js`) con payload `{ sub: memberNumber || id, src, iat, exp }` (10 min).
   - Risponde con `redirectUrl = returnUrl?status=success&token=<token>`.

### Condizione che abilita l’handoff

**Condizione esatta:**

```text
Handoff consentito SE E SOLO SE:
  - Esiste un record Affiliation con orderId = orderID
  - affiliation.status === 'completed'
  - returnUrl valido (HTTPS + host in FENAM_ALLOWED_RETURN_HOSTS, default enotempo.it / www.enotempo.it)
```

**Non** viene richiesto Supabase Auth.  
**Non** viene verificato `memberUntil > now`: un affiliato con tessera **scaduta** può ancora ottenere un token handoff (stesso comportamento dell’endpoint handoff chiamato dal client dopo success).

### Identità passata a Enotempo

- Il token HMAC contiene `sub` = `memberNumber` (o `id` se manca memberNumber).
- La firma con `FENAM_HANDOFF_SECRET` garantisce che il token non sia alterabile senza la shared secret.
- Enotempo, conoscendo `FENAM_HANDOFF_SECRET`, può verificare il token e considerare `sub` come identificativo affidabile del socio (memberNumber o id FENAM). **Enotempo riceve quindi un’identità affidabile** (integrity + expiry 10 min), a patto che la condizione di “chi” può ottenere il token sia quella desiderata (oggi: solo `status === 'completed'`, senza controllo su `memberUntil`).

### Casi edge

- **comp/staff:** nel codebase **non** esistono ruoli “comp” o “staff”; gli unici concetti sono “affiliato” (tabella Affiliation) e “admin” (Bearer token).
- **lastPaypalStatus != COMPLETED:** l’handoff non legge `lastPaypalStatus`; conta solo `status === 'completed'`.
- **status custom:** se in DB ci fosse un valore diverso da `pending`/`completed`, l’handoff lo tratterebbe come “non completato” (400).

---

## STEP 6 — Conclusione e certificazione

### 1) Dove vengono salvati gli utenti FENAM?

Gli “utenti” FENAM (affiliati) sono salvati **solo** nella tabella **Affiliation** del database PostgreSQL (Supabase come host DB). Non esiste scrittura in Supabase Authentication → Users.

### 2) Quando un utente è considerato “affiliato valido”?

**Affiliato valido (membership attiva):**

- `status === 'completed'`
- `memberNumber` e `memberUntil` presenti
- `memberUntil > NOW()`

La verifica pubblica (`/api/membership/verify`) e i filtri admin “attivi” usano questa regola.

### 3) Quando (e se) viene creato un account di autenticazione?

**Mai.** FENAM non crea account di autenticazione (né Supabase Auth né altri). Non c’è flusso di registrazione/login per i soci.

### 4) Il flusso affiliazione → pagamento → conferma → handoff funziona correttamente?

**Sì**, nel senso che:

- Ordine PayPal e record `pending` vengono creati in fase paypal.
- Alla capture COMPLETED, l’affiliazione viene portata a `completed` con memberNumber e date.
- Side effect (email, PDF) non bloccano il completamento.
- Handoff (client o redirect da capture) genera il token HMAC e redirect a Enotempo quando `status === 'completed'` e returnUrl è valido.

**Aggiornamento (1 feb 2026):** l’handoff **ora** verifica `memberUntil > now`: se la tessera è scaduta si risponde 403 “Affiliazione scaduta”. Vedi addendum sotto.

### 5) Enotempo riceve un’identità affidabile?

**Sì.** Il token è firmato con HMAC e ha scadenza; il campo `sub` contiene memberNumber (o id). Enotempo può verificare integrità e scadenza e usare `sub` come identificativo del socio.

---

### Riepilogo finale

| Elemento | Esito |
|----------|--------|
| **COSA FUNZIONA CORRETTAMENTE** | Flusso paypal → create Affiliation → capture → mark completed → side effects; verifica tessera con regola “attivo”; handoff HMAC e identità verso Enotempo; assenza di Supabase Auth coerente con “solo membership”. |
| **COSA È ASSENTE MA VOLUTO** | Nessun login utenti/sessione per i soci; Authentication → Users vuoto è intenzionale dato il design attuale. |
| **COSA MANCA** | Nulla: handoff ora richiede `memberUntil > now` (403 se scaduto). Flusso “Già socio? Accedi” (magic link) per soci esistenti senza ripagare. |
| **DECISIONE ARCHITETTURALE** | **FENAM è un sistema di membership (tessera + pagamento + handoff), non un sistema di login utenti.** Gli affiliati non hanno account Auth; l’identità verso Enotempo è garantita dal token HMAC legato all’affiliazione completata. |

---

**Conclusione per il team**

- Se l’obiettivo è **solo** “membership + handoff senza area soci con login”, il comportamento attuale è **corretto e intenzionale**: gli affiliati non devono comparire in Supabase Authentication → Users.
---

## Addendum — Flusso “Già socio? Accedi” e handoff solo soci attivi (1 feb 2026)

### Modifiche introdotte

1. **Handoff solo soci in validità**  
   In `/api/affiliazione/handoff` è richiesto: `status === 'completed'`, `memberUntil` presente, `memberUntil > now`. In caso di tessera scaduta: **403** “Affiliazione scaduta” (non 400).

2. **Flusso “Già socio? Accedi”** (nessun Supabase Auth)  
   - Pagina `/accedi-socio`: email + “Invia link”; query `returnUrl`, `source` (da Enotempo).  
   - **POST /api/socio/login/request**: body `{ email, returnUrl?, source? }`. Rate limit 5/ora per IP e 5 token/ora per email. Cerca Affiliation con `email`, `status='completed'`, `memberUntil > now`. Genera token monouso (32 bytes), salva **solo hash SHA256** in tabella `MemberLoginToken` (affiliationId, expiresAt 15 min, usedAt null, requestIp, userAgent). Invia email con link a `/api/socio/login/verify?token=...&returnUrl=...&source=...`.  
   - **GET /api/socio/login/verify**: hash token, cerca record non usato e non scaduto, marca `usedAt = now` in transazione, carica affiliation, verifica `memberUntil > now`, genera handoff HMAC (exp 10 min), valida returnUrl con `getSafeReturnUrl`, redirect 302 a returnUrl con `status=success&token=...`. Se returnUrl non valido: redirect a `/accedi-socio?error=invalid_return`.

3. **Tabella MemberLoginToken**  
   Campi: id, tokenHash (unique), affiliationId (FK), expiresAt, usedAt (nullable), createdAt, requestIp, userAgent. Solo hash in DB; nessun PII nei log.

4. **UX su /affiliazione**  
   CTA “Sei già socio? Accedi qui (senza ripagare)” → `/accedi-socio` (con returnUrl se presente). Se `source=enotempo` il blocco è in evidenza (bordo/colore).

5. **Anti-doppio pagamento**  
   In **POST /api/affiliazione/paypal**, prima di creare ordine PayPal: se esiste Affiliation con stessa email, `status='completed'`, `memberUntil > now` → **409** “Risulti già socio attivo… Usa Accedi come socio”. Frontend: toast + redirect a `/accedi-socio`.

6. **Idempotenza capture**  
   Già presente: se affiliazione già `completed` per quell’orderId, risposta 200 “Affiliazione già completata” senza rieseguire side effects.

### Check sicurezza

- **returnUrl:** solo HTTPS + host in allowlist (`FENAM_ALLOWED_RETURN_HOSTS`, default enotempo.it).  
- **Token magic link:** exp 15 min; solo hash in DB; monouso (`usedAt`).  
- **Token handoff:** exp 10 min; HMAC con `FENAM_HANDOFF_SECRET`.  
- **Rate limit:** 5/ora per IP su request; 5 token/ora per email (conteggio su MemberLoginToken).  
- **Nessun PII nei log:** nessun log di email/nome/telefono.

### Checklist test E2E

Vedi `REPORT_GIÀ_SOCIO_ACCEDI.md` (sezione 6).

Fine certificazione.
