import { Hero } from '@repo/design-system/components'
import type { ReactNode } from 'react'
import { DiscoverChat } from './discover-chat'
import { HeroSplineRobot } from './hero-spline-robot'
import './home-hero.css'

export function HomeHero({
  title,
  lede,
}: {
  title: ReactNode
  lede: string
}) {
  return (
    <div className="home-hero">
      <div className="home-hero__visual" aria-hidden="true">
        <HeroSplineRobot />
      </div>
      <div className="home-hero__content">
        <Hero title={title} lede={lede}>
          <DiscoverChat />
        </Hero>
      </div>
    </div>
  )
}
