# ⚠️ DOCUMENTAZIONE DEV/TEST - SOLO PER SVILUPPO LOCALE

**ATTENZIONE**: Questo documento descrive endpoint e flussi di test disponibili **SOLO in ambiente di sviluppo** (`NODE_ENV=development`). Questi endpoint sono **disabilitati in produzione** e non devono essere utilizzati in ambiente reale.

---

# 🧪 Guida al Test del Flusso di Affiliazione (Senza Pagare)

Questa guida ti spiega come testare il flusso completo di affiliazione e generazione tessera **senza dover pagare soldi reali**.

## 📋 Opzioni Disponibili

### Opzione 1: PayPal Sandbox (Test Completo con PayPal)
Simula il flusso reale usando PayPal Sandbox (account di test).

### Opzione 2: Endpoint di Test (Bypass PayPal)
Testa direttamente la logica di generazione tessera e invio email, bypassando PayPal.

---

## 🎯 Opzione 1: PayPal Sandbox (Consigliato per Test Completo)

### Passo 1: Ottieni Credenziali PayPal Sandbox

1. Vai su **https://developer.paypal.com**
2. Accedi con il tuo account PayPal
3. Vai su **Dashboard** → **Apps & Credentials**
4. Crea una nuova app Sandbox (o usa quella esistente)
5. Copia:
   - **Client ID** (Sandbox)
   - **Secret** (Sandbox)

### Passo 2: Configura `.env` con Credenziali Sandbox

**⚠️ IMPORTANTE**: Assicurati che `NODE_ENV=development` (o non impostato) nel tuo `.env`

```env
# PayPal Sandbox (per sviluppo/test)
PAYPAL_CLIENT_ID=tuo_client_id_sandbox
PAYPAL_CLIENT_SECRET=tuo_secret_sandbox
NEXT_PUBLIC_PAYPAL_CLIENT_ID=tuo_client_id_sandbox

# Assicurati che NODE_ENV non sia 'production'
NODE_ENV=development
```

**Nota**: Il sistema usa automaticamente PayPal Sandbox quando `NODE_ENV !== 'production'` (vedi `pages/api/affiliazione/paypal.js` e `capture.js`).

### Passo 3: Testa il Flusso Completo

#### 3.1 Crea Ordine PayPal (Sandbox)

```powershell
# Crea ordine tramite form su http://localhost:3000/affiliazione
# Oppure via API:
$body = @{
    nome = "Mario"
    cognome = "Rossi"
    email = "mario.rossi@example.com"
    telefono = "1234567890"
    privacy = $true
    donazione = 0
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/affiliazione/paypal" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$orderID = $response.orderID
Write-Host "OrderID creato: $orderID"
```

#### 3.2 Completa Pagamento su PayPal Sandbox

1. Vai su **https://www.sandbox.paypal.com**
2. Accedi con un account Sandbox (puoi crearne uno dal Dashboard PayPal Developer)
3. Completa il pagamento usando l'OrderID generato
4. **Importante**: In Sandbox, puoi usare carte di test o account Sandbox senza soldi reali

#### 3.3 Capture Pagamento

Dopo aver completato il pagamento su PayPal Sandbox:

```powershell
$captureBody = @{
    orderID = $orderID
} | ConvertTo-Json

$captureResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/affiliazione/capture" `
    -Method POST `
    -ContentType "application/json" `
    -Body $captureBody

