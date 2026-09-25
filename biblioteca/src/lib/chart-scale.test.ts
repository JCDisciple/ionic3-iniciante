import assert from 'node:assert/strict';
import { test } from 'node:test';

import { luminance, niceScale } from './chart-scale.ts';

test('niceScale arredonda o topo e os ticks', () => {
  assert.deepEqual(niceScale(7), { top: 8, ticks: [0, 2, 4, 6, 8] });
  assert.deepEqual(niceScale(3), { top: 3, ticks: [0, 1, 2, 3] });
  assert.deepEqual(niceScale(1), { top: 1, ticks: [0, 1] });
  assert.deepEqual(niceScale(1840), { top: 2000, ticks: [0, 500, 1000, 1500, 2000] });
  assert.deepEqual(niceScale(0), { top: 1, ticks: [0, 1] });
});

test('luminance distingue cores claras e escuras', () => {
  assert.ok(luminance('#ffffff') > 0.9);
  assert.ok(luminance('#A84C25') < 0.2);
  assert.ok(luminance('#1baf7a') > 0.3);
});
