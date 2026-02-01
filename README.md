# FENAM - Federazione Nazionale Associazioni Multiculturali

Sito vetrina + sistema di affiliazione tramite donazione PayPal. **Dominio canonico**: https://fenam.website (senza www). Redirect www → apex gestito da Vercel Domains, non in app.

## Stack Tecnologico

- **Framework**: Next.js 15.5.8 (Pages Router)
- **Database**: PostgreSQL con Prisma ORM
- **Pagamenti**: PayPal Checkout
- **Styling**: Tailwind CSS
- **Email**: Resend API + Nodemailer (SMTP)

## Setup Sviluppo

### Prerequisiti

- Node.js 18+
- Docker Desktop (per Setup A - PostgreSQL locale)
- Account PayPal (Sandbox per sviluppo)

### Strategia Database

**⚠️ IMPORTANTE**: Se il tuo `DATABASE_URL` punta a un database remoto condiviso (es. Prisma Accelerate), **NON è adatto per sviluppo locale** perché:
- Rischio di drift tra schema e migrazioni
- Condivisione dati con altri sviluppatori
- Impossibilità di fare reset/test senza impattare altri

**Scegli una delle due strategie:**

---

## Setup A: PostgreSQL Locale con Docker (CONSIGLIATO)

### Vantaggi
- Database isolato per ogni sviluppatore
- Reset completo senza impatti
- Nessun drift con database condiviso
- Sviluppo offline

### Passi (Windows PowerShell)

1. **Installa Docker Desktop** (se non già installato):
   - Scarica da: https://www.docker.com/products/docker-desktop
   - Riavvia il computer dopo l'installazione

2. **Clona e installa dipendenze:**
   ```powershell
   npm install
   ```

3. **Crea file `.env` da template:**
   ```powershell
   Copy-Item .env.example .env
   ```

4. **Avvia PostgreSQL in Docker:**
   ```powershell
   docker-compose up -d
   ```
   
   Verifica che il container sia attivo:
   ```powershell
   docker ps
   ```
   
   Dovresti vedere `fenam-postgres` in esecuzione.

5. **Verifica connessione database:**
   ```powershell
   docker exec -it fenam-postgres psql -U postgres -d fenam -c "SELECT version();"
   ```

6. **Applica migrazioni Prisma:**
   ```powershell
   npx prisma migrate dev
   ```
   
   Questo comando:
   - Applica tutte le migrazioni pendenti
   - Genera il Prisma Client
   - Crea le tabelle: `NewsletterSubscription`, `ContactMessage`, `Affiliation`

7. **Genera Prisma Client (se necessario):**
   ```powershell
   npx prisma generate
   ```

8. **Avvia il server di sviluppo:**
   ```powershell
   npm run dev
   ```
   
   L'applicazione sarà disponibile su `http://localhost:3000`

### Comandi Docker Utili

```powershell
# Ferma PostgreSQL
docker-compose down

# Ferma e rimuovi i dati (ATTENZIONE: cancella tutto)
docker-compose down -v

# Riavvia PostgreSQL
docker-compose restart

# Visualizza log PostgreSQL
docker-compose logs postgres

# Accedi a psql nel container
docker exec -it fenam-postgres psql -U postgres -d fenam
```

---

## Setup B: Database Remoto (Prisma Accelerate) con Reset Controllato

### Quando usare
- Se devi lavorare su dati di produzione/staging
- Se non puoi usare Docker
- Se il team condivide un database di sviluppo

### ⚠️ ATTENZIONI
- **NON fare `migrate dev` su database condiviso** (crea drift)
- Usa solo `migrate deploy` per applicare migrazioni esistenti
- Fai reset solo se sei sicuro che nessun altro sta usando il DB

### Passi (Windows PowerShell)

1. **Clona e installa dipendenze:**
   ```powershell
   npm install
   ```

