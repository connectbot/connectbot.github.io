'use client';

import type { GalleryEntry } from '@/keyboards/gallery';
import Link from 'next/link';
import { useState } from 'react';
import { populated, serialize, slugify } from '@/keyboards/model';
import { downloadJson } from './download';
import { KeyboardCanvas } from './KeyboardCanvas';
import './keyboard.css';

function emptyHeading(template: boolean, filtered: boolean): string {
  if (template) {
    return 'No matching templates.';
  }
  return filtered ? 'No matching community layouts.' : 'Your layout could be the first.';
}
export function KeyboardGallery({ entries }: Readonly<{ entries: GalleryEntry[] }>) {
  const [search, setSearch] = useState('');
  const [sizing, setSizing] = useState('all');
  const filtered = entries.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) && (sizing === 'all' || e.configuration.layouts[0]!.fitToWidth === (sizing === 'fitted')));
  const section = (template: boolean) => (
    <section className="kb-gallery-section" aria-label={template ? 'Built-in templates' : 'Community layouts'}>
      <div className="kb-section-title">
        <div>
          <span className="kb-eyebrow">{template ? 'A good starting point' : 'Made by the community'}</span>
          <h2>{template ? 'Familiar keys. Your arrangement.' : 'Find your next favorite.'}</h2>
        </div>
        <span className="kb-tag">
          {filtered.filter(e => e.template === template).length}
          {' '}
          layouts
        </span>
      </div>
      <div className="kb-cards">
        {filtered.filter(e => e.template === template).map((entry) => {
          const config = entry.configuration;
          const layout = config.layouts[0]!;
          const items = config.items.filter(i => i.layoutId === layout.id);
          const href = `/keyboards/editor/?${entry.template ? 'template' : 'layout'}=${entry.slug}`;
          return (
            <article className="kb-card" key={entry.slug}>
              <div className="kb-card-preview kb-theme-light" inert><KeyboardCanvas layout={layout} items={items} macros={config.macros} width={342} maxHeight={132} layer={populated(items)[0] ?? 0} /></div>
              <div className="kb-card-body">
                <div className="kb-panel-heading">
                  <h3>{entry.name}</h3>
                  <span className="kb-card-arrow">↗</span>
                </div>
                <p>{entry.description}</p>
                <div className="kb-card-facts">
                  <span>{layout.fitToWidth ? 'Fits to width' : 'Scrolls horizontally'}</span>
                  <span>
                    {populated(items).length}
                    {' '}
                    layers
                  </span>
                  <span>
                    {items.length}
                    {' '}
                    keys
                  </span>
                </div>
                <div className="kb-toolbar">
                  <Link className="kb-button kb-primary" href={href}>Customize layout</Link>
                  <button type="button" aria-label={`Download ${entry.name}`} onClick={() => downloadJson(serialize(config, layout.id, entry.template), `${slugify(entry.name)}.json`)}>JSON ↓</button>
                  {!entry.template && <a href={`https://github.com/connectbot/connectbot.github.io/blob/develop/public/keyboards/${entry.slug}.json`} target="_blank" rel="noreferrer">Source ↗</a>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.some(e => e.template === template) && (
        <div className="kb-gallery-empty">
          <h3>{emptyHeading(template, search !== '' || sizing !== 'all')}</h3>
          <p>{template ? 'Try another name or sizing filter.' : 'Build something that makes your terminal feel like home, then share it through a pull request.'}</p>
          {!template && <Link href="/keyboards/editor/" className="kb-button">Create a keyboard →</Link>}
        </div>
      )}
    </section>
  );
  return (
    <div className="kb-app kb-gallery">
      <div className="kb-gallery-hero">
        <div>
          <span className="kb-eyebrow">ConnectBot terminal keyboards</span>
          <h1>
            Your terminal.
            <br />
            <span>Your muscle memory.</span>
          </h1>
          <p>A little less reaching. A lot more flow. Find a keyboard you like, make it your own, and bring it into ConnectBot.</p>
          <div className="kb-toolbar">
            <Link href="/keyboards/editor/" className="kb-button kb-primary">Open keyboard editor →</Link>
            <a className="kb-button" href="#community">Browse community layouts ↓</a>
          </div>
        </div>
        <div className="kb-hero-preview">
          <div className="kb-terminal-mini">
            <span>you@your-server</span>
            :~$
            {' '}
            <span className="kb-cursor" />
          </div>
          <div className="kb-theme-light" inert><KeyboardCanvas layout={entries[1]!.configuration.layouts[0]!} items={entries[1]!.configuration.items} macros={entries[1]!.configuration.macros} width={342} maxHeight={120} layer={0} /></div>
          <p>A familiar home for your most-used keys.</p>
        </div>
      </div>
      <div className="kb-library-tools">
        <label>
          <span>Find a layout</span>
          <input type="search" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label>
          <span>Sizing</span>
          <select aria-label="Sizing" value={sizing} onChange={e => setSizing(e.target.value)}>
            <option value="all">All layouts</option>
            <option value="fitted">Fits to width</option>
            <option value="fixed">Fixed-size keys</option>
          </select>
        </label>
        <span>JSON files. No account required.</span>
      </div>
      {section(true)}
      <div id="community">{section(false)}</div>
      <section className="kb-contribute">
        <div>
          <span className="kb-eyebrow">Better together</span>
          <h2>
            Found your perfect layout?
            <br />
            Pass it on.
          </h2>
          <p>Community layouts live in this repository. Download your creation and propose a pull request with its JSON file. Once merged, it appears here automatically.</p>
        </div>
        <div className="kb-contribute-actions">
          <Link className="kb-button kb-primary" href="/keyboards/editor/">Create and share a layout →</Link>
          <a href="https://github.com/connectbot/connectbot.github.io/blob/develop/public/keyboards/README.md" target="_blank" rel="noreferrer">Read the contribution guide ↗</a>
        </div>
      </section>
      <section className="kb-gallery-help">
        <h2>From the browser to your terminal.</h2>
        <ol>
          <li>
            <strong>Pick a starting point.</strong>
            {' '}
            Customize a template, import your own JSON, or start with a blank grid.
          </li>
          <li>
            <strong>Try every screen.</strong>
            {' '}
            Preview phone, tablet, and desktop sizes in portrait and landscape.
          </li>
          <li>
            <strong>Bring it into ConnectBot.</strong>
            {' '}
            Download JSON, use Import Hosts, and select the layout in Settings → Terminal keyboard.
          </li>
        </ol>
        <p>Requires a ConnectBot build with configurable terminal keyboards (schema 17). Editing and file imports stay in your browser.</p>
      </section>
    </div>
  );
}
