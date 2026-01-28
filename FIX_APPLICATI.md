# ✅ FIX APPLICATI - Affiliazione & Newsletter

**Data:** 2026-01-28  
**Branch:** main

---

## 📋 RIEPILOGO MODIFICHE

### File Modificati
1. ✅ `pages/api/affiliazione/capture.js` - Gestione errori migliorata + correlation ID
2. ✅ `lib/affiliation.js` - Try/catch DB dedicato + correlation ID + logging migliorato
3. ✅ `components/AffiliazioneForm.js` - Error handling frontend migliorato
4. ✅ `pages/api/newsletter.js` - Correlation ID + logging strutturato
5. ✅ `components/NewsletterForm.js` - Messaggio UI corretto

---

## 🔧 DETTAGLIO MODIFICHE

### 1. `pages/api/affiliazione/capture.js`

#### Modifiche Applicate:
- ✅ **Aggiunto correlation ID** all'inizio del handler per tracciare il flusso end-to-end
- ✅ **Separato catch PayPal vs DB**: errori DB/Prisma non vengono più catchati come errori PayPal
- ✅ **Try/catch dedicato per `completeAffiliation()`**: se fallisce, ritorna errore 500 con messaggio chiaro
- ✅ **Logging strutturato** con correlation ID in tutti i punti critici
- ✅ **Messaggi di errore migliorati**: includono correlation ID per supporto

#### Codice Aggiunto:
```javascript
// Genera correlation ID
const correlationId = crypto.randomBytes(8).toString('hex')
const logContext = { orderID, correlationId }

// Try/catch dedicato per completeAffiliation
try {
  completionResult = await completeAffiliation({
    affiliationId: existingAffiliation.id,
    payerEmail,
    amount: amount ? parseFloat(amount) : null,
    currency: currency || 'EUR',
    correlationId,
  })
} catch (dbError) {
  // Errore DB gestito separatamente da errori PayPal
  return sendError(res, 500, 'Database error', '...', { orderID, correlationId })
}
```

#### Benefici:
- **Root cause identificabile**: errori DB non vengono più confusi con errori PayPal
- **Tracciabilità**: correlation ID permette di seguire il flusso completo nei log
- **Messaggi chiari**: utente sa che pagamento completato ma DB update fallito

---

### 2. `lib/affiliation.js`

#### Modifiche Applicate:
- ✅ **Aggiunto parametro `correlationId`** opzionale alla funzione
- ✅ **Try/catch dedicato per operazioni DB critiche**:
  - `findUnique()` per recupero affiliazione
  - `update()` per aggiornamento status (PUNTO CRITICO)
- ✅ **Logging strutturato** con correlation ID in tutti i punti critici
- ✅ **Errori DB propagati con contesto**: messaggi di errore più informativi

#### Codice Aggiunto:
```javascript
// Try/catch per findUnique
try {
  affiliation = await prisma.affiliation.findUnique({ where: { id: affiliationId } })
} catch (dbError) {
  logger.error('[Complete Affiliation] Errore DB durante findUnique', dbError, logContext)
  throw new Error(`Errore database durante recupero affiliazione: ${dbError.message}`)
}

// Try/catch per update (CRITICO)
try {
  updatedAffiliation = await prisma.affiliation.update({
    where: { id: affiliationId },
    data: updateData, // status: 'completed', memberNumber, etc.
  })
} catch (dbError) {
  logger.error('[Complete Affiliation] ERRORE CRITICO: DB update fallito', dbError, {
    ...logContext,
    prismaErrorCode: dbError.code || 'UNKNOWN',
  })
  throw new Error(`Errore database durante aggiornamento affiliazione: ${dbError.message}`)
}
```

#### Benefici:
- **Errore DB identificabile**: se Prisma fallisce, errore viene loggato con contesto completo
- **Root cause tracciabile**: correlation ID + Prisma error code permettono debug rapido
- **Status update protetto**: se update fallisce, errore viene propagato correttamente

---

### 3. `components/AffiliazioneForm.js`

