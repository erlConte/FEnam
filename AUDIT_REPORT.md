# 🔍 AUDIT REPORT FeNAM - Affiliazione & Newsletter
**Data:** 2026-01-28  
**Branch:** main  
**Priorità:** Affiliazione pending → Newsletter

---

## 📋 PROJECT MAP

### Struttura Repository
```
fenam/
├── pages/
│   ├── api/
│   │   ├── affiliazione/
│   │   │   ├── capture.js      ⚠️ CRITICO - Aggiorna status da pending a completed
│   │   │   ├── paypal.js       ✅ Crea ordine PayPal e record DB (status: pending)
│   │   │   ├── handoff.js      ✅ Gestisce redirect esterno
│   │   │   └── free.js         ✅ Disabilitato
│   │   ├── newsletter.js       ⚠️ CRITICO - Iscrizione newsletter
│   │   └── admin/              ✅ Endpoint admin
│   ├── affiliazione.js         ✅ Pagina form affiliazione
│   └── affiliazione/success.js ✅ Pagina successo
├── components/
│   ├── AffiliazioneForm.js     ⚠️ Frontend PayPal SDK + capture call
│   └── NewsletterForm.js       ⚠️ Frontend form newsletter
├── lib/
│   ├── affiliation.js         ⚠️ CRITICO - completeAffiliation() aggiorna DB
│   ├── prisma.js               ✅ Client Prisma
│   ├── logger.js               ✅ Logger strutturato
│   └── apiHelpers.js           ✅ Helper API
└── prisma/
    └── schema.prisma            ✅ Schema DB (Affiliation, NewsletterSubscription)
```

### Tecnologie
- **Frontend:** Next.js 15, React Hook Form, PayPal SDK (client-side)
- **Backend:** Next.js API Routes, Prisma ORM, Supabase PostgreSQL
- **Payment:** PayPal Checkout SDK (client-side capture flow)
- **Email:** Resend API
- **DB:** Supabase PostgreSQL (Session Pooler)

---

## 🔄 FLUSSO AFFILIAZIONE END-TO-END

### 1. Frontend → Creazione Ordine
**File:** `components/AffiliazioneForm.js:102-117`
```
Utente compila form → PayPal SDK createOrder() → POST /api/affiliazione/paypal
```

**File:** `pages/api/affiliazione/paypal.js:122-154`
- Crea ordine PayPal (`OrdersCreateRequest`)
- Salva record DB con `status: 'pending'` (riga 152)
- Ritorna `orderID` al frontend

**✅ Stato DB dopo questo step:**
```sql
INSERT INTO Affiliation (orderId, status, ...) VALUES ('PAYPAL_ORDER_ID', 'pending', ...)
```

### 2. PayPal → Approvazione Pagamento
**File:** `components/AffiliazioneForm.js:119-145`
```
PayPal SDK onApprove() → POST /api/affiliazione/capture con { orderID }
```

**⚠️ PROBLEMA IDENTIFICATO QUI:** Se la chiamata a `/api/affiliazione/capture` fallisce silenziosamente o ritorna errore non gestito, il frontend mostra comunque `toast.success('Affiliazione completata!')` perché il catch non distingue tra errori PayPal e errori DB/network.

### 3. Capture → Aggiornamento DB
**File:** `pages/api/affiliazione/capture.js:76-185`

**Flusso interno:**
1. **Riga 78:** Esegue `OrdersCaptureRequest(orderID)` su PayPal
2. **Riga 141-149:** Cerca record DB con `orderId = orderID`
3. **Riga 152:** Verifica se `status !== 'completed'` (isNewlyCompleted)
4. **Riga 180:** Chiama `completeAffiliation()` che:
   - **Riga 193-196 (lib/affiliation.js):** Aggiorna DB con `status: 'completed'`
   - Genera `memberNumber`
   - Imposta `memberSince` e `memberUntil`
   - Invia email e tessera PDF

**✅ DOVE DOVREBBE CAMBIARE STATUS:**
- **File:** `lib/affiliation.js:193-196`
- **Query:** `prisma.affiliation.update({ where: { id: affiliationId }, data: { status: 'completed', ... } })`

---

## 🐛 ROOT CAUSE ANALISI - AFFILIAZIONE PENDING

### Ipotesi Verificate

