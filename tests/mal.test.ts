import { describe, expect, it } from 'vitest'
import {
  STANDARD_INNSTILLINGER, avsenderNavn, buildDoc, filnavn, fill, fmtDato, fmtKlokke,
  idagOslo, medStandard, tidTekst, vars,
} from '../supabase/functions/_shared/mal.ts'

const org = { navn: 'Eksempel Ungdomsorganisasjon' }
const soknad = {
  navn: 'Kari Nordmann', skole: 'Testbyen vgs', e_post: 'kari@example.test',
  arrangement: 'Høstmøtet', sted: 'Bergen', har_vaert: true,
  dato_fra: '2026-11-12', tid_fra: '09:00:00', dato_til: '2026-11-12', tid_til: '14:30:00',
}
const att = { navn: 'Nora Nord', verv: 'Fylkesleder', telefon: '911 11 111', e_post: 'nora@example.test' }

describe('datoformatering', () => {
  it('bruker norske månedsnavn', () => {
    expect(fmtDato('2026-01-05')).toBe('5. januar 2026')
    expect(fmtDato('2026-12-24')).toBe('24. desember 2026')
    expect(fmtDato('')).toBe('')
  })
  it('formaterer klokkeslett med punktum', () => {
    expect(fmtKlokke('09:00:00')).toBe('09.00')
    expect(fmtKlokke('7:05')).toBe('07.05')
  })
  it('idagOslo bruker Oslo-tid', () => {
    expect(idagOslo(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01')
  })
})

describe('{tid}', () => {
  it('samme dag blir «den …»', () => {
    expect(tidTekst(soknad)).toBe('den 12. november 2026 kl. 09.00–14.30')
  })
  it('flere dager blir «fra … til …»', () => {
    expect(tidTekst({ ...soknad, dato_til: '2026-11-14', tid_til: '16:00:00' }))
      .toBe('fra 12. november 2026 kl. 09.00 til 14. november 2026 kl. 16.00')
  })
  it('mangler dato gir plassholder', () => {
    expect(tidTekst({})).toBe('den [tid]')
  })
})

describe('plassholdere', () => {
  const v = vars(soknad, org, 'Eksempel Sør', att, '2026-11-20')
  it('fyller alle felt', () => {
    expect(fill('{navn} fra {skole} {deltar} {arrangement} {tid} i regi av {arrangør} ({sted})', v)).toBe(
      'Kari Nordmann fra Testbyen vgs deltok på Høstmøtet den 12. november 2026 kl. 09.00–14.30 i regi av Eksempel Sør (Bergen)',
    )
  })
  it('støtter arrangor uten ø og er uavhengig av store/små bokstaver', () => {
    expect(fill('{Arrangor} / {ARRANGØR}', v)).toBe('Eksempel Sør / Eksempel Sør')
  })
  it('«skal delta på» når arrangementet ikke har vært', () => {
    expect(vars({ ...soknad, har_vaert: false }, org, null, att, '2026-11-20').deltar).toBe('skal delta på')
  })
  it('arrangør faller tilbake til organisasjonsnavnet', () => {
    expect(vars(soknad, org, '  ', att, '2026-11-20')['arrangør']).toBe(org.navn)
  })
  it('lar ukjente felt stå urørt', () => {
    expect(fill('Hei {ukjent} {navn}', v)).toBe('Hei {ukjent} Kari Nordmann')
  })
  it('avsender er attestant, ellers organisasjon', () => {
    expect(v.avsender).toBe('Nora Nord')
    expect(vars(soknad, org, null, null, '2026-11-20').avsender).toBe(org.navn)
  })
  it('mangler felt vises som [plassholder]', () => {
    const tom = vars({ ...soknad, navn: '', sted: null }, org, null, att, '2026-11-20')
    expect(tom.navn).toBe('[Navn]')
    expect(tom.sted).toBe('[sted]')
  })
  it('viser avsendernavn «via organisasjon»', () => {
    expect(avsenderNavn(att, org)).toBe('Nora Nord via Eksempel Ungdomsorganisasjon')
    expect(avsenderNavn(null, org)).toBe(org.navn)
  })
})

describe('buildDoc og innstillinger', () => {
  it('bygger dokumentet fra malen', () => {
    const v = vars(soknad, org, 'Eksempel Sør', att, '2026-11-20')
    const d = buildDoc(STANDARD_INNSTILLINGER, v, att)
    expect(d.title).toBe('Dokumentasjon av politisk fravær')
    expect(d.paras).toHaveLength(4)
    expect(d.paras[3]).toContain('Kari Nordmann deltok på Høstmøtet den 12. november 2026')
    expect(d.date).toBe('20. november 2026')
    expect(d.role).toBe('Fylkesleder, Eksempel Sør')
    expect(d.contact).toBe('Tlf: 911 11 111, E-post: nora@example.test')
  })
  it('medStandard fyller inn manglende felt og ignorerer tomme tekster', () => {
    const m = medStandard({ pageTitle: 'Min side', pdf: { title: '  ' }, colors: { accent: '#ff0000' } })
    expect(m.pageTitle).toBe('Min side')
    expect(m.pdf.title).toBe(STANDARD_INNSTILLINGER.pdf.title)
    expect(m.colors.accent).toBe('#ff0000')
    expect(m.colors.bg).toBe(STANDARD_INNSTILLINGER.colors.bg)
    expect(m.mail.avslag.subject).toBe(STANDARD_INNSTILLINGER.mail.avslag.subject)
  })
  it('filnavn fjerner ugyldige tegn', () => {
    const v = vars({ ...soknad, navn: 'A/B:C' }, org, null, att, '2026-11-20')
    expect(filnavn(STANDARD_INNSTILLINGER, v)).toBe('Politisk fravær - ABC.pdf')
  })
})
