'use client';

/* eslint-disable react/no-array-index-key -- Diagnostic and action-log entries are display-only, with no component state. */

import type { ChangeEvent } from 'react';
import type { TestState } from './KeyboardCanvas';
import type { Action, Configuration, Item, Layout, Macro } from '@/keyboards/model';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { appActions, colorCss, colorValue, decodeMacro, destination, keys, label, MAX_BYTES, modifiers, newId, newItem, overlaps, parseConfiguration, populated, serialize, slugify, supported, validate, validateContribution, warnings } from '@/keyboards/model';
import { createPreset, templates } from '@/keyboards/presets';
import { downloadJson } from './download';
import { GoogleKeyboardPreview } from './GoogleKeyboardPreview';
import { KeyboardCanvas } from './KeyboardCanvas';
import { MacroLibrary } from './MacroLibrary';
import './keyboard.css';

const devices = { phone: [390, 844], tablet: [800, 1280], desktop: [1440, 900], custom: [390, 844] } as const;
const storageKey = 'connectbot-keyboard-draft-v1';
type History = { past: Configuration[]; present: Configuration; future: Configuration[] };
type Simulation = TestState & { log: string[] };
const initialSimulation = (ime = true): Simulation => ({ modifiers: { ctrl: 0, alt: 0, shift: 0 }, ime, compose: false, log: [] });

function previewImeHeight(device: keyof typeof devices, height: number, visible: boolean): number {
  if (!visible || (device !== 'phone' && device !== 'tablet')) {
    return 0;
  }
  const preferredHeight = device === 'tablet' ? 360 : 280;
  return Math.min(preferredHeight, Math.round(height * 0.42));
}

