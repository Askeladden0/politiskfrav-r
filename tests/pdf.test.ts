import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { STANDARD_INNSTILLINGER, buildDoc, vars } from '../supabase/functions/_shared/mal.ts'
import { lagFravaerPdf } from '../supabase/functions/_shared/pdf.ts'

const org = { navn: 'Eksempel Ungdomsorganisasjon' }
const soknad = {
  navn: 'Kari Nordmann', skole: 'Testbyen vgs', e_post: 'kari@example.test',
  arrangement: 'Høstmøtet', sted: 'Bergen', har_vaert: true,
  dato_fra: '2026-11-12', tid_fra: '09:00:00', dato_til: '2026-11-12', tid_til: '14:30:00',
}
const att = { navn: 'Nora Nord', verv: 'Fylkesleder', telefon: '911 11 111', e_post: 'nora@example.test' }

// 1×1 gjennomsiktig PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const lagDoc = (s = soknad) =>
  buildDoc(STANDARD_INNSTILLINGER, vars(s, org, 'Eksempel Sør', att, '2026-11-20'), att)

describe('PDF-generering', () => {
  it('lager en gyldig ensides A4-PDF', async () => {
    const bytes = await lagFravaerPdf({ doc: lagDoc(), orgNavn: org.navn })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    const { width, height } = pdf.getPage(0).getSize()
    expect(Math.round(width)).toBe(595)
    expect(Math.round(height)).toBe(842)
    expect(pdf.getTitle()).toBe('Dokumentasjon av politisk fravær')
  })
  it('håndterer logo, signatur, æøå og tegn utenfor WinAnsi', async () => {
    const doc = lagDoc({ ...soknad, navn: 'Åse Ørsted ☃ 😀', arrangement: 'Møte «på» ÆØÅ' })
    const bytes = await lagFravaerPdf({
      doc, orgNavn: org.navn, visLogo: true,
      logo: { bytes: PNG, w: 400, h: 100 }, signatur: { bytes: PNG, w: 300, h: 100 },
    })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
  it('går over til ny side når teksten er veldig lang', async () => {
    const doc = lagDoc()
    doc.paras.push(...Array.from({ length: 30 }, () => 'Lang tekst. '.repeat(40)))
    const bytes = await lagFravaerPdf({ doc, orgNavn: org.navn })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1)
  })
  it('kan lages på nytt med samme resultat', async () => {
    const a = await lagFravaerPdf({ doc: lagDoc(), orgNavn: org.navn })
    const b = await lagFravaerPdf({ doc: lagDoc(), orgNavn: org.navn })
    expect(a.length).toBe(b.length)
  })
})
