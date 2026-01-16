import Image from 'next/image';

const config = {
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Image src="/logo.png" alt="ConnectBot logo" width={32} height={32} />
      <span style={{ fontWeight: 'bold' }}>ConnectBot</span>
    </div>
  ),
  project: {
    link: 'https://github.com/connectbot/connectbot',
  },
  chat: {
    link: 'https://web.libera.chat/#connectbot',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.47 2H3.53C2.686 2 2 2.686 2 3.53v16.94c0 .844.686 1.53 1.53 1.53h16.94c.844 0 1.53-.686 1.53-1.53V3.53c0-.844-.686-1.53-1.53-1.53zM8.5 18.5h-2v-9h2v9zm-1-10.5c-.828 0-1.5-.672-1.5-1.5S6.672 5 7.5 5s1.5.672 1.5 1.5S8.328 8 7.5 8zm10 10.5h-2v-4.5c0-1.654-2-1.528-2 0v4.5h-2v-9h2v1.5c.869-1.607 4-1.727 4 1.539v5.961z" />
      </svg>
    ),
  },
  docsRepositoryBase: 'https://github.com/connectbot/connectbot.github.io/tree/develop/src/content',
  footer: (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '2rem',
        borderTop: '1px solid rgba(128, 128, 128, 0.15)',
        marginTop: '3rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2rem',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: '1 1 200px' }}>
          <strong style={{ fontSize: '1.125rem', display: 'block', marginBottom: '0.5rem' }}>
            ConnectBot
          </strong>
          <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.7, lineHeight: 1.6 }}>
            The first SSH client for Android
          </p>
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.75rem', opacity: 0.9 }}>
            Links
          </strong>
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <a
              href="https://github.com/connectbot/connectbot"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub Repository
            </a>
            <a
              href="https://web.libera.chat/#connectbot"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.678 11.894a1 1 0 0 1 .287.801 10.97 10.97 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8.06 8.06 0 0 0 8 14c3.996 0 7-2.807 7-6 0-3.192-3.004-6-7-6S1 4.808 1 8c0 1.468.617 2.83 1.678 3.894zm-.493 3.905a21.682 21.682 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a9.68 9.68 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9.06 9.06 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105z" />
              </svg>
              IRC Chat (#connectbot)
            </a>
            <a
              href="https://github.com/sponsors/kruton"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z" />
              </svg>
              Support Development
            </a>
          </div>
        </div>
      </div>
      <div
        style={{
          borderTop: '1px solid rgba(128, 128, 128, 0.15)',
          paddingTop: '1.5rem',
          fontSize: '0.8125rem',
          opacity: 0.6,
          textAlign: 'center',
        }}
      >
        ©
        {' '}
        {new Date().getFullYear()}
        {' '}
        ConnectBot Contributors. Documentation licensed under
        {' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline' }}
        >
          CC BY 4.0
        </a>
        .
      </div>
    </div>
  ),
  editLink: 'Edit this page on GitHub →',
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback',
    link: 'https://github.com/connectbot/connectbot.github.io/issues/new?labels=feedback',
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    autoCollapse: true,
  },
  toc: {
    backToTop: true,
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="ConnectBot" />
      <meta property="og:description" content="ConnectBot is a secure shell client for the Android platform." />
      <meta name="apple-mobile-web-app-title" content="ConnectBot" />
    </>
  ),
  primaryHue: {
    dark: 120,
    light: 0,
  },
  primarySaturation: {
    dark: 100,
    light: 100,
  },
  themeSwitch: {
    getOptions() {
      return {
        dark: 'Dark',
        light: 'Light',
        system: 'System',
      };
    },
  },
  nextThemes: {
    defaultTheme: 'dark',
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s | ConnectBot',
      description: 'ConnectBot is a secure shell client for the Android platform.',
    };
  },
};

export default config;
