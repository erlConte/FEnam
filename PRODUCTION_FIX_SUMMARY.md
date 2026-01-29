# 🚀 FeNAM - Fix Produzione: Riepilogo Modifiche

**Data:** 28 Gennaio 2026  
**Obiettivo:** Portare FeNAM in produzione con zero pagamenti persi, DB sempre coerente, email non bloccanti.

---

## ✅ Modifiche Applicate

### STEP 1: Flusso Affiliazione Payment-Safe

#### File Modificati:
- `lib/affiliation.js` - **RIFATTO COMPLETAMENTE**
- `pages/api/affiliazione/capture.js` - **RIFATTO COMPLETAMENTE**
- `components/AffiliazioneForm.js` - **AGGIORNATO**

#### Cambiamenti Principali:

1. **Separazione DB Update da Side Effects:**
   - **NUOVA FUNZIONE:** `markAffiliationCompleted()` - Marca affiliazione come completed nel DB
     - Usa transazione Prisma per atomicità
     - Gestisce race conditions con check condizionale
     - Genera memberNumber con retry su collisione (max 5 tentativi)
     - **NON include email/PDF** (side effects)
   
   - **NUOVA FUNZIONE:** `runAffiliationSideEffects()` - Esegue email/PDF in modo NON bloccante
     - Try/catch separati per email e PDF
     - Se fallisce, ritorna warnings ma NON lancia eccezione
     - Aggiorna DB SOLO se email/PDF inviati con successo
   
   - **DEPRECATO:** `completeAffiliation()` - Mantenuto per retrocompatibilità, ora chiama le due funzioni separate

2. **Flusso Payment-First in `capture.js`:**
   ```
   STEP 1: PayPal Capture (solo rete/PayPal)
   ↓ (se successo)
   STEP 2: Verifica affiliazione nel DB
   ↓ (se non già completed)
   STEP 3: DB Update CRITICO (markAffiliationCompleted)
   ↓ (se successo - SEMPRE dopo PayPal capture)
   STEP 4: Side Effects NON bloccanti (runAffiliationSideEffects)
   ↓ (anche se falliscono)
   STEP 5: Risposta 200 con warnings se presenti
   ```

3. **Error Classification:**
   - **502:** Errore PayPal (capture fallito)
   - **500:** Errore DB dopo PayPal capture success (caso critico)
   - **200 con warnings:** Side effects falliti ma pagamento completato

4. **Idempotenza:**
   - Se `status = 'completed'` → ritorna 200 senza side effects
   - Transazione Prisma protegge contro race conditions
   - Unique constraint su `memberNumber` previene duplicati

5. **Frontend:**
   - Gestisce warnings nella risposta
   - Mostra toast appropriato se warnings presenti
   - Logga correlationId per supporto

---

### STEP 2: Newsletter Coerente e Verificabile

#### File Modificati:
- `pages/api/newsletter.js` - **AGGIORNATO**
- `components/NewsletterForm.js` - **GIÀ CORRETTO** (messaggio "Iscrizione completata!")

#### Cambiamenti:

1. **CorrelationId da header:**
   - Usa `getCorrelationId(req)` invece di generare sempre uno nuovo
   - Supporta header `x-correlation-id` per tracciamento

2. **Log strutturati:**
   - Usa `logErrorStructured()` con categoria `EMAIL`
   - Maschera email nei log con `maskEmail()`

3. **Messaggi chiari:**
   - Se `RESEND_AUDIENCE_ID` manca → 503 con messaggio chiaro
   - Messaggio success già corretto: "Iscrizione completata!" (NO "controlla casella")

4. **DB Tracking:**
   - **DECISIONE:** Newsletter NON salva nel DB (solo Resend Audience)
   - Tabella `NewsletterSubscription` esiste ma non viene usata
   - Documentato nel codice che è single opt-in senza DB tracking

---

### STEP 3: Env Vars e Configurazione

#### File Modificati:
- `.env.example` - **AGGIORNATO**

#### Aggiunte:

```env
# Email (Resend)
RESEND_AUDIENCE_ID=  # OBBLIGATORIO per newsletter
CONTACT_EMAIL=info@fenam.website  # Email che riceve messaggi form contatti
AFFILIAZIONE_EMAIL_SUBJECT=Conferma affiliazione FENAM  # Opzionale

# Base URL
BASE_URL=https://fenam.website  # Usato per link nelle email

# Handoff (opzionale)
ENOTEMPO_HANDOFF_URL=  # URL per redirect automatico dopo affiliazione

# PayPal
PAYPAL_ENV=production  # production o sandbox
```

