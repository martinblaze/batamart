/** @type {import('tailwindcss').Config} */

// Resolves a theme color to an RGB-triplet CSS variable so Tailwind can
// generate opacity-modified utilities (bg-primary/10, ring-primary/40, etc).
// The variables (--color-*-rgb) are defined in styles/globals.css alongside
// their hex counterparts, for both :root and .dark.
function withOpacity(cssVar: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue !== undefined
      ? `rgb(var(${cssVar}) / ${opacityValue})`
      : `rgb(var(${cssVar}))`
}

module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // BataMart Design Bible tokens (see BATAMART_DESIGN_BIBLE.md section 2)
        // Backed by CSS custom properties in styles/globals.css so light/dark stay in sync.
        primary: withOpacity('--color-primary-rgb'),           // --color-primary #1E90FF — the only accent color
        background: withOpacity('--color-background-rgb'),     // --color-background
        surface: withOpacity('--color-surface-rgb'),            // --color-surface
        // The raised surface a card sits on. White in light mode, a step
        // *above* the page ground in dark — which is why a hardcoded white
        // cannot serve here. See the .dark block in styles/app-ui.css.
        card: withOpacity('--ui-card-rgb'),                      // --ui-card
        // A full-bleed dark band that stays dark in BOTH themes, with light
        // text on it. Distinct from `ink`, which deliberately inverts — a
        // trust banner or hero rendered with `bg-ink` flips to a cream slab in
        // dark mode and takes its translucent white text with it.
        slab: {
          DEFAULT: withOpacity('--ui-slab-rgb'),                 // --ui-slab
          fg: withOpacity('--ui-slab-fg-rgb'),                   // --ui-slab-fg
        },
        border: withOpacity('--color-border-rgb'),               // --color-border
        ink: {
          DEFAULT: withOpacity('--color-text-primary-rgb'),      // --color-text-primary
          secondary: withOpacity('--color-text-secondary-rgb'),  // --color-text-secondary
          muted: withOpacity('--color-text-muted-rgb'),           // --color-text-muted
        },
        success: withOpacity('--color-success-rgb'),
        danger: withOpacity('--color-danger-rgb'),
        warning: withOpacity('--color-warning-rgb'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Archivo', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Instrument Serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      // Sharp edges are a brand rule (see styles/app-ui.css). Rather than
      // rewrite the several thousand `rounded-lg`/`rounded-xl` utilities
      // already in the codebase, the scale itself is flattened — every
      // existing corner tightens at once, and `rounded-full` is left alone so
      // avatars, pills and status dots stay circular.
      borderRadius: {
        none: '0px',
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '3px',
        '2xl': '4px',
        '3xl': '6px',
        full: '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-subtle': 'bounceSubtle 0.5s ease-in-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'float-slower': 'floatSlow 9s ease-in-out infinite',
        'heartbeat': 'heartbeat 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-14px) rotate(4deg)' },
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.12)' },
          '30%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.08)' },
          '60%': { transform: 'scale(1)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '100': '25rem',
        '112': '28rem',
        '128': '32rem',
      },
      minHeight: {
        '44': '44px', // Touch-friendly minimum for mobile
      },
      minWidth: {
        '44': '44px', // Touch-friendly minimum for mobile
      },
      boxShadow: {
        // Design bible section 5: one soft shadow token, no glow/coloured
        // shadows. Retuned warm and much lighter — with the radius scale
        // flattened, the old two-layer grey shadow muddied every card edge.
        // ~214 call sites inherit this, so the token is the place to fix it.
        'soft': '0 1px 1px rgba(19,19,17,0.03), 0 10px 28px -20px rgba(19,19,17,0.22)',
      },
      scale: {
        '98': '0.98',
      },
      backdropBlur: {
        xs: '2px',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      transitionDuration: {
        '2000': '2000ms',
      },
      screens: {
        'xs': '475px',
        '3xl': '1920px',
      },
    },
  },
  plugins: [
    // Add custom utilities
    function ({ addUtilities }) {
      const newUtilities = {
        '.safe-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-left': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-right': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        '.tap-highlight-none': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.overscroll-contain': {
          'overscroll-behavior': 'contain',
        },
      };
      addUtilities(newUtilities);
    },
  ],
}
