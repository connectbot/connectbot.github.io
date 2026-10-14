import type { FC } from 'react';
import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { removeLinks } from 'nextra/remove-links';
import { ArticleNavigation } from '@/components/ArticleNavigation';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

type PageProps = Readonly<{
  params: Promise<{
    mdxPath: string[];
  }>;
}>;

const Wrapper = getMDXComponents().wrapper!;

const Page: FC<PageProps> = async (props) => {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata, sourceCode } = result;
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      {(params.mdxPath?.length ?? 0) > 0 && toc.length > 0 && (
        <ArticleNavigation headings={toc.map(({ id, depth, value }) => ({ id, depth, title: removeLinks(value) }))} />
      )}
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
};

export default Page;
