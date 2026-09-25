import assert from 'node:assert/strict';
import { test } from 'node:test';

import { affectedUsers, providerOf, subscriptionChange, supabaseUserId } from './billing.ts';

const USER = '11111111-1111-1111-1111-111111111111';

test('compra inicial vira assinatura ativa com vencimento', () => {
  assert.deepEqual(
    subscriptionChange({
      type: 'INITIAL_PURCHASE',
      app_user_id: USER,
      product_id: 'pro_anual',
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      expiration_at_ms: Date.UTC(2027, 8, 25),
    }),
    {
      userId: USER,
      provider: 'app_store',
      productId: 'pro_anual',
      status: 'active',
      expiresAt: '2027-09-25T00:00:00.000Z',
      environment: 'production',
      lastEvent: 'INITIAL_PURCHASE',
    },
  );
});

test('cancelamento e problema de cobrança mantêm até expirar; expiração encerra', () => {
  const base = { app_user_id: USER, product_id: 'pro_mensal', store: 'PLAY_STORE' };
  assert.equal(subscriptionChange({ ...base, type: 'CANCELLATION' })!.status, 'cancelled');
  assert.equal(subscriptionChange({ ...base, type: 'BILLING_ISSUE' })!.status, 'billing_issue');
  assert.equal(subscriptionChange({ ...base, type: 'EXPIRATION' })!.status, 'expired');
  assert.equal(subscriptionChange({ ...base, type: 'TEST' }), null);
});

test('id anônimo do RevenueCat é ignorado; alias com o id do Supabase vale', () => {
  assert.equal(supabaseUserId({ type: 'X', app_user_id: '$RCAnonymousID:abc' }), null);
  assert.equal(supabaseUserId({ type: 'X', app_user_id: '$RCAnonymousID:abc', aliases: ['$RC:x', USER] }), USER);
});

test('web (Stripe / RevenueCat Billing), sandbox e transferência', () => {
  assert.equal(providerOf('RC_BILLING'), 'stripe');
  assert.equal(providerOf('STRIPE'), 'stripe');
  assert.equal(
    subscriptionChange({ type: 'RENEWAL', app_user_id: USER, product_id: 'p', environment: 'SANDBOX' })!.environment,
    'sandbox',
  );
  const other = '22222222-2222-2222-2222-222222222222';
  assert.deepEqual(affectedUsers({ type: 'TRANSFER', transferred_from: [USER], transferred_to: [other, '$RCAnonymousID:x'] }), [USER, other]);
});