2. **Crea file `.env` da template:**
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Configura `DATABASE_URL` in `.env`:**
   ```env
   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_API_KEY"
   ```
   
   Oppure se usi connessione diretta PostgreSQL:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/fenam?schema=public"
   ```

4. **Verifica stato migrazioni:**
   ```powershell
   npx prisma migrate status
   ```
   
   Questo mostra se ci sono drift tra schema e database.

5. **Se c'è drift, risolvi:**
   
   **Opzione 1: Reset completo (SOLO se sei sicuro):**
   ```powershell
   # ATTENZIONE: Cancella tutti i dati!
   npx prisma migrate reset
   ```
   
   **Opzione 2: Applica solo migrazioni esistenti (senza crearne nuove):**
   ```powershell
   npx prisma migrate deploy
   ```
   
   **Opzione 3: Risolvi drift manualmente:**
   ```powershell
   # Marca migrazioni come applicate senza eseguirle
   npx prisma migrate resolve --applied MIGRATION_NAME
   ```

6. **Genera Prisma Client:**
   ```powershell
   npx prisma generate
   ```

7. **Avvia il server di sviluppo:**
   ```powershell
   npm run dev
   ```

### Comandi per Database Remoto

```powershell
# Visualizza stato migrazioni (verifica drift)
npx prisma migrate status

# Applica migrazioni esistenti (NON crea nuove)
npx prisma migrate deploy

# Reset completo (ATTENZIONE: cancella tutti i dati)
npx prisma migrate reset

# Apri Prisma Studio (GUI)
npx prisma studio
```

---

## Configurazione Variabili d'Ambiente

Crea un file `.env` nella root del progetto copiando da `.env.example`:

```powershell
Copy-Item .env.example .env
```

Poi modifica `.env` con i tuoi valori:

```env
# Database (scegli una delle due opzioni sopra)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fenam?schema=public"
# oppure
# DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"
```

## Deploy Produzione (Vercel + Supabase)

Vercel è **IPv4-only**. La direct connection Supabase (`db.xxx.supabase.co:5432`) non è raggiungibile da Vercel. Usare **solo il pooler** per il runtime e **disabilitare le migrazioni** in build.

### Variabili d'ambiente su Vercel (obbligatorie)

| Variabile | Valore | Note |
|-----------|--------|------|
| `DATABASE_URL` | Connection string **Session pooler** Supabase | Host tipo `aws-1-eu-central-1.pooler.supabase.com`, porta **6543**, con `?pgbouncer=true&connection_limit=1` |
| `SKIP_MIGRATIONS` | `true` | **Obbligatorio** su Vercel: non eseguire `prisma migrate deploy` in build (evita uso di DIRECT_URL). Runtime usa solo `DATABASE_URL` (pooler). |
| `DIRECT_URL` | (opzionale) | Su Vercel puoi impostarla uguale a `DATABASE_URL` solo per far passare `prisma generate` (lo schema la richiede). Le migrazioni non vengono comunque eseguite se `SKIP_MIGRATIONS=true`. |

**Esempio DATABASE_URL (pooler)**:
```
postgresql://postgres.[ref]:[password]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Non usare su Vercel**:
- Connection string **direct** (`db.xxx.supabase.co:5432`) → non IPv4-compatible da Vercel.

### Comportamento build su Vercel

- **Build**: `prisma generate && npm run migrate:deploy && next build`
- Se `SKIP_MIGRATIONS=true`: lo script `migrate:deploy` (via `scripts/migrate-safe.js`) **non** esegue `prisma migrate deploy` e termina con successo. Il runtime userà solo `DATABASE_URL` (pooler).
- Il client Prisma usa sempre `DATABASE_URL` per le query; `DIRECT_URL` serve solo a Prisma per le migrazioni (e su Vercel le migrazioni sono saltate).

### Migrazioni: da dove farle

Le migrazioni **non** vengono eseguite su Vercel. Applicarle in uno di questi modi:

1. **Da locale (consigliato)**  
   Sul tuo PC configura `.env` con:
   - `DATABASE_URL` = stessa del pooler (o del pooler di staging)
   - `DIRECT_URL` = connection string **direct** Supabase (host `db.xxx.supabase.co`, porta **5432**), raggiungibile dalla tua rete (IPv4).  
   Poi:
   ```bash
   npx prisma migrate deploy
   ```

2. **Da Supabase SQL Editor**  
   Copia il contenuto dei file in `prisma/migrations/*/migration.sql` ed eseguili manualmente nel SQL Editor del progetto Supabase.

3. **Da un host con IPv4 verso Supabase**  
   Se hai un server o CI con IPv4 che raggiunge Supabase, imposta lì `DIRECT_URL` e lancia `npx prisma migrate deploy`.

### Riepilogo

- **Produzione Vercel**: solo `DATABASE_URL` (pooler) + `SKIP_MIGRATIONS=true`. Nessun uso della direct in runtime.
- **DIRECT_URL**: solo per eseguire migrazioni da locale (o da altro host IPv4), non richiesta in produzione su Vercel.
- **Log avvio**: in `lib/prisma.js` viene loggato una volta (senza segreti) se `SKIP_MIGRATIONS` è attivo e se la connessione è in modalità pooler o direct (in base a host/porta).