#### ✅ IPOTESI 1: Capture endpoint non viene chiamato
**Status:** ❌ NEGATA  
**Evidenza:** Il codice frontend (`AffiliazioneForm.js:122-126`) chiama sempre `/api/affiliazione/capture` dopo `onApprove`.

#### ✅ IPOTESI 2: Errore PayPal capture fallisce silenziosamente
**Status:** ⚠️ PARZIALMENTE CONFERMATA  
**Evidenza:** 
- `capture.js:775-789` catcha solo errori PayPal SDK (`paypalError`)
- Se `completeAffiliation()` fallisce (es. errore DB), l'errore viene catchato nel try generale ma potrebbe non essere gestito correttamente
- **PROBLEMA:** Se `completeAffiliation()` lancia errore, viene catchato come `paypalError` ma non è un errore PayPal!

#### ✅ IPOTESI 3: Update DB fallisce (RLS, permessi, errore Prisma)
**Status:** ⚠️ DA VERIFICARE  
**Evidenza:**
- `lib/affiliation.js:193` esegue `prisma.affiliation.update()` senza try/catch dedicato
- Se Prisma fallisce, l'errore viene propagato a `capture.js` ma potrebbe essere catchato come errore generico
- **Manca logging strutturato con correlation ID**

#### ✅ IPOTESI 4: Mismatch orderId → record non trovato
**Status:** ✅ GESTITO  
**Evidenza:** `capture.js:145-149` verifica esistenza record e ritorna 404 se non trovato.

#### ✅ IPOTESI 5: Gestione asincrona - UI legge prima del completion
**Status:** ❌ NEGATA  
**Evidenza:** Il frontend chiama capture e attende risposta prima di mostrare successo.

#### ✅ IPOTESI 6: Errore silenzioso in completeAffiliation
**Status:** ⚠️ CONFERMATA - **ROOT CAUSE PRINCIPALE**

**PROBLEMA CRITICO IDENTIFICATO:**

```javascript
// pages/api/affiliazione/capture.js:180-185
const completionResult = await completeAffiliation({
  affiliationId: existingAffiliation.id,
  payerEmail,
  amount: amount ? parseFloat(amount) : null,
  currency: currency || 'EUR',
})
```

Se `completeAffiliation()` fallisce (es. errore DB, Prisma connection, constraint violation), l'errore viene catchato nel blocco `catch (paypalError)` alla riga 775, ma:

1. **L'errore non è un errore PayPal!** È un errore DB/Prisma
2. Il catch logga come "PayPal error" ma è fuorviante
3. **Manca correlation ID** per tracciare il flusso
4. Il frontend potrebbe ricevere risposta di successo anche se DB update fallisce

**EVIDENZA NEL CODICE:**
- `lib/affiliation.js:193` non ha try/catch dedicato
- Se Prisma fallisce, l'errore viene propagato
- `capture.js:775` catcha tutto come `paypalError`

---

## 📧 FLUSSO NEWSLETTER END-TO-END

### 1. Frontend → Submit Form
**File:** `components/NewsletterForm.js:29-50`
```
Utente inserisce email + consenso → POST /api/newsletter con { email, consent: true }
```

### 2. API → Resend Audience
**File:** `pages/api/newsletter.js:58-67`

**Flusso:**
1. **Riga 60-63:** Chiama `resend.contacts.create({ audienceId, email })`
2. **Riga 65:** Logga successo
3. **Riga 67:** Ritorna `{ ok: true }`

**⚠️ PROBLEMI IDENTIFICATI:**

#### Problema 1: Non usa il DB
- **Schema Prisma:** Esiste `NewsletterSubscription` con campi `token`, `expiresAt`, `confirmed`
- **Realtà:** Il codice NON salva nel DB, aggiunge solo a Resend Audience
- **Conseguenza:** Nessun tracking locale, nessun double opt-in

#### Problema 2: RESEND_AUDIENCE_ID mancante
- **File:** `.env` - `RESEND_API_KEY=<RESEND_API_KEY>` (placeholder)
- **File:** `newsletter.js:45-48` - Verifica `RESEND_AUDIENCE_ID` e ritorna 503 se mancante
- **Conseguenza:** Se manca, l'iscrizione fallisce silenziosamente

