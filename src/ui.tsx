import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { STATUS_ETIKETT, type SoknadStatus } from './lib/types'

const feltKlasse =
  'w-full rounded-md border-[1.5px] border-line bg-surface px-3.5 py-3 text-base outline-none focus:border-ink aria-[invalid=true]:border-warn'

type FeltBase = { label: ReactNode; feil?: string; hint?: ReactNode; valgfri?: boolean }

export function Felt({ label, feil, hint, valgfri, ...p }: FeltBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <input id={id} className={feltKlasse} aria-invalid={!!feil} aria-describedby={feil ? id + '-f' : undefined} {...p} />
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
      {feil && <span id={id + '-f'} role="alert" className="text-[13px] font-semibold text-warn">{feil}</span>}
    </div>
  )
}

export function Velg({ label, feil, valgfri, children, ...p }: FeltBase & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <select id={id} className={feltKlasse} aria-invalid={!!feil} aria-describedby={feil ? id + '-f' : undefined} {...p}>
        {children}
      </select>
      {feil && <span id={id + '-f'} role="alert" className="text-[13px] font-semibold text-warn">{feil}</span>}
    </div>
  )
}

export function Tekstomrade({ label, feil, hint, valgfri, ...p }: FeltBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label} {valgfri && <span className="font-normal text-muted">(valgfritt)</span>}
      </label>
      <textarea id={id} className={feltKlasse + ' resize-y leading-relaxed'} aria-invalid={!!feil} {...p} />
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
      {feil && <span role="alert" className="text-[13px] font-semibold text-warn">{feil}</span>}
    </div>
  )
}

type KnappVariant = 'primaer' | 'mork' | 'linje' | 'spoekelse' | 'fare'
const knappFarger: Record<KnappVariant, string> = {
  primaer: 'bg-accent text-on-accent',
  mork: 'bg-fg text-bg',
  linje: 'border-[1.5px] border-fg bg-transparent hover:bg-fg hover:text-bg',
  spoekelse: 'border-[1.5px] border-line bg-transparent hover:border-fg',
  fare: 'border-[1.5px] border-warn bg-transparent text-warn hover:bg-warn hover:text-bg',
}
export function Knapp({
  variant = 'primaer', className = '', ...p
}: { variant?: KnappVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] px-4 py-2.5 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${knappFarger[variant]} ${className}`}
      {...p}
    />
  )
}

export function Segment<T extends string>({
  verdier, valgt, onChange, label,
}: { verdier: { v: T; l: string }[]; valgt: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[9px] bg-soft p-1">
      {verdier.map((x) => (
        <button
          key={x.v}
          type="button"
          aria-pressed={valgt === x.v}
          onClick={() => onChange(x.v)}
          className={`min-h-11 whitespace-nowrap rounded-md px-3 text-[15px] font-semibold ${valgt === x.v ? 'bg-surface shadow' : ''}`}
        >
          {x.l}
        </button>
      ))}
    </div>
  )
}

export function Boks({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[10px] border-[1.5px] border-line bg-surface p-4 ${className}`}>{children}</div>
}

export function Varsel({ type = 'info', children }: { type?: 'info' | 'ok' | 'warn'; children: ReactNode }) {
  const farge =
    type === 'ok' ? 'border-ok text-ok bg-surface' : type === 'warn' ? 'border-warn text-warn bg-surface' : 'border-transparent bg-soft'
  return (
    <div role={type === 'info' ? 'status' : 'alert'} className={`rounded-lg border-[1.5px] px-3.5 py-3 text-sm leading-relaxed ${farge}`}>
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
    <div className="flex items-baseline gap-3 border-b-2 border-fg pb-2.5">
      <h2 className="m-0 flex-1 text-[23px] font-bold">{children}</h2>
      {meta && <span className="text-sm font-semibold text-muted">{meta}</span>}
    </div>
  )
}

export const fmtDatoTid = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
