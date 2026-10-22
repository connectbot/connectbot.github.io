import type { Item, Layout } from './model';

export type Rect = { item: Item; x: number; y: number; width: number; height: number };
export type Region = { pinned: boolean; x: number; viewportWidth: number; viewportHeight: number; width: number; height: number; columns: number; cellHeight: number; rects: Rect[] };
export function geometry(layout: Layout, items: Item[], width: number, maxHeight: number): Region[] {
  const regular = items.filter(i => !i.pinned);
  const pinned = items.filter(i => i.pinned);
  const extent = (list: Item[], axis: 'column' | 'row') => Math.max(0, ...list.map(i => axis === 'column' ? i.column + i.columnSpan : i.row + i.rowSpan));
  const dockWidth = Math.min(extent(pinned, 'column') * layout.buttonWidth, regular.length ? Math.max(0, width - 3) / 2 : width);
  const dividerWidth = regular.length ? 3 : 0;
  const scrollingWidth = pinned.length ? width - dockWidth - dividerWidth : width;
  const groups = layout.fitToWidth
    ? [{ pinned: false, items: items.map(i => i.pinned ? { ...i, column: i.column + extent(regular, 'column') } : i), viewportWidth: width, x: 0, fit: true }]
    : [{ pinned: false, items: regular, viewportWidth: scrollingWidth, x: 0, fit: false }, { pinned: true, items: pinned, viewportWidth: regular.length ? dockWidth : width, x: regular.length ? width - dockWidth : 0, fit: true }];
  return groups.filter(g => g.items.length).map((g): Region => {
    const columns = Math.min(1000, extent(g.items, 'column'));
    const rows = Math.min(1000, extent(g.items, 'row'));
    const gridWidth = g.fit ? g.viewportWidth : Math.round(layout.buttonWidth) * columns;
    const cellHeight = g.fit && rows ? Math.min(Math.max(1, Math.round(layout.buttonHeight)), Math.floor(maxHeight / rows)) : Math.max(1, Math.round(layout.buttonHeight));
    const x = (column: number) => columns ? Math.floor(column * gridWidth / columns) : 0;
    const height = rows * cellHeight;
    return { pinned: g.pinned, x: g.x, viewportWidth: g.viewportWidth, viewportHeight: Math.min(height, maxHeight), width: gridWidth, height, columns, cellHeight, rects: g.items.map(item => ({ item, x: x(item.column), y: item.row * cellHeight, width: x(item.column + item.columnSpan) - x(item.column), height: cellHeight * item.rowSpan })) };
  });
}
