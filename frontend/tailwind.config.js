/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1E293B',
        primary: '#188580',
        secondary: '#cce8e6',
        text: '#F8FAFC',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.scrollbar-thumb-amber-500\\/30': {
          'scrollbar-color': 'rgba(245, 158, 11, 0.3) rgba(30, 41, 59, 0.5)',
        },
        '.scrollbar-track-slate-800\\/50': {
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(30, 41, 59, 0.5)',
            'border-radius': '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(245, 158, 11, 0.3)',
            'border-radius': '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(245, 158, 11, 0.5)',
          },
        },
      });
    },
  ],
};
