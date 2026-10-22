import type { Configuration } from './model';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { object, parseConfiguration, slugify, validate, validateContribution } from './model';
import { createPreset, templates } from './presets';

export type GalleryEntry = { slug: string; name: string; description: string; configuration: Configuration; template: boolean };
const wireTables = [
  { name: 'keyboard_layouts', required: ['id', 'name'], booleans: ['fitToWidth'] },
  { name: 'keyboard_macros', required: ['id', 'name', 'document'], booleans: [] },
  { name: 'keyboard_items', required: ['id', 'layoutId', 'row', 'column', 'rowSpan', 'columnSpan', 'visible', 'kind', 'target'], booleans: ['visible', 'pinned', 'repeatOnHold', 'hapticFeedback'] },
];
function validateWireFields(raw: Record<string, unknown>): void {
  if (Object.keys(raw).some(k => !['version', ...wireTables.map(t => t.name)].includes(k))) {
    throw new Error('Include only keyboard tables and version; remove unrelated configuration.');
  }
  for (const table of wireTables) {
    for (const value of (raw[table.name] ?? []) as unknown[]) {
      const row = object(value);
      if (table.required.some(field => row[field] == null)) {
        throw new Error(`${table.name} is missing a required import field.`);
      }
      if (table.booleans.some(field => row[field] != null && row[field] !== 0 && row[field] !== 1)) {
        throw new Error('Portable JSON boolean fields must use integer 0/1 values.');
      }
    }
  }
}
function validateUniqueIdentities(config: Configuration, seen: Set<string>): string[] {
  const errors: string[] = [];
  for (const [table, records] of [config.layouts, config.items, config.macros].entries()) {
    for (const record of records) {
      const identity = `${table}/${record.id}`;
      if (seen.has(identity)) {
        errors.push(`UUID ${record.id} is already contributed in another file. Export a new copy.`);
      }
      seen.add(identity);
    }
  }
  return errors;
}
function contribution(file: string, source: string, seen: Set<string>): GalleryEntry {
  try {
    const slug = file.slice(0, -5);
    if (slugify(slug) !== slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      throw new Error('Use a lowercase filename with letters, numbers, and hyphens.');
    }
    const config = parseConfiguration(source);
    validateWireFields(object(JSON.parse(source)));
    const errors = [...validateContribution(config), ...validateUniqueIdentities(config, seen)];
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }
    return { slug, name: config.layouts[0]!.name, description: 'A keyboard shared by the ConnectBot community.', configuration: config, template: false };
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
function templateEntries(): GalleryEntry[] {
  return templates.map((t) => {
    const configuration = createPreset(t.key);
    const errors = validate(configuration);
    if (errors.length) {
      throw new Error(`${t.name}: ${errors.join('\n')}`);
    }
    return { slug: t.key, name: t.name, description: t.description, configuration, template: true };
  });
}
export async function readGallery(directory = path.join(process.cwd(), 'public/keyboards')): Promise<GalleryEntry[]> {
  const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
  const sources = await Promise.all(files.map(async file => ({
    file,
    source: await readFile(path.join(directory, file), 'utf8'),
  })));
  const seen = new Set<string>();
  const community = sources.map(({ file, source }) => contribution(file, source, seen));
  return [...templateEntries(), ...community];
}
