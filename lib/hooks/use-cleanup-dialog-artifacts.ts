import { useEffect } from 'react'

/**
 * Scrubs all body/root attributes that Radix Dialog/Sheet leaves behind when
 * a component unmounts while a dialog is still open (e.g. navigating away).
 *
 * Affected attributes:
 *   body: style.pointerEvents, style.overflow, data-scroll-locked, aria-hidden
 *   #__next: aria-hidden, inert
 *
 * Add this hook to any page-level component that mounts a Dialog or Sheet.
 */
export function useCleanupDialogArtifacts() {
  useEffect(() => {
    return () => {
      document.body.style.pointerEvents = ''
      document.body.style.overflow = ''
      document.body.removeAttribute('data-scroll-locked')
      document.body.removeAttribute('aria-hidden')
      const root = document.getElementById('__next')
      if (root) {
        root.removeAttribute('aria-hidden')
        root.removeAttribute('inert')
      }
    }
  }, [])
}
