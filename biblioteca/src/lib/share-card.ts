/**
 * Cartões para compartilhar nos stories (1080×1920), gerados como SVG puro:
 * na web viram PNG por canvas; no nativo são desenhados com SvgXml e
 * capturados. Sem imagens remotas (capas) para não "sujar" o canvas.
 *
 * Paleta papel e tinta; a cor de dados é a série 1 validada (ChartColors).
 */

import { MONTH_LABELS } from '@/lib/stats';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

export type CardTheme = 'light' | 'dark';

const THEMES = {
  light: {
    bg: '#F7F3EC',
    surface: '#FFFDF8',
    ink: '#1F1B16',
    muted: '#665E53',
    line: '#E2DACC',
    accent: '#A84C25',
    onAccent: '#FFFDF8',
    series: '#A84C25',
    track: '#F1DDD3',
  },
  dark: {
    bg: '#15130F',
    surface: '#1F1C17',
    ink: '#F2ECE2',
    muted: '#ADA496',
    line: '#3A352D',
    accent: '#E68E62',
    onAccent: '#15130F',
    series: '#D9764A',
    track: '#3A2A22',
  },
} as const;

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Corta com reticências para caber (aproximação por número de caracteres). */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');

function text(
  x: number,
  y: number,
  content: string,
  opts: {
    size: number;
    fill: string;
    weight?: number;
    family?: string;
    anchor?: 'start' | 'middle' | 'end';
  },
) {
  return `<text x="${x}" y="${y}" font-family="${opts.family ?? SANS}" font-size="${opts.size}" font-weight="${
    opts.weight ?? 400
  }" fill="${opts.fill}" text-anchor="${opts.anchor ?? 'start'}">${escapeXml(content)}</text>`;
}

/** Colunas finas com ponta arredondada, base reta; rótulo só no maior mês. */
function monthColumns(
  values: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  c: (typeof THEMES)[CardTheme],
) {
  const max = Math.max(1, ...values);
  const band = width / 12;
  const barW = Math.min(40, band * 0.6);
  const peak = values.indexOf(Math.max(...values));
  const parts: string[] = [
    `<line x1="${x}" x2="${x + width}" y1="${y + height}" y2="${y + height}" stroke="${c.line}" stroke-width="2"/>`,
  ];
  values.forEach((v, i) => {
    const cx = x + i * band + band / 2;
    if (v > 0) {
      const h = Math.max(8, (v / max) * (height - 40));
      const top = y + height - h;
      const left = cx - barW / 2;
      const r = Math.min(8, barW / 2, h);
      parts.push(
        `<path d="M${left},${y + height} L${left},${top + r} Q${left},${top} ${left + r},${top} L${left + barW - r},${top} Q${left + barW},${top} ${left + barW},${top + r} L${left + barW},${y + height} Z" fill="${c.series}"/>`,
      );
      if (i === peak)
        parts.push(
          text(cx, top - 14, fmt(v), { size: 30, fill: c.ink, weight: 700, anchor: 'middle' }),
        );
    }
    parts.push(
      text(cx, y + height + 44, MONTH_LABELS[i], { size: 26, fill: c.muted, anchor: 'middle' }),
    );
  });
  return parts.join('');
}

