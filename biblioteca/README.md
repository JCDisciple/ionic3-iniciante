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
   - E-mail: deixe o *magic link* habilitado.
   - Google: crie um OAuth Client (Web) no Google Cloud com o redirect
     `https://<ref>.supabase.co/auth/v1/callback` e cole Client ID/Secret.
5. Opcional: `npm run db:types` gera os tipos do banco em `src/types/database.ts`.

### Edge Functions (Fase 2)

| Função | Para quê |
| --- | --- |
| `isbn-lookup` | Busca de ISBN em cascata (BrasilAPI → Google Books → Open Library) com cache em `isbn_cache`, e busca por título/autor |
| `loan-reminders` | Lembretes de devolução por Web Push, uma vez por dia |

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
3. Publique: `npm run functions:deploy`.
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
de início, iOS 16.4+). No app das lojas (v2) serão feitos com `expo-notifications`.

## Publicando o PWA na Vercel

Importe o repositório na Vercel e defina **Root Directory = `biblioteca`**. O
`vercel.json` já configura build (`expo export --platform web`), saída `dist`,
rota dinâmica de convites e cabeçalhos do service worker. Cadastre
`EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` nas variáveis de
ambiente do projeto. Cada push publica uma nova versão.

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run web` | Servidor de desenvolvimento na web |
| `npm run build:web` | Exporta o PWA estático para `dist/` |
| `npm run check` | Typecheck + lint + Prettier + testes (rode antes de subir) |
| `npm test` | Testes unitários (ISBN, fontes, gêneros, datas, filtros…) |
| `npm run format` | Formata o código |
| `npm run db:push` | Aplica as migrações no projeto Supabase vinculado |
| `npm run db:types` | Gera os tipos TypeScript do banco |
| `npm run functions:deploy` | Publica as Edge Functions |
