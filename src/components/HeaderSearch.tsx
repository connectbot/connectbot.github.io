'use client';

import { Search } from 'nextra/components';
import { useSyncExternalStore } from 'react';

const compactQuery = '(768px <= width < 1200px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function isCompact() {
  return window.matchMedia(compactQuery).matches;
}

export function HeaderSearch() {
  const compact = useSyncExternalStore(subscribe, isCompact, () => false);
  return <Search placeholder={compact ? 'Search…' : 'Search documentation…'} aria-label="Search documentation" />;
}
