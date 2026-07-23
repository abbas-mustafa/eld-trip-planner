import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../api'

/**
 * Text input with debounced Nominatim autocomplete.
 * On selection, passes back both the display name and "lat,lon" value so the
 * backend can skip re-geocoding.
 */
export default function LocationInput({
  id,
  label,
  icon,
  placeholder,
  value,
  onChange,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const skipNextSearch = useRef(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    const q = value.text.trim()
    if (q.length < 3 || value.coords) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      const results = await searchPlaces(q)
      setSuggestions(results)
      setOpen(results.length > 0)
      setHighlight(-1)
    }, 350)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (s) => {
    skipNextSearch.current = true
    onChange({ text: s.name, coords: `${s.lat},${s.lon}` })
    setOpen(false)
    setSuggestions([])
  }

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-navy-800"
      >
        {icon}
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value.text}
        onChange={(e) => onChange({ text: e.target.value, coords: null })}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-xs outline-none transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-400/30"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-[1200] mt-1.5 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg scroll-thin"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.lat}-${s.lon}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`block w-full cursor-pointer px-3.5 py-2 text-left text-[13px] leading-snug transition-colors ${
                  i === highlight
                    ? 'bg-primary-600/10 text-primary-600'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
