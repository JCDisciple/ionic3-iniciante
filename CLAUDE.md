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
- Antes de concluir: `npm run check` (typecheck + lint + prettier + testes) e
  `npm run build:web`. Testes unitários ficam ao lado do código (`*.test.ts`,
  `node:test`) e rodam no Node sem build; mantenha a lógica testável em `src/lib`.

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
| `genre_aliases` | library_id, alias (categoria normalizada), genre_id |
| `isbn_cache` | isbn, found, data (só a Edge Function acessa) |
| `push_subscriptions` | user_id, endpoint, p256dh, auth |

Diferenças em relação ao PRD, para RLS e integridade: `library_invites`,
`genre_aliases`, `isbn_cache` e `push_subscriptions` são novas; `loans` também
tem `created_by` (quem recebe o lembrete) e `last_reminded_on`;
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
- Cadastro sempre pela RPC `add_to_library(library, book, genre_ids, copy, reading)`
  (atômica; reaproveita o livro se o ISBN já existe). Outras RPCs: `set_book_genres`,
  `merge_genres` (dono), `save_push_subscription`.

### Acervo (Fase 2)

- ISBN: `supabase/functions/_shared/isbn.ts` (validação ISBN-10/13, conversão) é
  usado pelo app via alias `@shared/*` e pela Edge Function. Código em `_shared`
  tem de ser puro (sem APIs do Deno) e importar com extensão `.ts`.
- Busca: Edge Function `isbn-lookup` consulta as três fontes em paralelo e combina
  na ordem BrasilAPI → Google Books → Open Library (a primeira que trouxer um
  campo vence; as outras completam capa/gênero). Cache de 90 dias (7 se não achou).
- Gêneros das APIs: `src/lib/genres.ts` mapeia categorias → gêneros da casa
  (apelidos aprendidos → nome igual → regras por palavra). O que não casar vira
  sugestão; ao associar, grava um `genre_aliases`.
- Scanner: `components/barcode-camera.tsx` (expo-camera) e `.web.tsx`
  (@zxing/browser). Modo lote guarda a fila em `lib/batch-store.ts`.
- Empréstimos: lembrete por Web Push (`loan-reminders` + `public/sw.js`) no dia
  da devolução e a cada 7 dias de atraso; cobrança por link `wa.me`.

### Leituras e relatórios (Fase 3)

- Progresso sempre pela RPC `log_progress(reading, date, page|percent|minutes)`:
  um registro por leitura e dia (registrar de novo substitui); "quero ler" e
  "abandonado" viram "lendo". Concluir/abandonar pela RPC `finish_reading`, que
  grava o progresso final (100%). Releitura = nova linha em `readings`
  (`add_to_library` aceita `p_reading.copy_id` para um exemplar existente).
- Unidade do progresso por formato (`src/lib/progress.ts`): físico → página,
  e-book/assinatura → %, audiobook → minutos.
- Estatísticas em `src/lib/stats.ts` (puras, testadas): um livro conta no mês em
  que foi **terminado**; páginas = páginas do livro terminado. "Meus" filtra por
  `member_id`; "da família" usa todas as leituras da casa.
- Gráficos: componentes próprios em `src/components/charts` sobre
  `react-native-svg` (em vez de react-native-gifted-charts, para seguir as
  especificações de marca: colunas ≤24px com ponta arredondada, grade discreta,
  toque para ver o valor, tabela equivalente em todo gráfico). Cores de dados em
  `ChartColors` (`constants/theme.ts`), validadas contra as superfícies do app;
  texto nunca usa cor de série. Um eixo só; filtros (meus/família, ano) numa
  linha acima de todos os gráficos.

## Fases de entrega

1. **Base** ✅ — Expo + Supabase, login (link mágico e Google), libraries e
   convites de família, tabelas com RLS, PWA instalável, navegação e tema.
2. **Acervo** ✅ — scanner (EAN-13), busca de ISBN em cascata numa Edge Function
   (BrasilAPI → Google Books → Open Library, com cache), modo lote, cadastro
   manual, gêneros editáveis, Física/Online com filtros, empréstimos com lembretes.
3. **Leituras e relatórios** ✅ — status, origens externas, progresso, metas, as
   quatro abas de relatórios (react-native-gifted-charts).
4. **Importação e exportação** — Goodreads, Skoob, planilha com mapeamento,
   exportação CSV/JSON.
5. **Versão 2** — builds EAS, planos pagos, RevenueCat, lista de desejos,
   exportação para Instagram.
