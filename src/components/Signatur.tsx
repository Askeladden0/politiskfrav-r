import { useEffect, useRef, useState } from 'react'
import type { Signatur } from '../lib/types'
import { Knapp } from '../ui'

// Portert fra setupPad(), saveSig() og textSig() i fravaersmal-referanse.html.

async function tekstSignatur(tekst: string): Promise<Signatur | null> {
  const t = tekst.trim()
  if (!t) return null
  try { await document.fonts.load('600 160px Caveat') } catch { /* bruker reservefont */ }
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  ctx.font = '600 160px Caveat, cursive'
  const w = Math.ceil(ctx.measureText(t).width) + 40
  c.width = w
  c.height = 220
  ctx.font = '600 160px Caveat, cursive'
  ctx.fillStyle = '#111'
  ctx.fillText(t, 20, 165)
  return { modus: 'tekst', tekst: t, src: c.toDataURL('image/png'), w, h: 220 }
}

/** Beskjærer lerretet til tegnet innhold og returnerer PNG. */
function beskjaer(c: HTMLCanvasElement, modus: Signatur['modus']): Signatur | null {
  const ctx = c.getContext('2d')!
  const { width: w, height: h } = c
  const d = ctx.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return null
  const p = 6, cw = x1 - x0 + 1 + p * 2, ch = y1 - y0 + 1 + p * 2
  const ut = document.createElement('canvas')
  ut.width = cw
  ut.height = ch
  ut.getContext('2d')!.drawImage(c, x0 - p, y0 - p, cw, ch, 0, 0, cw, ch)
  return { modus, src: ut.toDataURL('image/png'), w: cw, h: ch }
}

export function SignaturFelt({ verdi, onChange }: { verdi: Signatur | null; onChange: (s: Signatur | null) => void }) {
  const [modus, setModus] = useState<'tekst' | 'tegn'>(verdi?.modus === 'tekst' || !verdi ? 'tekst' : 'tegn')
  const [tekst, setTekst] = useState(verdi?.modus === 'tekst' ? verdi.tekst ?? '' : '')
  const canvas = useRef<HTMLCanvasElement>(null)

  // Tegnefeltet
  useEffect(() => {
    if (modus !== 'tegn') return
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')!
    const stil = () => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineWidth = 2.6 * dpr }
    stil()
    let tegner = false
    let sist: [number, number] = [0, 0]
    const pos = (e: PointerEvent): [number, number] => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * dpr, (e.clientY - b.top) * dpr] }
    if (verdi && verdi.modus !== 'tekst') visBilde(c, verdi.src)
    c.onpointerdown = (e) => { tegner = true; c.setPointerCapture(e.pointerId); sist = pos(e); stil(); ctx.beginPath(); ctx.arc(sist[0], sist[1], ctx.lineWidth / 2, 0, 7); ctx.fill() }
    c.onpointermove = (e) => { if (!tegner) return; const q = pos(e); ctx.beginPath(); ctx.moveTo(sist[0], sist[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); sist = q }
    c.onpointerup = c.onpointercancel = () => { if (!tegner) return; tegner = false; onChange(beskjaer(c, 'tegnet')) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modus])

  const velgTekst = async (t: string) => { setTekst(t); onChange(await tekstSignatur(t)) }
  const toem = () => {
    if (modus === 'tekst') { setTekst(''); onChange(null); return }
    const c = canvas.current
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    onChange(null)
  }
  const lastOpp = (f: File | undefined) => {
    const c = canvas.current
    if (!f || !c) return
    const url = URL.createObjectURL(f)
    visBilde(c, url, () => { onChange(beskjaer(c, 'bilde')); URL.revokeObjectURL(url) })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold">Signatur <span className="font-normal text-muted">– brukes på alle fraværserklæringene du sender</span></span>
        <div role="group" aria-label="Type signatur" className="grid auto-cols-fr grid-flow-col gap-1 rounded-[9px] bg-soft p-1">
          {([['tekst', 'Skrevet'], ['tegn', 'Tegn selv']] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={modus === v} onClick={() => setModus(v)}
              className={`min-h-10 rounded-md px-3 text-[13.5px] font-semibold ${modus === v ? 'bg-surface shadow' : ''}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="relative h-[170px] overflow-hidden rounded-lg border-[1.5px] border-line bg-white text-[#111]">
        {modus === 'tekst' ? (
          <input value={tekst} onChange={(e) => velgTekst(e.target.value)} placeholder="Skriv signaturen din" autoComplete="off" aria-label="Signatur"
            className="absolute inset-x-6 bottom-[30px] w-[calc(100%-48px)] border-0 bg-transparent p-0 font-sig text-[52px] font-semibold leading-[1.2] text-[#111] outline-none placeholder:text-[#9ca3af]" />
        ) : (
          <canvas ref={canvas} aria-label="Tegn signaturen her" className="block size-full cursor-crosshair touch-none" />
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-[#c9cdd3]" />
        <span className="pointer-events-none absolute bottom-3 left-6 text-xs text-[#6b7280]">
          {modus === 'tekst' ? 'Skriv inn signaturen din' : verdi ? 'Signatur lagret (lagre innstillingene for å bruke den)' : 'Signer her med mus eller finger'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Knapp variant="spoekelse" onClick={toem}>Tøm signatur</Knapp>
        {modus === 'tegn' && (
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[7px] border-[1.5px] border-line px-4 text-[15px] font-semibold hover:border-fg">
            Last opp bilde av signatur
            <input type="file" accept="image/*" hidden onChange={(e) => lastOpp(e.target.files?.[0])} />
          </label>
        )}
      </div>
    </div>
  )
}

function visBilde(c: HTMLCanvasElement, src: string, ferdig?: () => void) {
  const img = new Image()
  img.onload = () => {
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    const pad = c.height * 0.12
    const k = Math.min((c.width - pad * 2) / img.width, (c.height * 0.7) / img.height)
    const w = img.width * k, h = img.height * k
    ctx.drawImage(img, (c.width - w) / 2, c.height * 0.78 - h, w, h)
    ferdig?.()
  }
  img.src = src
}
