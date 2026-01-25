# Deployment con Supabase Pooler-Only

Questa guida descrive come configurare il deployment su Vercel utilizzando Supabase con connessione pooler-only (PgBouncer).

## Configurazione Prisma Schema

Il file `prisma/schema.prisma` è configurato per utilizzare solo la connessione pooler:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Nota**: Non è presente `directUrl` perché utilizziamo solo la connessione pooler tramite PgBouncer.

## Configurazione Runtime Vercel

Su Vercel, la variabile d'ambiente `DATABASE_URL` deve essere configurata con la connection string del pooler di Supabase.

La connection string del pooler ha tipicamente questo formato:
```
postgresql://[user]:[password]@[host]:6543/[database]?pgbouncer=true
```

**Importante**: Assicurati di utilizzare la porta **6543** (pooler) e non la porta 5432 (direct connection).

## Setup Iniziale Database

Poiché Prisma Migrate e `prisma db push` potrebbero non funzionare correttamente tramite PgBouncer (a causa delle limitazioni del connection pooling), è necessario eseguire manualmente le migrazioni nel Supabase SQL Editor.

### Procedura

1. Accedi al tuo progetto Supabase
2. Apri il **SQL Editor**
3. Esegui i file di migrazione in ordine cronologico:

   ```sql
   -- 1. Esegui: prisma/migrations/20250611210107_init/migration.sql
   -- 2. Esegui: prisma/migrations/20250611213819_add_contact_message/migration.sql
   -- 3. Esegui: prisma/migrations/20260116113806_add_affiliation/migration.sql
   -- 4. Esegui: prisma/migrations/20260116114758_add_payer_email/migration.sql
   -- 5. Esegui: prisma/migrations/20260116120000_add_confirmation_email_sent_at/migration.sql
   -- 6. Esegui: prisma/migrations/20260116130000_add_membership_dates/migration.sql
   -- 7. Esegui: prisma/migrations/20260116140000_add_member_number_and_card_sent/migration.sql
   ```

4. Verifica che tutte le tabelle siano state create correttamente

### Ordine delle Migrazioni

Le migrazioni devono essere eseguite nell'ordine seguente:

1. `20250611210107_init` - Crea tabella `NewsletterSubscription`
2. `20250611213819_add_contact_message` - Crea tabella `ContactMessage`
3. `20260116113806_add_affiliation` - Crea tabella `Affiliation`
4. `20260116114758_add_payer_email` - Aggiunge colonna `payerEmail` a `Affiliation`
5. `20260116120000_add_confirmation_email_sent_at` - Aggiunge colonna `confirmationEmailSentAt` a `Affiliation`
6. `20260116130000_add_membership_dates` - Aggiunge colonne `memberSince` e `memberUntil` a `Affiliation`
7. `20260116140000_add_member_number_and_card_sent` - Aggiunge colonne `memberNumber` e `membershipCardSentAt` a `Affiliation`, crea indice unico su `memberNumber`

## Limitazioni con PgBouncer

### Comandi Prisma che potrebbero non funzionare

I seguenti comandi Prisma potrebbero non funzionare correttamente quando si utilizza solo la connessione pooler:

- `prisma migrate deploy` - Potrebbe fallire a causa delle limitazioni del connection pooling
- `prisma db push` - Potrebbe non funzionare correttamente via PgBouncer
- `prisma migrate dev` - Non utilizzare in produzione

### Soluzione

Per le migrazioni, utilizza sempre il **Supabase SQL Editor** per eseguire manualmente i file SQL delle migrazioni.

### Comandi Prisma che funzionano

I seguenti comandi funzionano correttamente con la connessione pooler:

- `prisma generate` - Genera il Prisma Client
- Query e operazioni CRUD tramite Prisma Client - Funzionano normalmente

## Verifica Deployment

Dopo il deployment:

1. Verifica che `DATABASE_URL` sia configurata correttamente su Vercel
2. Verifica che l'applicazione si connetta correttamente al database
3. Testa le operazioni CRUD per assicurarti che tutto funzioni

## Note Aggiuntive

- Il pooler PgBouncer è ottimizzato per gestire molte connessioni simultanee
- La connessione pooler è ideale per ambienti serverless come Vercel
- Per operazioni di migrazione complesse, considera l'utilizzo temporaneo di una direct connection (solo durante le migrazioni)
