# Biblioteca e Leituras

App mobile pessoal para catalogar a biblioteca (física e digital) e registrar todas
as leituras, inclusive de livros fora do acervo. Uso em família no MVP; produto
comercial depois (arquitetura multiusuário desde já). PRD completo em
[`docs/PRD.md`](docs/PRD.md).

> O app fica em [`biblioteca/`](biblioteca/). Os arquivos na raiz (`src/`,
> `ionic.config.json`, …) são um projeto antigo de Ionic 3 e não fazem parte do app.

## Stack

- **App:** Expo SDK 57 + Expo Router + TypeScript (`biblioteca/src/app` = rotas)
- **Estilo:** NativeWind v4 (Tailwind 3). Cores são tokens em `src/global.css`
  (`bg-paper`, `text-ink`, `text-muted`, `bg-accent`…), com modo escuro automático.
  Cores em JS (ícones, navegação) vêm de `src/constants/theme.ts` → `usePalette()`.
- **Dados:** Supabase (Postgres + RLS, Auth, Storage, Edge Functions) via
  `src/lib/supabase.ts`; leitura/cache com TanStack Query (`src/lib/queries.ts`).
- **Web:** PWA estático na Vercel (`vercel.json`, `public/sw.js`, `src/app/+html.tsx`).
- **Lojas (v2):** EAS Build + RevenueCat.

Leia `biblioteca/AGENTS.md` antes de mexer em APIs do Expo: elas mudam a cada SDK.

## Convenções

- **Textos da interface em português do Brasil.** Código, nomes de arquivos
  internos, tabelas e colunas em **inglês**. Rotas visíveis podem ser em pt-BR
  (`/biblioteca`, `/convite/[token]`).
- Estilo com classes do Tailwind (`className`); `style` só para valores
  dinâmicos ou por plataforma (ex.: `serif` em `components/ui/typography.tsx`).
- Componentes base em `src/components/ui` (Button, Card, TextField, Screen,
  EmptyState, ListItem, Icon, Heading/Body/Muted). Reuse antes de criar outro.
- Títulos em serifa (`Heading`, `Subheading`), interface em sans-serif.
- Cantos de 16px (`rounded-card`), alvos de toque ≥ 44px, contraste AA.
- Arquivo por plataforma quando necessário: `algo.web.tsx` / `algo.native.tsx`
  (ex.: scanner com `@zxing/browser` na web e `expo-camera` no nativo).
- Consultas sempre filtradas pela library atual (`useCurrentLibrary()`); chaves
  do React Query começam com `['library', libraryId, …]`.
- Instale pacotes com `npx expo install` (versões compatíveis com o SDK).
- Antes de concluir: `npm run check` (typecheck + lint + prettier) e
  `npm run build:web`.

## Modelo de dados

Regra central: **Livro** (`books`, a obra) ≠ **Exemplar** (`copies`, o que a casa
possui) ≠ **Leitura** (`readings`, o que cada pessoa leu). Assim uma leitura de
livro emprestado não aparece no acervo.

Tudo pertence a uma `library` (a casa). Livros, exemplares, empréstimos e gêneros
são da library; leituras e metas são de cada membro. Todas as tabelas têm `id`,
`created_at`, `updated_at` (trigger). Esquema em
`biblioteca/supabase/migrations/`.

| Tabela | Campos principais |
| --- | --- |
| `libraries` | name, owner_id, plan (free/pro) |
| `library_members` | library_id, user_id, role (owner/member), display_name |
| `library_invites` | library_id, token, email?, role, invited_by, expires_at, accepted_at |
| `books` | library_id, isbn_13, isbn_10, title, subtitle, authors[], publisher, year, pages, audio_minutes, language, cover_url, source |
| `genres` | library_id, name, parent_id |
| `book_genres` | library_id, book_id, genre_id |
| `copies` | library_id, book_id, format (physical/ebook/audiobook/subscription), platform, location, condition, acquired_at, price, owner_member_id, status (active/sold/donated/lost/expired) |
| `loans` | library_id, copy_id, borrower_name, borrower_phone, lent_at, due_at, returned_at |
| `readings` | library_id, member_id, book_id, copy_id?, origin (own/borrowed/library/subscription/no_longer_owned), lent_by, status (want/reading/read/abandoned), started_at, finished_at, rating 1–5, review |
| `reading_progress` | library_id, reading_id, date, page, percent, minutes |
| `goals` | library_id, member_id, year, target_books, target_pages |
| `imports` | library_id, source (goodreads/skoob/sheet), file_url, status, rows_total, rows_imported |

Diferenças em relação ao PRD, para RLS e integridade: `library_invites` é nova;
`book_genres`, `loans`, `reading_progress` e `goals` também guardam `library_id`.
As filhas usam FKs compostas `(id, library_id)`, então nada aponta para outra casa.

### Segurança (RLS)

- Helpers `private.is_member(library_id)`, `private.is_owner(library_id)`,
  `private.is_me(member_id)` (security definer).
- Dados da casa (books, copies, loans, book_genres, imports): membros leem e escrevem.
- Gêneros: membros leem; só o dono cria/edita/apaga.
- Leituras, progresso e metas: a família lê (relatórios "da família"); cada um só
  escreve as suas.
- `libraries.plan`/`owner_id` não são editáveis pelo cliente; membros só mudam o
  próprio `display_name`.
- Entrar numa casa só via RPC: `create_library(name, display_name)` e
  `accept_invite(token, display_name)` (uso único, expira em 14 dias; convite
  com e-mail só vale para aquele e-mail). `get_invite(token)` mostra a prévia.
- Storage: bucket público `covers`, caminho `<library_id>/<arquivo>`.

## Fases de entrega

1. **Base** ✅ — Expo + Supabase, login (link mágico e Google), libraries e
   convites de família, tabelas com RLS, PWA instalável, navegação e tema.
2. **Acervo** — scanner (EAN-13), busca de ISBN em cascata numa Edge Function
   (BrasilAPI → Google Books → Open Library, com cache), modo lote, cadastro
   manual, gêneros editáveis, Física/Online com filtros, empréstimos com lembretes.
3. **Leituras e relatórios** — status, origens externas, progresso, metas, as
   quatro abas de relatórios (react-native-gifted-charts).
4. **Importação e exportação** — Goodreads, Skoob, planilha com mapeamento,
   exportação CSV/JSON.
5. **Versão 2** — builds EAS, planos pagos, RevenueCat, lista de desejos,
   exportação para Instagram.
