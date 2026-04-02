// ─────────────────────────────────────────────────────────────────────────────
// Theme system — full-page themes
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_KEY = 'hoho_theme'

export interface AppTheme {
  id: string
  name: string
  // Page surfaces
  background: string       // page bg
  surface: string          // cards, modals
  surfaceAlt: string       // table alt rows, hover states
  border: string           // all borders
  // Text
  text: string             // primary text
  textMuted: string        // labels, placeholders
  // Brand / interactive
  primary: string          // buttons, active states, links
  primaryForeground: string // text on primary bg
  // Sidebar
  sidebar: string          // sidebar bg
  sidebarText: string      // sidebar item text
  sidebarActive: string    // active item bg
  sidebarActiveTxt: string // active item text
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset themes
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_PRESETS: AppTheme[] = [
  {
    id: 'clean-white',
    name: 'Clean White',
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceAlt: '#f3f4f6',
    border: '#e5e7eb',
    text: '#111827',
    textMuted: '#6b7280',
    primary: '#16a34a',
    primaryForeground: '#ffffff',
    sidebar: '#ffffff',
    sidebarText: '#374151',
    sidebarActive: '#dcfce7',
    sidebarActiveTxt: '#15803d',
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceAlt: '#334155',
    border: '#334155',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    primary: '#22c55e',
    primaryForeground: '#052e16',
    sidebar: '#0f172a',
    sidebarText: '#94a3b8',
    sidebarActive: '#1e4d36',
    sidebarActiveTxt: '#4ade80',
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    background: '#0c1a2e',
    surface: '#112240',
    surfaceAlt: '#1d3461',
    border: '#1d3461',
    text: '#ccd6f6',
    textMuted: '#8892b0',
    primary: '#64ffda',
    primaryForeground: '#0a192f',
    sidebar: '#0a192f',
    sidebarText: '#8892b0',
    sidebarActive: '#1d3461',
    sidebarActiveTxt: '#64ffda',
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    background: '#fff7ed',
    surface: '#ffffff',
    surfaceAlt: '#ffedd5',
    border: '#fed7aa',
    text: '#1c1917',
    textMuted: '#78716c',
    primary: '#ea580c',
    primaryForeground: '#ffffff',
    sidebar: '#fff7ed',
    sidebarText: '#44403c',
    sidebarActive: '#fed7aa',
    sidebarActiveTxt: '#c2410c',
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    background: '#faf5ff',
    surface: '#ffffff',
    surfaceAlt: '#f3e8ff',
    border: '#e9d5ff',
    text: '#1a1a2e',
    textMuted: '#6b7280',
    primary: '#9333ea',
    primaryForeground: '#ffffff',
    sidebar: '#faf5ff',
    sidebarText: '#374151',
    sidebarActive: '#e9d5ff',
    sidebarActiveTxt: '#7e22ce',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#09090b',
    surface: '#18181b',
    surfaceAlt: '#27272a',
    border: '#27272a',
    text: '#fafafa',
    textMuted: '#71717a',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    sidebar: '#09090b',
    sidebarText: '#71717a',
    sidebarActive: '#1e3a5f',
    sidebarActiveTxt: '#93c5fd',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#f0fdf4',
    surface: '#ffffff',
    surfaceAlt: '#dcfce7',
    border: '#bbf7d0',
    text: '#14532d',
    textMuted: '#4b7c5e',
    primary: '#15803d',
    primaryForeground: '#ffffff',
    sidebar: '#f0fdf4',
    sidebarText: '#166534',
    sidebarActive: '#bbf7d0',
    sidebarActiveTxt: '#14532d',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    background: '#fff1f2',
    surface: '#ffffff',
    surfaceAlt: '#ffe4e6',
    border: '#fecdd3',
    text: '#1c1917',
    textMuted: '#78716c',
    primary: '#e11d48',
    primaryForeground: '#ffffff',
    sidebar: '#fff1f2',
    sidebarText: '#44403c',
    sidebarActive: '#fecdd3',
    sidebarActiveTxt: '#9f1239',
  },
]

export const DEFAULT_THEME = THEME_PRESETS[0]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hsl(hex: string): string {
  const [h, s, l] = hexToHsl(hex)
  return `${h} ${s}% ${l}%`
}

/** Blend two hex colors at ratio t (0 = hex1, 1 = hex2) */
function blend(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0')
  const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0')
  const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply
// ─────────────────────────────────────────────────────────────────────────────

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // ── Page / surface ──────────────────────────────────────────────────────
  root.style.setProperty('--background',          hsl(theme.background))
  root.style.setProperty('--foreground',           hsl(theme.text))
  root.style.setProperty('--card',                 hsl(theme.surface))
  root.style.setProperty('--card-foreground',      hsl(theme.text))
  root.style.setProperty('--popover',              hsl(theme.surface))
  root.style.setProperty('--popover-foreground',   hsl(theme.text))

  // ── Primary ─────────────────────────────────────────────────────────────
  root.style.setProperty('--primary',              hsl(theme.primary))
  root.style.setProperty('--primary-foreground',   hsl(theme.primaryForeground))
  root.style.setProperty('--ring',                 hsl(theme.primary))

  // ── Surface variants (secondary / muted / accent) ────────────────────────
  // All three map to surfaceAlt so hover states, badges, table rows all follow
  root.style.setProperty('--secondary',            hsl(theme.surfaceAlt))
  root.style.setProperty('--secondary-foreground', hsl(theme.text))
  root.style.setProperty('--muted',                hsl(theme.surfaceAlt))
  root.style.setProperty('--muted-foreground',     hsl(theme.textMuted))
  root.style.setProperty('--accent',               hsl(theme.surfaceAlt))
  root.style.setProperty('--accent-foreground',    hsl(theme.text))

  // ── Border + Input ───────────────────────────────────────────────────────
  root.style.setProperty('--border',               hsl(theme.border))
  root.style.setProperty('--input',                hsl(theme.border))

  // ── Body (overrides any Tailwind bg class) ───────────────────────────────
  document.body.style.backgroundColor = theme.background
  document.body.style.color = theme.text

  // ── Sidebar (raw hex — used via var() in Sidebar.tsx) ───────────────────
  root.style.setProperty('--sidebar-bg',           theme.sidebar)
  root.style.setProperty('--sidebar-border',       theme.border)
  root.style.setProperty('--sidebar-text',         theme.sidebarText)
  root.style.setProperty('--sidebar-active-bg',    theme.sidebarActive)
  root.style.setProperty('--sidebar-active-text',  theme.sidebarActiveTxt)
  // Hover = 40% blend from sidebar bg toward the active bg
  root.style.setProperty('--sidebar-hover-bg',     blend(theme.sidebar, theme.sidebarActive, 0.4))
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

export function saveTheme(id: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(THEME_KEY, id)
}

export function loadTheme(): AppTheme {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME
  const id = localStorage.getItem(THEME_KEY)
  return THEME_PRESETS.find(t => t.id === id) ?? DEFAULT_THEME
}