### Istruzioni rapide Vercel

1. **Vercel → Settings → Environment Variables**
   - `DATABASE_URL` = connection string **pooler** Supabase (host `*.pooler.supabase.com`, porta `6543`, con `?pgbouncer=true&connection_limit=1`).
   - `SKIP_MIGRATIONS` = `true` (obbligatorio su Vercel).
   - `DIRECT_URL` = uguale a `DATABASE_URL` (solo per far passare `prisma generate`; le migrazioni non vengono eseguite).

2. **Migrazioni da locale**
   - In `.env` locale: `DATABASE_URL` = pooler, `DIRECT_URL` = direct Supabase (host `db.xxx.supabase.co`, porta `5432`).
   - Eseguire: `npx prisma migrate deploy`.

# PayPal (Sandbox per dev, Live per produzione)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id

# Resend (per newsletter, form contatti e tessera PDF)
RESEND_API_KEY=your_resend_api_key
RESEND_AUDIENCE_ID=your_resend_audience_id  # OBBLIGATORIO per newsletter
SENDER_EMAIL=noreply@fenam.website  # Fallback: noreply@fenam.website se non configurato
CONTACT_EMAIL=info@fenam.website  # OBBLIGATORIO per form contatti (riceve le email), fallback: info@fenam.website
# Opzionale: personalizza oggetto email affiliazione
AFFILIAZIONE_EMAIL_SUBJECT=Conferma affiliazione FENAM

# SMTP (DEPRECATO - non più usato per form contatti, ora usa Resend)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_smtp_user
# SMTP_PASS=your_smtp_pass
# SMTP_SECURE=false

