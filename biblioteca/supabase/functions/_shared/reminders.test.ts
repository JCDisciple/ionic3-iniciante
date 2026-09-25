import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysBetween, reminderMessage, shouldRemind, todayIn } from './reminders.ts';

const base = { returned_at: null, last_reminded_on: null };

test('todayIn usa o fuso informado', () => {
  const now = new Date('2026-09-25T02:00:00Z'); // 23h do dia 24 em São Paulo
  assert.equal(todayIn('America/Sao_Paulo', now), '2026-09-24');
  assert.equal(todayIn('UTC', now), '2026-09-25');
});

test('lembra no dia da devolução e a cada 7 dias de atraso', () => {
  assert.equal(shouldRemind({ ...base, due_at: '2026-09-26' }, '2026-09-25'), false);
  assert.equal(shouldRemind({ ...base, due_at: '2026-09-25' }, '2026-09-25'), true);
  assert.equal(
    shouldRemind({ ...base, due_at: '2026-09-20', last_reminded_on: '2026-09-20' }, '2026-09-25'),
    false,
  );
  assert.equal(
    shouldRemind({ ...base, due_at: '2026-09-18', last_reminded_on: '2026-09-18' }, '2026-09-25'),
    true,
  );
  assert.equal(shouldRemind({ ...base, due_at: null }, '2026-09-25'), false);
  assert.equal(
    shouldRemind({ ...base, due_at: '2026-09-01', returned_at: '2026-09-02' }, '2026-09-25'),
    false,
  );
});

test('mensagem diferencia vencimento e atraso', () => {
  assert.equal(daysBetween('2026-09-20', '2026-09-25'), 5);
  assert.match(
    reminderMessage('Dom Casmurro', 'João', '2026-09-25', '2026-09-25').title,
    /Hoje é dia de João/,
  );
  assert.match(
    reminderMessage('Dom Casmurro', 'João', '2026-09-24', '2026-09-25').body,
    /1 dia além/,
  );
});
