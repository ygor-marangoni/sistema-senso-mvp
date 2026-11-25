import { useLayoutEffect, useRef } from 'react'
import { Activity, BellRing, House } from 'lucide-react'

const features = [
  { Icon: House, label: 'Sensores conectados' },
  { Icon: Activity, label: 'Atividade da casa' },
  { Icon: BellRing, label: 'Alertas com contexto' },
]

export default function AuthHero() {
  const featuresRef = useRef(null)

  useLayoutEffect(() => {
    const featuresElement = featuresRef.current
    if (!featuresElement) return undefined

    const alignSeparatorPixels = () => {
      const rect = featuresElement.getBoundingClientRect()
      const pixelRatio = window.devicePixelRatio || 1
      const phase = (position) => ((position * pixelRatio) % 1 + 1) % 1
      let offset = phase(rect.top) - phase(rect.bottom - 1)
      if (offset > 0.5) offset -= 1
      if (offset < -0.5) offset += 1
      featuresElement.style.setProperty('--auth-hero-bottom-line-offset', `${offset / pixelRatio}px`)
    }

    alignSeparatorPixels()
    window.addEventListener('resize', alignSeparatorPixels)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignSeparatorPixels)
    resizeObserver?.observe(featuresElement)
    document.fonts?.ready.then(alignSeparatorPixels)

    return () => {
      window.removeEventListener('resize', alignSeparatorPixels)
      resizeObserver?.disconnect()
    }
  }, [])

  return <aside className="auth-hero" aria-label="Tecnologia discreta para uma casa mais segura">
    <div className="auth-hero-orbit auth-hero-orbit-one" />
    <div className="auth-hero-orbit auth-hero-orbit-two" />
    <img className="auth-hero-art" src="/images/senso-home-hero.webp" alt="Ilustração de uma casa com sensores discretos em seus ambientes" />
    <div className="auth-hero-features" ref={featuresRef}>
      {features.map(({ Icon, label }) => <span className="auth-hero-feature" key={label}><Icon size={15} strokeWidth={1.8} />{label}</span>)}
    </div>
    <div className="auth-hero-copy">
      <h2>Uma visão clara da rotina da casa</h2>
      <p>Atividade, sensores e alertas reunidos em um só lugar</p>
    </div>
  </aside>
}
