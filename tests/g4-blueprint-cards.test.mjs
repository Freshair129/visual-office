import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {OfficeBlueprintPanel} from '../web/office-blueprint-panel.js';

test('blueprint cards are named by their visible text, not by the thumbnail drawing', () => {
  const dom = new JSDOM('<main></main>');
  const root = dom.window.document.querySelector('main');
  new OfficeBlueprintPanel(root, {});
  const cards = [...root.querySelectorAll('.hy-blueprint-cards button')];
  assert.ok(cards.length > 0);
  for (const card of cards) {
    const svg = card.querySelector('svg');
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
    assert.equal(svg.getAttribute('focusable'), 'false');
    assert.ok(card.querySelector('strong').textContent.trim());
  }
  // The full plan outside the cards stays an image with its own name.
  const plan = root.querySelector('.hy-blueprint-plan svg');
  if (plan) assert.equal(plan.getAttribute('aria-hidden'), null);
  dom.window.close();
});
