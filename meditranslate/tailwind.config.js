/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#bcd8ff',
          300: '#8ebeff',
          400: '#5a9aff',
          500: '#3476f5',
          600: '#1d57eb',
          700: '#1a44d8',
          800: '#1c38af',
          900: '#1c348a',
        },
        surface: {
          900: '#080d14',
          800: '#0d1520',
          700: '#111d2b',
          600: '#162436',
          500: '#1e3045',
          400: '#284059',
        },
      },
      animation: {
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'avatar-glow': 'avatarGlow 3s ease-in-out infinite',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        avatarGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(52,118,245,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(52,118,245,0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
