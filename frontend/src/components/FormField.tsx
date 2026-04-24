import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import './FormField.css'

interface BaseProps {
  label: string
  error?: string[]
  required?: boolean
}

type InputProps = BaseProps & { as?: 'input' } & InputHTMLAttributes<HTMLInputElement>
type SelectProps = BaseProps & { as: 'select'; children: React.ReactNode } & SelectHTMLAttributes<HTMLSelectElement>

type Props = InputProps | SelectProps

export function FormField(props: Props) {
  const { label, error, required, as, ...rest } = props
  const id = label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`field ${error?.length ? 'field--error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}{required && <span className="field-required">*</span>}
      </label>
      {as === 'select' ? (
        <select id={id} className="field-input" {...(rest as SelectHTMLAttributes<HTMLSelectElement>)}>
          {(props as SelectProps).children}
        </select>
      ) : (
        <input id={id} className="field-input" {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error?.map((e, i) => <p key={i} className="field-error">{e}</p>)}
    </div>
  )
}
