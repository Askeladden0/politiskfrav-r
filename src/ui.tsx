import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { STATUS_ETIKETT, type SoknadStatus } from './lib/types'

const feltKlasse =
  'w-full min-h-[52px] rounded-[10px] border-2 border-line bg-surface px-3.5 py-2 text-[17px] outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-warn'

function FeilMelding({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} role="alert" className="flex gap-2 text-[15px] font-semibold text-warn">
      <span aria-hidden="true" className="flex size-5 flex-none items-center justify-center rounded-full bg-warn text-[13px] font-extrabold text-bg">!</span>
      {children}
    </span>
  )
}

type FeltBase = { label: ReactNode; feil?: string; hint?: ReactNode; valgfri?: boolean }

export function Felt({ label, feil, hint, valgfri, ...p }: FeltBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <input id={id} className={feltKlasse} aria-invalid={!!feil} aria-describedby={feil ? id + '-f' : undefined} {...p} />
      {hint && <span className="text-[14px] text-muted">{hint}</span>}
      {feil && <FeilMelding id={id + '-f'}>{feil}</FeilMelding>}
    </div>
  )
}

export function Velg({ label, feil, valgfri, children, ...p }: FeltBase & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <select id={id} className={feltKlasse} aria-invalid={!!feil} aria-describedby={feil ? id + '-f' : undefined} {...p}>
        {children}
      </select>
      {feil && <FeilMelding id={id + '-f'}>{feil}</FeilMelding>}
    </div>
  )
}

export function Tekstomrade({ label, feil, hint, valgfri, ...p }: FeltBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <textarea id={id} className={feltKlasse + ' resize-y leading-relaxed'} aria-invalid={!!feil} {...p} />
      {hint && <span className="text-[14px] text-muted">{hint}</span>}
      {feil && <FeilMelding>{feil}</FeilMelding>}
    </div>
  )
}

type KnappVariant = 'primaer' | 'mork' | 'linje' | 'spoekelse' | 'fare'
const knappFarger: Record<KnappVariant, string> = {
  primaer: 'bg-accent text-on-accent',
  mork: 'bg-fg text-bg',
  linje: 'border-2 border-fg bg-transparent hover:bg-fg hover:text-bg',
  spoekelse: 'border-[1.5px] border-line bg-transparent hover:border-fg',
  fare: 'border-[1.5px] border-warn bg-transparent text-warn hover:bg-warn hover:text-bg',
}
export function Knapp({
  variant = 'primaer', className = '', ...p
}: { variant?: KnappVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[16px] font-bold disabled:cursor-not-allowed disabled:opacity-45 ${knappFarger[variant]} ${className}`}
      {...p}
    />
  )
}

export function Segment<T extends string>({
  verdier, valgt, onChange, label,
}: { verdier: { v: T; l: string }[]; valgt: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border-2 border-line bg-surface p-1">
      {verdier.map((x) => (
        <button
          key={x.v}
          type="button"
          aria-pressed={valgt === x.v}
          onClick={() => onChange(x.v)}
          className={`min-h-11 whitespace-nowrap rounded-lg px-3 text-[16px] font-bold ${valgt === x.v ? 'bg-accent text-on-accent' : ''}`}
        >
          {x.l}
        </button>
      ))}
    </div>
  )
}

export function Boks({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</div>
}

export function Varsel({ type = 'info', children }: { type?: 'info' | 'ok' | 'warn'; children: ReactNode }) {
  const farge =
    type === 'ok' ? 'border-ok text-ok bg-surface' : type === 'warn' ? 'border-warn text-warn bg-surface' : 'border-transparent bg-soft'
  return (
    <div role={type === 'info' ? 'status' : 'alert'} className={`rounded-xl border-2 px-3.5 py-3 text-[15px] leading-relaxed ${farge}`}>
      {children}
    </div>
  )
}

export function StatusMerke({ status }: { status: SoknadStatus }) {
  const farge = status === 'sendt' ? 'text-ok border-ok' : status === 'avslatt' ? 'text-warn border-warn' : 'text-fg border-line'
  return (
    <span className={`inline-block rounded-full border-[1.5px] px-2.5 py-0.5 text-xs font-bold ${farge}`}>
      {STATUS_ETIKETT[status]}
    </span>
  )
}

export function Laster({ tekst = 'Laster …' }: { tekst?: string }) {
  return <p role="status" className="py-10 text-center text-muted">{tekst}</p>
}

export function Overskrift({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="m-0 flex-1 text-[22px] font-extrabold tracking-tight">{children}</h2>
      {meta && <span className="text-sm font-semibold text-muted">{meta}</span>}
    </div>
  )
}

export const fmtDatoTid = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

/** Valgkort (radio) i to kolonner, som «Type» i designet. */
export function Valgkort<T extends string>({
  verdier, valgt, onChange, label, navn,
}: { verdier: { v: T; l: string }[]; valgt: T | ''; onChange: (v: T) => void; label: string; navn: string }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        {verdier.map((x) => (
          <label
            key={x.v}
            className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border-2 px-3 font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${valgt === x.v ? 'border-accent bg-soft' : 'border-line bg-surface'}`}
          >
            <input type="radio" name={navn} checked={valgt === x.v} onChange={() => onChange(x.v)} className="m-0 size-5 accent-[var(--accent)]" />
            {x.l}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export { FeilMelding }
