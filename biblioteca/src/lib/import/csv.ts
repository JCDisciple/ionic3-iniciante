/** Leitura de CSV (RFC 4180 + variações do Excel brasileiro). Puro e testável. */

export type Table = { headers: string[]; rows: string[][] };

// Caracteres 0x80–0x9F do Windows-1252 (o resto coincide com Latin-1).
const CP1252: Record<number, string> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};

function decodeCp1252(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b >= 0x80 && b <= 0x9f ? (CP1252[b] ?? '') : String.fromCharCode(b);
  return out;
}

/** UTF-8 quando válido; senão Windows-1252 (CSV salvo pelo Excel em pt-BR). */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = decodeCp1252(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Escolhe entre vírgula, ponto e vírgula e tab pela primeira linha (fora de aspas). */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Primeira linha vira cabeçalho (nomes vazios ou repetidos ganham sufixo). */
export function toTable(matrix: string[][]): Table {
  const [head = [], ...rest] = matrix;
  const seen = new Map<string, number>();
  const width = Math.max(head.length, ...rest.map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => {
    const base = (head[i] ?? '').trim() || `Coluna ${i + 1}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base} (${n + 1})` : base;
  });
  return { headers, rows: rest.map((r) => headers.map((_, i) => (r[i] ?? '').trim())) };
}