# Base URL (per link email)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development
```

## Rate Limiting

Le API routes sono protette da rate limiting per prevenire abusi e spam:

- **Limite**: 10 richieste per minuto per IP
- **Risposta**: HTTP 429 (Too Many Requests) quando il limite è superato
- **Header**: `Retry-After` (secondi prima di poter riprovare)

### API Protette

- `/api/contact` - Form contatti
- `/api/newsletter` - Iscrizione newsletter
- `/api/confirm` - Conferma newsletter
- `/api/affiliazione/paypal` - Creazione ordine PayPal
- `/api/affiliazione/capture` - Capture pagamento PayPal

### Implementazione

Il rate limiting è implementato con un sistema **in-memory** (fixed window) che:
- Identifica l'IP reale anche dietro proxy/Vercel (`x-forwarded-for`)
- Mantiene contatori per finestra temporale di 1 minuto
- Pulisce automaticamente i contatori scaduti per evitare memory leak

### ⚠️ Limitazioni in Produzione

**Il rate limiter in-memory NON è perfetto per ambienti serverless/multi-instance** perché:
- Ogni istanza del server mantiene i propri contatori
- In Vercel/serverless, ogni funzione può avere contatori separati
- Un utente potrebbe fare 10 richieste su istanza A, poi 10 su istanza B (bypass parziale)

### Raccomandazione per Produzione

Per produzione, considera l'uso di un rate limiter distribuito:
- **Upstash Rate Limit** (Redis-based, serverless-friendly)
- **Vercel Edge Middleware** con Upstash
- **Redis** con librerie come `ioredis` + `rate-limiter-flexible`

Esempio con Upstash (da implementare in futuro):
```javascript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
})
```

### Test Rate Limiting

Per testare il rate limiting, esegui richieste multiple rapidamente:

```powershell
# Test contact API (Windows PowerShell)
1..15 | ForEach-Object {
  Invoke-RestMethod -Uri "http://localhost:3000/api/contact" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"nome":"Test","cognome":"User","email":"test@example.com","messaggio":"Test message"}'
  Start-Sleep -Milliseconds 100
}
```

Dopo 10 richieste, dovresti ricevere HTTP 429.

## Comandi Utili

### Database

- **Visualizza stato migrazioni (verifica drift):**
  ```powershell
  npx prisma migrate status
  ```

- **Apri Prisma Studio (GUI per database):**
  ```powershell
  npx prisma studio
  ```

- **Reset database locale (ATTENZIONE: cancella tutti i dati):**
  ```powershell
  # Solo per Setup A (Docker locale)
  npx prisma migrate reset
  ```

- **Crea nuova migrazione (SOLO per Setup A - locale):**
  ```powershell
  npx prisma migrate dev --name nome_migrazione
  ```
  
  ⚠️ **NON usare `migrate dev` su database remoto condiviso!**

- **Applica migrazioni esistenti (per Setup B - remoto):**
  ```powershell
  npx prisma migrate deploy
  ```

### Build e Deploy

- **Build produzione:**
  ```bash
  npm run build
  ```

- **Avvia produzione:**
  ```bash
  npm start
  ```

## Struttura Database

### Modelli Prisma

- **NewsletterSubscription**: Iscrizioni newsletter con doppia opt-in
- **ContactMessage**: Messaggi dal form contatti
- **Affiliation**: Richieste di affiliazione con stato pagamento PayPal e membership

### Sistema Membership

Le affiliazioni includono un sistema di **membership attiva**:

- **Attivazione**: Quando il pagamento PayPal viene catturato con successo (`status = "completed"`):
  - `memberSince` viene impostato alla data corrente (se non già presente)
  - `memberUntil` viene impostato a 1 anno dalla data corrente (365 giorni, se non già presente)

- **Durata**: La membership è valida per **1 anno** dalla data di attivazione

- **Stati Membership**:
  - **ACTIVE**: `status = "completed"` e `memberUntil > now()` - Membership attiva e valida
  - **EXPIRED**: `status = "completed"` ma `memberUntil <= now()` - Membership scaduta
  - **PENDING**: `status = "pending"` o `memberUntil` non impostato - Pagamento non completato o membership non ancora attivata

- **Idempotenza**: Se l'affiliazione è già `completed` e ha `memberUntil` impostato, le date non vengono modificate anche se il capture viene richiamato

- **Rinnovo**: Per rinnovare una membership scaduta, è necessario completare un nuovo pagamento (nuova affiliazione)

- **Numero Tessera**: Quando la membership viene attivata, viene generato automaticamente un `memberNumber` univoco nel formato `FENAM-YYYY-XXXXXX` (es. `FENAM-2026-ABC123`). Il sistema gestisce automaticamente le collisioni con retry fino a 5 tentativi.

- **Tessera PDF**: Dopo il completamento del pagamento PayPal, viene generata e inviata automaticamente una tessera socio in formato PDF via email. La tessera è in **formato card** (85.6mm x 54mm, standard carta di credito) e include:
  - Header con logo/brand FENAM
  - Nome e cognome del socio (grande, evidenziato)
  - Numero tessera
  - Date di validità (dal/al) in formato compatto
  - QR code per verifica online (in basso a destra, se `NEXT_PUBLIC_BASE_URL` è configurato)
  - Footer con fenam.it
  - Design compatto e coerente con il brand FENAM

- **Idempotenza Tessera**: Il sistema non reinvia la tessera se `membershipCardSentAt` è già impostato, anche se il capture viene richiamato.

## Note Importanti

- Il database usa **PostgreSQL** (non SQLite)
- Le migrazioni sono versionate in `prisma/migrations/`
- Il file `prisma/dev.db` (SQLite) non deve essere tracciato (già in `.gitignore`)
- **Setup A (Docker locale) è CONSIGLIATO** per evitare drift e conflitti
- **Setup B (remoto)**: usa solo `migrate deploy`, mai `migrate dev` su database condiviso
- Per produzione, configura `DATABASE_URL` con la connection string del database remoto

## Troubleshooting

### Errore "Could not find Prisma Schema"
- Verifica che `prisma/schema.prisma` esista nella directory corretta

### Errore connessione database
- Verifica che PostgreSQL sia in esecuzione
- Controlla che `DATABASE_URL` sia corretta e il database esista
- Verifica permessi utente PostgreSQL

### Migrazioni non applicate / Drift

**Per Setup A (Docker locale):**
```powershell
npx prisma migrate dev
```

**Per Setup B (remoto):**
```powershell
# Verifica drift
npx prisma migrate status

# Applica solo migrazioni esistenti
npx prisma migrate deploy

