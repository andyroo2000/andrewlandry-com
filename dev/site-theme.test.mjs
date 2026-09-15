import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../src/scripts/site-theme.js', import.meta.url), 'utf8');

class Control {
  attributes = {};
  hidden = true;
  setAttribute(name, value) { this.attributes[name] = value; }
  closest(selector) { return selector === '[data-theme-toggle]' ? this : null; }
}

function eventTarget() {
  const handlers = new Map();
  return {
    addEventListener(type, callback) {
      const listeners = handlers.get(type) ?? [];
      handlers.set(type, [...listeners, callback]);
    },
    dispatchEvent(event) { handlers.get(event.type)?.forEach(callback => callback(event)); },
  };
}

function cookieJar(initial, blocked) {
  let value = initial;
  const writes = [];
  return {
    writes,
    get value() {
      if (blocked === 'throw') throw new Error('Cookies unavailable');
      return value;
    },
    set value(next) {
      if (blocked === 'throw') throw new Error('Cookies unavailable');
      if (blocked === 'silent') return;
      writes.push(next);
      value = next.split(';')[0];
    },
  };
}

function createPage({ dark = false, saved = '', protocol = 'https:', blocked } = {}) {
  const button = new Control();
  const meta = new Control();
  const jar = cookieJar(saved, blocked);
  const document = Object.assign(eventTarget(), {
    documentElement: { dataset: {} }, hidden: false,
    querySelectorAll: () => [button], querySelector: () => meta,
  });
  Object.defineProperty(document, 'cookie', { get: () => jar.value, set: value => { jar.value = value; } });
  const window = eventTarget();
  const device = Object.assign(eventTarget(), { matches: dark });
  runInNewContext(script, {
    document, window, matchMedia: () => device, location: { protocol }, Element: Control,
    CustomEvent: class { constructor(type) { this.type = type; } },
  });
  const click = () => document.dispatchEvent({ type: 'click', target: button });
  return { document, window, device, button, meta, jar, click };
}

test('a new visitor follows the device theme without writing a preference cookie', () => {
  for (const dark of [true, false]) {
    const page = createPage({ dark });
    assert.equal(page.document.documentElement.dataset.theme, dark ? 'dark' : 'light');
    assert.equal(page.button.attributes['aria-pressed'], String(dark));
    assert.equal(page.button.hidden, false);
    assert.equal(page.jar.writes.length, 0);
    page.device.matches = !dark;
    page.device.dispatchEvent({ type: 'change' });
    assert.equal(page.document.documentElement.dataset.theme, dark ? 'light' : 'dark');
  }
});

test('a saved light or dark choice overrides the device on a fresh page', () => {
  for (const theme of ['light', 'dark']) {
    const page = createPage({ dark: theme !== 'dark', saved: `another=value; al-theme=${theme}; last=value` });
    assert.equal(page.document.documentElement.dataset.theme, theme);
    assert.equal(page.jar.writes.length, 0);
  }
});

test('unrecognized or malformed cookies do not become theme values', () => {
  for (const saved of ['al-theme=%invalid', 'al-theme=system', 'not-al-theme=dark', 'al-theme=darkness']) {
    assert.equal(createPage({ saved }).document.documentElement.dataset.theme, 'light');
  }
});

test('an explicit choice persists for a year across paths and subsequent page loads', () => {
  const page = createPage();
  page.click();
  assert.equal(page.jar.writes[0], 'al-theme=dark; Max-Age=31536000; Path=/; SameSite=Lax; Secure');
  assert.equal(page.meta.attributes.content, '#101835');
  assert.equal(createPage({ saved: page.jar.value }).document.documentElement.dataset.theme, 'dark');
  page.device.dispatchEvent({ type: 'change' });
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  page.click();
  assert.equal(page.button.attributes['aria-pressed'], 'false');
  assert.equal(createPage({ dark: true, saved: page.jar.value }).document.documentElement.dataset.theme, 'light');
});

test('local HTTP previews can save the cookie too', () => {
  const page = createPage({ protocol: 'http:' });
  page.click();
  assert.equal(page.jar.writes[0].includes('Secure'), false);
});

test('returning to an open page picks up a choice made on another page', () => {
  const page = createPage();
  page.jar.value = 'al-theme=dark';
  page.window.dispatchEvent({ type: 'pageshow' });
  assert.equal(page.button.attributes['aria-pressed'], 'true');
  page.jar.value = 'al-theme=light';
  page.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(page.button.attributes['aria-pressed'], 'false');
});

test('blocked cookies do not stop toggling or lose the choice on the current page', () => {
  for (const blocked of ['throw', 'silent']) {
    const page = createPage({ blocked });
    page.click();
    page.window.dispatchEvent({ type: 'pageshow' });
    assert.equal(page.document.documentElement.dataset.theme, 'dark');
    page.click();
    assert.equal(page.document.documentElement.dataset.theme, 'light');
  }
});

test('theme changes notify the visualizer, while unrelated clicks do nothing', () => {
  const page = createPage();
  let redraws = 0;
  page.document.addEventListener('site-theme-change', () => { redraws += 1; });
  page.document.dispatchEvent({ type: 'click', target: {} });
  page.window.dispatchEvent({ type: 'pageshow' });
  assert.equal(redraws, 0);
  page.click();
  assert.equal(redraws, 1);
  page.click();
  assert.equal(redraws, 2);
});
