import type { Metadata } from 'next';
import type { FC, ReactNode } from 'react';

import {
  LastUpdated,
  Layout,
  Navbar,
} from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import themeConfig from '@/theme.config';
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
      logo={themeConfig.logo}
      projectLink={themeConfig.project.link}
      chatLink={themeConfig.chat.link}
      chatIcon={themeConfig.chat.icon}
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
          hue: themeConfig.primaryHue,
          saturation: themeConfig.primarySaturation,
        }}
      >
        {themeConfig.head}
      </Head>
      <body>
        <Layout
          navbar={navbar}
          sidebar={themeConfig.sidebar}
          nextThemes={themeConfig.nextThemes}
          pageMap={pageMap}
          lastUpdated={<LastUpdated>Last Updated</LastUpdated>}
          themeSwitch={themeConfig.themeSwitch.getOptions()}
          footer={themeConfig.footer}
          editLink={themeConfig.editLink}
          feedback={themeConfig.feedback}
          toc={themeConfig.toc}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
};

export default RootLayout;
