# Report implementazione — "Già socio? Accedi" e handoff solo soci attivi

**Data:** 1 febbraio 2026  
**Oggetto:** Handoff solo se `memberUntil > now`, flusso magic link per soci esistenti, anti-doppio pagamento, documentazione e checklist.

---

## 1. File modificati e nuovi

| Tipo | Percorso |
|------|----------|
| **Modificato** | `pages/api/affiliazione/handoff.js` — già presente check `memberUntil > now` (403 se scaduto) |
| **Modificato** | `pages/api/affiliazione/paypal.js` — check socio attivo per email prima di creare ordine (409) |
| **Modificato** | `components/AffiliazioneForm.js` — gestione 409 (toast + redirect a accedi-socio) |
| **Modificato** | `pages/affiliazione.js` — CTA "Sei già socio? Accedi qui" + blocco in evidenza se `source=enotempo` |
| **Nuovo** | `prisma/schema.prisma` — modello `MemberLoginToken` + relazione su `Affiliation` |
| **Nuovo** | `prisma/migrations/20260201120000_add_member_login_token/migration.sql` |
| **Nuovo** | `pages/api/socio/login/request.js` — POST richiesta magic link (rate limit, token hash, email) |
| **Nuovo** | `pages/api/socio/login/verify.js` — GET verifica token, marca usedAt, handoff redirect |
| **Nuovo** | `pages/accedi-socio.js` — pagina "Già socio? Accedi" (email + messaggi) |
| **Nuovo** | `REPORT_GIÀ_SOCIO_ACCEDI.md` (questo file) |

---

## 2. Snippet principali

### 2.1 Handoff: controllo scadenza tessera (P0)

**File:** `pages/api/affiliazione/handoff.js`

```javascript
// select include memberUntil
const affiliation = await prisma.affiliation.findUnique({
  where: { orderId: orderID },
  select: { id: true, memberNumber: true, status: true, memberUntil: true },
})

// ...
if (!affiliation.memberUntil) {
  return res.status(403).json({
    error: 'Affiliazione non valida',
    details: 'La tessera non risulta attiva (manca la data di scadenza).',
  })
}
const untilDate = new Date(affiliation.memberUntil)
const nowDate = new Date()
if (untilDate <= nowDate) {
  return res.status(403).json({
    error: 'Affiliazione scaduta',
    details: 'La tessera è scaduta: rinnova per proseguire.',
  })
}
```

### 2.2 Token login: solo hash in DB

**File:** `pages/api/socio/login/request.js`

```javascript
function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}
const rawToken = crypto.randomBytes(32).toString('base64url')
const tokenHash = sha256hex(rawToken)
await prisma.memberLoginToken.create({
  data: { tokenHash, affiliationId, expiresAt, requestIp, userAgent },
})
// Link inviato per email contiene rawToken (non salvato in chiaro)
```

**File:** `pages/api/socio/login/verify.js`

```javascript
const tokenHash = sha256hex(token)
const record = await prisma.$transaction(async (tx) => {
  const row = await tx.memberLoginToken.findUnique({
    where: { tokenHash },
    include: { affiliation: true },
  })
  if (!row || row.usedAt || new Date(row.expiresAt) <= new Date()) return null
  await tx.memberLoginToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  })
  return row
})
```

### 2.3 Verify: redirect con handoff token

**File:** `pages/api/socio/login/verify.js`

```javascript
const safeReturnUrl = getSafeReturnUrl(returnUrl)
if (!safeReturnUrl) {
  return res.redirect(302, '/accedi-socio?error=invalid_return&message=url_non_valido')
}
const handoffToken = createHandoffToken({ sub: affiliation.memberNumber || affiliation.id, src, iat: now, exp })
const redirectUrl = new URL(safeReturnUrl)
redirectUrl.searchParams.set('status', 'success')
redirectUrl.searchParams.set('token', handoffToken)
return res.redirect(302, redirectUrl.toString())
```

---

## 3. Comandi Prisma / lint / build

```bash
# Genera client Prisma dopo modifica schema
npx prisma generate

# Applica migrazione (da locale con DIRECT_URL)
npx prisma migrate deploy

# Oppure: applica migrazione con nome
npx prisma migrate deploy --name add_member_login_token
```

**Nota:** Su Vercel con `SKIP_MIGRATIONS=true` le migrazioni vanno applicate manualmente (es. Supabase SQL Editor) usando il contenuto di `prisma/migrations/20260201120000_add_member_login_token/migration.sql`.

```bash
# Lint (se configurato)
npm run lint

# Build Next.js
npm run build
```

