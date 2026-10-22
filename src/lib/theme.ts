// Org-fargene settes som CSS-variabler. Portert fra applyTheme() i fravaersmal-referanse.html,
// inkludert automatisk kontrastjustering.
const hex = (h: string | undefined) => {
  let s = String(h ?? '').trim().replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? s : null
}
const rgb = (h: string): number[] => {
  const s = hex(h) ?? '000000'
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16))
}
const toHex = (a: number[]) =>
  '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}
export const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const kontrast = (a: string, b: string) => {
  const x = lum(a), y = lum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export type Farger = { bg?: string; fg?: string; accent?: string }

export function beregnTema(c: Farger): Record<string, string> {
  const bg = '#' + (hex(c.bg) ?? 'EEF1F6')
  const fg = '#' + (hex(c.fg) ?? '121826')
  const ac = '#' + (hex(c.accent) ?? '3346D3')
  const dark = lum(bg) < 0.3
  return {
    '--bg': bg,
    '--fg': fg,
    '--accent': ac,
    '--on-accent': kontrast(ac, '#ffffff') >= kontrast(ac, '#111111') ? '#ffffff' : '#111111',
    '--accent-ink': kontrast(ac, bg) >= 3 ? ac : fg,
    '--surface': dark ? mix(bg, '#ffffff', 0.07) : mix(bg, '#ffffff', 0.75),
    '--soft': mix(bg, fg, dark ? 0.12 : 0.07),
    '--line': mix(bg, fg, 0.22),
    '--muted': mix(fg, bg, 0.3),
    '--ok': dark ? '#5FD39A' : '#1F7A4D',
    '--warn': dark ? '#FF9B73' : '#B4441A',
    '--mark': dark ? '#7A5D10' : '#FFE7A3',
    'color-scheme': dark ? 'dark' : 'light',
  }
}

export function applyTheme(c: Farger | undefined) {
  const r = document.documentElement.style
  for (const [k, v] of Object.entries(beregnTema(c ?? {}))) r.setProperty(k, v)
}
