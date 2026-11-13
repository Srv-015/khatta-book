const c = (n) => `var(--${n})`;
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { bg: c('bg'), sf: c('sf'), tx: c('tx'), mu: c('mu'), bd: c('bd'), ac: c('ac'), ac2: c('ac2'), ok: c('ok'), okb: c('okb'), wa: c('wa'), wab: c('wab'), er: c('er'), erb: c('erb'), inf: c('in'), inb: c('inb') },
      fontFamily: { serif: ['Georgia', 'serif'] },
    },
  },
  plugins: [],
};
