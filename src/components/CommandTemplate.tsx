/* eslint-disable react/no-children-to-array -- MDX code fences arrive as nested, syntax-highlighted React children. */
import type { ReactNode } from 'react';
import { Children, isValidElement } from 'react';
import { CommandBlock } from './CommandExamples';

function textContent(node: ReactNode): string {
  return Children.toArray(node).map((child): string => {
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child);
    }
    return isValidElement<{ children?: ReactNode }>(child) ? textContent(child.props.children) : '';
  }).join('');
}

/** Keep ordinary fenced Markdown as the source of a parameterized command. */
export function CommandTemplate({ children }: Readonly<{ children: ReactNode }>) {
  const blocks = Children.toArray(children);
  const block = blocks[0];
  if (blocks.length !== 1 || !isValidElement<{ 'children'?: ReactNode; 'data-language'?: string }>(block)) {
    throw new Error('CommandTemplate requires a single fenced code block.');
  }

  return <CommandBlock template={textContent(block.props.children)} language={block.props['data-language']} />;
}
