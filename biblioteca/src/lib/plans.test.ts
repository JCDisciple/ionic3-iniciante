import assert from 'node:assert/strict';
import { test } from 'node:test';

import { periodOf, planLimitError, sortOffers, usageLevel } from './plans.ts';

test('reconhece erros de limite vindos do banco', () => {
  assert.equal(planLimitError(new Error('plan_limit_books')), 'books');
  assert.equal(planLimitError({ message: 'P0001: plan_limit_members' }), 'members');
  assert.equal(planLimitError(new Error('outra coisa')), null);
  assert.equal(planLimitError(null), null);
});

test('tipos de pacote das lojas e da web', () => {
  assert.equal(periodOf('ANNUAL'), 'annual');
  assert.equal(periodOf('$rc_annual'), 'annual');
  assert.equal(periodOf('MONTHLY'), 'monthly');
  assert.equal(periodOf('$rc_lifetime'), 'other');
  assert.deepEqual(
    sortOffers([{ period: 'monthly' }, { period: 'other' }, { period: 'annual' }]).map(
      (o) => o.period,
    ),
    ['annual', 'monthly', 'other'],
  );
});

test('uso do limite', () => {
  assert.deepEqual(usageLevel(150, 300), { fraction: 0.5, nearLimit: false });
  assert.deepEqual(usageLevel(280, 300), { fraction: 280 / 300, nearLimit: true });
  assert.deepEqual(usageLevel(5000, null), { fraction: null, nearLimit: false });
});
