/** Sem este arquivo o Next.js não processa as diretivas @tailwind do
 *  globals.css e o site sai 100% sem estilo em produção. */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