# Se ci sono conflitti, risolvi manualmente
npx prisma migrate resolve --applied MIGRATION_NAME
```

### Drift tra schema e database

Se vedi errori di drift:
1. **Setup A**: Fai `migrate reset` e riapplica tutte le migrazioni
2. **Setup B**: Usa `migrate resolve` per marcare migrazioni come applicate, oppure sincronizza manualmente lo schema con il database

### Payment Troubleshooting

#### Problema: Affiliazione resta "pending" dopo pagamento PayPal

**Sintomi:**
- Pagamento PayPal completato con successo
- Record nel DB resta con `status = 'pending'`
- Nessuna email/tessera inviata

**Diagnosi:**

1. **Verifica logs Vercel:**
   - Vai su Vercel Dashboard → Project → Deployments → Logs
   - Cerca errori con `[PayPal Capture]` o `[Mark Completed]`
   - Cerca `correlationId` per tracciare il flusso completo

2. **Query SQL per verificare stato:**
   ```sql
   -- Trova affiliazioni pending dopo pagamento
   SELECT 
     id,
     "orderId",
     status,
     email,
     "memberNumber",
     "createdAt"
   FROM "Affiliation"
   WHERE status = 'pending'
   ORDER BY "createdAt" DESC
   LIMIT 10;
   
   -- Verifica se PayPal capture è avvenuto ma DB non aggiornato
   -- (caso critico: pagamento completato ma DB non aggiornato)
   SELECT 
     id,
     "orderId",
     status,
     "payerEmail",
     "createdAt"
   FROM "Affiliation"
   WHERE status = 'pending'
     AND "createdAt" > NOW() - INTERVAL '24 hours';
   ```

3. **Verifica errori DB:**
   - Cerca nel log errori con categoria `DB_CONN` o `PRISMA`
   - Verifica che `DATABASE_URL` sia corretta e il database raggiungibile
   - Controlla che Prisma Client sia generato: `npx prisma generate`

**Soluzione:**

- **Se errore DB dopo PayPal capture:** Il pagamento è completato ma il DB non è stato aggiornato. Questo è un caso critico che richiede intervento manuale:
  1. Identifica l'`orderId` dal log (correlationId presente)
  2. Verifica su PayPal che il pagamento sia stato catturato
  3. Aggiorna manualmente il DB o usa endpoint admin per completare l'affiliazione

- **Se errore PayPal:** Verifica configurazione PayPal (CLIENT_ID, CLIENT_SECRET, ambiente sandbox/live)

#### Problema: Email/tessera non inviate ma pagamento completato

**Sintomi:**
- `status = 'completed'` nel DB
- `confirmationEmailSentAt` o `membershipCardSentAt` sono NULL
- Nessuna email ricevuta

**Diagnosi:**

1. **Verifica configurazione Resend:**
   ```sql
   -- Verifica affiliazioni completate senza email
   SELECT 
     id,
     email,
     "orderId",
     status,
     "confirmationEmailSentAt",
     "membershipCardSentAt"
   FROM "Affiliation"
   WHERE status = 'completed'
     AND ("confirmationEmailSentAt" IS NULL OR "membershipCardSentAt" IS NULL)
   ORDER BY "createdAt" DESC;
   ```

2. **Verifica env vars:**
   - `RESEND_API_KEY` deve essere configurato
   - `SENDER_EMAIL` deve essere verificato su Resend
   - `RESEND_AUDIENCE_ID` deve essere configurato per newsletter

3. **Verifica logs:**
   - Cerca errori con categoria `EMAIL` o `PDF`
   - Verifica che Resend non restituisca errori 422/429/500

**Soluzione:**

- **Side effects falliti (non bloccanti):** Il pagamento è completato e il DB è aggiornato. Le email/tessere possono essere reinviate tramite endpoint admin:
  ```bash
  POST /api/admin/resend-card
  Authorization: Bearer <ADMIN_TOKEN>
  Body: { "affiliationId": "..." }
  ```

#### Problema: Doppio memberNumber o collisioni

**Sintomi:**
- Errore Prisma `P2002` (unique constraint violation)
- `memberNumber` duplicato nel DB

**Diagnosi:**

```sql
-- Trova memberNumber duplicati
SELECT "memberNumber", COUNT(*) as count
FROM "Affiliation"
WHERE "memberNumber" IS NOT NULL
GROUP BY "memberNumber"
HAVING COUNT(*) > 1;
```

**Soluzione:**

- Il sistema gestisce automaticamente le collisioni con retry (max 5 tentativi)
- Se persiste, verifica che il constraint `@unique` sia presente su `memberNumber` nel Prisma schema
- In caso di collisione manuale, genera un nuovo memberNumber e aggiorna il record

#### Come testare PayPal Sandbox

1. **Crea account sandbox:**
   - Vai su https://developer.paypal.com
   - Crea account Business e Personal sandbox

2. **Configura env vars:**
   ```env
   PAYPAL_CLIENT_ID=<sandbox_client_id>
   PAYPAL_CLIENT_SECRET=<sandbox_secret>
   NEXT_PUBLIC_PAYPAL_CLIENT_ID=<sandbox_client_id>
   NODE_ENV=development
   ```

3. **Test flusso completo:**
   - Usa account Personal sandbox per pagare
   - Verifica che capture avvenga correttamente
   - Controlla logs per correlationId
   - Verifica DB che `status = 'completed'`

#### Correlation ID e Logging

Ogni richiesta genera un `correlationId` che permette di tracciare il flusso end-to-end:

- **CorrelationId da header:** Se presente `x-correlation-id`, viene usato quello
- **CorrelationId generato:** Altrimenti viene generato uno casuale
- **Nei log:** Cerca `correlationId` per tracciare una singola richiesta attraverso tutti i servizi

**Esempio query log Vercel:**
```
[PayPal Capture] correlationId: abc123def456
[Mark Completed] correlationId: abc123def456
[Side Effects] correlationId: abc123def456
```

---

## Dashboard Admin

Dashboard read-only per gestire e visualizzare le affiliazioni.

### Configurazione

Aggiungi al file `.env`:

```env
# Admin Dashboard (token di autenticazione)
ADMIN_TOKEN=your_secure_random_token_here
```

**⚠️ IMPORTANTE**: Genera un token sicuro e casuale:
```powershell
# PowerShell: genera token casuale
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Oppure usa un generatore online di token casuali (minimo 32 caratteri).

