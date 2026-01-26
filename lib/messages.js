// lib/messages.js
// Messaggi centralizzati per UI (CTA, errori, successo)

export const messages = {
  cta: {
    confirmAffiliation: 'Conferma affiliazione gratuita',
    processing: 'Elaborazione...',
    backHome: 'Torna alla Home',
    learnMore: 'Scopri di più',
  },
  success: {
    affiliationCompleted: 'Affiliazione completata!',
    affiliationTitle: 'Affiliazione Completata!',
    affiliationMessage: 'Grazie per esserti affiliato a FENAM. La tua richiesta è stata processata con successo.',
  },
  errors: {
    affiliationError: 'Errore durante la creazione dell\'affiliazione',
    paymentError: 'Errore durante la conferma del pagamento',
    handoffError: 'Errore handoff',
    paypalError: 'Errore PayPal',
    paypalConfigMissing: 'Configurazione PayPal mancante',
    paypalLoadError: 'Errore caricamento PayPal',
  },
  info: {
    freeAffiliation: 'Affiliazione gratuita — donazione facoltativa',
    orderIdLabel: 'ID Ordine:',
  },
}
