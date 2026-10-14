'use client';

import Link from 'next/link';
import { setMenu } from 'nextra-theme-docs';

/** A shared donation destination for the header and homepage. */
export function SupportLink() {
  return (
    <Link className="support-link" href="/about/#support-the-project" aria-label="Support ConnectBot" title="Support ConnectBot" onClick={() => setMenu(false)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Support ConnectBot</span>
    </Link>
  );
}
