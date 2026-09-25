/**
 * Envia lembretes de devolução por Web Push. Chamada uma vez por dia pelo
 * Supabase Cron (ver README), com o cabeçalho `x-cron-secret`.
 *
 * Quem recebe: quem registrou o empréstimo (loans.created_by) ou, na falta, o
 * dono da biblioteca. Inscrições expiradas (404/410) são apagadas.
 *
 * Segredos: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * (mailto:voce@exemplo.com). Fuso: REMINDERS_TIMEZONE (padrão America/Sao_Paulo).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

import { json } from '../_shared/cors.ts';
import { reminderMessage, shouldRemind, todayIn } from '../_shared/reminders.ts';

type DueLoan = {
  id: string;
  borrower_name: string;
  due_at: string | null;
  returned_at: string | null;
  last_reminded_on: string | null;
  created_by: string | null;
  library: { owner_id: string } | null;
  copy: { book: { title: string } | null } | null;
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const today = todayIn(Deno.env.get('REMINDERS_TIMEZONE') ?? 'America/Sao_Paulo');

  const { data, error } = await admin
    .from('loans')
    .select(
      'id, borrower_name, due_at, returned_at, last_reminded_on, created_by, library:libraries(owner_id), copy:copies(book:books(title))',
    )
    .is('returned_at', null)
    .lte('due_at', today);
  if (error) return json({ error: error.message }, 500);

  const loans = ((data ?? []) as unknown as DueLoan[]).filter((loan) => shouldRemind(loan, today));
  let sent = 0;

  for (const loan of loans) {
    const userId = loan.created_by ?? loan.library?.owner_id;
    if (!userId || !loan.due_at) continue;

    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    const message = reminderMessage(
      loan.copy?.book?.title ?? 'Um livro',
      loan.borrower_name,
      loan.due_at,
      today,
    );

    for (const sub of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...message, tag: `loan-${loan.id}` }),
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('push failed', status, err);
        }
      }
    }

    await admin.from('loans').update({ last_reminded_on: today }).eq('id', loan.id);
  }

  return json({ today, loans: loans.length, sent });
});
