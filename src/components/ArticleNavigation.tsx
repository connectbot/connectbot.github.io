'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { guideGroups } from '@/navigation/guides';

type ArticleHeading = Readonly<{
  id: string;
  depth: number;
  title: ReactNode;
}>;

type ArticleNavigationProps = Readonly<{
  headings: readonly ArticleHeading[];
}>;

/** Keep article sections within reach when the desktop sidebars do not fit. */
export function ArticleNavigation({ headings }: ArticleNavigationProps) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [activeId, setActiveId] = useState(headings[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const navigationBottom = detailsRef.current?.getBoundingClientRect().bottom ?? 0;
      let current = headings[0]?.id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= navigationBottom + 24) {
          current = heading.id;
        }
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [headings]);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        details.open = false;
        details.querySelector('summary')?.focus();
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !details.contains(event.relatedTarget)) {
        details.open = false;
      }
    };
    details.addEventListener('keydown', onKeyDown);
    details.addEventListener('focusout', onFocusOut);
    return () => {
      details.removeEventListener('keydown', onKeyDown);
      details.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const close = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <div className="article-navigation" data-pagefind-ignore>
      <details ref={detailsRef}>
        <summary>
          <span className="article-navigation-tablet-label">Guides &amp; contents</span>
          <span className="article-navigation-mobile-label">In this article</span>
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="article-navigation-panel">
          <nav aria-label="Article sections">
            <h2>In this article</h2>
            <ol>
              {headings.map(({ id, depth, title }) => (
                <li key={id} className={depth > 2 ? 'article-subsection' : undefined}>
                  <a href={`#${id}`} aria-current={activeId === id ? 'location' : undefined} onClick={close}>
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <nav className="article-guide-navigation" aria-label="Other guides">
            <h2>Browse guides</h2>
            <Link href="/guides/" onClick={close}>All guides →</Link>
            {guideGroups.map(group => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.guides.map(({ slug, title }) => {
                    const href = `/guides/${slug}/`;
                    return (
                      <li key={slug}>
                        <Link href={href} aria-current={pathname === href ? 'page' : undefined} onClick={close}>
                          {title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </div>
      </details>
    </div>
  );
}
