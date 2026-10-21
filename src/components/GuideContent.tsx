import type { GuideVariant } from '@/guides/types';
import guides from '@/guides/en.json';
import captures from '../../public/guides/index.json';
import { GuideDemo } from './GuideDemo';

export function GuideContent({ id }: { id: string }) {
  const guide = guides.find(guide => guide.id === id);
  if (!guide) {
    throw new Error(`Unknown guide: ${id}`);
  }
  return (
    <>
      <p>{guide.description}</p>
      <GuideDemo guide={guide} initialVariants={(captures.variants as GuideVariant[]).filter(variant => variant.guide === id)} />
    </>
  );
}
