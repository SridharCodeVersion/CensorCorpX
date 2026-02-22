/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0E0E0E',
        sidebar: '#1E1E1E',
        accent: '#007ACC'
      },
      borderRadius: {
        smooth: '8px'
      },
      boxShadow: {
        'accent-glow': '0 0 0 1px rgba(0, 122, 204, 0.6)'
      }
    }
  },
  plugins: []
}

