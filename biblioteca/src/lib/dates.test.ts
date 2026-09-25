import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, diffDays, dueLabel, formatDate, parseBRDate } from './dates.ts';

test('addDays atravessa meses e anos', () => {
  assert.equal(addDays('2026-09-25', 30), '2026-10-25');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('formatDate e parseBRDate são inversos', () => {
  assert.equal(formatDate('2026-09-25'), '25/09/2026');
  assert.equal(parseBRDate('25/09/2026'), '2026-09-25');
  assert.equal(parseBRDate('5/1/2026'), '2026-01-05');
  assert.equal(parseBRDate('31/02/2026'), null);
  assert.equal(parseBRDate('2026-09-25'), null);
});

test('dueLabel descreve o prazo', () => {
  assert.equal(diffDays('2026-09-25', '2026-09-20'), -5);
  assert.deepEqual(dueLabel('2026-09-20', '2026-09-25'), { text: '5 dias de atraso', late: true });
  assert.deepEqual(dueLabel('2026-09-24', '2026-09-25'), { text: '1 dia de atraso', late: true });
  assert.equal(dueLabel('2026-09-25', '2026-09-25').text, 'vence hoje');
  assert.equal(dueLabel('2026-09-26', '2026-09-25').text, 'vence amanhã');
  assert.equal(dueLabel('2026-10-10', '2026-09-25').text, 'vence em 10/10/2026');
  assert.equal(dueLabel(null).late, false);
});
