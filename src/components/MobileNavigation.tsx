'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setMenu } from 'nextra-theme-docs';
import { Search } from 'nextra/components';
import { useEffect, useId, useRef, useState } from 'react';
import { guideGroups } from '@/navigation/guides';

const destinations = [
  { href: '/bugs/', title: 'Help' },
  { href: '/download/', title: 'Download' },
  { href: '/about/', title: 'About' },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const panelId = useId();
  const navigationRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const overviewRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Focus a link rather than search so opening the panel doesn't raise a phone keyboard.
    overviewRef.current?.focus({ preventScroll: true });
    const close = () => {
      setOpenPath(null);
      toggleRef.current?.focus({ preventScroll: true });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const searchExpanded = navigationRef.current?.querySelector('[role="combobox"][aria-expanded="true"]');
      if (event.key === 'Escape' && !event.defaultPrevented && !searchExpanded) {
        event.preventDefault();
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !navigationRef.current?.contains(target) && !target.closest('[role="listbox"]')) {
        setOpenPath(null);
      }
    };
    const onHashChange = () => setOpenPath(null);
    const desktop = window.matchMedia('(min-width: 768px)');
    const onBreakpointChange = () => {
      if (desktop.matches) {
        setOpenPath(null);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    desktop.addEventListener('change', onBreakpointChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      desktop.removeEventListener('change', onBreakpointChange);
    };
  }, [open]);

  return (
    <nav ref={navigationRef} className="mobile-primary-nav" aria-label="Main navigation">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        className={pathname.startsWith('/guides/') ? 'guides-active' : undefined}
        onClick={() => {
          setMenu(false);
          setOpenPath(open ? null : pathname);
        }}
      >
        Guides
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {destinations.map(({ href, title }) => (
        <Link key={href} href={href} onClick={() => setOpenPath(null)} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
          {title}
        </Link>
      ))}
      {open && (
        <>
          <button type="button" className="guides-backdrop" aria-label="Close guides" tabIndex={-1} onClick={() => setOpenPath(null)} />
          <div
            id={panelId}
            className="mobile-guides-panel"
            role="region"
            aria-label="Browse guides"
            onClickCapture={(event) => {
              if (event.target instanceof Element && event.target.closest('[role="option"]')) {
                setOpenPath(null);
              }
            }}
          >
            <div className="guides-panel-heading">
              <Link ref={overviewRef} href="/guides/" onClick={() => setOpenPath(null)} aria-current={pathname === '/guides/' ? 'page' : undefined}>
                All guides →
              </Link>
              <button
                type="button"
                aria-label="Close guide panel"
                onClick={() => {
                  setOpenPath(null);
                  toggleRef.current?.focus();
                }}
              >
                Close ×
              </button>
            </div>
            <Search placeholder="Search documentation…" aria-label="Search documentation" />
            {guideGroups.map(group => (
              <section key={group.title} aria-label={group.title}>
                <h2>{group.title}</h2>
                <ul>
                  {group.guides.map(({ slug, title }) => {
                    const href = `/guides/${slug}/`;
                    return (
                      <li key={slug}>
                        <Link href={href} aria-current={pathname === href ? 'page' : undefined} onClick={() => setOpenPath(null)}>{title}</Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
