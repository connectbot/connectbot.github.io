import { readGallery } from '../../src/keyboards/gallery';

const entries = await readGallery();
console.log(`Validated ${entries.filter(e => !e.template).length} contributed keyboards and ${entries.filter(e => e.template).length} templates.`);
