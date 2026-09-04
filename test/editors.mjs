/**
 * Verifies the Lovelace visual-editor contract for every registered card.
 *
 * For each entry in `window.customCards` this loads the built bundle in a real
 * browser and checks that:
 *   - the card exposes a static `getConfigElement()`
 *   - the element it returns is actually registered
 *   - that element implements `setConfig(config)` — the method HA calls
 *   - it renders an `ha-form` fed with the config and a resolvable label per field
 *   - a form change comes back out as a single bubbling `config-changed`, with
 *     `type` preserved, cleared fields dropped, and `value-changed` contained
 *   - the card's own `setConfig` accepts whatever the editor emitted
 *
 * Run `npm run build` first. Chromium is resolved from CHROME_PATH, then the
 * usual CI and macOS locations.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));

const PAGE = `<!doctype html><meta charset="utf-8"><body>
<script type="module">
  // Minimal stand-in for HA's ha-form: records whatever the editor hands it.
  class HaFormStub extends HTMLElement {
    set hass(v) { this._hass = v; }
    set data(v) { this._data = v; }
    set schema(v) { this._schema = v; }
    set computeLabel(v) { this._computeLabel = v; }
    set computeHelper(v) { this._computeHelper = v; }
  }
  customElements.define('ha-form', HaFormStub);
  window.__ready = import('/dist/custom-ha-cards.js');
</script></body>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(PAGE);
  }
  const p = path.join(root, url);
  if (!p.startsWith(root) || !fs.existsSync(p)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}/`);
await page.evaluate(() => window.__ready);

const results = await page.evaluate(async () => {
  const hass = { states: {}, callService: async () => {}, formatEntityState: () => '' };
  const out = [];

  for (const meta of window.customCards ?? []) {
    const row = { type: meta.type };
    try {
      const cls = customElements.get(meta.type);
      if (!cls) throw new Error('card element not registered');
      if (typeof cls.getConfigElement !== 'function') throw new Error('no static getConfigElement');

      const el = cls.getConfigElement();
      if (!customElements.get(el.localName)) {
        throw new Error(`editor element <${el.localName}> not registered`);
      }
      if (typeof el.setConfig !== 'function') throw new Error('editor has no setConfig()');

      const stub = { type: meta.type, ...(cls.getStubConfig?.() ?? {}) };
      el.hass = hass;
      document.body.appendChild(el);
      el.setConfig(stub);
      await el.updateComplete;

      const form = el.shadowRoot?.querySelector('ha-form');
      if (!form) throw new Error('no ha-form rendered');
      if (JSON.stringify(form._data) !== JSON.stringify(stub)) {
        throw new Error('ha-form did not receive the config');
      }

      row.fields = (form._schema ?? []).flatMap((s) =>
        s.type === 'grid' ? s.schema.map((x) => x.name) : [s.name],
      );
      const unlabelled = row.fields.filter((n) => !form._computeLabel?.({ name: n }));
      if (unlabelled.length) throw new Error(`no label for ${unlabelled.join(', ')}`);

      const emitted = [];
      el.addEventListener('config-changed', (ev) => emitted.push(ev.detail.config));
      let leaked = false;
      document.body.addEventListener('value-changed', () => (leaked = true), { once: true });
      form.dispatchEvent(
        new CustomEvent('value-changed', {
          detail: { value: { ...stub, name: 'Edited', _cleared: '' } },
          bubbles: true,
          composed: true,
        }),
      );
      if (emitted.length !== 1) throw new Error(`emitted ${emitted.length} config-changed events`);
      const next = emitted[0];
      if (next.name !== 'Edited') throw new Error('edit was not applied');
      if ('_cleared' in next) throw new Error('cleared field was not pruned');
      if (next.type !== meta.type) throw new Error('type key was lost');
      if (leaked) throw new Error('value-changed escaped the editor');

      // The card must accept what its own editor produces.
      document.createElement(meta.type).setConfig(next);

      el.remove();
      row.ok = true;
    } catch (err) {
      row.ok = false;
      row.error = String(err.message ?? err);
    }
    out.push(row);
  }

  // A config the form cannot represent must make setConfig throw, which is how
  // HA is told to fall back to the YAML editor.
  const guarded = { type: 'custom-status-card' };
  try {
    const el = customElements.get('custom-status-card').getConfigElement();
    el.setConfig({
      type: 'custom-status-card',
      entities: [{ entity: 'binary_sensor.leak', attention_state: 'on' }],
    });
    guarded.ok = false;
    guarded.error = 'per-entity overrides were accepted instead of falling back to YAML';
  } catch {
    guarded.ok = true;
    guarded.fields = [];
    guarded.note = 'object entities fall back to YAML';
  }
  out.push(guarded);

  return out;
});

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(
    `${r.ok ? 'PASS' : 'FAIL'}  ${r.type.padEnd(34)} ` +
      (r.ok ? (r.note ?? `${r.fields.length} fields`) : r.error),
  );
}
console.log(`\n${results.length - failed}/${results.length} editors pass`);
if (errors.length) console.log('page errors:\n' + errors.join('\n'));

await browser.close();
server.close();
process.exit(failed || errors.length || !results.length ? 1 : 0);
