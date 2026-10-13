'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { setMenu } from 'nextra-theme-docs';

const destinations = [
  { href: '/guides/', title: 'Guides' },
  { href: '/bugs/', title: 'Help' },
  { href: '/download/', title: 'Download' },
  { href: '/about/', title: 'About' },
];

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav className="mobile-primary-nav" aria-label="Main navigation">
      {destinations.map(({ href, title }) => (
        <Link key={href} href={href} onClick={() => setMenu(false)} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
          {title}
        </Link>
      ))}
    </nav>
  );
}
