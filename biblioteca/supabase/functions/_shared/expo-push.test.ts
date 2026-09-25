import assert from 'node:assert/strict';
import { test } from 'node:test';

import { expoMessages, invalidTokens } from './expo-push.ts';

test('uma mensagem por token, com a rota para abrir', () => {
  const messages = expoMessages(['ExponentPushToken[a]', 'ExponentPushToken[b]'], {
    title: 'Dom Casmurro está atrasado',
    body: 'João está com o livro há 3 dias além do combinado.',
    url: '/emprestados',
  });
  assert.equal(messages.length, 2);
  assert.equal(messages[1].to, 'ExponentPushToken[b]');
  assert.deepEqual(messages[0].data, { url: '/emprestados' });
});

test('só DeviceNotRegistered apaga o token', () => {
  assert.deepEqual(
    invalidTokens(['a', 'b', 'c'], [
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ]),
    ['b'],
  );
});
