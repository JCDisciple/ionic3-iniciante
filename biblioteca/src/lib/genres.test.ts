import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapCategories, normalizeKey, splitCategories } from './genres.ts';

const names = [
  'Ficção',
  'Romance',
  'Fantasia',
  'Ficção científica',
  'Terror',
  'Suspense e mistério',
  'Policial',
  'Literatura brasileira',
  'Clássicos',
  'Poesia',
  'Contos',
  'Crônicas',
  'Biografia e memórias',
  'História',
  'Filosofia',
  'Psicologia',
  'Autoajuda',
  'Negócios e economia',
  'Ciência',
  'Tecnologia',
  'Política e sociedade',
  'Religião e espiritualidade',
  'Infantil',
  'Juvenil',
  'HQ e mangá',
  'Arte e fotografia',
  'Culinária',
  'Viagem',
  'Educação',
  'Saúde e bem-estar',
];
const genres = names.map((name, i) => ({ id: `g${i}`, name }));
const idOf = (name: string) => genres.find((g) => g.name === name)!.id;
const namesOf = (ids: string[]) => ids.map((id) => genres.find((g) => g.id === id)!.name).sort();

test('normalizeKey remove acentos e caixa', () => {
  assert.equal(normalizeKey('  Ficção   Científica '), 'ficcao cientifica');
});

test('splitCategories quebra por / e ; e ignora genéricos', () => {
  assert.deepEqual(
    splitCategories(['Fiction / Science Fiction / General', 'Cartoons; caricaturas e quadrinhos']),
    ['Fiction', 'Science Fiction', 'Cartoons', 'caricaturas e quadrinhos'],
  );
});

test('Google: ficção científica sem o genérico "Ficção"', () => {
  const result = mapCategories(['Fiction / Science Fiction / General'], genres);
  assert.deepEqual(namesOf(result.genreIds), ['Ficção científica']);
  assert.deepEqual(result.suggestions, []);
});

test('BrasilAPI em português', () => {
  const result = mapCategories(['Ficção brasileira', 'Romance'], genres);
  assert.deepEqual(namesOf(result.genreIds), ['Literatura brasileira', 'Romance']);
});

test('mangá e biografia', () => {
  assert.deepEqual(
    namesOf(mapCategories(['Cartoons; caricaturas e quadrinhos', 'mangá'], genres).genreIds),
    ['HQ e mangá'],
  );
  assert.deepEqual(
    namesOf(mapCategories(['Biography & Autobiography / Personal Memoirs'], genres).genreIds),
    ['Biografia e memórias'],
  );
});

test('ficção genérica continua quando não há gênero específico', () => {
  assert.deepEqual(namesOf(mapCategories(['Fiction / Literary'], genres).genreIds), ['Ficção']);
});

test('categoria desconhecida vira sugestão, não gênero', () => {
  const result = mapCategories(['Gardening', 'Fiction'], genres);
  assert.deepEqual(namesOf(result.genreIds), ['Ficção']);
  assert.deepEqual(result.suggestions, ['Gardening']);
});

test('apelido aprendido tem prioridade', () => {
  const aliases = [{ alias: 'gardening', genre_id: idOf('Ciência') }];
  assert.deepEqual(namesOf(mapCategories(['Gardening'], genres, aliases).genreIds), ['Ciência']);
});

test('gênero renomeado pelo dono: a regra não acha e vira sugestão', () => {
  const renamed = genres.filter((g) => g.name !== 'Culinária').concat({ id: 'x', name: 'Cozinha' });
  const result = mapCategories(['Cooking / Regional & Ethnic'], renamed);
  assert.deepEqual(result.genreIds, []);
  assert.deepEqual(result.suggestions, ['Cooking', 'Regional & Ethnic']);
});

test('crítica literária é ignorada', () => {
  assert.deepEqual(mapCategories(['Literary Criticism / European'], genres).genreIds, []);
});
