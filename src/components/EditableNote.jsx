import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'

/** A note with a pencil to edit it in place. Empty text clears it. */
export default function EditableNote({ value, onSave, placeholder = 'Add a note…', className = '', addLabel = 'Add note' }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value || '')

  if (editing) {
    const save = () => { onSave(text.trim()); setEditing(false) }
    return (
      <div className="flex items-start gap-2 mb-2">
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="flex-1 bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none resize-none border border-gray-700 focus:border-brand"
        />
        <button onMouseDown={e => e.preventDefault()} onClick={save} aria-label="Save note" className="p-2 text-brand"><Check size={16} /></button>
      </div>
    )
  }

  if (!value) {
    return (
      <button onClick={() => { setText(''); setEditing(true) }} className="flex items-center gap-1 text-[11px] text-gray-600 mb-2">
        <Pencil size={11} /> {addLabel}
      </button>
    )
  }

  return (
    <button onClick={() => { setText(value); setEditing(true) }} className={`flex items-start gap-1.5 text-left mb-2 w-full ${className}`}>
      <span className="flex-1">{value}</span>
      <Pencil size={11} className="mt-0.5 flex-shrink-0 opacity-60" />
    </button>
  )
}