function frame(c: (typeof THEMES)[CardTheme], body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"><rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${c.bg}"/>${body}${text(
    CARD_WIDTH / 2,
    CARD_HEIGHT - 90,
    'Biblioteca e Leituras',
    { size: 30, fill: c.muted, family: SERIF, anchor: 'middle' },
  )}</svg>`;
}

export type YearCardData = {
  name: string;
  year: number;
  books: number;
  pages: number;
  monthlyBooks: number[];
  facts: { label: string; value: string }[];
};

/** "Meu ano em leituras" em formato de story. */
export function yearCardSvg(data: YearCardData, theme: CardTheme = 'light'): string {
  const c = THEMES[theme];
  const parts: string[] = [];
  parts.push(
    text(90, 200, `${data.year} em leituras`, {
      size: 76,
      fill: c.ink,
      weight: 700,
      family: SERIF,
    }),
  );
  parts.push(text(90, 262, truncate(data.name, 40), { size: 36, fill: c.muted }));

  // Bloco de destaque
  parts.push(`<rect x="90" y="330" width="900" height="520" rx="48" fill="${c.accent}"/>`);
  parts.push(
    text(540, 610, fmt(data.books), { size: 260, fill: c.onAccent, weight: 700, anchor: 'middle' }),
  );
  parts.push(
    text(540, 690, data.books === 1 ? 'livro lido' : 'livros lidos', {
      size: 48,
      fill: c.onAccent,
      anchor: 'middle',
    }),
  );
  parts.push(
    text(540, 780, `${fmt(data.pages)} páginas viradas`, {
      size: 38,
      fill: c.onAccent,
      anchor: 'middle',
    }),
  );

  // Livros por mês
  parts.push(text(90, 950, 'Livros por mês', { size: 34, fill: c.ink, weight: 700 }));
  parts.push(monthColumns(data.monthlyBooks, 90, 990, 900, 280, c));

  // Destaques
  data.facts.slice(0, 4).forEach((fact, i) => {
    const y = 1420 + i * 100;
    parts.push(
      `<line x1="90" x2="990" y1="${y - 62}" y2="${y - 62}" stroke="${c.line}" stroke-width="2"/>`,
    );
    parts.push(text(90, y, fact.label, { size: 30, fill: c.muted }));
    parts.push(
      text(990, y, truncate(fact.value, 34), {
        size: 34,
        fill: c.ink,
        weight: 700,
        family: SERIF,
        anchor: 'end',
      }),
    );
  });
  return frame(c, parts.join(''));
}

export type GoalCardData = {
  name: string;
  year: number;
  books: number;
  target: number;
  projected: number | null;
  paceText: string | null;
};

/** Meta anual em formato de story: anel grande + projeção. */
export function goalCardSvg(data: GoalCardData, theme: CardTheme = 'light'): string {
  const c = THEMES[theme];
  const r = 300;
  const stroke = 56;
  const cx = 540;
  const cy = 820;
  const circumference = 2 * Math.PI * r;
  const fraction = data.target > 0 ? Math.min(1, data.books / data.target) : 0;
  const parts: string[] = [];
  parts.push(
    text(90, 200, `Meta de ${data.year}`, { size: 76, fill: c.ink, weight: 700, family: SERIF }),
  );
  parts.push(text(90, 262, truncate(data.name, 40), { size: 36, fill: c.muted }));
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.track}" stroke-width="${stroke}"/>`,
  );
  if (fraction > 0) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.series}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(
        circumference * fraction
      ).toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`,
    );
  }
  parts.push(
    text(cx, cy + 40, fmt(data.books), { size: 200, fill: c.ink, weight: 700, anchor: 'middle' }),
  );
  parts.push(
    text(cx, cy + 120, `de ${fmt(data.target)} livros`, {
      size: 44,
      fill: c.muted,
      anchor: 'middle',
    }),
  );
  parts.push(
    text(cx, 1300, `${Math.round(fraction * 100)}% da meta`, {
      size: 64,
      fill: c.ink,
      weight: 700,
      anchor: 'middle',
    }),
  );
  if (data.paceText)
    parts.push(text(cx, 1380, data.paceText, { size: 40, fill: c.muted, anchor: 'middle' }));
  if (data.projected !== null) {
    parts.push(
      text(
        cx,
        1480,
        `No ritmo atual: ${fmt(data.projected)} ${data.projected === 1 ? 'livro' : 'livros'} até dezembro`,
        {
          size: 38,
          fill: c.ink,
          anchor: 'middle',
        },
      ),
    );
  }
  return frame(c, parts.join(''));
}
