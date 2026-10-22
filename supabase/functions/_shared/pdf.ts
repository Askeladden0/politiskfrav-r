// Genererer fraværserklæringen som PDF. Samme kode brukes av `pdf`- og `send-fravaer`-funksjonene,
// så forhåndsvisningen i dashboardet er identisk med det som sendes.
// Oppsettet følger drawPage() i fravaersmal-referanse.html (jsPDF, A4, mål i mm).
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import type { Dokument } from './mal.ts'

export type Bilde = { bytes: Uint8Array; w: number; h: number }

export type PdfInput = {
  doc: Dokument
  orgNavn: string
  /** PNG. Brukes bare hvis `visLogo` er sann. */
  logo?: Bilde | null
  visLogo?: boolean
  /** PNG med gjennomsiktig bakgrunn. */
  signatur?: Bilde | null
}

const MM = 72 / 25.4
const A4_H = 297

/** Fjerner tegn Helvetica (WinAnsi) ikke kan vise, så pdf-lib ikke kaster. */
function trygg(font: PDFFont, tekst: string): string {
  const sett = new Set(font.getCharacterSet())
  let ut = ''
  for (const ch of tekst.replace(/\r/g, '')) {
    const cp = ch.codePointAt(0)!
    if (cp === 0x2013 || cp === 0x2014) ut += '–' // tankestrek finnes i WinAnsi
    else if (ch === ' ') ut += ' '
    else ut += sett.has(cp) || ch === '\n' ? ch : '?'
  }
  return ut
}

function brytLinje(font: PDFFont, tekst: string, size: number, bredde: number): string[] {
  if (!tekst.trim()) return ['']
  const ord = tekst.split(/(\s+)/).filter((o) => o.length)
  const linjer: string[] = []
  let gjeldende = ''
  for (const o of ord) {
    const kandidat = gjeldende + o
    if (font.widthOfTextAtSize(kandidat.trimEnd(), size) <= bredde || !gjeldende.trim()) {
      gjeldende = kandidat
    } else {
      linjer.push(gjeldende.trimEnd())
      gjeldende = /^\s+$/.test(o) ? '' : o
    }
  }
  if (gjeldende.trim()) linjer.push(gjeldende.trimEnd())
  return linjer.length ? linjer : ['']
}

export async function lagFravaerPdf(inn: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold)
  const d = inn.doc
  const L = 25, R = 185, W = 160, top = 15

  let side: PDFPage = pdf.addPage([210 * MM, A4_H * MM])
  const tekst = (t: string, x: number, y: number, size: number, font: PDFFont, grå = 0, høyre = false) => {
    const s = trygg(font, t)
    const bredde = høyre ? font.widthOfTextAtSize(s, size) : 0
    side.drawText(s, { x: x * MM - bredde, y: (A4_H - y) * MM, size, font, color: rgb(grå, grå, grå) })
  }

  // Topp: logo (eller organisasjonsnavn) og dato
  if (inn.visLogo && inn.logo && inn.logo.w > 0 && inn.logo.h > 0) {
    let w = 55
    let h = (w * inn.logo.h) / inn.logo.w
    if (h > 20) { h = 20; w = (h * inn.logo.w) / inn.logo.h }
    try {
      const img = await pdf.embedPng(inn.logo.bytes)
      side.drawImage(img, { x: L * MM, y: (A4_H - top - h) * MM, width: w * MM, height: h * MM })
    } catch { tekst(inn.orgNavn, L, top + 8, 15, fet) }
  } else {
    tekst(inn.orgNavn, L, top + 8, 15, fet)
  }
  tekst(d.date, R, top + 5, 10, normal, 85 / 255, true)

  let y = 52
  tekst(d.title, L, y, 14, fet)
  y += 10
  const size = 11.5
  const lh = size * 0.3528 * 1.4

  for (const avsnitt of d.paras) {
    for (const linje of avsnitt.split('\n')) {
      const linjer = brytLinje(normal, trygg(normal, linje), size, W * MM)
      if (y + linjer.length * lh > 282) {
        side = pdf.addPage([210 * MM, A4_H * MM])
        y = 25
      }
      linjer.forEach((l, i) => tekst(l, L, y + i * lh, size, normal))
      y += linjer.length * lh
    }
    y += 3.6
  }

  if (y > 240) {
    side = pdf.addPage([210 * MM, A4_H * MM])
    y = 25
  }
  tekst(d.greeting, L, y + 1, size, normal)
  if (inn.signatur && inn.signatur.w > 0 && inn.signatur.h > 0) {
    const h0 = 16
    const w = Math.min(65, (h0 * inn.signatur.w) / inn.signatur.h)
    const h = (w * inn.signatur.h) / inn.signatur.w
    try {
      const img = await pdf.embedPng(inn.signatur.bytes)
      side.drawImage(img, { x: L * MM, y: (A4_H - (y + 3 + h0)) * MM, width: w * MM, height: h * MM })
    } catch { /* ugyldig bilde: hopp over signaturen */ }
  }
  y += 25
  tekst(d.signer, L, y, size, normal)
  y += lh
  if (d.role) {
    for (const l of brytLinje(normal, trygg(normal, d.role), size, W * MM)) { tekst(l, L, y, size, normal); y += lh }
  }
  if (d.contact) {
    for (const l of brytLinje(normal, trygg(normal, d.contact), size, W * MM)) { tekst(l, L, y, size, normal); y += lh }
  }

  pdf.setTitle(d.title)
  pdf.setProducer('Politisk fravær')
  return await pdf.save()
}

export function dataUrlTilBilde(dataUrl: string | undefined | null, w: number, h: number): Bilde | null {
  if (!dataUrl) return null
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  const bin = atob(m[1])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, w, h }
}
