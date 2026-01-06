import type { MDXComponents, UseMDXComponents } from 'nextra/mdx-components';
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { Pre, withIcons } from 'nextra/components';
import { GitHubIcon } from 'nextra/icons';
import { QRCode } from './components/QRCode';

const docsComponents = getDocsMDXComponents({
  pre: withIcons(Pre, { js: GitHubIcon }),
  QRCode,
});

export const useMDXComponents: UseMDXComponents<typeof docsComponents> = (
  components?: MDXComponents,
) => ({
  ...docsComponents,
  ...components,
}) as any;
