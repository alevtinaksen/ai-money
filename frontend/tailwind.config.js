/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: '#F2F2F7',
          card: '#FFFFFF',
          secondary: '#8E8E93',
          blue: '#2B5BFF',
          blueActive: '#1D45D8',
          danger: '#FF3B30',
          success: '#34C759',
          border: '#E5E5EA',
          grayText: '#7C7C80',
          dark: '#1C1C1E',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif'
        ]
      },
      boxShadow: {
        'ios-card': '0 2px 12px rgba(0, 0, 0, 0.04)',
        'ios-float': '0 8px 24px rgba(43, 91, 255, 0.35)',
        'ios-numpad': '0 1px 2px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        '13': '3.25rem',
        '17': '4.25rem',
        '18': '4.5rem',
      }
    },
  },
  plugins: [],
}
