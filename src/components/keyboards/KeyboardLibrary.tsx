import { readGallery } from '@/keyboards/gallery';
import { KeyboardGallery } from './KeyboardGallery';

export async function KeyboardLibrary() {
  return <KeyboardGallery entries={await readGallery()} />;
}
