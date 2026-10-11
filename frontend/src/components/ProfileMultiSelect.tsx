import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type MultiSelectOption = { label: string; value: string }
export type MultiSelectGroup = { name: string; options: Array<string | MultiSelectOption> }

type ProfileMultiSelectProps = {
  label: string
  hint?: string
  placeholder: string
  groups: MultiSelectGroup[]
  selected: string[]
  onChange: (values: string[]) => void
  allowCustom?: boolean
  singleSelect?: boolean
  selectionLabel?: string
}

function comparable(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' ') }
function titleCase(value: string) { return value.trim().toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function optionDetails(option: string | MultiSelectOption) { return typeof option === 'string' ? { label: option, value: option } : option }

export default function ProfileMultiSelect({ label, hint, placeholder, groups, selected, onChange, allowCustom = false, singleSelect = false, selectionLabel = 'selected' }: ProfileMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const selectedKeys = useMemo(() => new Set(selected.map(comparable)), [selected])
  const optionLabels = useMemo(() => new Map(groups.flatMap((group) => group.options.map((option) => {
    const { label: optionLabel, value } = optionDetails(option)
    return [comparable(value), optionLabel] as const
  }))), [groups])
  const selectedLabels = useMemo(() => selected.map((value) => optionLabels.get(comparable(value)) || value), [optionLabels, selected])
  const normalizedQuery = comparable(query)
  const filteredGroups = useMemo(() => groups.map((group) => ({ ...group, options: group.options.filter((option) => {
    const { label: optionLabel, value } = optionDetails(option)
    return !normalizedQuery || comparable(optionLabel).includes(normalizedQuery) || comparable(value).includes(normalizedQuery)
  }) })).filter((group) => group.options.length), [groups, normalizedQuery])
  const exactOption = groups.some((group) => group.options.some((option) => {
    const { label: optionLabel, value } = optionDetails(option)
    return comparable(optionLabel) === normalizedQuery || comparable(value) === normalizedQuery
  }))

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const toggle = (value: string) => {
    if (singleSelect) {
      onChange([value])
      setQuery('')
      setOpen(false)
      return
    }
    const key = comparable(value)
    onChange(selectedKeys.has(key) ? selected.filter((item) => comparable(item) !== key) : [...selected, value])
  }
  const addCustom = () => {
    const value = titleCase(query)
    if (!value || selectedKeys.has(comparable(value))) return
    onChange([...selected, value])
    setQuery('')
  }

  return <div className="profile-multi-select" ref={container}>
    <div className="profile-multi-label"><span>{label}</span>{hint && <small>{hint}</small>}</div>
    <button className="profile-select-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Search size={15} /><span>{selected.length ? singleSelect ? selectedLabels[0] : `${selected.length} ${selectionLabel}` : placeholder}</span><ChevronDown size={15} /></button>
    {!singleSelect && selected.length > 0 && <div className="profile-selected-chips">{selected.map((value, index) => <span key={value}>{selectedLabels[index]}<button type="button" aria-label={`Remove ${selectedLabels[index]}`} onClick={() => toggle(value)}><X size={13} /></button></span>)}<button className="clear-selection" type="button" onClick={() => onChange([])}>Clear selected</button></div>}
    {open && <div className="profile-select-menu"><div className="profile-select-search"><Search size={15} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && allowCustom && !exactOption) { event.preventDefault(); addCustom() } }} placeholder={placeholder} /></div><div className="profile-select-options">{filteredGroups.map((group) => <section key={group.name}><p>{group.name}</p>{group.options.map((option) => { const { label: optionLabel, value } = optionDetails(option); const isSelected = selectedKeys.has(comparable(value)); return <button className={isSelected ? 'selected' : ''} type="button" key={value} onClick={() => toggle(value)}><span>{optionLabel}</span>{isSelected && <Check size={15} />}</button> })}</section>)}{allowCustom && normalizedQuery && !exactOption && <button className="profile-custom-option" type="button" onClick={addCustom}>Add &ldquo;{titleCase(query)}&rdquo;</button>}{!filteredGroups.length && !allowCustom && <p className="profile-select-empty">No matching options.</p>}</div></div>}
  </div>
}
