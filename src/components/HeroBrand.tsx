'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

/** Move the homepage wordmark into its reserved navigation position on scroll. */
export function HeroBrand() {
  const heroRef = useRef<HTMLDivElement>(null);
  const movingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const moving = movingRef.current;
    const navbar = document.querySelector<HTMLElement>('.navbar-brand');
    if (!hero || !moving || !navbar) {
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;
    const update = () => {
      frame = 0;
      const origin = hero.getBoundingClientRect();
      const destination = navbar.getBoundingClientRect();
      const startY = origin.top + window.scrollY;
      const distance = Math.max(1, startY - destination.top);
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      const docked = progress === 1;
      document.documentElement.dataset.brandDocked = String(docked);
      hero.style.opacity = (reducedMotion.matches && !docked) || progress === 0 ? '1' : '0';
      moving.style.visibility = !reducedMotion.matches && progress > 0 && !docked ? 'visible' : 'hidden';
      const scale = 1 + (destination.width / origin.width - 1) * progress;
      const x = origin.left + (destination.left - origin.left) * progress;
      const y = startY + (destination.top - startY) * progress;
      moving.style.width = `${origin.width}px`;
      moving.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const schedule = () => {
      if (!disposed && !frame) {
        frame = window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    void document.fonts.ready.then(schedule);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      delete document.documentElement.dataset.brandDocked;
    };
  }, []);

  return (
    <>
      <div ref={heroRef} className="hero-brand">
        <Image src="/logo.png" alt="" width={96} height={96} />
        <h1>ConnectBot</h1>
      </div>
      <div ref={movingRef} className="moving-brand" aria-hidden="true">
        <Image src="/logo.png" alt="" width={96} height={96} />
        <span>ConnectBot</span>
      </div>
    </>
  );
}
