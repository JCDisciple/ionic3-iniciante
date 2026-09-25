-- =============================================================================
-- Fase 5 — Planos pagos e limites por plano.
-- O plano é da biblioteca (libraries.plan) e vem da assinatura do DONO,
-- sincronizada pelo webhook do RevenueCat (Edge Function billing-webhook),
-- que unifica App Store, Google Play e a cobrança na web (Stripe).
-- =============================================================================

-- Limites editáveis sem deploy (SQL Editor). null = ilimitado.
create table public.plans (
  id public.library_plan primary key,
  name text not null,
  max_books integer check (max_books is null or max_books > 0),
  max_members integer check (max_members is null or max_members > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();

insert into public.plans (id, name, max_books, max_members) values
  ('free', 'Gratuito', 300, 2),
  ('pro', 'Pro', null, 8);

alter table public.plans enable row level security;
create policy "todos leem os planos" on public.plans for select to authenticated using (true);

-- Assinaturas (uma linha por pessoa e produto), gravadas só pelo webhook.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('app_store', 'play_store', 'stripe', 'promotional', 'manual')),
  product_id text not null,
  status text not null check (status in ('active', 'cancelled', 'billing_issue', 'expired')),
  expires_at timestamptz,
  environment text not null default 'production',
  last_event text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, product_id)
);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;
create policy "cada um vê as suas" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Pro enquanto houver assinatura não expirada (cancelada vale até o fim do período).
create or replace function public.sync_plan_for_user(p_user_id uuid)
returns public.library_plan
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.library_plan;
begin
  v_plan := case
    when exists (
      select 1 from public.subscriptions s
      where s.user_id = p_user_id
        and s.status <> 'expired'
        and (s.expires_at is null or s.expires_at > now())
        and s.environment = 'production'
    ) then 'pro'
    else 'free'
  end;
  update public.libraries set plan = v_plan where owner_id = p_user_id and plan <> v_plan;
  return v_plan;
end;
$$;

-- Só o service role (webhook) chama.
revoke all on function public.sync_plan_for_user(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Limites
-- -----------------------------------------------------------------------------
create or replace function private.plan_of(p_library_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.plans p join public.libraries l on l.plan = p.id where l.id = p_library_id;
$$;

-- "Livros no acervo" = livros com ao menos um exemplar ativo. Leituras de
-- livros emprestados e a lista de desejos não contam.
create or replace function private.enforce_book_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_count integer;
begin
  if new.status <> 'active' or (tg_op = 'UPDATE' and old.status = 'active' and old.book_id = new.book_id) then
    return new;
  end if;
  -- Outro exemplar do mesmo livro não aumenta a contagem.
  if exists (
    select 1 from public.copies c
    where c.book_id = new.book_id and c.status = 'active' and c.id <> new.id
  ) then
    return new;
  end if;

  v_plan := private.plan_of(new.library_id);
  if v_plan.max_books is null then
    return new;
  end if;

  select count(distinct c.book_id) into v_count
  from public.copies c
  where c.library_id = new.library_id and c.status = 'active' and c.id <> new.id;

  if v_count >= v_plan.max_books then
    raise exception 'plan_limit_books'
      using errcode = 'P0001', detail = format('%s livros no plano %s', v_plan.max_books, v_plan.name);
  end if;
  return new;
end;
$$;

create trigger enforce_book_limit before insert or update of status, book_id on public.copies
  for each row execute function private.enforce_book_limit();

create or replace function private.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_count integer;
begin
  v_plan := private.plan_of(new.library_id);
  if v_plan.max_members is null then
    return new;
  end if;
  select count(*) into v_count from public.library_members where library_id = new.library_id;
  if v_count >= v_plan.max_members then
    raise exception 'plan_limit_members'
      using errcode = 'P0001', detail = format('%s pessoas no plano %s', v_plan.max_members, v_plan.name);
  end if;
  return new;
end;
$$;

create trigger enforce_member_limit before insert on public.library_members
  for each row execute function private.enforce_member_limit();

-- Convites também param no limite, para o erro aparecer antes de enviar o link.
create trigger enforce_member_limit before insert on public.library_invites
  for each row execute function private.enforce_member_limit();

-- Uso atual × limites do plano, para a tela de planos.
create or replace function public.library_usage(p_library_id uuid)
returns table (plan public.library_plan, plan_name text, books integer, max_books integer, members integer, max_members integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.plan,
    p.name,
    (select count(distinct c.book_id)::integer from public.copies c
      where c.library_id = l.id and c.status = 'active'),
    p.max_books,
    (select count(*)::integer from public.library_members m where m.library_id = l.id),
    p.max_members
  from public.libraries l
  join public.plans p on p.id = l.plan
  where l.id = p_library_id;
$$;

grant execute on function public.library_usage(uuid) to authenticated;
