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
  bugs: {
    title: 'Reporting Bugs',
    type: 'page',
  },
};

export default meta;
