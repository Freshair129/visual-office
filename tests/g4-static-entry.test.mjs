import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const entries = ['index.html', 'character-lab.html', 'tools/office-prop-baker.html', 'tools/marketing-preview.html', 'tools/marketing-controls.html'];
const source = name => readFile(new URL(`../web/${name}`, import.meta.url), 'utf8');

function accessibleName(element) {
  const label = element.getAttribute('aria-label')?.trim();
  if (label) return label;
  const ids = element.getAttribute('aria-labelledby')?.trim().split(/\s+/);
  if (ids?.length) return ids.map(id => element.ownerDocument.getElementById(id)?.textContent.trim() || '').join(' ').trim();
  if (element.labels?.length) return [...element.labels].map(item => item.textContent.trim()).join(' ').trim();
  if (element.matches('input[type=button],input[type=submit],input[type=reset]')) return element.value;
  if (element.matches('button,a')) return element.textContent.trim() || [...element.querySelectorAll('img[alt]')].map(image => image.alt).join(' ').trim();
  return '';
}

test('static HTML entries have named controls, named dialogs and no positive tabindex', async () => {
  for (const name of entries) {
    const doc = new JSDOM(await source(name)).window.document;
    assert.ok(doc.documentElement.lang.trim(), name);
    for (const element of doc.querySelectorAll('button,a,input,select,textarea')) {
      assert.ok(accessibleName(element), `${name}: unnamed ${element.outerHTML}`);
      if (element.matches('button,a') && !/[\p{L}\p{N}]/u.test(element.textContent)) {
        assert.ok(element.getAttribute('aria-label')?.trim(), `${name}: icon-only ${element.outerHTML}`);
      }
    }
    for (const element of doc.querySelectorAll('[tabindex]')) assert.ok(Number(element.getAttribute('tabindex')) <= 0, `${name}: positive tabindex`);
    for (const dialog of doc.querySelectorAll('dialog,[role=dialog]')) {
      assert.ok(accessibleName(dialog), `${name}: unnamed dialog`);
      if (dialog.tagName !== 'DIALOG') assert.equal(dialog.getAttribute('aria-modal'), 'true', name);
    }
  }
});

test('literal dialog templates have an explicit name', async () => {
  for (const name of ['building-view.js', 'lobby-view.js', 'hybrid-studio.js', 'native-studio.js', 'tycoon-view.js']) {
    const code = await source(name);
    const tags = [...code.matchAll(/<dialog\b[^>]*>/g)];
    assert.ok(tags.length, name);
    for (const [tag] of tags) assert.match(tag, /\baria-label(?:ledby)?\s*=\s*["'][^"']+["']/, `${name}: ${tag}`);
  }
});

test('Lab canvas points to current status and keyboard controls', async () => {
  const doc = new JSDOM(await source('character-lab.html')).window.document;
  const ids = doc.querySelector('#stage').getAttribute('aria-describedby').split(/\s+/);
  for (const id of ids) assert.ok(doc.getElementById(id), `missing ${id}`);
  assert.equal(doc.querySelector('#status').getAttribute('role'), 'status');
  assert.ok(doc.querySelector('[data-view]'));
  assert.ok(doc.querySelector('[data-action]'));
  const css = await source('character-lab.css');
  assert.match(css, /@media\(max-width:650px\)\{button,#download,select\{min-width:44px;min-height:44px\}\}/);
  assert.match(css, /input:focus-visible,select:focus-visible/);
});

test('selected workspace text and control-border token pairs meet contrast thresholds', async () => {
  const css = await source('tokens.css');
  const declarations = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)].map(([, key, value]) => [key, value.trim()]));
  function color(name) {
    const value = declarations.get(name);
    assert.ok(value, `missing token ${name}`);
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    if (alias) return color(alias[1]);
    assert.match(value, /^#[\da-f]{6}$/i, `${name} must be an opaque RGB token`);
    return value;
  }
  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  }
  function ratio(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + .05) / (values[1] + .05);
  }
  for (const [foreground, background, minimum] of [
    ['--ink', '--brand', 4.5], ['--ink', '--brand-hover', 4.5],
    ['--text-primary', '--bg-surface', 4.5], ['--text-secondary', '--bg-surface', 4.5],
    ['--border-strong', '--bg-surface', 3],
  ]) assert.ok(ratio(color(foreground), color(background)) >= minimum, `${foreground} / ${background}`);
  const shell = await source('office-workspace.css');
  assert.match(shell, /\.primary-button\{color:var\(--ink\)\}/);
  assert.match(shell, /\.secondary-button,\.quiet-button,\.icon-button,\.more-dialog-menu button\{border-color:var\(--border-strong\)\}/);
  // Workspace surfaces override the white base token with this warm panel.
  const panel = /--office-panel\s*:\s*(#[\da-f]{6})/i.exec(shell)?.[1];
  assert.ok(panel);
  assert.ok(ratio(color('--border-strong'), panel) >= 3);
});
