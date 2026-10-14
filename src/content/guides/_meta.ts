import { guideGroups } from '@/navigation/guides';

export default {
  index: 'Overview',
  ...Object.fromEntries(guideGroups.flatMap(group => group.guides.map(guide => [guide.slug, guide.title]))),
};
