import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function CustomSelect({ label, value, options, onChange, disabled = false }) {
  const baseId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)))
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function choose(option) {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function openAt(index) {
    setActiveIndex(Math.min(options.length - 1, Math.max(0, index)))
    setOpen(true)
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openAt(selectedIndex + (event.key === 'ArrowDown' ? 0 : -1))
    } else if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      choose(options[activeIndex])
    }
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
      setActiveIndex(next)
      optionRefs.current[next]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : options.length - 1
      setActiveIndex(next)
      optionRefs.current[next]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(options[index])
    } else if (event.key === 'Tab') setOpen(false)
  }

  return <div className="filter-field" ref={rootRef}>
    <span className="filter-field-label" id={`${baseId}-label`}>{label}</span>
    <div className="custom-select">
      <button ref={triggerRef} id={`${baseId}-trigger`} type="button" disabled={disabled || options.length === 0} className={`custom-select-trigger${open ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${baseId}-label ${baseId}-value`} onClick={() => open ? setOpen(false) : openAt(selectedIndex)} onKeyDown={handleTriggerKeyDown}>
        <span id={`${baseId}-value`}>{selected?.label || 'Selecione'}</span><ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && <div className="custom-select-menu" role="listbox" aria-labelledby={`${baseId}-label`}>
        {options.map((option, index) => {
          const isSelected = String(option.value) === String(value)
          return <button key={option.value} ref={(element) => { optionRefs.current[index] = element }} type="button" role="option" aria-selected={isSelected} tabIndex={activeIndex === index ? 0 : -1} className={`custom-select-option${isSelected ? ' is-selected' : ''}${activeIndex === index ? ' is-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(option)} onKeyDown={(event) => handleOptionKeyDown(event, index)}>
            <span>{option.label}</span>{isSelected && <Check size={16} aria-hidden="true" />}
          </button>
        })}
      </div>}
    </div>
  </div>
}
