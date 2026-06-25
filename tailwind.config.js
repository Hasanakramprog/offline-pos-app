/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pos: {
          bg:       '#0f172a',
          surface:  '#1e293b',
          border:   '#334155',
          primary:  '#06b6d4',
          secondary:'#8b5cf6',
          success:  '#10b981',
          warning:  '#f59e0b',
          danger:   '#ef4444',
          text:     '#f8fafc',
          muted:    '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
