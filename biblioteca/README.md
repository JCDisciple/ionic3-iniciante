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
| `npm run check` | Typecheck + lint + Prettier (rode antes de subir) |
| `npm run format` | Formata o código |
| `npm run db:push` | Aplica as migrações no projeto Supabase vinculado |
| `npm run db:types` | Gera os tipos TypeScript do banco |
