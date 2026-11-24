import { useState, useEffect } from 'react'

/**
 * Text input for numbers that accepts both "," and "." as decimal separator
 * (Dutch-locale phone keypads only offer ",") and always stores a JS number.
 * Keeps the raw text while typing so "22," isn't wiped before you type the 5.
 */
export function parseNum(text, integer = false) {
  const t = String(text).trim().replace(',', '.')
  if (t === '' || t === '.') return null
  const n = integer ? parseInt(t, 10) : parseFloat(t)
  return Number.isFinite(n) ? n : null
}

export default function NumberInput({ value, onChange, integer = false, className = '', ...rest }) {
  const [text, setText] = useState(value ?? '')

  // Sync when the value changes from outside (± buttons, add set, reset)
  useEffect(() => {
    if (parseNum(text, integer) !== (value ?? null)) setText(value ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handle = e => {
    let t = e.target.value.replace(/[^0-9.,]/g, '')
    if (integer) t = t.replace(/[.,]/g, '')
    // Only one decimal separator
    const firstSep = t.search(/[.,]/)
    if (firstSep !== -1) t = t.slice(0, firstSep + 1) + t.slice(firstSep + 1).replace(/[.,]/g, '')
    setText(t)
    onChange(parseNum(t, integer))
  }

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done"
      autoComplete="off"
      value={text}
      onChange={handle}
      onFocus={e => e.target.select()}
      onBlur={() => setText(value ?? '')}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={className}
      {...rest}
    />
  )
}
