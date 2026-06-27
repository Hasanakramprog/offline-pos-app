/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pos: {
          bg:       '#f8f9fc',   // warm off-white page background
          surface:  '#ffffff',   // clean white cards & panels
          border:   '#e2e8f0',   // soft slate border
          primary:  '#6366f1',   // vibrant indigo — buttons, links, accents
          secondary:'#8b5cf6',   // purple accent
          success:  '#059669',   // rich emerald green
          warning:  '#d97706',   // warm amber
          danger:   '#dc2626',   // clear red
          text:     '#1e293b',   // dark slate for readability
          muted:    '#64748b',   // medium slate for secondary text
        },
      },
      boxShadow: {
        'soft':  '0 1px 3px 0 rgba(0,0,0,.06), 0 1px 2px -1px rgba(0,0,0,.04)',
        'card':  '0 4px 6px -1px rgba(0,0,0,.05), 0 2px 4px -2px rgba(0,0,0,.03)',
        'float': '0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -4px rgba(0,0,0,.04)',
      },
    },
  },
  plugins: [],
};
