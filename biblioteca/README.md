# Biblioteca e Leituras

App pessoal/familiar para catalogar a biblioteca (física e digital) e registrar
leituras. Expo + Expo Router + TypeScript + NativeWind, com Supabase no backend.
Publicado primeiro como PWA (Vercel) e depois nas lojas (EAS).

- Produto e fases: [`../docs/PRD.md`](../docs/PRD.md)
- Convenções e modelo de dados: [`../CLAUDE.md`](../CLAUDE.md)

## Rodando localmente

```bash
cd biblioteca
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run web                  # ou: npm start (Expo Go / dev build)
```

Sem o `.env.local` o app abre uma tela explicando o que falta.

## Supabase

1. Crie um projeto em <https://supabase.com> e copie **Project URL** e **anon key**
   (Project Settings → API) para o `.env.local`.
2. Aplique o esquema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npm run db:push
   ```
3. **Authentication → URL Configuration**
   - Site URL: a URL do PWA (ex.: `https://biblioteca.vercel.app`)
   - Redirect URLs: `https://biblioteca.vercel.app/auth/callback`,
     `http://localhost:8081/auth/callback`, `biblioteca://auth/callback`
4. **Authentication → Providers**
   - E-mail: deixe o _magic link_ habilitado.
   - Google: crie um OAuth Client (Web) no Google Cloud com o redirect
     `https://<ref>.supabase.co/auth/v1/callback` e cole Client ID/Secret.
5. Opcional: `npm run db:types` gera os tipos do banco em `src/types/database.ts`.

### Edge Functions (Fase 2)

| Função            | Para quê                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `isbn-lookup`     | Busca de ISBN em cascata (BrasilAPI → Google Books → Open Library) com cache em `isbn_cache`, e busca por título/autor |
| `loan-reminders`  | Lembretes de devolução por Web Push, uma vez por dia                                                                   |
| `import-enrich`   | Depois de importar, completa capa e páginas dos livros pelo ISBN                                                       |
| `billing-webhook` | Recebe os eventos do RevenueCat e atualiza o plano da casa (Fase 5)                                                    |

1. Gere as chaves VAPID (uma vez): `npx web-push generate-vapid-keys`.
2. Cadastre os segredos:
   ```bash
   npx supabase secrets set \
     GOOGLE_BOOKS_API_KEY=... \
     CRON_SECRET=$(openssl rand -hex 24) \
     VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@exemplo.com
   ```
   A chave do Google Books vem do Google Cloud (APIs → Books API); sem ela a cota
   diária é praticamente zero. Guarde o `CRON_SECRET` para o passo 5.
3. Publique: `npm run functions:deploy` (publica as quatro funções).
4. Coloque a **chave pública** VAPID em `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (`.env.local` e Vercel).
5. Agende os lembretes (SQL Editor; exige as extensões `pg_cron` e `pg_net`). 12h UTC = 9h em Brasília:
   ```sql
   select cron.schedule('lembretes-emprestimos', '0 12 * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/loan-reminders',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
       body := '{}'::jsonb
     );
   $$);
   ```

Lembretes por notificação funcionam no PWA (no iPhone, só com o app instalado na tela
de início, iOS 16.4+) e no app das lojas (Expo Push, via `expo-notifications`); a mesma
função `loan-reminders` envia para os dois e apaga tokens que deixaram de valer.

## Publicando o PWA na Vercel

Importe o repositório na Vercel e defina **Root Directory = `biblioteca`**. O
`vercel.json` já configura build (`expo export --platform web`), saída `dist`,
rota dinâmica de convites e cabeçalhos do service worker. Cadastre
`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` nas variáveis de
ambiente do projeto. Cada push publica uma nova versão.

## Apps nas lojas (Fase 5)

Os builds rodam na nuvem com EAS (`eas.json`: `development`, `preview` e `production`).

1. Contas: Apple Developer (US$ 99/ano) e Google Play Console (US$ 25 uma vez).
2. Vincule o projeto: `npx eas-cli@latest login` e `npx eas-cli@latest init`
   (grava `extra.eas.projectId` no `app.json`; ele é usado pelo Expo Push).
3. Segredos do build: `npx eas-cli@latest env:create` para `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL` e as chaves do RevenueCat.
4. Build de teste: `npx eas-cli@latest build --profile development` (dev client) ou
   `--profile preview` (APK para instalar direto no Android).
5. Loja: `npx eas-cli@latest build --profile production --platform all` e
   `npx eas-cli@latest submit --profile production`.
6. Notificações no Android: envie a chave FCM v1 com `npx eas-cli@latest credentials`.
   No iOS o EAS cria a chave APNs no primeiro build.

Adicione `biblioteca://auth/callback` às Redirect URLs do Supabase (passo 3 acima).

## Planos e assinaturas (Fase 5)

O plano é da **casa** e vem da assinatura do dono. Limites ficam na tabela
`plans` e podem ser mudados pelo SQL Editor sem deploy (padrão: Gratuito até 300
livros no acervo e 2 pessoas; Pro ilimitado e até 8 pessoas). Leituras de livros
fora do acervo e a lista de desejos não contam no limite.

1. **RevenueCat:** crie o projeto, os apps (App Store, Play Store e Web Billing com
   Stripe), os produtos (ex.: `pro_mensal`, `pro_anual`), o entitlement **`pro`** com
   esses produtos e uma _offering_ padrão com os pacotes mensal e anual.
2. Copie as chaves públicas para `EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` e `EXPO_PUBLIC_REVENUECAT_WEB_KEY`.
3. Webhook: em _Integrations → Webhooks_ use a URL
   `https://<ref>.supabase.co/functions/v1/billing-webhook` e um cabeçalho
   Authorization aleatório; grave o mesmo valor com
   `npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=...`.
4. Publique as funções (`npm run functions:deploy`).

O app usa o id do usuário do Supabase como `app_user_id`, então a mesma assinatura
vale no celular e na web. Pix/Mercado Pago não são suportados pelo RevenueCat.

Para dar Pro de cortesia (ex.: a sua família), no SQL Editor:

```sql
insert into public.subscriptions (user_id, provider, product_id, status)
values ('<id do dono>', 'manual', 'cortesia', 'active');
select public.sync_plan_for_user('<id do dono>');
```

## Scripts

| Script                     | O que faz                                                  |
| -------------------------- | ---------------------------------------------------------- |
| `npm run web`              | Servidor de desenvolvimento na web                         |
| `npm run build:web`        | Exporta o PWA estático para `dist/`                        |
| `npm run check`            | Typecheck + lint + Prettier + testes (rode antes de subir) |
| `npm test`                 | Testes unitários (ISBN, fontes, gêneros, datas, filtros…)  |
| `npm run format`           | Formata o código                                           |
| `npm run db:push`          | Aplica as migrações no projeto Supabase vinculado          |
| `npm run db:types`         | Gera os tipos TypeScript do banco                          |
| `npm run functions:deploy` | Publica as Edge Functions                                  |
