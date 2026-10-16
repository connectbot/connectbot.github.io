/** Shared by the guide sidebar and the mobile guide picker. */
export const guideGroups = [
  {
    title: 'Get started',
    guides: [
      { slug: 'add-host', title: 'Add your first SSH host' },
    ],
  },
  {
    title: 'Connections',
    guides: [
      { slug: 'raspberry-pi', title: 'Connect to a Raspberry Pi' },
      { slug: 'linux-server', title: 'Administer a Linux server' },
      { slug: 'mosh', title: 'Set up Mosh' },
      { slug: 'ssh-keys', title: 'SSH keys and biometric protection' },
      { slug: 'port-forwarding', title: 'Local, remote, and dynamic forwards' },
      { slug: 'post-login-automation', title: 'Post-login automation' },
    ],
  },
  {
    title: 'Terminal',
    guides: [
      { slug: 'special-keys', title: 'Keep special keys visible' },
      { slug: 'terminal-appearance', title: 'Customize terminal appearance' },
    ],
  },
  {
    title: 'Security',
    guides: [
      { slug: 'verify-installation', title: 'Verify your installation' },
    ],
  },
];
