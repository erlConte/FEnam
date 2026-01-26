// lib/brand.js
// Single source of truth per brand tokens (colori, typography, terminologia)

export const brand = {
  colors: {
    primary: '#12A969',   // verde brillante
    secondary: '#024230', // verde scuro
    cream: '#fff9e9',     // box settori/valori
    paper: '#e9ebe7',     // body sections (grigio-caldo)
    night: '#003039',     // footer + form
  },
  typography: {
    fontFamily: 'var(--font-inter), ui-sans-serif, system-ui',
  },
  terminology: {
    affiliation: 'affiliazione',
    card: 'tessera',
    donation: 'donazione facoltativa',
    member: 'socio',
    members: 'soci',
  },
}