### Accesso Dashboard

1. **Apri la dashboard:**
   ```
   http://localhost:3000/admin/soci
   ```

2. **Inserisci il token:**
   - Il token viene salvato in `localStorage` (solo client-side)
   - Non viene mai esposto nel markup server-side

3. **Usa i filtri:**
   - **Status**: Filtra per "In attesa" o "Completate"
   - **Cerca**: Cerca per email, nome, cognome o orderId
   - **Paginazione**: Naviga tra le pagine (50 record per pagina)

### API Admin

L'API `/api/admin/affiliations` supporta autenticazione via:

**Header Authorization:**
```powershell
curl -X GET "http://localhost:3000/api/admin/affiliations?status=completed&take=10" `
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Query Parameter:**
```powershell
curl -X GET "http://localhost:3000/api/admin/affiliations?token=YOUR_ADMIN_TOKEN&status=completed&take=10"
```

**Query Parameters disponibili:**
- `status`: `pending` | `completed` (opzionale)
- `q`: stringa di ricerca su email, nome, cognome, orderId (opzionale)
- `take`: numero record da restituire (default: 50, max: 200)
- `skip`: numero record da saltare per paginazione (default: 0)

**Risposta:**
```json
{
  "items": [
    {
      "id": "...",
      "nome": "Mario",
      "cognome": "Rossi",
      "email": "mario.rossi@example.com",
      "orderId": "5O190127TN364715T",
      "status": "completed",
      "payerEmail": "payer@example.com",
      "confirmationEmailSentAt": "2026-01-16T12:15:30.000Z",
      "memberSince": "2026-01-16T12:15:30.000Z",
      "memberUntil": "2027-01-16T12:15:30.000Z",
      "memberNumber": "FENAM-2026-ABC123",
      "membershipCardSentAt": "2026-01-16T12:16:00.000Z",
      "createdAt": "2026-01-16T11:00:00.000Z"
    }
  ],
  "total": 150,
  "take": 50,
  "skip": 0
}
```

### Sicurezza

- ✅ Token mai loggato o esposto nel markup
- ✅ Autenticazione richiesta per ogni richiesta API
- ✅ Pagina admin funziona solo client-side (token in localStorage)
- ✅ Risposta 401 se token mancante o non valido
- ⚠️ **Nota**: Per produzione, considera autenticazione più robusta (JWT, sessioni, ecc.)

## Test End-to-End

Questa sezione descrive come testare il flusso completo di affiliazione, dalla creazione dell'ordine PayPal al download della tessera PDF.

### Prerequisiti

- Server di sviluppo attivo (`npm run dev`)
- PayPal Sandbox configurato (credenziali in `.env`)
- Database PostgreSQL con migrazioni applicate
- Resend configurato (opzionale, per email)

### Flusso Completo

#### 1. Crea Ordine PayPal

