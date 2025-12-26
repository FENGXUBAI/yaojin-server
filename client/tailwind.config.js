/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 方案 A：活力竞技风
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316', // Orange-500
          600: '#ea580c',
          700: '#c2410c',
        },
        secondary: {
          500: '#3b82f6', // Blue-500
          900: '#1e3a8a', // Blue-900 (背景深色)
        },
        accent: {
          500: '#eab308', // Yellow-500 (金币/胜利)
        }
      },
      animation: {
        'bounce-slow': 'bounce 3s infinite',
      }
    },
  },
  plugins: [],
}