#### Modifiche Applicate:
- ✅ **Verifica `res.ok` PRIMA di mostrare successo**: evita toast success quando capture fallisce
- ✅ **Gestione errori differenziata**:
  - Errore 500 (DB): messaggio specifico che pagamento completato ma errore tecnico
  - Errore 502 (PayPal): messaggio errore PayPal
  - Altri errori: messaggio generico
- ✅ **Logging migliorato**: console.error include status, orderID, response completa

#### Codice Modificato:
```javascript
// IMPORTANTE: Verifica res.ok PRIMA di mostrare successo
if (!res.ok) {
  let errorMsg = 'Errore durante la conferma del pagamento'
  
  if (res.status === 500 && json.details?.correlationId) {
    // Errore DB: pagamento completato ma DB update fallito
    errorMsg = 'Il pagamento è stato completato ma si è verificato un errore tecnico. Contatta il supporto con l\'ID ordine: ' + data.orderID
  } else if (res.status === 502) {
    // Errore PayPal
    errorMsg = json.message || 'Errore durante il processamento del pagamento PayPal'
  }
  
  toast.error(errorMsg)
  return // NON mostra successo
}

// Solo se res.ok === true
toast.success('Affiliazione completata!')
```

#### Benefici:
- **UX migliorata**: utente non vede successo quando capture fallisce
- **Messaggi chiari**: utente sa cosa fare in caso di errore DB
- **Debug facilitato**: logging completo per troubleshooting

---

### 4. `pages/api/newsletter.js`

#### Modifiche Applicate:
- ✅ **Aggiunto correlation ID** per tracciare iscrizioni
- ✅ **Logging strutturato** con logger invece di console.log
- ✅ **Gestione errori migliorata**: logging include status code Resend
- ✅ **Risposta include correlation ID**: utile per supporto

#### Codice Aggiunto:
```javascript
// Genera correlation ID
const correlationId = crypto.randomBytes(8).toString('hex')
const logContext = { email: email.substring(0, 3) + '***', correlationId }

logger.info('[Newsletter] Inizio aggiunta contatto a Resend Audience', logContext)

// ... chiamata Resend ...

logger.info('[Newsletter] Email aggiunta all\'audience Resend con successo', logContext)

return sendSuccess(res, { ok: true, correlationId })
```

#### Benefici:
- **Tracciabilità**: correlation ID permette di seguire iscrizioni nei log
- **Privacy**: email viene loggata parzialmente (primi 3 caratteri + ***)
- **Debug facilitato**: logging strutturato con contesto completo

---

### 5. `components/NewsletterForm.js`

#### Modifiche Applicate:
- ✅ **Messaggio UI corretto**: rimosso riferimento a "Controlla la tua casella"
- ✅ **Messaggio aggiornato**: "Iscrizione completata!" (senza riferimento a email)

#### Codice Modificato:
```javascript
// PRIMA:
toast.success('Iscrizione completata! Controlla la tua casella.')

// DOPO:
toast.success('Iscrizione completata!')
```

#### Benefici:
- **UX corretta**: messaggio non promette email che non viene inviata
- **Aspettative chiare**: utente sa che iscrizione è completata senza aspettarsi email

---

## 🧪 TEST DA ESEGUIRE

### Test Affiliazione

1. **Test Pagamento Completo (Happy Path)**
   ```
   - Compilare form affiliazione
   - Completare pagamento PayPal sandbox
   - Verificare DB: SELECT * FROM Affiliation WHERE orderId = 'XXX' ORDER BY createdAt DESC LIMIT 1;
   - Atteso: status = 'completed', memberNumber presente
   - Verificare log: cercare correlation ID
   ```

2. **Test Errore DB Simulato**
   ```
   - Disconnettere DB temporaneamente (o simulare errore Prisma)
   - Tentare pagamento PayPal
   - Atteso: 
     - Errore 500 con messaggio chiaro
     - NO toast success nel frontend
     - Log con correlation ID e errore DB
   ```

3. **Test Correlation ID**
   ```
   - Completare pagamento
   - Cercare correlation ID nei log (Vercel/logs)
   - Atteso: stesso correlation ID in tutti i log del flusso:
     - [PayPal Capture] Inizio processamento ordine
     - [PayPal Capture] Chiamata completeAffiliation
     - [Complete Affiliation] Aggiornamento DB
     - [PayPal Capture] Order completato con successo
   ```