const actionTargets = new Map([['key', 'escape'], ['modifier', 'ctrl'], ['app', 'toggle_ime'], ['layer', 'next']]);
const actionOptions = new Map([['key', keys], ['modifier', modifiers], ['app', appActions]]);
const appearanceLabels = { backgroundColor: 'Background', textColor: 'Text color', outlineColor: 'Outline color' };
function formatAction(action: Action): string {
  if (action.type === 'text') {
    return `text ${JSON.stringify(action.text)}`;
  }
  if (action.type === 'bytes') {
    return `bytes ${action.hex}`;
  }
  return `key ${[...action.modifiers, action.key ?? JSON.stringify(action.character)].join('+')}`;
}
function draftStatus(ready: boolean, recovery: string | null, storageError: string): string {
  if (!ready) {
    return 'Loading editor…';
  }
  if (recovery === null && storageError === '') {
    return 'Draft saved locally';
  }
  return 'Local workspace';
}
async function initialConfiguration(search: string): Promise<Configuration | undefined> {
  const query = new URLSearchParams(search);
  const template = query.get('template');
  if (template !== null && [...templates.map(t => t.key), 'blank'].includes(template)) {
    return createPreset(template);
  }
  const slug = query.get('layout');
  if (slug === null || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return undefined;
  }
  const response = await fetch(`/keyboards/${slug}.json`);
  if (!response.ok) {
    throw new Error('Could not load this gallery layout.');
  }
  return parseConfiguration(await response.text());
}
function Numeric({ title, value, onChange, min = 0, max = 1000, step = 1 }: Readonly<{ title: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }>) {
  return (
    <label>
      {title}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (e.target.value !== '') {
            onChange(Number(e.target.value));
          }
        }}
      />
    </label>
  );
}
function TriState({ title, value, onChange }: Readonly<{ title: string; value: boolean | null; onChange: (value: boolean | null) => void }>) {
  return (
    <label>
      {title}
      <select aria-label={title} value={value === null ? 'default' : String(value)} onChange={e => onChange(e.target.value === 'default' ? null : e.target.value === 'true')}>
        <option value="default">App default</option>
        <option value="true">On</option>
        <option value="false">Off</option>
      </select>
    </label>
  );
}
function Inspector({ item, config, onChange, onDuplicate, onDelete }: Readonly<{ item: Item; config: Configuration; onChange: (item: Item) => void; onDuplicate: () => void; onDelete: () => void }>) {
  const update = (patch: Partial<Item>) => onChange({ ...item, ...patch });
  const options = actionOptions.get(item.kind) ?? ['next', '0', '1', '2', '3', '4'];
  return (
    <section className="kb-panel kb-inspector" aria-label="Selected key">
      <div className="kb-panel-heading">
        <h2>{label(item, config.macros)}</h2>
        <span className="kb-tag">Selected key</span>
      </div>
      <label>
        <span>Action kind</span>
        <select aria-label="Action kind" value={item.kind} onChange={e => update({ kind: e.target.value, target: actionTargets.get(e.target.value) ?? '', macroId: null })}>
          {!['key', 'modifier', 'app', 'layer', 'macro'].includes(item.kind) && <option>{item.kind}</option>}
          <option value="key">Key or shortcut</option>
          <option value="modifier">Sticky modifier</option>
          <option value="app">App control</option>
          <option value="layer">Layer switch</option>
          <option value="macro">Macro</option>
        </select>
      </label>
      {item.kind !== 'macro' && (
        <label>
          <span>Target</span>
          <select aria-label="Target" value={item.target} onChange={e => update({ target: e.target.value, macroId: null })}>
            {!options.includes(item.target) && <option>{item.target}</option>}
            {options.map(target => (
              <option key={target} value={target}>
                {label({ ...item, target, macroId: null }, [])}
                {' '}
                ·
                {' '}
                {target}
              </option>
            ))}
          </select>
        </label>
      )}
      {['key', 'macro'].includes(item.kind) && (
        <label>
          <span>Named macro / shortcut</span>
          <select
            aria-label="Named macro / shortcut"
            value={item.macroId ?? ''}
            onChange={(e) => {
              const macro = config.macros.find(m => m.id === e.target.value);
              if (macro === undefined) {
                update({ macroId: null });
                return;
              }
              try {
                const actions = decodeMacro(macro.document);
                const shortcut = actions.length === 1 && actions[0]?.type === 'key' ? actions[0] : undefined;
                update({ kind: shortcut?.key !== undefined ? 'key' : 'macro', target: shortcut?.key ?? '', macroId: macro.id });
              } catch {
                update({ kind: 'macro', target: '', macroId: macro.id });
              }
            }}
          >
            <option value="">None</option>
            {config.macros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      )}
      <p className="kb-help">For a custom label or key combination, create a named macro and assign it here.</p>
      <details open>
        <summary>Placement</summary>
        <div className="kb-fields">
          <Numeric title="Row" value={item.row} onChange={row => update({ row })} />
          <Numeric title="Column" value={item.column} onChange={column => update({ column })} />
          <Numeric title="Row span" value={item.rowSpan} min={1} onChange={rowSpan => update({ rowSpan })} />
          <Numeric title="Column span" value={item.columnSpan} min={1} onChange={columnSpan => update({ columnSpan })} />
          <Numeric title="Key layer" value={item.layer} max={4} onChange={layer => update({ layer })} />
        </div>
        <div className="kb-checks">
          <label>
            <input type="checkbox" checked={item.visible} onChange={e => update({ visible: e.target.checked })} />
            <span>Show key</span>
          </label>
          <label>
            <input type="checkbox" checked={item.pinned} onChange={e => update({ pinned: e.target.checked })} />
            <span>Pinned</span>
          </label>
        </div>
        <p className="kb-help">Pinned keys have their own coordinates. Fitted layouts append them to the main grid.</p>
      </details>
      <details>
        <summary>Appearance</summary>
        {(['backgroundColor', 'textColor', 'outlineColor'] as const).map(field => (
          <div key={field} className="kb-color-row">
            <label>
              {appearanceLabels[field]}
              <input type="color" value={colorCss(item[field] ?? (field === 'backgroundColor' ? -197377 : -15066082))} onChange={e => update({ [field]: colorValue(e.target.value) })} />
            </label>
            <button type="button" onClick={() => update({ [field]: null })}>Use theme</button>
          </div>
        ))}
        <Numeric title="Background opacity" value={item.backgroundOpacity ?? 0.85} max={1} step={0.05} onChange={backgroundOpacity => update({ backgroundOpacity })} />
        <Numeric title="Outline width (dp)" value={item.outlineWidth ?? 1} max={10} step={0.5} onChange={outlineWidth => update({ outlineWidth })} />
        <button type="button" onClick={() => update({ backgroundColor: null, backgroundOpacity: null, textColor: null, outlineColor: null, outlineWidth: null })}>Reset appearance</button>
      </details>
      <details>
        <summary>Behavior</summary>
        <TriState title="Repeat on hold" value={item.repeatOnHold} onChange={repeatOnHold => update({ repeatOnHold })} />
        <TriState title="Haptic feedback" value={item.hapticFeedback} onChange={hapticFeedback => update({ hapticFeedback })} />
        <p className="kb-help">By default arrows repeat. Haptics are saved for ConnectBot; the preview does not vibrate.</p>
      </details>
      <div className="kb-toolbar">
        <button type="button" onClick={onDuplicate}>Duplicate key</button>
        <button type="button" className="kb-danger" onClick={onDelete}>Delete key</button>
      </div>
    </section>
  );
}
export function KeyboardEditor() {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: createPreset('citrus'), future: [] }));
  const config = history.present;
  const [layoutId, setLayoutId] = useState(config.layouts[0]!.id);
  const layout = config.layouts.find(l => l.id === layoutId) ?? config.layouts[0]!;
  const items = config.items.filter(i => i.layoutId === layout.id);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = items.find(i => i.id === selectedId);
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<'edit' | 'test'>('edit');
  const [device, setDevice] = useState<keyof typeof devices>('phone');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [custom, setCustom] = useState<[number, number]>([390, 844]);
  const [theme, setTheme] = useState('light');
  const [simulation, setSimulation] = useState(() => initialSimulation());
  const [notice, setNotice] = useState('');
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [preserve, setPreserve] = useState(false);
  const [share, setShare] = useState(false);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [storageError, setStorageError] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(700);
  const exported = useRef<{ key: string; source: string } | null>(null);
  const source = serialize(config);
  const errors = validate(config, layout.id);
  const warn = warnings(config, layout.id);
  const contributionErrors = share ? validateContribution(parseConfiguration(serialize(config, layout.id))) : [];
  const dimensions = device === 'custom' ? custom : devices[device];
  const short = Math.min(...dimensions);
  const long = Math.max(...dimensions);
  const width = orientation === 'portrait' ? short : long;
  const height = orientation === 'portrait' ? long : short;
  const scale = Math.min(1, Math.max(100, availableWidth - 32) / width, 650 / height);
  const commit = (next: Configuration) => setHistory(h => ({ past: [...h.past.slice(-49), h.present], present: next, future: [] }));
  const mobileDevice = device === 'phone' || device === 'tablet';
  const imeHeight = previewImeHeight(device, height, simulation.ime);
  const consoleHeight = height - imeHeight;
  const reset = (nextDevice = device) => setSimulation(initialSimulation(nextDevice === 'phone' || nextDevice === 'tablet'));
  const load = (next: Configuration) => {
    commit(next);
    setLayoutId(next.layouts[0]!.id);
    setLayer(populated(next.items.filter(i => i.layoutId === next.layouts[0]!.id))[0] ?? 0);
    setSelectedId(undefined);
    reset();
    setJsonDraft(null);
  };
  useEffect(() => {
    const element = stage.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0]?.contentRect.width ?? 700));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        setRecovery(localStorage.getItem(storageKey));
      } catch {
        setStorageError('Browser storage is unavailable. Download your layout to keep your work.');
      }
      try {
        const next = await initialConfiguration(window.location.search);
        if (next !== undefined && !cancelled) {
          setHistory({ past: [], present: next, future: [] });
          setLayoutId(next.layouts[0]!.id);
          setLayer(populated(next.items.filter(i => i.layoutId === next.layouts[0]!.id))[0] ?? 0);
        }
      } catch (e) {
        if (!cancelled) {
          setNotice(e instanceof Error ? e.message : String(e));
        }
      }
      if (!cancelled) {
        setReady(true);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!ready || recovery !== null) {
      return;
    }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, source);
      } catch {
        setStorageError('Draft could not be saved in this browser. Download your work.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [source, ready, recovery]);
  const updateLayout = (patch: Partial<Layout>) => commit({ ...config, layouts: config.layouts.map(l => l.id === layout.id ? { ...l, ...patch } : l) });
  const updateItem = (next: Item, moving = false) => {
    if (moving && items.some(i => i.id !== next.id && overlaps(i, next))) {
      setNotice('That cell is occupied. Move the key to an empty area.');
      return;
    }
    if (moving) {
      const candidate = { ...config, items: config.items.map(i => i.id === next.id ? next : i) };
      const geometryError = validate(candidate, layout.id).filter(e => !e.includes('route back'));
      if (geometryError.length) {
        setNotice(geometryError[0]!);
        return;
      }
    }
    commit({ ...config, items: config.items.map(i => i.id === next.id ? next : i) });
    setNotice('');
  };
  const addKey = (copy?: Item) => {
    if (items.length >= 256) {
      setNotice('A layout supports at most 256 keys.');
      return;
    }
    let item = newItem(layout.id, copy ? { ...copy, id: newId(), layer } : { layer });
    let found = false;
    const columns = Math.max(1, ...items.map(i => i.column + i.columnSpan));
    for (let row = 0; row < Math.floor(3000 / layout.buttonHeight) && !found; row++) {
      for (let column = 0; column < columns && !found; column++) {
        const candidate = { ...item, row, column };
        if ((column + item.columnSpan) * layout.buttonWidth <= 3000 && (row + item.rowSpan) * layout.buttonHeight <= 3000 && !items.some(i => overlaps(i, candidate))) {
          item = candidate;
          found = true;
        }
      }
    }
    if (!found) {
      setNotice('No free cells remain within ConnectBot’s grid limits.');
      return;
    }
    commit({ ...config, items: [...config.items, item] });
    setSelectedId(item.id);
    setNotice('');
  };
  const press = (item: Item) => {
    if (mode === 'edit') {
      setSelectedId(item.id);
      return;
    }
    if (!supported(item, items, config.macros)) {
      return;
    }
    if (item.kind === 'layer') {
      const next = destination(items, layer, item.target);
      if (next !== undefined) {
        setLayer(next);
      }
      return;
    }
    setSimulation((previous) => {
      const next = { ...previous, modifiers: { ...previous.modifiers } };
      let event = '';
      if (item.kind === 'modifier') {
        next.modifiers[item.target] = ((previous.modifiers[item.target] ?? 0) + 1) % 3;
      } else if (item.kind === 'app') {
        if (item.target === 'toggle_ime') {
          next.ime = !next.ime;
        }
        if (item.target === 'toggle_compose') {
          next.compose = !next.compose;
        }
        event = `App: ${label(item, config.macros)}`;
      } else {
        const macro = config.macros.find(m => m.id === item.macroId);
        if (macro) {
          event = decodeMacro(macro.document).map(formatAction).join(' → ');
        } else {
          event = `key ${[...modifiers.filter(m => (next.modifiers[m] ?? 0) > 0), item.target].join('+')}`;
        }
        modifiers.forEach((m) => {
          if (next.modifiers[m] === 1) {
            next.modifiers[m] = 0;
          }
        });
      }
      if (event) {
        next.log = [...previous.log.slice(-99), event];
      }
      return next;
    });
  };
  const download = () => {
    if (errors.length) {
      setNotice('Resolve the layout errors before downloading.');
      return;
    }
    const key = `${source}:${layout.id}:${preserve}`;
    if (exported.current?.key !== key) {
      exported.current = { key, source: serialize(config, layout.id, !preserve) };
    }
    downloadJson(exported.current.source, `${slugify(layout.name)}.json`);
    setNotice('Downloaded. In ConnectBot, use Import Hosts, then choose the layout in Settings → Terminal keyboard.');
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      if (file.size > MAX_BYTES) {
        throw new Error('Files must be 8 MiB or smaller.');
      }
      load(parseConfiguration(await file.text()));
      setNotice('Loaded keyboard data locally. Other configuration tables are excluded from downloads.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
    event.target.value = '';
  };
  const assignMacro = (macro: Macro) => {
    if (!selected) {
      return;
    }
    const actions = decodeMacro(macro.document);
    const shortcut = actions.length === 1 && actions[0]?.type === 'key' ? actions[0] : undefined;
    updateItem({ ...selected, kind: shortcut?.key !== undefined ? 'key' : 'macro', target: shortcut?.key ?? '', macroId: macro.id });
  };
  return (
    <div className="kb-app kb-editor">
      <fieldset disabled={!ready} className="kb-ready-boundary" aria-label="Keyboard workspace">
        <div className="kb-page-heading">
          <div>
            <Link href="/keyboards/" className="kb-back">← Keyboard library</Link>
            <h1>Make room for your workflow.</h1>
            <p>Build a terminal keyboard. Preview it on any screen. Take it into ConnectBot.</p>
          </div>
          <span className="kb-local-badge">
            <span />
            {' '}
            All editing stays in your browser
          </span>
        </div>
        {recovery !== null && (
          <div className="kb-banner">
            <span>A previous keyboard draft is available.</span>
            <button
              type="button"
              onClick={() => {
                try {
                  load(parseConfiguration(recovery));
                  setRecovery(null);
                  setNotice('Previous draft restored.');
                } catch (e) {
                  setNotice(String(e));
                }
              }}
            >
              Restore draft
            </button>
            <button type="button" onClick={() => setRecovery(null)}>Use current layout</button>
          </div>
        )}
        {storageError && <output className="kb-banner">{storageError}</output>}
        <div className="kb-toolbar kb-main-toolbar">
          <label>
            <span>Start from</span>
            <select
              aria-label="Start from"
              value=""
              onChange={(e) => {
                load(createPreset(e.target.value));
                setNotice('Template loaded. Undo restores your previous work.');
              }}
            >
              <option value="" disabled>Choose a template…</option>
              <option value="blank">Blank layout</option>
              {templates.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
          <label className="kb-file-button">
            <span>Import JSON</span>
            <input
              aria-label="Import keyboard JSON"
              type="file"
              accept=".json,.json5,application/json"
              onChange={(event) => {
                void importFile(event);
              }}
            />
          </label>
          <button
            type="button"
            disabled={!history.past.length}
            onClick={() => {
              setHistory(h => ({ past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] }));
              reset();
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!history.future.length}
            onClick={() => {
              setHistory(h => ({ past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) }));
              reset();
            }}
          >
            Redo
          </button>
          <button type="button" onClick={() => setJsonDraft(jsonDraft === null ? source : null)} aria-expanded={jsonDraft !== null}>Edit JSON</button>
          <span className="kb-toolbar-spacer" />
          <button type="button" onClick={() => setShare(!share)} aria-expanded={share}>Share your layout ↗</button>
          <button className="kb-primary" type="button" disabled={!!errors.length} onClick={download}>Download JSON ↓</button>
        </div>
        <output className="kb-notice">{notice || `${items.length} keys · ${populated(items).length} populated layers · ${draftStatus(ready, recovery, storageError)}`}</output>
        {share && (
          <section className="kb-panel kb-share" aria-label="Share your layout">
            <h2>Give someone a better keyboard.</h2>
            {contributionErrors.length > 0 && (
              <div className="kb-errors">
                <strong>Before contributing</strong>
                <ul>{contributionErrors.map(message => <li key={message}>{message}</li>)}</ul>
              </div>
            )}
            <p>Download your layout, then contribute the JSON file to the ConnectBot website repository. One file is all it takes.</p>
            <ol>
              <li>Give the layout a clear name and resolve any errors.</li>
              <li>
                <button type="button" disabled={!!errors.length} onClick={download}>
                  Download
                  {slugify(layout.name)}
                  .json
                </button>
              </li>
              <li>
                <a href="https://github.com/connectbot/connectbot.github.io/upload/develop/public/keyboards" target="_blank" rel="noreferrer">Upload the JSON on GitHub ↗</a>
                <span>, then follow GitHub’s prompts to fork and propose a pull request against</span>
                {' '}
                <code>develop</code>
                <span>.</span>
              </li>
            </ol>
            <p>
              <span>The gallery updates after your pull request is merged.</span>
              {' '}
              <a href="https://github.com/connectbot/connectbot.github.io/blob/develop/public/keyboards/README.md" target="_blank" rel="noreferrer">Contribution guide ↗</a>
            </p>
          </section>
        )}
        {!!errors.length && (
          <div className="kb-errors" role="alert">
            <strong>Resolve these before testing or exporting</strong>
            <ul>{errors.slice(0, 10).map(error => <li key={error}>{error}</li>)}</ul>
            {errors.length > 10 && (
              <p>
                And
                {errors.length - 10}
                {' '}
                more errors.
              </p>
            )}
          </div>
        )}
        {jsonDraft !== null && (
          <section className="kb-panel">
            <h2>Configuration JSON</h2>
            <p>JSON5 is accepted. Apply validates the structure; layout errors remain visible for correction. Downloads contain the selected layout and its referenced macros.</p>
            <label>
              <span>Keyboard JSON</span>
              <textarea aria-label="Keyboard JSON" className="kb-code" rows={16} value={jsonDraft} spellCheck={false} onChange={e => setJsonDraft(e.target.value)} />
            </label>
            <div className="kb-toolbar">
              <button
                type="button"
                className="kb-primary"
                onClick={() => {
                  try {
                    load(parseConfiguration(jsonDraft));
                    setNotice('JSON applied.');
                  } catch (e) {
                    setNotice(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Apply JSON
              </button>
              <button type="button" onClick={() => setJsonDraft(null)}>Close JSON editor</button>
            </div>
          </section>
        )}
        <div className="kb-workspace">
          <div className="kb-workspace-main">
            <section className="kb-panel kb-preview-panel" aria-label="Device preview">
              <div className="kb-panel-heading">
                <h2>Live preview</h2>
                <div className="kb-segment">
                  <button
                    type="button"
                    aria-pressed={mode === 'edit'}
                    onClick={() => {
                      setMode('edit');
                      reset();
                    }}
                  >
                    Edit keys
                  </button>
                  <button
                    type="button"
                    disabled={!!errors.length}
                    aria-pressed={mode === 'test'}
                    onClick={() => {
                      setMode('test');
                      setLayer(populated(items)[0] ?? 0);
                      reset();
                    }}
                  >
                    Test keyboard
                  </button>
                </div>
              </div>
              <div className="kb-preview-controls">
                <label>
                  <span>Device</span>
                  <select
                    aria-label="Device"
                    value={device}
                    onChange={(e) => {
                      const nextDevice = e.target.value as keyof typeof devices;
                      setDevice(nextDevice);
                      reset(nextDevice);
                    }}
                  >
                    {Object.keys(devices).map(d => <option key={d} value={d}>{d[0]!.toUpperCase() + d.slice(1)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Orientation</span>
                  <select
                    aria-label="Orientation"
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value as typeof orientation);
                      reset();
                    }}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <label>
                  <span>Preview theme</span>
                  <select aria-label="Preview theme" value={theme} onChange={e => setTheme(e.target.value)}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                {mobileDevice && (
                  <label className="kb-checkbox">
                    <input
                      type="checkbox"
                      checked={simulation.ime}
                      onChange={(e) => {
                        const ime = e.target.checked;
                        setSimulation(previous => ({ ...previous, ime }));
                      }}
                    />
                    <span>Show Google Keyboard</span>
                  </label>
                )}
                {device === 'custom' && (
                  <>
                    <Numeric
                      title="Viewport width"
                      value={custom[0]}
                      min={240}
                      max={3000}
                      onChange={(v) => {
                        setCustom([Math.max(240, Math.min(3000, v)), custom[1]]);
                        reset();
                      }}
                    />
                    <Numeric
                      title="Viewport height"
                      value={custom[1]}
                      min={240}
                      max={3000}
                      onChange={(v) => {
                        setCustom([custom[0], Math.max(240, Math.min(3000, v))]);
                        reset();
                      }}
                    />
                  </>
                )}
              </div>
              <div className="kb-layers" aria-label="Keyboard layers">
                {[0, 1, 2, 3, 4].map(l => (
                  <button
                    type="button"
                    key={l}
                    aria-pressed={layer === l}
                    onClick={() => {
                      setLayer(l);
                      setSelectedId(undefined);
                    }}
                  >
                    Layer
                    {l}
                    <span>{items.filter(i => i.layer === l).length}</span>
                  </button>
                ))}
              </div>
              <p className="kb-preview-caption">
                {width}
                {' '}
                ×
                {' '}
                {height}
                {' '}
                dp ·
                {' '}
                {Math.round(scale * 100)}
                % preview ·
                {' '}
                {layout.fitToWidth ? 'Fitted to width' : 'Fixed-size keys'}
                <span>{mode === 'edit' ? 'Click to edit · drag to an empty cell' : 'Click keys to test · actions appear below'}</span>
              </p>
              <div className="kb-stage" ref={stage}>
                <div className="kb-device-space" style={{ width: width * scale, height: height * scale }}>
                  <div className={`kb-device kb-theme-${theme}`} data-testid="device-preview" data-width={width} data-height={height} style={{ width, height, transform: `scale(${scale})` }}>
                    <div className="kb-terminal">
                      <div className="kb-terminal-top">
                        <span className="kb-terminal-dot" />
                        connectbot
                        {' '}
                        <span>— preview session</span>
                      </div>
                      <div className="kb-terminal-output">
                        <p className="kb-terminal-muted">A keyboard that works the way you do.</p>
                        <p>
                          <span className="kb-terminal-user">you@your-server</span>
                          <span>:~$</span>
                          {' '}
                          <span className="kb-cursor" />
                        </p>
                      </div>
                    </div>
                    <div className="kb-device-keyboard">
                      {!errors.length
                        ? (
                            <KeyboardCanvas
                              key={`${layout.id}:${device}:${orientation}:${mode}`}
                              layout={layout}
                              items={items}
                              macros={config.macros}
                              width={width}
                              maxHeight={consoleHeight / 2}
                              layer={layer}
                              editing={mode === 'edit'}
                              selectedId={selectedId}
                              testState={simulation}
                              onPress={press}
                              onMove={mode === 'edit'
                                ? (id, row, column) => {
                                    const item = items.find(i => i.id === id);
                                    if (item) {
                                      updateItem({ ...item, row, column }, true);
                                    }
                                  }
                                : undefined}
                            />
                          )
                        : <p className="kb-preview-invalid">Correct the layout errors to render this keyboard.</p>}
                    </div>
                    {imeHeight > 0 && <GoogleKeyboardPreview height={imeHeight} tablet={device === 'tablet'} />}
                  </div>
                </div>
              </div>
              <p className="kb-help">Sizes describe the app and input area. Google Keyboard is a visual approximation; its keys do not type. Colors use ConnectBot’s fallback theme; Android dynamic colors and fonts may differ.</p>
              {!!warn.length && (
                <details className="kb-warnings">
                  <summary>
                    {warn.length}
                    {' '}
                    preview notices
                  </summary>
                  <ul>{warn.map((message, i) => <li key={i}>{message}</li>)}</ul>
                </details>
              )}
            </section>
            {mode === 'test' && (
              <section className="kb-panel" aria-label="Test action log">
                <div className="kb-panel-heading">
                  <h2>Action log</h2>
                  <button type="button" onClick={() => reset()}>Reset test</button>
                </div>
                <p>{modifiers.map(m => `${m}: ${['off', 'one-shot', 'locked'][simulation.modifiers[m] ?? 0]}`).join(' · ')}</p>
                <p className="kb-help">Actions are logged locally. App controls are simulated; no connection or clipboard access is used.</p>
                <ol className="kb-action-log" aria-live="polite">{simulation.log.map((entry, i) => <li key={i}>{entry}</li>)}</ol>
                {!simulation.log.length && <p>Press a key to inspect its action.</p>}
              </section>
            )}
            <MacroLibrary config={config} onChange={commit} onAssign={selected ? assignMacro : undefined} />
          </div>
          <aside className="kb-sidebar">
            <section className="kb-panel" aria-label="Layout settings">
              <div className="kb-panel-heading">
                <h2>Your layout</h2>
                <span className="kb-tag">JSON v17</span>
              </div>
              {config.layouts.length > 1 && (
                <label>
                  <span>Imported layouts</span>
                  <select
                    aria-label="Imported layouts"
                    value={layout.id}
                    onChange={(e) => {
                      setLayoutId(e.target.value);
                      setSelectedId(undefined);
                      setLayer(populated(config.items.filter(i => i.layoutId === e.target.value))[0] ?? 0);
                      reset();
                    }}
                  >
                    {config.layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span>Layout name</span>
                <input value={layout.name} onChange={e => updateLayout({ name: e.target.value })} />
              </label>
              <div className="kb-fields">
                <Numeric title="Button width (dp)" value={layout.buttonWidth} min={1} step={0.5} onChange={buttonWidth => updateLayout({ buttonWidth })} />
                <Numeric title="Button height (dp)" value={layout.buttonHeight} min={1} step={0.5} onChange={buttonHeight => updateLayout({ buttonHeight })} />
              </div>
              <label className="kb-checkbox">
                <input type="checkbox" checked={layout.fitToWidth} onChange={e => updateLayout({ fitToWidth: e.target.checked })} />
                <span>Fit keyboard to width</span>
              </label>
              <p className="kb-help">The same physical grid is used in portrait and landscape.</p>
              <button className="kb-wide" type="button" onClick={() => addKey()}>
                + Add key to layer
                {layer}
              </button>
              <label>
                <span>Select a key</span>
                <select aria-label="Select a key" value={selected?.id ?? ''} onChange={e => setSelectedId(e.target.value || undefined)}>
                  <option value="">Choose a key…</option>
                  {items.filter(i => i.layer === layer).map(i => (
                    <option key={i.id} value={i.id}>
                      {label(i, config.macros)}
                      {' '}
                      ·
                      {' '}
                      {i.pinned ? 'pinned · ' : ''}
                      {i.row}
                      ,
                      {i.column}
                      {i.visible ? '' : ' · hidden'}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            {selected
              ? (
                  <Inspector
                    key={selected.id}
                    item={selected}
                    config={config}
                    onChange={updateItem}
                    onDuplicate={() => addKey(selected)}
                    onDelete={() => {
                      commit({ ...config, items: config.items.filter(i => i.id !== selected.id) });
                      setSelectedId(undefined);
                    }}
                  />
                )
              : (
                  <section className="kb-panel kb-select-prompt">
                    <span>↖</span>
                    <h2>Start with a key.</h2>
                    <p>Select a key in the preview to change its action, size, position, and appearance.</p>
                  </section>
                )}
            <section className="kb-panel kb-export-settings">
              <h2>Take it to ConnectBot</h2>
              <p>
                <span>Download the JSON, use</span>
                {' '}
                <strong>Import Hosts</strong>
                {' '}
                <span>in ConnectBot, then select it in</span>
                {' '}
                <strong>Settings → Terminal keyboard</strong>
                <span>.</span>
              </p>
              <details>
                <summary>Advanced export options</summary>
                <label className="kb-checkbox">
                  <input type="checkbox" checked={preserve} onChange={e => setPreserve(e.target.checked)} />
                  <span>Preserve UUIDs</span>
                </label>
                <p className="kb-help">Default: import as a new copy. ConnectBot skips UUIDs already on the device. Preserve identities for repository maintenance; existing records will not be updated.</p>
              </details>
            </section>
          </aside>
        </div>
      </fieldset>
    </div>
  );
}