Dopo le modifiche: `npx prisma generate` e `npx next build` devono completare senza errori.  
**Nota:** `npm run build` esegue anche `prisma migrate deploy`; se il DB non è raggiungibile (es. locale senza DIRECT_URL), usare `npx next build` per verificare la compilazione. Le migrazioni vanno applicate dove il DB è disponibile (es. Supabase SQL Editor con il contenuto di `prisma/migrations/20260201120000_add_member_login_token/migration.sql`).

---

## 4. Variabili d’ambiente necessarie

| Variabile | Uso |
|-----------|-----|
| `RESEND_API_KEY` | Invio email magic link (e altre email FENAM) |
| `SENDER_EMAIL` | Mittente email (es. `noreply@fenam.website`) |
| `BASE_URL` o `NEXT_PUBLIC_BASE_URL` | URL base per link verify (es. `https://fenam.website`) |
| `FENAM_ALLOWED_RETURN_HOSTS` | Host consentiti per returnUrl (default: `enotempo.it`, `www.enotempo.it`) — separati da virgola |
| `FENAM_HANDOFF_SECRET` | Secret condiviso con Enotempo per firma token handoff |
| `DATABASE_URL` / `DIRECT_URL` | Già in uso (Prisma / Supabase) |

---

## 5. Check sicurezza

| Controllo | Implementazione |
|-----------|-----------------|
| **returnUrl allowlist** | `getSafeReturnUrl()`: solo HTTPS, host in `FENAM_ALLOWED_RETURN_HOSTS` (default enotempo.it) |
| **Token exp** | Magic link: 15 min (`TOKEN_EXPIRY_MINUTES`). Handoff: 10 min (`exp` nel payload) |
| **Token hash in DB** | Solo `tokenHash` (SHA256) salvato in `MemberLoginToken`; token in chiaro solo nel link email |
| **usedAt** | Obbligatorio: token monouso, `usedAt` impostato in transazione alla verifica |
| **Rate limit** | Request: 5 richieste/ora per IP; 5 token/ora per email (conteggio su `MemberLoginToken`) |
| **Nessun PII nei log** | Nessun log di email/nome/telefono; solo orderID/affiliationId/correlationId dove utile |

---

## 6. Checklist test E2E (manuale)

1. **Nuovo socio da Enotempo**  
   - Da Enotempo → FENAM `/affiliazione?returnUrl=...&source=enotempo`  
   - Compila form, paga con PayPal, capture completato  
   - Handoff con token → redirect a Enotempo con `status=success&token=...`  
   - Enotempo riceve identità affidabile.

2. **Socio già attivo, device nuovo**  
   - Vai su `/accedi-socio?returnUrl=...&source=enotempo`  
   - Inserisci email socio attivo → "Invia link"  
   - Ricevi email con link `/api/socio/login/verify?token=...&returnUrl=...&source=...`  
   - Clic sul link → redirect a Enotempo con token handoff  
   - Nessun pagamento ripetuto.

3. **Socio scaduto**  
   - Su `/accedi-socio` inserisci email di socio con `memberUntil < now`  
   - Atteso: 403 "Non risulti socio attivo" (nessuna email inviata).  
   - Handoff con orderId di socio scaduto: 403 "Affiliazione scaduta".

4. **Token magic link scaduto/riusato**  
   - Clic su link già usato o dopo 15 min  
   - Atteso: redirect a `/accedi-socio?error=invalid_or_used`.

5. **returnUrl non allowlisted**  
   - Richiedi magic link con `returnUrl=https://evil.com/callback`  
   - Dopo verify, se returnUrl non in allowlist: redirect a `/accedi-socio?error=invalid_return`.

6. **Anti-doppio pagamento**  
   - Socio attivo (stessa email, memberUntil > now) compila form affiliazione e clicca PayPal  
   - Atteso: 409, toast "Sei già socio attivo...", redirect a `/accedi-socio` dopo 1,5 s.

7. **Idempotenza capture**  
   - Stesso orderId completato due volte (doppio click / retry)  
   - Atteso: prima volta completed + side effects; seconda volta 200 "Affiliazione già completata" senza side effects.

---

## 7. Certificazione aggiornata

- **Handoff:** consentito **solo** se affiliazione completata **e** `memberUntil > now` (403 se scaduta).
- **Flusso "Già socio? Accedi":** email → magic link (token monouso, hash in DB, exp 15 min) → verify → handoff HMAC → redirect a Enotempo. Nessun Supabase Auth, nessuna sessione persistente.
- **Anti-doppio pagamento:** prima di creare ordine PayPal si verifica se esiste socio attivo con stessa email; in caso positivo 409 e suggerimento "Accedi come socio".
- **Sicurezza:** returnUrl allowlist, token exp brevi, token solo hash in DB, rate limit per IP e per email, nessun PII nei log.

Fine report.
