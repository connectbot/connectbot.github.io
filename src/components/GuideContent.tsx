import guides from '@/guides/en.json';
import { GuideDemo } from './GuideDemo';

export function GuideContent({ id }: { id: string }) {
  const guide = guides.find(guide => guide.id === id);
  if (!guide) {
    throw new Error(`Unknown guide: ${id}`);
  }
  return (
    <>
      <p>{guide.description}</p>
      <GuideDemo guide={guide} />
    </>
  );
}