```powershell
# Crea ordine PayPal (POST /api/affiliazione/paypal)
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

**Verifica in DB:**
```sql
-- Verifica record creato
SELECT id, nome, cognome, email, "orderId", status, "createdAt"
FROM "Affiliation"
WHERE "orderId" = 'YOUR_ORDER_ID';
-- Status dovrebbe essere 'pending'
```

#### 2. Capture Pagamento PayPal

**Nota**: In Sandbox, devi completare il pagamento manualmente su PayPal, poi esegui il capture:

```powershell
# Capture pagamento (POST /api/affiliazione/capture)
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

**Verifica in DB dopo capture:**
```sql
-- Verifica record aggiornato
SELECT 
    id,
    nome,
    cognome,
    email,
    "orderId",
    status,
    "payerEmail",
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

#### 3. Verifica Tessera

```powershell
# Verifica tessera tramite API (GET /api/membership/verify)
$memberNumber = $captureResponse.memberNumber
$verifyResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/membership/verify?memberNumber=$memberNumber"

Write-Host "Verifica tessera:"
$verifyResponse | ConvertTo-Json

# Verificare:
# ✅ found = true
# ✅ status = 'completed'
# ✅ active = true (se memberUntil > now)
# ✅ memberSince e memberUntil presenti
```

**Verifica tramite pagina web:**
```
http://localhost:3000/verifica?memberNumber=FENAM-2026-XXXXXX
```

#### 4. Verifica Tessera Generata

```powershell
# Verifica tessera tramite API
if (Test-Path tessera_test.pdf) {
    Write-Host "✅ PDF generato correttamente"
    # Apri PDF
    Start-Process tessera_test.pdf
} else {
    Write-Host "❌ Errore generazione PDF"
}
```

### Checklist Verifica DB

Dopo il capture PayPal, verifica nel database:

```sql
-- 1. Record creato con status 'completed'
SELECT COUNT(*) FROM "Affiliation" WHERE status = 'completed';

-- 2. MemberNumber univoco generato
SELECT "memberNumber", COUNT(*) 
FROM "Affiliation" 
WHERE "memberNumber" IS NOT NULL 
GROUP BY "memberNumber" 
HAVING COUNT(*) > 1;
-- Dovrebbe restituire 0 righe (nessun duplicato)

-- 3. Membership attive (non scadute)
SELECT COUNT(*) 
FROM "Affiliation" 
WHERE status = 'completed' 
  AND "memberUntil" > NOW();

-- 4. Email inviate
SELECT COUNT(*) 
FROM "Affiliation" 
WHERE "confirmationEmailSentAt" IS NOT NULL;

-- 5. Tessere inviate
SELECT COUNT(*) 
FROM "Affiliation" 
WHERE "membershipCardSentAt" IS NOT NULL;
```

### Test Rinnovo Membership

Per testare il rinnovo, crea un secondo ordine con la stessa email:

```powershell
# Crea secondo ordine con stessa email (rinnovo)
$renewalBody = @{
    nome = "Mario"
    cognome = "Rossi"
    email = "mario.rossi@example.com"  # Stessa email del primo ordine
    telefono = "1234567890"
    privacy = $true
    donazione = 0
} | ConvertTo-Json

$renewalResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/affiliazione/paypal" `
    -Method POST `
    -ContentType "application/json" `
    -Body $renewalBody

# Dopo capture, verifica che memberUntil sia esteso di 1 anno dalla scadenza precedente
```

**Verifica rinnovo in DB:**
```sql
-- Verifica che il nuovo record abbia memberUntil esteso
SELECT 
    id,
    email,
    "memberSince",
    "memberUntil",
    "createdAt"
FROM "Affiliation"
WHERE email = 'mario.rossi@example.com'
ORDER BY "createdAt" DESC;

-- Il nuovo record dovrebbe avere:
-- ✅ memberUntil = memberUntil precedente + 1 anno (se ancora attiva)
-- ✅ Oppure memberUntil = oggi + 1 anno (se scaduta)
```

### Test Admin Dashboard

```powershell
# 1. Lista affiliazioni (GET /api/admin/affiliations)
$token = "YOUR_ADMIN_TOKEN"
$adminResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/affiliations?take=10" `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "Affiliazioni trovate: $($adminResponse.total)"

# 2. Filtra per status completed
$completedResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/affiliations?status=completed&take=10" `
    -Headers @{ Authorization = "Bearer $token" }

# 3. Filtra solo attivi
$activeResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/affiliations?membershipFilter=active&take=10" `
    -Headers @{ Authorization = "Bearer $token" }

