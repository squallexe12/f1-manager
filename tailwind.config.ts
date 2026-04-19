import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Existing Kinetic bindings — PRESERVED, consumed by non-Strategy pages ───
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          surface: 'var(--bg-surface)',
        },
        border: {
          default: 'var(--border-default)',
          hover: 'var(--border-hover)',
        },
        accent: {
          lime: 'var(--accent-lime)',
          cyan: 'var(--accent-cyan)',
          red: 'var(--accent-red)',
          amber: 'var(--accent-amber)',
          purple: 'var(--accent-purple)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
        },
        // ─── New Broadcast bindings — ADDED, consumed only by Strategy components ───
        surface: {
          void:   'var(--surface-void)',
          base:   'var(--surface-base)',
          paper:  'var(--surface-paper)',
          raised: 'var(--surface-raised)',
          hi:     'var(--surface-hi)',
        },
        line: {
          hair:   'var(--line-hair)',
          sub:    'var(--line-sub)',
          strong: 'var(--line-strong)',
        },
        ink: {
          dim:  'var(--ink-dim)',
          mute: 'var(--ink-mute)',
          body: 'var(--ink-body)',
          hi:   'var(--ink-hi)',
        },
        sig: {
          red:      'var(--sig-red)',
          'red-dk': 'var(--sig-red-dk)',
          amber:    'var(--sig-amber)',
          green:    'var(--sig-green)',
          cyan:     'var(--sig-cyan)',
          purple:   'var(--sig-purple)',
          pink:     'var(--sig-pink)',
        },
        c: {
          soft:  'var(--c-soft)',
          med:   'var(--c-med)',
          hard:  'var(--c-hard)',
          inter: 'var(--c-inter)',
          wet:   'var(--c-wet)',
        },
      },
      fontFamily: {
        heading:  ['var(--font-heading)'],
        body:     ['var(--font-body)'],
        mono:     ['var(--font-mono)'],
        display:  ['var(--font-display)'],
      },
      borderRadius: {
        rad: 'var(--rad)',
      },
    },
  },
  plugins: [],
}
export default config
