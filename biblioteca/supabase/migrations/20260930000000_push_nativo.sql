-- =============================================================================
-- Fase 5 — Notificações no app das lojas: tokens do Expo Push ficam na mesma
-- tabela das inscrições Web Push (kind = 'expo'), e o loan-reminders envia
-- para os dois tipos.
-- =============================================================================

alter table public.push_subscriptions
  add column kind text not null default 'web' check (kind in ('web', 'expo')),
  alter column p256dh drop not null,
  alter column auth drop not null,
  add constraint push_subscriptions_web_keys check (kind <> 'web' or (p256dh is not null and auth is not null));

create or replace function public.save_expo_push_token(p_token text, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, kind, user_agent)
  values ((select auth.uid()), p_token, 'expo', p_platform)
  on conflict (endpoint) do update
  set user_id = excluded.user_id, kind = 'expo', user_agent = excluded.user_agent;
end;
$$;

revoke all on function public.save_expo_push_token(text, text) from public, anon;
grant execute on function public.save_expo_push_token(text, text) to authenticated;
