import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizePhone, reminderText, whatsappUrl } from './whatsapp.ts';

test('normalizePhone adiciona 55 a números brasileiros', () => {
  assert.equal(normalizePhone('(11) 98765-4321'), '5511987654321');
  assert.equal(normalizePhone('+55 21 3333-4444'), '552133334444');
  assert.equal(normalizePhone('+1 415 555 0100'), '14155550100');
  assert.equal(normalizePhone('1234'), null);
});

test('reminderText usa o primeiro nome e o título', () => {
  const text = reminderText({
    borrower: 'João Silva',
    title: 'Dom Casmurro',
    lentAt: '2026-08-01',
    dueAt: '2026-09-01',
  });
  assert.match(text, /^Oi, João!/);
  assert.match(text, /“Dom Casmurro”/);
  assert.match(text, /01\/09\/2026/);
});

test('whatsappUrl codifica a mensagem', () => {
  assert.equal(
    whatsappUrl('11987654321', 'Oi & tchau'),
    'https://wa.me/5511987654321?text=Oi%20%26%20tchau',
  );
  assert.equal(whatsappUrl(null, 'x'), 'https://wa.me/?text=x');
});
