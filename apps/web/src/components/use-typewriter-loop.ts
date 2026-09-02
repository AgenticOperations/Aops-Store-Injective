'use client'

import { useEffect, useState } from 'react'

const TYPE_MS = 42
const DELETE_MS = 22
const HOLD_MS = 2200
const BETWEEN_MS = 380

/** Cycles prompts with type → hold → delete when `active` is true. */
export function useTypewriterLoop(prompts: readonly string[], active: boolean): string {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (!active || prompts.length === 0) {
      setDisplay('')
      return
    }

    let promptIndex = 0
    let charIndex = 0
    let deleting = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (delay: number, fn: () => void) => {
      timer = setTimeout(fn, delay)
    }

    const tick = () => {
      const current = prompts[promptIndex] ?? ''

      if (!deleting) {
        charIndex += 1
        setDisplay(current.slice(0, charIndex))
        if (charIndex >= current.length) {
          deleting = true
          schedule(HOLD_MS, tick)
          return
        }
        schedule(TYPE_MS, tick)
        return
      }

      charIndex -= 1
      setDisplay(current.slice(0, charIndex))
      if (charIndex <= 0) {
        deleting = false
        promptIndex = (promptIndex + 1) % prompts.length
        schedule(BETWEEN_MS, tick)
        return
      }
      schedule(DELETE_MS, tick)
    }

    schedule(400, tick)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [active, prompts])

  return display
}
