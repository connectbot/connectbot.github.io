'use client';

import type { CSSProperties, PointerEvent } from 'react';
import type { Rect, Region } from '@/keyboards/geometry';
import type { Item, Layout, Macro } from '@/keyboards/model';
import { useEffect, useRef } from 'react';
import { geometry } from '@/keyboards/geometry';
import { accessibleLabel, colorCss, label, populated, supported } from '@/keyboards/model';
import './keyboard.css';

export type TestState = { modifiers: Record<string, number>; ime: boolean; compose: boolean };
function KeyIcon({ target, active }: Readonly<{ target: string; active: boolean }>) {
  const paths: Record<string, string> = {
    arrow_up: 'm7 14 5-5 5 5',
    arrow_down: 'm7 10 5 5 5-5',
    arrow_left: 'm14 7-5 5 5 5',
    arrow_right: 'm10 7 5 5-5 5',
    paste: 'M9 5H5v16h14V5h-4M9 3h6v4H9z',
    text_input: 'm4 16 12-12 4 4L8 20H4zm10-10 4 4',
    toggle_ime: active ? 'M3 4h18v13H3zM7 8h1m3 0h1m3 0h1M7 11h1m3 0h1m3 0h1m-8 9 3 3 3-3' : 'M3 5h18v14H3zM6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M8 16h8',
  };
  const path = paths[target];
  return path !== undefined ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg> : null;
}
function faceOpacity(item: Item, active: number, enabled: boolean): number {
  if (active > 0) {
    return 1;
  }
  const opacity = item.backgroundOpacity ?? 0.85;
  return enabled && item.visible ? opacity : opacity * 0.35 / 0.85;
}
function KeyFace({ item, macros, active, enabled }: Readonly<{ item: Item; macros: Macro[]; active: number; enabled: boolean }>) {
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const span = text.current;
    if (!span?.parentElement) {
      return;
    }
    const fit = () => {
      const width = Math.max(0, span.parentElement!.clientWidth - 4);
      const height = span.parentElement!.clientHeight;
      span.style.transform = `scale(${Math.min(1, width / Math.max(1, span.scrollWidth))}, ${Math.min(1, height / Math.max(1, span.scrollHeight))})`;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(span.parentElement);

    fit();

    document.fonts.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [item, macros]);
  const style: CSSProperties = {
    '--kb-background': item.backgroundColor === null ? undefined : colorCss(item.backgroundColor),
    'color': item.textColor === null ? undefined : `${colorCss(item.textColor)}${((item.textColor >>> 24) & 255).toString(16).padStart(2, '0')}`,
    'borderColor': item.outlineColor === null ? undefined : `${colorCss(item.outlineColor)}${((item.outlineColor >>> 24) & 255).toString(16).padStart(2, '0')}`,
    'borderWidth': item.outlineWidth ?? 1,
    '--kb-opacity': faceOpacity(item, active, enabled),
  } as CSSProperties;
  const icon = item.kind !== 'macro' && ['arrow_up', 'arrow_down', 'arrow_left', 'arrow_right', 'paste', 'text_input', 'toggle_ime'].includes(item.target);
  return (
    <span className={`kb-face kb-state-${active}`} style={style}>
      {icon ? <KeyIcon target={item.target} active={!!active} /> : <span ref={text} className="kb-face-label">{label(item, macros)}</span>}
    </span>
  );
}
type CanvasProps = Readonly<{
  layout: Layout;
  items: Item[];
  macros: Macro[];
  width: number;
  maxHeight: number;
  layer: number;
  editing?: boolean;
  selectedId?: string;
  testState?: TestState;
  onPress?: (item: Item) => void;
  onMove?: (id: string, row: number, column: number) => void;
}>;
function activeLevel(item: Item, items: Item[], layer: number, state?: TestState): number {
  const initial = populated(items)[0] ?? 0;
  const selectedLayer = item.target === String(layer) || (item.target === 'next' && layer !== initial);
  if (item.kind === 'layer' && selectedLayer) {
    return 2;
  }
  if (item.target === 'toggle_ime') {
    return state?.ime ? 1 : 0;
  }
  if (item.target === 'toggle_compose') {
    return state?.compose ? 2 : 0;
  }
  return state?.modifiers[item.target] ?? 0;
}
function keyDescription(item: Item, macros: Macro[], editing: boolean): string {
  const name = accessibleLabel(item, macros);
  if (!editing) {
    return name;
  }
  const position = `, row ${item.row}, column ${item.column}`;
  const visibility = item.visible ? '' : ', hidden';
  return name + position + visibility;
}
function keyTitle(item: Item, macros: Macro[], editing: boolean, active: number): string {
  const action = `${label(item, macros)} · ${item.kind}: ${item.target || item.macroId}`;
  if (editing || item.kind !== 'modifier') {
    return action;
  }
  const state = ['off', 'one-shot', 'locked'][active];
  return `${action} · ${state}`;
}
type Gesture = { x: number; y: number; moved: boolean; timer?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> };
function clearGesture(gesture: Gesture | null): void {
  if (gesture === null) {
    return;
  }
  clearTimeout(gesture.timer);
  clearInterval(gesture.interval);
}
function startRepeating(gesture: Gesture, press: () => void): void {
  gesture.timer = setTimeout(() => {
    press();
    gesture.timer = setTimeout(() => {
      press();
      gesture.interval = setInterval(press, 50);
    }, 400);
  }, 100);
}
function KeyboardButton({ item, rect, region, items, macros, layer, editing, selectedId, testState, onPress, onMove }: Readonly<{
  item: Item;
  rect: Rect;
  region: Region;
  items: Item[];
  macros: Macro[];
  layer: number;
  editing: boolean;
  selectedId?: string;
  testState?: TestState;
  onPress?: (item: Item) => void;
  onMove?: (id: string, row: number, column: number) => void;
}>) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const cleanup = () => {
    clearGesture(gesture.current);
    gesture.current = null;
  };
  useEffect(() => () => clearGesture(gesture.current), []);
  const enabled = supported(item, items, macros);
  const active = activeLevel(item, items, layer, testState);
  const defaultRepeat = item.kind === 'key' && item.target.startsWith('arrow_');
  const repeating = !editing && ['key', 'macro'].includes(item.kind) && (item.repeatOnHold ?? defaultRepeat);
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || (!onMove && !repeating)) {
      return;
    }
    cleanup();
    suppressClick.current = false;
    const current: Gesture = { x: event.clientX, y: event.clientY, moved: false };
    gesture.current = current;
    if (editing) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (repeating) {
      startRepeating(current, () => {
        onPress?.(item);
        suppressClick.current = true;
      });
    }
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || !editing || !onMove) {
      return;
    }
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 6) {
      current.moved = true;
    }
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (current?.moved && editing && onMove) {
      const scale = event.currentTarget.getBoundingClientRect().width / Math.max(1, rect.width);
      const dx = (event.clientX - current.x) / scale;
      const dy = (event.clientY - current.y) / scale;
      const row = Math.max(0, Math.round(item.row + dy / Math.max(1, region.cellHeight)));
      const column = Math.max(0, Math.round(item.column + dx / Math.max(1, region.width / Math.max(1, region.columns))));
      onMove(item.id, row, column);
      suppressClick.current = true;
    }
    cleanup();
  };
  const classes = ['kb-key'];
  if (editing) {
    classes.push('kb-editable');
  }
  if (selectedId === item.id) {
    classes.push('kb-selected');
  }
  if (!item.visible) {
    classes.push('kb-hidden-key');
  }
  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-key-id={item.id}
      data-target={item.target}
      data-row-span={item.rowSpan}
      data-pinned={item.pinned}
      aria-label={keyDescription(item, macros, editing)}
      aria-description={!editing && item.kind === 'modifier' ? ['off', 'one-shot', 'locked'][active] : undefined}
      aria-pressed={item.kind === 'modifier' ? active > 0 : undefined}
      title={keyTitle(item, macros, editing, active)}
      disabled={!editing && !enabled}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, touchAction: editing && onMove ? 'none' : 'manipulation' }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onPress?.(item);
      }}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={cleanup}
      onLostPointerCapture={cleanup}
      onPointerLeave={() => {
        if (!editing) {
          cleanup();
        }
      }}
    >
      <KeyFace item={item} macros={macros} active={active} enabled={editing || enabled} />
    </button>
  );
}
export function KeyboardCanvas({ layout, items, macros, width, maxHeight, layer, editing = false, selectedId, testState, onPress, onMove }: CanvasProps) {
  const regions = geometry(layout, items, width, maxHeight);
  const height = regions.length ? Math.max(...regions.map(r => r.viewportHeight)) : 30;
  return (
    <div className="kb-grid" style={{ width, height }} data-testid="keyboard-grid" data-layer={layer}>
      {regions.map(region => (
        <div key={String(region.pinned)} className={`kb-region ${region.pinned ? 'kb-dock' : ''}`} data-testid={region.pinned ? 'pinned-region' : 'scrolling-region'} style={{ left: region.x, width: region.viewportWidth, height: region.viewportHeight, overflow: layout.fitToWidth || region.pinned ? 'hidden' : 'auto' }}>
          <div style={{ position: 'relative', width: region.width, height: region.height }}>
            {region.rects.filter(r => r.item.layer === layer && (editing || r.item.visible)).map(rect => (
              <KeyboardButton key={rect.item.id} item={items.find(i => i.id === rect.item.id)!} rect={rect} region={region} items={items} macros={macros} layer={layer} editing={editing} selectedId={selectedId} testState={testState} onPress={onPress} onMove={onMove} />
            ))}
          </div>
        </div>
      ))}
      {regions.filter(r => r.pinned && r.x > 0).map(r => <span key={r.x} aria-hidden="true" style={{ position: 'absolute', left: r.x - 3, top: 0, width: 3, height: r.viewportHeight, background: 'var(--key-outline)' }} />)}
      {!items.length && <p className="kb-empty-grid">Add a key to start your layout.</p>}
    </div>
  );
}