Write-Host "Capture completato:"
$captureResponse | ConvertTo-Json
```

#### 3.4 Verifica Risultato

Dovresti vedere:
- ✅ Status `completed` nel database
- ✅ `memberNumber` generato (formato: `FENAM-YYYY-XXXXXX`)
- ✅ `memberSince` e `memberUntil` impostati
- ✅ Email di conferma inviata (se Resend configurato)
- ✅ Tessera PDF inviata via email (se Resend configurato)

---

## 🚀 Opzione 2: Endpoint di Test (Bypass PayPal)

**Vantaggi**:
- ✅ Test immediato senza configurare PayPal Sandbox
- ✅ Testa solo la logica di generazione tessera e invio email
- ✅ Nessun pagamento necessario (nemmeno simulato)

**Limitazioni**:
- ⚠️ Non testa l'integrazione PayPal reale
- ⚠️ Disponibile solo in `NODE_ENV=development`
- ⚠️ Richiede header `X-DEV-KEY` se `DEV_ONLY_KEY` è configurato in `.env`

### Passo 1: Crea Ordine (Senza PayPal)

Prima devi creare un record nel database. Puoi farlo in due modi:

#### Metodo A: Usa l'API PayPal (creerà un ordine Sandbox, ma non lo completerai)

```powershell
$body = @{
    nome = "Mario"
    cognome = "Rossi"
    email = "mario.rossi@example.com"
    telefono = "1234567890"
    privacy = $true
    donazione = 0
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/affiliazione/paypal" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

$orderID = $response.orderID
Write-Host "OrderID: $orderID"
```

#### Metodo B: Crea direttamente nel database (via Prisma Studio)

```powershell
# Apri Prisma Studio
npx prisma studio

# Crea manualmente un record in "Affiliation" con:
# - nome, cognome, email, telefono, privacy
# - orderId: "TEST-ORDER-123" (qualsiasi stringa univoca)
# - status: "pending"
```

### Passo 2: Simula Capture con Endpoint di Test

**⚠️ IMPORTANTE**: Se `DEV_ONLY_KEY` è configurato in `.env`, devi includere l'header `X-DEV-KEY`:

```powershell
# Usa l'endpoint di test che bypassa PayPal
$testBody = @{
    orderID = $orderID  # L'orderID creato al passo 1
    email = "mario.rossi@example.com"  # Opzionale, usa quello del record se omesso
} | ConvertTo-Json

# Se DEV_ONLY_KEY è configurato, aggiungi l'header:
$headers = @{
    "Content-Type" = "application/json"
    "X-DEV-KEY" = "your-dev-key-from-env"  # Solo se DEV_ONLY_KEY è configurato
}

$testResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/dev/test-capture" `
    -Method POST `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $testBody

Write-Host "Test capture completato:"
$testResponse | ConvertTo-Json
```

### Passo 3: Verifica Risultato

Dovresti vedere:
- ✅ Status `completed` nel database
- ✅ `memberNumber` generato
- ✅ `memberSince` e `memberUntil` impostati
- ✅ Email di conferma inviata (se Resend configurato)
- ✅ Tessera PDF inviata via email (se Resend configurato)

**Nota**: Le email di test includeranno un badge "TEST MODE" per distinguerle da quelle reali.

---

## 🧪 Test Generazione PDF Tessera (Senza Database)

Per testare solo la generazione del PDF tessera senza toccare il database:

**⚠️ IMPORTANTE**: Se `DEV_ONLY_KEY` è configurato in `.env`, devi includere l'header `X-DEV-KEY`:

```powershell
# Scarica PDF di test
$headers = @{
    "X-DEV-KEY" = "your-dev-key-from-env"  # Solo se DEV_ONLY_KEY è configurato
}

Invoke-WebRequest -Uri "http://localhost:3000/api/dev/test-card" `
    -Headers $headers `
    -OutFile tessera_test.pdf

# Oppure con curl:
curl.exe -X GET "http://localhost:3000/api/dev/test-card" `
    -H "X-DEV-KEY: your-dev-key-from-env" `
    -OutFile tessera_test.pdf
```

Questo genera un PDF con dati di esempio:
- Nome: Mario
- Cognome: Rossi
- Numero tessera: FENAM-2026-TEST01
- Date: Data corrente e +1 anno

---

## ✅ Checklist Verifica

Dopo aver completato il test, verifica nel database:

```sql
-- Verifica record completato
SELECT 
    id,
    nome,
    cognome,
    email,
    "orderId",
    status,
    "memberNumber",
    "memberSince",
    "memberUntil",
    "confirmationEmailSentAt",
    "membershipCardSentAt",
    "createdAt"
FROM "Affiliation"
WHERE "orderId" = 'YOUR_ORDER_ID';

-- Verificare:
-- ✅ status = 'completed'
-- ✅ memberNumber non null (formato: FENAM-YYYY-XXXXXX)
-- ✅ memberSince non null (data corrente)
-- ✅ memberUntil non null (data corrente + 1 anno)
-- ✅ confirmationEmailSentAt non null (se Resend configurato)
-- ✅ membershipCardSentAt non null (se Resend configurato)
```

---

## 🔍 Verifica Tessera Generata

### Via API

```powershell
$memberNumber = "FENAM-2026-ABC123"  # Il numero generato
$verifyResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/membership/verify?memberNumber=$memberNumber"

Write-Host "Verifica tessera:"
$verifyResponse | ConvertTo-Json
```

### Via Pagina Web

Apri nel browser:
```
http://localhost:3000/verifica?memberNumber=FENAM-2026-ABC123
```

---

## ⚠️ Note Importanti

1. **PayPal Sandbox**: Assicurati di usare credenziali Sandbox, non Live, nel `.env` durante i test
2. **NODE_ENV**: Gli endpoint di test (`/api/dev/*`) funzionano solo se `NODE_ENV=development`
3. **DEV_ONLY_KEY**: Se configurato, gli endpoint dev richiedono header `X-DEV-KEY` con il valore corretto
4. **Resend**: Per testare l'invio email, configura `RESEND_API_KEY` e `SENDER_EMAIL` nel `.env`
5. **Database**: Usa un database di test (locale con Docker) per evitare di sporcare dati di produzione

---

## 🐛 Troubleshooting

### Errore "PayPal non configurato"
- Verifica che `PAYPAL_CLIENT_ID` e `PAYPAL_CLIENT_SECRET` siano nel `.env`
- Riavvia il server dopo aver modificato `.env`

### Errore "OrderID non trovato"
- Verifica che l'ordine sia stato creato prima del capture
- Controlla che `orderId` nel database corrisponda a quello usato

### Errore 403 "Forbidden" su endpoint dev
- Verifica che `NODE_ENV=development`
- Se `DEV_ONLY_KEY` è configurato, verifica che l'header `X-DEV-KEY` sia presente e corretto

### Email non inviata
- Verifica che `RESEND_API_KEY` e `SENDER_EMAIL` siano configurati
- Controlla i log del server per errori Resend
- Verifica che l'email di destinazione sia valida

### Tessera PDF non generata
- Verifica che `memberNumber` sia presente dopo il capture
- Controlla i log per errori nella generazione PDF

---

## 📚 Riferimenti

- [PayPal Developer Dashboard](https://developer.paypal.com)
- [PayPal Sandbox Testing Guide](https://developer.paypal.com/docs/api-basics/sandbox/)
- [Resend Documentation](https://resend.com/docs)
