import type { Genre, GenreAlias } from '@/types/models';

/**
 * Mapeia as categorias das APIs ("Fiction / Science Fiction", "Ficção
 * brasileira", "Cartoons; caricaturas e quadrinhos") para os gêneros da
 * biblioteca. Ordem: apelidos aprendidos → nome idêntico → regras por palavra.
 * O que não casar vira sugestão — nunca um gênero novo (RF8).
 */

export function normalizeKey(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const IGNORED = new Set([
  'general',
  'geral',
  'outros',
  'other',
  'fiction general',
  'livros',
  'books',
]);

/** Quebra "A / B; C" em partes, sem repetição. */
export function splitCategories(raw: string[]): string[] {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const category of raw) {
    for (const piece of category.split(/\s*[/;>]\s*|\s+--\s+/)) {
      const trimmed = piece.trim().replace(/\.$/, '');
      const key = normalizeKey(trimmed);
      if (!trimmed || IGNORED.has(key) || seen.has(key)) continue;
      seen.add(key);
      parts.push(trimmed);
    }
  }
  return parts;
}

/** [padrão sobre o texto normalizado, nome do gênero padrão | null = ignorar]. */
const RULES: [RegExp, string | null][] = [
  [/criticism|critica literaria|literary collections|antologia/, null],
  [/science fiction|ficcao cientifica|sci-fi|distop/, 'Ficção científica'],
  [/fantas/, 'Fantasia'],
  [/horror|terror/, 'Terror'],
  [/myster|thriller|suspense|misterio/, 'Suspense e mistério'],
  [/crime|detective|policia|detetive/, 'Policial'],
  [/romance|love stor|romantic/, 'Romance'],
  [/brazil|brasil/, 'Literatura brasileira'],
  [/classic|classico/, 'Clássicos'],
  [/poet|poesia|poema/, 'Poesia'],
  [/short stor|contos/, 'Contos'],
  [/cronica/, 'Crônicas'],
  [/biograph|memoir|biografia|memoria/, 'Biografia e memórias'],
  [/comic|graphic novel|manga|quadrinho|\bhq\b|cartoon|caricatura/, 'HQ e mangá'],
  [/juvenile fiction|young adult|juvenil/, 'Juvenil'],
  [/juvenile|children|infantil|crianca/, 'Infantil'],
  [/histor/, 'História'],
  [/philosoph|filosofia/, 'Filosofia'],
  [/psycholog|psicolog/, 'Psicologia'],
  [/self-help|self help|autoajuda|auto-ajuda|desenvolvimento pessoal/, 'Autoajuda'],
  [/business|econom|negocio|administracao|financ|management/, 'Negócios e economia'],
  [/computer|technolog|engineering|tecnolog|informatica|programacao/, 'Tecnologia'],
  [/science|ciencia|mathemat|matematica|physics|fisica|biolog|quimica|chemistry|nature/, 'Ciência'],
  [/politic|social science|sociolog|sociedade|anthropolog/, 'Política e sociedade'],
  [
    /religi|spiritual|body, mind|christian|biblia|bible|espiritual|teolog/,
    'Religião e espiritualidade',
  ],
  [
    /\bart\b|\barte\b|photograph|fotografia|design|music|musica|architecture|arquitetura/,
    'Arte e fotografia',
  ],
  [/cook|culinaria|receita|gastronom/, 'Culinária'],
  [/travel|viage|turismo/, 'Viagem'],
  [/education|educacao|pedagog|study aids|ensino/, 'Educação'],
  [/health|fitness|saude|bem-estar|medic|nutri/, 'Saúde e bem-estar'],
  [/fiction|ficcao|literature|literatura|novel/, 'Ficção'],
];

/** Gêneros de ficção que tornam o genérico "Ficção" redundante. */
const SPECIFIC_FICTION = new Set(
  [
    'Ficção científica',
    'Fantasia',
    'Terror',
    'Suspense e mistério',
    'Policial',
    'Romance',
    'Literatura brasileira',
    'Clássicos',
    'Contos',
    'Juvenil',
  ].map(normalizeKey),
);

export type GenreMapping = {
  genreIds: string[];
  /** Partes sem gênero correspondente, para o usuário mapear se quiser. */
  suggestions: string[];
};

export function mapCategories(
  raw: string[],
  genres: Pick<Genre, 'id' | 'name'>[],
  aliases: Pick<GenreAlias, 'alias' | 'genre_id'>[] = [],
): GenreMapping {
  const byName = new Map(genres.map((g) => [normalizeKey(g.name), g.id]));
  const byAlias = new Map(aliases.map((a) => [normalizeKey(a.alias), a.genre_id]));
  const matched = new Set<string>();
  const suggestions: string[] = [];

  for (const piece of splitCategories(raw)) {
    const key = normalizeKey(piece);
    let genreId = byAlias.get(key) ?? byName.get(key);

    if (!genreId) {
      const rule = RULES.find(([pattern]) => pattern.test(key));
      if (rule && rule[1] === null) continue;
      genreId = rule ? byName.get(normalizeKey(rule[1]!)) : undefined;
    }

    if (genreId) matched.add(genreId);
    else if (suggestions.length < 6) suggestions.push(piece);
  }

  const fictionId = byName.get(normalizeKey('Ficção'));
  if (fictionId && matched.has(fictionId)) {
    const hasSpecific = genres.some(
      (g) => matched.has(g.id) && SPECIFIC_FICTION.has(normalizeKey(g.name)),
    );
    if (hasSpecific) matched.delete(fictionId);
  }

  return { genreIds: [...matched], suggestions };
}
