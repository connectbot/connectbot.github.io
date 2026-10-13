import type { ReactNode } from 'react';
import Link from 'next/link';
import { HeroBrand } from '@/components/HeroBrand';
import { SupportLink } from '@/components/SupportLink';
import { StoreBadges } from './StoreBadges';

type Action = Readonly<{
  href: string;
  label: string;
}>;

type LinkButtonProps = Readonly<Action & {
  variant?: 'section' | 'hero';
}>;

export function LinkButton({ href, label, variant = 'section' }: LinkButtonProps) {
  return (
    <Link className={variant === 'hero' ? 'first-connection-link' : 'section-link'} href={href}>
      {label}
      {' →'}
    </Link>
  );
}

type HomeHeroProps = Readonly<{
  tagline: string;
  description: string;
  prompt: string;
  action: Action;
}>;

export function HomeHero({ tagline, description, prompt, action }: HomeHeroProps) {
  return (
    <div className="home-hero">
      <div className="hero-intro">
        <HeroBrand />
        <p className="tagline">{tagline}</p>
        <p className="hero-description">{description}</p>
      </div>
      <StoreBadges />
      <div className="first-connection">
        <p>{prompt}</p>
        <LinkButton {...action} variant="hero" />
      </div>
    </div>
  );
}

type ContentSectionProps = Readonly<{
  id: string;
  title: string;
  description: string;
  layout: 'features' | 'guides';
  action?: Action;
  children: ReactNode;
}>;

export function ContentSection({ id, title, description, layout, action, children }: ContentSectionProps) {
  const heading = (
    <>
      <h2 id={id}>{title}</h2>
      <p className="section-intro">{description}</p>
    </>
  );

  return (
    <section className="home-section" aria-labelledby={id}>
      {action
        ? (
            <div className="section-heading">
              <div>{heading}</div>
              <LinkButton {...action} />
            </div>
          )
        : heading}
      <div className={layout === 'features' ? 'feature-grid' : 'guide-grid'}>
        {children}
      </div>
    </section>
  );
}

type FeatureCardProps = Readonly<{
  title: string;
  description: string;
  action?: Action;
}>;

export function FeatureCard({ title, description, action }: FeatureCardProps) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Link href={action.href}>
          {action.label}
          {' →'}
        </Link>
      )}
    </div>
  );
}

type GuideCardProps = Readonly<{
  title: string;
  description: string;
  href: string;
  label: string;
}>;

export function GuideCard({ title, description, href, label }: GuideCardProps) {
  return (
    <Link className="guide-card" href={href}>
      <h3>{title}</h3>
      <p>{description}</p>
      <span>
        {label}
        {' →'}
      </span>
    </Link>
  );
}

type HelpCalloutProps = Readonly<{
  title: string;
  description: string;
  action: Action;
}>;

export function HelpCallout({ title, description, action }: HelpCalloutProps) {
  return (
    <div className="home-help">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <LinkButton {...action} />
    </div>
  );
}

type DonationCalloutProps = Readonly<{
  title: string;
  description: string;
}>;

export function DonationCallout({ title, description }: DonationCalloutProps) {
  return (
    <section className="donation-callout" aria-label="Support the project">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <SupportLink />
    </section>
  );
}
