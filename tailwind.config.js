module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary:  '#12A969',   // verde brillante
        secondary:'#024230',   // verde scuro
        cream:    '#fff9e9',   // box settori/valori
        paper:    '#fff9e9',   // body sections (grigio-caldo)
        night:    '#003039',   // footer + form
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
