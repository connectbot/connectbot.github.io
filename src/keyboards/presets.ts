import type { Configuration, Item, Layout, Macro } from './model';
import { encodeMacro, newItem } from './model';

export const templates = [
  { key: 'classic', name: 'Classic CB', description: 'The classic scrolling strip, with pinned app controls.' },
  { key: 'citrus', name: 'Citrus', description: 'Compact terminal controls.' },
  { key: 'last_stop', name: 'Last Stop', description: 'Roomy terminal controls.' },
  { key: 'claw', name: 'Claw', description: 'Optimized for Claude Code.' },
  { key: 'scribe', name: 'Scribe', description: 'Optimized for Codex CLI.' },
];
export function createPreset(preset: string): Configuration {
  let sequence = 0;
  const namespace = templates.findIndex(t => t.key === preset) + 1;
  const id = () => `d27c0b07-1a90-4f50-9b0${namespace}-${(++sequence).toString(16).padStart(12, '0')}`;
  let buttonHeight = 44;
  if (preset === 'classic' || preset === 'blank') {
    buttonHeight = 30;
  } else if (preset === 'citrus') {
    buttonHeight = 36;
  }
  const layout: Layout = { id: id(), name: templates.find(t => t.key === preset)?.name ?? 'My keyboard', buttonWidth: 45, buttonHeight, fitToWidth: !['classic', 'blank'].includes(preset), presetKey: ['classic', 'blank'].includes(preset) ? null : preset };
  const macros: Macro[] = [];
  const button = (kind: string, target: string, extra: Partial<Item> = {}) => newItem(layout.id, { id: id(), kind, target, ...extra });
  const key = (target: string) => button('key', target);
  const char = (value: string) => key(`character_${value.codePointAt(0)}`);
  const mod = (target: string) => button('modifier', target);
  const app = (target: string) => button('app', target);
  const fn = () => button('layer', 'next');
  const shortcut = (target: string, name: string, modifier = 'ctrl') => {
    const macro = { id: id(), name, document: encodeMacro([{ type: 'key', key: target, modifiers: [modifier] }]) };
    macros.push(macro);
    return button('key', target, { macroId: macro.id });
  };
  const ctrl = (value: string, name: string) => shortcut(`character_${value.codePointAt(0)}`, name);
  const stop = () => ctrl('c', 'Stop');
  const hist = () => ctrl('r', 'Hist');
  const arrows = () => ['arrow_left', 'arrow_down', 'arrow_right'].map(key);
  const lower = () => [key('tab'), mod('ctrl'), mod('alt')];
  let rows: Item[][] = [];
  switch (preset) {
    case 'blank': return { version: 17, layouts: [layout], items: [], macros };
    case 'classic': {
      const strip = [mod('ctrl'), mod('alt'), ...['escape', 'tab', 'arrow_up', 'arrow_down', 'arrow_left', 'arrow_right', 'home', 'end', 'page_up', 'page_down', ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)].map(key)];
      return { version: 17, layouts: [layout], items: [...strip.map((i, column) => ({ ...i, column })), ...['toggle_compose', 'toggle_ime'].map((target, column) => ({ ...app(target), pinned: true, column }))], macros };
    }
    case 'citrus': rows = [[key('escape'), char('/'), char('|'), char('-'), key('home'), key('arrow_up'), key('end'), key('page_up'), fn()], [key('tab'), { ...mod('ctrl'), columnSpan: 2 }, mod('alt'), ...arrows(), key('page_down'), app('toggle_ime')]];
      break;
    case 'last_stop': rows = [[key('escape'), key('enter'), stop(), key('home'), key('arrow_up'), key('end'), app('paste'), fn()], [...lower(), ...arrows(), key('backspace'), app('toggle_ime')]];
      break;
    case 'claw': rows = [[key('escape'), stop(), shortcut('tab', 'Mode', 'shift'), ctrl('j', 'Newln'), ctrl('o', 'Log'), key('arrow_up'), hist(), fn()], [...lower(), char('/'), ...arrows(), key('enter')]];
      break;
    default: rows = [[key('escape'), stop(), ctrl('g', 'Edit'), ctrl('o', 'Copy'), hist(), key('arrow_up'), char('@'), fn()], [...lower(), char('/'), ...arrows(), key('enter')]];
  }
  const functionRows = [[key('escape'), ...Array.from({ length: 6 }, (_, i) => key(`f${i + 1}`)), ...(preset === 'citrus' ? [key('page_up')] : []), fn()], [...(preset === 'citrus' ? [key('tab')] : []), mod('ctrl'), mod('alt'), ...Array.from({ length: 6 }, (_, i) => key(`f${i + 7}`))]];
  const items = [rows, functionRows].flatMap((layerRows, layer) => layerRows.flatMap((buttons, row) => {
    let column = 0;
    return buttons.map((b) => {
      const item = { ...b, row, layer, column };
      column += b.columnSpan;
      return item;
    });
  }));
  return { version: 17, layouts: [layout], items, macros };
}
