/**
 * Webhook do RevenueCat (Project settings → Integrations → Webhooks).
 * Configure o cabeçalho Authorization com o mesmo valor do segredo
 * REVENUECAT_WEBHOOK_AUTH. Grava a assinatura em public.subscriptions e
 * recalcula o plano das bibliotecas do dono (public.sync_plan_for_user).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { affectedUsers, subscriptionChange, type RevenueCatEvent } from '../_shared/billing.ts';
import { json } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }

  let event: RevenueCatEvent;
  try {
    event = ((await req.json()) as { event: RevenueCatEvent }).event;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!event?.type) return json({ error: 'invalid_event' }, 400);

  const change = subscriptionChange(event);
  if (change) {
    const { error } = await admin.from('subscriptions').upsert(
      {
        user_id: change.userId,
        provider: change.provider,
        product_id: change.productId,
        status: change.status,
        expires_at: change.expiresAt,
        environment: change.environment,
        last_event: change.lastEvent,
      },
      { onConflict: 'user_id,provider,product_id' },
    );
    if (error) {
      console.error(error);
      return json({ error: 'db_error' }, 500); // RevenueCat tenta de novo
    }
  }

  const plans: Record<string, string> = {};
  for (const userId of affectedUsers(event)) {
    const { data } = await admin.rpc('sync_plan_for_user', { p_user_id: userId });
    plans[userId] = data as string;
  }
  return json({ ok: true, type: event.type, plans });
});
