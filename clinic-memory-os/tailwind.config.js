/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: '#f0f5fb',     // page background — cool off-white
        panel:   '#ffffff',     // panel/card background — crisp white
        card:    '#dce8f2',     // inset/nested background — light blue-grey
        border:  '#b6c8d8',     // borders — visible but gentle
        accent:  '#0369a1',     // primary action — deep sky-blue (WCAG AA)
        'accent-hover': '#0284c7',
        success: '#15803d',     // green-700 (WCAG AA on white)
        warning: '#b45309',     // amber-700 (WCAG AA on white)
        danger:  '#dc2626',     // red-600
        muted:   '#4d6175',     // secondary text on light bg
        primary: '#1b3649',     // main text — near-black navy
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
