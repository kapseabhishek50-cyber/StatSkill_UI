/** @type {import('tailwindcss').Config} */

// Enterprise–Government SaaS design system for StatSkill AI.
// Colours are declared once in src/index.css as custom properties and
// referenced here by role. Light/dark swap in one place.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        plane: 'var(--plane)',
        surface: 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        ink: 'var(--text-primary)',
        'ink-2': 'var(--text-secondary)',
        'ink-muted': 'var(--text-muted)',
        hairline: 'var(--border)',
        grid: 'var(--gridline)',
        baseline: 'var(--baseline)',
        navy: 'var(--navy)',
        'navy-deep': 'var(--navy-deep)',
        'sidebar-bg': 'var(--sidebar-bg)',
        'sidebar-text': 'var(--sidebar-text)',
        'series-1': 'var(--series-1)',
        'series-2': 'var(--series-2)',
        'series-3': 'var(--series-3)',
        good: 'var(--status-good)',
        warning: 'var(--status-warning)',
        serious: 'var(--status-serious)',
        critical: 'var(--status-critical)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-light': 'var(--primary-light)',
        'primary-border': 'var(--primary-border)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        ai: 'var(--ai)',
        'ai-glow': 'var(--ai-glow)',
        streak: 'var(--streak)',
        xp: 'var(--xp)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      // Compact, professional type scale (400–700 only)
      fontSize: {
        'hero-desktop': ['2.5rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
        'hero-mobile': ['1.875rem', { lineHeight: '1.25', fontWeight: '700', letterSpacing: '-0.01em' }],
        'h1': ['1.375rem', { lineHeight: '1.35', fontWeight: '700', letterSpacing: '-0.01em' }],
        'h2': ['1.125rem', { lineHeight: '1.4', fontWeight: '650' }],
        'h3': ['0.9375rem', { lineHeight: '1.45', fontWeight: '600' }],
        'card-title': ['0.9375rem', { lineHeight: '1.45', fontWeight: '600' }],
      },
      borderRadius: {
        card: '10px',
        'card-lg': '12px',
        'card-xl': '12px',
        button: '8px',
        pill: '999px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(6, 59, 120, 0.05)',
        card: '0 1px 2px rgba(6, 59, 120, 0.06), 0 1px 3px rgba(6, 59, 120, 0.05)',
        'card-hover': '0 4px 12px rgba(6, 59, 120, 0.10), 0 2px 4px rgba(6, 59, 120, 0.06)',
        'card-premium': '0 4px 12px rgba(6, 59, 120, 0.10), 0 2px 4px rgba(6, 59, 120, 0.06)',
        glow: '0 0 0 3px var(--ai-glow)',
        'glow-lg': '0 0 0 4px var(--ai-glow)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 1.8s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
