'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type EditorStatus = 'idle' | 'saved' | 'error'

/**
 * Draft state for a focused editor: tracks unsaved changes against the last
 * saved baseline and exposes save / cancel handlers for the sticky action bar.
 */
export function useEditor<T>(initial: T, onSave: (draft: T) => Promise<void>) {
  const [baseline, setBaseline] = useState<T>(initial)
  const [draft, setDraft] = useState<T>(initial)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<EditorStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setStatus('idle')
    setDraft(next)
  }, [])

  const cancel = useCallback(() => {
    setDraft(baseline)
    setStatus('idle')
    setError(null)
  }, [baseline])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setBaseline(draft)
      setStatus('saved')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setStatus('idle'), 4000)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Uložení se nezdařilo')
    } finally {
      setSaving(false)
    }
  }, [draft, onSave])

  return { draft, update, dirty, saving, status, error, save, cancel }
}
