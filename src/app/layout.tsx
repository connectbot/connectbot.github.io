import type { Metadata } from 'next';
import type { FC, ReactNode } from 'react';
import Image from 'next/image';

import {
  LastUpdated,
  Layout,
  Navbar,
} from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import './styles.css';

export const metadata: Metadata = {
  description:
    'ConnectBot is a secure shell client for the Android platform.',
  title: {
    absolute: '',
    template: '%s | ConnectBot',
  },
  metadataBase: new URL('https://connectbot.org'),
  appleWebApp: {
    title: 'ConnectBot',
  },
  other: {
    'msapplication-TileColor': '#fff',
  },
};

type LayoutProps = Readonly<{
  children: ReactNode;
}>;

const RootLayout: FC<LayoutProps> = async ({ children }) => {
  const pageMap = await getPageMap();

  const navbar = (
    <Navbar
      logo={(
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Image src="/logo.png" alt="ConnectBot logo" width={32} height={32} />
          <span style={{ fontWeight: 'bold' }}>ConnectBot</span>
        </div>
      )}
      projectLink="https://github.com/connectbot/connectbot"
    >
    </Navbar>
  );
  return (
    <html lang="en" suppressHydrationWarning>
      <Head
        backgroundColor={{
          dark: 'rgb(15,23,42)',
          light: '#fafbfc',
        }}
        color={{
          hue: { dark: 120, light: 0 },
          saturation: { dark: 100, light: 100 },
        }}
      />
      <body>
        <Layout
          navbar={navbar}
          sidebar={{
            defaultMenuCollapseLevel: 1,
            autoCollapse: true,
          }}
          nextThemes={{ defaultTheme: 'dark' }}
          pageMap={pageMap}
          lastUpdated={<LastUpdated>Last Updated</LastUpdated>}
          themeSwitch={{
            dark: 'Dark',
            light: 'Light',
            system: 'System',
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
};

export default RootLayout;
