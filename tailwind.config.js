/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)'
      },
      fontFamily: {
        eraser: ['Eraser', 'var(--font-fallback)'],
        comic: [
          'var(--font-comic-neue)',
          'Comic Neue',
          'Comic Sans MS',
          'cursive'
        ],
        architects: [
          'var(--font-architects-daughter)',
          'Architects Daughter',
          'cursive'
        ],
        bubblegum: ['var(--font-bubblegum-sans)', 'Bubblegum Sans', 'cursive'],
        indie: ['var(--font-indie-flower)', 'Indie Flower', 'cursive']
      },
      fontDisplay: {
        swap: 'swap',
        fallback: 'fallback',
        optional: 'optional'
      }
    }
  },
  plugins: []
};