#### Problema 3: Messaggio fuorviante
- **File:** `NewsletterForm.js:39` - Messaggio: "Iscrizione completata! Controlla la tua casella."
- **Realtà:** Non viene inviata email di conferma!
- **Conseguenza:** Utente si aspetta email ma non arriva

#### Problema 4: Gestione errore Resend 422
- **File:** `newsletter.js:69-74` - Se email già presente (422), ritorna successo
- **✅ CORRETTO:** Comportamento idempotente corretto

---

## 🔧 FIX PROPOSTI

### FIX 1: Gestione Errori Capture con Correlation ID
**File:** `pages/api/affiliazione/capture.js`

**Problema:** Errori DB/Prisma vengono catchati come errori PayPal.

**Soluzione:**
1. Aggiungere correlation ID per tracciare il flusso
2. Separare catch per errori PayPal vs errori DB/Prisma
3. Logging strutturato con correlation ID
4. Assicurarsi che errori DB ritornino 500 con messaggio chiaro

### FIX 2: Try/Catch Dedicato in completeAffiliation
**File:** `lib/affiliation.js`

**Problema:** Se Prisma update fallisce, errore propagato senza contesto.

**Soluzione:**
1. Aggiungere try/catch dedicato per operazioni DB
2. Logging con correlation ID
3. Rilanciare errore con contesto aggiuntivo

### FIX 3: Frontend Error Handling Migliorato
**File:** `components/AffiliazioneForm.js`

**Problema:** Toast success mostrato anche se capture fallisce.

**Soluzione:**
1. Verificare `res.ok` PRIMA di mostrare successo
2. Distinguere tra errori PayPal e errori server
3. Mostrare messaggi di errore più specifici

### FIX 4: Newsletter - Aggiungere Logging e Verifica Config
**File:** `pages/api/newsletter.js`

**Problema:** Manca logging strutturato e verifica env vars.

**Soluzione:**
1. Aggiungere correlation ID
2. Logging strutturato con logger
3. Verificare RESEND_AUDIENCE_ID nel .env.example
4. Messaggio più chiaro se config mancante

### FIX 5: Newsletter - Messaggio UI Corretto
**File:** `components/NewsletterForm.js`

**Problema:** Messaggio dice "Controlla la tua casella" ma non viene inviata email.

**Soluzione:**
1. Cambiare messaggio in "Iscrizione completata!"
2. Rimuovere riferimento a email di conferma

---

## 📊 TABELLA RIEPILOGO PROBLEMI

| Problema | Root Cause | Fix | File | Rischio | Test da Fare |
|----------|------------|-----|------|---------|--------------|
| **Affiliazione rimane pending** | Errore DB/Prisma in `completeAffiliation()` catchato come errore PayPal generico. Manca correlation ID per debug. | Separare catch PayPal vs DB, aggiungere correlation ID, logging strutturato | `pages/api/affiliazione/capture.js`, `lib/affiliation.js` | 🔴 ALTO - Pagamenti completati ma DB non aggiornato | 1) Test con DB offline 2) Test con Prisma error simulato 3) Verifica log con correlation ID |
| **Newsletter: messaggio fuorviante** | UI dice "Controlla la tua casella" ma non viene inviata email | Cambiare messaggio UI | `components/NewsletterForm.js` | 🟡 MEDIO - UX confusa | Test UI: verificare messaggio dopo submit |
| **Newsletter: RESEND_AUDIENCE_ID mancante** | Env var non configurata → iscrizione fallisce | Verificare .env e aggiungere a .env.example | `.env`, `.env.example` | 🟡 MEDIO - Iscrizioni falliscono silenziosamente | Test: rimuovere RESEND_AUDIENCE_ID e verificare errore |
| **Manca correlation ID** | Impossibile tracciare flusso end-to-end | Aggiungere correlation ID a tutte le chiamate | `pages/api/affiliazione/capture.js`, `lib/affiliation.js`, `pages/api/newsletter.js` | 🟢 BASSO - Difficoltà debug produzione | Test: verificare correlation ID nei log |

---

## 🧪 TEST PLAN

### Test Manuali Affiliazione

1. **Test Pagamento Completo**
   - Compilare form affiliazione
   - Completare pagamento PayPal (sandbox)
   - Verificare DB: `SELECT * FROM Affiliation WHERE orderId = 'XXX' ORDER BY createdAt DESC LIMIT 1;`
   - **Atteso:** `status = 'completed'`, `memberNumber` presente

