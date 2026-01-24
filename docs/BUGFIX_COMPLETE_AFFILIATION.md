# Bug Fix: completeAffiliation Early Return

**Data fix:** 24 Gennaio 2026  
**Problema:** `completeAffiliation` esce troppo presto quando `status === 'completed'`, rompendo il flusso free che crea già record con `status='completed'` ma senza i campi necessari (memberNumber, memberSince, memberUntil).

---

## 🔴 Problema

Il flusso free creava record con `status='completed'` direttamente, ma `completeAffiliation` faceva early return solo controllando lo status, senza verificare se tutti i campi necessari erano presenti. Questo causava:
- Record con `status='completed'` ma senza `memberNumber`
- Record con `status='completed'` ma senza `memberSince` e `memberUntil`
- Email e PDF tessera non inviati

---

## ✅ Soluzione

1. **`lib/affiliation.js`**: Modificato early return per verificare che status='completed' **E** tutti i campi necessari siano presenti
2. **`pages/api/affiliazione/free.js`**: Cambiato status iniziale da `'completed'` a `'pending'`, lasciando che `completeAffiliation` lo porti a `'completed'`

---

## 📋 Diff Patch

### 1. `lib/affiliation.js`

```diff
--- a/lib/affiliation.js
+++ b/lib/affiliation.js
@@ -81,11 +81,20 @@ export async function completeAffiliation({
     throw new Error(`Affiliazione ${affiliationId} non trovata`)
   }
 
-  // Se già completed, ritorna stato attuale (idempotente)
-  if (affiliation.status === 'completed') {
+  // Se già completed E tutti i campi necessari sono presenti, ritorna stato attuale (idempotente)
+  if (
+    affiliation.status === 'completed' &&
+    affiliation.memberNumber &&
+    affiliation.memberSince &&
+    affiliation.memberUntil
+  ) {
     return {
       memberNumber: affiliation.memberNumber,
       emailSent: !!affiliation.confirmationEmailSentAt,
       cardSent: !!affiliation.membershipCardSentAt,
     }
   }
+
+  // Se status è 'completed' ma mancano campi, procedi a completarli
+  if (affiliation.status === 'completed') {
+    console.log(
+      `⚠️ [Complete Affiliation] Status 'completed' ma campi mancanti per affiliation ${affiliationId}, procedo al completamento`
+    )
+  }
```

**Spiegazione:**
- Prima: Early return se `status === 'completed'` (senza verificare campi)
- Dopo: Early return solo se `status === 'completed'` **E** `memberNumber` **E** `memberSince` **E** `memberUntil` sono presenti
- Se status è 'completed' ma mancano campi, procede al completamento con log di warning

---

### 2. `pages/api/affiliazione/free.js`

```diff
--- a/pages/api/affiliazione/free.js
+++ b/pages/api/affiliazione/free.js
@@ -101,12 +101,12 @@ export default async function handler(req, res) {
   const orderId = `FREE-${randomBytes(8).toString('hex')}`
 
   try {
-    // 5) Crea record nel DB con status "completed"
+    // 5) Crea record nel DB con status "pending" (completeAffiliation lo porterà a "completed")
     const affiliation = await prisma.affiliation.create({
       data: {
         nome,
         cognome,
         email,
         telefono,
         privacy,
         orderId,
-        status: 'completed', // Immediatamente completed per affiliazione gratuita
+        status: 'pending', // completeAffiliation lo porterà a "completed" dopo aver generato memberNumber e date
       },
     })
```

**Spiegazione:**
- Prima: Creava record con `status='completed'` direttamente
- Dopo: Crea record con `status='pending'` e lascia che `completeAffiliation` lo porti a `'completed'` dopo aver generato tutti i campi necessari

---

## 🧪 Test Scenarios

### Scenario 1: Affiliazione gratuita nuova
1. POST `/api/affiliazione/free` con dati validi
2. ✅ Record creato con `status='pending'`
3. ✅ `completeAffiliation` genera `memberNumber`, imposta date, invia email/PDF
4. ✅ Record aggiornato a `status='completed'` con tutti i campi

### Scenario 2: Idempotenza (affiliazione già esistente)
1. POST `/api/affiliazione/free` con email già esistente e `status='completed'`
2. ✅ Ritorna orderId esistente (idempotenza funziona)

### Scenario 3: Record legacy con status='completed' ma campi mancanti
1. Record esistente con `status='completed'` ma senza `memberNumber`
2. ✅ `completeAffiliation` rileva campi mancanti e procede al completamento
3. ✅ Genera `memberNumber`, imposta date, invia email/PDF

### Scenario 4: Record già completamente completato
1. Record con `status='completed'` **E** `memberNumber` **E** `memberSince` **E** `memberUntil`
2. ✅ `completeAffiliation` fa early return (idempotente)
3. ✅ Non rigenera campi già presenti

---

## ✅ Verifica

Dopo il fix:
- ✅ Flusso free crea record con `status='pending'`
- ✅ `completeAffiliation` completa correttamente anche record con status='completed' ma campi mancanti
- ✅ Idempotenza preservata per record già completamente completati
- ✅ Email e PDF tessera vengono inviati correttamente

---

**Fine fix**
