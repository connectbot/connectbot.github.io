import type { MetaRecord } from 'nextra';

const meta: MetaRecord = {
  index: {
    type: 'page',
    display: 'hidden',
    theme: {
      typesetting: 'article',
      toc: false,
      copyPage: false,
    },
  },
  guides: {
    title: 'Guides',
    type: 'doc',
  },
  features: {
    title: 'Guides',
    type: 'page',
    href: '/guides/',
  },
  keyboards: {
    title: 'Keyboards',
    display: 'hidden',
    type: 'page',
    theme: { layout: 'full', sidebar: false, toc: false },
  },
  bugs: {
    title: 'Help',
    type: 'page',
  },
  download: {
    title: 'Download',
    type: 'page',
  },
  about: {
    title: 'About',
    type: 'page',
  },
  privacy: {
    title: 'Privacy Policy',
    display: 'hidden',
  },
  404: {
    display: 'hidden',
  },
};

export default meta;
