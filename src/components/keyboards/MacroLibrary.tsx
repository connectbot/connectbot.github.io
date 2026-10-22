'use client';

/* eslint-disable react/no-array-index-key -- Each action is an inline controlled fieldset; ordering is the macro document order. */

import type { Action, Configuration, Macro } from '@/keyboards/model';
import JSON5 from 'json5';
import { useState } from 'react';
import { decodeMacro, encodeMacro, keys, modifiers, newId, object } from '@/keyboards/model';
import { downloadJson } from './download';

function actionSource(actions: Action[]): string {
  return JSON.stringify({ version: 1, actions }, null, 2);
}
function defaultAction(type: string): Action {
  if (type === 'text') {
    return { type: 'text', text: 'text' };
  }
  if (type === 'bytes') {
    return { type: 'bytes', hex: '1b' };
  }
  return { type: 'key', key: 'enter', modifiers: [] };
}
function MacroActionEditor({ action, index, count, onChange, onMove, onRemove }: Readonly<{
  action: Action;
  index: number;
  count: number;
  onChange: (action: Action) => void;
  onMove: (direction: number) => void;
  onRemove: () => void;
}>) {
  return (
    <fieldset className="kb-action">
      <legend>{`Action ${index + 1}`}</legend>
      <label>
        <span>Action type</span>
        <select aria-label="Action type" value={action.type} onChange={e => onChange(defaultAction(e.target.value))}>
          <option value="key">Key</option>
          <option value="text">Text</option>
          <option value="bytes">Raw bytes</option>
        </select>
      </label>
      {action.type === 'text' && (
        <label>
          <span>Text</span>
          <textarea aria-label="Text" value={action.text} onChange={e => onChange({ type: 'text', text: e.target.value })} />
        </label>
      )}
      {action.type === 'bytes' && (
        <label>
          <span>Hex bytes</span>
          <input value={action.hex} onChange={e => onChange({ type: 'bytes', hex: e.target.value })} />
        </label>
      )}
      {action.type === 'key' && (
        <>
          <label>
            <span>Key or character</span>
            <select
              aria-label="Key or character"
              value={action.character !== undefined ? 'character' : action.key}
              onChange={(e) => {
                const key = e.target.value === 'character' ? { character: 'a' } : { key: e.target.value };
                onChange({ type: 'key', ...key, modifiers: action.modifiers });
              }}
            >
              <option value="character">Unicode character</option>
              {keys.map(k => <option key={k}>{k}</option>)}
            </select>
          </label>
          {action.character !== undefined && (
            <label>
              <span>Character</span>
              <input value={action.character} onChange={e => onChange({ ...action, character: e.target.value })} />
            </label>
          )}
          <div className="kb-checks">
            {modifiers.map(m => (
              <label key={m}>
                <input
                  type="checkbox"
                  checked={action.modifiers.includes(m)}
                  onChange={(e) => {
                    const selected = e.target.checked ? [...action.modifiers, m] : action.modifiers.filter(v => v !== m);
                    onChange({ ...action, modifiers: selected });
                  }}
                />
                {m}
              </label>
            ))}
          </div>
        </>
      )}
      <div className="kb-toolbar">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>Move up</button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(1)}>Move down</button>
        <button type="button" onClick={onRemove}>Remove action</button>
      </div>
    </fieldset>
  );
}
export function MacroLibrary({ config, onChange, onAssign }: Readonly<{ config: Configuration; onChange: (config: Configuration) => void; onAssign?: (macro: Macro) => void }>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; source: string } | null>(null);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(false);
  const macro = config.macros.find(m => m.id === selected);
  let actions: Action[] | null = null;
  try {
    if (draft && !raw) {
      const root = object(JSON.parse(draft.source));
      if (Array.isArray(root.actions)) {
        actions = root.actions as Action[];
      }
    }
  } catch { /* Keep unsupported or invalid source editable. */ }
  const open = (value: Macro) => {
    setSelected(value.id);
    setDraft({ name: value.name, source: value.document });
    setError('');
    try {
      decodeMacro(value.document);
      setRaw(false);
    } catch {
      setRaw(true);
    }
  };
  const updateActions = (next: Action[]) => {
    setDraft(d => d ? { ...d, source: actionSource(next) } : d);
    setError('');
  };
  const save = () => {
    try {
      if (draft === null || draft.name.trim() === '') {
        throw new Error('Give the macro a name.');
      }
      const value = { id: selected ?? newId(), name: draft.name, document: encodeMacro(decodeMacro(draft.source)) };
      const shortcut = decodeMacro(value.document);
      // A labelled key becomes a general macro if its shared action changes.
      const singleKey = shortcut.length === 1 && shortcut[0]?.type === 'key' ? shortcut[0].key : undefined;
      onChange({ ...config, macros: macro ? config.macros.map(m => m.id === macro.id ? value : m) : [...config.macros, value], items: config.items.map(i => i.macroId === value.id && i.kind === 'key' && i.target !== singleKey ? { ...i, kind: 'macro', target: '' } : i) });
      setSelected(value.id);
      setDraft({ name: value.name, source: value.document });
      setError('Saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <section className="kb-panel kb-macros" aria-label="Shared macro library">
      <div className="kb-panel-heading">
        <h2>Shared macros</h2>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setDraft({ name: 'My macro', source: actionSource([{ type: 'key', key: 'enter', modifiers: [] }]) });
            setRaw(false);
            setError('');
          }}
        >
          + New macro
        </button>
      </div>
      <p>Named actions can be shared by several keys. Saving edits updates every key that uses this macro in your draft.</p>
      <div className="kb-macro-list">
        {config.macros.map(m => (
          <button type="button" key={m.id} aria-pressed={selected === m.id} onClick={() => open(m)}>
            {m.name}
            <small>
              {config.items.filter(i => i.macroId === m.id).length}
              {' '}
              keys
            </small>
          </button>
        ))}
      </div>
      <label className="kb-file-button">
        <span>Import macro</span>
        <input
          type="file"
          accept=".json,.json5,application/json"
          onChange={(event) => {
            void (async () => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              try {
                if (file.size > 8 * 1024 * 1024) {
                  throw new Error('Macro file exceeds 8 MiB.');
                }
                const value = object(JSON5.parse(await file.text()));
                if (Object.keys(value).some(k => !['version', 'name', 'actions'].includes(k)) || typeof value.name !== 'string' || !value.name.trim()) {
                  throw new Error('Expected a named ConnectBot macro file.');
                }
                const source = JSON.stringify({ version: value.version, actions: value.actions });
                decodeMacro(source);
                setSelected(null);
                setDraft({ name: value.name, source });
                setRaw(false);
                setError('Review the imported macro, then save it.');
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
              event.target.value = '';
            })();
          }}
        />
      </label>
      {draft && (
        <div className="kb-macro-editor">
          <label>
            <span>Macro name</span>
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div className="kb-toolbar">
            <button
              type="button"
              aria-pressed={!raw}
              onClick={() => {
                try {
                  decodeMacro(draft.source);
                  setRaw(false);
                  setError('');
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Visual actions
            </button>
            <button type="button" aria-pressed={raw} onClick={() => setRaw(true)}>Macro JSON</button>
          </div>
          {raw || !actions
            ? (
                <label>
                  <span>Macro document</span>
                  <textarea aria-label="Macro document" className="kb-code" rows={9} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} />
                </label>
              )
            : (
                <>
                  {actions.map((action, index) => (
                    <MacroActionEditor
                      key={index}
                      action={action}
                      index={index}
                      count={actions.length}
                      onChange={value => updateActions(actions.map((a, i) => i === index ? value : a))}
                      onMove={(direction) => {
                        const next = [...actions];
                        const destination = index + direction;
                        [next[index], next[destination]] = [next[destination]!, next[index]!];
                        updateActions(next);
                      }}
                      onRemove={() => updateActions(actions.filter((_, i) => i !== index))}
                    />
                  ))}
                  <button type="button" disabled={actions.length >= 256} onClick={() => updateActions([...actions, { type: 'key', key: 'enter', modifiers: [] }])}>+ Add action</button>
                  {!actions.length && <p>Add an action before saving.</p>}
                </>
              )}
          <div className="kb-toolbar">
            <button className="kb-primary" type="button" onClick={save}>Save macro</button>
            {macro && (
              <button
                type="button"
                onClick={() => {
                  try {
                    downloadJson(JSON.stringify({ version: 1, name: macro.name, actions: decodeMacro(macro.document) }, null, 2), 'macro.json');
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Export macro
              </button>
            )}
            {macro && onAssign && <button type="button" onClick={() => onAssign(macro)}>Assign to selected key</button>}
            {macro && (
              <button
                type="button"
                disabled={config.items.some(i => i.macroId === macro.id)}
                onClick={() => {
                  onChange({ ...config, macros: config.macros.filter(m => m.id !== macro.id) });
                  setDraft(null);
                  setSelected(null);
                }}
              >
                Delete macro
              </button>
            )}
          </div>
          <output>{error}</output>
          {macro && config.items.some(i => i.macroId === macro.id) && <p>Remove or reassign its keys before deleting this macro.</p>}
        </div>
      )}
      {!draft && !config.macros.length && <p>No macros yet. Create a named shortcut or a sequence of actions.</p>}
    </section>
  );
}
