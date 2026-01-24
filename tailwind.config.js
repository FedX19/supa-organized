/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        card: {
          DEFAULT: '#1a1a1a',
          border: '#2a2a2a',
          hover: '#242424',
        },
        sidebar: '#1e293b',
        primary: {
          DEFAULT: '#f59e0b',
          hover: '#d97706',
          light: '#fbbf24',
          dark: '#b45309',
        },
      },
    },
  },
  plugins: [],
}
