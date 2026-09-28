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
  about: {
    title: 'About',
    type: 'page',
  },
  guides: {
    title: 'Features & FAQ',
    type: 'doc',
  },
  features: {
    title: 'Features & FAQ',
    type: 'page',
    href: '/guides/',
  },
  bugs: {
    title: 'Reporting Bugs',
    type: 'page',
  },
  privacy: {
    title: 'Privacy Policy',
  },
  404: {
    display: 'hidden',
  },
};

export default meta;
