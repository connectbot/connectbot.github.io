/** @type {import('next-sitemap').IConfig} */
const config = {
  siteUrl: 'https://connectbot.org',
  generateRobotsTxt: true,
  outDir: './out',
  exclude: ['/icon.png'],
};

export default config;