---

### STEP 4: Log & Privacy

#### File Modificati:
- `lib/logger.js` - **ESTESO**

#### Nuove Funzioni:

1. **`maskEmail(email)`** - Maschera email (es. "user@example.com" → "use***@example.com")
2. **`maskPhone(phone)`** - Maschera telefono (es. "+39123456789" → "+39***789")
3. **`maskName(name)`** - Maschera nome/cognome (es. "Mario" → "M***")
4. **`getCorrelationId(req)`** - Estrae correlationId da header o genera uno nuovo

#### Miglioramenti:

- `logErrorStructured()` ora maschera automaticamente email, telefono, nome, cognome nei metadata
- CorrelationId supportato da header `x-correlation-id`
- Categorie errori estese: `EMAIL`, `PDF`, `DB_CONN`, `PRISMA`, `PAYPAL`, ecc.

---

### STEP 5: Documentazione Troubleshooting

#### File Modificati:
- `README.md` - **AGGIUNTA SEZIONE**

#### Nuova Sezione: "Payment Troubleshooting"

Include:
- Diagnosi problema "affiliazione pending dopo pagamento"
- Query SQL per verificare stato
- Come testare PayPal Sandbox
- Gestione correlationId e logging
- Soluzioni per errori comuni

---

## 🔒 Principi Garantiti

### ✅ Payment-First
- PayPal capture success → DB update **SEMPRE** avviene
- Side effects (email/PDF) **NON** possono bloccare il completion
- Se DB update fallisce dopo PayPal capture → errore 500 (caso critico)

### ✅ Side Effects Non Bloccanti
- Email e PDF in blocchi try/catch separati
- Se falliscono → warnings nella risposta ma status 200
- DB aggiornato SOLO se email/PDF inviati con successo

### ✅ Idempotenza
- Chiamare capture 2 volte → nessun doppio memberNumber
- Nessun doppio addebito logico
- Race conditions gestite con transazione Prisma

### ✅ Observability
- Log strutturati con correlationId
- Error classification (PAYPAL, DB_CONN, EMAIL, PDF)
- CorrelationId tracciabile end-to-end

### ✅ Privacy
- Nessun PII nei log (email, telefono, nome mascherati)
- Helper `maskEmail()`, `maskPhone()`, `maskName()` disponibili

---

## 📋 Checklist Deploy Produzione

### 1. Vercel Environment Variables

Verifica che tutte queste env vars siano configurate su Vercel:

```env
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  # Opzionale, solo per migrazioni

# PayPal (LIVE)
PAYPAL_CLIENT_ID=<live_client_id>
PAYPAL_CLIENT_SECRET=<live_secret>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<live_client_id>

# Resend
RESEND_API_KEY=<resend_api_key>
RESEND_AUDIENCE_ID=<resend_audience_id>  # OBBLIGATORIO
SENDER_EMAIL=noreply@fenam.website  # Deve essere verificato su Resend
CONTACT_EMAIL=info@fenam.website

# App
NEXT_PUBLIC_BASE_URL=https://fenam.website
BASE_URL=https://fenam.website
NODE_ENV=production

# Admin
ADMIN_TOKEN=<random_secret>

# Handoff (opzionale)
FENAM_HANDOFF_SECRET=<secret>
ENOTEMPO_HANDOFF_URL=<url>  # Opzionale

# Logging
LOG_LEVEL=warn  # o info per più dettagli
```

### 2. PayPal Configuration

- [ ] Account PayPal Business LIVE configurato
- [ ] `PAYPAL_CLIENT_ID` e `PAYPAL_CLIENT_SECRET` LIVE (non sandbox)
- [ ] `NEXT_PUBLIC_PAYPAL_CLIENT_ID` LIVE
- [ ] Webhook PayPal configurato (opzionale ma consigliato)
- [ ] Testato pagamento sandbox in dev

### 3. Resend Configuration

- [ ] Account Resend creato
- [ ] Domain verificato (`fenam.website`)
- [ ] `SENDER_EMAIL` verificato (`noreply@fenam.website`)
- [ ] `RESEND_API_KEY` configurato
- [ ] `RESEND_AUDIENCE_ID` creato e configurato
- [ ] Test invio email funzionante

### 4. Database (Supabase)