4. **Test Idempotenza**
   ```
   - Chiamare /api/affiliazione/capture due volte con stesso orderID
   - Atteso: seconda chiamata ritorna successo senza aggiornare DB
   ```

### Test Newsletter

1. **Test Iscrizione Normale**
   ```
   - Compilare form newsletter
   - Verificare Resend Audience: email presente
   - Atteso: Successo, messaggio "Iscrizione completata!" (senza riferimento a email)
   - Verificare log: cercare correlation ID
   ```

2. **Test Email Duplicata**
   ```
   - Iscrivere stessa email due volte
   - Atteso: Seconda chiamata ritorna successo (idempotente)
   ```

3. **Test RESEND_AUDIENCE_ID Mancante**
   ```
   - Rimuovere temporaneamente RESEND_AUDIENCE_ID da .env
   - Tentare iscrizione
   - Atteso: Errore 503 con messaggio chiaro
   ```

---

## 📊 QUERY SQL PER VERIFICA

### Verificare Affiliazioni Pending
```sql
-- Trova affiliazioni pending con orderId (pagamento completato ma DB non aggiornato)
SELECT 
  id,
  orderId,
  status,
  email,
  nome,
  cognome,
  createdAt,
  confirmationEmailSentAt,
  memberNumber
FROM Affiliation
WHERE status = 'pending'
  AND orderId IS NOT NULL
ORDER BY createdAt DESC
LIMIT 10;
```

### Verificare Affiliazioni Completed
```sql
-- Verifica affiliazioni completate correttamente
SELECT 
  id,
  orderId,
  status,
  email,
  memberNumber,
  memberSince,
  memberUntil,
  confirmationEmailSentAt,
  membershipCardSentAt,
  createdAt
FROM Affiliation
WHERE status = 'completed'
ORDER BY createdAt DESC
LIMIT 10;
```

### Cercare per Correlation ID (se aggiunto a DB)
```sql
-- Nota: correlation ID è solo nei log, non nel DB
-- Cerca nei log Vercel/console usando correlation ID
```

---

## 🚨 RISCHI E MITIGAZIONI

### Rischio 1: Breaking Change
**Rischio:** 🟢 BASSO  
**Mitigazione:** 
- Modifiche sono backward compatible
- Aggiunte solo nuove funzionalità (correlation ID opzionale)
- Nessuna modifica a API contract esistente

### Rischio 2: Performance
**Rischio:** 🟢 BASSO  
**Mitigazione:**
- Correlation ID generato con `crypto.randomBytes(8)` (veloce)
- Logging aggiuntivo minimo overhead
- Try/catch non aggiunge overhead significativo

### Rischio 3: Errori Non Gestiti
**Rischio:** 🟡 MEDIO  
**Mitigazione:**
- Try/catch dedicati per operazioni critiche
- Errori DB propagati con contesto
- Frontend gestisce errori 500 correttamente

---

## 📝 NOTE AGGIUNTIVE

### Correlation ID
- **Formato:** 16 caratteri esadecimali (8 bytes)
- **Uso:** Tracciare flusso end-to-end nei log
- **Privacy:** Non contiene dati sensibili
- **Storage:** Solo nei log, non nel DB

### Logging
- **Livello:** INFO per operazioni normali, ERROR per errori
- **Privacy:** Email loggata parzialmente (primi 3 caratteri + ***)
- **Struttura:** Oggetto con correlation ID, orderID, affiliationId

### Backward Compatibility
- ✅ Tutte le modifiche sono backward compatible
- ✅ Correlation ID è opzionale (default: 'local')
- ✅ Nessuna modifica a schema DB
- ✅ Nessuna modifica a API contract

---

## ✅ CHECKLIST DEPLOY

- [x] Fix applicati a tutti i file identificati
- [x] Nessun errore di linting
- [x] Correlation ID aggiunto a tutti i punti critici
- [x] Error handling migliorato (PayPal vs DB separati)
- [x] Logging strutturato implementato
- [x] Messaggi UI corretti
- [ ] Test manuali eseguiti (da fare)
- [ ] Test su staging (da fare)
- [ ] Monitoraggio log produzione dopo deploy (da fare)

---

**Fine Documento**
