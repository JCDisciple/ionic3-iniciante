import assert from 'node:assert/strict';
import { test } from 'node:test';

import { escapeXml, goalCardSvg, truncate, yearCardSvg } from './share-card.ts';

test('escapa texto do usuário e trunca', () => {
  assert.equal(escapeXml('Tom & Jerry <3 "x"'), 'Tom &amp; Jerry &lt;3 &quot;x&quot;');
  assert.equal(truncate('Eu Sei Por Que o Pássaro Canta na Gaiola', 20), 'Eu Sei Por Que o Pá…');
  assert.equal(truncate('Curto', 20), 'Curto');
});

test('cartão do ano: tamanho de story, números e destaques escapados', () => {
  const svg = yearCardSvg({
    name: 'Rodrigo',
    year: 2026,
    books: 12,
    pages: 4768,
    monthlyBooks: [2, 1, 1, 1, 2, 1, 1, 2, 1, 0, 0, 0],
    facts: [{ label: 'Autor mais lido', value: 'Machado & Cia' }],
  });
  assert.match(svg, /^<svg[^>]+width="1080" height="1920"/);
  assert.match(svg, />12</);
  assert.match(svg, /4\.768 páginas viradas/);
  assert.match(svg, /Machado &amp; Cia/);
  assert.equal((svg.match(/<path /g) ?? []).length, 9); // uma coluna por mês com leitura
  assert.doesNotMatch(svg, /Machado & Cia/);
});

test('cartão da meta: anel proporcional e tema escuro', () => {
  const svg = goalCardSvg(
    {
      name: 'Ana',
      year: 2026,
      books: 5,
      target: 20,
      projected: 7,
      paceText: 'Um pouco atrás da meta',
    },
    'dark',
  );
  assert.match(svg, /25% da meta/);
  assert.match(svg, /fill="#15130F"/);
  assert.match(svg, /No ritmo atual: 7 livros/);
  const empty = goalCardSvg({
    name: 'Ana',
    year: 2026,
    books: 0,
    target: 20,
    projected: null,
    paceText: null,
  });
  assert.equal((empty.match(/<circle /g) ?? []).length, 1); // só o trilho
});
