import { useEffect, useState } from 'react'

const isTextField = el =>
  el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'date'].includes(el.type)))

/**
 * iOS number keypads have no return/done key, so the keyboard can get stuck open.
 * This shows a "Done" bar right above the keyboard while a field is focused,
 * and also dismisses the keyboard when you tap anywhere outside a text field.
 */
export default function KeyboardDone() {
  const [focused, setFocused] = useState(false)
  const [bottom, setBottom] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    const place = () => {
      if (!vv) return
      // Distance from layout-viewport bottom to visual-viewport bottom = keyboard height
      setBottom(Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)))
    }
    const onFocusIn = e => { if (isTextField(e.target)) { setFocused(true); place() } }
    const onFocusOut = () => setTimeout(() => setFocused(isTextField(document.activeElement)), 0)
    const onTouch = e => {
      const active = document.activeElement
      if (!isTextField(active)) return
      if (isTextField(e.target) || e.target.closest?.('[data-keep-keyboard]')) return
      active.blur()
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('touchstart', onTouch, { passive: true })
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('touchstart', onTouch)
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
    }
  }, [])

  // Only useful when an on-screen keyboard is actually up
  if (!focused || bottom < 120) return null

  return (
    <div
      data-keep-keyboard
      className="fixed left-0 right-0 z-[100] flex justify-end bg-gray-800/95 backdrop-blur border-t border-gray-700 px-3 py-1.5"
      style={{ bottom }}
    >
      <button
        onMouseDown={e => e.preventDefault()}
        onClick={() => document.activeElement?.blur()}
        className="text-brand font-semibold text-sm px-3 py-1.5"
      >
        Done
      </button>
    </div>
  )
}
