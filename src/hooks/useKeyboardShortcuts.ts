import { useEffect, useRef } from 'react'
import { useConversations } from '../store/useConversations'

export function useKeyboardShortcuts(
  sidebarOpen: boolean,
  setSidebarOpen: (open: boolean) => void,
) {
  const openRef = useRef(sidebarOpen)
  openRef.current = sidebarOpen

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        useConversations.getState().createConversation()
        return
      }

      if (mod && e.shiftKey && e.key === ',') {
        e.preventDefault()
        setSidebarOpen(!openRef.current)
        return
      }

      if (e.key === 'Escape') {
        if (openRef.current) {
          e.preventDefault()
          setSidebarOpen(false)
        } else {
          ;(document.activeElement as HTMLElement)?.blur()
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSidebarOpen])
}
