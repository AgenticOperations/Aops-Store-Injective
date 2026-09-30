'use client'

import { useEffect, useRef, useState } from 'react'

const HERO_SPLINE_SCENE =
  'https://prod.spline.design/5u5VxnNXVCaGn7qr/scene.splinecode' as const

const SPLINE_VIEWER_SCRIPT =
  'https://cdn.spline.design/@splinetool/viewer@2.0.28/build/spline-viewer.js'

function mountSplineViewer(container: HTMLElement) {
  if (container.querySelector('spline-viewer')) return

  const viewer = document.createElement('spline-viewer')
  viewer.setAttribute('url', HERO_SPLINE_SCENE)
  viewer.setAttribute('loading', 'eager')
  viewer.setAttribute('background', 'transparent')
  viewer.className = 'home-hero__spline'
  container.appendChild(viewer)
}

function loadSplineViewerScript(): Promise<void> {
  if (customElements.get('spline-viewer')) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>('script[data-spline-viewer]')
  if (existing) {
    return customElements.whenDefined('spline-viewer').then(() => undefined)
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = SPLINE_VIEWER_SCRIPT
    script.dataset.splineViewer = 'true'
    script.onload = () => {
      customElements.whenDefined('spline-viewer').then(() => resolve()).catch(reject)
    }
    script.onerror = () => reject(new Error('Failed to load Spline viewer'))
    document.head.appendChild(script)
  })
}

/**
 * 3D robot for the landing hero — official `<spline-viewer>` via Spline CDN.
 * Spline mounts into a dedicated empty node so React never fights manual DOM updates.
 */
export function HeroSplineRobot() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let cancelled = false

    loadSplineViewerScript()
      .then(() => {
        if (cancelled || !mountRef.current) return
        mountSplineViewer(mountRef.current)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(false)
      })

    return () => {
      cancelled = true
      mount.replaceChildren()
    }
  }, [])

  return (
    <div className="home-hero__spline-wrap">
      {!ready && <div className="home-hero__spline home-hero__spline--loading" aria-hidden="true" />}
      <div ref={mountRef} className="home-hero__spline-mount" />
    </div>
  )
}