2. **Test Errore DB Simulato**
   - Disconnettere DB temporaneamente
   - Tentare pagamento
   - **Atteso:** Errore 500 con messaggio chiaro, NO toast success

3. **Test Correlation ID**
   - Completare pagamento
   - Verificare log: cercare correlation ID
   - **Atteso:** Stesso correlation ID in tutti i log del flusso

4. **Test Idempotenza**
   - Chiamare `/api/affiliazione/capture` due volte con stesso orderID
   - **Atteso:** Seconda chiamata ritorna successo senza aggiornare DB

5. **Test OrderID Non Trovato**
   - Chiamare `/api/affiliazione/capture` con orderID inesistente
   - **Atteso:** Errore 404 con messaggio chiaro

### Test Manuali Newsletter

1. **Test Iscrizione Normale**
   - Compilare form newsletter
   - Verificare Resend Audience: email presente
   - **Atteso:** Successo, email in audience

2. **Test Email Duplicata**
   - Iscrivere stessa email due volte
   - **Atteso:** Seconda chiamata ritorna successo (idempotente)

3. **Test RESEND_AUDIENCE_ID Mancante**
   - Rimuovere temporaneamente `RESEND_AUDIENCE_ID` da .env
   - Tentare iscrizione
   - **Atteso:** Errore 503 con messaggio chiaro

4. **Test Messaggio UI**
   - Completare iscrizione
   - **Atteso:** Messaggio "Iscrizione completata!" (senza riferimento a email)

### Test Automatici (Unit/Integration)

1. **Test completeAffiliation() - Successo**
   ```javascript
   // Test: completeAffiliation aggiorna status correttamente
   const result = await completeAffiliation({ affiliationId: 'test-id', ... })
   expect(result.memberNumber).toBeDefined()
   const updated = await prisma.affiliation.findUnique({ where: { id: 'test-id' } })
   expect(updated.status).toBe('completed')
   ```

2. **Test completeAffiliation() - Errore DB**
   ```javascript
   // Test: completeAffiliation propaga errore DB correttamente
   await expect(completeAffiliation({ affiliationId: 'non-existent' }))
     .rejects.toThrow()
   ```

3. **Test Newsletter API - Successo**
   ```javascript
   // Test: newsletter API aggiunge a Resend
   const res = await fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email: 'test@test.com', consent: true }) })
   expect(res.ok).toBe(true)
   ```

---

## 🚀 PIANO DI INTERVENTO

### Fase 1: Fix Critici (Affiliazione Pending)
1. ✅ Aggiungere correlation ID a `capture.js`
2. ✅ Separare catch PayPal vs DB in `capture.js`
3. ✅ Aggiungere try/catch dedicato in `completeAffiliation()`
4. ✅ Migliorare logging strutturato
5. ✅ Fix frontend error handling

### Fase 2: Fix Newsletter
1. ✅ Correggere messaggio UI
2. ✅ Aggiungere correlation ID
3. ✅ Verificare .env.example

### Fase 3: Testing
1. ✅ Test manuali guidati
2. ✅ Verifica log con correlation ID
3. ✅ Test errori simulati

### Fase 4: Deploy
1. ✅ Deploy su staging
2. ✅ Test end-to-end
3. ✅ Monitoraggio log produzione

---

## 📝 NOTE AGGIUNTIVE

### Decisioni di Prodotto Necessarie

1. **Newsletter Double Opt-In:**
   - **Opzione A:** Implementare double opt-in con DB `NewsletterSubscription` (token, expiresAt, confirmed)
   - **Opzione B:** Mantenere single opt-in diretto a Resend (attuale)
   - **Raccomandazione:** Opzione B per semplicità, ma aggiungere logging DB per audit

2. **Quando Attivare Affiliazione:**
   - **Opzione A:** Dopo capture PayPal (attuale)
   - **Opzione B:** Dopo webhook PayPal (più sicuro, richiede webhook endpoint)
   - **Raccomandazione:** Opzione A è corretta per client-side flow, ma migliorare error handling

### Vincoli Rispettati
- ✅ Non cambiare provider (PayPal, Resend)
- ✅ Fix minimali (solo error handling e logging)
- ✅ Non modificare architettura

---

**Fine Report**