# 4. Filtra scaduti
$expiredResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/affiliations?membershipFilter=expired&take=10" `
    -Headers @{ Authorization = "Bearer $token" }

# 5. Reinvia tessera (POST /api/admin/resend-card)
$affiliationId = "YOUR_AFFILIATION_ID"
$resendResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/resend-card?id=$affiliationId" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" }

Write-Host "Tessera reinviata a: $($resendResponse.email)"
```

### Troubleshooting

**Errore "OrderID non trovato":**
- Verifica che l'ordine sia stato creato prima del capture
- Controlla che `orderId` nel DB corrisponda a quello di PayPal

**Errore "MemberNumber già esistente":**
- Il sistema gestisce automaticamente le collisioni con retry (max 5 tentativi)
- Se persiste, verifica che non ci siano duplicati nel DB

**Email non inviata:**
- Verifica che `RESEND_API_KEY` e `SENDER_EMAIL` siano configurati
- Controlla i log del server per errori Resend
- Verifica che `confirmationEmailSentAt` e `membershipCardSentAt` siano null prima del capture

**Tessera PDF non generata:**
- Verifica che `memberNumber` sia presente dopo il capture
- Controlla i log per errori nella generazione PDF

---

## Verifica Tessera

Il sistema include una **verifica pubblica** della membership tramite numero tessera, accessibile tramite QR code sulla tessera PDF.

### Pagina Pubblica

**URL**: `/verifica?memberNumber=FENAM-2026-ABC123`

La pagina permette di:
- Verificare lo stato di una membership tramite numero tessera
- Visualizzare se la membership è attiva, scaduta o in attesa
- Vedere le date di validità (dal/al)
- Non espone dati sensibili (email, telefono, nome, cognome)

### API Verifica

**Endpoint**: `GET /api/membership/verify?memberNumber=FENAM-2026-ABC123`

**Rate Limiting**: 10 richieste/minuto per IP

**Risposta**:
```json
{
  "found": true,
  "status": "completed",
  "active": true,
  "memberUntil": "2027-01-16T12:15:30.000Z",
  "memberSince": "2026-01-16T12:15:30.000Z"
}
```

**Campi**:
- `found`: `boolean` - Se la tessera è stata trovata
- `status`: `"pending" | "completed" | ...` - Stato dell'affiliazione
- `active`: `boolean` - `true` se `status === "completed"` e `memberUntil > now()`
- `memberUntil`: `string | null` - Data di scadenza (ISO string)
- `memberSince`: `string | null` - Data di attivazione (ISO string)

**Esempi**:

```powershell
# Verifica tessera valida
curl -X GET "http://localhost:3000/api/membership/verify?memberNumber=FENAM-2026-ABC123"

# Verifica tessera non trovata
curl -X GET "http://localhost:3000/api/membership/verify?memberNumber=FENAM-2026-XXXXXX"

# Verifica tessera scaduta (se memberUntil < now)
curl -X GET "http://localhost:3000/api/membership/verify?memberNumber=FENAM-2025-OLD123"
```

### Sicurezza

- ✅ **Nessun PII esposto**: L'API non restituisce email, telefono, nome, cognome o altri dati sensibili
- ✅ **Rate limiting**: Protezione contro abusi (10 req/min per IP)
- ✅ **Read-only**: Solo GET, nessuna modifica ai dati
- ✅ **Validazione input**: Validazione e normalizzazione del `memberNumber` (trim, uppercase)

### Test API in Locale

```powershell
# Test 1: Lista tutte le affiliazioni
$token = "YOUR_ADMIN_TOKEN"
curl -X GET "http://localhost:3000/api/admin/affiliations" `
  -H "Authorization: Bearer $token"

# Test 2: Filtra per status completed
curl -X GET "http://localhost:3000/api/admin/affiliations?status=completed" `
  -H "Authorization: Bearer $token"

# Test 3: Cerca per email
curl -X GET "http://localhost:3000/api/admin/affiliations?q=mario.rossi" `
  -H "Authorization: Bearer $token"

# Test 4: Paginazione (seconda pagina, 20 record)
curl -X GET "http://localhost:3000/api/admin/affiliations?take=20&skip=20" `
  -H "Authorization: Bearer $token"

# Test 5: Token non valido (dovrebbe restituire 401)
curl -X GET "http://localhost:3000/api/admin/affiliations" `
  -H "Authorization: Bearer wrong_token"
```