- [ ] Database PostgreSQL configurato
- [ ] `DATABASE_URL` con session pooler (pgbouncer)
- [ ] `DIRECT_URL` per migrazioni (opzionale)
- [ ] Migrazioni Prisma applicate (`npx prisma migrate deploy`)
- [ ] Prisma Client generato (`npx prisma generate`)
- [ ] Unique constraint su `memberNumber` verificato
- [ ] Unique constraint su `orderId` verificato

### 5. DNS e Domain

- [ ] Domain `fenam.website` configurato su Vercel
- [ ] DNS records corretti (A/CNAME)
- [ ] SSL certificate attivo
- [ ] `www.fenam.website` redirect a `fenam.website` (opzionale)

### 6. Testing Pre-Produzione

- [ ] Test pagamento PayPal sandbox completo
- [ ] Verifica DB che `status = 'completed'` dopo capture
- [ ] Verifica email di conferma inviata
- [ ] Verifica tessera PDF generata e inviata
- [ ] Test newsletter signup funzionante
- [ ] Test idempotenza (chiamare capture 2 volte)
- [ ] Verifica logs Vercel per correlationId

### 7. Monitoring Post-Deploy

- [ ] Monitorare logs Vercel per errori `[PayPal Capture]`
- [ ] Verificare che nessuna affiliazione resti `pending` dopo pagamento
- [ ] Monitorare errori Resend (rate limits, invalid emails)
- [ ] Verificare che correlationId sia tracciabile nei log

---

## 🔍 Come Verificare che Funziona

### Query SQL per Verificare Stato:

```sql
-- Affiliazioni pending (non dovrebbero essercene dopo pagamento)
SELECT COUNT(*) FROM "Affiliation" WHERE status = 'pending';

-- Affiliazioni completed senza email (side effects falliti)
SELECT 
  id,
  "orderId",
  email,
  "confirmationEmailSentAt",
  "membershipCardSentAt"
FROM "Affiliation"
WHERE status = 'completed'
  AND ("confirmationEmailSentAt" IS NULL OR "membershipCardSentAt" IS NULL)
ORDER BY "createdAt" DESC;

-- MemberNumber duplicati (non dovrebbero essercene)
SELECT "memberNumber", COUNT(*) as count
FROM "Affiliation"
WHERE "memberNumber" IS NOT NULL
GROUP BY "memberNumber"
HAVING COUNT(*) > 1;
```

### Log Vercel:

Cerca nei log:
- `[PayPal Capture]` - Flusso capture
- `[Mark Completed]` - DB update
- `[Side Effects]` - Email/PDF
- `correlationId` - Tracciamento end-to-end

---

## 🐛 Casi Critici da Monitorare

### Caso 1: PayPal Capture Success ma DB Update Fallito

**Sintomi:**
- Log: `[PayPal Capture] ERRORE CRITICO: DB update fallito`
- Status code: 500
- Pagamento PayPal completato ma DB non aggiornato

**Azione:**
1. Identifica `orderId` e `correlationId` dal log
2. Verifica su PayPal che il pagamento sia stato catturato
3. Completa manualmente l'affiliazione tramite endpoint admin o SQL

### Caso 2: Side Effects Falliti

**Sintomi:**
- Status code: 200 con `warnings` nella risposta
- `status = 'completed'` ma `confirmationEmailSentAt` o `membershipCardSentAt` NULL

**Azione:**
- Non critico: pagamento completato, DB aggiornato
- Reinvia email/tessera tramite endpoint admin `/api/admin/resend-card`

---

## 📝 Note Finali

- **Minimal diff:** Modifiche mirate, nessun refactor estetico
- **API contract:** Mantenuto il più possibile (backward compatible)
- **Provider:** Nessun cambio (PayPal, Resend, Supabase/Prisma)
- **Decisioni:** Newsletter senza DB tracking (documentato)

---

## ✅ Risultato Atteso

Dopo queste modifiche:
- ✅ Zero pagamenti "persi": PayPal capture success → DB sempre aggiornato
- ✅ DB sempre coerente: status `completed` dopo pagamento, anche se email/PDF falliscono
- ✅ Email non bloccanti: side effects separati, warnings se falliscono
- ✅ Newsletter chiara: messaggi coerenti, log strutturati
- ✅ Observability: correlationId tracciabile, error classification
- ✅ Privacy: nessun PII nei log

---

**Fine Riepilogo**
